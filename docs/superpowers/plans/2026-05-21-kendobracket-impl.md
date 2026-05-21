# KendoBracket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검도 대회 대진표 운영 시스템 — 관리자 화면(개인전+단체전 브라켓 관리)과 전광판 화면(localStorage 실시간 동기화)을 구축한다.

**Architecture:** `STATE` 객체 변경 → `saveState()` → `renderAll()` 패턴의 렌더 함수 기반 vanilla JS. `src/bracket-engine.js`와 `src/scoring.js`는 순수 함수로 작성하여 Jest로 유닛 테스트. ES 모듈(`<script type="module">`)로 파일 분리, Babel로 Jest 트랜스파일.

**Tech Stack:** HTML5, CSS3, Vanilla JS (ES6+ modules), Jest 29, Babel 7, HTML5 Drag and Drop API, SVG, localStorage

---

## 파일 구조

```
KendoBracket/
├── index.html              # 관리자 화면
├── display.html            # 전광판 화면
├── style.css               # 공통 + 화면별 스타일
├── app.js                  # 진입점 (initAdmin / initDisplay 분기)
├── src/
│   ├── state.js            # STATE 정의 + saveState() + loadState()
│   ├── bracket-engine.js   # 브라켓 생성 알고리즘 (pure functions)
│   ├── scoring.js          # 승패 계산 (pure functions)
│   ├── svg-bracket.js      # SVG 브라켓 렌더링
│   ├── admin-ui.js         # 관리자 UI 렌더 함수 전체
│   ├── match-modal.js      # 경기 결과 입력 모달
│   └── display-ui.js       # 전광판 렌더 함수 전체
├── package.json
├── babel.config.cjs
└── tests/
    ├── bracket-engine.test.js
    └── scoring.test.js
```

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `package.json`
- Create: `babel.config.cjs`
- Create: `src/state.js`
- Create: `src/bracket-engine.js`
- Create: `src/scoring.js`
- Create: `src/svg-bracket.js`
- Create: `src/admin-ui.js`
- Create: `src/match-modal.js`
- Create: `src/display-ui.js`
- Create: `app.js`
- Create: `tests/bracket-engine.test.js`
- Create: `tests/scoring.test.js`

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "kendobracket",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/.bin/jest --no-coverage",
    "test:watch": "node --experimental-vm-modules node_modules/.bin/jest --watch"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@babel/preset-env": "^7.24.0",
    "babel-jest": "^29.7.0",
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 2: babel.config.cjs 생성**

```js
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
```

- [ ] **Step 3: 의존성 설치**

```bash
cd C:/dev/BracketDo
npm install
```

Expected output: `node_modules/` 생성, `package-lock.json` 생성

- [ ] **Step 4: 빈 소스 파일 생성**

각 파일을 빈 상태로 생성 (이후 태스크에서 채움):
- `src/state.js` → `export {};`
- `src/bracket-engine.js` → `export {};`
- `src/scoring.js` → `export {};`
- `src/svg-bracket.js` → `export {};`
- `src/admin-ui.js` → `export {};`
- `src/match-modal.js` → `export {};`
- `src/display-ui.js` → `export {};`
- `app.js` → 빈 파일
- `tests/bracket-engine.test.js` → 빈 파일
- `tests/scoring.test.js` → 빈 파일

- [ ] **Step 5: Jest 동작 확인**

```bash
npm test
```

Expected: `Test Suites: 0 passed` (테스트 파일에 테스트 없으므로 통과)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json babel.config.cjs src/ app.js tests/
git commit -m "chore: project scaffolding with Jest + Babel"
```

---

## Task 2: STATE 모듈

**Files:**
- Modify: `src/state.js`

- [ ] **Step 1: state.js 구현**

```js
// src/state.js

export const EMPTY_DIVISION = () => ({
  name: '',
  type: 'individual',   // 'individual' | 'team'
  teamSize: 5,
  positions: ['선봉', '차봉', '중견', '부장', '대장'],
  players: [],
  teams: [],
  bracket: { rounds: [] },
});

export const INITIAL_STATE = {
  meta: { title: '', updatedAt: 0 },
  activeDivision: 0,
  divisions: [],
  display: {
    mode: 'bracket',        // 'current' | 'bracket' | 'result'
    currentMatchId: null,
    autoSlide: false,
    slideInterval: 10000,
  },
};

let _state = JSON.parse(JSON.stringify(INITIAL_STATE));
let _renderAll = null;

export function setRenderCallback(fn) {
  _renderAll = fn;
}

export function getState() {
  return _state;
}

export function getActiveDivision() {
  return _state.divisions[_state.activeDivision] ?? null;
}

export function loadState() {
  const raw = localStorage.getItem('kendo_state');
  if (raw) {
    try { _state = JSON.parse(raw); } catch (_) {}
  }
  return _state;
}

export function saveState() {
  _state.meta.updatedAt = Date.now();
  const json = JSON.stringify(_state);
  localStorage.setItem('kendo_state', json);
  // 같은 탭에서도 storage 이벤트 발화 (전광판 탭 동기화용)
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'kendo_state',
      newValue: json,
      storageArea: localStorage,
    }));
  } catch (_) {}
}

export function updateState(updaterFn) {
  updaterFn(_state);
  saveState();
  if (_renderAll) _renderAll();
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/state.js
git commit -m "feat: STATE module with save/load/update"
```

---

## Task 3: 브라켓 엔진 (TDD)

**Files:**
- Modify: `src/bracket-engine.js`
- Modify: `tests/bracket-engine.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// tests/bracket-engine.test.js
import {
  nextPowerOfTwo,
  generateBracket,
  advanceWinner,
} from '../src/bracket-engine.js';

describe('nextPowerOfTwo', () => {
  test('이미 2의 제곱수이면 그대로 반환', () => {
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(4)).toBe(4);
  });
  test('2의 제곱수가 아니면 올림', () => {
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(1)).toBe(2);
  });
});

describe('generateBracket', () => {
  const makeParticipants = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `선수${i + 1}`, club: '' }));

  test('4명 → 1라운드 2경기, BYE 없음', () => {
    const bracket = generateBracket(makeParticipants(4));
    expect(bracket.rounds).toHaveLength(2); // 준결승 + 결승
    expect(bracket.rounds[0].matches).toHaveLength(2);
    const byes = bracket.rounds[0].matches.filter(m => m.player1 === 'bye' || m.player2 === 'bye');
    expect(byes).toHaveLength(0);
  });

  test('3명 → 1라운드 2경기, BYE 1개', () => {
    const bracket = generateBracket(makeParticipants(3));
    expect(bracket.rounds[0].matches).toHaveLength(2);
    const byeSlots = bracket.rounds[0].matches.flatMap(m =>
      [m.player1, m.player2].filter(p => p === 'bye')
    );
    expect(byeSlots).toHaveLength(1);
  });

  test('모든 경기 status는 pending으로 초기화', () => {
    const bracket = generateBracket(makeParticipants(4));
    bracket.rounds[0].matches.forEach(m => expect(m.status).toBe('pending'));
  });

  test('2명 → 결승 1경기만', () => {
    const bracket = generateBracket(makeParticipants(2));
    expect(bracket.rounds).toHaveLength(1);
    expect(bracket.rounds[0].matches).toHaveLength(1);
  });
});

