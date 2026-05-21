// app.js
import { loadState, setRenderCallback, getState, updateState } from './src/state.js';
import { initAdmin, renderAll } from './src/admin-ui.js';
import { initDisplay } from './src/display-ui.js';
import { openMatchModal, closeMatchModal } from './src/match-modal.js';

const page = document.body.dataset.page;

if (page === 'admin') {
  setRenderCallback(renderAll);
  loadState();
  initAdmin();
  window._matchModal = { openMatchModal, closeMatchModal };

  // JSON 내보내기
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const state = getState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const ts = now.toISOString().slice(0, 19).replace(/[:\-T]/g, '');
    a.href = url;
    a.download = `kendobracket_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // JSON 불러오기 버튼 → 파일 선택 트리거
  document.getElementById('btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });

  // 파일 선택 후 불러오기
  document.getElementById('import-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.divisions || !parsed.meta) throw new Error('유효하지 않은 파일');
        updateState(s => { Object.assign(s, parsed); });
        alert('불러오기 완료!');
      } catch (err) {
        alert('파일 오류: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-importing same file
  });

} else if (page === 'display') {
  initDisplay();
}
