// 서버리스 공통 HTTP 헬퍼 (CORS, JSON 응답, 바디 파싱, 클라이언트 IP)

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  if (request.body) {
    return typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf-8");
  return text ? JSON.parse(text) : {};
}

// Vercel은 x-forwarded-for에 클라이언트 IP를 넣어준다.
function clientIp(request) {
  const xff = request.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return request.socket?.remoteAddress || "unknown";
}

module.exports = { corsHeaders, sendJson, readBody, clientIp };
