// src/match-modal.js
import { getState, getActiveDivision, updateState } from './state.js';
import { calcIndividualWinner, calcTeamBoutWinner, calcTeamMatchResult } from './scoring.js';
import { advanceWinner } from './bracket-engine.js';

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function clampScore(value, min = 0, max = 10) {
  const n = parseInt(value, 10) || 0;
  return Math.max(min, Math.min(max, n));
}

// 점수 입력용 +/− 스테퍼
function scoreStepper({ id, value, cls = '', min = 0, max = 10, size = 'lg' }) {
  return `<div class="score-stepper score-stepper-${size}">
    <button type="button" class="step-btn" data-target="${id}" data-delta="-1" aria-label="감소">−</button>
    <input id="${id}" class="score-display${cls ? ' ' + cls : ''}" value="${value}" data-min="${min}" data-max="${max}" readonly inputmode="numeric">
    <button type="button" class="step-btn" data-target="${id}" data-delta="1" aria-label="증가">+</button>
  </div>`;
}

function statusBadge(status) {
  const map = {
    pending: `<span class="status-badge status-pending">대기중</span>`,
    ongoing: `<span class="status-badge status-ongoing">● 진행중</span>`,
    done:    `<span class="status-badge status-done">✓ 종료</span>`,
  };
  return map[status] ?? '';
}

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

// ─── 개인전 모달 ──────────────────────────────────────────────

