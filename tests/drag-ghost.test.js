/**
 * @jest-environment jsdom
 */
import { createGhost, moveGhost, removeGhost } from '../src/drag-ghost.js';

describe('drag-ghost', () => {
  afterEach(() => {
    removeGhost();
  });

  test('createGhost: body에 #drag-ghost 요소 추가', () => {
    createGhost('홍길동 (서울)');
    const el = document.getElementById('drag-ghost');
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('홍길동 (서울)');
  });

  test('createGhost: 중복 호출 시 ghost는 항상 1개', () => {
    createGhost('A');
    createGhost('B');
    expect(document.querySelectorAll('#drag-ghost')).toHaveLength(1);
    expect(document.getElementById('drag-ghost').textContent).toBe('B');
  });

  test('moveGhost: left/top 스타일 업데이트', () => {
    createGhost('테스트');
    moveGhost(100, 200);
    const el = document.getElementById('drag-ghost');
    expect(el.style.left).toBe('114px');  // 100 + 14
    expect(el.style.top).toBe('190px');   // 200 - 10
  });

  test('moveGhost: ghost 없을 때 에러 없이 통과', () => {
    expect(() => moveGhost(0, 0)).not.toThrow();
  });

  test('removeGhost: 요소 제거', () => {
    createGhost('삭제 테스트');
    removeGhost();
    expect(document.getElementById('drag-ghost')).toBeNull();
  });

  test('removeGhost: 반복 호출해도 에러 없음', () => {
    expect(() => { removeGhost(); removeGhost(); }).not.toThrow();
  });
});
