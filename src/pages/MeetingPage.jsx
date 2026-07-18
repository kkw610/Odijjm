import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getTeam,
  subscribeToMeeting,
  subscribeToParticipants,
  joinMeeting,
  checkIn,
} from "../services/teamService";
import { getMyNickname, saveMyNickname } from "../utils/localIdentity";
import ResultCardModal from "../components/ResultCardModal.jsx";
import LiveMap from "../components/LiveMap.jsx";

const CHECKIN_COOLDOWN_MS = 5 * 60 * 1000; // 스코어보드 스팸 방지: 5분에 1회

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
  const autoCheckinTriedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getTeam(teamCode).then((t) => {
      if (!cancelled) setTeam(t);
    });
    const unsubMeeting = subscribeToMeeting(teamCode, meetingId, setMeeting);
    return () => {
      cancelled = true;
      unsubMeeting();
    };
  }, [teamCode, meetingId]);

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

  const meParticipant = useMemo(() => participants.find((p) => p.id === uid) ?? null, [participants, uid]);

  // 같은 팀에서 이미 닉네임을 쓴 적 있으면, 새 모임이 열려도 다시 묻지 않고 조용히 참여시킨다.
  useEffect(() => {
    if (!meeting || meParticipant || autoJoinTried) return;
    const savedNickname = getMyNickname(teamCode);
    if (!savedNickname) return;
    setAutoJoinTried(true);
    joinMeeting(teamCode, meeting.id, uid, savedNickname);
  }, [meeting, meParticipant, autoJoinTried, teamCode, uid]);

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
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
    } finally {
      setJoining(false);
    }
  }

  function handleCheckIn() {
    if (meParticipant?.status === "arrived") return; // 이미 도착 확정 — 재체크인 불필요
    if (!navigator.geolocation) {
      setGeoError("이 브라우저는 위치 기능을 지원하지 않아요.");
      return;
    }
    setGeoError("");
    setCheckinLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await checkIn(teamCode, meeting.id, uid, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            destinationLat: meeting.destinationLat,
            destinationLng: meeting.destinationLng,
          });
          setShowCardForId(uid);
          setNow(Date.now());
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

  // 약속 시간이 지나 있는데 아직 한 번도 체크인 안 한 상태로 화면을 열면, 버튼을 누르라고
  // 기다리지 않고 곧바로 위치를 확인한다. "버튼 누르는 그 몇 분" 때문에 실제로는 제시간에
  // 도착해 있던 사람이 지각으로 잘못 찍히는 걸 막기 위함 (체크인 시각 = 약속 시각과의 차이로
  // 지각 여부를 계산하므로, 확인이 늦어질수록 불리해진다).
  useEffect(() => {
    if (!meeting || !meParticipant) return;
    if (meParticipant.lastCheckIn || meParticipant.status !== "not_checked_in") return;
    if (Date.now() < new Date(meeting.meetingTime).getTime()) return;
    if (autoCheckinTriedRef.current) return;
    autoCheckinTriedRef.current = true;
    handleCheckIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, meParticipant, now]);

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

  const lastCheckInAtMs = meParticipant?.lastCheckIn
    ? new Date(meParticipant.lastCheckIn.checkedAt).getTime()
    : null;
  const cooldownRemainingMs = lastCheckInAtMs ? CHECKIN_COOLDOWN_MS - (now - lastCheckInAtMs) : 0;
  const inCooldown = cooldownRemainingMs > 0;

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
                  <p>✅ 도착 확정! 지각 안 했어요 — 이제 체크인 안 해도 이 기록 그대로 유지돼요</p>
                ) : !meetingTimePassed ? (
                  <>
                    <p>아직 약속 시간 전이에요</p>
                    <p className="countdown">{formatCountdown(meetingTimeMs - now)}</p>
                  </>
                ) : inCooldown ? (
                  <>
                    <p>방금 체크인했어요, 잠깐 쉬는 중 🫠</p>
                    <p className="countdown">{formatCountdown(cooldownRemainingMs, "다시 체크인 가능")}</p>
                  </>
                ) : (
                  <>
                    <p>약속 시간이 지났어요. 지금 어디야?</p>
                    <button className="btn btn-primary btn-lg" onClick={handleCheckIn} disabled={checkinLoading}>
                      {checkinLoading
                        ? "위치 확인 중..."
                        : meParticipant?.lastCheckIn
                        ? "📍 다시 어디야?"
                        : "📍 지금 어디야?"}
                    </button>
                  </>
                )}
                {geoError && <p className="checkin-error">{geoError}</p>}
                {meParticipant?.lastCheckIn && (
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
                  <div className="score-detail">
                    {p.lastCheckIn
                      ? `${(p.lastCheckIn.distanceMeters / 1000).toFixed(1)}km 남음 · 도보 약 ${p.lastCheckIn.etaMinutes}분`
                      : "아직 체크인 전"}
                  </div>
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
