# Odijjm (어디쯤)

지각러 퇴치 서비스 '어디쯤' — 약속 시간 지나면 "지금 어디야?" 버튼 누르고, 위치 기반으로 지각 결과 카드를 만들어 공유하는 웹 서비스.

전체 기획/스펙은 [CLAUDE.md](./CLAUDE.md) 참고.

## 기술 스택

- React 19 + Vite (JS)
- Firebase Firestore (실시간 스코어보드) + Firebase Anonymous Auth (회원가입 없는 로그인)
- 카카오맵 JS SDK (실시간 위치 지도 + 결과 카드 미니맵, 선택 사항 — 한국 지도 정확도 때문에 Google 대신 채택)
- 브라우저 Geolocation API
- html-to-image (결과 카드 → PNG 캡처)
- react-router-dom

## 시작하기

### 1. Firebase 프로젝트 준비

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트 생성
2. Firestore Database 생성 (프로덕션 모드로 시작해도 무방 — 규칙은 아래에서 배포)
3. **Authentication > Sign-in method 에서 "익명(Anonymous)" 로그인을 켠다.** (필수 — 꺼져있으면 접속 즉시 로그인 에러 화면이 뜬다)
4. 웹 앱 등록 후 발급되는 설정값을 `.env.local`에 채워넣기 (`.env.example` 참고)

```bash
cp .env.example .env.local
# .env.local을 열어 VITE_FIREBASE_* 값을 채운다
```

5. Firestore 보안 규칙 배포 (Firebase CLI 필요: `npm i -g firebase-tools`)

```bash
firebase login
firebase use --add   # 위에서 만든 프로젝트 선택
firebase deploy --only firestore:rules
```

규칙 파일은 [firestore.rules](./firestore.rules) — 로그인은 필요하지만(익명 인증) 회원가입은 없다. 방 코드를 아는 사람은 누구나 읽을 수 있고, 본인 uid로만 자기 체크인을 쓸 수 있게 제한되어 있다.

### 1-1. (선택) 카카오맵 — 실시간 위치 지도 + 결과 카드 미니맵

키를 설정하면 두 가지가 추가로 켜진다. 설정하지 않으면 각각 자동으로 안내 문구/이모지로 폴백하므로 **없어도 앱은 완전히 동작한다.**

- 모임 화면에 참여자 실시간 위치를 보여주는 지도 (`LiveMap` 컴포넌트) — 키가 없으면 안내 문구만 표시
- 결과 카드 안에 내 위치·목적지가 표시된 작은 지도 — 키가 없으면 이모지로 대체

거리/도착시간 계산은 이 키와 무관하게 항상 하버사인 직선거리를 쓴다 (카카오는 도보 길찾기 API를 안정적으로 제공하지 않고, Google Directions는 결제 카드 등록이 필요해 제외했다).

**왜 카카오맵인가**: 한국 내에서는 Google Maps가 정부 정책상 정밀 지도 데이터 반출에 제약이 있어 도로/장소 정보가 카카오맵보다 부정확하다. 카카오맵은 결제 카드 등록 없이 무료로 JS 키를 받을 수 있다는 장점도 있다.

