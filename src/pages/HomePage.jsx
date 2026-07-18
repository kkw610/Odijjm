import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo.jsx";

export default function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function handleJoinSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    navigate(`/t/${trimmed}`);
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="hero-cluster">
          <span className="hero-cluster-item hero-cluster-runner">🏃</span>
          <span className="hero-cluster-item hero-cluster-clock">⏰</span>
          <span className="hero-cluster-item hero-cluster-turtle">🐢</span>
        </div>
        <BrandLogo />
        <p className="tagline">
          약속 시간 지나면 "지금 어디야?" 버튼 누르고
          <br />
          지각 결과 카드로 놀림받자
        </p>

        <div className="panel">
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/create")}>
            🎉 모임 만들기
          </button>

          <div className="divider-or">또는</div>

          <form onSubmit={handleJoinSubmit} className="field">
            <label htmlFor="roomCode">방 코드로 참여하기</label>
            <input
              id="roomCode"
              placeholder="예: 7XQK2M"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn btn-secondary" type="submit" disabled={!code.trim()}>
              참여하기 →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
