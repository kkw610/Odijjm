import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { buildResultContent } from "../utils/resultCopy";
import { loadKakaoMaps, hasKakaoMapKey } from "../services/mapsService";
import { computeLateMinutes } from "../utils/geo";

function buildEmojiPin(emoji, fontSize) {
  const el = document.createElement("div");
  el.textContent = emoji;
  el.style.cssText = `font-size:${fontSize}px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45));`;
  return el;
}

const ResultCard = forwardRef(function ResultCard(
  { nickname, meeting, participant, rank, total },
  ref
) {
  const { lastCheckIn } = participant;
  const lateMinutes = computeLateMinutes(lastCheckIn.checkedAt, meeting.meetingTime);

  // checkedAt을 키로 고정해 재렌더링될 때마다 문구가 바뀌지 않도록 한다.
  const content = useMemo(
    () =>
      buildResultContent({
        lateMinutes,
        distanceMeters: lastCheckIn.distanceMeters,
        etaMinutes: lastCheckIn.etaMinutes,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastCheckIn.checkedAt]
  );

  const mapContainerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const showMap = hasKakaoMapKey();

  useEffect(() => {
    if (!showMap) return;
    let cancelled = false;

    loadKakaoMaps().then((kakao) => {
      if (cancelled || !kakao || !mapContainerRef.current) return;

      const destPos = new kakao.maps.LatLng(meeting.destinationLat, meeting.destinationLng);
      const myPos = new kakao.maps.LatLng(lastCheckIn.lat, lastCheckIn.lng);

      const map = new kakao.maps.Map(mapContainerRef.current, { center: destPos, level: 6 });
      map.setDraggable(false);
      map.setZoomable(false);

      const bounds = new kakao.maps.LatLngBounds();
      bounds.extend(destPos);
      bounds.extend(myPos);
      map.setBounds(bounds, 28);

      new kakao.maps.CustomOverlay({ position: destPos, content: buildEmojiPin("🏁", 20), yAnchor: 0.5 }).setMap(
        map
      );
      new kakao.maps.CustomOverlay({ position: myPos, content: buildEmojiPin("📍", 26), yAnchor: 1 }).setMap(map);

      setMapReady(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`result-card rc-theme-${content.theme}`} ref={ref}>
      <span className="rc-sticker-sparkle">✨</span>

      <div className="rc-brand">ODIJJM · 어디쯤</div>

      {showMap ? (
        <div className="rc-hero rc-hero-map">
          {/* 지도 타일은 CORS 헤더가 없어 PNG로 캡처할 수 없다. 이모지를 항상 지도 뒤에
              깔아두고, 캡처 시에는 data-capture-skip 지도 레이어만 제외해 이모지가 대신 찍히게 한다. */}
          <span className="rc-emoji rc-hero-map-fallback">{content.emoji}</span>
          <div className="rc-hero-map-canvas" ref={mapContainerRef} data-capture-skip="true" />
          {mapReady && <span className="rc-hero-map-pin">📍 {meeting.destinationName}</span>}
        </div>
      ) : (
        <div className="rc-hero rc-hero-emoji-only">
          <span className="rc-emoji">{content.emoji}</span>
        </div>
      )}

      <div className="rc-headline">{content.headline}</div>

      <div className="rc-caption">{content.caption}</div>

      <div className="rc-stats">
        <div className="rc-stat">
          <b>{content.resultValue}</b>
          <span>{content.resultLabel}</span>
        </div>
        <div className="rc-stat">
          <b>{content.distanceKm}km</b>
          <span>남은 거리</span>
        </div>
        {rank && total && (
          <div className="rc-stat">
            <b>
              {rank}/{total}
            </b>
            <span>도착 순위</span>
          </div>
        )}
      </div>

      <div className="rc-footer">
        {nickname} · {meeting.destinationName} · #오디쯤 #지각왕카드
      </div>
    </div>
  );
});

export default ResultCard;
