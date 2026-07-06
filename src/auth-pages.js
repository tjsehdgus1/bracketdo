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
