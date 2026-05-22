// src/display-ui.js
import { loadState, getState } from './state.js';
import { renderBracketSVG } from './svg-bracket.js';

let _autoSlideTimer = null;
const _modes = ['current', 'bracket', 'result'];
let _modeIdx = 0;
let _storageListenerAttached = false;

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function initDisplay() {
  loadState();
  bindDisplayEvents();
  renderDisplay();

  if (!_storageListenerAttached) {
    _storageListenerAttached = true;
    window.addEventListener('storage', e => {
      if (e.key === 'kendo_state') {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) { Object.assign(getState(), parsed); renderDisplay(); }
        } catch (_) {}
      }
    });
  }
}

export function renderDisplay() {
  const state = getState();

  // Header title
  const titleEl = document.getElementById('display-title');
  if (titleEl) titleEl.textContent = state.meta.title || 'KendoBracket';

  // Mode button active states
  ['current', 'bracket', 'result'].forEach(mode => {
    const btn = document.getElementById(`btn-mode-${mode}`);
    if (btn) btn.classList.toggle('active', state.display.mode === mode);
  });

  // Auto-slide checkbox
  const cb = document.getElementById('cb-autoslide');
  if (cb) cb.checked = state.display.autoSlide;

  // Content area
  const content = document.getElementById('display-content');
  if (!content) return;

  content.innerHTML = '';
  content.classList.remove('display-fade-in');
  void content.offsetWidth; // force reflow for animation restart
  content.classList.add('display-fade-in');

  switch (state.display.mode) {
    case 'current':  renderCurrentMatch(state, content); break;
    case 'bracket':  renderBracketMode(state, content); break;
    case 'result':   renderResultHighlight(state, content); break;
  }

  // Auto-slide timer management
  if (_autoSlideTimer) { clearInterval(_autoSlideTimer); _autoSlideTimer = null; }
  if (state.display.autoSlide) {
    _autoSlideTimer = setInterval(() => {
      // Local mode advance — not persisted to localStorage (display-only slide show)
      _modeIdx = (_modeIdx + 1) % _modes.length;
      getState().display.mode = _modes[_modeIdx];
      renderDisplay();
    }, state.display.slideInterval ?? 10000);
  }
}

function getMatchById(state, matchId) {
  if (!matchId) return null;
  for (const div of state.divisions) {
    for (const round of div.bracket.rounds) {
      const match = round.matches.find(m => m.id === matchId);
      if (match) return { match, div, round };
    }
  }
  return null;
}

