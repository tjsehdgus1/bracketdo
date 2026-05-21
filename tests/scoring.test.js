import {
  calcIndividualWinner,
  calcTeamBoutWinner,
  calcTeamMatchResult,
} from '../src/scoring.js';

describe('calcIndividualWinner', () => {
  const base = { player1: 'p1', player2: 'p2' };

  test('player1이 높은 점수면 player1 반환', () => {
    expect(calcIndividualWinner({ ...base, score1: 2, score2: 1 })).toBe('p1');
  });
  test('player2가 높은 점수면 player2 반환', () => {
    expect(calcIndividualWinner({ ...base, score1: 0, score2: 2 })).toBe('p2');
  });
  test('동점이면 null 반환', () => {
    expect(calcIndividualWinner({ ...base, score1: 1, score2: 1 })).toBeNull();
  });
  test('0:0 동점이면 null 반환', () => {
    expect(calcIndividualWinner({ ...base, score1: 0, score2: 0 })).toBeNull();
  });
});

describe('calcTeamBoutWinner', () => {
  test('팀1 본수 높으면 team1', () => {
    expect(calcTeamBoutWinner({ score1: 2, score2: 0 })).toBe('team1');
  });
  test('팀2 본수 높으면 team2', () => {
    expect(calcTeamBoutWinner({ score1: 0, score2: 1 })).toBe('team2');
  });
  test('동점이면 null', () => {
    expect(calcTeamBoutWinner({ score1: 1, score2: 1 })).toBeNull();
  });
  test('0:0 동점이면 null', () => {
    expect(calcTeamBoutWinner({ score1: 0, score2: 0 })).toBeNull();
  });
});

describe('calcTeamMatchResult', () => {
  const makeMatch = (bouts) => ({
    team1: 't1', team2: 't2',
    bouts: bouts.map(([s1, s2]) => ({
      score1: s1, score2: s2,
      winner: s1 > s2 ? 'team1' : s2 > s1 ? 'team2' : null,
      status: 'done',
    })),
    tiebreaker: null,
  });

  test('팀1 승수 우세 → team1 승리', () => {
    const result = calcTeamMatchResult(makeMatch([[2,0],[0,1],[2,1],[0,0],[0,0]]));
    expect(result.winner).toBe('t1');
    expect(result.wins1).toBe(2);
    expect(result.wins2).toBe(1);
  });

  test('팀2 승수 우세 → team2 승리', () => {
    const result = calcTeamMatchResult(makeMatch([[0,2],[0,2],[2,0],[0,0],[0,0]]));
    expect(result.winner).toBe('t2');
  });

  test('승수 동점 + 팀1 본수 우세 → team1 승리', () => {
    // 각 2승 2패 1무, 팀1 본수 6 vs 팀2 본수 5
    const result = calcTeamMatchResult(makeMatch([[2,0],[0,2],[2,0],[1,2],[1,1]]));
    expect(result.winner).toBe('t1');
  });

  test('승수 동점 + 팀2 본수 우세 → team2 승리', () => {
    // 각 2승 2패 1무, 팀1 본수 5 vs 팀2 본수 6
    const result = calcTeamMatchResult(makeMatch([[2,0],[0,2],[1,3],[2,1],[0,0]]));
    expect(result.winner).toBe('t2');
    expect(result.wins1).toBe(2);
    expect(result.wins2).toBe(2);
  });

  test('승수·본수 모두 동점 → tiebreaker 필요', () => {
    const result = calcTeamMatchResult(makeMatch([[2,0],[0,2],[1,1],[0,2],[2,0]]));
    expect(result.winner).toBe('tiebreaker');
  });

  test('미완료 대결 있으면 winner null', () => {
    const match = {
      team1: 't1', team2: 't2',
      bouts: [
        { score1: 2, score2: 0, winner: 'team1', status: 'done' },
        { score1: 0, score2: 0, winner: null, status: 'ongoing' },
      ],
      tiebreaker: null,
    };
    expect(calcTeamMatchResult(match).winner).toBeNull();
  });

  test('빈 bouts 배열이면 winner null', () => {
    const match = { team1: 't1', team2: 't2', bouts: [], tiebreaker: null };
    expect(calcTeamMatchResult(match).winner).toBeNull();
  });
});

