const topics = {
  today: {
    kicker: "오늘운세",
    title: "오늘의 기운은 차분한 정리운입니다",
    copy: "미뤄둔 연락, 정산, 일정 정리에 유리합니다. 큰 결정보다는 작게 정리하는 선택이 더 좋습니다."
  },
  love: {
    kicker: "애정운",
    title: "표현은 짧게, 마음은 분명하게",
    copy: "상대의 반응을 오래 재기보다 먼저 가볍게 말을 건네면 관계의 온도가 올라갑니다."
  },
  money: {
    kicker: "재물운",
    title: "작은 지출을 잡으면 흐름이 좋아집니다",
    copy: "오늘은 큰 투자보다 구독, 자동결제, 반복 지출을 점검하는 쪽이 더 실속 있습니다."
  },
  career: {
    kicker: "직장운",
    title: "정리된 문서가 기회를 만듭니다",
    copy: "아이디어보다 실행 기록이 돋보이는 날입니다. 회의 전 핵심 내용을 짧게 정리해두세요."
  },
  match: {
    kicker: "궁합",
    title: "비슷함보다 보완되는 부분을 보세요",
    copy: "서로 다른 생활 리듬이 단점처럼 보여도, 역할이 나뉘면 안정적인 궁합이 됩니다."
  },
  year: {
    kicker: "신년운세",
    title: "올해는 기반을 고르는 운입니다",
    copy: "새 출발보다 오래 끌고 갈 루틴을 만드는 데 초점을 두면 하반기 흐름이 단단해집니다."
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
const title = document.querySelector("#topic-title");
const copy = document.querySelector("#topic-copy");
const loginButtons = document.querySelectorAll(".js-kakao-login");
const shareButtons = document.querySelectorAll(".js-kakao-share");
const loginStatus = document.querySelector("#login-status");
const startButtons = document.querySelectorAll(".js-start-reading");
const historyButtons = document.querySelectorAll(".js-show-history");
const scrollTopButtons = document.querySelectorAll(".js-scroll-top");
const clearHistoryButton = document.querySelector(".js-clear-history");
const formSection = document.querySelector("#fortune-form");
const loadingPage = document.querySelector("#loading-page");
const resultPage = document.querySelector("#result-page");
const historyPage = document.querySelector("#history-page");
const sajuForm = document.querySelector("#saju-form");
const historyList = document.querySelector("#history-list");
const kakaoConfig = window.NEOGUL_SAJU_CONFIG || {};
const historyKey = "neogul-saju-history";

let selectedTopic = "today";
let latestResult = null;

cards.forEach((card) => {
  card.addEventListener("click", () => {
    const topic = topics[card.dataset.topic];
    if (!topic) return;

    selectedTopic = card.dataset.topic;
    cards.forEach((item) => item.classList.remove("active"));
    card.classList.add("active");
    kicker.textContent = topic.kicker;
    title.textContent = topic.title;
    copy.textContent = topic.copy;

    const topicSelect = sajuForm?.elements.topic;
    if (topicSelect) topicSelect.value = selectedTopic;
  });
});

function setLoginStatus(message) {
  if (loginStatus) {
    loginStatus.textContent = message;
  }
}

function initKakao() {
  if (!window.Kakao) {
    setLoginStatus("카카오 SDK를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.");
    return false;
  }

  if (!kakaoConfig.kakaoJavaScriptKey) {
    setLoginStatus("config.js에 카카오 JavaScript 키를 넣으면 로그인 버튼이 활성화됩니다.");
    return false;
  }

  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(kakaoConfig.kakaoJavaScriptKey);
  }

  setLoginStatus("카카오톡으로 로그인하면 운세 결과를 이어서 볼 수 있습니다.");
  return true;
}

function startKakaoLogin() {
  if (!initKakao()) return;

  window.Kakao.Auth.authorize({
    redirectUri: kakaoConfig.kakaoRedirectUri
  });
}

function startKakaoShare() {
  if (!initKakao()) return;

  const pageUrl = kakaoConfig.shareUrl || window.location.href;
  const imageUrl = new URL(kakaoConfig.shareImage || "assets/og-image.png", window.location.href).href;
  const titleText = latestResult?.title || "너굴 사주 - 오늘 운세, 너굴이가 봐드림";
  const description = latestResult?.summary || "수정구슬 앞의 느긋한 점술사 너굴이와 오늘의 사주 흐름을 확인해보세요.";

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: titleText,
      description,
      imageUrl,
      link: {
        mobileWebUrl: pageUrl,
        webUrl: pageUrl
      }
    },
    buttons: [
      {
        title: "운세 보러가기",
        link: {
          mobileWebUrl: pageUrl,
          webUrl: pageUrl
        }
      }
    ]
  });
}

