window.NEOGUL_SAJU_CONFIG = {
  // 카카오 개발자센터 JavaScript 키 (공유/로그인용, 프론트 공개 키)
  kakaoJavaScriptKey: "a9be59f444936594e818e60b2cc0c7ae",
  enableKakaoLogin: false,
  kakaoRedirectUri: "https://neogul-saju.vercel.app/",
  shareUrl: "https://neogul-saju.vercel.app/",
  shareImage: "https://neogul-saju.vercel.app/assets/og-image.png",
  // 전부 Vercel 호스팅이라 같은 도메인 상대경로. (운세/궁합 방 백엔드)
  // 로컬에서 백엔드까지 돌리려면 `vercel dev` 사용. 정적 데모만 볼 땐 ""로 비우면 됨.
  apiBaseUrl: "/api"
};
