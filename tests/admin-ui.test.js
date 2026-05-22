/**
 * @jest-environment jsdom
 */
import { isFormControl } from '../src/admin-ui.js';

describe('isFormControl — 드래그 시작에서 제외할 인터랙티브 요소 판별', () => {
  test('input 요소는 form control', () => {
    const el = document.createElement('input');
    expect(isFormControl(el)).toBe(true);
  });

  test('input 내부 자식에서 시작해도 form control로 판별', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<input id="x">';
    const input = wrap.querySelector('input');
    expect(isFormControl(input)).toBe(true);
  });

  test('button / select / textarea 모두 form control', () => {
    expect(isFormControl(document.createElement('button'))).toBe(true);
    expect(isFormControl(document.createElement('select'))).toBe(true);
    expect(isFormControl(document.createElement('textarea'))).toBe(true);
  });

  test('버튼 안의 텍스트(자식)에서 시작해도 form control', () => {
    const btn = document.createElement('button');
    const span = document.createElement('span');
    btn.appendChild(span);
    expect(isFormControl(span)).toBe(true);
  });

  test('일반 div/span은 form control 아님 (드래그 허용)', () => {
    expect(isFormControl(document.createElement('div'))).toBe(false);
    expect(isFormControl(document.createElement('span'))).toBe(false);
  });

  test('null 안전', () => {
    expect(isFormControl(null)).toBe(false);
  });
});
