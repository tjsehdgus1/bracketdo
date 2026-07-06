import { performLogin, LoginError } from '../src/server/login-logic.js';

function makeDeps(user) {
  const db = { getUserByEmail: async (email) => (user && user.email === email ? user : null) };
  return {
    db,
    verifyPassword: async (pw, hash) => pw === 'correct' && hash === 'HASH',
    signToken: async () => 'TOKEN',
  };
}
const user = { id: 'u1', email: 'a@b.com', password_hash: 'HASH', role: 'player', name: '홍' };

describe('performLogin', () => {
  test('올바른 자격증명 → 토큰 + 안전 사용자', async () => {
    const res = await performLogin({ email: 'a@b.com', password: 'correct' }, makeDeps(user));
    expect(res.token).toBe('TOKEN');
    expect(res.user.password_hash).toBeUndefined();
  });

  test('없는 이메일 → 401', async () => {
    await expect(performLogin({ email: 'x@y.com', password: 'correct' }, makeDeps(user)))
      .rejects.toMatchObject({ status: 401 });
  });

  test('틀린 비번 → 401', async () => {
    await expect(performLogin({ email: 'a@b.com', password: 'wrong' }, makeDeps(user)))
      .rejects.toMatchObject({ status: 401 });
  });

  test('이메일 형식 불량 → 401 (사용자 존재 노출 안 함)', async () => {
    await expect(performLogin({ email: 'bad', password: 'correct' }, makeDeps(user)))
      .rejects.toMatchObject({ status: 401 });
  });

  test('이메일은 트림+소문자로 조회된다', async () => {
    const res = await performLogin({ email: '  A@B.com ', password: 'correct' }, makeDeps(user));
    expect(res.token).toBe('TOKEN');
  });
});
