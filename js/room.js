/* =========================================================================
 * room.js — 궁합 방: 만들기/참여/대시보드, 결정론적 궁합 점수, 공유, 폴링
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
const roomUnlockPanel = document.querySelector("#room-unlock-panel");
const roomInviteTitle = document.querySelector("#room-invite-title");
const roomInviteText = document.querySelector("#room-invite-text");
const roomMyCharacter = document.querySelector("#room-my-character");
const roomTopBlock = document.querySelector("#room-top-block");
const roomTopList = document.querySelector("#room-top-list");
const roomSurpriseBlock = document.querySelector("#room-surprise-block");
const roomSurpriseMatch = document.querySelector("#room-surprise-match");
const roomVibeBlock = document.querySelector("#room-vibe-block");
const roomVibe = document.querySelector("#room-vibe");
const roomTargetBlock = document.querySelector("#room-target-block");
const roomTarget = document.querySelector("#room-target");
const roomMineBlock = document.querySelector("#room-mine-block");
const roomMyMatch = document.querySelector("#room-my-match");
const roomFrictionBlock = document.querySelector("#room-friction-block");
const roomFrictionMatch = document.querySelector("#room-friction-match");
const roomReadReceiptBlock = document.querySelector("#room-read-receipt-block");
const roomReadReceipt = document.querySelector("#room-read-receipt");
const roomLinkFallback = document.querySelector("#room-link-fallback");
const roomLinkInput = document.querySelector("#room-link-input");
const createRoomButtons = document.querySelectorAll(".js-create-room");
const shareRoomButtons = document.querySelectorAll(".js-share-room");
const nativeShareRoomButtons = document.querySelectorAll(".js-native-share-room");
const refreshRoomButtons = document.querySelectorAll(".js-refresh-room");
const copyRoomLinkButtons = document.querySelectorAll(".js-copy-room-link");

let currentRoomId = null;
let currentRoomSnapshot = null;
let roomPollTimer = null;
let roomCreatePending = false;
let roomJoinPending = false;

const genderLabels = { female: "여성", male: "남성", unspecified: "" };
const roomDemoKey = "neogul-demo-rooms";

function setRoomStatus(message) {
  if (roomStatusEl) roomStatusEl.textContent = message || "";
}

function setButtonGroupPending(buttons, pending, pendingText) {
  buttons.forEach((button) => {
    if (!button.dataset.idleText) button.dataset.idleText = button.textContent;
    button.disabled = pending;
    button.textContent = pending ? pendingText : button.dataset.idleText;
  });
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
  return { score, label, relationName: relationNameFor(score, key), key };
}

function pairCount(total) {
  return total < 2 ? 0 : (total * (total - 1)) / 2;
}

function chemistryComment(score) {
  if (score >= 90) return "처음부터 속도가 잘 맞는 조합이에요. 약속을 잡거나 카톡 흐름을 이어갈 때 한쪽이 크게 애쓰지 않아도 자연스럽게 맞춰집니다.";
  if (score >= 80) return "대화가 붙으면 금방 가까워지는 흐름이에요. 처음엔 가볍게 시작해도 서로의 반응을 보며 장난과 진심을 잘 섞을 수 있습니다.";
  if (score >= 70) return "서로 다른 점을 인정하면 안정적으로 맞아요. 말투나 답장 속도는 달라도 역할을 나누면 오래 편해지는 조합입니다.";
  if (score >= 60) return "조금만 배려하면 편해지는 관계예요. 한 박자만 기다려주면 상대의 방식이 단점보다 리듬으로 보이기 시작합니다.";
  return "속도를 맞추는 연습이 필요한 조합이에요. 바로 결론 내리기보다 짧게 확인하는 말을 더하면 분위기가 훨씬 부드러워집니다.";
}

const personaLabels = [
  ["읽고 있다가 결정적일 때 등장형", "말이 많아서가 아니라, 흐름이 흩어질 때 기준을 잡는 쪽이에요."],
  ["답장은 느리지만 약속은 지키는 안정형", "속도는 느긋해도 한 번 정한 약속은 오래 붙잡는 편이에요."],
  ["분위기 먼저 올리고 나중에 정리하는 형", "농담으로 문을 열고, 뒤늦게 현실적인 정리를 붙이는 쪽이에요."],
  ["돈 얘기 나오면 현실 감각 켜지는 형", "비용, 시간, 역할이 섞이면 갑자기 계산기가 켜지는 편이에요."],
  ["말보다 표정이 먼저 들키는 솔직형", "숨기려 해도 반응이 먼저 보여서 방 분위기를 빨리 움직여요."],
  ["계획은 느슨해도 마감은 지키는 뒷심형", "처음엔 편하게 가도 마지막에는 필요한 걸 챙기는 쪽이에요."],
  ["사람 사이 온도를 맞추는 중재형", "말이 뜨거워질 때 한 번 식혀주고, 조용해질 때 다시 붙여줘요."],
  ["갑자기 추진 버튼이 눌리는 직진형", "가만히 보다가도 어느 순간 먼저 움직여 판을 여는 편이에요."]
];

function personaProfile(person) {
  const key = `${person.birthDate || ""}@${person.birthTime || "unknown"}@${person.gender || "unspecified"}`;
  const [label, description] = personaLabels[hashString(key) % personaLabels.length];
  return { label, description };
}

function personaLabel(person) {
  return personaProfile(person).label;
}

function relationNameFor(score, key) {
  const high = [
    "말 안 해도 리듬이 붙는 조합",
    "서로의 빈칸을 자연스럽게 채우는 조합",
    "만나면 속도가 맞춰지는 찰떡 조합"
  ];
  const mid = [
    "속도는 다르지만 오래 가는 조합",
    "답장은 늦어도 이상하게 편한 조합",
    "회의실에서는 속도 조절, 놀 때는 찰떡인 조합"
  ];
  const low = [
    "조심하면 더 좋아지는 조합",
    "타이밍만 맞추면 풀리는 조합",
    "말투를 다듬으면 가까워지는 조합"
  ];
  const pool = score >= 82 ? high : score >= 65 ? mid : low;
  return pool[hashString(key) % pool.length];
}

function roomInviteCopy(count, me) {
  const label = me ? personaLabel(me) : "";
  const newPairs = count > 0 ? count : 1;
  if (count <= 1) {
    return {
      title: "친구가 들어와야 궁합판이 완성돼요",
      text: label ? `나는 ${label}. 너 들어오면 내 베스트가 바로 바뀔 수도 있어요.` : "로그인 없이 닉네임과 생년월일만 넣으면 참여할 수 있어요.",
      shareTitle: "우리 단톡방 궁합판 열림",
      shareDescription: label
        ? `나는 ${label} 나왔어. 너 들어오면 내 베스트 바뀔 수도 있음.`
        : "닉네임이랑 생년월일만 넣으면 나랑 몇 점인지 바로 나와요."
    };
  }
  if (count < 3) {
    return {
      title: "1명만 더 들어오면 TOP3가 열려요",
      text: "지금은 나와 제일 잘 맞는 사람까지 공개됐어요. 너 들어오면 단톡방 순위가 바로 흔들릴 수 있어요.",
      shareTitle: "1명만 더 들어오면 TOP 궁합 공개",
      shareDescription: "지금 2명 참여함. 너 들어오면 순위 뒤집힐 수도 있음."
    };
  }
  if (count < 5) {
    return {
      title: `${5 - count}명 더 들어오면 의외의 케미가 열려요`,
      text: "TOP3는 열렸고, 친구가 더 들어오면 예상 밖으로 잘 맞는 조합까지 보여줘요.",
      shareTitle: "우리 방 TOP 궁합 나옴",
      shareDescription: `${count}명 참여 중. 너 들어오면 의외의 케미까지 열릴 수 있어.`
    };
  }
  if (count < 7) {
    return {
      title: `${7 - count}명 더 들어오면 오늘의 단톡방 운세가 열려요`,
      text: "의외의 케미까지 열렸어요. 조금만 더 모이면 이 방 전체 분위기도 읽어줍니다.",
      shareTitle: "우리 단톡방 의외의 케미 열림",
      shareDescription: `${count}명 참여 중. 이제 단톡방 운세만 남았어.`
    };
  }
  return {
    title: "새 친구가 들어오면 순위가 또 흔들려요",
    text: `지금도 다 열렸지만, 한 명이 더 들어오면 궁합 조합이 ${newPairs}개 더 생겨요.`,
    shareTitle: "우리 단톡방 궁합판 열림",
    shareDescription: `지금 ${count}명 참여 중. 너 들어오면 궁합 조합 ${newPairs}개가 새로 열림.`
  };
}

function renderUnlockPanel(count) {
  if (!roomUnlockPanel) return;
  const milestones = [
    [1, "궁합판 준비"],
    [2, "내 베스트 공개"],
    [3, "TOP3 공개"],
    [5, "의외의 케미"],
    [7, "단톡방 운세"]
  ];
  const next = milestones.find(([needed]) => count < needed);
  const progress = Math.min(100, Math.round((Math.min(count, 7) / 7) * 100));
  const nextTitle = next
    ? `${next[0] - count}명 더 들어오면 ${next[1]} 공개`
    : "모든 보상이 열렸어요";
  const nextText = next
    ? "초대 한 번이면 다음 결과가 열릴 수 있어요."
    : `새 친구 1명마다 궁합 조합이 ${Math.max(1, count)}개씩 더 생겨요.`;

  roomUnlockPanel.innerHTML = "";
  const copy = document.createElement("div");
  copy.className = "unlock-copy";
  copy.innerHTML = `<p class="panel-kicker">현재 해금</p><strong>${nextTitle}</strong><span>${nextText}</span>`;

  const meter = document.createElement("div");
  meter.className = "unlock-meter";
  const bar = document.createElement("span");
  bar.style.width = `${progress}%`;
  meter.append(bar);

  const list = document.createElement("ol");
  list.className = "unlock-dots";
  milestones.forEach(([needed, label]) => {
    const item = document.createElement("li");
    item.className = count >= needed ? "unlock-step is-open" : "unlock-step";
    item.innerHTML = `<b>${needed}</b><span>${label}</span>`;
    list.append(item);
  });

  roomUnlockPanel.append(copy, meter, list);
}

function roomVibeText(room, pairs) {
  const count = room.participants.length;
  const best = pairs[0];
  if (!best) return "아직은 친구가 더 들어와야 이 방의 분위기를 읽을 수 있어요.";
  const labels = room.participants.map((person) => personaLabel(person));
  const hasDrive = labels.some((label) => label.includes("직진") || label.includes("불기운"));
  const hasBalance = labels.some((label) => label.includes("균형") || label.includes("중재"));
  if (count >= 7 && hasDrive && hasBalance) return "이 방은 먼저 치고 나가는 사람과 정리해주는 사람이 같이 있어야 잘 굴러가는 흐름이에요.";
  if (count >= 7 && best.score >= 85) return "오늘 이 방은 말이 붙으면 금방 분위기가 올라옵니다. 단, 약속 시간과 비용 얘기는 먼저 정리하는 게 좋아요.";
  return "오늘 이 방은 농담으로 시작해도 결국 현실적인 얘기로 돌아오는 흐름이에요. 답장 속도보다 말의 타이밍을 보세요.";
}

function readReceiptScore(a, b) {
  const key = `${a.birthDate}@${a.birthTime}|${b.birthDate}@${b.birthTime}|read`;
  return 50 + (hashString(key) % 51);
}

function readReceiptText(score) {
  if (score >= 85) return "답장은 늦어도 관계 온도는 쉽게 식지 않는 조합이에요.";
  if (score >= 70) return "조금 늦게 읽어도 서로의 리듬을 기다려줄 수 있어요.";
  if (score >= 58) return "답장이 늦으면 한 번 확인은 필요하지만, 금방 풀릴 수 있어요.";
  return "읽고 바로 말하지 않으면 오해가 생길 수 있어요. 짧은 확인 한마디가 좋습니다.";
}

function buildMyPairs(me, others) {
  return others
    .map((person) => {
      const chemistryResult = chemistry(me, person);
      const readScore = readReceiptScore(me, person);
      return { person, readScore, ...chemistryResult };
    })
    .sort((a, b) => b.score - a.score);
}

function renderPersonMatch(target, pair, emptyText, mode = "best") {
  target.innerHTML = "";
  if (!pair) {
    const empty = document.createElement("span");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    target.append(empty);
    return;
  }
  const name = document.createElement("strong");
  name.textContent = pair.person.nickname || "익명";
  const detail = document.createElement("span");
  if (mode === "read") {
    detail.textContent = `${pair.readScore}점 · ${readReceiptText(pair.readScore)}`;
  } else {
    detail.textContent = `${pair.score}점 · ${pair.relationName}`;
  }
  const comment = document.createElement("small");
  if (mode === "friction") {
    comment.textContent = `${personaLabel(pair.person)} · 말보다 타이밍을 맞추면 더 편해지는 조합이에요. 서로 먼저 움직이는 순간이 달라서, 약속과 답장은 한 번 더 확인하면 좋습니다.`;
  } else if (mode === "read") {
    comment.textContent = `${pair.person.nickname || "이 친구"}님과는 답장 속도보다 확인하는 말투가 더 중요해요. 늦게 읽어도 짧은 한마디만 남기면 관계 온도가 쉽게 식지 않습니다.`;
  } else {
    comment.textContent = `${personaLabel(pair.person)} · ${chemistryComment(pair.score)}`;
  }
  target.append(name, detail, comment);
}

function roomTargetPick(room) {
  if (!room.participants.length) return null;
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const index = hashString(`${room.id}|${today}|target`) % room.participants.length;
  const person = room.participants[index];
  const missions = [
    "오늘 먼저 약속 시간 정리하면 빛나는 사람",
    "오늘 커피 얘기 꺼내면 분위기 풀리는 사람",
    "오늘 조용히 정리 한마디 해주면 고마운 사람",
    "오늘 메뉴 후보 세 개만 던지면 방이 빨라지는 사람",
    "오늘 늦은 답장도 부드럽게 받아줄 수 있는 사람"
  ];
  return {
    person,
    mission: missions[hashString(`${person.birthDate}|${today}`) % missions.length]
  };
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
  async create(title, initialParticipant) {
    if (this.isDemo()) {
      const id = Math.random().toString(36).slice(2, 8);
      const room = { id, title: title || "궁합 방", createdAt: new Date().toISOString(), participants: [] };
      if (initialParticipant) {
        room.participants.push({ id: crypto.randomUUID?.() || String(Date.now()), joinedAt: new Date().toISOString(), ...initialParticipant });
      }
      const map = this.demoAll();
      map[id] = room;
      this.demoSave(map);
      return room;
    }
    const res = await fetch(this.base(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", title, participant: initialParticipant })
    });
    if (!res.ok) throw new Error("방 만들기 실패");
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
  currentRoomSnapshot = room;
  roomTitleEl.textContent = room.title || "궁합 방";
  roomCountEl.textContent = String(room.participants.length);
  if (roomPairCountEl) roomPairCountEl.textContent = String(pairCount(room.participants.length));
  roomLinkInput.value = roomShareUrl(room.id);

  const myId = localStorage.getItem(myIdKey(room.id));
  const joined = room.participants.some((person) => person.id === myId);
  const me = room.participants.find((person) => person.id === myId);
  const inviteCopy = roomInviteCopy(room.participants.length, me);
  if (roomInviteTitle) roomInviteTitle.textContent = inviteCopy.title;
  if (roomInviteText) roomInviteText.textContent = inviteCopy.text;
  renderUnlockPanel(room.participants.length);

  // 참여자 칩
  roomPeopleList.innerHTML = "";
  room.participants.forEach((person) => {
    const li = document.createElement("li");
    li.className = "people-chip";
    if (person.id === myId) li.classList.add("is-me");
    const name = document.createElement("strong");
    name.textContent = person.nickname || "익명";
    const label = document.createElement("small");
    label.textContent = personaLabel(person);
    li.append(name, label);
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

  if (me) {
    const profile = personaProfile(me);
    roomMyCharacter.innerHTML = `<p class="panel-kicker">내 단톡방 캐릭터</p><strong>나는 ${profile.label}</strong><span>${profile.description}</span>`;
  } else {
    roomMyCharacter.innerHTML = "";
  }

  const others = me ? room.participants.filter((person) => person.id !== myId) : [];
  const myPairs = me ? buildMyPairs(me, others) : [];
  const best = myPairs[0];
  const friction = myPairs.length
    ? [...myPairs].sort((a, b) => Math.abs(62 - a.score) - Math.abs(62 - b.score))[0]
    : null;
  const readBest = myPairs.length
    ? [...myPairs].sort((a, b) => b.readScore - a.readScore)[0]
    : null;

  showElement(roomMineBlock);
  showElement(roomFrictionBlock);
  showElement(roomReadReceiptBlock);
  renderPersonMatch(roomMyMatch, best, "아직 친구가 더 들어와야 내 베스트 궁합을 볼 수 있어요.");
  renderPersonMatch(roomFrictionMatch, friction, "아직 친구가 더 들어와야 의외로 삐걱대는 조합을 볼 수 있어요.", "friction");
  renderPersonMatch(roomReadReceipt, readBest, "아직 친구가 더 들어와야 읽씹 내성 궁합을 볼 수 있어요.", "read");

  roomTopList.innerHTML = "";
  if (room.participants.length < 3) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = room.participants.length < 2
      ? "아직 친구가 더 들어와야 궁합을 볼 수 있어요. 링크를 공유해보세요!"
      : "나와 제일 잘 맞는 사람은 열렸어요. 한 명 더 들어오면 단톡방 TOP3가 공개됩니다.";
    roomTopList.append(li);
  } else {
    pairs.slice(0, 3).forEach((pair, index) => {
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
      comment.textContent = pair.relationName;

      const subComment = document.createElement("small");
      subComment.textContent = chemistryComment(pair.score);

      const score = document.createElement("span");
      score.className = "match-score";
      const scoreNumber = document.createElement("strong");
      scoreNumber.textContent = String(pair.score);
      const scoreLabel = document.createElement("small");
      scoreLabel.textContent = pair.label;
      score.append(scoreNumber, scoreLabel);

      main.append(badge, pairText, comment, subComment);
      li.append(main, score);
      roomTopList.append(li);
    });
  }

  if (room.participants.length >= 5 && pairs.length) {
    showElement(roomSurpriseBlock);
    roomSurpriseBlock.open = room.participants.length < 7;
    const surprise = pairs
      .filter((pair) => pair.score >= 60 && pair.score < 82)
      .sort((a, b) => Math.abs(72 - a.score) - Math.abs(72 - b.score))[0] || pairs[Math.min(1, pairs.length - 1)];
    roomSurpriseMatch.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = surprise.relationName;
    const detail = document.createElement("span");
    detail.textContent = `${surprise.a.nickname || "익명"} × ${surprise.b.nickname || "익명"} · ${surprise.score}점`;
    const comment = document.createElement("small");
    comment.textContent = "점수보다 말이 생기는 조합이에요. 서로 다른 리듬을 맞추면 꽤 편해집니다.";
    roomSurpriseMatch.append(title, detail, comment);
  } else {
    showElement(roomSurpriseBlock);
    roomSurpriseBlock.open = false;
    roomSurpriseMatch.innerHTML = `<span class="empty-state">${Math.max(0, 5 - room.participants.length)}명 더 들어오면 의외의 케미가 열려요.</span>`;
  }

  if (room.participants.length >= 7) {
    showElement(roomVibeBlock);
    roomVibeBlock.open = false;
    roomVibe.textContent = roomVibeText(room, pairs);
  } else {
    showElement(roomVibeBlock);
    roomVibeBlock.open = false;
    roomVibe.textContent = `${Math.max(0, 7 - room.participants.length)}명 더 들어오면 오늘의 단톡방 운세가 열려요.`;
  }

  showElement(roomTargetBlock);
  roomTargetBlock.open = false;
  roomTarget.innerHTML = "";
  if (room.participants.length >= 3) {
    const target = roomTargetPick(room);
    const name = document.createElement("strong");
    name.textContent = target.person.nickname || "익명";
    const mission = document.createElement("span");
    mission.textContent = target.mission;
    const comment = document.createElement("small");
    comment.textContent = `${personaLabel(target.person)} · 지목이 아니라 오늘 방을 부드럽게 굴리는 역할이에요.`;
    roomTarget.append(name, mission, comment);
  } else {
    roomTarget.innerHTML = `<span class="empty-state">${Math.max(0, 3 - room.participants.length)}명 더 들어오면 오늘의 단톡방 타겟이 열려요.</span>`;
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
  if (roomCreatePending) return;
  roomCreatePending = true;
  setButtonGroupPending(createRoomButtons, true, "방 만드는 중");
  try {
    const initialParticipant = latestResult?.request ? {
      nickname: latestResult.request.nickname || "익명",
      birthDate: latestResult.request.birthDate,
      birthTime: latestResult.request.birthTime,
      calendarType: latestResult.request.calendarType,
      gender: latestResult.request.gender
    } : null;
    const room = await roomApi.create("궁합 방", initialParticipant);
    if (initialParticipant && room.participants?.[0]?.id) {
      localStorage.setItem(myIdKey(room.id), room.participants[0].id);
    }
    go(`/room/${room.id}`);
  } catch {
    toast("방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    roomCreatePending = false;
    setButtonGroupPending(createRoomButtons, false, "방 만드는 중");
  }
}

async function handleRoomJoin(event) {
  event.preventDefault();
  if (!currentRoomId) return;
  if (roomJoinPending) return;
  roomJoinPending = true;
  const submitButton = roomJoinForm?.querySelector('button[type="submit"]');
  if (submitButton) {
    if (!submitButton.dataset.idleText) submitButton.dataset.idleText = submitButton.textContent;
    submitButton.textContent = "참여하는 중";
    submitButton.disabled = true;
  }
  const data = new FormData(roomJoinForm);
  const participant = {
    nickname: String(data.get("nickname") || "익명").trim() || "익명",
    birthDate: birthDateFromData(data, "birth"),
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
  } finally {
    roomJoinPending = false;
    if (submitButton) {
      submitButton.textContent = submitButton.dataset.idleText || "내 궁합 확인하고 참여하기";
      submitButton.disabled = false;
    }
  }
}

function shareRoom() {
  if (!currentRoomId) return;
  const link = roomShareUrl(currentRoomId);
  const count = Number(roomCountEl?.textContent || 0);
  const myId = localStorage.getItem(myIdKey(currentRoomId));
  const me = currentRoomSnapshot?.participants?.find((person) => person.id === myId) || null;
  const copy = roomInviteCopy(count, me);

  if (initKakao()) {
    const imageUrl = new URL(kakaoConfig.shareImage || "assets/og-image.png", window.location.href).href;
    try {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: copy.shareTitle,
          description: `${copy.shareDescription} 로그인 없이 닉네임과 생년월일만 넣으면 돼요.`,
          imageUrl,
          link: { mobileWebUrl: link, webUrl: link }
        },
        buttons: [
          { title: "궁합 순위 보러가기", link: { mobileWebUrl: link, webUrl: link } }
        ]
      });
    } catch {
      copyRoomLink();
    }
    return;
  }

  // 카카오 키가 없을 때도 버튼이 죽지 않도록 링크 복사로 대체
  copyRoomLink();
}

async function nativeShareRoom() {
  if (!currentRoomId) return;
  const link = roomShareUrl(currentRoomId);
  const count = Number(roomCountEl?.textContent || 0);
  const myId = localStorage.getItem(myIdKey(currentRoomId));
  const me = currentRoomSnapshot?.participants?.find((person) => person.id === myId) || null;
  const copy = roomInviteCopy(count, me);

  if (navigator.share) {
    try {
      await navigator.share({
        title: copy.shareTitle,
        text: copy.shareDescription,
        url: link
      });
      setRoomStatus("공유 창을 열었어요.");
      return;
    } catch {
      /* 사용자가 공유 창을 닫으면 링크 복사로 대체 */
    }
  }

  copyRoomLink();
}

async function copyRoomLink() {
  if (!currentRoomId) return;
  const link = roomShareUrl(currentRoomId);
  try {
    await navigator.clipboard.writeText(link);
    hideElement(roomLinkFallback);
    setRoomStatus("초대 링크를 복사했어요. 단톡방에 붙여넣어 보세요!");
  } catch {
    showElement(roomLinkFallback);
    roomLinkInput.focus();
    roomLinkInput.select();
    setRoomStatus("아래 링크를 길게 눌러 복사한 뒤 단톡방에 공유해 주세요.");
  }
}

createRoomButtons.forEach((button) => button.addEventListener("click", handleCreateRoom));
shareRoomButtons.forEach((button) => button.addEventListener("click", shareRoom));
nativeShareRoomButtons.forEach((button) => button.addEventListener("click", nativeShareRoom));
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
