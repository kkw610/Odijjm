import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { track } from "../services/analytics";
import { bumpMetric } from "../services/metrics";
import ResultCard from "./ResultCard.jsx";

export default function ResultCardModal({ nickname, meeting, participant, rank, total, teamCode, meetingId, onClose }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);

  function downloadBlob(blob) {
    const link = document.createElement("a");
    link.download = `odijjm-${nickname}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }

  // 카카오 지도는 CORS 헤더가 없어 브라우저 안 canvas 캡처(html-to-image)로는 지도를 절대 못 찍는다.
  // 그래서 서버의 헤드리스 브라우저가 이 카드를 진짜로 열어서 스크린샷 뜬 PNG를 우선 쓴다.
  // 그 서버가 잠시 죽어있거나 느릴 때를 대비해, 실패하면 예전 방식(지도 없이 이모지만)으로 폴백한다.
  async function renderOnServer() {
    const params = new URLSearchParams({ teamCode, meetingId, uid: participant.id });
    const res = await fetch(`/render/card?${params}`);
    if (!res.ok) throw new Error("server render failed");
    return res.blob();
  }

  async function renderOnClient() {
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 3,
      // 지도 레이어만 빼고 캡처하면 그 밑에 항상 깔려있는 이모지가 대신 찍힌다 (지도 없는 폴백용).
      filter: (node) => !(node instanceof HTMLElement && node.dataset?.captureSkip === "true"),
    });
    return (await fetch(dataUrl)).blob();
  }

  async function handleDownload() {
    setSaving(true);
    try {
      let blob;
      try {
        blob = await renderOnServer();
      } catch {
        if (!cardRef.current) throw new Error("no card to fall back to");
        blob = await renderOnClient();
      }
      downloadBlob(blob);
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
