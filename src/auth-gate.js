// 현재 로그인 사용자를 확인하고, 권한에 따라 진입 여부를 판단한다.
// 반환: { user } (통과) | null (리다이렉트 처리됨)

export async function requireAuth() {
  let res;
  try {
    res = await fetch('/api/auth/me');
  } catch {
    window.location.href = 'login.html';
    return null;
  }
  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  const { user } = await res.json();
  return { user };
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
}

export function renderNotReadyLanding(user) {
  document.body.innerHTML = `
    <main class="auth-wrap">
      <h1 class="auth-title">🏆 KendoBracket</h1>
      <p style="text-align:center">
        <strong>${user.name}</strong>님 (${roleLabel(user.role)})으로 로그인했습니다.<br>
        이 역할의 화면은 다음 단계에서 열립니다.
      </p>
      <p class="auth-link"><button id="logout-btn">로그아웃</button></p>
    </main>`;
  document.getElementById('logout-btn').addEventListener('click', logout);
}

export function roleLabel(role) {
  return {
    super_admin: '최고관리자', admin: '일반관리자',
    club_manager: '단체대표', player: '선수',
  }[role] ?? role;
}
