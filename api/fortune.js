const crypto = require("crypto");
const { redis, redisConfigured, rateLimit } = require("../lib/redis");
const { corsHeaders, sendJson, readBody, clientIp } = require("../lib/http");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const FORTUNE_LIMIT_PER_HOUR = 60; // IP당 시간당 운세 생성 상한
const MAX_OUTPUT_TOKENS = 1000;    // 출력 토큰 상한 (비용 캡)
const PROMPT_VERSION = "saju-depth-v2";

const fortuneSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    topic: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        love: { type: "number" },
        money: { type: "number" },
        career: { type: "number" }
      },
      required: ["love", "money", "career"]
    },
    good: { type: "array", items: { type: "string" } },
    caution: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } }
  },
  required: ["topic", "title", "summary", "scores", "good", "caution", "actions"]
};

/* ----------------------------- 캐시 키/TTL ----------------------------- */

function todayKST() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10); // KST 기준 YYYY-MM-DD
}

function secondsUntilKstMidnight() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const secondsToday = kst.getUTCHours() * 3600 + kst.getUTCMinutes() * 60 + kst.getUTCSeconds();
  return Math.max(60, 86400 - secondsToday);
}

// 같은 입력 → 같은 캐시 키. 오늘운세는 날짜까지 포함해 자정에 자연 갱신.
function cacheKeyFor(body) {
  const parts = [
    PROMPT_VERSION,
    body.topic || "today",
    body.birthDate || "",
    body.birthTime || "",
    body.calendarType || "",
    body.gender || "",
    (body.question || "").trim()
  ];
  if (body.topic === "match" && body.partner) {
    const p = body.partner;
    parts.push(p.birthDate || "", p.birthTime || "", p.calendarType || "", p.gender || "");
  }
  if (body.topic === "today") parts.push(todayKST());
  const hash = crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 24);
  return `fortune:${hash}`;
}

function cacheTtl(body) {
  return body.topic === "today" ? secondsUntilKstMidnight() : 86400;
}

