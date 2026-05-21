// src/svg-bracket.js

const MATCH_W = 170;
const MATCH_H = 44;
const ROUND_GAP = 50;
const V_PAD = 20;
const H_PAD = 20;

function matchY(roundNo, matchIdx) {
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

  // Round labels
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
      class: isOngoing ? 'match-ongoing' : '',
    });
    svg.appendChild(rect);

    const name = getParticipantName(pId, division);
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
      scoreText.textContent = score ?? '';
      svg.appendChild(scoreText);
    }
  });

  // Transparent click overlay (entire match box)
  const overlay = createSVGEl('rect', {
    x, y,
    width: MATCH_W, height: MATCH_H - 2,
    fill: 'transparent',
    'data-match-id': match.id,
    style: 'cursor:pointer',
  });
  svg.appendChild(overlay);
}
