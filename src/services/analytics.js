import { getAnalytics, logEvent, isSupported } from "firebase/analytics";
import { app } from "../firebase";

// Firebase Analytics는 measurementId가 있고(=콘솔에서 Google Analytics 연결), 에뮬레이터 모드가
// 아닐 때만 켠다. 콘솔 설정 전에도 앱이 죽지 않도록 인스턴스가 없으면 track()은 조용히 no-op.
const MEASUREMENT_ID = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

let analyticsInstance = null;

if (MEASUREMENT_ID && !useEmulator) {
  isSupported()
    .then((ok) => {
      if (ok) analyticsInstance = getAnalytics(app);
    })
    .catch(() => {});
}

export function track(eventName, params = {}) {
  if (!analyticsInstance) return;
  logEvent(analyticsInstance, eventName, params);
}
