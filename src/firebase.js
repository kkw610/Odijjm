import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously } from "firebase/auth";

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

const firebaseConfig = useEmulator
  ? {
      // Auth SDK는 에뮬레이터로 리다이렉트되더라도 apiKey 형식 값이 있어야 초기화된다.
      apiKey: "demo-emulator-key",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "odijjm-demo",
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

if (!firebaseConfig.projectId) {
  console.warn(
    "[odijjm] Firebase 설정값이 비어있습니다. .env.example을 복사해 .env.local을 만들고 값을 채워주세요."
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

if (useEmulator) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

// 로그인 폼 없이 방문 즉시 익명 계정을 부여한다 (회원가입 없음 원칙 유지 + 참여자 식별용 uid 확보).
// uid는 브라우저/기기별로 유지되며, 랭킹 집계와 "본인만 자기 체크인 수정 가능" 보안 규칙의 기준이 된다.
export const authReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then((cred) => resolve(cred.user)).catch(reject);
      }
    },
    reject
  );
});