describe('advanceWinner', () => {
  test('1라운드 첫 경기 승자가 2라운드 첫 경기 player1으로 이동', () => {
    const makeP = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `선수${i + 1}`, club: '' }));
    const bracket = generateBracket(makeP(4));
    const m0 = bracket.rounds[0].matches[0];
    const updated = advanceWinner(bracket, m0.id, m0.player1);
    const nextMatch = updated.rounds[1].matches[0];
    expect(nextMatch.player1).toBe(m0.player1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test tests/bracket-engine.test.js
```

Expected: FAIL (함수 미구현)

- [ ] **Step 3: bracket-engine.js 구현**

```js
// src/bracket-engine.js

export function nextPowerOfTwo(n) {
  if (n <= 1) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function makeMatchId() {
  return 'm' + Math.random().toString(36).slice(2, 9);
}

function roundLabel(totalRounds, roundNo) {
  const remaining = totalRounds - roundNo + 1;
  const labels = { 1: '결승', 2: '준결승', 3: '4강' };
  return labels[remaining] ?? `${Math.pow(2, remaining)}강`;
}

export function generateBracket(participants) {
  const n = participants.length;
  if (n < 2) throw new Error('참가자는 최소 2명 이상이어야 합니다.');

  const size = nextPowerOfTwo(n);
  const byeCount = size - n;
  const totalRounds = Math.log2(size);

  // 참가자 복사 + 셔플
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  // BYE 슬롯을 하단에 추가
  const slots = [...shuffled, ...Array(byeCount).fill({ id: 'bye', name: 'BYE', club: '' })];

  // 1라운드 경기 생성
  const firstRoundMatches = [];
  for (let i = 0; i < size / 2; i++) {
    firstRoundMatches.push({
      id: makeMatchId(),
      type: 'individual',
      player1: slots[i * 2].id,
      player2: slots[i * 2 + 1].id,
      score1: 0,
      score2: 0,
      winner: slots[i * 2 + 1].id === 'bye' ? slots[i * 2].id
            : slots[i * 2].id === 'bye' ? slots[i * 2 + 1].id
            : null,
      status: (slots[i * 2].id === 'bye' || slots[i * 2 + 1].id === 'bye') ? 'done' : 'pending',
    });
  }

  const rounds = [{ roundNo: 1, label: roundLabel(totalRounds, 1), matches: firstRoundMatches }];

  // 이후 라운드 빈 경기 생성
  for (let r = 2; r <= totalRounds; r++) {
    const matchCount = Math.pow(2, totalRounds - r);
    const matches = Array.from({ length: matchCount }, () => ({
      id: makeMatchId(),
      type: 'individual',
      player1: null,
      player2: null,
      score1: 0,
      score2: 0,
      winner: null,
      status: 'pending',
    }));
    rounds.push({ roundNo: r, label: roundLabel(totalRounds, r), matches });
  }

  // 부전승 자동 진출
  const bracketWithByes = { rounds };
  firstRoundMatches
    .filter(m => m.status === 'done' && m.winner)
    .forEach(m => advanceWinner(bracketWithByes, m.id, m.winner, true));

  return bracketWithByes;
}

export function generateTeamBracket(teams) {
  const teamParticipants = teams.map(t => ({ id: t.id, name: t.name, club: '' }));
  const bracket = generateBracket(teamParticipants);
  // 모든 경기 type을 'team'으로 변경
  bracket.rounds.forEach(r =>
    r.matches.forEach(m => {
      m.type = 'team';
      if (m.player1 !== null) { m.team1 = m.player1; delete m.player1; }
      if (m.player2 !== null) { m.team2 = m.player2; delete m.player2; }
      m.lineup1 = [];
      m.lineup2 = [];
      m.bouts = [];
      m.tiebreaker = null;
      m.wins1 = 0;
      m.wins2 = 0;
    })
  );
  return bracket;
}

// mutate=true이면 bracket을 직접 수정 (내부 전용), false이면 새 객체 반환
export function advanceWinner(bracket, matchId, winnerId, mutate = false) {
  const target = mutate ? bracket : JSON.parse(JSON.stringify(bracket));

  // 승자가 들어갈 다음 경기 슬롯 찾기
  for (let ri = 0; ri < target.rounds.length - 1; ri++) {
    const matches = target.rounds[ri].matches;
    const matchIdx = matches.findIndex(m => m.id === matchId);
    if (matchIdx === -1) continue;

    const nextRound = target.rounds[ri + 1];
    const nextMatchIdx = Math.floor(matchIdx / 2);
    const nextMatch = nextRound.matches[nextMatchIdx];
    const slot = matchIdx % 2 === 0 ? 'player1' : 'player2';
    nextMatch[slot] = winnerId;

    // 단체전이면 team1/team2 필드 사용
    if (nextMatch.type === 'team') {
      const teamSlot = matchIdx % 2 === 0 ? 'team1' : 'team2';
      nextMatch[teamSlot] = winnerId;
      delete nextMatch[slot];
    }
    break;
  }
  return target;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test tests/bracket-engine.test.js
```

Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/bracket-engine.js tests/bracket-engine.test.js
git commit -m "feat: bracket engine with TDD (generateBracket, advanceWinner)"
```

---

## Task 4: 스코어링 엔진 (TDD)

**Files:**
- Modify: `src/scoring.js`
- Modify: `tests/scoring.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// tests/scoring.test.js
import {
  calcIndividualWinner,
  calcTeamBoutWinner,
  calcTeamMatchResult,
} from '../src/scoring.js';

describe('calcIndividualWinner', () => {
  const base = { player1: 'p1', player2: 'p2' };

  test('player1이 높은 점수면 player1 반환', () => {
    expect(calcIndividualWinner({ ...base, score1: 2, score2: 1 })).toBe('p1');
  });
  test('player2가 높은 점수면 player2 반환', () => {
    expect(calcIndividualWinner({ ...base, score1: 0, score2: 2 })).toBe('p2');
  });
  test('동점이면 null 반환', () => {
    expect(calcIndividualWinner({ ...base, score1: 1, score2: 1 })).toBeNull();
  });
});

describe('calcTeamBoutWinner', () => {
  test('팀1 본수 높으면 team1', () => {
    expect(calcTeamBoutWinner({ score1: 2, score2: 0 })).toBe('team1');
  });
  test('팀2 본수 높으면 team2', () => {
    expect(calcTeamBoutWinner({ score1: 0, score2: 1 })).toBe('team2');
  });
  test('동점이면 null', () => {
    expect(calcTeamBoutWinner({ score1: 1, score2: 1 })).toBeNull();
  });
});

describe('calcTeamMatchResult', () => {
  const makeMatch = (bouts) => ({
    team1: 't1', team2: 't2',
    bouts: bouts.map(([s1, s2]) => ({
      score1: s1, score2: s2,
      winner: s1 > s2 ? 'team1' : s2 > s1 ? 'team2' : null,
      status: 'done',
    })),
    tiebreaker: null,
  });

  test('팀1 승수 우세 → team1 승리', () => {
    const result = calcTeamMatchResult(makeMatch([[2,0],[0,1],[2,1],[0,0],[0,0]]));
    expect(result.winner).toBe('t1');
    expect(result.wins1).toBe(2);
    expect(result.wins2).toBe(1);
  });

  test('팀2 승수 우세 → team2 승리', () => {
    const result = calcTeamMatchResult(makeMatch([[0,2],[0,2],[2,0],[0,0],[0,0]]));
    expect(result.winner).toBe('t2');
  });

  test('승수 동점 + 본수 우세 → 본수로 판정', () => {
    // 각 2승 2승 1무, 팀1 본수 7 vs 팀2 본수 5
    const result = calcTeamMatchResult(makeMatch([[2,0],[0,2],[2,0],[0,2],[1,1]]));
    expect(result.winner).toBe('t1');
  });

  test('승수·본수 모두 동점 → tiebreaker 필요', () => {
    const result = calcTeamMatchResult(makeMatch([[2,0],[0,2],[1,1],[0,2],[2,0]]));
    expect(result.winner).toBe('tiebreaker');
  });

  test('미완료 대결 있으면 winner null', () => {
    const match = {
      team1: 't1', team2: 't2',
      bouts: [
        { score1: 2, score2: 0, winner: 'team1', status: 'done' },
        { score1: 0, score2: 0, winner: null, status: 'ongoing' },
      ],
      tiebreaker: null,
    };
    expect(calcTeamMatchResult(match).winner).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test tests/scoring.test.js
```

Expected: FAIL

- [ ] **Step 3: scoring.js 구현**

```js
// src/scoring.js

export function calcIndividualWinner(match) {
  if (match.score1 > match.score2) return match.player1;
  if (match.score2 > match.score1) return match.player2;
  return null;
}

export function calcTeamBoutWinner(bout) {
  if (bout.score1 > bout.score2) return 'team1';
  if (bout.score2 > bout.score1) return 'team2';
  return null;
}

export function calcTeamMatchResult(match) {
  const allDone = match.bouts.every(b => b.status === 'done');
  if (!allDone) return { winner: null, wins1: 0, wins2: 0 };

  const wins1 = match.bouts.filter(b => b.winner === 'team1').length;
  const wins2 = match.bouts.filter(b => b.winner === 'team2').length;
  const totalScore1 = match.bouts.reduce((s, b) => s + b.score1, 0);
  const totalScore2 = match.bouts.reduce((s, b) => s + b.score2, 0);

  if (wins1 > wins2) return { winner: match.team1, wins1, wins2 };
  if (wins2 > wins1) return { winner: match.team2, wins1, wins2 };

  // 승수 동점 → 본수 비교
  if (totalScore1 > totalScore2) return { winner: match.team1, wins1, wins2 };
  if (totalScore2 > totalScore1) return { winner: match.team2, wins1, wins2 };

  // 본수도 동점 → 대표전 필요
  return { winner: 'tiebreaker', wins1, wins2 };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test
```

Expected: PASS (all tests)

- [ ] **Step 5: 커밋**

```bash
git add src/scoring.js tests/scoring.test.js
git commit -m "feat: scoring engine with TDD (individual + team match)"
```

---

## Task 5: HTML 골격 + CSS 기반 스타일

**Files:**
- Create: `index.html`
- Create: `display.html`
- Modify: `style.css`

- [ ] **Step 1: index.html 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KendoBracket — 관리자</title>
  <link rel="stylesheet" href="style.css">
</head>
<body data-page="admin">

  <!-- 헤더 -->
  <header id="header">
    <div class="header-left">
      <span class="logo">🏆 KendoBracket</span>
      <input id="title-input" type="text" placeholder="대회명을 입력하세요" autocomplete="off">
    </div>
    <div class="header-right">
      <button id="btn-open-display">전광판 열기 ↗</button>
    </div>
  </header>

  <!-- 메인 레이아웃: 좌우 분할 -->
  <div id="main-layout">

    <!-- 좌측 사이드바 -->
    <aside id="sidebar">

      <!-- 체급 탭 -->
      <section id="division-section">
        <div id="division-tabs"></div>
        <div id="division-settings"></div>
      </section>

      <!-- 선수/팀 목록 -->
      <section id="roster-section">
        <div id="roster-list"></div>
        <div id="roster-actions"></div>
      </section>

      <!-- 전광판 제어 -->
      <section id="display-control">
        <h3>전광판 제어</h3>
        <div id="display-ctrl-content"></div>
      </section>

      <!-- JSON 백업 -->
      <section id="backup-section">
        <button id="btn-export">JSON 내보내기</button>
        <button id="btn-import">JSON 불러오기</button>
        <input id="import-file" type="file" accept=".json" style="display:none">
      </section>

    </aside>

    <!-- 우측 브라켓 영역 -->
    <main id="bracket-area">
      <div id="bracket-container"></div>
    </main>

  </div>

  <!-- 모달 오버레이 -->
  <div id="modal-overlay" class="hidden">
    <div id="modal-box"></div>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: display.html 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KendoBracket — 전광판</title>
  <link rel="stylesheet" href="style.css">
</head>
<body data-page="display">

  <div id="display-wrapper">

    <!-- 전광판 헤더 -->
    <div id="display-header">
      <span id="display-title"></span>
      <div id="display-controls">
        <button id="btn-mode-current">현재 경기</button>
        <button id="btn-mode-bracket">대진표</button>
        <button id="btn-mode-result">결과</button>
        <button id="btn-fullscreen">⛶</button>
        <label>
          <input type="checkbox" id="cb-autoslide"> 자동
        </label>
      </div>
    </div>

    <!-- 전광판 콘텐츠 영역 -->
    <div id="display-content">
      <!-- renderDisplay()가 내용을 채움 -->
    </div>

  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: style.css 생성 (기반 스타일)**

```css
/* ===== 공통 리셋 + 변수 ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-darkest:  #050510;
  --bg-dark:     #0d0d1a;
  --bg-panel:    #111827;
  --bg-card:     #1a1a2e;
  --border:      #1f2937;
  --border-blue: #3b6ca8;
  --accent-blue: #7eb8f7;
  --accent-green:#22c55e;
  --text-primary:#e2e8f0;
  --text-muted:  #6b7280;
  --text-dim:    #374151;
  --danger:      #ef4444;
  --warning:     #f59e0b;
}

body {
  font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  background: var(--bg-dark);
  color: var(--text-primary);
  min-height: 100vh;
}

button {
  cursor: pointer;
  border: 1px solid var(--border-blue);
  background: var(--bg-card);
  color: var(--accent-blue);
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
button:hover { background: #1e3a5f; }

input[type="text"], input[type="number"] {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
input:focus { outline: none; border-color: var(--accent-blue); }

.hidden { display: none !important; }

/* ===== 관리자 화면 레이아웃 ===== */
[data-page="admin"] {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

#header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-left { display: flex; align-items: center; gap: 12px; }
.logo { font-size: 18px; font-weight: bold; color: var(--accent-blue); }
#title-input { width: 280px; }

#main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

#sidebar section { display: flex; flex-direction: column; gap: 8px; }
#sidebar h3 { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

#bracket-area {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

#bracket-container { min-width: 600px; }

/* ===== 체급 탭 ===== */
#division-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.division-tab {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-muted);
}
.division-tab.active {
  background: #1e3a5f;
  border-color: var(--border-blue);
  color: var(--accent-blue);
}
.division-tab-add {
  border-style: dashed;
  color: var(--text-dim);
}

/* ===== 로스터 목록 ===== */
.roster-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
}

.roster-item .move-btns { display: flex; flex-direction: column; gap: 1px; margin-left: auto; }
.roster-item .move-btns button { padding: 1px 5px; font-size: 10px; line-height: 1; }
.roster-item .delete-btn { color: var(--danger); border-color: var(--danger); padding: 2px 6px; font-size: 10px; }

/* ===== 모달 ===== */
#modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

#modal-box {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  min-width: 400px;
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
}

/* ===== 전광판 화면 ===== */
[data-page="display"] {
  background: var(--bg-darkest);
  min-height: 100vh;
}

#display-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#display-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

#display-title {
  font-size: 16px;
  color: var(--accent-blue);
  letter-spacing: 2px;
}

#display-controls { display: flex; align-items: center; gap: 8px; }
#display-controls button { font-size: 12px; padding: 3px 10px; }
#display-controls button.active {
  background: #1e3a5f;
  border-color: var(--accent-blue);
}

#display-content { flex: 1; overflow: hidden; position: relative; }

/* 페이드 전환 */
.display-fade-in { animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* 현재 경기 모드 */
#current-match-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
}

.current-match-header {
  text-align: center;
  color: var(--text-muted);
  font-size: 18px;
  margin-bottom: 20px;
  letter-spacing: 3px;
}

.current-match-players {
  display: flex;
  flex: 1;
}

.player-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.player-side:first-child { border-right: 1px solid var(--border); }

.player-name {
  font-size: clamp(36px, 6vw, 72px);
  font-weight: bold;
  letter-spacing: 8px;
  color: var(--text-primary);
}

.player-club { font-size: clamp(14px, 2vw, 24px); color: var(--text-muted); }

.player-score {
  width: clamp(60px, 8vw, 100px);
  height: clamp(60px, 8vw, 100px);
  border-radius: 50%;
  background: var(--bg-card);
  border: 2px solid var(--border-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(28px, 4vw, 52px);
  font-weight: bold;
  color: var(--accent-blue);
}

.player-score-label { font-size: 14px; color: var(--text-muted); }

/* 대진표 브라켓 모드 */
#bracket-display-view {
  padding: 20px;
  overflow: auto;
  height: 100%;
}

/* 결과 하이라이트 모드 */
#result-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 24px;
  padding: 40px;
}

.result-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px 32px;
  width: 100%;
  max-width: 700px;
}

.result-card-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.result-score-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-player-name { font-size: clamp(20px, 3vw, 36px); font-weight: bold; }
.result-score-nums {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: clamp(28px, 4vw, 48px);
  font-weight: bold;
}
.result-score-nums .winner-score { color: var(--accent-green); }
.result-score-nums .loser-score { color: var(--text-muted); }
.result-score-nums .sep { color: var(--text-dim); font-size: 20px; }

/* SVG 브라켓 공통 스타일 */
.bracket-svg text { font-family: 'Malgun Gothic', sans-serif; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.match-ongoing { animation: pulse 1.5s ease-in-out infinite; }

/* @media print */
@media print {
  #sidebar, #header, #display-controls { display: none; }
  #bracket-area, #bracket-display-view { width: 100%; overflow: visible; }
}
```

- [ ] **Step 4: 브라우저에서 index.html 열어 레이아웃 확인**

파일 탐색기에서 `index.html`을 Chrome으로 열기 (또는 `python -m http.server 3000` 후 `http://localhost:3000`).  
기대: 헤더, 좌측 사이드바, 우측 빈 영역이 보임. 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add index.html display.html style.css
git commit -m "feat: HTML skeleton and base CSS dark theme"
```

---

## Task 6: app.js 진입점 + 관리자 UI 기반

**Files:**
- Modify: `app.js`
- Modify: `src/admin-ui.js`
- Modify: `src/state.js`

- [ ] **Step 1: app.js 구현**

```js
// app.js
import { loadState, setRenderCallback } from './src/state.js';
import { initAdmin, renderAll } from './src/admin-ui.js';
import { initDisplay } from './src/display-ui.js';

const page = document.body.dataset.page;

if (page === 'admin') {
  setRenderCallback(renderAll);
  loadState();
  initAdmin();
} else if (page === 'display') {
  initDisplay();
}
```

- [ ] **Step 2: admin-ui.js — 대회 설정 + 체급 탭 렌더링**

```js
// src/admin-ui.js
import { getState, getActiveDivision, updateState, EMPTY_DIVISION } from './state.js';

export function initAdmin() {
  bindAdminEvents();
  renderAll();
}

export function renderAll() {
  const state = getState();
  renderTitle(state);
  renderDivisionTabs(state);
  renderDivisionSettings(state);
  renderRosterSection(state);
  renderDisplayControls(state);
  renderBracketArea(state);
}

function renderTitle(state) {
  const input = document.getElementById('title-input');
  if (input && input !== document.activeElement) {
    input.value = state.meta.title;
  }
}

function renderDivisionTabs(state) {
  const container = document.getElementById('division-tabs');
  if (!container) return;
  container.innerHTML = '';

  state.divisions.forEach((div, i) => {
    const tab = document.createElement('button');
    tab.className = 'division-tab' + (i === state.activeDivision ? ' active' : '');
    tab.textContent = div.name || `체급 ${i + 1}`;
    tab.dataset.index = i;
    container.appendChild(tab);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'division-tab division-tab-add';
  addBtn.textContent = '+ 추가';
  addBtn.id = 'btn-add-division';
  container.appendChild(addBtn);
}

function renderDivisionSettings(state) {
  const container = document.getElementById('division-settings');
  if (!container) return;
  const div = state.divisions[state.activeDivision];
  if (!div) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:12px">체급을 추가하세요</p>';
    return;
  }

  container.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <input id="div-name-input" type="text" placeholder="체급명" value="${div.name}" style="flex:1;min-width:80px">
      <select id="div-type-select" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:5px 8px;border-radius:4px;font-size:13px">
        <option value="individual" ${div.type === 'individual' ? 'selected' : ''}>개인전</option>
        <option value="team" ${div.type === 'team' ? 'selected' : ''}>단체전</option>
      </select>
    </div>
  `;
}

function renderRosterSection(state) {
  const div = getActiveDivision();
  const container = document.getElementById('roster-list');
  const actionsContainer = document.getElementById('roster-actions');
  if (!container || !actionsContainer) return;

  if (!div) { container.innerHTML = ''; actionsContainer.innerHTML = ''; return; }

  if (div.type === 'individual') {
    renderPlayerList(div, container);
    actionsContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;gap:4px">
          <input id="new-player-name" type="text" placeholder="선수명" style="flex:1">
          <input id="new-player-club" type="text" placeholder="소속" style="flex:1">
        </div>
        <button id="btn-add-player">+ 선수 추가</button>
        <button id="btn-generate-bracket">대진표 자동 생성</button>
      </div>
    `;
  } else {
    renderTeamList(div, container);
    actionsContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;gap:4px">
          <input id="new-team-name" type="text" placeholder="팀명" style="flex:1">
          <input id="new-team-size" type="number" value="${div.teamSize}" min="5" max="6" style="width:50px">
        </div>
        <button id="btn-add-team">+ 팀 추가</button>
        <button id="btn-generate-bracket">대진표 자동 생성</button>
      </div>
    `;
  }
}

function renderPlayerList(div, container) {
  container.innerHTML = '';
  div.players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'roster-item';
    item.dataset.playerId = p.id;
    item.innerHTML = `
      <span style="color:var(--text-muted);font-size:10px;width:16px">${i + 1}</span>
      <span style="flex:1">${p.name}</span>
      <span style="color:var(--text-muted);font-size:11px">${p.club}</span>
      <div class="move-btns">
        <button data-action="up" data-idx="${i}">↑</button>
        <button data-action="down" data-idx="${i}">↓</button>
      </div>
      <button class="delete-btn" data-action="delete" data-idx="${i}">✕</button>
    `;
    container.appendChild(item);
  });
}

function renderTeamList(div, container) {
  container.innerHTML = '';
  div.teams.forEach((team, ti) => {
    const item = document.createElement('div');
    item.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:8px;margin-bottom:6px';
    item.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <strong style="font-size:12px">${team.name}</strong>
        <button class="delete-btn" data-action="delete-team" data-idx="${ti}">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${team.roster.map((p, pi) => `
          <div style="display:flex;gap:4px;align-items:center;font-size:11px;color:var(--text-muted)">
            <span style="width:30px">${div.positions[pi] ?? `포지션${pi+1}`}</span>
            <span style="flex:1;color:var(--text-primary)">${p.name}</span>
          </div>
        `).join('')}
        ${team.roster.length < div.teamSize ? `
          <div style="display:flex;gap:4px;margin-top:4px">
            <input type="text" placeholder="선수명" data-team-idx="${ti}" id="member-name-${ti}" style="flex:1;font-size:11px;padding:3px 6px">
            <button data-action="add-member" data-team-idx="${ti}" style="font-size:10px;padding:2px 6px">+</button>
          </div>
        ` : ''}
      </div>
    `;
    container.appendChild(item);
  });
}

function renderDisplayControls(state) {
  const container = document.getElementById('display-ctrl-content');
  if (!container) return;
  const modes = [
    { value: 'current', label: '현재 경기' },
    { value: 'bracket', label: '대진표' },
    { value: 'result', label: '결과' },
  ];
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${modes.map(m => `
          <button data-action="set-display-mode" data-mode="${m.value}"
            style="${state.display.mode === m.value ? 'background:#1e3a5f;border-color:var(--accent-blue)' : ''}">
            ${m.label}
          </button>
        `).join('')}
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">
        <input type="checkbox" id="cb-autoslide-admin" ${state.display.autoSlide ? 'checked' : ''}>
        자동 슬라이드 (10초)
      </label>
    </div>
  `;
}

function renderBracketArea(state) {
  // Task 9에서 SVG 렌더링으로 대체
  const container = document.getElementById('bracket-container');
  if (!container) return;
  const div = getActiveDivision();
  if (!div || !div.bracket.rounds.length) {
    container.innerHTML = '<p style="color:var(--text-muted);margin:40px;text-align:center">대진표를 생성하세요</p>';
    return;
  }
  // SVG 렌더링은 Task 9에서 추가
}

function bindAdminEvents() {
  const root = document;

  // 대회명 입력
  root.addEventListener('input', e => {
    if (e.target.id === 'title-input') {
      updateState(s => { s.meta.title = e.target.value; });
    }
  });

  // 체급 탭 클릭
  root.addEventListener('click', e => {
    const tab = e.target.closest('.division-tab[data-index]');
    if (tab) {
      updateState(s => { s.activeDivision = parseInt(tab.dataset.index); });
    }
  });

  // 체급 추가
  root.addEventListener('click', e => {
    if (e.target.id === 'btn-add-division') {
      updateState(s => {
        s.divisions.push(EMPTY_DIVISION());
        s.activeDivision = s.divisions.length - 1;
      });
    }
  });

  // 체급명 변경
  root.addEventListener('input', e => {
    if (e.target.id === 'div-name-input') {
      updateState(s => { s.divisions[s.activeDivision].name = e.target.value; });
    }
  });

  // 경기 방식 변경
  root.addEventListener('change', e => {
    if (e.target.id === 'div-type-select') {
      updateState(s => { s.divisions[s.activeDivision].type = e.target.value; });
    }
  });

  // 선수 추가
  root.addEventListener('click', e => {
    if (e.target.id === 'btn-add-player') {
      const name = document.getElementById('new-player-name')?.value.trim();
      const club = document.getElementById('new-player-club')?.value.trim();
      if (!name) return;
      updateState(s => {
        const div = s.divisions[s.activeDivision];
        div.players.push({ id: 'p' + Date.now(), name, club: club || '', seed: div.players.length + 1 });
      });
      document.getElementById('new-player-name').value = '';
      document.getElementById('new-player-club').value = '';
    }
  });

  // Enter 키로 선수 추가
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'new-player-name') {
      document.getElementById('btn-add-player')?.click();
    }
  });

  // 선수 순서 이동 + 삭제
  root.addEventListener('click', e => {
    const action = e.target.dataset.action;
    const idx = parseInt(e.target.dataset.idx);
    if (isNaN(idx)) return;

    if (action === 'up' && idx > 0) {
      updateState(s => {
        const arr = s.divisions[s.activeDivision].players;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      });
    } else if (action === 'down') {
      updateState(s => {
        const arr = s.divisions[s.activeDivision].players;
        if (idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      });
    } else if (action === 'delete') {
      if (!confirm('선수를 삭제할까요?')) return;
      updateState(s => { s.divisions[s.activeDivision].players.splice(idx, 1); });
    }
  });

  // 팀 추가
  root.addEventListener('click', e => {
    if (e.target.id === 'btn-add-team') {
      const name = document.getElementById('new-team-name')?.value.trim();
      const size = parseInt(document.getElementById('new-team-size')?.value) || 5;
      if (!name) return;
      updateState(s => {
        const div = s.divisions[s.activeDivision];
        div.teamSize = size;
        div.teams.push({ id: 't' + Date.now(), name, roster: [], lastLineup: [] });
      });
      document.getElementById('new-team-name').value = '';
    }
  });

  // 팀 삭제
  root.addEventListener('click', e => {
    if (e.target.dataset.action === 'delete-team') {
      const idx = parseInt(e.target.dataset.idx);
      if (!confirm('팀을 삭제할까요?')) return;
      updateState(s => { s.divisions[s.activeDivision].teams.splice(idx, 1); });
    }
  });

  // 팀 멤버 추가
  root.addEventListener('click', e => {
    if (e.target.dataset.action === 'add-member') {
      const ti = parseInt(e.target.dataset.teamIdx);
      const input = document.getElementById(`member-name-${ti}`);
      const name = input?.value.trim();
      if (!name) return;
      updateState(s => {
        const div = s.divisions[s.activeDivision];
        div.teams[ti].roster.push({ id: 'p' + Date.now(), name });
      });
      if (input) input.value = '';
    }
  });

  // 전광판 열기
  root.addEventListener('click', e => {
    if (e.target.id === 'btn-open-display') {
      window.open('display.html', '_blank');
    }
  });

  // 전광판 모드 전환
  root.addEventListener('click', e => {
    if (e.target.dataset.action === 'set-display-mode') {
      updateState(s => { s.display.mode = e.target.dataset.mode; });
    }
  });

  // 자동 슬라이드 토글
  root.addEventListener('change', e => {
    if (e.target.id === 'cb-autoslide-admin') {
      updateState(s => { s.display.autoSlide = e.target.checked; });
    }
  });
}
```

- [ ] **Step 3: 브라우저에서 동작 확인**

`index.html` 열기 → 체급 추가 → 선수 추가 → 순서 변경이 정상 동작하는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add app.js src/admin-ui.js src/state.js
git commit -m "feat: admin UI foundation (divisions, player/team management)"
```

---

## Task 7: SVG 브라켓 렌더링

**Files:**
- Modify: `src/svg-bracket.js`
- Modify: `src/admin-ui.js` (`renderBracketArea` 연결)
- Modify: `src/bracket-engine.js` (`generateBracket` 연결 버튼)

- [ ] **Step 1: svg-bracket.js 구현**

```js
// src/svg-bracket.js

const MATCH_W = 170;
const MATCH_H = 44;
const ROUND_GAP = 50;
const V_PAD = 20;
const H_PAD = 20;

function roundMatchCount(rounds, roundNo) {
  return rounds.find(r => r.roundNo === roundNo)?.matches.length ?? 0;
}

function matchY(roundNo, matchIdx, totalRounds) {
  const step = MATCH_H * Math.pow(2, roundNo - 1);
  const offset = (step - MATCH_H) / 2;
  return V_PAD + matchIdx * step + offset;
}

function matchX(roundNo) {
  return H_PAD + (roundNo - 1) * (MATCH_W + ROUND_GAP);
}

function totalHeight(totalRounds) {
  const firstRoundMatches = Math.pow(2, totalRounds - 1);
  return V_PAD * 2 + firstRoundMatches * MATCH_H * 1.5;
}

function totalWidth(totalRounds) {
  return H_PAD * 2 + totalRounds * (MATCH_W + ROUND_GAP);
}

function getPlayerName(participantId, division) {
  if (!participantId || participantId === 'bye') return 'BYE';
  if (division.type === 'individual') {
    return division.players.find(p => p.id === participantId)?.name ?? '?';
  } else {
    return division.teams.find(t => t.id === participantId)?.name ?? '?';
  }
}

function createSVGEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export function renderBracketSVG(division, container) {
  container.innerHTML = '';
  const { rounds } = division.bracket;
  if (!rounds.length) return;

  const totalRounds = rounds.length;
  const svgW = totalWidth(totalRounds);
  const svgH = totalHeight(totalRounds);

  const svg = createSVGEl('svg', {
    viewBox: `0 0 ${svgW} ${svgH}`,
    width: svgW,
    height: svgH,
    class: 'bracket-svg',
  });

  // 라운드 레이블
  rounds.forEach(round => {
    const x = matchX(round.roundNo) + MATCH_W / 2;
    const label = createSVGEl('text', {
      x, y: 14,
      'text-anchor': 'middle',
      'font-size': 11,
      fill: '#6b7280',
    });
    label.textContent = round.label;
    svg.appendChild(label);
  });

  // 연결선 + 경기 박스
  rounds.forEach(round => {
    round.matches.forEach((match, mi) => {
      const x = matchX(round.roundNo);
      const y = matchY(round.roundNo, mi, totalRounds);

      // 다음 라운드로의 연결선
      if (round.roundNo < totalRounds) {
        const nextMi = Math.floor(mi / 2);
        const nx = matchX(round.roundNo + 1);
        const ny = matchY(round.roundNo + 1, nextMi, totalRounds) + MATCH_H / 2;
        const midX = x + MATCH_W + ROUND_GAP / 2;

        const path = createSVGEl('path', {
          d: `M ${x + MATCH_W} ${y + MATCH_H / 2} L ${midX} ${y + MATCH_H / 2} L ${midX} ${ny} L ${nx} ${ny}`,
          fill: 'none',
          stroke: '#374151',
          'stroke-width': 1,
        });
        svg.appendChild(path);
      }

      // 경기 박스 렌더링
      renderMatchBox(svg, match, x, y, division);
    });
  });

  container.appendChild(svg);
}

function renderMatchBox(svg, match, x, y, division) {
  const isBye = (id) => !id || id === 'bye';
  const p1Id = match.type === 'team' ? match.team1 : match.player1;
  const p2Id = match.type === 'team' ? match.team2 : match.player2;

  const boxH = (MATCH_H - 2) / 2;

  [p1Id, p2Id].forEach((pId, slot) => {
    const slotY = y + slot * (boxH + 2);
    const isWinner = match.winner === pId;
    const isByeSlot = isBye(pId);
    const isOngoing = match.status === 'ongoing' && !isByeSlot;

    let fill = '#1a1a2e';
    let stroke = '#374151';
    let textColor = '#6b7280';

    if (isByeSlot) {
      stroke = '#374151';
      fill = '#111';
    } else if (isWinner) {
      fill = '#14532d';
      stroke = '#22c55e';
      textColor = '#86efac';
    } else if (isOngoing) {
      stroke = '#f59e0b';
      fill = '#1a1a1a';
      textColor = '#fef3c7';
    } else if (pId) {
      fill = '#1e3a5f';
      stroke = '#3b6ca8';
      textColor = '#7eb8f7';
    }

    const rect = createSVGEl('rect', {
      x, y: slotY,
      width: MATCH_W, height: boxH,
      rx: 3,
      fill, stroke, 'stroke-width': 1,
      ...(isByeSlot ? { 'stroke-dasharray': '4,2' } : {}),
      'data-match-id': match.id,
      style: 'cursor:pointer',
      class: isOngoing ? 'match-ongoing' : '',
    });
    svg.appendChild(rect);

    const name = getPlayerName(pId, division);
    const score = slot === 0 ? match.score1 : match.score2;

    const text = createSVGEl('text', {
      x: x + 8,
      y: slotY + boxH / 2 + 4,
      'font-size': 11,
      fill: textColor,
    });
    text.textContent = isByeSlot ? 'BYE' : name;
    svg.appendChild(text);

    if (!isByeSlot && match.status !== 'pending') {
      const scoreText = createSVGEl('text', {
        x: x + MATCH_W - 10,
        y: slotY + boxH / 2 + 4,
        'font-size': 11,
        'text-anchor': 'end',
        fill: textColor,
      });
      scoreText.textContent = score;
      svg.appendChild(scoreText);
    }
  });

  // 클릭 이벤트용 투명 오버레이
  if (match.status !== 'done' || match.winner) {
    const overlay = createSVGEl('rect', {
      x, y,
      width: MATCH_W, height: MATCH_H - 2,
      fill: 'transparent',
      'data-match-id': match.id,
      style: 'cursor:pointer',
    });
    svg.appendChild(overlay);
  }
}
```

- [ ] **Step 2: admin-ui.js의 renderBracketArea 업데이트**

`src/admin-ui.js`의 `renderBracketArea` 함수를 아래로 교체:

```js
// src/admin-ui.js 상단에 import 추가
import { renderBracketSVG } from './svg-bracket.js';
import { generateBracket, generateTeamBracket, advanceWinner } from './bracket-engine.js';

// renderBracketArea 함수 교체
function renderBracketArea(state) {
  const container = document.getElementById('bracket-container');
  if (!container) return;
  const div = getActiveDivision();
  if (!div || !div.bracket.rounds.length) {
    container.innerHTML = '<p style="color:var(--text-muted);margin:40px;text-align:center">대진표를 생성하세요</p>';
    return;
  }
  renderBracketSVG(div, container);

  // SVG 경기 클릭 이벤트
  container.querySelectorAll('[data-match-id]').forEach(el => {
    el.addEventListener('click', () => {
      const { openMatchModal } = window._matchModal ?? {};
      if (openMatchModal) openMatchModal(el.dataset.matchId);
    });
  });
}
```

- [ ] **Step 3: 대진표 자동 생성 버튼 이벤트 추가**

`bindAdminEvents()` 안에 아래 추가:

```js
  // 대진표 자동 생성
  root.addEventListener('click', e => {
    if (e.target.id === 'btn-generate-bracket') {
      updateState(s => {
        const div = s.divisions[s.activeDivision];
        if (div.type === 'individual') {
          if (div.players.length < 2) { alert('선수가 최소 2명 이상이어야 합니다.'); return; }
          div.bracket = generateBracket(div.players);
        } else {
          if (div.teams.length < 2) { alert('팀이 최소 2개 이상이어야 합니다.'); return; }
          div.bracket = generateTeamBracket(div.teams);
        }
      });
    }
  });
```

- [ ] **Step 4: 브라우저에서 확인**

`index.html` → 체급 추가 → 선수 4명 추가 → "대진표 자동 생성" → SVG 브라켓이 우측에 표시되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/svg-bracket.js src/admin-ui.js src/bracket-engine.js
git commit -m "feat: SVG bracket rendering with auto-generation"
```

---

## Task 8: 브라켓 드래그앤드롭 (대진표 선수 위치 교환)

**Files:**
- Modify: `src/admin-ui.js`

- [ ] **Step 1: 드래그앤드롭 이벤트 설정 함수 추가**

`src/admin-ui.js`의 `renderBracketArea` 함수 끝에 아래 추가:

```js
  // 기존 renderBracketArea에 아래 추가
  setupBracketDragDrop(container, div);
```

그리고 `admin-ui.js`에 아래 함수 추가:

```js
function setupBracketDragDrop(container, division) {
  let dragSource = null; // { matchId, slot: 'player1'|'player2'|'team1'|'team2' }

  container.querySelectorAll('[data-match-id]').forEach(el => {
    el.setAttribute('draggable', 'true');

    el.addEventListener('dragstart', e => {
      const rect = el.getBoundingClientRect();
      const svgRect = container.querySelector('svg').getBoundingClientRect();
      const relY = e.clientY - svgRect.top;
      const elY = parseFloat(el.getAttribute('y') ?? el.getBoundingClientRect().top - svgRect.top);
      const slot = relY < elY + 22 ? 0 : 1; // 박스 절반 기준
      dragSource = { matchId: el.dataset.matchId, slot };
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });

    el.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSource) return;
      const targetMatchId = el.dataset.matchId;
      const svgRect = container.querySelector('svg').getBoundingClientRect();
      const relY = e.clientY - svgRect.top;
      const elY = parseFloat(el.getAttribute('y') ?? el.getBoundingClientRect().top - svgRect.top);
      const targetSlot = relY < elY + 22 ? 0 : 1;

      if (dragSource.matchId === targetMatchId && dragSource.slot === targetSlot) return;

      updateState(s => {
        const div = s.divisions[s.activeDivision];
        const rounds = div.bracket.rounds;
        const srcMatch = rounds.flatMap(r => r.matches).find(m => m.id === dragSource.matchId);
        const tgtMatch = rounds.flatMap(r => r.matches).find(m => m.id === targetMatchId);
        if (!srcMatch || !tgtMatch) return;

        const isTeam = srcMatch.type === 'team';
        const slots = isTeam ? ['team1', 'team2'] : ['player1', 'player2'];
        const srcKey = slots[dragSource.slot];
        const tgtKey = slots[targetSlot];

        [srcMatch[srcKey], tgtMatch[tgtKey]] = [tgtMatch[tgtKey], srcMatch[srcKey]];
      });
      dragSource = null;
    });
  });
}
```

- [ ] **Step 2: 브라우저에서 확인**

SVG 브라켓에서 선수 슬롯을 드래그해 다른 슬롯에 드롭했을 때 위치가 바뀌는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/admin-ui.js
git commit -m "feat: bracket drag-and-drop player position swap"
```

---

## Task 9: 경기 결과 입력 모달 (개인전 + 단체전)

**Files:**
- Modify: `src/match-modal.js`
- Modify: `src/admin-ui.js` (모달 연결)

- [ ] **Step 1: match-modal.js 구현**

```js
// src/match-modal.js
import { getState, getActiveDivision, updateState } from './state.js';
import { calcIndividualWinner, calcTeamBoutWinner, calcTeamMatchResult } from './scoring.js';
import { advanceWinner } from './bracket-engine.js';

export function openMatchModal(matchId) {
  const state = getState();
  const div = getActiveDivision();
  if (!div) return;

  const match = div.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
  if (!match) return;

  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  if (!overlay || !box) return;

  box.innerHTML = match.type === 'team'
    ? renderTeamMatchModal(match, div)
    : renderIndividualMatchModal(match, div);

  overlay.classList.remove('hidden');
  bindModalEvents(matchId, match.type, div);
}

export function closeMatchModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

function getParticipantName(id, div) {
  if (!id || id === 'bye') return 'BYE';
  if (div.type === 'individual') return div.players.find(p => p.id === id)?.name ?? '?';
  return div.teams.find(t => t.id === id)?.name ?? '?';
}

function renderIndividualMatchModal(match, div) {
  const p1Name = getParticipantName(match.player1, div);
  const p2Name = getParticipantName(match.player2, div);
  return `
    <h3 style="margin-bottom:16px">경기 결과 입력</h3>
    <div style="display:flex;align-items:center;gap:16px;justify-content:center">
      <div style="text-align:center;flex:1">
        <div style="font-size:18px;font-weight:bold;margin-bottom:8px">${p1Name}</div>
        <input type="number" id="score1" value="${match.score1}" min="0" max="10"
          style="width:60px;text-align:center;font-size:20px;padding:8px">
      </div>
      <div style="font-size:24px;color:var(--text-muted)">:</div>
      <div style="text-align:center;flex:1">
        <div style="font-size:18px;font-weight:bold;margin-bottom:8px">${p2Name}</div>
        <input type="number" id="score2" value="${match.score2}" min="0" max="10"
          style="width:60px;text-align:center;font-size:20px;padding:8px">
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
      <button id="btn-modal-cancel">취소</button>
      <button id="btn-modal-confirm" style="background:#14532d;border-color:#22c55e;color:#86efac">확인</button>
    </div>
  `;
}

function renderTeamMatchModal(match, div) {
  const t1 = div.teams.find(t => t.id === match.team1);
  const t2 = div.teams.find(t => t.id === match.team2);
  if (!t1 || !t2) return '<p>팀 정보를 찾을 수 없습니다.</p>';

  const lineup1 = match.lineup1.length ? match.lineup1 : t1.lastLineup.length ? t1.lastLineup : t1.roster.map(p => p.id);
  const lineup2 = match.lineup2.length ? match.lineup2 : t2.lastLineup.length ? t2.lastLineup : t2.roster.map(p => p.id);

  const getPlayerById = (team, id) => team.roster.find(p => p.id === id);
  const totalSize = div.teamSize;

  const boutsHtml = div.positions.slice(0, totalSize).map((pos, i) => {
    const bout = match.bouts[i] ?? { score1: 0, score2: 0, winner: null, status: 'pending' };
    const p1 = getPlayerById(t1, lineup1[i]);
    const p2 = getPlayerById(t2, lineup2[i]);
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="width:32px;font-size:11px;color:var(--text-muted)">${pos}</span>
        <span style="flex:1;font-size:13px">${p1?.name ?? '-'}</span>
        <input type="number" class="bout-score1" data-bout="${i}" value="${bout.score1}" min="0" max="10"
          style="width:48px;text-align:center;padding:4px">
        <span style="color:var(--text-muted)">:</span>
        <input type="number" class="bout-score2" data-bout="${i}" value="${bout.score2}" min="0" max="10"
          style="width:48px;text-align:center;padding:4px">
        <span style="flex:1;font-size:13px;text-align:right">${p2?.name ?? '-'}</span>
      </div>
    `;
  }).join('');

  return `
    <h3 style="margin-bottom:4px">단체전 결과 입력</h3>
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;color:var(--text-muted);font-size:13px">
      <span>${t1.name}</span><span>${t2.name}</span>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">라인업 (드래그로 순서 변경)</div>
      <div id="lineup-t1" style="display:flex;flex-direction:column;gap:3px">
        ${lineup1.map((pid, i) => {
          const p = getPlayerById(t1, pid);
          return `<div class="lineup-item" draggable="true" data-team="1" data-idx="${i}" data-pid="${pid}"
            style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;cursor:grab">
            <span style="color:var(--text-muted);font-size:11px">⠿</span>
            <span style="color:var(--text-muted);font-size:10px;width:28px">${div.positions[i] ?? i+1}</span>
            <span style="font-size:12px">${p?.name ?? pid}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">대결 결과</div>
      ${boutsHtml}
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="btn-modal-cancel">취소</button>
      <button id="btn-modal-confirm" style="background:#14532d;border-color:#22c55e;color:#86efac">저장</button>
    </div>
  `;
}

function bindModalEvents(matchId, matchType, div) {
  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeMatchModal);

  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeMatchModal();
  });

  document.getElementById('btn-modal-confirm')?.addEventListener('click', () => {
    if (matchType === 'individual') saveIndividualResult(matchId);
    else saveTeamResult(matchId, div);
  });

  // 라인업 드래그앤드롭 (단체전)
  if (matchType === 'team') {
    setupLineupDragDrop('lineup-t1', 1);
  }
}

function saveIndividualResult(matchId) {
  const score1 = parseInt(document.getElementById('score1')?.value) || 0;
  const score2 = parseInt(document.getElementById('score2')?.value) || 0;

  updateState(s => {
    const div = s.divisions[s.activeDivision];
    const match = div.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!match) return;
    match.score1 = score1;
    match.score2 = score2;
    match.winner = calcIndividualWinner(match);
    match.status = 'done';
    if (match.winner) {
      advanceWinner(div.bracket, matchId, match.winner, true);
    }
  });
  closeMatchModal();
}

function saveTeamResult(matchId, div) {
  const score1Inputs = document.querySelectorAll('.bout-score1');
  const score2Inputs = document.querySelectorAll('.bout-score2');
  const lineupItems = document.querySelectorAll('#lineup-t1 .lineup-item');

  const lineup1 = Array.from(lineupItems).map(el => el.dataset.pid);

  updateState(s => {
    const activDiv = s.divisions[s.activeDivision];
    const match = activDiv.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!match) return;

    match.lineup1 = lineup1;
    match.bouts = Array.from(score1Inputs).map((inp, i) => {
      const s1 = parseInt(inp.value) || 0;
      const s2 = parseInt(score2Inputs[i].value) || 0;
      const bout = { score1: s1, score2: s2, winner: null, status: 'done',
                     position: activDiv.positions[i] ?? `포지션${i+1}` };
      bout.winner = calcTeamBoutWinner(bout);
      return bout;
    });

    const result = calcTeamMatchResult(match);
    match.wins1 = result.wins1;
    match.wins2 = result.wins2;

    if (result.winner && result.winner !== 'tiebreaker') {
      match.winner = result.winner;
      match.status = 'done';
      advanceWinner(activDiv.bracket, matchId, match.winner, true);

      // 팀 lastLineup 갱신
      const team1 = activDiv.teams.find(t => t.id === match.team1);
      if (team1) team1.lastLineup = [...lineup1];
    } else if (result.winner === 'tiebreaker') {
      match.status = 'ongoing';
      alert('승수·본수 동점! 대표전이 필요합니다. 대표전 결과 입력 후 다시 저장하세요.');
    } else {
      match.status = 'ongoing';
    }
  });
  closeMatchModal();
}

function setupLineupDragDrop(containerId, teamNum) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let dragIdx = null;

  container.querySelectorAll('.lineup-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragIdx = parseInt(item.dataset.idx);
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', e => { e.preventDefault(); });
    item.addEventListener('drop', e => {
      e.preventDefault();
      const targetIdx = parseInt(item.dataset.idx);
      if (dragIdx === null || dragIdx === targetIdx) return;
      const items = Array.from(container.querySelectorAll('.lineup-item'));
      const dragEl = items[dragIdx];
      const targetEl = items[targetIdx];
      if (dragIdx < targetIdx) container.insertBefore(dragEl, targetEl.nextSibling);
      else container.insertBefore(dragEl, targetEl);
      // idx 재할당
      container.querySelectorAll('.lineup-item').forEach((el, i) => {
        el.dataset.idx = i;
        el.querySelector('span:nth-child(2)').textContent = window._divPositions?.[i] ?? i + 1;
      });
      dragIdx = null;
    });
  });
}
```

- [ ] **Step 2: admin-ui.js에 모달 연결**

`app.js` 파일 수정:

```js
// app.js
import { loadState, setRenderCallback } from './src/state.js';
import { initAdmin, renderAll } from './src/admin-ui.js';
import { initDisplay } from './src/display-ui.js';
import { openMatchModal, closeMatchModal } from './src/match-modal.js';

const page = document.body.dataset.page;

if (page === 'admin') {
  setRenderCallback(renderAll);
  loadState();
  initAdmin();
  // 모달 함수를 전역 접근 가능하게 (SVG 이벤트에서 사용)
  window._matchModal = { openMatchModal, closeMatchModal };
} else if (page === 'display') {
  initDisplay();
}
```

- [ ] **Step 3: 브라우저에서 확인**

대진표 생성 후 경기 박스 클릭 → 모달 오픈 → 점수 입력 → 확인 → 승자 녹색 표시 + 다음 라운드에 이름 이동 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/match-modal.js app.js
git commit -m "feat: match result modal (individual + team with lineup DnD)"
```

---

## Task 10: 전광판 화면 (display.html)

**Files:**
- Modify: `src/display-ui.js`

- [ ] **Step 1: display-ui.js 구현**

```js
// src/display-ui.js
import { loadState, getState } from './state.js';
import { renderBracketSVG } from './svg-bracket.js';

let _autoSlideTimer = null;
let _modes = ['current', 'bracket', 'result'];
let _modeIdx = 0;

export function initDisplay() {
  loadState();
  bindDisplayEvents();
  renderDisplay();

  window.addEventListener('storage', e => {
    if (e.key === 'kendo_state') {
      try {
        const state = JSON.parse(e.newValue);
        if (state) {
          Object.assign(getState(), state);
          renderDisplay();
        }
      } catch (_) {}
    }
  });
}

export function renderDisplay() {
  const state = getState();

  // 헤더 타이틀
  const titleEl = document.getElementById('display-title');
  if (titleEl) titleEl.textContent = state.meta.title || 'KendoBracket';

  // 모드 버튼 활성화
  ['current', 'bracket', 'result'].forEach(mode => {
    const btn = document.getElementById(`btn-mode-${mode}`);
    if (btn) btn.classList.toggle('active', state.display.mode === mode);
  });

  // 자동 슬라이드 체크박스
  const cb = document.getElementById('cb-autoslide');
  if (cb) cb.checked = state.display.autoSlide;

  // 콘텐츠 렌더
  const content = document.getElementById('display-content');
  if (!content) return;

  content.innerHTML = '';
  content.classList.remove('display-fade-in');
  void content.offsetWidth; // reflow
  content.classList.add('display-fade-in');

  switch (state.display.mode) {
    case 'current':  renderCurrentMatch(state, content); break;
    case 'bracket':  renderBracketMode(state, content); break;
    case 'result':   renderResultHighlight(state, content); break;
  }

  // 자동 슬라이드
  if (_autoSlideTimer) clearInterval(_autoSlideTimer);
  if (state.display.autoSlide) {
    _autoSlideTimer = setInterval(() => {
      _modeIdx = (_modeIdx + 1) % _modes.length;
      const s = getState();
      s.display.mode = _modes[_modeIdx];
      renderDisplay();
    }, state.display.slideInterval);
  }
}

function getMatchById(state, matchId) {
  for (const div of state.divisions) {
    for (const round of div.bracket.rounds) {
      const match = round.matches.find(m => m.id === matchId);
      if (match) return { match, div, round };
    }
  }
  return null;
}

function getParticipantInfo(id, div) {
  if (!id || id === 'bye') return { name: 'BYE', club: '' };
  if (div.type === 'individual') {
    const p = div.players.find(p => p.id === id);
    return { name: p?.name ?? '?', club: p?.club ?? '' };
  }
  const t = div.teams.find(t => t.id === id);
  return { name: t?.name ?? '?', club: '' };
}

function renderCurrentMatch(state, container) {
  const found = getMatchById(state, state.display.currentMatchId);
  if (!found) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#374151;font-size:24px">경기를 지정해 주세요</div>';
    return;
  }
  const { match, div, round } = found;

  const p1Id = match.type === 'team' ? match.team1 : match.player1;
  const p2Id = match.type === 'team' ? match.team2 : match.player2;
  const p1 = getParticipantInfo(p1Id, div);
  const p2 = getParticipantInfo(p2Id, div);

  let teamWinsHtml = '';
  if (match.type === 'team') {
    teamWinsHtml = `
      <div style="text-align:center;color:var(--text-muted);font-size:18px;padding:8px 0">
        팀 승수: <strong style="color:var(--accent-blue)">${match.wins1}</strong>
        &nbsp;:&nbsp;
        <strong style="color:var(--accent-blue)">${match.wins2}</strong>
      </div>`;
  }

  container.innerHTML = `
    <div id="current-match-view">
      <div class="current-match-header">
        ${state.meta.title} &nbsp;—&nbsp; ${round.label}
      </div>
      ${teamWinsHtml}
      <div class="current-match-players">
        <div class="player-side">
          <div class="player-name">${[...p1.name].join(' ')}</div>
          ${p1.club ? `<div class="player-club">${p1.club}</div>` : ''}
          <div class="player-score">${match.score1}</div>
          <div class="player-score-label">본</div>
        </div>
        <div class="player-side">
          <div class="player-name">${[...p2.name].join(' ')}</div>
          ${p2.club ? `<div class="player-club">${p2.club}</div>` : ''}
          <div class="player-score">${match.score2}</div>
          <div class="player-score-label">본</div>
        </div>
      </div>
    </div>
  `;
}

function renderBracketMode(state, container) {
  const wrapper = document.createElement('div');
  wrapper.id = 'bracket-display-view';

  const div = state.divisions[state.activeDivision] ?? state.divisions[0];
  if (!div || !div.bracket.rounds.length) {
    wrapper.innerHTML = '<p style="color:var(--text-muted);margin:40px;text-align:center">대진표가 없습니다</p>';
    container.appendChild(wrapper);
    return;
  }

  // 체급 탭 (복수 체급)
  if (state.divisions.length > 1) {
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:6px;padding:8px 16px;';
    state.divisions.forEach((d, i) => {
      const btn = document.createElement('button');
      btn.textContent = d.name;
      btn.style.cssText = i === state.activeDivision
        ? 'background:#1e3a5f;border-color:var(--accent-blue)'
        : '';
      wrapper.appendChild(tabs);
    });
  }

  const svgContainer = document.createElement('div');
  svgContainer.style.cssText = 'padding:16px;overflow:auto';
  renderBracketSVG(div, svgContainer);
  wrapper.appendChild(svgContainer);
  container.appendChild(wrapper);
}

function renderResultHighlight(state, container) {
  // 가장 최근 완료된 경기 찾기
  let lastDone = null;
  let lastDiv = null;
  let lastRound = null;
  let nextPending = null;
  let nextDiv = null;
  let nextRound = null;

  for (const div of state.divisions) {
    for (const round of div.bracket.rounds) {
      for (const match of round.matches) {
        if (match.status === 'done' && match.winner) { lastDone = match; lastDiv = div; lastRound = round; }
        if (match.status === 'pending' && !nextPending) { nextPending = match; nextDiv = div; nextRound = round; }
      }
    }
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'result-view';

  if (lastDone && lastDiv) {
    const p1Id = lastDone.type === 'team' ? lastDone.team1 : lastDone.player1;
    const p2Id = lastDone.type === 'team' ? lastDone.team2 : lastDone.player2;
    const p1 = getParticipantInfo(p1Id, lastDiv);
    const p2 = getParticipantInfo(p2Id, lastDiv);
    const winner = lastDone.winner === p1Id ? 'p1' : 'p2';

    wrapper.innerHTML += `
      <div class="result-card">
        <div class="result-card-label">방금 종료 — ${lastRound.label}</div>
        <div class="result-score-row">
          <div class="result-player-name" style="color:${winner==='p1'?'var(--text-primary)':'var(--text-muted)'}">${p1.name}</div>
          <div class="result-score-nums">
            <span class="${winner==='p1'?'winner-score':'loser-score'}">${lastDone.score1}</span>
            <span class="sep">:</span>
            <span class="${winner==='p2'?'winner-score':'loser-score'}">${lastDone.score2}</span>
          </div>
          <div class="result-player-name" style="color:${winner==='p2'?'var(--text-primary)':'var(--text-muted)'];text-align:right">${p2.name}</div>
        </div>
      </div>
    `;
  }

  if (nextPending && nextDiv) {
    const p1Id = nextPending.type === 'team' ? nextPending.team1 : nextPending.player1;
    const p2Id = nextPending.type === 'team' ? nextPending.team2 : nextPending.player2;
    const p1 = getParticipantInfo(p1Id, nextDiv);
    const p2 = getParticipantInfo(p2Id, nextDiv);
    wrapper.innerHTML += `
      <div class="result-card">
        <div class="result-card-label">▶ 다음 경기 — ${nextRound.label}</div>
        <div class="result-score-row" style="justify-content:center;gap:24px">
          <div class="result-player-name">${p1.name}</div>
          <div style="font-size:20px;color:var(--text-muted)">vs</div>
          <div class="result-player-name">${p2.name}</div>
        </div>
      </div>
    `;
  }

  if (!lastDone && !nextPending) {
    wrapper.innerHTML = '<p style="color:var(--text-muted)">아직 결과가 없습니다</p>';
  }

  container.appendChild(wrapper);
}

function bindDisplayEvents() {
  ['current', 'bracket', 'result'].forEach(mode => {
    document.getElementById(`btn-mode-${mode}`)?.addEventListener('click', () => {
      const s = getState();
      s.display.mode = mode;
      renderDisplay();
    });
  });

  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  document.getElementById('cb-autoslide')?.addEventListener('change', e => {
    const s = getState();
    s.display.autoSlide = e.target.checked;
    renderDisplay();
  });
}
```

- [ ] **Step 2: admin-ui.js에 현재 경기 지정 버튼 추가**

`renderDisplayControls` 내 HTML에 아래 추가:

```js
// renderDisplayControls 함수의 container.innerHTML에 추가
// 현재 경기 지정 select 추가
const div = getActiveDivision();
const matchOptions = div ? div.bracket.rounds.flatMap(r =>
  r.matches
    .filter(m => m.status !== 'done')
    .map(m => {
      const p1Id = m.type === 'team' ? m.team1 : m.player1;
      const p2Id = m.type === 'team' ? m.team2 : m.player2;
      const getN = (id) => {
        if (!id) return '미정';
        if (div.type === 'individual') return div.players.find(p => p.id === id)?.name ?? id;
        return div.teams.find(t => t.id === id)?.name ?? id;
      };
      return `<option value="${m.id}" ${state.display.currentMatchId === m.id ? 'selected' : ''}>${getN(p1Id)} vs ${getN(p2Id)}</option>`;
    })
) : [];
```

`renderDisplayControls` 함수 전체를 아래로 교체:

```js
function renderDisplayControls(state) {
  const container = document.getElementById('display-ctrl-content');
  if (!container) return;
  const div = getActiveDivision();

  const matchOptions = div ? div.bracket.rounds.flatMap(r =>
    r.matches
      .filter(m => m.status !== 'done')
      .map(m => {
        const p1Id = m.type === 'team' ? m.team1 : m.player1;
        const p2Id = m.type === 'team' ? m.team2 : m.player2;
        const getName = (id) => {
          if (!id || id === 'bye') return 'BYE';
          if (div.type === 'individual') return div.players.find(p => p.id === id)?.name ?? id;
          return div.teams.find(t => t.id === id)?.name ?? id;
        };
        return `<option value="${m.id}" ${state.display.currentMatchId === m.id ? 'selected' : ''}>${getName(p1Id)} vs ${getName(p2Id)}</option>`;
      })
  ) : [];

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${['current','bracket','result'].map(m => `
          <button data-action="set-display-mode" data-mode="${m}"
            style="${state.display.mode === m ? 'background:#1e3a5f;border-color:var(--accent-blue)' : ''}">
            ${{ current:'현재 경기', bracket:'대진표', result:'결과' }[m]}
          </button>
        `).join('')}
      </div>
      <select id="current-match-select" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:5px 8px;border-radius:4px;font-size:12px">
        <option value="">현재 경기 선택...</option>
        ${matchOptions.join('')}
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">
        <input type="checkbox" id="cb-autoslide-admin" ${state.display.autoSlide ? 'checked' : ''}>
        자동 슬라이드 (10초)
      </label>
    </div>
  `;
}
```

`bindAdminEvents`에 아래 추가:

```js
  // 현재 경기 지정
  root.addEventListener('change', e => {
    if (e.target.id === 'current-match-select') {
      updateState(s => { s.display.currentMatchId = e.target.value || null; });
    }
  });
```

- [ ] **Step 3: display.html을 브라우저에서 확인**

`display.html` 열기 → 3가지 모드 버튼 클릭 → 각 모드 렌더링 확인. `index.html`에서 대진표 생성 → `display.html`에서 대진표 모드 새로고침 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/display-ui.js src/admin-ui.js
git commit -m "feat: display page with 3 modes and localStorage sync"
```

---

## Task 11: JSON 내보내기/불러오기

**Files:**
- Modify: `src/admin-ui.js`

- [ ] **Step 1: app.js에 JSON 이벤트 추가**

`app.js` 수정:

```js
// app.js
import { loadState, setRenderCallback, getState, updateState } from './src/state.js';
import { initAdmin, renderAll } from './src/admin-ui.js';
import { initDisplay } from './src/display-ui.js';
import { openMatchModal, closeMatchModal } from './src/match-modal.js';

const page = document.body.dataset.page;

if (page === 'admin') {
  setRenderCallback(renderAll);
  loadState();
  initAdmin();
  window._matchModal = { openMatchModal, closeMatchModal };

  // JSON 내보내기
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const state = getState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const ts = now.toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(' ', '_');
    a.href = url;
    a.download = `kendobracket_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // JSON 불러오기
  document.getElementById('btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });

  document.getElementById('import-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.divisions || !parsed.meta) throw new Error('유효하지 않은 파일');
        updateState(s => { Object.assign(s, parsed); });
        alert('불러오기 완료!');
      } catch (err) {
        alert('파일 오류: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

} else if (page === 'display') {
  initDisplay();
}
```

- [ ] **Step 2: 브라우저에서 확인**

선수 등록 + 대진표 생성 → "JSON 내보내기" → 파일 다운로드 확인. 파일을 "JSON 불러오기" → 데이터 복원 확인.

- [ ] **Step 3: 커밋**

```bash
git add app.js
git commit -m "feat: JSON export and import for state backup"
```

---

## Task 12: localStorage 실시간 동기화 검증

**Files:**
- Modify: `src/state.js`

- [ ] **Step 1: 같은 탭 StorageEvent 발화 검증**

`src/state.js`의 `saveState`에서 `StorageEvent` 생성자 호환성 확인. Chrome 90+에서 정상 동작하지만, 구형 브라우저 대비 폴백 추가:

```js
export function saveState() {
  _state.meta.updatedAt = Date.now();
  const json = JSON.stringify(_state);
  localStorage.setItem('kendo_state', json);

  // 전광판 탭(다른 탭)에는 브라우저가 자동으로 storage 이벤트 발화
  // 같은 탭(관리자 탭)에서 전광판이 열려있을 때를 위한 수동 트리거는 불필요
  // display.html은 별도 탭에서 열리므로 브라우저 기본 동작으로 충분
}
```

- [ ] **Step 2: 두 탭 동기화 수동 테스트**

1. `index.html` 탭 열기
2. "전광판 열기 ↗" 클릭 → `display.html` 새 탭 열림
3. `index.html`에서 결과 입력 → `display.html`에서 자동으로 브라켓 업데이트 확인

- [ ] **Step 3: 커밋 (변경사항 있을 경우)**

```bash
git add src/state.js
git commit -m "fix: simplify storage sync (browser handles cross-tab events)"
```

---

## Task 13: .gitignore + README + 최종 정리

**Files:**
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: .gitignore 생성**

```
node_modules/
.superpowers/
*.json.bak
```

- [ ] **Step 2: README.md 생성**

```markdown
# KendoBracket

검도 대회 대진표 운영 시스템. 브라우저만으로 동작하는 완전 오프라인 웹 앱.

## 사용법

1. `index.html`을 Chrome/Edge에서 열기 (로컬 파일 직접 오픈 가능)
2. 대회명 입력 → 체급 추가 → 선수/팀 등록
3. "대진표 자동 생성" 클릭
4. "전광판 열기 ↗" → 별도 창/모니터에 `display.html` 표출
5. 경기 결과 입력: 대진표 칸 클릭 → 점수 입력 → 전광판 자동 업데이트

## 개발

```bash
npm install
npm test        # 브라켓 생성 + 승패 계산 유닛 테스트
```

## 데이터 백업

좌측 패널 하단 "JSON 내보내기"로 현재 상태 저장. "JSON 불러오기"로 복원.
```

- [ ] **Step 3: 전체 테스트 재실행**

```bash
npm test
```

Expected: PASS (전체 테스트)

- [ ] **Step 4: 최종 커밋**

```bash
git add .gitignore README.md
git commit -m "chore: add .gitignore and README"
```

---

## 자체 검토 체크리스트

- [x] **스펙 커버리지**
  - 체급 탭 + 독립 대진표: Task 6
  - SVG 브라켓 렌더링: Task 7
  - 개인전 경기 결과 + 진출 처리: Task 9
  - 단체전 팀 관리 + 라인업 DnD: Task 9
  - 전광판 3모드: Task 10
  - localStorage 동기화: Task 10, 12
  - JSON 내보내기/불러오기: Task 11
  - 풀스크린 + 자동슬라이드: Task 10 (display-ui.js)
  - 대진표 선수 위치 교환 DnD: Task 8
  - 승패 계산 (표준 검도 규정): Task 4
  - 대표전(tiebreaker): Task 4 scoring.js + Task 9 saveTeamResult
- [x] **타입 일관성**
  - `match.player1/player2` (개인전), `match.team1/team2` (단체전) 분리 사용
  - `calcTeamMatchResult` 반환값 `{ winner, wins1, wins2 }` → Task 4 정의, Task 9에서 사용
  - `advanceWinner(bracket, matchId, winnerId, mutate)` → Task 3 정의, Task 9에서 사용
  - `EMPTY_DIVISION()` → Task 2 정의, Task 6에서 사용