1. [Kakao Developers](https://developers.kakao.com)에 가입 후 "내 애플리케이션 > 애플리케이션 추가하기"
2. **"제품 설정 > 카카오맵"에서 카카오맵 제품 자체를 활성화(ON)한다.** JS 키 발급만으로는 자동으로 켜지지 않는다 — 안 켜면 지도 요청이 `disabled OPEN_MAP_AND_LOCAL service` 에러로 거부된다
3. 앱 키 중 **JavaScript 키**를 복사 (REST API 키 아님 — 브라우저에서 지도를 그리는 용도)
4. **"앱 설정 > 플랫폼 > Web" 안의 "JavaScript 키" 섹션에 있는 "JavaScript SDK 도메인"**에 사용할 도메인을 등록 (예: `http://localhost:5173`, 실제 배포 도메인). 콘솔 상단의 일반 "웹 도메인" 등록 화면과는 **다른 곳**이니 헷갈리지 말 것 — 여기가 흔한 실수 포인트다
5. `.env.local`에 `VITE_KAKAO_MAP_API_KEY` 채우기

실제 키로 위 과정과 지도 렌더링·다운로드까지 전부 검증 완료했다. 지도 타일은 CORS 헤더가 없어서 결과 카드를 PNG로 저장할 때 지도가 그대로 찍히지는 않지만(전체 다운로드가 깨지는 대신) 그 자리에 이모지로 자동 대체되도록 처리해뒀다 — 화면에서는 실시간 지도가 보이고, 다운로드한 카드에는 이모지 버전이 저장된다.

### 1-2. (선택) 실제 Firebase 프로젝트 없이 에뮬레이터로 개발하기

Firebase 프로젝트를 아직 안 만들었어도 Firestore + Auth 에뮬레이터로 전체 플로우(모임 생성/참여/체크인/스코어보드/랭킹/카드)를 테스트할 수 있다. (이 방법으로 실제 검증을 마쳤다.)

```bash
npx firebase-tools emulators:start --only firestore,auth   # 127.0.0.1:8080, 127.0.0.1:9099

# 다른 터미널에서
echo "VITE_USE_FIREBASE_EMULATORS=true" >> .env.local
npm run dev
```

### 2. 로컬 개발 (Node 직접 실행)

```bash
npm install
npm run dev
```

`http://localhost:5173` 접속. 모바일 실기기로 테스트하려면 같은 와이파이에서 `npm run dev -- --host`로 열고 PC의 로컬 IP로 접속 (Geolocation은 HTTPS 또는 localhost에서만 동작하므로, 실기기 테스트 시 `localhost` 접속이 아니면 별도 터널링(ngrok 등)이나 HTTPS 배포본에서 확인할 것).

### 3. 로컬 개발 (Docker)

```bash
docker compose up dev
```

`.env.local`이 자동으로 컨테이너에 주입된다. 소스 변경 시 핫 리로드.

### 4. 프로덕션 빌드 미리보기 (Docker + nginx)

```bash
# 프로젝트 루트에 .env 파일을 만들고 VITE_FIREBASE_*, VITE_KAKAO_MAP_API_KEY 값을 채운 뒤:
docker compose build web
docker compose up web
```

`http://localhost:8081` 접속. (`web` 서비스는 빌드 시점에 `VITE_*` 값을 이미지에 심으므로, `.env` 파일 또는 쉘 환경변수로 값을 넘겨야 한다.)

### 5. 배포

기획 문서 기준 권장 배포처는 Vercel/Netlify (정적 빌드 + 빠른 배포). `npm run build` 결과물(`dist/`)을 그대로 올리면 된다. Firebase Hosting을 쓰고 싶다면 `firebase deploy --only hosting`도 가능 (`firebase.json` 포함되어 있음).

## 데이터 모델

같은 방 코드로 모임을 반복해서 열 수 있도록 "팀(Team)"과 "모임(Meeting)"을 분리했다.

```
teams/{teamCode}
  createdAt

teams/{teamCode}/meetings/{meetingId}
  destinationName, destinationLat, destinationLng, meetingTime, createdAt

teams/{teamCode}/meetings/{meetingId}/participants/{uid}   ← 문서 ID가 uid
  uid, nickname, lastCheckIn, status, joinedAt
```

참여자 문서 ID를 익명 인증 uid로 고정해서, 같은 팀에 새 모임이 열려도 닉네임을 다시 묻지 않고 자동 참여시키고(`TeamPage.jsx`의 자동 참여 로직), 랭킹도 닉네임 문자열이 아니라 uid 기준으로 정확히 집계한다.

## 라우트

| 경로 | 설명 |
|---|---|
| `/` | 홈 (모임 만들기 / 코드로 참여) |
| `/create` | 새 팀 + 첫 모임 생성 |
| `/t/:teamCode` | 팀 홈 — 최신 모임 스코어보드 + 체크인 |
| `/t/:teamCode/new-meeting` | 같은 팀으로 새 모임 잡기 |
| `/t/:teamCode/ranking` | 이번 달 지각왕 랭킹 |

## 프로젝트 구조

```
src/
  components/     # ResultCard, ResultCardModal, LiveMap
  pages/          # HomePage, CreateGroupPage, NewMeetingPage, JoinPage, TeamPage, RankingPage
  services/       # teamService.js (Firestore 데이터 계층), mapsService.js (카카오맵 JS SDK 로더)
  hooks/          # useAuth.js (익명 로그인 상태)
  utils/          # geo.js, roomCode.js, resultCopy.js (지각 정도별 문구+테마 컬러), localIdentity.js
  firebase.js     # Firebase 초기화 + 익명 로그인
```

## 구현 범위

### Must Have
- [x] 모임 생성 (약속 시간/장소/방 코드)
- [x] 방 코드로 참여 (닉네임 입력, 회원가입 없음 — 익명 인증으로 처리)
- [x] "지금 어디야?" 버튼 → 1회 위치 fetch → 거리/예상 도착 시간 계산
- [x] 실시간 스코어보드 (Firestore onSnapshot)
- [x] 결과 카드 자동 생성 + PNG 다운로드 (지각 정도별 6가지 컬러 테마, 도착 순위/지도 썸네일 포함)

### Should Have
- [x] 결과 카드 랜덤 문구/이모지 (지각 정도별 톤 분기, `src/utils/resultCopy.js`)
- [x] 체크인 쿨타임 (5분에 1회, `CHECKIN_COOLDOWN_MS` in `TeamPage.jsx`)
- [x] 위치 권한 거부 시 안내 UI + 재시도
- [x] PWA (manifest.json, 서비스워커, 홈 화면 아이콘) — `public/manifest.json`, `public/sw.js`

### Could Have
- [x] 그룹별 누적 랭킹 (이번 달 지각왕, `getMonthlyRanking` in `teamService.js`) — 스트릭(연속 기록)은 스코프 제외
- [x] 지도 API 연동 — 실시간 위치 지도 + 결과 카드 미니맵 (카카오맵, `mapsService.js` / `LiveMap.jsx`) — 실 API 키로 렌더링·다운로드까지 검증 완료. 거리 계산 자체는 계속 하버사인 직선거리
- [x] 로그인/계정 시스템 (Firebase Anonymous Auth) — 가입 폼 없이 방문 즉시 로그인, uid로 랭킹/체크인 소유권 관리
