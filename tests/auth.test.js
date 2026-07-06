process.env.JWT_SECRET = 'test-secret-please-change-1234567890';

import {
  hashPassword, verifyPassword, signToken, verifyToken,
  serializeAuthCookie, clearAuthCookie, parseCookies,
} from '../src/server/auth.js';

describe('auth helpers', () => {
  test('해시는 원문과 다르고 verify로 확인된다', async () => {
    const hash = await hashPassword('supersecret');
    expect(hash).not.toBe('supersecret');
    expect(await verifyPassword('supersecret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  test('JWT 발급 후 검증하면 payload가 복원된다', async () => {
    const token = await signToken({ sub: 'u1', role: 'player', name: '홍길동' });
    const payload = await verifyToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('player');
  });

  test('변조된 토큰은 검증 실패', async () => {
    await expect(verifyToken('not.a.jwt')).rejects.toBeDefined();
  });

  test('쿠키 직렬화에 HttpOnly/Path/SameSite 포함', () => {
    const c = serializeAuthCookie('abc');
    expect(c).toContain('kendo_token=abc');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Path=/');
    expect(c).toContain('SameSite=Lax');
  });

  test('clearAuthCookie는 Max-Age=0', () => {
    expect(clearAuthCookie()).toContain('Max-Age=0');
  });

  test('parseCookies는 헤더 문자열을 객체로', () => {
    expect(parseCookies('kendo_token=abc; other=1')).toEqual({ kendo_token: 'abc', other: '1' });
    expect(parseCookies('')).toEqual({});
    // 잘못된 인코딩도 던지지 않고 원문 유지
    expect(parseCookies('bad=%zz; kendo_token=ok')).toEqual({ bad: '%zz', kendo_token: 'ok' });
  });
});
