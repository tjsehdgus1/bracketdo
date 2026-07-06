import { db } from '../../src/server/db.js';
import { verifyToken, parseCookies } from '../../src/server/auth.js';
import { safeUser } from '../../src/server/signup-logic.js';

export default async function handler(req, res) {
  try {
    const { kendo_token: token } = parseCookies(req.headers.cookie);
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
    const payload = await verifyToken(token);
    const user = await db.getUserById(payload.sub);
    if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    return res.status(200).json({ user: safeUser(user) });
  } catch {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
}
