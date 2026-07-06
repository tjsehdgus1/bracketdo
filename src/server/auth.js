import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'kendo_token';
const MAX_AGE = 60 * 60 * 24 * 7; // 7일

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secretKey());
  return payload;
}

export function serializeAuthCookie(token) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function clearAuthCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(cookieHeader = '') {
  const out = {};
  for (const part of (cookieHeader || '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx)] = decodeURIComponent(trimmed.slice(idx + 1));
  }
  return out;
}

export { COOKIE_NAME };
