const EARTH_RADIUS_METERS = 6371000;
const WALK_SPEED_KMH = 4.5;
const ARRIVED_THRESHOLD_METERS = 100;
const LATE_GRACE_MINUTES = 1; // GPS 측위/네트워크 지연 정도는 지각으로 안 친다

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

// 하버사인 공식: 두 좌표 간 직선거리(m)
export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// 도보 평균 속도 기준 예상 도착 시간(분)
export function estimateEtaMinutes(distanceMeters) {
  const hours = distanceMeters / 1000 / WALK_SPEED_KMH;
  return Math.round(hours * 60);
}

export function statusFromDistance(distanceMeters) {
  return distanceMeters <= ARRIVED_THRESHOLD_METERS ? "arrived" : "en_route";
}

// 체크인 시각과 약속 시각의 차이를 분 단위 지각으로 환산한다.
// 1분 이내 차이는 지각으로 치지 않는다 (앱을 열고 위치를 잡는 데 걸리는 시간 보정).
export function computeLateMinutes(checkedAtIso, meetingTimeIso) {
  const raw = Math.round((new Date(checkedAtIso).getTime() - new Date(meetingTimeIso).getTime()) / 60000);
  if (raw > 0 && raw <= LATE_GRACE_MINUTES) return 0;
  return raw;
}

export { ARRIVED_THRESHOLD_METERS };
