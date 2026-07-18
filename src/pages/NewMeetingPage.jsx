import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createMeeting, joinMeeting } from "../services/teamService";
import { getMyNickname, saveMyNickname } from "../utils/localIdentity";
import BrandLogo from "../components/BrandLogo.jsx";
import DestinationPicker from "../components/DestinationPicker.jsx";

function defaultMeetingTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  now.setSeconds(0, 0);
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function NewMeetingPage({ uid }) {
  const { teamCode } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(() => getMyNickname(teamCode) || "");
  const [destinationName, setDestinationName] = useState("");
  const [meetingTime, setMeetingTime] = useState(defaultMeetingTime());
  const [coords, setCoords] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handlePick({ lat, lng, name }) {
    setCoords({ lat, lng });
    setDestinationName((prev) => (prev.trim() ? prev : name || prev));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!nickname.trim() || !destinationName.trim() || !meetingTime || !coords) {
      setError("모든 항목을 채워주세요 (목적지 위치 설정 포함)");
      return;
    }

    setSubmitting(true);
    try {
      const meetingId = await createMeeting(teamCode, {
        destinationName: destinationName.trim(),
        destinationLat: coords.lat,
        destinationLng: coords.lng,
        meetingTime: new Date(meetingTime).toISOString(),
      });
      await joinMeeting(teamCode, meetingId, uid, nickname.trim());
      saveMyNickname(teamCode, nickname.trim());
      navigate(`/t/${teamCode}/m/${meetingId}`);
    } catch (err) {
      setError(err.message || "모임 생성에 실패했어요. 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <BrandLogo />

        <form className="panel" onSubmit={handleSubmit}>
          <h2>➕ 새 모임 잡기</h2>
          <p className="field-hint">방 코드 {teamCode} 팀에 새 모임을 추가해요. 랭킹은 계속 쌓여요.</p>

          <div className="field">
            <label htmlFor="nickname">내 닉네임</label>
            <input
              id="nickname"
              placeholder="예: 항상늦는애"
              value={nickname}
              maxLength={12}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="destinationName">약속 장소 이름</label>
            <input
              id="destinationName"
              placeholder="예: 강남역 11번 출구"
              value={destinationName}
              maxLength={30}
              onChange={(e) => setDestinationName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="meetingTime">약속 시간</label>
            <input
              id="meetingTime"
              type="datetime-local"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </div>

          <div className="field">
            <label>목적지 위치</label>
            <DestinationPicker coords={coords} onPick={handlePick} />
          </div>

          {error && <p className="field-error">{error}</p>}

          <button className="btn btn-primary btn-lg" type="submit" disabled={submitting}>
            {submitting ? "만드는 중..." : "새 모임 만들기 →"}
          </button>

          <Link to={`/t/${teamCode}`} className="link-back">
            ← 돌아가기
          </Link>
        </form>
      </div>
    </div>
  );
}