function renderIndividualMatchModal(match, div) {
  const p1Name = getParticipantName(match.player1, div);
  const p2Name = getParticipantName(match.player2, div);
  const status = match.status ?? 'pending';

  let bodyHtml = '';
  let buttonsHtml = '';

  if (status === 'done') {
    const w = match.winner;
    bodyHtml = `
      <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin:20px 0">
        <div style="text-align:center;flex:1">
          <div style="font-size:18px;font-weight:bold;margin-bottom:8px;color:${w === match.player1 ? '#22c55e' : 'var(--text-muted)'}">${escHtml(p1Name)}</div>
          <div style="font-size:52px;font-weight:bold;color:${w === match.player1 ? '#22c55e' : 'var(--text-primary)'}">${match.score1 ?? 0}</div>
        </div>
        <div style="font-size:28px;color:var(--text-muted)">:</div>
        <div style="text-align:center;flex:1">
          <div style="font-size:18px;font-weight:bold;margin-bottom:8px;color:${w === match.player2 ? '#22c55e' : 'var(--text-muted)'}">${escHtml(p2Name)}</div>
          <div style="font-size:52px;font-weight:bold;color:${w === match.player2 ? '#22c55e' : 'var(--text-primary)'}">${match.score2 ?? 0}</div>
        </div>
      </div>
      ${!w ? '<p style="text-align:center;color:var(--text-muted);font-size:13px">무승부 — 승자 없음</p>' : ''}`;
    buttonsHtml = `
      <button id="btn-modal-cancel">닫기</button>
      <button id="btn-match-reedit" style="background:#1e3a5f;border-color:#3b6ca8;color:#7eb8f7">재편집</button>`;

  } else if (status === 'ongoing') {
    bodyHtml = `
      <div style="display:flex;align-items:center;gap:16px;justify-content:center">
        <div style="text-align:center;flex:1">
          <div style="font-size:18px;font-weight:bold;margin-bottom:12px">${escHtml(p1Name)}</div>
          ${scoreStepper({ id: 'score1', value: match.score1 ?? 0 })}
        </div>
        <div style="font-size:24px;color:var(--text-muted)">:</div>
        <div style="text-align:center;flex:1">
          <div style="font-size:18px;font-weight:bold;margin-bottom:12px">${escHtml(p2Name)}</div>
          ${scoreStepper({ id: 'score2', value: match.score2 ?? 0 })}
        </div>
      </div>`;
    buttonsHtml = `
      <button id="btn-modal-cancel">취소</button>
      <button id="btn-match-save" style="background:#1e3a5f;border-color:#3b6ca8;color:#7eb8f7">저장</button>
      <button id="btn-modal-confirm" style="background:#14532d;border-color:#22c55e;color:#86efac">✓ 경기 종료</button>`;

  } else {
    // pending
    bodyHtml = `
      <div style="display:flex;align-items:center;gap:24px;justify-content:center;margin:28px 0">
        <div style="text-align:center;flex:1">
          <div style="font-size:22px;font-weight:bold">${escHtml(p1Name)}</div>
        </div>
        <div style="font-size:22px;color:var(--text-muted)">vs</div>
        <div style="text-align:center;flex:1">
          <div style="font-size:22px;font-weight:bold">${escHtml(p2Name)}</div>
        </div>
      </div>`;
    buttonsHtml = `
      <button id="btn-modal-cancel">취소</button>
      <button id="btn-match-start" class="btn-match-start">▶ 경기 시작</button>`;
  }

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="margin:0">개인전</h3>
      ${statusBadge(status)}
    </div>
    ${bodyHtml}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
      ${buttonsHtml}
    </div>
  `;
}

// ─── 단체전 모달 ──────────────────────────────────────────────

function renderTeamMatchModal(match, div) {
  const t1 = div.teams.find(t => t.id === match.team1);
  const t2 = div.teams.find(t => t.id === match.team2);
  if (!t1 || !t2) return '<p>팀 정보를 찾을 수 없습니다.</p>';

  const status = match.status ?? 'pending';
  if (status === 'done') return renderTeamDoneModal(match, div, t1, t2);
  return renderTeamActiveModal(match, div, t1, t2, status);
}

function renderTeamDoneModal(match, div, t1, t2) {
  const boutRows = (match.bouts ?? []).map((bout, i) => {
    const pos = div.positions[i] ?? `${i + 1}`;
    const w1 = bout.winner === 'team1';
    const w2 = bout.winner === 'team2';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span style="width:32px;color:var(--text-muted);font-size:11px">${escHtml(pos)}</span>
        <span style="flex:1;color:${w1 ? '#22c55e' : 'var(--text-muted)'}">${bout.score1 ?? 0}본</span>
        <span style="color:var(--text-muted)">:</span>
        <span style="flex:1;color:${w2 ? '#22c55e' : 'var(--text-muted)'};text-align:right">${bout.score2 ?? 0}본</span>
      </div>`;
  }).join('');

  const winnerTeam = match.winner === t1.id ? t1 : match.winner === t2.id ? t2 : null;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="margin:0">단체전</h3>
      ${statusBadge('done')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:bold;margin-bottom:12px">
      <span style="color:${match.winner === t1.id ? '#22c55e' : 'var(--text-muted)'}">${escHtml(t1.name)}</span>
      <span style="font-size:28px;color:var(--text-primary)">${match.wins1 ?? 0} : ${match.wins2 ?? 0}</span>
      <span style="color:${match.winner === t2.id ? '#22c55e' : 'var(--text-muted)'};text-align:right">${escHtml(t2.name)}</span>
    </div>
    ${boutRows ? `<div style="margin-bottom:12px">${boutRows}</div>` : ''}
    ${winnerTeam
      ? `<p style="text-align:center;color:#22c55e;font-weight:bold;margin:8px 0">🏆 ${escHtml(winnerTeam.name)} 승</p>`
      : '<p style="text-align:center;color:var(--text-muted);font-size:13px">승자 없음</p>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button id="btn-modal-cancel">닫기</button>
      <button id="btn-match-reedit" style="background:#1e3a5f;border-color:#3b6ca8;color:#7eb8f7">재편집</button>
    </div>
  `;
}

function renderTeamActiveModal(match, div, t1, t2, status) {
  const lineup1 = match.lineup1?.length ? match.lineup1 : t1.lastLineup?.length ? t1.lastLineup : t1.roster.map(p => p.id);
  const lineup2 = match.lineup2?.length ? match.lineup2 : t2.lastLineup?.length ? t2.lastLineup : t2.roster.map(p => p.id);
  const getP = (team, id) => team.roster.find(p => p.id === id);
  const totalSize = div.teamSize;

  const makeLineup = (lineup, teamNum) => lineup.map((pid, i) => {
    const p = getP(teamNum === 1 ? t1 : t2, pid);
    return `<div class="lineup-item" draggable="true" data-team="${teamNum}" data-idx="${i}" data-pid="${pid}"
      style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;cursor:grab">
      <span style="color:var(--text-muted);font-size:11px">⠿</span>
      <span style="color:var(--text-muted);font-size:10px;width:28px">${escHtml(div.positions[i] ?? String(i + 1))}</span>
      <span style="font-size:12px">${escHtml(p?.name ?? pid)}</span>
    </div>`;
  }).join('');

  const boutsHtml = status === 'ongoing' ? `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">대결 결과</div>
      ${div.positions.slice(0, totalSize).map((pos, i) => {
        const bout = match.bouts?.[i] ?? { score1: 0, score2: 0 };
        return `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="width:32px;font-size:11px;color:var(--text-muted)">${escHtml(pos)}</span>
            <span style="flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(getP(t1, lineup1[i])?.name ?? '-')}</span>
            ${scoreStepper({ id: `bout-${i}-s1`, value: bout.score1, cls: 'bout-score1', size: 'sm' })}
            <span style="color:var(--text-muted)">:</span>
            ${scoreStepper({ id: `bout-${i}-s2`, value: bout.score2, cls: 'bout-score2', size: 'sm' })}
            <span style="flex:1;min-width:0;font-size:13px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(getP(t2, lineup2[i])?.name ?? '-')}</span>
          </div>`;
      }).join('')}
    </div>` : '';

  const buttons = status === 'pending'
    ? `<button id="btn-modal-cancel">취소</button>
       <button id="btn-match-start" class="btn-match-start">▶ 경기 시작</button>`
    : `<button id="btn-modal-cancel">취소</button>
       <button id="btn-match-save" style="background:#1e3a5f;border-color:#3b6ca8;color:#7eb8f7">저장</button>
       <button id="btn-modal-confirm" style="background:#14532d;border-color:#22c55e;color:#86efac">✓ 경기 종료</button>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="margin:0">단체전</h3>
      ${statusBadge(status)}
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;color:var(--text-muted);font-size:13px">
      <span>${escHtml(t1.name)}</span><span>${escHtml(t2.name)}</span>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">라인업 (드래그로 순서 변경)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${escHtml(t1.name)}</div>
          <div id="lineup-t1" style="display:flex;flex-direction:column;gap:3px">${makeLineup(lineup1, 1)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${escHtml(t2.name)}</div>
          <div id="lineup-t2" style="display:flex;flex-direction:column;gap:3px">${makeLineup(lineup2, 2)}</div>
        </div>
      </div>
    </div>

    ${boutsHtml}

    <div style="display:flex;gap:8px;justify-content:flex-end">
      ${buttons}
    </div>
  `;
}

// ─── 위임 리스너 (한 번만 등록) ───────────────────────────────

let _modalDelegatesBound = false;
function ensureModalDelegates() {
  if (_modalDelegatesBound) return;
  _modalDelegatesBound = true;

  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeMatchModal();
  });

  document.getElementById('modal-box')?.addEventListener('click', e => {
    const btn = e.target.closest('.step-btn');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const next = (parseInt(input.value, 10) || 0) + Number(btn.dataset.delta);
    input.value = String(clampScore(next, Number(input.dataset.min), Number(input.dataset.max)));
  });
}

function bindModalEvents(matchId, matchType, div) {
  ensureModalDelegates();

  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeMatchModal);

  // 경기 시작 (pending → ongoing, 전광판 현재경기 자동 지정)
  document.getElementById('btn-match-start')?.addEventListener('click', () => {
    saveMatchStart(matchId);
  });

  // 저장 (진행중 점수 반영, 모달 유지)
  document.getElementById('btn-match-save')?.addEventListener('click', () => {
    if (matchType === 'individual') saveIndividualProgress(matchId);
    else saveTeamProgress(matchId, div);
  });

  // 경기 종료 (점수 확정 + done)
  document.getElementById('btn-modal-confirm')?.addEventListener('click', () => {
    if (matchType === 'individual') saveIndividualResult(matchId);
    else saveTeamResult(matchId, div);
  });

  // 재편집 (done → ongoing, 모달 재오픈)
  document.getElementById('btn-match-reedit')?.addEventListener('click', () => {
    updateState(s => {
      const d = s.divisions[s.activeDivision];
      const m = d.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
      if (m) m.status = 'ongoing';
    });
    openMatchModal(matchId);
  });

  // 라인업 드래그앤드롭 (단체전)
  if (matchType === 'team') {
    setupLineupDragDrop('lineup-t1', div.positions);
    setupLineupDragDrop('lineup-t2', div.positions);
  }
}

// ─── 저장 함수들 ─────────────────────────────────────────────

function saveMatchStart(matchId) {
  closeMatchModal();
  updateState(s => {
    const d = s.divisions[s.activeDivision];
    const m = d.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!m || m.status !== 'pending') return;
    m.status = 'ongoing';
    s.display.currentMatchId = matchId; // 전광판 현재경기 자동 지정
  });
}

function saveIndividualProgress(matchId) {
  // 모달을 닫지 않고 점수만 state에 반영 (전광판 실시간 갱신)
  const score1 = clampScore(document.getElementById('score1')?.value ?? 0);
  const score2 = clampScore(document.getElementById('score2')?.value ?? 0);
  updateState(s => {
    const d = s.divisions[s.activeDivision];
    const m = d.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!m) return;
    m.score1 = score1;
    m.score2 = score2;
    // status는 ongoing 유지
  });
}

function saveIndividualResult(matchId) {
  const score1 = clampScore(document.getElementById('score1')?.value ?? 0);
  const score2 = clampScore(document.getElementById('score2')?.value ?? 0);
  closeMatchModal();
  updateState(s => {
    const d = s.divisions[s.activeDivision];
    const m = d.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!m) return;
    m.score1 = score1;
    m.score2 = score2;
    m.winner = calcIndividualWinner(m);
    m.status = 'done';
    if (m.winner) advanceWinner(d.bracket, matchId, m.winner, true);
  });
}

function saveTeamProgress(matchId, div) {
  // 라인업 + 개별 승부 점수 저장, status는 ongoing 유지
  const score1Inputs = document.querySelectorAll('.bout-score1');
  const score2Inputs = document.querySelectorAll('.bout-score2');
  const lineup1 = Array.from(document.querySelectorAll('#lineup-t1 .lineup-item')).map(el => el.dataset.pid);
  const lineup2 = Array.from(document.querySelectorAll('#lineup-t2 .lineup-item')).map(el => el.dataset.pid);

  updateState(s => {
    const activDiv = s.divisions[s.activeDivision];
    const m = activDiv.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!m) return;
    m.lineup1 = lineup1;
    m.lineup2 = lineup2;
    if (score1Inputs.length > 0 && score1Inputs.length === score2Inputs.length) {
      m.bouts = Array.from(score1Inputs).map((inp, i) => {
        const s1 = clampScore(inp.value);
        const s2 = clampScore(score2Inputs[i]?.value ?? 0);
        const bout = { score1: s1, score2: s2, winner: null, status: 'ongoing', position: activDiv.positions[i] ?? `포지션${i + 1}` };
        bout.winner = calcTeamBoutWinner(bout);
        return bout;
      });
      const result = calcTeamMatchResult(m);
      m.wins1 = result.wins1;
      m.wins2 = result.wins2;
      m.score1 = result.wins1;
      m.score2 = result.wins2;
    }
    // status 는 ongoing 유지
  });
}

function saveTeamResult(matchId, div) {
  const score1Inputs = document.querySelectorAll('.bout-score1');
  const score2Inputs = document.querySelectorAll('.bout-score2');
  if (score1Inputs.length !== score2Inputs.length) return;

  const lineup1 = Array.from(document.querySelectorAll('#lineup-t1 .lineup-item')).map(el => el.dataset.pid);
  const lineup2 = Array.from(document.querySelectorAll('#lineup-t2 .lineup-item')).map(el => el.dataset.pid);

  closeMatchModal();
  updateState(s => {
    const activDiv = s.divisions[s.activeDivision];
    const m = activDiv.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!m) return;

    m.lineup1 = lineup1;
    m.lineup2 = lineup2;
    m.bouts = Array.from(score1Inputs).map((inp, i) => {
      const s1 = clampScore(inp.value);
      const s2 = clampScore(score2Inputs[i]?.value ?? 0);
      const bout = { score1: s1, score2: s2, winner: null, status: 'done', position: activDiv.positions[i] ?? `포지션${i + 1}` };
      bout.winner = calcTeamBoutWinner(bout);
      return bout;
    });

    const result = calcTeamMatchResult(m);
    m.wins1 = result.wins1;
    m.wins2 = result.wins2;
    m.score1 = result.wins1;
    m.score2 = result.wins2;

    if (result.winner && result.winner !== 'tiebreaker') {
      m.winner = result.winner;
      m.status = 'done';
      advanceWinner(activDiv.bracket, matchId, m.winner, true);
      const team1 = activDiv.teams.find(t => t.id === m.team1);
      if (team1) team1.lastLineup = [...lineup1];
    } else if (result.winner === 'tiebreaker') {
      m.status = 'ongoing';
      alert('승수·본수 동점! 대표전이 필요합니다. 대표전 결과 입력 후 다시 저장하세요.');
    } else {
      m.status = 'ongoing';
    }
  });
}

// ─── 라인업 드래그앤드롭 ─────────────────────────────────────

function setupLineupDragDrop(containerId, positions) {
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
      container.querySelectorAll('.lineup-item').forEach((el, i) => {
        el.dataset.idx = i;
        const posLabel = el.querySelector('span:nth-child(2)');
        if (posLabel) posLabel.textContent = positions[i] ?? String(i + 1);
      });
      dragIdx = null;
    });
    item.addEventListener('dragend', () => { dragIdx = null; });
  });
}
