import { useNavigate } from "react-router-dom";
import { getJoinedTeams } from "../utils/localIdentity";

function formatMeetingTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// 이 기기가 들어가 본 방들을 보여준다. 팀에 한 번 들어가면 나가기 전엔 다른 팀에 못 들어가는 게
// 아니라(우리 uid는 팀마다 독립적으로 참여 가능), 방을 바꿔 들어갈 손쉬운 진입점이 없던 게 문제였다.
export default function JoinedRoomsList() {
  const navigate = useNavigate();
  const joinedTeams = getJoinedTeams();

  if (joinedTeams.length === 0) return null;

  return (
    <div className="home-rooms">
      <div className="map-section-title">👥 내가 들어갔던 방</div>
      <div className="meeting-grid">
        {joinedTeams.map((t) => (
          <button key={t.teamCode} className="meeting-card" onClick={() => navigate(`/t/${t.teamCode}`)}>
            <div className="meeting-card-dest">
              {t.destinationName ? `📍 ${t.destinationName}` : `🔑 방 코드 ${t.teamCode}`}
            </div>
            {t.meetingTime && <div className="meeting-card-time">⏰ {formatMeetingTime(t.meetingTime)}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
