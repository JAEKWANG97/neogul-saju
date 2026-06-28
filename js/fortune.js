/* =========================================================================
 * fortune.js — 개인 운세: 주제 선택, 입력 폼, 결과 렌더, 기록(localStorage)
 * core.js의 showScreen/go/toast/scrollToPanel 등을 전역으로 공유한다.
 * ========================================================================= */

const topics = {
  overall: {
    kicker: "종합사주"
  },
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
  overall: "종합사주",
  today: "오늘운세",
  love: "애정운",
  money: "재물운",
  career: "직장운",
  match: "궁합",
  year: "신년운세"
};

const cards = document.querySelectorAll(".fortune-card");
const kicker = document.querySelector("#topic-kicker");
const formTitle = document.querySelector("#form-title");
const startButtons = document.querySelectorAll(".js-start-reading");
const topicStartButtons = document.querySelectorAll(".js-start-topic");
const historyButtons = document.querySelectorAll(".js-show-history");
const clearHistoryButton = document.querySelector(".js-clear-history");
const sajuForm = document.querySelector("#saju-form");
const partnerFields = document.querySelector("#partner-fields");
const historyList = document.querySelector("#history-list");
const historyKey = "neogul-saju-history";

let selectedTopic = "overall";
let latestResult = null;
let fortuneRequestPending = false;

function togglePartnerFields(topic) {
  const isMatch = topic === "match";
  partnerFields?.classList.toggle("is-hidden", !isMatch);
  ["partnerBirthYear", "partnerBirthMonth", "partnerBirthDay"].forEach((name) => {
    const field = sajuForm?.elements[name];
    if (field) field.required = isMatch;
  });
}

