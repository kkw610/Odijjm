import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getTeam,
  subscribeToMeeting,
  subscribeToParticipants,
  joinMeeting,
  checkIn,
} from "../services/teamService";
import { getMyNickname, saveMyNickname, recordVisitedTeam } from "../utils/localIdentity";
import { haversineDistanceMeters, ARRIVED_THRESHOLD_METERS, computeLateMinutes } from "../utils/geo";
import { track } from "../services/analytics";
import { bumpMetric } from "../services/metrics";
import ResultCardModal from "../components/ResultCardModal.jsx";
import LiveMap from "../components/LiveMap.jsx";

// 약속 시간이 지나면 버튼 없이 자동으로 위치를 계속 추적한다. 매 GPS 갱신마다 쓰지 않고
// 이 간격으로 묶어서 Firestore에 반영한다 (배터리/쓰기 비용 절약, 그래도 충분히 실시간처럼 느껴짐).
const LIVE_TRACK_THROTTLE_MS = 12 * 1000;

const STATUS_EMOJI = {
  arrived: "✅",
  en_route: "🏃",
  not_checked_in: "💤",
};

const STATUS_LABEL = {
  arrived: "도착!",
  en_route: "이동중",
  not_checked_in: "대기중",
};

function formatMeetingTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms, suffix = "체크인 가능") {
  if (ms <= 0) return "";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}시간 ${m}분 후 ${suffix}`;
  return `${m}분 후 ${suffix}`;
}

function describeParticipant(p, meetingTimeIso) {
  if (!p.lastCheckIn) return "아직 체크인 전";
  if (p.status === "arrived") {
    const lateMinutes = computeLateMinutes(p.lastCheckIn.checkedAt, meetingTimeIso);
    if (lateMinutes < 0) return `🎉 ${-lateMinutes}분 일찍 도착`;
    if (lateMinutes === 0) return "칼도착";
    return `😅 ${lateMinutes}분 지각 도착`;
  }
  return `${(p.lastCheckIn.distanceMeters / 1000).toFixed(1)}km 남음 · 도보 약 ${p.lastCheckIn.etaMinutes}분`;
}

function geoErrorMessage(err) {
  if (err.code === err.PERMISSION_DENIED) {
    return "위치 권한이 거부됐어요. 브라우저/기기 설정에서 위치 권한을 허용한 뒤 다시 시도해주세요.";
  }
  if (err.code === err.TIMEOUT) {
    return "위치를 가져오는데 시간이 너무 오래 걸렸어요. 다시 시도해주세요.";
  }
  return "위치를 가져오지 못했어요. GPS/네트워크 상태를 확인하고 다시 시도해주세요.";
}

export default function MeetingPage({ uid }) {
  const { teamCode, meetingId } = useParams();
  const [team, setTeam] = useState(undefined); // undefined = loading, null = not found
  const [meeting, setMeeting] = useState(undefined); // undefined = loading, null = not found
  const [participants, setParticipants] = useState([]);
  const [joinNickname, setJoinNickname] = useState(() => getMyNickname(teamCode) || "");
  const [joining, setJoining] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showCardForId, setShowCardForId] = useState(null);
  const [autoJoinTried, setAutoJoinTried] = useState(false);
  const watchIdRef = useRef(null);
  const lastWriteAtRef = useRef(0);
  const permissionPrimedRef = useRef(false);

  const meParticipant = useMemo(() => participants.find((p) => p.id === uid) ?? null, [participants, uid]);

  // 참여하자마자 위치 권한 프롬프트를 미리 띄운다. 실제 추적(watchPosition)은 약속 시간이 지나야
  // 시작하지만, 권한 요청 자체를 그때 가서 처음 하면 화면을 안 보고 있던 사람은 못 넘어갈 수 있다.
  useEffect(() => {
    if (!meParticipant || permissionPrimedRef.current) return;
    permissionPrimedRef.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {},
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  }, [meParticipant]);

  useEffect(() => {
    let cancelled = false;
    getTeam(teamCode).then((t) => {
      if (!cancelled) setTeam(t);
      if (t) recordVisitedTeam(teamCode);
    });
    const unsubMeeting = subscribeToMeeting(teamCode, meetingId, setMeeting);
    return () => {
      cancelled = true;
      unsubMeeting();
    };
  }, [teamCode, meetingId]);

  // 이 기기가 참여한 적 있는 방으로 홈 화면에서 다시 찾아올 수 있도록 최신 모임 정보를 남겨둔다.
  useEffect(() => {
    if (!meeting) return;
    recordVisitedTeam(teamCode, { destinationName: meeting.destinationName, meetingTime: meeting.meetingTime });
  }, [teamCode, meeting]);

  useEffect(() => {
    if (!meeting) return;
    const unsub = subscribeToParticipants(teamCode, meeting.id, setParticipants);
    return () => unsub();
    // meeting.id로만 재구독하면 충분 (meeting 객체 전체는 스냅샷마다 참조가 바뀜)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCode, meeting?.id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  // 같은 팀에서 이미 닉네임을 쓴 적 있으면, 새 모임이 열려도 다시 묻지 않고 조용히 참여시킨다.
  useEffect(() => {
    if (!meeting || meParticipant || autoJoinTried) return;
    const savedNickname = getMyNickname(teamCode);
    if (!savedNickname) return;
    setAutoJoinTried(true);
    joinMeeting(teamCode, meeting.id, uid, savedNickname).then(() => bumpMetric("joins"));
  }, [meeting, meParticipant, autoJoinTried, teamCode, uid]);

  // 도착 확정된 사람끼리는 남은 거리(도착 후엔 다 100m 안쪽이라 GPS 오차 수준이라 의미 없음)가 아니라
  // 실제 도착 시각(=얼마나 일찍/늦게 왔는지)으로 순위를 매긴다. 아직 이동 중인 사람들끼리는 기존대로
  // 남은 거리가 가까운 순. 도착한 사람은 항상 아직 이동 중인 사람보다 위.
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const aArrived = a.status === "arrived";
      const bArrived = b.status === "arrived";
      if (aArrived && bArrived) {
        const aAt = a.lastCheckIn ? new Date(a.lastCheckIn.checkedAt).getTime() : Infinity;
        const bAt = b.lastCheckIn ? new Date(b.lastCheckIn.checkedAt).getTime() : Infinity;
        return aAt - bAt;
      }
      if (aArrived !== bArrived) return aArrived ? -1 : 1;
      const da = a.lastCheckIn ? a.lastCheckIn.distanceMeters : Infinity;
      const db = b.lastCheckIn ? b.lastCheckIn.distanceMeters : Infinity;
      return da - db;
    });
  }, [participants]);

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinNickname.trim() || !meeting) return;
    setJoining(true);
    try {
      await joinMeeting(teamCode, meeting.id, uid, joinNickname.trim());
      saveMyNickname(teamCode, joinNickname.trim());
      track("join_meeting");
      bumpMetric("joins");
    } finally {
      setJoining(false);
    }
  }

  // 약속 시간 전에 미리 도착한 사람을 위한 단발성 체크인. 도착 반경 안일 때만 기록하고,
  // 아직 장소가 아니면 아무것도 저장하지 않는다 (약속 시간 전엔 위치를 남기지 않는다는 원칙 유지).
  function handleEarlyCheckIn() {
    if (!navigator.geolocation) {
      setGeoError("이 브라우저는 위치 기능을 지원하지 않아요.");
      return;
    }
    setGeoError("");
    setCheckinLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const distanceMeters = haversineDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          meeting.destinationLat,
          meeting.destinationLng
        );
        if (distanceMeters > ARRIVED_THRESHOLD_METERS) {
          setGeoError("아직 약속 장소가 아니에요. 약속 시간이 되면 자동으로 위치가 추적돼요.");
          setCheckinLoading(false);
          return;
        }
        try {
          await checkIn(teamCode, meeting.id, uid, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            destinationLat: meeting.destinationLat,
            destinationLng: meeting.destinationLng,
          });
          track("check_in", { early: true });
          bumpMetric("arrivals");
          setShowCardForId(uid);
        } catch {
          setGeoError("체크인 저장에 실패했어요. 다시 시도해주세요.");
        } finally {
          setCheckinLoading(false);
        }
      },
      (err) => {
        setGeoError(geoErrorMessage(err));
        setCheckinLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // 약속 시간이 지나면 버튼 없이 자동으로 실시간 위치 추적을 시작한다. 도착(반경 안)할 때까지
  // watchPosition으로 계속 위치를 받아 스코어보드/지도에 반영하고, 도착하면 스스로 멈춘다.
  // 탭을 닫으면 같이 멈추는 "현재 세션 동안만" 추적 — 백그라운드 상시 추적은 아니다.
  useEffect(() => {
    if (!meeting || !meParticipant) return;
    if (now < new Date(meeting.meetingTime).getTime()) return;

    if (meParticipant.status === "arrived") {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (watchIdRef.current != null) return; // 이미 추적 중
    if (!navigator.geolocation) {
      setGeoError("이 브라우저는 위치 기능을 지원하지 않아요.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nowMs = Date.now();
        if (nowMs - lastWriteAtRef.current < LIVE_TRACK_THROTTLE_MS) return;
        lastWriteAtRef.current = nowMs;
        checkIn(teamCode, meeting.id, uid, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          destinationLat: meeting.destinationLat,
          destinationLng: meeting.destinationLng,
        })
          .then((result) => {
            if (result?.status === "arrived") {
              track("check_in", { early: false });
              bumpMetric("arrivals");
            }
          })
          .catch(() => {});
        setGeoError("");
      },
      (err) => {
        setGeoError(geoErrorMessage(err));
        if (err.code === err.PERMISSION_DENIED && watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, meParticipant?.status, now, teamCode, uid]);

  // 컴포넌트가 사라질 때(다른 페이지로 이동 등)는 위치 추적을 확실히 멈춘다.
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  if (team === undefined || meeting === undefined) {
    return (
      <div className="page">
        <p className="spinner-text">불러오는 중...</p>
      </div>
    );
  }

  if (team === null || meeting === null) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="panel center-text">
            <h2>😵 모임을 찾을 수 없어요</h2>
            <p className="field-hint">링크를 다시 확인해주세요.</p>
            {team ? (
              <Link to={`/t/${teamCode}`} className="btn btn-primary">
                이 팀의 다른 모임 보기
              </Link>
            ) : (
              <Link to="/" className="btn btn-primary">
                처음으로
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const meetingTimeMs = new Date(meeting.meetingTime).getTime();
  const meetingTimePassed = now >= meetingTimeMs;

  const myLateMinutes =
    meParticipant?.status === "arrived" && meParticipant.lastCheckIn
      ? computeLateMinutes(meParticipant.lastCheckIn.checkedAt, meeting.meetingTime)
      : null;

  const cardParticipant = participants.find((p) => p.id === showCardForId);
  const showJoinForm = !meParticipant && getMyNickname(teamCode) === null;

  const checkedInSorted = sortedParticipants.filter((p) => p.lastCheckIn);
  const cardRank = cardParticipant
    ? checkedInSorted.findIndex((p) => p.id === cardParticipant.id) + 1
    : null;
  const cardTotal = checkedInSorted.length;

  return (
    <div className="page">
      <div className="page-wide">
        <div className="group-header">
          <div className="dest">📍 {meeting.destinationName}</div>
          <div className="meta">⏰ {formatMeetingTime(meeting.meetingTime)}</div>
        </div>
        <div className="room-code-chip">방 코드 {teamCode}</div>

        <div className="btn-row">
          <Link to={`/t/${teamCode}`} className="btn btn-ghost">
            📋 지난 모임 보기
          </Link>
          <Link to={`/t/${teamCode}/ranking`} className="btn btn-ghost">
            🏆 이번달 랭킹
          </Link>
          <Link to={`/t/${teamCode}/new-meeting`} className="btn btn-ghost">
            ➕ 새 모임 잡기
          </Link>
          <Link to="/join" className="btn btn-ghost">
            🔑 다른 모임 참여
          </Link>
        </div>

        {showJoinForm && (
          <form className="panel" onSubmit={handleJoin}>
            <h2>모임에 참여하기</h2>
            <div className="field">
              <label htmlFor="joinNickname">닉네임</label>
              <input
                id="joinNickname"
                placeholder="예: 항상늦는애"
                value={joinNickname}
                maxLength={12}
                autoFocus
                onChange={(e) => setJoinNickname(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={joining || !joinNickname.trim()}>
              {joining ? "참여 중..." : "참여하기 →"}
            </button>
          </form>
        )}

        <div className="meeting-layout">
          <div className="meeting-main">
            {meParticipant && (
              <div className="checkin-zone">
                {meParticipant.status === "arrived" ? (
                  <p>
                    {myLateMinutes < 0
                      ? `🎉 ${formatMeetingTime(meParticipant.lastCheckIn.checkedAt)}에 미리 도착! (${-myLateMinutes}분 일찍) — 더 이상 체크인 안 해도 이 기록 그대로 유지돼요`
                      : myLateMinutes === 0
                      ? "✅ 칼도착! 지각 안 했어요 — 더 이상 체크인 안 해도 이 기록 그대로 유지돼요"
                      : `✅ 도착 확정 (약속보다 ${myLateMinutes}분 늦음) — 더 이상 체크인 안 해도 이 기록 그대로 유지돼요`}
                  </p>
                ) : !meetingTimePassed ? (
                  <>
                    <p>아직 약속 시간 전이에요</p>
                    <p className="countdown">{formatCountdown(meetingTimeMs - now, "자동 위치 추적 시작")}</p>
                    <button className="btn btn-secondary" onClick={handleEarlyCheckIn} disabled={checkinLoading}>
                      {checkinLoading ? "확인 중..." : "📍 약속 장소에 이미 있다면 눌러주세요"}
                    </button>
                    <p className="field-hint">
                      📱 약속 시간이 되면 이 화면을 켜둔 상태에서 자동으로 위치가 추적돼요. 앱을 완전히 끄거나 탭을
                      닫으면 추적이 멈춰요 — 약속 시간엔 이 화면을 열어두세요.
                    </p>
                  </>
                ) : (
                  <>
                    <p>🛰️ 약속 시간이 지나서 실시간으로 위치를 추적하고 있어요</p>
                    {meParticipant.lastCheckIn && (
                      <p className="countdown">
                        {(meParticipant.lastCheckIn.distanceMeters / 1000).toFixed(1)}km 남음 · 도보 약{" "}
                        {meParticipant.lastCheckIn.etaMinutes}분
                        <br />
                        마지막 업데이트 {formatMeetingTime(meParticipant.lastCheckIn.checkedAt)}
                      </p>
                    )}
                  </>
                )}
                {geoError && <p className="checkin-error">{geoError}</p>}
                {meParticipant?.status === "arrived" && (
                  <button className="btn btn-ghost" onClick={() => setShowCardForId(uid)}>
                    🖼️ 내 결과 카드 보기
                  </button>
                )}
              </div>
            )}

            <div className="map-section">
              <div className="map-section-title">🗺️ 지각자 실시간 위치</div>
              <LiveMap
                destination={{
                  lat: meeting.destinationLat,
                  lng: meeting.destinationLng,
                  name: meeting.destinationName,
                }}
                participants={participants}
              />
            </div>
          </div>

          <div className="scoreboard">
            {sortedParticipants.map((p, idx) => (
              <div key={p.id} className={`score-row ${p.id === uid ? "me" : ""}`}>
                <div className="score-rank">{idx + 1}</div>
                <div className="score-status-emoji">{STATUS_EMOJI[p.status]}</div>
                <div className="score-info">
                  <div className="score-name">
                    {p.nickname}
                    {p.id === uid && <span className="me-tag">나</span>}
                  </div>
                  <div className="score-detail">{describeParticipant(p, meeting.meetingTime)}</div>
                </div>
                <div className={`score-badge badge-${p.status}`}>{STATUS_LABEL[p.status]}</div>
              </div>
            ))}
            {sortedParticipants.length === 0 && (
              <p className="muted-white">아직 참여자가 없어요. 방 코드를 공유해보세요!</p>
            )}
          </div>
        </div>
      </div>

      {cardParticipant?.lastCheckIn && (
        <ResultCardModal
          nickname={cardParticipant.nickname}
          meeting={meeting}
          participant={cardParticipant}
          rank={cardRank}
          total={cardTotal}
          onClose={() => setShowCardForId(null)}
        />
      )}
    </div>
  );
}
