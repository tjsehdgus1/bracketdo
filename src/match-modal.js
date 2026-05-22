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

// 점수 입력용 +/− 스테퍼. 큰 탭 영역으로 키보드 없이 점수 조정.
// 저장 로직이 값을 읽을 수 있도록 input의 id/class는 그대로 유지한다.
function scoreStepper({ id, value, cls = '', min = 0, max = 10, size = 'lg' }) {
  return `<div class="score-stepper score-stepper-${size}">
    <button type="button" class="step-btn" data-target="${id}" data-delta="-1" aria-label="감소">−</button>
    <input id="${id}" class="score-display${cls ? ' ' + cls : ''}" value="${value}" data-min="${min}" data-max="${max}" readonly inputmode="numeric">
    <button type="button" class="step-btn" data-target="${id}" data-delta="1" aria-label="증가">+</button>
  </div>`;
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

function renderIndividualMatchModal(match, div) {
  const p1Name = getParticipantName(match.player1, div);
  const p2Name = getParticipantName(match.player2, div);
  return `
    <h3 style="margin-bottom:16px">경기 결과 입력</h3>
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

  const lineup1 = match.lineup1?.length ? match.lineup1 : t1.lastLineup?.length ? t1.lastLineup : t1.roster.map(p => p.id);
  const lineup2 = match.lineup2?.length ? match.lineup2 : t2.lastLineup?.length ? t2.lastLineup : t2.roster.map(p => p.id);

  const getPlayerById = (team, id) => team.roster.find(p => p.id === id);
  const totalSize = div.teamSize;

  const boutsHtml = div.positions.slice(0, totalSize).map((pos, i) => {
    const bout = match.bouts?.[i] ?? { score1: 0, score2: 0, winner: null, status: 'pending' };
    const p1 = getPlayerById(t1, lineup1[i]);
    const p2 = getPlayerById(t2, lineup2[i]);
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="width:32px;font-size:11px;color:var(--text-muted)">${pos}</span>
        <span style="flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(p1?.name ?? '-')}">${escHtml(p1?.name ?? '-')}</span>
        ${scoreStepper({ id: `bout-${i}-s1`, value: bout.score1, cls: 'bout-score1', size: 'sm' })}
        <span style="color:var(--text-muted)">:</span>
        ${scoreStepper({ id: `bout-${i}-s2`, value: bout.score2, cls: 'bout-score2', size: 'sm' })}
        <span style="flex:1;min-width:0;font-size:13px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(p2?.name ?? '-')}">${escHtml(p2?.name ?? '-')}</span>
      </div>
    `;
  }).join('');

  return `
    <h3 style="margin-bottom:4px">단체전 결과 입력</h3>
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;color:var(--text-muted);font-size:13px">
      <span>${escHtml(t1.name)}</span><span>${escHtml(t2.name)}</span>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">라인업 (드래그로 순서 변경)</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${escHtml(t1.name)}</div>
      <div id="lineup-t1" style="display:flex;flex-direction:column;gap:3px">
        ${lineup1.map((pid, i) => {
          const p = getPlayerById(t1, pid);
          return `<div class="lineup-item" draggable="true" data-team="1" data-idx="${i}" data-pid="${pid}"
            style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;cursor:grab">
            <span style="color:var(--text-muted);font-size:11px">⠿</span>
            <span style="color:var(--text-muted);font-size:10px;width:28px">${div.positions[i] ?? i+1}</span>
            <span style="font-size:12px">${escHtml(p?.name ?? pid)}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:8px">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${escHtml(t2.name)}</div>
        <div id="lineup-t2" style="display:flex;flex-direction:column;gap:3px">
          ${lineup2.map((pid, i) => {
            const p = getPlayerById(t2, pid);
            return `<div class="lineup-item" draggable="true" data-team="2" data-idx="${i}" data-pid="${pid}"
              style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;cursor:grab">
              <span style="color:var(--text-muted);font-size:11px">⠿</span>
              <span style="color:var(--text-muted);font-size:10px;width:28px">${escHtml(div.positions[i] ?? String(i+1))}</span>
              <span style="font-size:12px">${escHtml(p?.name ?? pid)}</span>
            </div>`;
          }).join('')}
        </div>
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

// 지속 요소(#modal-overlay/#modal-box)에 한 번만 위임 리스너를 단다.
// 매 모달 오픈마다 달면 누적되고, { once:true }는 모달 내부 첫 클릭에 제거되어
// 점수 스테퍼 클릭 후 바깥 클릭 닫기가 동작하지 않게 된다.
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

  document.getElementById('btn-modal-confirm')?.addEventListener('click', () => {
    if (matchType === 'individual') saveIndividualResult(matchId);
    else saveTeamResult(matchId, div);
  });

  // 라인업 드래그앤드롭 (단체전)
  if (matchType === 'team') {
    setupLineupDragDrop('lineup-t1', div.positions);
    setupLineupDragDrop('lineup-t2', div.positions);
  }
}

function saveIndividualResult(matchId) {
  // Note: re-editing a completed match does NOT retract the previously advanced winner.
  // The next-round slot will retain the old winner until the tournament admin
  // manually adjusts it via bracket drag-and-drop.
  const score1 = Math.max(0, parseInt(document.getElementById('score1')?.value) || 0);
  const score2 = Math.max(0, parseInt(document.getElementById('score2')?.value) || 0);

  closeMatchModal();
  updateState(s => {
    const activDiv = s.divisions[s.activeDivision];
    const match = activDiv.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!match) return;
    match.score1 = score1;
    match.score2 = score2;
    match.winner = calcIndividualWinner(match);
    match.status = 'done';
    if (match.winner) {
      advanceWinner(activDiv.bracket, matchId, match.winner, true);
    }
  });
}

function saveTeamResult(matchId, div) {
  // Note: re-editing a completed match does NOT retract the previously advanced winner.
  // The next-round slot will retain the old winner until the tournament admin
  // manually adjusts it via bracket drag-and-drop.
  const score1Inputs = document.querySelectorAll('.bout-score1');
  const score2Inputs = document.querySelectorAll('.bout-score2');

  if (score1Inputs.length !== score2Inputs.length) return;

  const lineup1 = Array.from(document.querySelectorAll('#lineup-t1 .lineup-item')).map(el => el.dataset.pid);
  const lineup2 = Array.from(document.querySelectorAll('#lineup-t2 .lineup-item')).map(el => el.dataset.pid);

  closeMatchModal();
  updateState(s => {
    const activDiv = s.divisions[s.activeDivision];
    const match = activDiv.bracket.rounds.flatMap(r => r.matches).find(m => m.id === matchId);
    if (!match) return;

    match.lineup1 = lineup1;
    match.lineup2 = lineup2;
    match.bouts = Array.from(score1Inputs).map((inp, i) => {
      const s1 = Math.max(0, parseInt(inp.value) || 0);
      const s2 = Math.max(0, parseInt(score2Inputs[i]?.value) || 0);
      const bout = {
        score1: s1, score2: s2, winner: null, status: 'done',
        position: activDiv.positions[i] ?? `포지션${i+1}`,
      };
      bout.winner = calcTeamBoutWinner(bout);
      return bout;
    });

    const result = calcTeamMatchResult(match);
    match.wins1 = result.wins1;
    match.wins2 = result.wins2;
    match.score1 = result.wins1;
    match.score2 = result.wins2;

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
}

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
      // 인덱스 + 포지션 레이블 재할당
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
