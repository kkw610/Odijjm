import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps, hasKakaoMapKey } from "../services/mapsService";

// 서울시청 — 검색/GPS로 아직 아무 위치도 안 골랐을 때 지도가 띄울 기본 중심점.
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

function GpsButton({ coords, onPick, className = "btn btn-secondary btn-block" }) {
  const [status, setStatus] = useState("idle"); // idle | loading | error

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("idle");
        onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: "" });
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <>
      <button
        type="button"
        className={coords ? "btn btn-accent btn-block" : className}
        onClick={useCurrentLocation}
        disabled={status === "loading"}
      >
        {coords
          ? "📍 지금 내 위치로 다시 설정"
          : status === "loading"
          ? "위치 확인 중..."
          : "📍 지금 여기를 목적지로 설정"}
      </button>
      {status === "error" && (
        <p className="field-error">위치 확인에 실패했어요. 위치 권한을 확인해주세요.</p>
      )}
    </>
  );
}

// 목적지를 "검색으로 찾기" 또는 "지도에서 직접 콕 찍기" 또는 "지금 내 위치" 세 가지 방법으로 고를 수 있게 해준다.
// 카카오맵 키가 없으면 검색/지도 없이 GPS 버튼만 남는 예전 방식으로 자동 폴백한다.
export default function DestinationPicker({ coords, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const placesRef = useRef(null);
  const geocoderRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!hasKakaoMapKey()) return;
    let cancelled = false;

    loadKakaoMaps().then((kakao) => {
      if (cancelled) return;
      if (!kakao?.maps?.services || !containerRef.current) {
        setFailed(true);
        return;
      }

      const center = coords
        ? new kakao.maps.LatLng(coords.lat, coords.lng)
        : new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      mapRef.current = new kakao.maps.Map(containerRef.current, { center, level: 4 });
      mapRef.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      placesRef.current = new kakao.maps.services.Places();
      geocoderRef.current = new kakao.maps.services.Geocoder();

      if (coords) placeMarker(kakao, coords.lat, coords.lng);

      kakao.maps.event.addListener(mapRef.current, "click", (e) => {
        const lat = e.latLng.getLat();
        const lng = e.latLng.getLng();
        placeMarker(kakao, lat, lng);
        geocoderRef.current.coord2Address(lng, lat, (result, geoStatus) => {
          const name =
            geoStatus === kakao.maps.services.Status.OK
              ? result[0]?.road_address?.address_name || result[0]?.address?.address_name || ""
              : "";
          onPick({ lat, lng, name });
        });
      });

      setReady(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeMarker(kakao, lat, lng) {
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!markerRef.current) {
      markerRef.current = new kakao.maps.Marker({ position: pos });
      markerRef.current.setMap(mapRef.current);
    } else {
      markerRef.current.setPosition(pos);
    }
    mapRef.current.setCenter(pos);
  }

  function handleSearch() {
    if (!query.trim() || !placesRef.current) return;
    setSearching(true);
    placesRef.current.keywordSearch(query.trim(), (data, status) => {
      setSearching(false);
      setResults(status === window.kakao.maps.services.Status.OK ? data.slice(0, 5) : []);
    });
  }

  function pickResult(item) {
    const lat = Number(item.y);
    const lng = Number(item.x);
    placeMarker(window.kakao, lat, lng);
    onPick({ lat, lng, name: item.place_name });
    setResults([]);
    setQuery(item.place_name);
  }

  function handleGpsPick(picked) {
    if (ready && mapRef.current) placeMarker(window.kakao, picked.lat, picked.lng);
    onPick(picked);
  }

  if (!hasKakaoMapKey() || failed) {
    return (
      <div className="dest-picker">
        <GpsButton coords={coords} onPick={onPick} />
        {failed && (
          <p className="field-hint">지도를 불러오지 못했어요. 위 버튼으로 현재 위치를 목적지로 설정해주세요.</p>
        )}
      </div>
    );
  }

  return (
    <div className="dest-picker">
      <div className="dest-search">
        <input
          placeholder="장소·주소 검색 (예: 강남역 11번 출구)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            handleSearch();
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={handleSearch} disabled={searching}>
          {searching ? "검색 중" : "검색"}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="dest-results">
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => pickResult(item)}>
                <span className="dest-result-name">{item.place_name}</span>
                <span className="dest-result-addr">{item.road_address_name || item.address_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="dest-map" ref={containerRef} />
      <p className="field-hint">
        {coords ? "지도를 다시 탭하면 위치를 바꿀 수 있어요." : "지도를 탭해서 정확한 위치를 콕 찍을 수도 있어요."}
      </p>

      <GpsButton coords={coords} onPick={handleGpsPick} />
    </div>
  );
}
