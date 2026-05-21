// app.js
import { loadState, setRenderCallback } from './src/state.js';
import { initAdmin, renderAll } from './src/admin-ui.js';
import { initDisplay } from './src/display-ui.js';

const page = document.body.dataset.page;

if (page === 'admin') {
  setRenderCallback(renderAll);
  loadState();
  initAdmin();
} else if (page === 'display') {
  initDisplay();
}
