// 사용법: node --env-file=.env scripts/create-superadmin.mjs <email> <password> "<name>"
import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../src/server/auth.js';

const [rawEmail, password, name] = process.argv.slice(2);
// 가입/로그인 로직과 동일한 정규화 — 불일치 시 최고관리자 로그인 불가
const email = rawEmail?.trim().toLowerCase();

if (!email || !password || !name) {
  console.error('사용법: node --env-file=.env scripts/create-superadmin.mjs <email> <password> "<name>"');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const exists = await sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`;
if (exists.length) {
  console.error(`이미 존재하는 이메일: ${email}`);
  process.exit(1);
}

const password_hash = await hashPassword(password);
const rows = await sql`
  INSERT INTO users (email, password_hash, name, role)
  VALUES (${email}, ${password_hash}, ${name}, 'super_admin')
  RETURNING id, email, role`;

console.log('최고관리자 생성 완료:', rows[0]);
