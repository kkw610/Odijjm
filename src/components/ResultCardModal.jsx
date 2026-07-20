import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { track } from "../services/analytics";
import { bumpMetric } from "../services/metrics";
import ResultCard from "./ResultCard.jsx";

export default function ResultCardModal({ nickname, meeting, participant, rank, total, onClose }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);

  async function handleDownload() {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        // 카카오 지도 타일은 CORS 헤더가 없어 캡처하면 전체 다운로드가 깨진다.
        // 지도 레이어만 빼고 캡처하면 그 밑에 항상 깔려있는 이모지가 대신 찍힌다.
        filter: (node) => !(node instanceof HTMLElement && node.dataset?.captureSkip === "true"),
      });
      const link = document.createElement("a");
      link.download = `odijjm-${nickname}.png`;
      link.href = dataUrl;
      link.click();
      track("download_card");
      bumpMetric("cardDownloads");
    } catch (err) {
      console.error("카드 저장 실패", err);
      alert("카드 저장에 실패했어요. 스크린샷으로 저장해주세요!");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal" onClick={(e) => e.stopPropagation()}>
        <ResultCard
          ref={cardRef}
          nickname={nickname}
          meeting={meeting}
          participant={participant}
          rank={rank}
          total={total}
        />
        <div className="btn-row" style={{ width: 320 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            닫기
          </button>
          <button className="btn btn-primary" onClick={handleDownload} disabled={saving}>
            {saving ? "저장 중..." : "💾 이미지로 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
