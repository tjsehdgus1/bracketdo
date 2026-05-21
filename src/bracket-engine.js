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

  // BYE 오브젝트
  const byeObj = { id: 'bye', name: 'BYE', club: '' };

  // BYE가 실제 선수와만 대전하도록 pair 단위로 구성
  // byeCount < size/2 (항상 성립: size = nextPowerOfTwo(n), n >= size/2 이므로)
  const pairs = [];
  let realIdx = 0;
  let byeAdded = 0;
  for (let i = 0; i < size / 2; i++) {
    const p1 = shuffled[realIdx++];
    const p2 = byeAdded < byeCount ? byeObj : shuffled[realIdx++];
    if (p2 === byeObj) byeAdded++;
    pairs.push([p1, p2]);
  }

  // 1라운드 경기 생성
  const firstRoundMatches = pairs.map(([p1, p2]) => {
    const isBye1 = p1.id === 'bye';
    const isBye2 = p2.id === 'bye';
    return {
      id: makeMatchId(),
      type: 'individual',
      player1: p1.id,
      player2: p2.id,
      score1: 0,
      score2: 0,
      winner: isBye2 ? p1.id : isBye1 ? p2.id : null,
      status: (isBye1 || isBye2) ? 'done' : 'pending',
    };
  });

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
      m.team1 = m.player1 ?? null;
      m.team2 = m.player2 ?? null;
      delete m.player1;
      delete m.player2;
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

  for (let ri = 0; ri < target.rounds.length - 1; ri++) {
    const matches = target.rounds[ri].matches;
    const matchIdx = matches.findIndex(m => m.id === matchId);
    if (matchIdx === -1) continue;

    const nextRound = target.rounds[ri + 1];
    const nextMatchIdx = Math.floor(matchIdx / 2);
    const nextMatch = nextRound.matches[nextMatchIdx];
    const isTeam = nextMatch.type === 'team';
    const slot = matchIdx % 2 === 0 ? (isTeam ? 'team1' : 'player1') : (isTeam ? 'team2' : 'player2');
    nextMatch[slot] = winnerId;
    break;
  }
  return target;
}
