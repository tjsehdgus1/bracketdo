import { REGIONS } from './data/regions.js';

// 로그인/가입 페이지 진입점. data-page로 분기.
const page = document.body.dataset.page;

function showError(el, msg) { el.textContent = msg; }

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

if (page === 'login') {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(errEl, '');
    const fd = new FormData(form);
    const { ok, data } = await postJSON('/api/auth/login', {
      email: fd.get('email'), password: fd.get('password'),
    });
    if (ok) { window.location.href = 'index.html'; }
    else { showError(errEl, data.error || '로그인에 실패했습니다.'); }
  });
}

if (page === 'signup') {
  const form = document.getElementById('signup-form');
  const errEl = document.getElementById('signup-error');
  const roleSel = document.getElementById('role-select');
  const sidoSel = document.getElementById('sido-select');
  const sigunguSel = document.getElementById('sigungu-select');
  const dojoSel = document.getElementById('dojo-select');
  const dojoSelectWrap = document.getElementById('dojo-select-wrap');
  const dojoNameWrap = document.getElementById('dojo-name-wrap');

  // 시/도 채우기
  sidoSel.innerHTML = '<option value="">선택</option>' +
    REGIONS.map(r => `<option value="${r.code}">${r.name}</option>`).join('');

  function fillSigungu() {
    const sido = REGIONS.find(r => r.code === sidoSel.value);
    const list = sido ? sido.sigungu : [];
    sigunguSel.innerHTML = '<option value="">선택</option>' +
      list.map(g => `<option value="${g.code}">${g.name}</option>`).join('');
    dojoSel.innerHTML = '<option value="">소속 미정 (나중에 선택)</option>';
  }

  async function fillDojos() {
    if (!sidoSel.value || !sigunguSel.value) return;
    const res = await fetch(`/api/dojos?sido=${sidoSel.value}&sigungu=${sigunguSel.value}`);
    const { dojos = [] } = await res.json().catch(() => ({ dojos: [] }));
    dojoSel.innerHTML = '';
    dojoSel.append(new Option('소속 미정 (나중에 선택)', ''));
    for (const d of dojos) dojoSel.append(new Option(d.name, d.id));
  }

  function applyRole() {
    const isManager = roleSel.value === 'club_manager';
    dojoNameWrap.hidden = !isManager;   // 대표: 검도관명 입력
    dojoSelectWrap.hidden = isManager;  // 선수: 검도관 선택
  }

  sidoSel.addEventListener('change', fillSigungu);
  sigunguSel.addEventListener('change', fillDojos);
  roleSel.addEventListener('change', applyRole);
  applyRole();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(errEl, '');
    const fd = new FormData(form);
    const body = {
      role: fd.get('role'), name: fd.get('name'), phone: fd.get('phone'),
      email: fd.get('email'), password: fd.get('password'),
      sidoCode: fd.get('sido'), sigunguCode: fd.get('sigungu'),
    };
    if (body.role === 'club_manager') body.dojoName = fd.get('dojoName');
    else body.dojoId = fd.get('dojoId') || undefined;

    const { ok, data } = await postJSON('/api/auth/signup', body);
    if (ok) { window.location.href = 'index.html'; }
    else { showError(errEl, data.error || '가입에 실패했습니다.'); }
  });
}