// 주제 선택의 단일 소스: 카드 강조 / 폼 select / 상대방칸을 한 번에 동기화
function applyTopic(topicKey) {
  const topic = topics[topicKey];
  if (!topic) return;

  selectedTopic = topicKey;
  cards.forEach((item) => item.classList.toggle("active", item.dataset.topic === topicKey));
  if (kicker) kicker.textContent = topic.kicker;
  if (formTitle) {
    formTitle.textContent = topicKey === "overall" ? "생년월일로 깊게 보기" : `${topic.kicker} 보기`;
  }

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
    birthDate: birthDateFromData(data, "birth"),
    birthTime: data.get("birthTime"),
    calendarType: data.get("calendarType"),
    gender: data.get("gender"),
    topic,
    question: String(data.get("question") || "").trim()
  };

  if (topic === "match") {
    payload.partner = {
      name: String(data.get("partnerName") || "상대방").trim(),
      birthDate: birthDateFromData(data, "partnerBirth"),
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

  if (payload.topic === "overall") {
    return Promise.resolve({
      topic: label,
      title: `${name}님은 천천히 깊어지는 사람입니다`,
      oneLiner: "처음엔 조용해 보여도, 기준이 서면 오래 밀고 가는 기운이 강해요.",
      summary: `타고난 흐름은 빠르게 튀기보다 안쪽에서 기준을 세우고 오래 가져가는 쪽에 가깝습니다. 관계에서는 바로 뜨거워지는 말보다 꾸준히 지키는 태도에서 신뢰가 쌓이고, 일과 돈에서는 작은 루틴이 모여 큰 안정감으로 이어집니다. 지금은 욕심을 크게 벌리기보다 내가 반복해서 잘할 수 있는 방식을 찾는 게 운을 쓰는 가장 좋은 방법입니다.${question}`,
      scene: "카톡을 바로 보내지 않아도 마음이 없는 건 아니고, 회의에서 말수가 많지 않아도 결정적인 한마디를 준비하는 쪽에 가깝습니다. 지갑을 열 때도 기분보다 기준이 먼저 서면 훨씬 편해집니다.",
      scores: { love: 74, money: 69, career: 82 },
      good: [
        "관계에서는 한 번 믿은 사람에게 오래 가는 힘이 있어, 시간이 지날수록 진가가 드러납니다.",
        "일에서는 급한 반응보다 정리된 판단이 강점이라, 복잡한 상황에서 기준을 잡는 역할이 잘 맞습니다.",
        "돈은 크게 한 번 잡기보다 새는 구멍을 막을 때 안정감이 빠르게 올라옵니다."
      ],
      caution: [
        "생각을 너무 오래 품고 있으면 주변 사람은 무심하다고 느낄 수 있습니다.",
        "완벽하게 준비된 뒤 움직이려 하면 좋은 타이밍을 지나칠 수 있습니다.",
        "피곤할수록 말이 짧아지니, 중요한 관계에는 짧은 설명 한 줄을 남기는 게 좋습니다."
      ],
      actions: [
        "오늘 중요한 사람에게 답장이 늦은 이유를 짧게라도 말해두기.",
        "이번 주에 반복해서 지킬 수 있는 돈 관리 기준 하나만 정하기.",
        "일이나 공부에서 미뤄둔 정리 작업을 20분만 먼저 끝내기."
      ],
      basis: [
        "입력한 생년월일의 흐름은 겉으로 드러나는 속도보다 안쪽의 지속성이 강하게 읽힙니다.",
        "오행의 균형은 한쪽으로 확 밀기보다 부족한 부분을 루틴으로 보완할 때 편해지는 구조입니다.",
        "십신의 결은 관계와 일에서 역할을 분명히 할수록 안정되는 쪽이라, 말보다 반복 행동이 운을 키웁니다."
      ],
      source: "demo"
    });
  }

  if (payload.topic === "match") {
    const partnerName = payload.partner?.name || "상대방";
    return Promise.resolve({
      topic: label,
      title: `${name}님과 ${partnerName}님은 보완되는 궁합입니다`,
      oneLiner: "속도는 달라도 역할이 나뉘면 오래 가는 조합이에요.",
      summary: `서로 속도가 달라 보여도 역할이 나뉘면 안정적인 흐름이 됩니다. 비슷함보다 채워주는 부분을 보세요.${question}`,
      scene: "카톡 답장 속도나 약속 잡는 방식이 달라 보여도, 한 사람이 먼저 움직이고 다른 사람이 정리하면 관계가 편해집니다.",
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
      basis: [
        "두 사람의 기운은 같은 방향으로만 흐르기보다 서로 빈 곳을 채우는 쪽에 가깝습니다.",
        "일간의 결이 다르면 처음엔 속도 차이가 보이지만, 역할을 나누면 안정감이 생깁니다.",
        "계절감이 다른 사람끼리는 말투보다 타이밍을 맞출 때 관계가 부드러워집니다."
      ],
      source: "demo"
    });
  }

  return Promise.resolve({
    topic: label,
    title: `${name}님, ${label}은 천천히 풀리는 흐름입니다`,
    oneLiner: "오늘은 크게 밀기보다 타이밍을 고르는 사람이 유리해요.",
    summary: `오늘은 크게 밀어붙이기보다 정리, 관찰, 짧은 실행이 잘 맞습니다.${question}`,
    scene: "카톡 답장을 바로 보내기보다 한 번 읽고, 회의나 약속에서는 먼저 정리한 한마디를 꺼내는 쪽이 좋습니다.",
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
    basis: [
      "오늘의 흐름은 한쪽 기운이 과하게 앞서기보다 균형을 맞추는 쪽에 힘이 실립니다.",
      "일간의 성향은 빠른 판단보다 기준을 세운 뒤 움직일 때 더 편안하게 드러납니다.",
      "십신의 흐름으로 보면 말과 행동의 순서를 바꾸는 것만으로도 결과가 달라지기 쉽습니다."
    ],
    source: "demo"
  });
}

function firstSentence(text) {
  return String(text || "").split(/(?<=[.!?。]|[.?!])\s*/)[0]?.trim() || "";
}

function fallbackOneLiner(result, payload) {
  if (result.oneLiner) return result.oneLiner;
  const sentence = firstSentence(result.summary);
  if (sentence) return sentence;
  if (payload.topic === "match") return "이 관계는 비슷해서 편한 쪽보다 달라서 역할이 생기는 쪽이에요.";
  return "너굴이가 보기엔, 오늘은 말의 양보다 타이밍이 더 중요합니다.";
}

function fallbackScene(result, payload) {
  if (result.scene) return result.scene;
  if (payload.topic === "money") return "지갑을 여는 순간 한 번만 멈추면, 필요한 소비와 기분 소비가 분리됩니다.";
  if (payload.topic === "career") return "회의에서 길게 설명하기보다 정리된 한 문장이 더 좋은 인상을 남깁니다.";
  if (payload.topic === "love" || payload.topic === "match") return "카톡 답장이 늦어도 바로 결론 내리지 말고, 상대의 반복되는 태도를 함께 보세요.";
  return "짧은 메시지, 약속 시간, 메모장에 남긴 할 일처럼 작은 장면에서 오늘의 흐름이 먼저 보입니다.";
}

function fallbackBasis(result, payload) {
  if (Array.isArray(result.basis) && result.basis.length) return result.basis;
  const topicBasis = payload.topic === "match"
    ? "두 사람의 오행 리듬을 같이 보면, 같은 점보다 서로 보완되는 지점이 관계의 힘이 됩니다."
    : "입력한 생년월일과 시간의 오행 리듬을 보면, 오늘은 빠르게 밀기보다 균형을 잡는 쪽이 편합니다.";
  return [
    topicBasis,
    "일간은 내가 세상을 대하는 기본 결로 보는데, 오늘은 그 결을 억지로 바꾸기보다 쓰기 좋은 방향을 찾는 흐름입니다.",
    "십신은 관계와 역할의 힌트로 읽습니다. 그래서 결과도 사건 예언보다 말투, 타이밍, 행동 기준으로 풀었습니다."
  ];
}

function normalizeResult(result, payload) {
  return {
    id: crypto.randomUUID?.() || String(Date.now()),
    createdAt: new Date().toISOString(),
    topic: result.topic || topicLabels[payload.topic] || "오늘운세",
    title: result.title || "너굴이가 본 오늘의 흐름",
    oneLiner: fallbackOneLiner(result, payload),
    summary: result.summary || "오늘은 작은 정리와 신중한 선택이 잘 맞습니다.",
    scene: fallbackScene(result, payload),
    scores: result.scores || { love: 60, money: 60, career: 60 },
    good: Array.isArray(result.good) ? result.good : [],
    caution: Array.isArray(result.caution) ? result.caution : [],
    actions: Array.isArray(result.actions) ? result.actions : [],
    basis: fallbackBasis(result, payload),
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
  document.querySelector("#result-one-liner").textContent = result.oneLiner || fallbackOneLiner(result, result.request || {});
  document.querySelector("#result-summary").textContent = result.summary;
  document.querySelector("#result-scene").textContent = result.scene || fallbackScene(result, result.request || {});

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
  renderList(document.querySelector("#result-basis"), result.basis || fallbackBasis(result, result.request || {}));

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
  const pattern = document.querySelector("#history-pattern");
  if (pattern) {
    pattern.innerHTML = "";
    if (rows.length >= 2) {
      const recentTopics = rows.slice(0, 3).map((row) => row.topic).join(" · ");
      const avgCareer = Math.round(rows.slice(0, 3).reduce((sum, row) => sum + Number(row.scores?.career || 0), 0) / Math.min(rows.length, 3));
      pattern.innerHTML = `<p class="panel-kicker">최근 흐름</p><strong>${recentTopics}</strong><span>최근 결과는 일과 정리 흐름이 평균 ${avgCareer}점으로 잡힙니다. 같은 패턴이 반복되면 오늘의 행동부터 가볍게 바꿔보세요.</span>`;
    }
  }

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "아직 보관된 흐름이 없습니다. 내 운세를 한 번 보면 이곳에 차곡차곡 쌓입니다.";
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
  if (fortuneRequestPending) return;
  fortuneRequestPending = true;
  const submitButton = sajuForm?.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.dataset.idleText = submitButton.textContent;
    submitButton.textContent = "너굴이가 보는 중";
    submitButton.disabled = true;
  }
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

  fortuneRequestPending = false;
  if (submitButton) {
    submitButton.textContent = submitButton.dataset.idleText || "너굴이에게 물어보기";
    submitButton.disabled = false;
  }
}

// 시작 버튼 / 다시 보기 → 홈으로 가서 입력 폼으로 스크롤
startButtons.forEach((button) => {
  button.addEventListener("click", () => {
    pendingFormScroll = true;
    go("/home");
  });
});

topicStartButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTopic(button.dataset.topic || "overall");
    revealForm();
    scrollToPanel(formSection);
  });
});

historyButtons.forEach((button) => button.addEventListener("click", () => go("/history")));

clearHistoryButton?.addEventListener("click", () => {
  localStorage.removeItem(historyKey);
  renderHistory();
});

sajuForm?.addEventListener("submit", handleSubmit);
