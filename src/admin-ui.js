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
            style="${state.display.mode === m.value ? 'background:var(--bg-active);border-color:var(--accent-blue)' : ''}">
            ${m.label}
          </button>
        `).join('')}
      </div>
      <label for="cb-autoslide-admin" style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">
        <input type="checkbox" id="cb-autoslide-admin" ${state.display.autoSlide ? 'checked' : ''}>
        자동 슬라이드 (10초)
      </label>
    </div>
  `;
}

function renderBracketArea(state) {
  // SVG rendering added in Task 7
  const container = document.getElementById('bracket-container');
  if (!container) return;
  const div = getActiveDivision();
  if (!div || !div.bracket.rounds.length) {
    container.innerHTML = '<p style="color:var(--text-muted);margin:40px;text-align:center">대진표를 생성하세요</p>';
    return;
  }
  // SVG rendering will replace this placeholder in Task 7
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

  // 대진표 자동 생성
  root.addEventListener('click', e => {
    if (e.target.id === 'btn-generate-bracket') {
      updateState(s => {
        const div = s.divisions[s.activeDivision];
        if (div.type === 'individual') {
          if (div.players.length < 2) { alert('선수가 최소 2명 이상이어야 합니다.'); return; }
          // bracket generation will be wired in Task 7
        } else {
          if (div.teams.length < 2) { alert('팀이 최소 2개 이상이어야 합니다.'); return; }
          // bracket generation will be wired in Task 7
        }
      });
    }
  });
}
