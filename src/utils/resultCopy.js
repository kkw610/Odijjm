function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ON_TIME = {
  emoji: "👑",
  theme: "gold",
  headlines: ["칼도착 레전드", "시간 약속의 신 ⏰", "지각? 그게 뭔데 먹는 거임"],
  captions: [
    "오늘의 MVP는 바로 너",
    "친구들 다 놀랐잖아",
    "이 정도면 알람 안 맞춰도 되겠다",
  ],
};

const SLIGHT_LATE = {
  emoji: "🏃",
  theme: "coral",
  headlines: (n) => [
    `오늘도 헐레벌떡 🏃💨 ${n}분 지각!`,
    `아깝다 딱 ${n}분 차이`,
    `거의 다 왔었는데 ${n}분 늦참`,
  ],
  captions: [
    "그래도 이 정도면 양호한 편",
    "다음엔 진짜 칼도착 가능?",
    "친구들이 눈치 못 챘을 수도",
  ],
};

const LATE = {
  emoji: "😅",
  theme: "magenta",
  headlines: (n) => [
    `${n}분 지각... 변명 준비 완료 😅`,
    "약속시간은 참고사항이었나 봐",
    "슬슬 눈치 보이는 타이밍",
  ],
  captions: ["오늘 커피는 네가 사는 걸로", "그래도 왔다는 게 중요하지", "다음 모임 벌칙 각"],
};

const VERY_LATE = {
  emoji: "🐢",
  theme: "midnight",
  headlines: (n) => [
    `${n}분 지각... 이건 실화냐 🐢`,
    "지각왕 등극 👑💀",
    "약속을 소설로 쓴 사람",
  ],
  captions: ["오늘의 벌칙자 확정", "다음부턴 1시간 일찍 부를게", "전설의 지각... 박제 완료"],
};

const EN_ROUTE_EARLY = {
  emoji: "🚶",
  theme: "sky",
  headlines: ["부지런 그 자체 🚶", "여유롭게 이동 중", "일찍 출발한 사람 티내는 중"],
  captions: ["아직 시간 넉넉함", "이대로만 가면 칼도착 각", "천천히 와도 됨"],
};

const EN_ROUTE_LATE = {
  emoji: "💦",
  theme: "ember",
  headlines: ["지각 확정, 그래도 가는 중 🏃‍♂️💦", "숨차게 뛰는 중...", "이미 늦었지만 포기는 없다"],
  captions: ["도착하면 바로 카드 갱신 가능", "친구들이 기다리는 중", "택시 타는 걸 추천함"],
};

function resolveHeadline(bucket, n) {
  const list = typeof bucket.headlines === "function" ? bucket.headlines(n) : bucket.headlines;
  return pick(list);
}

export function buildResultContent({ status, lateMinutes, distanceMeters, etaMinutes }) {
  let bucket;

  if (status === "arrived") {
    if (lateMinutes <= 0) bucket = ON_TIME;
    else if (lateMinutes <= 5) bucket = SLIGHT_LATE;
    else if (lateMinutes <= 15) bucket = LATE;
    else bucket = VERY_LATE;
  } else {
    bucket = lateMinutes <= 0 ? EN_ROUTE_EARLY : EN_ROUTE_LATE;
  }

  const headline = resolveHeadline(bucket, Math.max(lateMinutes, 0));
  const caption = pick(bucket.captions);

  // 스탯 박스에 짧게 들어갈 값/라벨 (긴 문장을 넣으면 박스 밖으로 넘침)
  let resultValue;
  let resultLabel;
  if (status === "arrived") {
    resultValue = lateMinutes <= 0 ? "정시" : `${lateMinutes}분`;
    resultLabel = lateMinutes <= 0 ? "도착 완료" : "지각 도착";
  } else {
    resultValue = lateMinutes <= 0 ? "이동중" : `${lateMinutes}분`;
    resultLabel = lateMinutes <= 0 ? "여유 있음" : "지각 중";
  }

  return {
    emoji: bucket.emoji,
    theme: bucket.theme,
    headline,
    caption,
    resultValue,
    resultLabel,
    distanceKm: (distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1),
    etaMinutes,
  };
}
