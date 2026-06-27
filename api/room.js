const crypto = require("crypto");
const { redis, redisConfigured, rateLimit } = require("../lib/redis");
const { corsHeaders, sendJson, readBody, clientIp } = require("../lib/http");

const ROOM_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_PARTICIPANTS = 50;
const WRITE_LIMIT_PER_HOUR = 60; // 방 생성/참여 — IP당 시간당 상한

function roomKey(id) {
  return `room:${id}`;
}

async function readRoom(id) {
  const raw = await redis(["GET", roomKey(id)]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeRoom(room) {
  await redis(["SET", roomKey(room.id), JSON.stringify(room), "EX", String(ROOM_TTL_SECONDS)]);
}

function shortId() {
  return crypto.randomBytes(5).toString("hex").slice(0, 6);
}

function sanitizeParticipant(input) {
  const data = input || {};
  return {
    id: crypto.randomUUID(),
    nickname: String(data.nickname || "익명").trim().slice(0, 16) || "익명",
    birthDate: typeof data.birthDate === "string" ? data.birthDate : "",
    birthTime: typeof data.birthTime === "string" ? data.birthTime : "unknown",
    gender: typeof data.gender === "string" ? data.gender : "unspecified",
    joinedAt: new Date().toISOString()
  };
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (!redisConfigured()) {
    sendJson(response, 500, { error: "Room storage is not configured" });
    return;
  }

  try {
    const url = new URL(request.url, "http://localhost");

    // GET /api/room?id=ROOMID  -> 방 + 참여자 조회 (폴링 경로라 rate limit 미적용)
    if (request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) {
        sendJson(response, 400, { error: "room id is required" });
        return;
      }
      const room = await readRoom(id);
      if (!room) {
        sendJson(response, 404, { error: "room not found" });
        return;
      }
      sendJson(response, 200, room);
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    // 쓰기(생성/참여)에만 IP당 상한 적용
    const limit = await rateLimit(`rl:room:${clientIp(request)}`, WRITE_LIMIT_PER_HOUR, 3600);
    if (!limit.allowed) {
      sendJson(response, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
      return;
    }

    const body = await readBody(request);
    const action = body.action || "create";

    if (action === "create") {
      const room = {
        id: shortId(),
        title: String(body.title || "궁합 방").trim().slice(0, 30) || "궁합 방",
        createdAt: new Date().toISOString(),
        participants: []
      };
      if (body.host) {
        room.participants.push(sanitizeParticipant(body.host));
      }
      await writeRoom(room);
      sendJson(response, 200, room);
      return;
    }

    if (action === "join") {
      const id = body.roomId;
      if (!id) {
        sendJson(response, 400, { error: "roomId is required" });
        return;
      }
      const room = await readRoom(id);
      if (!room) {
        sendJson(response, 404, { error: "room not found" });
        return;
      }
      if (room.participants.length >= MAX_PARTICIPANTS) {
        sendJson(response, 409, { error: "room is full" });
        return;
      }
      const participant = sanitizeParticipant(body.participant);
      if (!participant.birthDate) {
        sendJson(response, 400, { error: "birthDate is required" });
        return;
      }
      room.participants.push(participant);
      await writeRoom(room);
      sendJson(response, 200, { room, participantId: participant.id });
      return;
    }

    sendJson(response, 400, { error: "unknown action" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error"
    });
  }
};
