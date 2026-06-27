/* =========================================================================
 * fortune.js — 개인 운세: 주제 선택, 입력 폼, 결과 렌더, 기록(localStorage)
 * core.js의 showScreen/go/toast/scrollToPanel 등을 전역으로 공유한다.
 * ========================================================================= */

const topics = {
  today: {
    kicker: "오늘운세"
  },
  love: {
    kicker: "애정운"
  },
  money: {
    kicker: "재물운"
  },
  career: {
    kicker: "직장운"
  },
  match: {
    kicker: "궁합"
  },
  year: {
    kicker: "신년운세"
  }
};

const topicLabels = {
  today: "오늘운세",
  love: "애정운",
  money: "재물운",
  career: "직장운",
  match: "궁합",
  year: "신년운세"
};

const cards = document.querySelectorAll(".fortune-card");
const kicker = document.querySelector("#topic-kicker");
const startButtons = document.querySelectorAll(".js-start-reading");
const historyButtons = document.querySelectorAll(".js-show-history");
const clearHistoryButton = document.querySelector(".js-clear-history");
const sajuForm = document.querySelector("#saju-form");
const partnerFields = document.querySelector("#partner-fields");
const historyList = document.querySelector("#history-list");
const historyKey = "neogul-saju-history";

let selectedTopic = "today";
let latestResult = null;

function togglePartnerFields(topic) {
  const isMatch = topic === "match";
  partnerFields?.classList.toggle("is-hidden", !isMatch);
  const partnerBirthDate = sajuForm?.elements.partnerBirthDate;
  if (partnerBirthDate) partnerBirthDate.required = isMatch;
}

// 주제 선택의 단일 소스: 카드 강조 / 폼 select / 상대방칸을 한 번에 동기화
function applyTopic(topicKey) {
  const topic = topics[topicKey];
  if (!topic) return;

  selectedTopic = topicKey;
  cards.forEach((item) => item.classList.toggle("active", item.dataset.topic === topicKey));
  if (kicker) kicker.textContent = topic.kicker;

  const topicSelect = sajuForm?.elements.topic;
  if (topicSelect && topicSelect.value !== topicKey) topicSelect.value = topicKey;
  togglePartnerFields(topicKey);
}

function revealForm() {
  formSection?.classList.remove("is-hidden");
}

// 메뉴 카드 탭 → 주제 동기화 + 폼 펼치기(단계화) + 폼으로 스크롤
cards.forEach((card) => {
  card.addEventListener("click", () => {
    applyTopic(card.dataset.topic);
    revealForm();
    scrollToPanel(formSection);
  });
});

// 폼 안 select 변경도 카드 강조와 같이 동기화
sajuForm?.elements.topic?.addEventListener("change", (event) => applyTopic(event.target.value));

function collectFormData() {
  const data = new FormData(sajuForm);
  const topic = data.get("topic") || selectedTopic;
  const payload = {
    nickname: String(data.get("nickname") || "너굴 손님").trim(),
    birthDate: data.get("birthDate"),
    birthTime: data.get("birthTime"),
    calendarType: data.get("calendarType"),
    gender: data.get("gender"),
    topic,
    question: String(data.get("question") || "").trim()
  };

  if (topic === "match") {
    payload.partner = {
      name: String(data.get("partnerName") || "상대방").trim(),
      birthDate: data.get("partnerBirthDate"),
      birthTime: data.get("partnerBirthTime"),
      calendarType: data.get("partnerCalendarType"),
      gender: data.get("partnerGender")
    };
  }

  return payload;
}