function getParticipantInfo(id, div) {
  if (id === 'bye') return { name: 'BYE', club: '' };
  if (!id) return { name: '미정', club: '' };
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
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:24px">경기를 지정해 주세요</div>';
    return;
  }
  const { match, div, round } = found;

  const p1Id = match.type === 'team' ? match.team1 : match.player1;
  const p2Id = match.type === 'team' ? match.team2 : match.player2;
  const p1 = getParticipantInfo(p1Id, div);
  const p2 = getParticipantInfo(p2Id, div);

  const teamWinsHtml = match.type === 'team' ? `
    <div style="text-align:center;color:var(--text-muted);font-size:18px;padding:8px 0">
      팀 승수: <strong style="color:var(--accent-blue)">${match.wins1 ?? 0}</strong>
      &nbsp;:&nbsp;
      <strong style="color:var(--accent-blue)">${match.wins2 ?? 0}</strong>
    </div>` : '';

  const liveBadge = match.status === 'ongoing'
    ? '<span class="live-badge">● LIVE</span>'
    : match.status === 'done'
    ? '<span class="ended-badge">종료</span>'
    : '';

  container.innerHTML = `
    <div id="current-match-view">
      <div class="current-match-header">
        ${escHtml(state.meta.title)} &nbsp;—&nbsp; ${escHtml(round.label)}
        ${liveBadge}
      </div>
      ${teamWinsHtml}
      <div class="current-match-players">
        <div class="player-side">
          <div class="player-name">${escHtml([...p1.name].join(' '))}</div>
          ${p1.club ? `<div class="player-club">${escHtml(p1.club)}</div>` : ''}
          <div class="player-score">${match.score1 ?? 0}</div>
          <div class="player-score-label">본</div>
        </div>
        <div class="player-side">
          <div class="player-name">${escHtml([...p2.name].join(' '))}</div>
          ${p2.club ? `<div class="player-club">${escHtml(p2.club)}</div>` : ''}
          <div class="player-score">${match.score2 ?? 0}</div>
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

  // Division tabs (only if multiple divisions exist)
  if (state.divisions.length > 1) {
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:6px;padding:8px 16px;';
    state.divisions.forEach((d, i) => {
      const tab = document.createElement('span');
      tab.textContent = d.name || `그룹 ${i + 1}`;
      tab.style.cssText = i === state.activeDivision
        ? 'background:#1e3a5f;border:1px solid var(--accent-blue);color:var(--accent-blue);padding:3px 10px;border-radius:4px;font-size:12px;'
        : 'background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);padding:3px 10px;border-radius:4px;font-size:12px;';
      tabs.appendChild(tab);
    });
    wrapper.appendChild(tabs);
  }

  const svgContainer = document.createElement('div');
  svgContainer.style.cssText = 'padding:16px;overflow:auto';
  renderBracketSVG(div, svgContainer);
  wrapper.appendChild(svgContainer);
  container.appendChild(wrapper);
}

function renderResultHighlight(state, container) {
  let lastDone = null, lastDiv = null, lastRound = null;
  let nextPending = null, nextDiv = null, nextRound = null;

  for (const div of state.divisions) {
    for (const round of div.bracket.rounds) {
      for (const match of round.matches) {
        if (match.status === 'done' && match.winner) {
          lastDone = match; lastDiv = div; lastRound = round;
        }
        if (match.status === 'pending' && !nextPending) {
          nextPending = match; nextDiv = div; nextRound = round;
        }
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
    const winnerSide = lastDone.winner === p1Id ? 'p1' : 'p2';

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-card-label">방금 종료 — ${escHtml(lastRound.label)}</div>
      <div class="result-score-row">
        <div class="result-player-name" style="color:${winnerSide === 'p1' ? 'var(--text-primary)' : 'var(--text-muted)'}">${escHtml(p1.name)}</div>
        <div class="result-score-nums">
          <span class="${winnerSide === 'p1' ? 'winner-score' : 'loser-score'}">${lastDone.score1 ?? 0}</span>
          <span class="sep">:</span>
          <span class="${winnerSide === 'p2' ? 'winner-score' : 'loser-score'}">${lastDone.score2 ?? 0}</span>
        </div>
        <div class="result-player-name" style="color:${winnerSide === 'p2' ? 'var(--text-primary)' : 'var(--text-muted)'};text-align:right">${escHtml(p2.name)}</div>
      </div>
    `;
    wrapper.appendChild(card);
  }

  if (nextPending && nextDiv) {
    const p1Id = nextPending.type === 'team' ? nextPending.team1 : nextPending.player1;
    const p2Id = nextPending.type === 'team' ? nextPending.team2 : nextPending.player2;
    const p1 = getParticipantInfo(p1Id, nextDiv);
    const p2 = getParticipantInfo(p2Id, nextDiv);

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-card-label">▶ 다음 경기 — ${escHtml(nextRound.label)}</div>
      <div class="result-score-row" style="justify-content:center;gap:24px">
        <div class="result-player-name">${escHtml(p1.name)}</div>
        <div style="font-size:20px;color:var(--text-muted)">vs</div>
        <div class="result-player-name">${escHtml(p2.name)}</div>
      </div>
    `;
    wrapper.appendChild(card);
  }

  if (!lastDone && !nextPending) {
    wrapper.innerHTML = '<p style="color:var(--text-muted)">아직 결과가 없습니다</p>';
  }

  container.appendChild(wrapper);
}

function bindDisplayEvents() {
  // Display page mutates state directly (no saveState/localStorage write).
  // The display page is read-only — mode changes here are local only.
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
