import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo.jsx";
import JoinedRoomsList from "../components/JoinedRoomsList.jsx";

export default function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    navigate(`/t/${trimmed}`);
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <BrandLogo />
        <div className="panel">
          <h2>방 코드로 참여하기</h2>
          <form onSubmit={handleSubmit} className="field">
            <label htmlFor="roomCode">친구가 알려준 6자리 코드를 입력하세요</label>
            <input
              id="roomCode"
              placeholder="예: 7XQK2M"
              value={code}
              maxLength={6}
              autoFocus
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn btn-primary" type="submit" disabled={!code.trim()}>
              참여하기 →
            </button>
          </form>
          <Link to="/" className="link-back">
            ← 처음으로
          </Link>
        </div>

        <JoinedRoomsList />
      </div>
    </div>
  );
}
