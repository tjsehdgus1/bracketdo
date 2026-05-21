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
  const allDone = match.bouts.length > 0 && match.bouts.every(b => b.status === 'done');
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