function showElement(element) {
  element?.classList.remove("is-hidden");
}

function hideElement(element) {
  element?.classList.add("is-hidden");
}

function scrollToPanel(element) {
  element?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectFormData() {
  const data = new FormData(sajuForm);
  return {
    nickname: String(data.get("nickname") || "너굴 손님").trim(),
    birthDate: data.get("birthDate"),
    birthTime: data.get("birthTime"),
    calendarType: data.get("calendarType"),
    gender: data.get("gender"),
    topic: data.get("topic") || selectedTopic,
    question: String(data.get("question") || "").trim()
  };
}

async function requestFortune(payload) {
  if (!kakaoConfig.apiBaseUrl) {
    return createDemoFortune(payload);
  }

  const response = await fetch(`${kakaoConfig.apiBaseUrl.replace(/\/$/, "")}/fortune`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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

  return Promise.resolve({
    topic: label,
    title: `${name}님, ${label}은 천천히 풀리는 흐름입니다`,
    summary: `오늘은 크게 밀어붙이기보다 정리, 관찰, 짧은 실행이 잘 맞습니다.${question}`,
    scores: {
      love: 72,
      money: 64,
      career: 78
    },
    good: [
      "오전에 미뤄둔 연락을 정리하면 오후 흐름이 가벼워집니다.",
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
  [
    ["love", "애정"],
    ["money", "재물"],
    ["career", "일"]
  ].forEach(([key, label]) => {
    const card = document.createElement("div");
    card.className = "score-card";
    card.innerHTML = `<strong>${Number(result.scores[key] || 0)}</strong><span>${label}</span>`;
    scoreGrid.append(card);
  });

  renderList(document.querySelector("#result-good"), result.good);
  renderList(document.querySelector("#result-caution"), result.caution);
  renderList(document.querySelector("#result-actions"), result.actions);

  hideElement(loadingPage);
  showElement(resultPage);
  scrollToPanel(resultPage);
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

  hideElement(resultPage);
  hideElement(historyPage);
  showElement(loadingPage);
  scrollToPanel(loadingPage);

  try {
    const rawResult = await requestFortune(payload);
    const result = normalizeResult(rawResult, payload);
    saveHistory(result);
    renderResult(result);
  } catch (error) {
    const fallback = await createDemoFortune({
      ...payload,
      question: payload.question
    });
    const result = normalizeResult(fallback, payload);
    result.title = "너굴이가 먼저 본 미리보기 운세입니다";
    saveHistory(result);
    renderResult(result);
  }
}

startButtons.forEach((button) => {
  button.addEventListener("click", () => scrollToPanel(formSection));
});

historyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    hideElement(resultPage);
    hideElement(loadingPage);
    renderHistory();
    showElement(historyPage);
    scrollToPanel(historyPage);
  });
});

scrollTopButtons.forEach((button) => {
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
});

clearHistoryButton?.addEventListener("click", () => {
  localStorage.removeItem(historyKey);
  renderHistory();
});

sajuForm?.addEventListener("submit", handleSubmit);

loginButtons.forEach((button) => {
  button.addEventListener("click", startKakaoLogin);
});

shareButtons.forEach((button) => {
  button.addEventListener("click", startKakaoShare);
});

initKakao();
