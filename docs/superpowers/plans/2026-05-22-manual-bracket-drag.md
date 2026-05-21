# 수동 대진 편성 + 드래그 Ghost 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 명단에서 선수/팀을 브라켓 슬롯으로 직접 드래그해 대진을 편성할 수 있고, 모든 드래그 동작에 ghost 피드백과 드롭존 강조가 표시된다.

**Architecture:** `src/drag-ghost.js`로 ghost DOM 유틸을 분리하고, admin-ui.js에 모듈 레벨 드래그 상태(`_bracketDragSource`, `_rosterDragSource`)를 두어 `bindAdminEvents`의 단일 document-level `pointermove`/`pointerup`으로 모든 드래그를 처리한다. `generateEmptyBracket`을 bracket-engine.js에 추가해 수동 편성용 빈 브라켓 구조를 생성한다.

**Tech Stack:** Vanilla JS ES6 modules, Pointer Events API, Jest 29 + Babel 7

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/drag-ghost.js` | **신규** — ghost DOM 생성·이동·제거 |
| `src/bracket-engine.js` | `generateEmptyBracket(count, type)` 추가 |
| `src/svg-bracket.js` | `getParticipantName`: null → `'—'` (빈 슬롯 표시) |
| `src/admin-ui.js` | 모듈 레벨 드래그 상태, setupRosterDragSource, global pointer 리스너, 버튼 추가, 명단 dimmed |
| `tests/bracket-engine.test.js` | `generateEmptyBracket` 테스트 추가 |
| `tests/drag-ghost.test.js` | **신규** — ghost 유틸 단위 테스트 |

---

### Task 1: drag-ghost.js 모듈

**Files:**
- Create: `src/drag-ghost.js`
- Create: `tests/drag-ghost.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// tests/drag-ghost.test.js
/**
 * @jest-environment jsdom
 */
import { createGhost, moveGhost, removeGhost } from '../src/drag-ghost.js';

