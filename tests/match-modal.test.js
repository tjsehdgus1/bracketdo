/**
 * @jest-environment jsdom
 */
import { clampScore } from '../src/match-modal.js';

describe('clampScore — 스테퍼 점수 범위 제한', () => {
  test('범위 내 값은 그대로', () => {
    expect(clampScore(2, 0, 10)).toBe(2);
  });

  test('최솟값 미만은 min으로', () => {
    expect(clampScore(-1, 0, 10)).toBe(0);
  });

  test('최댓값 초과는 max로', () => {
    expect(clampScore(11, 0, 10)).toBe(10);
  });

  test('숫자가 아니면 0으로 처리 후 클램프', () => {
    expect(clampScore(NaN, 0, 10)).toBe(0);
    expect(clampScore(undefined, 0, 10)).toBe(0);
  });

  test('기본 범위 0~10', () => {
    expect(clampScore(99)).toBe(10);
    expect(clampScore(-5)).toBe(0);
  });
});
