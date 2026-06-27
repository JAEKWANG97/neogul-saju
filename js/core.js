/* =========================================================================
 * core.js — 앱 셸: 화면 전환(해시 라우팅), 토스트, 카카오, 공통 헬퍼
 *
 * 화면(라우트):
 *   #/home  · #/result · #/history · #/room/<id>
 * 각 화면은 한 번에 하나만 보이고(showScreen), 브라우저 뒤로가기로 이동한다.
 * 다른 파일(fortune.js, room.js)이 이 파일의 함수를 전역 스코프로 공유한다.
 * ========================================================================= */

const kakaoConfig = window.NEOGUL_SAJU_CONFIG || {};

const homeView = document.querySelector("#home-view");
const formSection = document.querySelector("#fortune-form");
const toastEl = document.querySelector("#toast");
const loginButtons = document.querySelectorAll(".js-kakao-login");
const shareButtons = document.querySelectorAll(".js-kakao-share");
const goHomeButtons = document.querySelectorAll(".js-go-home");
const scrollTopButtons = document.querySelectorAll(".js-scroll-top");

let toastTimer = null;
let pendingFormScroll = false;

/* ----------------------------- 공통 헬퍼 ----------------------------- */

function showElement(element) {
  element?.classList.remove("is-hidden");
}

function hideElement(element) {
  element?.classList.add("is-hidden");
}

function scrollToPanel(element) {
  element?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toast(message) {
  if (!toastEl || !message) return;
  toastEl.textContent = message;
  toastEl.classList.remove("is-hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("is-hidden"), 3200);
}

/* ----------------------------- 화면 전환 ----------------------------- */

const SCREEN_IDS = {
  loading: "loading-page",
  result: "result-page",
  history: "history-page",
  room: "room-page"
};

// 홈 스택과 패널을 한 번에 하나만 보여준다. (스크롤은 호출부/라우터가 담당)
function showScreen(name) {
  homeView?.classList.toggle("is-hidden", name !== "home");
  Object.entries(SCREEN_IDS).forEach(([key, id]) => {
    document.querySelector(`#${id}`)?.classList.toggle("is-hidden", key !== name);
  });
  if (name !== "room") stopRoomPolling();
}

/* ----------------------------- 해시 라우터 ----------------------------- */

// 라우트로 이동. 같은 해시면 hashchange가 안 뜨므로 직접 router()를 부른다.
function go(route) {
  const target = `#${route}`;
  if (window.location.hash === target) router();
  else window.location.hash = target;
}

function goHome() {
  go("/home");
}

function router() {
  const parts = window.location.hash.replace(/^#/, "").split("/").filter(Boolean);
  const section = parts[0] || "home";

  if (section === "room" && parts[1]) {
    showScreen("room");
    window.scrollTo({ top: 0, behavior: "auto" });
    enterRoom(parts[1]);
    return;
  }

  if (section === "result") {
    if (!latestResult) { go("/home"); return; }
    showScreen("result");
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  if (section === "history") {
    renderHistory();
    showScreen("history");
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  // home
  showScreen("home");
  if (pendingFormScroll) {
    pendingFormScroll = false;
    formSection?.classList.remove("is-hidden"); // 단계화된 폼을 펼친다
    scrollToPanel(formSection);
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

/* ----------------------------- 카카오 (로그인/공유) ----------------------------- */

function setLoginStatus(message) {
  console.info(message);
}

function initKakao() {
  if (!window.Kakao) {
    setLoginStatus("카카오 SDK를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.");
    return false;
  }
  if (!kakaoConfig.kakaoJavaScriptKey) {
    setLoginStatus("Kakao JavaScript key is not configured.");
    return false;
  }
  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(kakaoConfig.kakaoJavaScriptKey);
  }
  return true;
}

function startKakaoLogin() {
  if (!initKakao()) return;
  window.Kakao.Auth.authorize({ redirectUri: kakaoConfig.kakaoRedirectUri });
}

async function copyLink(url, message) {
  try {
    await navigator.clipboard.writeText(url);
    toast(message || "링크를 복사했어요.");
  } catch {
    toast("링크 복사를 지원하지 않는 환경이에요.");
  }
}

function startKakaoShare() {
  const pageUrl = kakaoConfig.shareUrl || window.location.href;

  // 카카오 키가 없으면 버튼이 죽지 않도록 링크 복사로 대체
  if (!initKakao()) {
    copyLink(pageUrl, "공유 링크를 복사했어요. 단톡방에 붙여넣어 보세요!");
    return;
  }

  const imageUrl = new URL(kakaoConfig.shareImage || "assets/og-image.png", window.location.href).href;
  const titleText = latestResult
    ? `내 너굴 사주: ${latestResult.title}`
    : "너굴 사주 - 오늘 내 흐름 보기";
  const summary = latestResult?.summary || "수정구슬 앞의 느긋한 점술사 너굴이와 오늘의 사주 흐름을 확인해보세요.";
  const description = latestResult
    ? `${summary.slice(0, 72)}${summary.length > 72 ? "..." : ""} 너도 한번 봐봐.`
    : summary;
  const buttonTitle = latestResult ? "내 사주도 보기" : "운세 보러가기";

  try {
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: titleText,
        description,
        imageUrl,
        link: { mobileWebUrl: pageUrl, webUrl: pageUrl }
      },
      buttons: [
        { title: buttonTitle, link: { mobileWebUrl: pageUrl, webUrl: pageUrl } }
      ]
    });
  } catch {
    copyLink(pageUrl, "공유 링크를 복사했어요. 단톡방에 붙여넣어 보세요!");
  }
}

/* ----------------------------- 셸 이벤트 배선 ----------------------------- */

goHomeButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    goHome();
  });
});

scrollTopButtons.forEach((button) => {
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
});

// 카카오 키가 없으면 로그인은 동작할 수 없으니 버튼 자체를 숨긴다 (죽은 버튼 방지)
if (!kakaoConfig.kakaoJavaScriptKey) {
  loginButtons.forEach((button) => button.classList.add("is-hidden"));
} else {
  loginButtons.forEach((button) => button.addEventListener("click", startKakaoLogin));
}

shareButtons.forEach((button) => button.addEventListener("click", startKakaoShare));

initKakao();
