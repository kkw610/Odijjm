import { doc, setDoc, onSnapshot, increment } from "firebase/firestore";
import { db } from "../firebase";

// 사이트 자체에서 바로 볼 수 있는 핵심 지표. Google Analytics 콘솔을 따로 열 필요 없이
// /stats 페이지에서 실시간으로 확인할 수 있도록 Firestore에 카운터 하나를 두고 increment로 누적한다.
const metricsRef = doc(db, "metrics", "global");

export function bumpMetric(field) {
  setDoc(metricsRef, { [field]: increment(1) }, { merge: true }).catch(() => {});
}

export function subscribeToMetrics(callback) {
  return onSnapshot(
    metricsRef,
    (snap) => callback(snap.exists() ? snap.data() : {}),
    () => callback({})
  );
}
