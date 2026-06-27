# 너굴 사주 — 시스템 설계 (ARCHITECTURE)

이 문서는 전체 구조를 한눈에 보기 위한 단일 기준 문서입니다.
"무엇이 어디서 도는지 / 데이터가 어떻게 흐르는지 / 무엇이 진짜고 무엇이 데모인지 / 비용을 어떻게 낮추는지"를 담습니다.

---

## 1. 큰 그림

프론트(정적 파일)와 백엔드(`api/*` 서버리스 함수)를 **같은 Vercel 프로젝트**에 함께 올립니다.
같은 도메인이라 CORS가 필요 없고, 프론트는 `/api/...` 상대경로로 백엔드를 호출합니다.

```
┌─────────────────────── Vercel (한 프로젝트) ───────────────────────┐
│                                                                    │
│   [정적 프론트]                      [서버리스 백엔드 /api]          │
│   index.html                         api/fortune.js  → OpenAI       │
│   styles.css        ──fetch──▶       api/room.js     → Upstash Redis │
│   script.js                                                         │
│   config.js                                                         │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. 파일별 역할

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조. SPA — 해시 라우트에 따라 한 번에 한 화면만 보인다 |
| `js/core.js` | 앱 셸: 해시 라우팅, 화면 전환(showScreen/router/go), 토스트, 카카오, 공통 헬퍼 |
| `js/fortune.js` | 개인 운세: 주제 선택, 입력 폼, 결과 렌더, 기록(localStorage) |
| `js/room.js` | 궁합 방: 생성/참여/대시보드, 결정론적 궁합 점수, 공유, 폴링 + 라우터 초기화 |
| `lib/redis.js` | Upstash Redis REST 헬퍼 + IP rate limit (api 두 함수가 공유) |
| `lib/http.js` | 서버리스 공통 HTTP 헬퍼 (CORS·sendJson·readBody·clientIp) |
| `styles.css` | 디자인 |
| `config.js` | 키/주소 설정 (`apiBaseUrl`, 카카오 키, 공유 URL 등) |
| `api/fortune.js` | 운세 생성 — OpenAI 호출 대행 (비밀 키는 서버 환경변수에만) |
| `api/room.js` | 궁합 방 저장 — Upstash Redis에 방/참여자 보관 |

---

## 3. 기능별 데이터 흐름

### (A) 개인 운세
```
입력폼 → script.js가 POST /api/fortune
       → fortune.js가 OpenAI 호출 → 결과 JSON → 화면 렌더
