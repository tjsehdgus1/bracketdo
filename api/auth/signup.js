import { db } from '../../src/server/db.js';
import { hashPassword, signToken, serializeAuthCookie } from '../../src/server/auth.js';
import { performSignup, SignupError } from '../../src/server/signup-logic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { user, token } = await performSignup(req.body ?? {}, { db, hashPassword, signToken });
    res.setHeader('Set-Cookie', serializeAuthCookie(token));
    return res.status(201).json({ user });
  } catch (e) {
    if (e instanceof SignupError) return res.status(e.status).json({ error: e.message });
    // 동시 가입 레이스: UNIQUE 제약 위반은 사용자 오류(중복)로 매핑
    if (e?.code === '23505') return res.status(409).json({ error: '이미 등록된 정보입니다.' });
    console.error('signup error:', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
