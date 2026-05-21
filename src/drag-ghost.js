// src/drag-ghost.js
// Ghost DOM utility — createGhost(label), moveGhost(x, y), removeGhost()

let _ghost = null;

export function createGhost(label) {
  removeGhost();
  _ghost = document.createElement('div');
  _ghost.id = 'drag-ghost';
  _ghost.textContent = String(label ?? '');
  _ghost.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:9999',
    'background:#1e3a5f',
    'border:2px solid #3b82f6',
    'color:#93c5fd',
    'padding:4px 10px',
    'border-radius:4px',
    'font-size:12px',
    'font-family:inherit',
    'box-shadow:3px 3px 10px rgba(0,0,0,0.6)',
    'transform:rotate(2deg)',
    'white-space:nowrap',
  ].join(';');
  document.body.appendChild(_ghost);
}

export function moveGhost(x, y) {
  if (!_ghost) return;
  _ghost.style.left = (x + 14) + 'px';
  _ghost.style.top  = (y - 10) + 'px';
}

export function removeGhost() {
  if (_ghost) { _ghost.remove(); _ghost = null; }
}
