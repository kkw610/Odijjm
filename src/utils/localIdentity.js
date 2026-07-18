const KEY_PREFIX = "odijjm:nickname:";

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
