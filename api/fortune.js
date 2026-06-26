const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const fortuneSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    topic: {
      type: "string"
    },
    title: {
      type: "string"
    },
    summary: {
      type: "string"
    },
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
    good: {
      type: "array",
      items: { type: "string" }
    },
    caution: {
      type: "array",
      items: { type: "string" }
    },
    actions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["topic", "title", "summary", "scores", "good", "caution", "actions"]
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function buildPrompt(body) {
  return [
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
    `질문: ${body.question || "없음"}`,
    "",
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
  ].join("\n");
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
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
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: buildPrompt(body),
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
    sendJson(response, 200, JSON.parse(text));
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error"
    });
  }
};
