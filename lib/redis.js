// Upstash Redis REST 헬퍼 — 의존성 없이 fetch만 사용. (api/room.js, api/fortune.js 공유)

function redisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// 단일 명령을 JSON 배열로 POST하고 { result } 를 받는다.
async function redis(command) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Redis command failed: ${res.status}`);
  }
  return data.result;
}

// IP당 시간당 호출 상한 (어뷰즈로 인한 비용 폭주 방지). Redis 없으면 항상 통과.
async function rateLimit(key, limit, windowSec) {
  if (!redisConfigured()) return { allowed: true, count: 0 };
  const count = await redis(["INCR", key]);
  if (count === 1) await redis(["EXPIRE", key, String(windowSec)]);
  return { allowed: count <= limit, count };
}

module.exports = { redis, redisConfigured, rateLimit };
