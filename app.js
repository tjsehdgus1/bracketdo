// app.js
import { loadState, setRenderCallback } from './src/state.js';
import { initAdmin, renderAll } from './src/admin-ui.js';
import { initDisplay } from './src/display-ui.js';
import { openMatchModal, closeMatchModal } from './src/match-modal.js';

const page = document.body.dataset.page;

if (page === 'admin') {
  setRenderCallback(renderAll);
  loadState();
  initAdmin();
  // Expose modal functions for SVG click events
  window._matchModal = { openMatchModal, closeMatchModal };
} else if (page === 'display') {
  initDisplay();
}