function buildPrompt(body) {
  const topic = body.topic || "today";
  const topicGuide = {
    today: [
      "오늘운세는 하루의 리듬, 사람을 대하는 태도, 결정의 속도, 정리해야 할 일을 중심으로 쓴다.",
      "거창한 사건 예언보다 오늘 실제로 쓸 수 있는 선택 기준을 제시한다."
    ],
    love: [
      "애정운은 끌림, 표현 방식, 거리 조절, 상대의 반응을 읽는 법을 중심으로 쓴다.",
      "연애 여부를 단정하지 말고 솔로/관계 중 모두에게 자연스럽게 읽히게 쓴다."
    ],
    money: [
      "재물운은 수입 기회, 지출 습관, 계약/구매 판단, 돈이 새는 패턴을 중심으로 쓴다.",
      "투자 종목, 수익 확정, 매수/매도 같은 직접 금융 조언은 절대 하지 않는다."
    ],
    career: [
      "직장운은 업무 속도, 협업, 평가받는 포인트, 말과 문서의 쓰임을 중심으로 쓴다.",
      "이직/퇴사 같은 큰 결정을 단정하지 말고 판단 기준과 준비 방향으로 풀어낸다."
    ],
    match: [
      "궁합은 끌림, 대화의 결, 안정감, 충돌 지점, 오래 가려면 필요한 태도를 중심으로 쓴다.",
      "좋다/나쁘다로 단순 판정하지 말고 서로의 기운이 어떻게 보완되거나 부딪히는지 설명한다."
    ],
    year: [
      "신년운세는 한 해의 큰 흐름, 상반기/하반기 리듬, 관계/돈/일에서 쌓아야 할 기반을 중심으로 쓴다.",
      "월별 세부 예언보다 올해의 태도와 반복해서 관리할 포인트를 제시한다."
    ]
  };

  const lines = [
    "너는 한국어 모바일 사주 서비스 '너굴 사주'의 숙련된 명리 해석가다.",
    "사용자의 생년월일, 태어난 시간, 양/음력, 성별, 질문을 바탕으로 사주적 흐름을 깊이 있게 풀어낸다.",
    "문체는 고급스럽고 차분해야 한다. 가볍게 웃기거나 과하게 신비화하지 말고, 오래 읽히는 해석문처럼 쓴다.",
    "",
    "해석 원칙:",
    "- 오행, 음양, 계절감, 기운의 강약, 관계의 상생/상극이라는 관점을 활용한다.",
    "- 정확한 사주 원국 계산 결과가 별도로 제공되지 않았으므로 특정 일주, 월주, 십성, 대운을 단정하지 않는다.",
    "- 대신 입력된 생년월일과 시간대에서 읽을 수 있는 리듬, 기질, 흐름의 방향을 사주 언어로 자연스럽게 설명한다.",
    "- '반드시', '무조건', '큰일 난다' 같은 공포 조장이나 확정 예언을 피한다.",
    "- 의학, 법률, 투자 확정 조언은 하지 않는다.",
    "- AI, 모델, 프롬프트, 생성 같은 표현은 절대 쓰지 않는다.",
    "- 사용자가 모바일에서 읽으므로 문장은 짧고 밀도 있게 쓴다.",
    "",
    "결과 작성 규칙:",
    "- title은 사주 해석처럼 품격 있게, 20자 안팎으로 쓴다.",
    "- summary는 3문장으로 쓴다. 첫 문장은 전체 기운, 둘째 문장은 그 기운이 현실에서 드러나는 방식, 셋째 문장은 오늘/올해/관계에서 잡아야 할 태도다.",
    "- scores는 서로 너무 비슷하게 주지 말고, 해석과 자연스럽게 맞춘다.",
    "- good은 좋은 흐름을 3개로 쓰되 각각 다른 관점이어야 한다.",
    "- caution은 주의할 점을 2-3개로 쓰되 겁주는 표현보다 조절 포인트로 쓴다.",
    "- actions는 당장 실행 가능한 행동 3개로 쓴다.",
    "- 각 배열 항목은 한 문장으로 끝내고, 지나치게 길게 쓰지 않는다.",
    "- 응답은 반드시 JSON 객체만 출력한다.",
    "",
    `닉네임: ${body.nickname || "너굴 손님"}`,
    `생년월일: ${body.birthDate || "unknown"}`,
    `태어난 시간: ${body.birthTime || "unknown"}`,
    `달력: ${body.calendarType || "solar"}`,
    `성별: ${body.gender || "unspecified"}`,
    `운세 주제: ${topic}`,
    `질문: ${body.question || "없음"}`,
    "",
    "주제별 해석 관점:",
    ...(topicGuide[topic] || topicGuide.today)
  ];

  if (topic === "match") {
    const partner = body.partner || {};
    lines.push(
      "",
      "궁합 추가 원칙:",
      "- 두 사람을 승패처럼 비교하지 말고, 기운의 맞물림과 생활 리듬의 차이를 읽는다.",
      "- summary에는 두 사람의 끌림, 대화 방식, 안정감 또는 충돌 지점을 모두 담는다.",
      "- scores는 love=끌림, money=대화, career=안정의 의미로 작성한다.",
      "- good에는 서로에게 도움이 되는 지점을 쓴다.",
      "- caution에는 반복되면 관계를 피곤하게 만드는 패턴을 쓴다.",
      "- actions에는 둘 사이에서 실제로 해볼 수 있는 대화/약속/거리 조절 행동을 쓴다.",
      `상대 호칭: ${partner.name || "상대방"}`,
      `상대 생년월일: ${partner.birthDate || "unknown"}`,
      `상대 태어난 시간: ${partner.birthTime || "unknown"}`,
      `상대 달력: ${partner.calendarType || "solar"}`,
      `상대 성별: ${partner.gender || "unspecified"}`
    );
  }

  lines.push("");
  return lines.concat([
    "JSON 스키마:",
    "{",
    '  "topic": "오늘운세|애정운|재물운|직장운|궁합|신년운세",',
    '  "title": "품격 있는 짧은 제목",',
    '  "summary": "3문장 깊이 있는 요약",',
    '  "scores": { "love": 0-100, "money": 0-100, "career": 0-100 },',
    '  "good": ["좋은 흐름 3개"],',
    '  "caution": ["주의할 점 2-3개"],',
    '  "actions": ["실행할 행동 3개"]',
    "}"
  ]).join("\n");
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured" });
    return;
  }

  try {
    const body = await readBody(request);

    // ③ IP당 상한 + ① 캐시 조회 (Redis 있을 때만)
    let cacheKey = null;
    if (redisConfigured()) {
      const limit = await rateLimit(`rl:fortune:${clientIp(request)}`, FORTUNE_LIMIT_PER_HOUR, 3600);
      if (!limit.allowed) {
        sendJson(response, 429, { error: "오늘 운세를 너무 많이 봤어요. 잠시 후 다시 시도해 주세요." });
        return;
      }
      cacheKey = cacheKeyFor(body);
      try {
        const cached = await redis(["GET", cacheKey]);
        if (cached) {
          sendJson(response, 200, JSON.parse(cached));
          return;
        }
      } catch {
        /* 캐시 조회 실패는 무시하고 실제 호출로 진행 */
      }
    }

    const upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: buildPrompt(body),
        max_output_tokens: MAX_OUTPUT_TOKENS, // ④ 출력 토큰 상한
        text: {
          format: {
            type: "json_schema",
            name: "fortune_result",
            strict: true,
            schema: fortuneSchema
          }
        }
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      sendJson(response, upstream.status, {
        error: data.error?.message || "OpenAI request failed"
      });
      return;
    }

    const text = data.output_text || data.output?.[0]?.content?.[0]?.text || "{}";
    const result = JSON.parse(text);

    // ① 결과 캐시 저장 (best-effort)
    if (cacheKey) {
      try {
        await redis(["SET", cacheKey, JSON.stringify(result), "EX", String(cacheTtl(body))]);
      } catch {
        /* 캐시 저장 실패는 응답에 영향 없음 */
      }
    }

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error"
    });
  }
};
