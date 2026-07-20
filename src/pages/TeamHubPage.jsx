import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getTeam, subscribeToMeetings, getLatestMeeting, deleteTeam, leaveTeam } from "../services/teamService";
import { clearMyNickname, recordVisitedTeam, removeJoinedTeam } from "../utils/localIdentity";

function formatMeetingTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeamHubPage({ uid }) {
  const { teamCode } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(undefined); // undefined = loading, null = not found
  const [meetings, setMeetings] = useState(undefined); // undefined = loading
  const [latestMeeting, setLatestMeeting] = useState(undefined); // undefined = loading, null = 아예 없음
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getTeam(teamCode).then((t) => {
      if (!cancelled) setTeam(t);
      if (t) recordVisitedTeam(teamCode);
    });
    const unsub = subscribeToMeetings(teamCode, uid, setMeetings);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [teamCode, uid]);

  useEffect(() => {
    if (!meetings || meetings.length === 0) return;
    recordVisitedTeam(teamCode, { destinationName: meetings[0].destinationName, meetingTime: meetings[0].meetingTime });
  }, [teamCode, meetings]);

  // 아직 이 팀의 어떤 모임에도 참여한 적 없는 신규 초대자를 위해, 방 코드만으로 "지금 잡힌 모임"
  // 하나를 찾아서 보여준다 (과거 전체 목록이 아니라 최신 모임 1개만 — subscribeToMeetings 참고).
  useEffect(() => {
    if (meetings === undefined || meetings.length > 0) return;
    let cancelled = false;
    getLatestMeeting(teamCode).then((m) => {
      if (!cancelled) setLatestMeeting(m);
    });
    return () => {
      cancelled = true;
    };
  }, [teamCode, meetings]);

  async function handleDeleteTeam() {
    if (!window.confirm("정말 이 팀을 삭제할까요? 팀의 모든 모임과 참여 기록이 사라지고 되돌릴 수 없어요.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteTeam(teamCode, uid);
      removeJoinedTeam(teamCode);
      navigate("/");
    } catch (err) {
      setError(err.message || "삭제에 실패했어요. 다시 시도해주세요.");
      setBusy(false);
    }
  }

  async function handleLeaveTeam() {
    if (!window.confirm("이 팀에서 나갈까요? 내 참여/체크인 기록이 이 팀의 모임들에서 사라져요.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await leaveTeam(teamCode, uid);
      clearMyNickname(teamCode);
      removeJoinedTeam(teamCode);
      navigate("/");
    } catch (err) {
      setError(err.message || "나가기에 실패했어요. 다시 시도해주세요.");
      setBusy(false);
    }
  }

  if (team === undefined || meetings === undefined) {
    return (
      <div className="page">
        <p className="spinner-text">불러오는 중...</p>
      </div>
    );
  }

  if (team === null) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="panel center-text">
            <h2>😵 방을 찾을 수 없어요</h2>
            <p className="field-hint">방 코드를 다시 확인해주세요.</p>
            <Link to="/" className="btn btn-primary">
              처음으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCreator = team.creatorUid === uid;

  return (
    <div className="page">
      <div className="page-wide">
        <div className="group-header">
          <div className="dest">👥 우리 팀 모임</div>
        </div>
        <div className="room-code-chip">방 코드 {teamCode}</div>

        <div className="btn-row">
          <Link to={`/t/${teamCode}/ranking`} className="btn btn-ghost">
            🏆 이번달 랭킹
          </Link>
          <Link to={`/t/${teamCode}/new-meeting`} className="btn btn-primary">
            ➕ 새 모임 잡기
          </Link>
          <Link to="/join" className="btn btn-ghost">
            🔑 다른 모임 참여
          </Link>
        </div>

        {meetings.length === 0 && latestMeeting ? (
          <div className="panel center-text">
            <h2>👋 참여 가능한 모임이 있어요</h2>
            <p className="field-hint">
              📍 {latestMeeting.destinationName} · ⏰ {formatMeetingTime(latestMeeting.meetingTime)}
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate(`/t/${teamCode}/m/${latestMeeting.id}`)}
            >
              이 모임 참여하기 →
            </button>
          </div>
        ) : meetings.length === 0 && latestMeeting === null ? (
          <div className="panel center-text">
            <h2>아직 모임이 없어요</h2>
            <p className="field-hint">새 모임을 만들어보세요.</p>
            <Link to={`/t/${teamCode}/new-meeting`} className="btn btn-primary">
              ➕ 새 모임 잡기
            </Link>
          </div>
        ) : meetings.length === 0 ? null : (
          <div className="meeting-grid">
            {meetings.map((m, idx) => (
              <button
                key={m.id}
                className="meeting-card"
                onClick={() => navigate(`/t/${teamCode}/m/${m.id}`)}
              >
                {idx === 0 && <span className="meeting-card-badge">최신</span>}
                <div className="meeting-card-dest">📍 {m.destinationName}</div>
                <div className="meeting-card-time">⏰ {formatMeetingTime(m.meetingTime)}</div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="checkin-error">{error}</p>}

        <div className="danger-zone">
          {isCreator ? (
            <button className="btn btn-danger" onClick={handleDeleteTeam} disabled={busy}>
              {busy ? "삭제 중..." : "🗑️ 팀 삭제하기"}
            </button>
          ) : (
            <button className="btn btn-danger" onClick={handleLeaveTeam} disabled={busy}>
              {busy ? "나가는 중..." : "🚪 팀 나가기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