describe('drag-ghost', () => {
  afterEach(() => {
    removeGhost();
  });

  test('createGhost: body에 #drag-ghost 요소 추가', () => {
    createGhost('홍길동 (서울)');
    const el = document.getElementById('drag-ghost');
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('홍길동 (서울)');
  });

  test('createGhost: 중복 호출 시 ghost는 항상 1개', () => {
    createGhost('A');
    createGhost('B');
    expect(document.querySelectorAll('#drag-ghost')).toHaveLength(1);
    expect(document.getElementById('drag-ghost').textContent).toBe('B');
  });

  test('moveGhost: left/top 스타일 업데이트', () => {
    createGhost('테스트');
    moveGhost(100, 200);
    const el = document.getElementById('drag-ghost');
    expect(el.style.left).toBe('114px');  // 100 + 14
    expect(el.style.top).toBe('190px');   // 200 - 10
  });

  test('moveGhost: ghost 없을 때 에러 없이 통과', () => {
    expect(() => moveGhost(0, 0)).not.toThrow();
  });

  test('removeGhost: 요소 제거', () => {
    createGhost('삭제 테스트');
    removeGhost();
    expect(document.getElementById('drag-ghost')).toBeNull();
  });

  test('removeGhost: 반복 호출해도 에러 없음', () => {
    expect(() => { removeGhost(); removeGhost(); }).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
npx jest tests/drag-ghost.test.js --no-coverage
```

Expected: `Cannot find module '../src/drag-ghost.js'`

- [ ] **Step 3: drag-ghost.js 구현**

```js
// src/drag-ghost.js

let _ghost = null;

export function createGhost(label) {
  removeGhost();
  _ghost = document.createElement('div');
  _ghost.id = 'drag-ghost';
  _ghost.textContent = label;
  _ghost.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:9999',
    'background:#1e3a5f',
    'border:2px solid #3b82f6',
    'color:#93c5fd',
    'padding:4px 10px',
    'border-radius:4px',
    'font-size:12px',
    'font-family:inherit',
    'box-shadow:3px 3px 10px rgba(0,0,0,0.6)',
    'transform:rotate(2deg)',
    'white-space:nowrap',
  ].join(';');
  document.body.appendChild(_ghost);
}

export function moveGhost(x, y) {
  if (!_ghost) return;
  _ghost.style.left = (x + 14) + 'px';
  _ghost.style.top  = (y - 10) + 'px';
}

export function removeGhost() {
  if (_ghost) { _ghost.remove(); _ghost = null; }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest tests/drag-ghost.test.js --no-coverage
```

Expected: 6 tests passing

- [ ] **Step 5: 커밋**

```bash
git add src/drag-ghost.js tests/drag-ghost.test.js
git commit -m "feat: drag-ghost 유틸 모듈 추가"
```

---

### Task 2: generateEmptyBracket + svg-bracket null 표시

**Files:**
- Modify: `src/bracket-engine.js` (끝에 함수 추가)
- Modify: `src/svg-bracket.js` (getParticipantName 1줄 수정)
- Modify: `tests/bracket-engine.test.js` (테스트 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/bracket-engine.test.js` 파일 **끝에** 다음 `describe` 블록 추가:

```js
import {
  nextPowerOfTwo,
  generateBracket,
  generateTeamBracket,
  advanceWinner,
  generateEmptyBracket,   // 새로 추가
} from '../src/bracket-engine.js';

// ... 기존 테스트들 유지 ...

describe('generateEmptyBracket', () => {
  test('4명 → 2라운드, 1라운드 2경기, 모든 슬롯 null', () => {
    const b = generateEmptyBracket(4, 'individual');
    expect(b.rounds).toHaveLength(2);
    expect(b.rounds[0].matches).toHaveLength(2);
    b.rounds[0].matches.forEach(m => {
      expect(m.player1).toBeNull();
      expect(m.player2).toBeNull();
      expect(m.status).toBe('pending');
    });
  });

  test('3명 → nextPowerOfTwo(3)=4 크기 브라켓 생성', () => {
    const b = generateEmptyBracket(3, 'individual');
    expect(b.rounds).toHaveLength(2);
    expect(b.rounds[0].matches).toHaveLength(2);
  });

  test('type=team → team1/team2 필드, lineup/bouts 포함', () => {
    const b = generateEmptyBracket(2, 'team');
    const m = b.rounds[0].matches[0];
    expect(m.team1).toBeNull();
    expect(m.team2).toBeNull();
    expect(Array.isArray(m.bouts)).toBe(true);
    expect(Array.isArray(m.lineup1)).toBe(true);
    expect(m.type).toBe('team');
  });

  test('roundNo, label 필드 포함', () => {
    const b = generateEmptyBracket(4, 'individual');
    expect(b.rounds[0].roundNo).toBe(1);
    expect(typeof b.rounds[0].label).toBe('string');
    expect(b.rounds[1].label).toBe('결승');
  });

  test('각 경기 id는 고유', () => {
    const b = generateEmptyBracket(8, 'individual');
    const ids = b.rounds.flatMap(r => r.matches.map(m => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
npx jest tests/bracket-engine.test.js --no-coverage
```

Expected: `generateEmptyBracket is not a function`

- [ ] **Step 3: generateEmptyBracket 구현**

`src/bracket-engine.js` 파일 끝에 추가:

```js
export function generateEmptyBracket(count, type = 'individual') {
  const size = nextPowerOfTwo(Math.max(count, 2));
  const totalRounds = Math.log2(size);
  const rounds = [];

  for (let r = 1; r <= totalRounds; r++) {
    const matchCount = size / Math.pow(2, r);
    const matches = Array.from({ length: matchCount }, () => {
      const m = {
        id: makeMatchId(),
        type,
        score1: 0, score2: 0,
        winner: null,
        status: 'pending',
      };
      if (type === 'team') {
        m.team1 = null; m.team2 = null;
        m.lineup1 = []; m.lineup2 = [];
        m.bouts = []; m.tiebreaker = null;
        m.wins1 = 0; m.wins2 = 0;
      } else {
        m.player1 = null; m.player2 = null;
      }
      return m;
    });
    rounds.push({ roundNo: r, label: roundLabel(totalRounds, r), matches });
  }
  return { rounds };
}
```

- [ ] **Step 4: svg-bracket.js — null 슬롯 표시 수정**

`src/svg-bracket.js` 28~29번 줄의 `getParticipantName` 첫 줄 수정:

```js
// 수정 전:
function getParticipantName(participantId, division) {
  if (!participantId || participantId === 'bye') return 'BYE';

// 수정 후:
function getParticipantName(participantId, division) {
  if (participantId === 'bye') return 'BYE';
  if (!participantId) return '—';
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest --no-coverage
```

Expected: 모든 테스트(기존 29 + 신규 5 = 34개) PASS

- [ ] **Step 6: 커밋**

```bash
git add src/bracket-engine.js src/svg-bracket.js tests/bracket-engine.test.js
git commit -m "feat: generateEmptyBracket 추가, 빈 슬롯 '—' 표시"
```

---

### Task 3: Ghost 피드백 — 브라켓 슬롯 스왑 적용

기존 `setupBracketDragDrop`을 재구성해 모듈 레벨 상태와 document-level 리스너로 전환하고, 슬롯 드래그 시 ghost가 나타나게 한다.

**Files:**
- Modify: `src/admin-ui.js`

- [ ] **Step 1: import 추가**

`src/admin-ui.js` 1번 줄 import 목록에 추가:

```js
// 수정 전:
import { getState, getActiveDivision, updateState, EMPTY_DIVISION } from './state.js';
import { renderBracketSVG } from './svg-bracket.js';
import { generateBracket, generateTeamBracket } from './bracket-engine.js';

// 수정 후:
import { getState, getActiveDivision, updateState, EMPTY_DIVISION } from './state.js';
import { renderBracketSVG } from './svg-bracket.js';
import { generateBracket, generateTeamBracket, generateEmptyBracket } from './bracket-engine.js';
import { createGhost, moveGhost, removeGhost } from './drag-ghost.js';
```

- [ ] **Step 2: 모듈 레벨 드래그 상태 + 헬퍼 추가**

`escHtml` 함수 선언 바로 아래(7번 줄 이후)에 추가:

```js
// --- 드래그 공유 상태 ---
let _bracketDragSource = null; // { matchId, slot: 0|1 }
let _rosterDragSource  = null; // { id, label }
let _hoveredOverlay    = null; // 현재 강조 중인 SVG overlay 요소

function getParticipantLabel(id, div) {
  if (!id || id === 'bye') return id === 'bye' ? 'BYE' : '—';
  if (div.type === 'individual') {
    const p = div.players.find(p => p.id === id);
    return p ? `${p.name}${p.club ? ' (' + p.club + ')' : ''}` : '?';
  }
  return div.teams.find(t => t.id === id)?.name ?? '?';
}

function getPlacedParticipantIds(div) {
  const ids = new Set();
  if (!div.bracket?.rounds) return ids;
  const k1 = div.type === 'team' ? 'team1' : 'player1';
  const k2 = div.type === 'team' ? 'team2' : 'player2';
  div.bracket.rounds.flatMap(r => r.matches).forEach(m => {
    if (m[k1] && m[k1] !== 'bye') ids.add(m[k1]);
    if (m[k2] && m[k2] !== 'bye') ids.add(m[k2]);
  });
  return ids;
}

function highlightOverlay(el) {
  if (_hoveredOverlay === el) return;
  clearOverlayHighlight();
  if (!el) return;
  _hoveredOverlay = el;
  el.setAttribute('fill', 'rgba(59,130,246,0.18)');
  el.setAttribute('stroke', '#3b82f6');
  el.setAttribute('stroke-width', '2');
  el.setAttribute('stroke-dasharray', '5,3');
}

function clearOverlayHighlight() {
  if (!_hoveredOverlay) return;
  _hoveredOverlay.setAttribute('fill', 'transparent');
  _hoveredOverlay.removeAttribute('stroke');
  _hoveredOverlay.removeAttribute('stroke-width');
  _hoveredOverlay.removeAttribute('stroke-dasharray');
  _hoveredOverlay = null;
}
```

- [ ] **Step 3: setupBracketDragDrop 재구성**

기존 `setupBracketDragDrop` 함수 전체를 아래로 교체:

```js
function setupBracketDragDrop(container, division) {
  container.querySelectorAll('[data-match-id]').forEach(el => {
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', e => {
      const rect = el.getBoundingClientRect();
      const slot = e.clientY < rect.top + rect.height / 2 ? 0 : 1;
      const k1 = division.type === 'team' ? 'team1' : 'player1';
      const k2 = division.type === 'team' ? 'team2' : 'player2';
      const allMatches = division.bracket.rounds.flatMap(r => r.matches);
      const match = allMatches.find(m => m.id === el.dataset.matchId);
      const participantId = match?.[slot === 0 ? k1 : k2];
      const label = participantId ? getParticipantLabel(participantId, division) : '—';

      _bracketDragSource = { matchId: el.dataset.matchId, slot };
      createGhost(label);
      moveGhost(e.clientX, e.clientY);
      e.preventDefault();
    });
  });

  // container-level pointerup/pointercancel 제거 (document-level로 통합)
  if (container._bracketPointerUp) {
    container.removeEventListener('pointerup', container._bracketPointerUp);
    container._bracketPointerUp = null;
  }
  if (container._bracketPointerCancel) {
    container.removeEventListener('pointercancel', container._bracketPointerCancel);
    container._bracketPointerCancel = null;
  }
}
```

- [ ] **Step 4: bindAdminEvents에 document-level 리스너 추가**

`bindAdminEvents` 함수 첫 번째 줄(`const root = document;`) 바로 뒤에 추가:

```js
  // --- 전역 포인터 이벤트 (ghost 이동 + 드롭 처리) ---
  document.addEventListener('pointermove', e => {
    if (!_bracketDragSource && !_rosterDragSource) return;
    moveGhost(e.clientX, e.clientY);
    // 드롭 가능 오버레이 강조
    const hits = document.elementsFromPoint(e.clientX, e.clientY);
    const overlay = hits.find(el => el.dataset?.matchId) ?? null;
    highlightOverlay(overlay);
  });

  document.addEventListener('pointerup', e => {
    const hadBracket = !!_bracketDragSource;
    const hadRoster  = !!_rosterDragSource;

    if (hadBracket) {
      const src = _bracketDragSource;
      _bracketDragSource = null;

      const hits = document.elementsFromPoint(e.clientX, e.clientY);
      const targetEl = hits.find(el => el.dataset?.matchId);
      if (targetEl) {
        const targetMatchId = targetEl.dataset.matchId;
        const rect = targetEl.getBoundingClientRect();
        const targetSlot = e.clientY < rect.top + rect.height / 2 ? 0 : 1;
        if (src.matchId !== targetMatchId || src.slot !== targetSlot) {
          updateState(s => {
            const div = s.divisions[s.activeDivision];
            const allMatches = div.bracket.rounds.flatMap(r => r.matches);
            const srcMatch = allMatches.find(m => m.id === src.matchId);
            const tgtMatch = allMatches.find(m => m.id === targetMatchId);
            if (!srcMatch || !tgtMatch) return;
            if (srcMatch.type !== tgtMatch.type) return;
            const isTeam = srcMatch.type === 'team';
            const slots = isTeam ? ['team1', 'team2'] : ['player1', 'player2'];
            const srcKey = slots[src.slot];
            const tgtKey = slots[targetSlot];
            [srcMatch[srcKey], tgtMatch[tgtKey]] = [tgtMatch[tgtKey], srcMatch[srcKey]];
          });
        }
      }
    }

    if (hadRoster) {
      const src = _rosterDragSource;
      _rosterDragSource = null;

      const hits = document.elementsFromPoint(e.clientX, e.clientY);
      const targetEl = hits.find(el => el.dataset?.matchId);
      if (targetEl) {
        const matchId = targetEl.dataset.matchId;
        const rect = targetEl.getBoundingClientRect();
        const slot = e.clientY < rect.top + rect.height / 2 ? 0 : 1;
        updateState(s => {
          const div = s.divisions[s.activeDivision];
          const allMatches = div.bracket.rounds.flatMap(r => r.matches);
          const match = allMatches.find(m => m.id === matchId);
          if (!match || match.status === 'done') return;
          const key = div.type === 'team'
            ? (slot === 0 ? 'team1' : 'team2')
            : (slot === 0 ? 'player1' : 'player2');
          // 슬롯이 비어 있거나 BYE일 때만 배치
          if (match[key] && match[key] !== 'bye') return;
          // 이미 다른 슬롯에 배치된 선수면 무시
          const placed = getPlacedParticipantIds(div);
          if (placed.has(src.id)) return;
          match[key] = src.id;
        });
      }
    }

    removeGhost();
    clearOverlayHighlight();
  });

  document.addEventListener('pointercancel', () => {
    _bracketDragSource = null;
    _rosterDragSource  = null;
    removeGhost();
    clearOverlayHighlight();
  });
```

- [ ] **Step 5: 브라우저에서 수동 확인**

```bash
python -m http.server 8080
```

1. 선수 4명 추가 → 자동 생성 → 브라켓에서 선수를 드래그
2. 커서 옆에 파란 ghost 박스가 이름과 함께 따라다니는지 확인
3. 다른 슬롯 위에 올리면 파란 점선 강조되는지 확인
4. 드롭하면 위치가 바뀌는지 확인

- [ ] **Step 6: 커밋**

```bash
git add src/admin-ui.js
git commit -m "feat: 드래그 ghost 피드백 + 전역 포인터 리스너 통합"
```

---

### Task 4: 명단 dimmed 표시 + 드래그 소스 연결

**Files:**
- Modify: `src/admin-ui.js`

- [ ] **Step 1: renderPlayerList에 data 속성 + dimmed 스타일 추가**

`src/admin-ui.js`의 `renderPlayerList` 함수에서 `item.dataset.playerId = p.id;` 부분을 찾아 아래와 같이 수정:

```js
function renderPlayerList(div, container) {
  container.innerHTML = '';
  const placedIds = getPlacedParticipantIds(div);
  div.players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'roster-item';
    item.dataset.playerId = p.id;
    item.dataset.rosterId    = p.id;
    item.dataset.rosterLabel = p.club ? `${p.name} (${p.club})` : p.name;
    const placed = placedIds.has(p.id);
    item.style.opacity = placed ? '0.4' : '1';
    item.style.cursor  = placed ? 'default' : 'grab';
    item.innerHTML = `
      <span style="color:var(--text-muted);font-size:10px;width:16px">${i + 1}</span>
      <span style="flex:1">${escHtml(p.name)}</span>
      <span style="color:var(--text-muted);font-size:11px">${escHtml(p.club)}</span>
      <div class="move-btns">
        <button data-action="up" data-idx="${i}">↑</button>
        <button data-action="down" data-idx="${i}">↓</button>
      </div>
      <button class="delete-btn" data-action="delete" data-idx="${i}">✕</button>
    `;
    container.appendChild(item);
  });
}
```

- [ ] **Step 2: renderTeamList 전체 교체**

`src/admin-ui.js`의 `renderTeamList` 함수 전체를 아래로 교체:

```js
function renderTeamList(div, container) {
  container.innerHTML = '';
  const placedIds = getPlacedParticipantIds(div);
  div.teams.forEach((team, ti) => {
    const placed = placedIds.has(team.id);
    const item = document.createElement('div');
    item.dataset.rosterId    = team.id;
    item.dataset.rosterLabel = team.name;
    item.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:8px;margin-bottom:6px';
    item.style.opacity = placed ? '0.4' : '1';
    item.style.cursor  = placed ? 'default' : 'grab';
    item.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <strong style="font-size:12px">${escHtml(team.name)}</strong>
        <button class="delete-btn" data-action="delete-team" data-idx="${ti}">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${team.roster.map((p, pi) => `
          <div style="display:flex;gap:4px;align-items:center;font-size:11px;color:var(--text-muted)">
            <span style="width:30px">${div.positions[pi] ?? `포지션${pi+1}`}</span>
            <span style="flex:1;color:var(--text-primary)">${escHtml(p.name)}</span>
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
```

- [ ] **Step 3: setupRosterDragSource 함수 추가**

`setupBracketDragDrop` 함수 바로 아래에 추가:

```js
function setupRosterDragSource(rosterContainer) {
  rosterContainer.addEventListener('pointerdown', e => {
    const item = e.target.closest('[data-roster-id]');
    if (!item) return;
    if (parseFloat(item.style.opacity) < 0.5) return; // 이미 배치됨
    _rosterDragSource = {
      id:    item.dataset.rosterId,
      label: item.dataset.rosterLabel,
    };
    createGhost(_rosterDragSource.label);
    moveGhost(e.clientX, e.clientY);
    e.preventDefault();
  });
}
```

- [ ] **Step 4: renderRosterSection 전체 교체 — setupRosterDragSource 호출 포함**

`src/admin-ui.js`의 `renderRosterSection` 함수 전체를 아래로 교체:

```js
function renderRosterSection(state) {
  const div = getActiveDivision();
  const container = document.getElementById('roster-list');
  const actionsContainer = document.getElementById('roster-actions');
  if (!container || !actionsContainer) return;

  if (!div) { container.innerHTML = ''; actionsContainer.innerHTML = ''; return; }

  if (div.type === 'individual') {
    renderPlayerList(div, container);
    setupRosterDragSource(container);
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
    setupRosterDragSource(container);
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
```

(Task 5 Step 1에서 버튼 레이아웃을 최종 수정하므로 여기서는 기존 버튼 유지)

- [ ] **Step 5: 브라우저에서 수동 확인**

```bash
python -m http.server 8080
```

1. 선수 4명 추가 → 자동 생성
2. 명단에서 선수 이름 위에 마우스 올리면 커서가 `grab`인지 확인
3. 드래그 시작 시 ghost 박스 나타나는지 확인 (브라켓에 드롭 안 해도 됨)

- [ ] **Step 6: 커밋**

```bash
git add src/admin-ui.js
git commit -m "feat: 명단 dimmed 표시 + 드래그 소스 연결"
```

---

### Task 5: 수동 편성 버튼 + 명단 → 브라켓 드롭

**Files:**
- Modify: `src/admin-ui.js`

- [ ] **Step 1: renderRosterSection — 버튼 추가**

개인전 `actionsContainer.innerHTML` 템플릿에서 버튼 부분 수정:

```js
// 수정 전:
        <button id="btn-add-player">+ 선수 추가</button>
        <button id="btn-generate-bracket">대진표 자동 생성</button>

// 수정 후:
        <button id="btn-add-player">+ 선수 추가</button>
        <div style="display:flex;gap:4px">
          <button id="btn-generate-bracket" style="flex:1">자동 생성</button>
          <button id="btn-empty-bracket" style="flex:1;background:var(--bg-card);border-color:var(--accent-blue);color:var(--accent-blue)">수동 편성</button>
        </div>
```

단체전 `actionsContainer.innerHTML`도 동일하게 수정:

```js
// 수정 전:
        <button id="btn-add-team">+ 팀 추가</button>
        <button id="btn-generate-bracket">대진표 자동 생성</button>

// 수정 후:
        <button id="btn-add-team">+ 팀 추가</button>
        <div style="display:flex;gap:4px">
          <button id="btn-generate-bracket" style="flex:1">자동 생성</button>
          <button id="btn-empty-bracket" style="flex:1;background:var(--bg-card);border-color:var(--accent-blue);color:var(--accent-blue)">수동 편성</button>
        </div>
```

- [ ] **Step 2: bindAdminEvents — btn-empty-bracket 핸들러 추가**

기존 `// 대진표 자동 생성` 핸들러 바로 뒤에 추가:

```js
  // 수동 편성 — 빈 대진표 생성
  root.addEventListener('click', e => {
    if (e.target.id !== 'btn-empty-bracket') return;
    const div = getActiveDivision();
    if (!div) return;
    const count = div.type === 'individual' ? div.players.length : div.teams.length;
    if (count < 2) {
      alert('참가자가 2명 이상이어야 합니다.');
      return;
    }
    if (div.bracket?.rounds?.length) {
      if (!confirm('기존 대진표를 지우고 수동 편성을 시작할까요?')) return;
    }
    updateState(s => {
      s.divisions[s.activeDivision].bracket = generateEmptyBracket(count, s.divisions[s.activeDivision].type);
    });
  });
```

- [ ] **Step 3: 브라우저 통합 테스트**

```bash
python -m http.server 8080
```

시나리오 1 — 수동 편성 전체 흐름:
1. 선수 4명 추가 (홍길동/김철수/이영희/박민수)
2. **수동 편성** 버튼 클릭 → 브라켓에 `—` 슬롯 4개 생성 확인
3. 명단에서 홍길동 드래그 → 브라켓 1라운드 첫 슬롯에 드롭
4. 홍길동이 배치되고 명단에서 흐리게(dimmed) 표시 확인
5. 나머지 3명도 배치 → 대진 완성 확인

시나리오 2 — 드롭존 강조:
1. 수동 편성 버튼 클릭
2. 명단에서 드래그 시작 → ghost 나타남, 브라켓 슬롯 위에 마우스 올리면 파란 점선 강조 확인

시나리오 3 — 이미 배치된 선수 중복 방지:
1. 홍길동 배치 후 → 명단의 홍길동 카드 dimmed 확인
2. dimmed 카드를 드래그 시도 → ghost 안 나타나는 것 확인

시나리오 4 — 기존 자동 생성 + 슬롯 스왑 ghost:
1. 자동 생성 버튼으로 브라켓 생성
2. 브라켓에서 슬롯 드래그 → ghost + 점선 강조 확인
3. 다른 슬롯에 드롭 → 위치 바뀜 확인

- [ ] **Step 4: 전체 테스트 통과 확인**

```bash
npx jest --no-coverage
```

Expected: 34개 테스트 모두 PASS

- [ ] **Step 5: 커밋 + push**

```bash
git add src/admin-ui.js
git commit -m "feat: 수동 대진 편성 — 빈 대진표 생성 + 명단→브라켓 드래그 완성"
git push
```
