import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getMonthlyRanking } from "../services/teamService";
import BrandLogo from "../components/BrandLogo.jsx";

function currentMonthLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}월`;
}

export default function RankingPage({ uid }) {
  const { teamCode } = useParams();
  const [ranking, setRanking] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRanking(null);
    getMonthlyRanking(teamCode, uid)
      .then((data) => {
        if (!cancelled) setRanking(data);
      })
      .catch(() => {
        if (!cancelled) setError("랭킹을 불러오지 못했어요.");
      });
    return () => {
      cancelled = true;
    };
  }, [teamCode, uid, refreshKey]);

  return (
    <div className="page">
      <div className="page-narrow">
        <BrandLogo />

        <div className="group-header">
          <div className="dest">🏆 {currentMonthLabel()} 지각왕 랭킹</div>
          <div className="meta">방 코드 {teamCode}</div>
        </div>

        <div className="btn-row">
          <Link to={`/t/${teamCode}`} className="btn btn-ghost">
            ← 팀으로
          </Link>
          <button className="btn btn-ghost" onClick={() => setRefreshKey((k) => k + 1)}>
            🔄 새로고침
          </button>
        </div>

        {ranking === null && !error && <p className="spinner-text">집계 중...</p>}
        {error && <p className="checkin-error">{error}</p>}

        {ranking && ranking.length === 0 && (
          <p className="muted-white">이번 달엔 아직 체크인 기록이 없어요. 모임을 열어보세요!</p>
        )}

        {ranking && ranking.length > 0 && (
          <div className="scoreboard">
            {ranking.map((entry, idx) => (
              <div key={entry.uid} className="score-row">
                <div className="score-rank">{idx === 0 && entry.totalLateMinutes > 0 ? "👑" : idx + 1}</div>
                <div className="score-info">
                  <div className="score-name">{entry.nickname}</div>
                  <div className="score-detail">
                    지각 {entry.lateCount}회 · 총 {entry.totalLateMinutes}분 · 정시 {entry.onTimeCount}회
                  </div>
                </div>
                <div className="score-badge badge-en_route">{entry.meetingsCount}회 참여</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
