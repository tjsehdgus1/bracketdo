# 수동 대진 편성 + 드래그 Ghost 피드백 설계

## Goal

관리자 화면에서 선수/팀을 명단에서 브라켓 슬롯으로 직접 드래그해 대진을 편성할 수 있게 한다. 드래그 중에는 ghost 요소와 드롭존 강조로 시각적 피드백을 제공한다.

## Architecture

기존 Pointer Events 기반 DnD(`setupBracketDragDrop`)를 확장하고, 명단에 새로운 드래그 소스 역할을 추가한다. 새 함수 `setupRosterDragSource`가 명단 아이템에 pointerdown을 연결하고, ghost 생성·이동·제거는 별도 모듈 `drag-ghost.js`로 분리한다. 상태 변경은 기존 `updateState → renderAll` 패턴을 그대로 따른다.

## Tech Stack

- Vanilla JS, Pointer Events API (기존과 동일)
- `src/drag-ghost.js` 신규 파일 (ghost DOM 관리)
- `src/admin-ui.js` 수정 (버튼 추가, 명단 드래그 소스, 브라켓 드롭존)
- `src/bracket-engine.js` 수정 (`generateEmptyBracket(count, type)` 추가)

---

## 상세 설계

### 1. drag-ghost.js

ghost 요소를 생성·이동·제거하는 순수 DOM 유틸.

```js
// src/drag-ghost.js

let _ghost = null;

export function createGhost(label) {
  removeGhost();
  _ghost = document.createElement('div');
  _ghost.id = 'drag-ghost';
  _ghost.textContent = label;
  _ghost.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    background: #1e3a5f;
    border: 2px solid #3b82f6;
    color: #93c5fd;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    box-shadow: 3px 3px 10px rgba(0,0,0,0.6);
    transform: rotate(2deg);
    white-space: nowrap;
  `;
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

### 2. bracket-engine.js — generateEmptyBracket

선수/팀 배치 없이 구조만 있는 브라켓 생성. 기존 `generateBracket`을 참고하되, 모든 participant를 null로 채운다.

```js
export function generateEmptyBracket(count, type = 'individual') {
  // count: 실제 참가자 수 (nextPowerOfTwo로 올림)
  const size = nextPowerOfTwo(Math.max(count, 2));
  const totalRounds = Math.log2(size);
  const rounds = [];
  for (let r = 1; r <= totalRounds; r++) {
    const matchCount = size / Math.pow(2, r);
    const matches = [];
    for (let i = 0; i < matchCount; i++) {
      const id = `m${r}_${i}`;
      const match = {
        id, round: r, index: i, type,
        status: 'pending', winner: null,
        score1: 0, score2: 0,
      };
      if (r === 1) {
        // 1라운드만 슬롯 노출 (나머지는 진출 대기)
        if (type === 'team') {
          match.team1 = null;
          match.team2 = null;
        } else {
          match.player1 = null;
          match.player2 = null;
        }
      } else {
        if (type === 'team') { match.team1 = null; match.team2 = null; }
        else { match.player1 = null; match.player2 = null; }
      }
      matches.push(match);
    }
    rounds.push({ round: r, matches });
  }
  return { rounds };
}
```

### 3. admin-ui.js — "빈 대진표 생성" 버튼

`renderRosterSection`에서 기존 "대진표 자동 생성" 버튼 옆에 추가.

```html
<button id="btn-generate-bracket">자동 생성</button>
<button id="btn-empty-bracket">수동 편성</button>
```

이벤트 핸들러:
```js
root.addEventListener('click', e => {
  if (e.target.id === 'btn-empty-bracket') {
    const div = getActiveDivision();
    const count = div.type === 'individual' ? div.players.length : div.teams.length;
    if (count < 2) { alert('참가자가 2명 이상이어야 합니다'); return; }
    if (div.bracket?.rounds?.length) {
      if (!confirm('기존 대진표를 지우고 수동 편성을 시작할까요?')) return;
    }
    updateState(s => {
      const d = s.divisions[s.activeDivision];
      d.bracket = generateEmptyBracket(count, d.type);
    });
  }
});
```

### 4. 명단 → 브라켓 드래그 소스

`renderPlayerList` / `renderTeamList`에서 각 아이템에 `data-roster-id` 추가, 배치 여부에 따라 dimmed 스타일 적용.

```js
// renderPlayerList 수정
function renderPlayerList(div, container) {
  const placedIds = getPlacedParticipantIds(div); // 브라켓에 배치된 ID 집합
  div.players.forEach((p, i) => {
    const placed = placedIds.has(p.id);
    item.dataset.rosterId = p.id;
    item.dataset.rosterLabel = `${p.name}${p.club ? ' (' + p.club + ')' : ''}`;
    item.style.opacity = placed ? '0.4' : '1';
    item.style.cursor  = placed ? 'default' : 'grab';
  });
}

// 배치된 참가자 ID 집합 도출 (state에서 계산)
function getPlacedParticipantIds(div) {
  const ids = new Set();
  if (!div.bracket?.rounds) return ids;
  div.bracket.rounds.flatMap(r => r.matches).forEach(m => {
    const k1 = div.type === 'team' ? 'team1' : 'player1';
    const k2 = div.type === 'team' ? 'team2' : 'player2';
    if (m[k1] && m[k1] !== 'bye') ids.add(m[k1]);
    if (m[k2] && m[k2] !== 'bye') ids.add(m[k2]);
  });
  return ids;
}
```

