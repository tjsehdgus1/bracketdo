/**
 * @jest-environment jsdom
 */
import { renderBracketSVG } from '../src/svg-bracket.js';

function makeDivision() {
  return {
    type: 'individual',
    players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }],
    teams: [],
    bracket: {
      rounds: [
        {
          roundNo: 1,
          label: '결승',
          matches: [
            { id: 'm1', type: 'individual', player1: 'p1', player2: 'p2', status: 'pending' },
          ],
        },
      ],
    },
  };
}

describe('renderBracketSVG zoom', () => {
  test('zoom 기본값 1: viewBox와 width/height가 일치', () => {
    const container = document.createElement('div');
    renderBracketSVG(makeDivision(), container);
    const svg = container.querySelector('svg');
    const [, , vbW, vbH] = svg.getAttribute('viewBox').split(' ').map(Number);
    expect(Number(svg.getAttribute('width'))).toBe(vbW);
    expect(Number(svg.getAttribute('height'))).toBe(vbH);
  });

  test('zoom 2배: width/height는 viewBox의 2배, viewBox는 그대로', () => {
    const container = document.createElement('div');
    renderBracketSVG(makeDivision(), container, 2);
    const svg = container.querySelector('svg');
    const [, , vbW, vbH] = svg.getAttribute('viewBox').split(' ').map(Number);
    expect(Number(svg.getAttribute('width'))).toBe(vbW * 2);
    expect(Number(svg.getAttribute('height'))).toBe(vbH * 2);
  });
});
