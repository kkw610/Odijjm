import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps, hasKakaoMapKey } from "../services/mapsService";

const LATE_COLOR = "#ff9a3c";

function buildPin(text, bgColor) {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 26px; height: 26px; border-radius: 999px;
    background: ${bgColor}; color: #fff; border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; font-family: inherit;
  `;
  el.textContent = text;
  return el;
}

export default function LiveMap({ destination, participants }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasKakaoMapKey()) return;
    let cancelled = false;

    loadKakaoMaps().then((kakao) => {
      if (cancelled) return;
      if (!kakao || !containerRef.current) {
        setFailed(true);
        return;
      }
      mapRef.current = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(destination.lat, destination.lng),
        level: 5,
      });
      mapRef.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !window.kakao?.maps || !mapRef.current) return;
    const kakao = window.kakao;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();
    const destPos = new kakao.maps.LatLng(destination.lat, destination.lng);

    const destOverlay = new kakao.maps.CustomOverlay({
      position: destPos,
      content: buildPin("🏁", "#221c2b"),
      yAnchor: 0.5,
    });
    destOverlay.setMap(mapRef.current);
    overlaysRef.current.push(destOverlay);
    bounds.extend(destPos);

    // 이미 도착한(정시/사실상 도착) 사람은 지도에 안 띄운다 — 아직 오고 있는 지각자만 실시간 추적.
    participants
      .filter((p) => p.status === "en_route" && p.lastCheckIn)
      .forEach((p) => {
        const pos = new kakao.maps.LatLng(p.lastCheckIn.lat, p.lastCheckIn.lng);
        const overlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: buildPin(p.nickname.slice(0, 1), LATE_COLOR),
          yAnchor: 0.5,
        });
        overlay.setMap(mapRef.current);
        overlaysRef.current.push(overlay);
        bounds.extend(pos);
      });

    if (overlaysRef.current.length > 1) {
      mapRef.current.setBounds(bounds, 48);
    }
  }, [ready, destination, participants]);

  if (!hasKakaoMapKey()) {
    return <div className="map-placeholder">🗺️ 실시간 지도를 보려면 카카오맵 API 키가 필요해요</div>;
  }

  if (failed) {
    return <div className="map-placeholder">지도를 불러오지 못했어요</div>;
  }

  return <div className="live-map" ref={containerRef} />;
}