`setupRosterDragSource(container, div)` — 명단 컨테이너에 포인터 이벤트 연결:

```js
function setupRosterDragSource(rosterContainer) {
  rosterContainer.addEventListener('pointerdown', e => {
    const item = e.target.closest('[data-roster-id]');
    if (!item || item.style.opacity === '0.4') return;
    currentRosterDrag = {
      id: item.dataset.rosterId,
      label: item.dataset.rosterLabel,
    };
    createGhost(currentRosterDrag.label);
    moveGhost(e.clientX, e.clientY);
    item.style.opacity = '0.4';
    e.preventDefault();
  });
}
```

`pointermove` / `pointerup`은 document 레벨에서 한 번만 등록. `bindAdminEvents`는 최초 1회만 호출되므로 별도 플래그 불필요. ghost 이동:

```js
// bindAdminEvents() 내부에서 1회 등록
document.addEventListener('pointermove', e => {
  moveGhost(e.clientX, e.clientY);
  // 드롭 hover 강조 처리도 여기서
});
document.addEventListener('pointerup', e => {
  // 명단 드래그 처리
  // 브라켓 스왑 처리
  removeGhost();
});
```

### 5. 브라켓 드롭존 강조 + 드롭 처리

`setupBracketDragDrop` 확장: `pointermove`에서 현재 커서 아래 `[data-match-id]`를 찾아 hover 강조(파란 점선 클래스 `drag-over` 추가), `pointerup`에서 명단 드래그인지 브라켓 스왑인지 구분해 처리.

```js
// SVG overlay는 CSS outline 미지원 → JS로 직접 stroke 변경
// pointerover 시: overlay.setAttribute('stroke', '#3b82f6'); overlay.setAttribute('stroke-dasharray', '4');
// pointerleave 시: overlay.removeAttribute('stroke'); overlay.removeAttribute('stroke-dasharray');

// pointerup 시 명단 드래그 처리:
if (currentRosterDrag) {
  const hits = document.elementsFromPoint(e.clientX, e.clientY);
  const targetOverlay = hits.find(el => el.dataset?.matchId);
  if (targetOverlay) {
    const matchId = targetOverlay.dataset.matchId;
    updateState(s => {
      const div = s.divisions[s.activeDivision];
      const allMatches = div.bracket.rounds.flatMap(r => r.matches);
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;
      const rect = targetOverlay.getBoundingClientRect();
      const slot = e.clientY < rect.top + rect.height / 2 ? 0 : 1;
      const key = div.type === 'team'
        ? (slot === 0 ? 'team1' : 'team2')
        : (slot === 0 ? 'player1' : 'player2');
      // 이미 다른 선수가 있으면 배치 불가 (이미 완료된 경기 포함)
      if (match[key] && match[key] !== 'bye') return;
      match[key] = currentRosterDrag.id;
    });
  }
  currentRosterDrag = null;
  removeGhost();
}
```

### 6. Ghost — 브라켓 슬롯 스왑에도 적용

기존 `setupBracketDragDrop`의 `pointerdown` 핸들러에서 `createGhost(participantName)` 호출, `pointermove`에서 `moveGhost`, `pointerup`/`pointercancel`에서 `removeGhost`.

참가자 이름은 admin-ui.js 내부 헬퍼로 직접 조회한다 (svg-bracket.js에 의존하지 않음):

```js
function getParticipantLabel(id, div) {
  if (!id || id === 'bye') return 'BYE';
  if (div.type === 'individual') {
    const p = div.players.find(p => p.id === id);
    return p ? `${p.name}${p.club ? ' (' + p.club + ')' : ''}` : '?';
  }
  return div.teams.find(t => t.id === id)?.name ?? '?';
}
```

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/drag-ghost.js` | 신규 — ghost DOM 유틸 |
| `src/bracket-engine.js` | `generateEmptyBracket` 추가 |
| `src/admin-ui.js` | 버튼 추가, 명단 dimmed 표시, setupRosterDragSource, 브라켓 드롭존, ghost 적용 |
| `style.css` | `.drag-over` 스타일, 빈 슬롯 점선 stroke |

---

## 엣지 케이스

- 이미 경기가 진행된 슬롯에는 드롭 불가 (`match.status === 'done'`이면 무시)
- 동일 참가자가 브라켓에 두 번 배치되는 것 방지: 드롭 전에 해당 ID가 이미 브라켓에 있으면 조용히(silently) 무시 (alert 없음 — 명단에서 이미 dimmed로 표시됐으므로 사용자가 인지하고 있는 상태)
- "빈 대진표 생성" 시 참가자 수 < 2이면 alert
- 빈 슬롯(null)이 남아 있는 상태에서 경기 결과 입력은 기존 로직대로 허용 (null은 BYE처럼 동작)