(apiBaseUrl 비면 GPT 대신 로컬 데모 운세)
```

### (B) 궁합 (운세의 한 종류)
```
운세 메뉴에서 '궁합' 선택 → 폼에 '상대방 정보' 칸이 나타남
→ 본인+상대 둘 다 넣어서 POST /api/fortune
```
궁합은 별도 기능이 아니라 **운세 주제(topic=match)의 하나**이며, 입력에 상대방이 추가된 형태다.

### (C) 궁합 방 (바이럴 기능, 별개 흐름)
```
'궁합 방 만들기' → room.js가 방 생성, 6자리 방ID 발급
→ 방 링크(?room=ID)를 카카오톡 공유
→ 친구들이 링크 열고 각자 사주 입력 → room.js가 참여자로 저장
→ 모두가 대시보드에서 'TOP 궁합' / '내 베스트 매치' 확인
```

---

## 4. 핵심 설계 결정

1. **궁합 방 점수는 GPT가 아니라 계산식이다.**
   방에 N명이면 짝이 N×(N-1)/2개. 매번 GPT를 부르면 비싸고 느리다.
   `script.js`의 `chemistry()`가 두 사람의 생일·시간으로 **항상 같은 점수**를 만들어낸다(결정론적).
   → 바이럴 표면(방)이 GPT-free라 비용이 안전하다. 운세 본문만 GPT를 쓴다.

2. **백엔드는 "저장소"일 뿐 똑똑하지 않다.**
   `room.js`는 방/참여자를 Redis에 넣고 빼는 일만 한다.
   궁합 랭킹 계산·화면 렌더는 전부 프론트(`script.js`)가 한다.

3. **전부 Vercel 한 도메인.**
   CORS·`ALLOWED_ORIGIN` 불필요. `apiBaseUrl = "/api"` 상대경로.

---

## 5. 백엔드 인터페이스

### `api/room.js` (Upstash Redis)
- `POST /api/room` `{ "action": "create", "title": "..." }` → 방 생성, `{ id, participants: [] }`
- `POST /api/room` `{ "action": "join", "roomId": "...", "participant": {...} }` → 참여
- `GET  /api/room?id=방ID` → 방 + 참여자 조회
- 방 데이터는 **7일 후 자동 만료**(Redis EXPIRE)
- 저장 형태: 키 `room:{id}` 에 JSON 문자열 `{ id, title, createdAt, participants: [...] }`

### `api/fortune.js` (OpenAI)
- `POST /api/fortune` body에 사주 입력(+궁합이면 partner) → 구조화 JSON 운세 반환
- OpenAI Responses API + strict json_schema 사용

---

## 6. 무엇이 "진짜"고 무엇이 "데모"인가

| 기능 | 무료 한도/데모 | 진짜 동작 조건 |
|---|---|---|
| 운세 생성 | apiBaseUrl 비면 가짜 데모 운세 | `OPENAI_API_KEY` + 배포 |
| 궁합 방 | apiBaseUrl 비면 단일 기기 localStorage 데모 | Upstash 키 + 배포 |
| 카카오 공유 | 키 없으면 '링크 복사'로 대체 | `kakaoJavaScriptKey` + 도메인 등록 |

---

## 7. 비용 설계

### 비용 구조
| 구성요소 | 과금 방식 | 위험도 |
|---|---|---|
| Vercel | 무료 한도 큼 | 낮음 |
| Upstash Redis | 명령 1건당 (무료 50만/월) | **폴링이 갉아먹음** |
| OpenAI | 토큰당 | **바이럴 시 증가 (개인 운세에서만)** |

돈이 새는 곳은 **① Redis 폴링 읽기**와 **② OpenAI 호출**, 둘뿐.
궁합 방 점수는 계산식이라 바이럴 표면은 비용이 안전하다.

### 합의된 최적화 방향: "GPT + 공격적 캐싱"
개인 운세는 GPT로 품질을 유지하되, 캐싱·폴링제어·rate limit으로 비용을 최저로 운용한다.

### 최적화 항목 (✅ 구현 완료)
1. **OpenAI 결과 Redis 캐싱** (`api/fortune.js` `cacheKeyFor`) — 같은 Redis 재활용
   - 캐시 키 = 생일+시간+달력+성별+주제+질문(+오늘운세는 날짜, 궁합은 상대 정보)
   - 호출 전 GET → 있으면 반환, 없으면 호출 후 SET ... EX
   - TTL: 오늘운세=자정(KST)까지, 나머지=24h
2. **방 폴링 비용 절감** (`js/room.js`) — 5초 → 20초 + 탭 보일 때만 + 10분 후 자동 정지(수동 새로고침으로 재가동)
3. **IP당 Rate limit** (`lib/redis.js` `rateLimit`) — Redis INCR 시간당 카운터, 운세·방쓰기 각 60/시간, 초과 시 429
4. **모델/출력 상한** — `gpt-4.1-mini` + `max_output_tokens` 700

공통 헬퍼는 `lib/redis.js`(redis·rateLimit), `lib/http.js`(cors·sendJson·readBody·clientIp)로 분리해 두 함수가 공유.
Redis 미설정 시 캐싱/rate limit은 자동으로 건너뛰고 정상 동작(graceful). 가짜 Redis/OpenAI로 14/14 핸들러 테스트 통과.

목표: 소규모에선 완전 무료(무료 한도 내), 커져도 비용이 완만하게 증가.

---

## 8. 배포 (전부 Vercel)

1. Upstash Redis 생성 → REST `URL`/`TOKEN` 확보
2. (운세 쓰면) OpenAI 키 발급
3. Vercel에 이 repo import (프레임워크 Other, 빌드 없음 — `api/*.js` 자동 인식)
4. 환경변수 등록 (`.env.example` 참고): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `OPENAI_API_KEY`(+선택 `OPENAI_MODEL`)
5. 배포 → `*.vercel.app` 접속
6. (공유) `config.js`에 카카오 JS 키 넣고 카카오 개발자센터에 도메인 등록

로컬에서 백엔드까지: `npx vercel dev`. 정적 화면만: `apiBaseUrl`을 `""`로 비우면 데모 모드.

---

## 9. 현재 상태 / 다음 할 일

- [x] 프론트 MVP (홈/입력/결과/기록)
- [x] 궁합 입력(상대방 정보) 추가
- [x] 궁합 방(생성/참여/대시보드/공유) — 백엔드 포함, 가짜 Redis로 핸들러 테스트 통과
- [x] 전부-Vercel 배포 설정 (`config.js` `/api`, `package.json`, `.env.example`, `.gitignore`)
- [x] UX 리팩토링(높음): 화면 경계/← 홈 버튼, 죽은 버튼 폴백·숨김, 실패 토스트 안내
- [x] IA 정리: 홈은 운세 단일 초점, 궁합 방은 결과 화면 뒤로 (퍼널)
- [x] 해시 라우팅(`#/home`·`#/result`·`#/history`·`#/room/<id>`, 폰 뒤로가기) + `script.js`를 `js/core·fortune·room`으로 분리
- [x] UX 리팩토링(중간): 주제 선택 동기화(`applyTopic`), 궁합 점수 라벨(끌림/대화/안정), 폼 단계화(기본 숨김→탭 시 펼침)
- [x] 너굴맨 캐릭터 적용: 히어로=메인 포즈, 로딩=궁금, 결과=자신만만 (`assets/neogulman*.png`, 시트에서 크롭)
- [x] **비용 최적화 ①~④** (위 7절): OpenAI 캐싱 + 폴링 20초/탭/자동정지 + IP rate limit + 출력 상한, `lib/`로 공통화
- [ ] 미적용 캐릭터 활용(선택): 표정 기본/행복/당황, 소품 부적·운세카드·복주머니·붓
- [ ] 실제 배포 (Upstash/OpenAI/카카오 키 발급 + Vercel)
