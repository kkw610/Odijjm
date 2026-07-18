import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { generateRoomCode } from "../utils/roomCode";
import { haversineDistanceMeters, estimateEtaMinutes, statusFromDistance, computeLateMinutes } from "../utils/geo";

const MAX_CODE_ATTEMPTS = 10;

function teamRef(teamCode) {
  return doc(db, "teams", teamCode);
}

function meetingsRef(teamCode) {
  return collection(db, "teams", teamCode, "meetings");
}

function participantsRef(teamCode, meetingId) {
  return collection(db, "teams", teamCode, "meetings", meetingId, "participants");
}

function participantRef(teamCode, meetingId, uid) {
  return doc(db, "teams", teamCode, "meetings", meetingId, "participants", uid);
}

// ---------- team + meeting ----------

export async function createTeamWithMeeting(uid, { destinationName, destinationLat, destinationLng, meetingTime }) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const teamCode = generateRoomCode();
    const ref = teamRef(teamCode);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;

    await setDoc(ref, { createdAt: serverTimestamp(), creatorUid: uid });
    const meetingId = await createMeeting(teamCode, {
      destinationName,
      destinationLat,
      destinationLng,
      meetingTime,
    });
    return { teamCode, meetingId };
  }
  throw new Error("방 코드 생성에 실패했어요. 다시 시도해주세요.");
}

export async function createMeeting(teamCode, { destinationName, destinationLat, destinationLng, meetingTime }) {
  const ref = doc(meetingsRef(teamCode));
  await setDoc(ref, {
    destinationName,
    destinationLat,
    destinationLng,
    meetingTime,
    createdAt: serverTimestamp(),
    memberUids: [], // 참여(join)한 사람의 uid만 쌓인다 — 팀 허브 목록을 "내가 속한 모임"으로 좁히는 데 쓴다
  });
  return ref.id;
}

