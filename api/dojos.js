import { db } from '../src/server/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { sido, sigungu } = req.query;
    const dojos = await db.listDojos(sido, sigungu);
    return res.status(200).json({ dojos });
  } catch (e) {
    console.error('dojos error:', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
