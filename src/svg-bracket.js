// src/svg-bracket.js

const MATCH_W = 170;
const MATCH_H = 48;
const ROUND_GAP = 50;
const SLOT_GAP = 6;          // 한 경기 안 두 선수 슬롯 사이 여백
const V_GAP = 26;             // 1라운드 경기 박스 사이 세로 간격
const SLOT = MATCH_H + V_GAP; // 1라운드 한 칸 높이 (박스 + 간격)
const V_PAD = 20;
const H_PAD = 20;

function matchY(roundNo, matchIdx) {
  const step = SLOT * Math.pow(2, roundNo - 1);
  const offset = (step - MATCH_H) / 2;
  return V_PAD + matchIdx * step + offset;
}

function matchX(roundNo) {
  return H_PAD + (roundNo - 1) * (MATCH_W + ROUND_GAP);
}

function totalHeight(totalRounds) {
  const firstRoundMatches = Math.pow(2, totalRounds - 1);
  return V_PAD * 2 + firstRoundMatches * SLOT;
}

function totalWidth(totalRounds) {
  return H_PAD * 2 + totalRounds * (MATCH_W + ROUND_GAP);
}

function getParticipantName(participantId, division) {
  if (participantId === 'bye') return 'BYE';
  if (!participantId) return '—';
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

export function renderBracketSVG(division, container, zoom = 1) {
  container.innerHTML = '';
  const { rounds } = division.bracket;
  if (!rounds.length) return;

  const totalRounds = rounds.length;
  const svgW = totalWidth(totalRounds);
  const svgH = totalHeight(totalRounds);

  // viewBox는 고정하고 표시 크기(width/height)만 zoom배로 — 스크롤 영역이 함께 커진다
  const svg = createSVGEl('svg', {
    viewBox: `0 0 ${svgW} ${svgH}`,
    width: svgW * zoom,
    height: svgH * zoom,
    class: 'bracket-svg',
  });

  // Round labels
  rounds.forEach(round => {
    const x = matchX(round.roundNo) + MATCH_W / 2;
    const label = createSVGEl('text', {
      x, y: 14,
      'text-anchor': 'middle',
      'font-size': 12,
      'font-weight': 600,
      fill: '#cbd5e1',
    });
    label.textContent = round.label;
    svg.appendChild(label);
  });

  // Connector lines + match boxes
  rounds.forEach(round => {
    round.matches.forEach((match, mi) => {
      const x = matchX(round.roundNo);
      const y = matchY(round.roundNo, mi);

      // Line to next round
      if (round.roundNo < totalRounds) {
        const nextMi = Math.floor(mi / 2);
        const nx = matchX(round.roundNo + 1);
        const ny = matchY(round.roundNo + 1, nextMi) + MATCH_H / 2;
        const midX = x + MATCH_W + ROUND_GAP / 2;

        const path = createSVGEl('path', {
          d: `M ${x + MATCH_W} ${y + MATCH_H / 2} L ${midX} ${y + MATCH_H / 2} L ${midX} ${ny} L ${nx} ${ny}`,
          fill: 'none',
          stroke: '#374151',
          'stroke-width': 1,
        });
        svg.appendChild(path);
      }

      renderMatchBox(svg, match, x, y, division);
    });
  });

  container.appendChild(svg);
}

function renderMatchBox(svg, match, x, y, division) {
  const isBye   = (id) => id === 'bye';
  const isEmpty = (id) => !id;
  const p1Id = match.type === 'team' ? match.team1 : match.player1;
  const p2Id = match.type === 'team' ? match.team2 : match.player2;

  const boxH = (MATCH_H - SLOT_GAP) / 2;

  [p1Id, p2Id].forEach((pId, slot) => {
    const slotY = y + slot * (boxH + SLOT_GAP);
    const isWinner = match.winner === pId;
    const isByeSlot = isBye(pId);
    const isEmptySlot = isEmpty(pId);
    const isOngoing = match.status === 'ongoing' && !isByeSlot && !isEmptySlot;

    let fill = '#1a1a2e';
    let stroke = '#4b5563';
    let textColor = '#94a3b8';

    if (isByeSlot || isEmptySlot) {
      stroke = '#4b5563';
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
      ...(isByeSlot ? { 'stroke-dasharray': '4,2' } : isEmptySlot ? { 'stroke-dasharray': '4,2' } : {}),
      class: isOngoing ? 'match-ongoing' : '',
    });
    svg.appendChild(rect);

    const name = getParticipantName(pId, division);
    const score = slot === 0 ? match.score1 : match.score2;

    const text = createSVGEl('text', {
      x: x + 8,
      y: slotY + boxH / 2 + 4,
      'font-size': 13,
      fill: textColor,
    });
    text.textContent = isByeSlot ? 'BYE' : isEmptySlot ? '—' : name;
    svg.appendChild(text);

    if (!isByeSlot && !isEmptySlot && match.status !== 'pending') {
      const scoreText = createSVGEl('text', {
        x: x + MATCH_W - 10,
        y: slotY + boxH / 2 + 4,
        'font-size': 13,
        'font-weight': 'bold',
        'text-anchor': 'end',
        fill: textColor,
      });
      scoreText.textContent = score ?? '';
      svg.appendChild(scoreText);
    }
  });

  // Transparent click overlay (entire match box)
  const overlay = createSVGEl('rect', {
    x, y,
    width: MATCH_W, height: MATCH_H,
    fill: 'transparent',
    'data-match-id': match.id,
    style: 'cursor:pointer',
  });
  svg.appendChild(overlay);
}