async function requestFortune(payload) {
  if (!kakaoConfig.apiBaseUrl) {
    return createDemoFortune(payload);
  }

  const response = await fetch(`${kakaoConfig.apiBaseUrl.replace(/\/$/, "")}/fortune`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Fortune request failed: ${response.status}`);
  }

  return response.json();
}

function createDemoFortune(payload) {
  const label = topicLabels[payload.topic] || "오늘운세";
  const name = payload.nickname || "너굴 손님";
  const question = payload.question ? ` 특히 "${payload.question}"에 대해서는 작게 확인하고 빠르게 움직이는 쪽이 좋습니다.` : "";

  if (payload.topic === "match") {
    const partnerName = payload.partner?.name || "상대방";
    return Promise.resolve({
      topic: label,
      title: `${name}님과 ${partnerName}님은 보완되는 궁합입니다`,
      summary: `서로 속도가 달라 보여도 역할이 나뉘면 안정적인 흐름이 됩니다. 비슷함보다 채워주는 부분을 보세요.${question}`,
      scores: { love: 76, money: 60, career: 68 },
      good: [
        "표현 방식이 달라 처음엔 어색해도 곧 서로의 리듬을 이해하게 됩니다.",
        "한 사람이 추진하면 다른 사람이 정리하는 역할 분담이 잘 맞습니다.",
        "솔직한 대화를 미루지 않으면 관계의 온도가 빠르게 올라갑니다."
      ],
      caution: [
        "기대를 말하지 않고 속으로만 재면 오해가 쌓이기 쉽습니다.",
        "중요한 약속은 가볍게 넘기지 말고 한 번 더 확인하세요."
      ],
      actions: [
        "오늘 상대에게 짧고 분명하게 마음을 한 번 표현하기",
        "서로의 다른 점을 단점이 아니라 역할로 바라보기",
        "다음 만남 일정을 먼저 가볍게 제안하기"
      ],
      source: "demo"
    });
  }

  return Promise.resolve({
    topic: label,
    title: `${name}님, ${label}은 천천히 풀리는 흐름입니다`,
    summary: `오늘은 크게 밀어붙이기보다 정리, 관찰, 짧은 실행이 잘 맞습니다.${question}`,
    scores: { love: 72, money: 64, career: 78 },
    good: [
      "오전에 짧게 처리할 일을 끝내면 오후 흐름이 가벼워집니다.",
      "새 선택보다 기존 계획을 다듬는 일이 좋은 결과로 이어집니다.",
      "상대의 말보다 반복되는 행동을 보면 판단이 쉬워집니다."
    ],
    caution: [
      "급한 결론을 내리면 나중에 다시 조정할 가능성이 큽니다.",
      "돈과 일정은 약속 전에 한 번 더 숫자로 확인하세요."
    ],
    actions: [
      "오늘 해야 할 일을 세 개만 적고 끝까지 처리하기",
      "중요한 메시지는 짧고 분명하게 보내기",
      "밤에는 내일 결정할 일을 미리 정리해두기"
    ],
    source: "demo"
  });
}

function normalizeResult(result, payload) {
  return {
    id: crypto.randomUUID?.() || String(Date.now()),
    createdAt: new Date().toISOString(),
    topic: result.topic || topicLabels[payload.topic] || "오늘운세",
    title: result.title || "너굴이가 본 오늘의 흐름",
    summary: result.summary || "오늘은 작은 정리와 신중한 선택이 잘 맞습니다.",
    scores: result.scores || { love: 60, money: 60, career: 60 },
    good: Array.isArray(result.good) ? result.good : [],
    caution: Array.isArray(result.caution) ? result.caution : [],
    actions: Array.isArray(result.actions) ? result.actions : [],
    request: payload,
    source: result.source || "api"
  };
}

function renderList(target, items) {
  target.innerHTML = "";
  items.slice(0, 4).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.append(li);
  });
}

function renderResult(result) {
  latestResult = result;
  document.querySelector("#result-topic").textContent = result.topic;
  document.querySelector("#result-title").textContent = result.title;
  document.querySelector("#result-summary").textContent = result.summary;

  const scoreGrid = document.querySelector("#score-grid");
  scoreGrid.innerHTML = "";
  // 궁합은 애정/재물/일 라벨이 안 맞아 끌림/대화/안정으로 바꿔 보여준다
  const isMatch = result.request?.topic === "match";
  const scoreLabels = isMatch
    ? [["love", "끌림"], ["money", "대화"], ["career", "안정"]]
    : [["love", "애정"], ["money", "재물"], ["career", "일"]];
  scoreLabels.forEach(([key, label]) => {
    const card = document.createElement("div");
    card.className = "score-card";
    card.innerHTML = `<strong>${Number(result.scores[key] || 0)}</strong><span>${label}</span>`;
    scoreGrid.append(card);
  });

  renderList(document.querySelector("#result-good"), result.good);
  renderList(document.querySelector("#result-caution"), result.caution);
  renderList(document.querySelector("#result-actions"), result.actions);

  go("/result");
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(historyKey) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(result) {
  const next = [result, ...readHistory()].slice(0, 10);
  localStorage.setItem(historyKey, JSON.stringify(next));
}

function renderHistory() {
  const rows = readHistory();
  historyList.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "아직 저장된 운세가 없습니다. 맞춤 운세를 한 번 확인해보세요.";
    historyList.append(empty);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    item.innerHTML = `<strong>${row.title}</strong><span>${new Date(row.createdAt).toLocaleString("ko-KR")} · ${row.topic}</span>`;
    item.addEventListener("click", () => renderResult(row));
    historyList.append(item);
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  const payload = collectFormData();

  showScreen("loading");
  window.scrollTo({ top: 0, behavior: "auto" });

  try {
    const rawResult = await requestFortune(payload);
    const result = normalizeResult(rawResult, payload);
    saveHistory(result);
    renderResult(result);
  } catch (error) {
    // 실패를 조용히 숨기지 않고 사용자에게 알린 뒤 미리보기로 대체
    toast("지금 연결이 불안정해 미리보기 운세를 보여드려요.");
    const fallback = await createDemoFortune(payload);
    const result = normalizeResult(fallback, payload);
    result.title = "너굴이가 먼저 본 미리보기 운세입니다";
    saveHistory(result);
    renderResult(result);
  }
}

// 시작 버튼 / 다시 보기 → 홈으로 가서 입력 폼으로 스크롤
startButtons.forEach((button) => {
  button.addEventListener("click", () => {
    pendingFormScroll = true;
    go("/home");
  });
});

historyButtons.forEach((button) => button.addEventListener("click", () => go("/history")));

clearHistoryButton?.addEventListener("click", () => {
  localStorage.removeItem(historyKey);
  renderHistory();
});

sajuForm?.addEventListener("submit", handleSubmit);
