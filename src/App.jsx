import { useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import CreateGroupPage from "./pages/CreateGroupPage.jsx";
import JoinPage from "./pages/JoinPage.jsx";
import TeamHubPage from "./pages/TeamHubPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";
import NewMeetingPage from "./pages/NewMeetingPage.jsx";
import RankingPage from "./pages/RankingPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { bumpMetric } from "./services/metrics";

export default function App() {
  const { uid, error } = useAuth();
  const location = useLocation();
  const visitBumpedRef = useRef(false);

  // /stats는 지표를 "보러 가는" 페이지지 서비스를 "쓰러 오는" 방문이 아니라서 방문수에서 뺀다.
  // 세션 중 처음 도착한 곳이 /stats면 넘어갔다가, 다른 페이지로 이동하는 순간 그때 한 번 집계한다.
  useEffect(() => {
    if (!uid || visitBumpedRef.current) return;
    if (location.pathname === "/stats") return;
    visitBumpedRef.current = true;
    bumpMetric("visits");
  }, [uid, location.pathname]);

  if (error) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="panel center-text">
            <h2>😵 접속에 실패했어요</h2>
            <p className="field-hint">
              잠시 후 새로고침 해주세요. 계속되면 서비스 설정을 확인해주세요 (Firebase 익명 로그인 활성화 필요).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="page">
        <p className="spinner-text">불러오는 중...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateGroupPage uid={uid} />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/t/:teamCode" element={<TeamHubPage uid={uid} />} />
      <Route path="/t/:teamCode/new-meeting" element={<NewMeetingPage uid={uid} />} />
      <Route path="/t/:teamCode/ranking" element={<RankingPage uid={uid} />} />
      <Route path="/t/:teamCode/m/:meetingId" element={<MeetingPage uid={uid} />} />
      <Route path="/stats" element={<StatsPage />} />
    </Routes>
  );
}
