/* =========================================================================
 * room.js — 궁합 방: 생성/참여/대시보드, 결정론적 궁합 점수, 공유, 폴링
 * 마지막에 해시 라우터를 초기화한다(모든 파일 로드 이후).
 * ========================================================================= */

const roomPage = document.querySelector("#room-page");
const roomTitleEl = document.querySelector("#room-title");
const roomStatusEl = document.querySelector("#room-status");
const roomJoin = document.querySelector("#room-join");
const roomJoinForm = document.querySelector("#room-join-form");
const roomDashboard = document.querySelector("#room-dashboard");
const roomCountEl = document.querySelector("#room-count");
const roomPairCountEl = document.querySelector("#room-pair-count");
const roomPeopleList = document.querySelector("#room-people-list");
const roomTopList = document.querySelector("#room-top-list");
const roomMineBlock = document.querySelector("#room-mine-block");
const roomMyMatch = document.querySelector("#room-my-match");
const roomLinkInput = document.querySelector("#room-link-input");
const createRoomButtons = document.querySelectorAll(".js-create-room");
const shareRoomButtons = document.querySelectorAll(".js-share-room");
const refreshRoomButtons = document.querySelectorAll(".js-refresh-room");
const copyRoomLinkButtons = document.querySelectorAll(".js-copy-room-link");

let currentRoomId = null;
let roomPollTimer = null;

const genderLabels = { female: "여성", male: "남성", unspecified: "" };
const roomDemoKey = "neogul-demo-rooms";

function setRoomStatus(message) {
  if (roomStatusEl) roomStatusEl.textContent = message || "";
}

function myIdKey(roomId) {
  return `neogul-room-${roomId}`;
}

/* 두 사람 생일/시간으로 항상 같은 점수가 나오는 결정론적 궁합 계산 */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function chemistry(a, b) {
  const pa = `${a.birthDate}@${a.birthTime}`;
  const pb = `${b.birthDate}@${b.birthTime}`;
  const key = [pa, pb].sort().join("|");
  const score = 45 + (hashString(key) % 56); // 45 ~ 100
  let label = "잔잔한 인연";
  if (score >= 90) label = "천생연분";
  else if (score >= 80) label = "찰떡 케미";
  else if (score >= 70) label = "꽤 잘 맞음";
  else if (score >= 60) label = "노력하면 굿";
  return { score, label };
}

function pairCount(total) {
  return total < 2 ? 0 : (total * (total - 1)) / 2;
}

function chemistryComment(score) {
  if (score >= 90) return "처음부터 속도가 잘 맞는 조합이에요.";
  if (score >= 80) return "대화가 붙으면 금방 가까워지는 흐름이에요.";
  if (score >= 70) return "서로 다른 점을 인정하면 안정적으로 맞아요.";
  if (score >= 60) return "조금만 배려하면 편해지는 관계예요.";
  return "속도를 맞추는 연습이 필요한 조합이에요.";
}

// 공유/초대 링크는 해시 라우트(#/room/<id>) 형태로 만든다.
function roomShareUrl(roomId) {
  const base = kakaoConfig.shareUrl || (window.location.origin + window.location.pathname);
  const url = new URL(base, window.location.href);
  url.search = "";
  url.hash = `/room/${roomId}`;
  return url.href;
}

