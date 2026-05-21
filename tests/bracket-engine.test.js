import {
  nextPowerOfTwo,
  generateBracket,
  advanceWinner,
} from '../src/bracket-engine.js';

describe('nextPowerOfTwo', () => {
  test('이미 2의 제곱수이면 그대로 반환', () => {
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(4)).toBe(4);
  });
  test('2의 제곱수가 아니면 올림', () => {
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(1)).toBe(2);
  });
});

describe('generateBracket', () => {
  const makeParticipants = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `선수${i + 1}`, club: '' }));

  test('4명 → 2라운드 (준결승+결승), 1라운드에 2경기, BYE 없음', () => {
    const bracket = generateBracket(makeParticipants(4));
    expect(bracket.rounds).toHaveLength(2);
    expect(bracket.rounds[0].matches).toHaveLength(2);
    const byes = bracket.rounds[0].matches.filter(m => m.player1 === 'bye' || m.player2 === 'bye');
    expect(byes).toHaveLength(0);
  });

  test('3명 → 1라운드 2경기, BYE 1개', () => {
    const bracket = generateBracket(makeParticipants(3));
    expect(bracket.rounds[0].matches).toHaveLength(2);
    const byeSlots = bracket.rounds[0].matches.flatMap(m =>
      [m.player1, m.player2].filter(p => p === 'bye')
    );
    expect(byeSlots).toHaveLength(1);
  });

  test('모든 경기 status는 pending으로 초기화 (BYE 제외)', () => {
    const bracket = generateBracket(makeParticipants(4));
    bracket.rounds[0].matches.forEach(m => expect(m.status).toBe('pending'));
  });

  test('2명 → 결승 1경기만', () => {
    const bracket = generateBracket(makeParticipants(2));
    expect(bracket.rounds).toHaveLength(1);
    expect(bracket.rounds[0].matches).toHaveLength(1);
  });

  test('참가자 1명 이하 → 에러 throw', () => {
    expect(() => generateBracket([{ id: 'p1', name: '홍길동', club: '' }])).toThrow();
  });
});

describe('advanceWinner', () => {
  const makeP = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `선수${i + 1}`, club: '' }));

  test('1라운드 첫 경기(짝수 인덱스) 승자 → 다음 라운드 player1으로', () => {
    const bracket = generateBracket(makeP(4));
    const m0 = bracket.rounds[0].matches[0];
    const updated = advanceWinner(bracket, m0.id, m0.player1);
    expect(updated.rounds[1].matches[0].player1).toBe(m0.player1);
  });

  test('1라운드 두 번째 경기(홀수 인덱스) 승자 → 다음 라운드 player2로', () => {
    const bracket = generateBracket(makeP(4));
    const m1 = bracket.rounds[0].matches[1];
    const updated = advanceWinner(bracket, m1.id, m1.player1);
    expect(updated.rounds[1].matches[0].player2).toBe(m1.player1);
  });

  test('원본 bracket은 변경되지 않음 (immutable, mutate=false 기본)', () => {
    const bracket = generateBracket(makeP(4));
    const m0 = bracket.rounds[0].matches[0];
    const original = JSON.stringify(bracket);
    advanceWinner(bracket, m0.id, m0.player1);
    expect(JSON.stringify(bracket)).toBe(original);
  });
});
