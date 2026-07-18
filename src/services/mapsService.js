// 한국 주소/지형 정확도 때문에 지도 표시는 카카오맵을 쓴다.
// (거리/도착시간 계산은 카카오에 도보 길찾기가 마땅치 않아 하버사인 직선거리를 그대로 쓴다 — src/utils/geo.js)
const APP_KEY = import.meta.env.VITE_KAKAO_MAP_API_KEY;

let loadPromise = null;
let warnedOnce = false;

function warnOnce(message, err) {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(`[odijjm] ${message}`, err ?? "");
}

export function hasKakaoMapKey() {
  return Boolean(APP_KEY);
}

// 카카오맵 JS SDK를 <script> 태그로 동적 로드하고 window.kakao.maps 네임스페이스를 돌려준다.
export function loadKakaoMaps() {
  if (!APP_KEY) return Promise.resolve(null);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    if (window.kakao?.maps?.Map) {
      resolve(window.kakao);
      return;
    }

    const existing = document.querySelector("script[data-kakao-maps-sdk]");
    const onReady = () => {
      window.kakao.maps.load(() => resolve(window.kakao));
    };

    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapsSdk = "true";
    // 프로토콜 상대 URL(//...)은 로컬 http 개발 서버에서 http로 풀려 카카오 CDN이 ORB로 막는다. https로 고정.
    // libraries=services — 목적지 검색(키워드 검색)/지도 클릭 시 주소 역변환에 필요.
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = onReady;
    script.onerror = (err) => {
      warnOnce("카카오맵 SDK를 불러오지 못했어요.", err);
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