export async function getTeam(teamCode) {
  const snap = await getDoc(teamRef(teamCode));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// 팀 삭제 — 생성자만 가능. 팀 안의 모든 모임 + 참여자 기록까지 함께 지운다.
export async function deleteTeam(teamCode, uid) {
  const team = await getTeam(teamCode);
  if (!team) throw new Error("팀을 찾을 수 없어요.");
  if (team.creatorUid !== uid) throw new Error("팀을 만든 사람만 삭제할 수 있어요.");

  const meetingsSnap = await getDocs(meetingsRef(teamCode));
  const batch = writeBatch(db);

  for (const meetingDoc of meetingsSnap.docs) {
    const participantsSnap = await getDocs(participantsRef(teamCode, meetingDoc.id));
    participantsSnap.docs.forEach((p) => batch.delete(p.ref));
    batch.delete(meetingDoc.ref);
  }
  batch.delete(teamRef(teamCode));

  await batch.commit();
}

// 팀 나가기 — 내가 속한 모든 모임에서 내 참여 기록을 지우고 멤버 목록에서도 빠진다.
// (초대받은 사람용. 생성자는 팀 삭제를 쓴다.)
export async function leaveTeam(teamCode, uid) {
  const q = query(meetingsRef(teamCode), where("memberUids", "array-contains", uid));
  const meetingsSnap = await getDocs(q);
  const batch = writeBatch(db);

  meetingsSnap.docs.forEach((meetingDoc) => {
    batch.update(meetingDoc.ref, { memberUids: arrayRemove(uid) });
    batch.delete(participantRef(teamCode, meetingDoc.id, uid));
  });

  await batch.commit();
}

// 특정 모임 하나만 실시간 구독 (공유 링크로 바로 들어가는 모임 화면용)
export function subscribeToMeeting(teamCode, meetingId, callback) {
  return onSnapshot(doc(meetingsRef(teamCode), meetingId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// 팀 허브 = "내가 참여한 모임" 목록만 실시간 구독한다 (전체 모임이 아니라).
// 방 코드를 안다고 해서 초대받지 않은 다른 모임까지 목록에서 보이지 않도록 하기 위함.
export function subscribeToMeetings(teamCode, uid, callback) {
  const q = query(meetingsRef(teamCode), where("memberUids", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    const meetings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    meetings.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    callback(meetings);
  });
}

// 방 코드만 받고 아직 어느 모임에도 참여한 적 없는 신규 초대자를 위한 진입점.
// 과거 모임 전체를 훑어볼 순 없게(위 subscribeToMeetings) 막았지만, "지금 잡힌 모임"
// 하나는 방 코드만으로도 찾아서 들어올 수 있어야 방 코드 초대 자체가 의미가 있다.
export async function getLatestMeeting(teamCode) {
  const q = query(meetingsRef(teamCode), orderBy("createdAt", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ---------- participants ----------

export async function joinMeeting(teamCode, meetingId, uid, nickname) {
  const ref = participantRef(teamCode, meetingId, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    // 이미 이 모임에 참여한 적 있으면 체크인 상태는 건드리지 않고 닉네임만 최신화
    await updateDoc(ref, { nickname });
  } else {
    await setDoc(ref, {
      uid,
      nickname,
      lastCheckIn: null,
      status: "not_checked_in",
      joinedAt: serverTimestamp(),
    });
  }
  // 이 모임을 "내가 속한 모임" 목록(팀 허브)에 올린다.
  // 이미 멤버면 그대로 둔다 — arrayUnion은 중복을 안 넣지만, 크기가 안 바뀌는 업데이트 요청 자체가
  // 보안 규칙의 "정확히 +1" 조건과 안 맞아 불필요한 permission-denied를 일으키기 때문에 아예 건너뛴다.
  const meetingRef = doc(meetingsRef(teamCode), meetingId);
  const meetingSnap = await getDoc(meetingRef);
  const alreadyMember = meetingSnap.exists() && (meetingSnap.data().memberUids || []).includes(uid);
  if (!alreadyMember) {
    await updateDoc(meetingRef, { memberUids: arrayUnion(uid) });
  }
}

export function subscribeToParticipants(teamCode, meetingId, callback) {
  return onSnapshot(participantsRef(teamCode, meetingId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function checkIn(teamCode, meetingId, uid, { lat, lng, destinationLat, destinationLng }) {
  const ref = participantRef(teamCode, meetingId, uid);

  // 이미 "도착"으로 확정된 사람은 나중에 몇 번을 다시 눌러도(예: 친구 위치를 보려고) 기록이 바뀌지 않는다.
  // 지각 여부는 최초로 도착 반경 안에 들어온 시점 하나로 영구히 고정한다.
  const existingSnap = await getDoc(ref);
  const existing = existingSnap.exists() ? existingSnap.data() : null;
  if (existing?.status === "arrived") {
    return { lastCheckIn: existing.lastCheckIn, status: existing.status };
  }

  const distanceMeters = haversineDistanceMeters(lat, lng, destinationLat, destinationLng);
  const etaMinutes = estimateEtaMinutes(distanceMeters);
  const status = statusFromDistance(distanceMeters);
  const lastCheckIn = {
    lat,
    lng,
    distanceMeters,
    etaMinutes,
    checkedAt: new Date().toISOString(),
  };

  await updateDoc(ref, { lastCheckIn, status });

  return { lastCheckIn, status };
}

// ---------- monthly ranking ----------

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// 랭킹도 팀 전체가 아니라 "내가 초대받아 속한 모임"만으로 집계한다.
// (array-contains + createdAt 범위를 같이 쓰면 복합 색인이 필요해지므로 월 범위는 클라이언트에서 거른다)
export async function getMonthlyRanking(teamCode, uid) {
  const q = query(meetingsRef(teamCode), where("memberUids", "array-contains", uid));
  const meetingsSnap = await getDocs(q);
  const monthStartMs = startOfMonth().getTime();
  const meetings = meetingsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => (m.createdAt?.toMillis?.() ?? 0) >= monthStartMs);

  const byUid = new Map();

  for (const meeting of meetings) {
    const participantsSnap = await getDocs(participantsRef(teamCode, meeting.id));

    for (const pDoc of participantsSnap.docs) {
      const p = pDoc.data();
      if (!p.lastCheckIn) continue;

      const lateMinutes = computeLateMinutes(p.lastCheckIn.checkedAt, meeting.meetingTime);

      const entry = byUid.get(p.uid) || {
        uid: p.uid,
        nickname: p.nickname,
        meetingsCount: 0,
        lateCount: 0,
        onTimeCount: 0,
        totalLateMinutes: 0,
      };

      entry.nickname = p.nickname;
      entry.meetingsCount += 1;
      if (lateMinutes > 0) {
        entry.lateCount += 1;
        entry.totalLateMinutes += lateMinutes;
      } else {
        entry.onTimeCount += 1;
      }

      byUid.set(p.uid, entry);
    }
  }

  return [...byUid.values()].sort((a, b) => b.totalLateMinutes - a.totalLateMinutes);
}
