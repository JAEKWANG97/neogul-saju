# 너굴 사주 모바일 웹

모바일 전용 사주 서비스 홈 화면 시안입니다.

## 파일

- `index.html`: 화면 구조
- `styles.css`: 모바일 UI 스타일
- `script.js`: 운세 메뉴, 입력, 결과, 기록, 카카오 로그인/공유 흐름
- `config.js`: 카카오 로그인 설정
- `api/fortune.js`: Vercel 서버리스 GPT 운세 생성 예시
- `assets/mascot.svg`: 기본 캐릭터 자리 표시 이미지
- `assets/mascot.png`: 실제 너굴 캐릭터 이미지
- `assets/kakao-login-illustration.png`: 카카오 로그인 유도 이미지
- `assets/fortune-result-illustration.png`: 운세 결과 패널 이미지
- `assets/og-image.png`: 카카오톡 공유 미리보기 이미지

## 카카오 로그인 설정

1. 카카오디벨로퍼스에서 앱을 만들고 JavaScript 키를 확인합니다.
2. JavaScript SDK 도메인에 배포 도메인을 등록합니다.
3. 카카오 로그인 활성화 후 Redirect URI를 등록합니다.
4. `config.js`의 `kakaoJavaScriptKey`에 JavaScript 키를 넣습니다.
5. 필요하면 `kakaoRedirectUri`를 등록한 Redirect URI와 동일하게 수정합니다.

현재 정적 프론트는 카카오 인가 코드 요청까지 처리합니다. 실제 회원 가입, 토큰 교환, 세션 발급은 서버에서 구현해야 합니다.

## 카카오톡 공유 미리보기

카카오톡에 URL을 붙였을 때 잘 보이려면 배포된 페이지의 Open Graph 메타 태그가 중요합니다.

- `og:title`: 공유 카드 제목
- `og:description`: 공유 카드 설명
- `og:image`: 공유 카드 이미지
- `og:image:width`, `og:image:height`: 이미지 권장 크기 정보

로컬 상대 경로는 배포 환경에서 절대 URL로 해석되어야 합니다. 실제 도메인이 생기면 `config.js`의 `shareUrl`, `shareImage`를 운영 URL 기준으로 맞추세요.

상단 `공유` 버튼은 카카오 JavaScript 키가 설정되어 있을 때 `Kakao.Share.sendDefault()`로 카카오톡 공유 메시지를 엽니다.

## GitHub Pages와 GPT API

GitHub Pages는 정적 파일만 배포하는 호스팅입니다. `index.html`, `styles.css`, `script.js`, 이미지 파일처럼 브라우저에 그대로 내려가도 되는 프론트엔드에는 적합합니다.

GPT API 키는 GitHub Pages 프론트엔드에 넣으면 안 됩니다. 브라우저에 포함된 키는 개발자 도구, 네트워크 요청, 소스 보기로 노출됩니다.

권장 구조:

- GitHub Pages: 모바일 웹 프론트엔드 배포
- 서버리스 백엔드: OpenAI API 호출 대행
- 프론트엔드: 서버리스 백엔드의 `/api/fortune` 같은 엔드포인트만 호출
- 서버리스 환경변수: `OPENAI_API_KEY` 저장

서버리스 후보:

- Vercel Functions
- Netlify Functions
- Cloudflare Workers
- AWS Lambda

카카오 JavaScript 키는 브라우저에서 쓰는 공개 키라 프론트 설정에 둘 수 있습니다. OpenAI API 키는 비밀 키라 서버 환경변수에만 둬야 합니다.

## 현재 프론트 화면

현재는 하나의 `index.html` 안에서 모바일 앱처럼 화면 상태를 전환합니다.

- 홈: 브랜드, 캐릭터, 운세 메뉴
- 로그인: 카카오 로그인 유도
- 입력: 생년월일, 시간, 운세 주제, 질문 입력
- 생성 중: GPT API 호출 대기 상태
- 결과: 요약, 점수, 좋은 흐름, 주의점, 행동 제안
- 기록: 최근 생성 결과를 브라우저 `localStorage`에 저장

`config.js`의 `apiBaseUrl`이 비어 있으면 로컬 데모 결과를 보여줍니다. 실제 GPT API를 쓰려면 서버리스 배포 후 `apiBaseUrl`을 서버리스 주소로 설정하세요.

```js
window.NEOGUL_SAJU_CONFIG = {
  kakaoJavaScriptKey: "카카오 JavaScript 키",
  kakaoRedirectUri: "https://jaekwang97.github.io/neogul-saju/",
  shareUrl: "https://jaekwang97.github.io/neogul-saju/",
  shareImage: "https://jaekwang97.github.io/neogul-saju/assets/og-image.png",
  apiBaseUrl: "https://너굴사주-api.vercel.app/api"
};
```

## Vercel 서버리스 설정 예시

`api/fortune.js`는 Vercel Functions 기준 예시입니다.

필요한 환경변수:

- `OPENAI_API_KEY`: OpenAI API 키
- `OPENAI_MODEL`: 사용할 모델, 생략하면 `gpt-4.1-mini`
- `ALLOWED_ORIGIN`: 허용할 프론트 도메인, 예: `https://사용자명.github.io`

프론트는 `POST {apiBaseUrl}/fortune`으로 요청하고, 백엔드는 OpenAI Responses API 결과를 아래 형태로 돌려줍니다.

```json
{
  "topic": "오늘운세",
  "title": "짧은 제목",
  "summary": "2문장 요약",
  "scores": { "love": 72, "money": 64, "career": 78 },
  "good": ["좋은 흐름"],
  "caution": ["주의할 점"],
  "actions": ["오늘 할 행동"]
}
```
