export const EMPTY_DIVISION = () => ({
  name: '',
  type: 'individual',   // 'individual' | 'team'
  teamSize: 5,
  positions: ['선봉', '차봉', '중견', '부장', '대장'],
  players: [],
  teams: [],
  bracket: { rounds: [] },
});

export const INITIAL_STATE = {
  meta: { title: '', updatedAt: 0 },
  activeDivision: 0,
  divisions: [],
  display: {
    mode: 'bracket',        // 'current' | 'bracket' | 'result'
    currentMatchId: null,
    autoSlide: false,
    slideInterval: 10000,
  },
};

let _state = JSON.parse(JSON.stringify(INITIAL_STATE));
let _renderAll = null;

export function setRenderCallback(fn) {
  _renderAll = fn;
}

export function getState() {
  return _state;
}

export function getActiveDivision() {
  return _state.divisions[_state.activeDivision] ?? null;
}

export function loadState() {
  const raw = localStorage.getItem('kendo_state');
  if (raw) {
    try { _state = JSON.parse(raw); } catch (_) {}
  }
  return _state;
}

export function saveState() {
  _state.meta.updatedAt = Date.now();
  const json = JSON.stringify(_state);
  localStorage.setItem('kendo_state', json);
  // 같은 탭에서도 storage 이벤트 발화 (전광판 탭 동기화용)
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'kendo_state',
      newValue: json,
      storageArea: localStorage,
    }));
  } catch (_) {}
}

export function updateState(updaterFn) {
  updaterFn(_state);
  saveState();
  if (_renderAll) _renderAll();
}
