import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeToMetrics } from "../services/metrics";
import BrandLogo from "../components/BrandLogo.jsx";

function formatCount(n) {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

const TILES = [
  { field: "visits", label: "사이트 방문", emoji: "👀", color: "var(--color-accent)" },
  { field: "createClicks", label: "모임 만들기 버튼 클릭", emoji: "🖱️", color: "var(--color-primary)" },
  { field: "meetingsCreated", label: "모임 생성 완료", emoji: "🎉", color: "var(--color-primary-dark)" },
  { field: "joins", label: "모임 참여", emoji: "🙋", color: "var(--color-accent)" },
  { field: "arrivals", label: "도착 확정(체크인)", emoji: "📍", color: "var(--color-success)" },
  { field: "cardDownloads", label: "결과 카드 저장", emoji: "💾", color: "var(--color-warn)" },
];

// 팀/개인 데이터가 아니라 서비스 전체 집계 숫자만 보여주는 페이지라 내비게이션엔 안 걸어두고,
// 직접 /stats로 들어와야 보이게 했다.
export default function StatsPage() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const unsub = subscribeToMetrics(setMetrics);
    return () => unsub();
  }, []);

  return (
    <div className="page">
      <div className="page-narrow">
        <BrandLogo />
        <div className="panel">
          <h2>📊 서비스 지표</h2>
          <p className="field-hint">실시간으로 집계돼요. 팀/모임 데이터가 아니라 서비스 전체 숫자예요.</p>

          <div className="stats-grid">
            {TILES.map((t) => (
              <div key={t.field} className="stat-tile" style={{ "--tile-accent": t.color }}>
                <div className="stat-tile-label">
                  {t.emoji} {t.label}
                </div>
                <div className="stat-tile-value">{metrics ? formatCount(metrics[t.field]) : "…"}</div>
              </div>
            ))}
          </div>
        </div>

        <Link to="/" className="link-back">
          ← 처음으로
        </Link>
      </div>
    </div>
  );
}
