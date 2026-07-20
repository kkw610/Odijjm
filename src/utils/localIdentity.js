const KEY_PREFIX = "odijjm:nickname:";
const JOINED_TEAMS_KEY = "odijjm:joinedTeams";
const MAX_JOINED_TEAMS = 30;

// uid는 Firebase 익명 인증 세션이 담당하므로, 로컬에는 팀별 닉네임만 캐싱해서
// 같은 팀에서 새 모임이 열려도 닉네임을 다시 묻지 않도록 한다.
export function saveMyNickname(teamCode, nickname) {
  localStorage.setItem(KEY_PREFIX + teamCode, nickname);
}

export function getMyNickname(teamCode) {
  return localStorage.getItem(KEY_PREFIX + teamCode);
}

export function clearMyNickname(teamCode) {
  localStorage.removeItem(KEY_PREFIX + teamCode);
}

// 이 기기가 들어가 본 방(팀)들을 로컬에 기억해둔다. 팀은 여러 개 만들거나 참여할 수 있는데
// (친구 그룹마다 하나씩) 방 코드/링크를 따로 안 적어둬도 홈 화면에서 바로 다시 찾아갈 수 있게 하기 위함.
export function getJoinedTeams() {
  try {
    const raw = localStorage.getItem(JOINED_TEAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordVisitedTeam(teamCode, meta = {}) {
  const list = getJoinedTeams();
  const idx = list.findIndex((t) => t.teamCode === teamCode);
  const entry = { ...(idx >= 0 ? list[idx] : {}), ...meta, teamCode, visitedAt: Date.now() };
  if (idx >= 0) list.splice(idx, 1);
  list.unshift(entry);
  localStorage.setItem(JOINED_TEAMS_KEY, JSON.stringify(list.slice(0, MAX_JOINED_TEAMS)));
}

export function removeJoinedTeam(teamCode) {
  const list = getJoinedTeams().filter((t) => t.teamCode !== teamCode);
  localStorage.setItem(JOINED_TEAMS_KEY, JSON.stringify(list));
}
