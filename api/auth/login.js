import { db } from '../../src/server/db.js';
import { verifyPassword, signToken, serializeAuthCookie } from '../../src/server/auth.js';
import { performLogin, LoginError } from '../../src/server/login-logic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { user, token } = await performLogin(req.body ?? {}, { db, verifyPassword, signToken });
    res.setHeader('Set-Cookie', serializeAuthCookie(token));
    return res.status(200).json({ user });
  } catch (e) {
    if (e instanceof LoginError) return res.status(e.status).json({ error: e.message });
    console.error('login error:', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