/* 저장소: apiBaseUrl 있으면 백엔드, 없으면 로컬 데모(localStorage) */
const roomApi = {
  isDemo() {
    return !kakaoConfig.apiBaseUrl;
  },
  base() {
    return `${kakaoConfig.apiBaseUrl.replace(/\/$/, "")}/room`;
  },
  demoAll() {
    try {
      return JSON.parse(localStorage.getItem(roomDemoKey) || "{}");
    } catch {
      return {};
    }
  },
  demoSave(map) {
    localStorage.setItem(roomDemoKey, JSON.stringify(map));
  },
  async create(title) {
    if (this.isDemo()) {
      const id = Math.random().toString(36).slice(2, 8);
      const room = { id, title: title || "궁합 방", createdAt: new Date().toISOString(), participants: [] };
      const map = this.demoAll();
      map[id] = room;
      this.demoSave(map);
      return room;
    }
    const res = await fetch(this.base(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", title })
    });
    if (!res.ok) throw new Error("방 생성 실패");
    return res.json();
  },
  async get(id) {
    if (this.isDemo()) {
      const room = this.demoAll()[id];
      if (!room) throw new Error("방을 찾을 수 없음");
      return room;
    }
    const res = await fetch(`${this.base()}?id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("방을 찾을 수 없음");
    return res.json();
  },
  async join(roomId, participant) {
    if (this.isDemo()) {
      const map = this.demoAll();
      const room = map[roomId];
      if (!room) throw new Error("방을 찾을 수 없음");
      const id = crypto.randomUUID?.() || String(Date.now());
      room.participants.push({ id, joinedAt: new Date().toISOString(), ...participant });
      this.demoSave(map);
      return { room, participantId: id };
    }
    const res = await fetch(this.base(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", roomId, participant })
    });
    if (!res.ok) throw new Error("방 참여 실패");
    return res.json();
  }
};

function renderRoom(room) {
  currentRoomId = room.id;
  roomTitleEl.textContent = room.title || "궁합 방";
  roomCountEl.textContent = String(room.participants.length);
  if (roomPairCountEl) roomPairCountEl.textContent = String(pairCount(room.participants.length));
  roomLinkInput.value = roomShareUrl(room.id);

  const myId = localStorage.getItem(myIdKey(room.id));
  const joined = room.participants.some((person) => person.id === myId);

  // 참여자 칩
  roomPeopleList.innerHTML = "";
  room.participants.forEach((person) => {
    const li = document.createElement("li");
    li.className = "people-chip";
    if (person.id === myId) li.classList.add("is-me");
    li.textContent = person.nickname || "익명";
    roomPeopleList.append(li);
  });

  if (!joined) {
    hideElement(roomDashboard);
    showElement(roomJoin);
    setRoomStatus(roomApi.isDemo()
      ? "데모 모드입니다. 실제 단톡방 공유는 카카오 키 설정 후 배포하면 동작합니다."
      : "");
    return;
  }

  // 페어별 궁합 랭킹
  const pairs = [];
  for (let i = 0; i < room.participants.length; i += 1) {
    for (let j = i + 1; j < room.participants.length; j += 1) {
      const a = room.participants[i];
      const b = room.participants[j];
      pairs.push({ a, b, ...chemistry(a, b) });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  roomTopList.innerHTML = "";
  if (!pairs.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = "아직 친구가 더 들어와야 궁합을 볼 수 있어요. 링크를 공유해보세요!";
    roomTopList.append(li);
  } else {
    pairs.slice(0, 5).forEach((pair, index) => {
      const li = document.createElement("li");
      li.className = "match-row";

      const main = document.createElement("span");
      main.className = "match-main";

      const badge = document.createElement("span");
      badge.className = "match-badge";
      badge.textContent = `TOP ${index + 1}`;

      const pairText = document.createElement("span");
      pairText.className = "match-pair";
      pairText.append(document.createTextNode(pair.a.nickname || "익명"));
      const cross = document.createElement("em");
      cross.textContent = "×";
      pairText.append(cross, document.createTextNode(pair.b.nickname || "익명"));

      const comment = document.createElement("small");
      comment.textContent = chemistryComment(pair.score);

      const score = document.createElement("span");
      score.className = "match-score";
      const scoreNumber = document.createElement("strong");
      scoreNumber.textContent = String(pair.score);
      const scoreLabel = document.createElement("small");
      scoreLabel.textContent = pair.label;
      score.append(scoreNumber, scoreLabel);

      main.append(badge, pairText, comment);
      li.append(main, score);
      roomTopList.append(li);
    });
  }

  // 나의 베스트 매치
  const me = room.participants.find((person) => person.id === myId);
  const others = room.participants.filter((person) => person.id !== myId);
  if (me && others.length) {
    showElement(roomMineBlock);
    const best = others
      .map((person) => ({ person, ...chemistry(me, person) }))
      .sort((x, y) => y.score - x.score)[0];
    const genderText = genderLabels[best.person.gender] ? ` · ${genderLabels[best.person.gender]}` : "";
    const name = document.createElement("strong");
    name.textContent = best.person.nickname || "익명";
    const detail = document.createElement("span");
    detail.textContent = `${best.score}점 · ${best.label}${genderText}`;
    const comment = document.createElement("small");
    comment.textContent = chemistryComment(best.score);
    roomMyMatch.replaceChildren(name, detail, comment);
  } else {
    hideElement(roomMineBlock);
  }

  hideElement(roomJoin);
  showElement(roomDashboard);
  setRoomStatus("");
}

// 비용 절감: 20초 간격 + 탭 보일 때만 + 10분 뒤 자동 정지(수동 새로고침으로 재가동)
const ROOM_POLL_INTERVAL = 20000;
const ROOM_POLL_MAX_MS = 10 * 60 * 1000;
let roomPollStartedAt = 0;

function roomVisible() {
  return Boolean(currentRoomId) && !roomPage.classList.contains("is-hidden");
}

async function refreshRoomOnce() {
  if (!currentRoomId) return;
  try {
    renderRoom(await roomApi.get(currentRoomId));
  } catch {
    /* 일시적 오류는 다음 기회에 회복 */
  }
}

function startRoomPolling() {
  stopRoomPolling();
  roomPollStartedAt = Date.now();
  roomPollTimer = setInterval(() => {
    if (!roomVisible() || document.hidden) return; // 화면 밖/숨긴 탭이면 호출 안 함
    if (Date.now() - roomPollStartedAt > ROOM_POLL_MAX_MS) {
      stopRoomPolling(); // 오래 머물면 자동 정지 — 새로고침 누르면 다시 시작
      return;
    }
    refreshRoomOnce();
  }, ROOM_POLL_INTERVAL);
}

function stopRoomPolling() {
  if (roomPollTimer) {
    clearInterval(roomPollTimer);
    roomPollTimer = null;
  }
}

// 숨겼던 탭으로 돌아오면 즉시 한 번 갱신하고 폴링 타이머를 리셋
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !roomVisible()) return;
  roomPollStartedAt = Date.now();
  refreshRoomOnce();
  if (!roomPollTimer) startRoomPolling();
});

// 라우터가 방 화면을 띄운 뒤 호출한다 (화면 전환/스크롤은 라우터 담당).
async function enterRoom(roomId) {
  currentRoomId = roomId;
  roomTitleEl.textContent = "방을 불러오는 중";
  setRoomStatus("");
  hideElement(roomJoin);
  hideElement(roomDashboard);

  try {
    const room = await roomApi.get(roomId);
    renderRoom(room);
    startRoomPolling();
  } catch {
    roomTitleEl.textContent = "방을 찾을 수 없어요";
    setRoomStatus("링크가 만료되었거나 잘못된 방이에요. 새로 방을 만들어 보세요.");
  }
}

async function handleCreateRoom() {
  try {
    const room = await roomApi.create("궁합 방");
    go(`/room/${room.id}`);
  } catch {
    toast("방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}

async function handleRoomJoin(event) {
  event.preventDefault();
  if (!currentRoomId) return;
  const data = new FormData(roomJoinForm);
  const participant = {
    nickname: String(data.get("nickname") || "익명").trim() || "익명",
    birthDate: data.get("birthDate"),
    birthTime: data.get("birthTime"),
    calendarType: data.get("calendarType"),
    gender: data.get("gender")
  };
  setRoomStatus("참여하는 중...");
  try {
    const result = await roomApi.join(currentRoomId, participant);
    localStorage.setItem(myIdKey(currentRoomId), result.participantId);
    renderRoom(result.room);
    startRoomPolling();
  } catch {
    setRoomStatus("참여에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}

function shareRoom() {
  if (!currentRoomId) return;
  const link = roomShareUrl(currentRoomId);

  if (initKakao()) {
    const imageUrl = new URL(kakaoConfig.shareImage || "assets/og-image.png", window.location.href).href;
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "너굴 사주 궁합 방에 초대합니다",
        description: "우리 단톡방 궁합 보러 오세요! 사주를 넣으면 누구랑 제일 잘 맞는지 너굴이가 알려줘요.",
        imageUrl,
        link: { mobileWebUrl: link, webUrl: link }
      },
      buttons: [
        { title: "궁합 방 입장", link: { mobileWebUrl: link, webUrl: link } }
      ]
    });
    return;
  }

  // 카카오 키가 없을 때도 버튼이 죽지 않도록 링크 복사로 대체
  copyRoomLink();
}

async function copyRoomLink() {
  if (!currentRoomId) return;
  const link = roomShareUrl(currentRoomId);
  try {
    await navigator.clipboard.writeText(link);
    setRoomStatus("초대 링크를 복사했어요. 단톡방에 붙여넣어 보세요!");
  } catch {
    roomLinkInput.focus();
    roomLinkInput.select();
    setRoomStatus("아래 링크를 길게 눌러 복사한 뒤 단톡방에 공유해 주세요.");
  }
}

createRoomButtons.forEach((button) => button.addEventListener("click", handleCreateRoom));
shareRoomButtons.forEach((button) => button.addEventListener("click", shareRoom));
refreshRoomButtons.forEach((button) => button.addEventListener("click", async () => {
  if (!currentRoomId) return;
  try {
    renderRoom(await roomApi.get(currentRoomId));
    startRoomPolling(); // 수동 새로고침 시 10분 폴링 창을 다시 연다
  } catch {
    setRoomStatus("새로고침에 실패했어요.");
  }
}));
copyRoomLinkButtons.forEach((button) => button.addEventListener("click", copyRoomLink));
roomJoinForm?.addEventListener("submit", handleRoomJoin);

/* ----------------------------- 라우터 초기화 ----------------------------- */

// 예전 형식(?room=ID)으로 들어오면 해시 라우트로 변환
const legacyRoom = new URLSearchParams(window.location.search).get("room");
if (legacyRoom) {
  window.history.replaceState(null, "", `${window.location.pathname}#/room/${legacyRoom}`);
}

window.addEventListener("hashchange", router);
router();
