const crypto = require("crypto");
const { redis, redisConfigured, rateLimit } = require("../lib/redis");
const { corsHeaders, sendJson, readBody, clientIp } = require("../lib/http");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const FORTUNE_LIMIT_PER_HOUR = 60; // IP당 시간당 운세 생성 상한
const MAX_OUTPUT_TOKENS = 700;     // 출력 토큰 상한 (비용 캡)

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
  const lines = [
    "너는 한국어 모바일 사주 앱 '너굴 사주'의 운세 작성자다.",
    "전통 명리학을 단정적 예언처럼 말하지 말고, 사용자가 오늘 참고할 수 있는 생활 조언으로 풀어라.",
    "의학, 법률, 투자 확정 조언은 하지 마라.",
    "응답은 반드시 JSON 객체만 출력하라.",
    "",
    `닉네임: ${body.nickname || "너굴 손님"}`,
    `생년월일: ${body.birthDate || "unknown"}`,
    `태어난 시간: ${body.birthTime || "unknown"}`,
    `달력: ${body.calendarType || "solar"}`,
    `성별: ${body.gender || "unspecified"}`,
    `운세 주제: ${body.topic || "today"}`,
    `질문: ${body.question || "없음"}`
  ];

  if (body.topic === "match") {
    const partner = body.partner || {};
    lines.push(
      "",
      "이것은 두 사람의 궁합 요청이다. 본인과 상대방의 사주를 함께 고려해 관계 흐름, 잘 맞는 부분, 주의할 부분을 균형 있게 써라.",
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
    '  "title": "짧은 제목",',
    '  "summary": "2문장 요약",',
    '  "scores": { "love": 0-100, "money": 0-100, "career": 0-100 },',
    '  "good": ["좋은 흐름 2-4개"],',
    '  "caution": ["주의할 점 2-3개"],',
    '  "actions": ["오늘 할 행동 2-3개"]',
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
