import { isValidEmail } from './validation.js';
import { safeUser } from './signup-logic.js';

export class LoginError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'LoginError';
    this.status = status;
  }
}

const GENERIC = '이메일 또는 비밀번호가 올바르지 않습니다.';

export async function performLogin(input = {}, deps) {
  const { db, verifyPassword, signToken } = deps;

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : input.email;

  if (!isValidEmail(email) || !input.password) {
    throw new LoginError(401, GENERIC);
  }
  const user = await db.getUserByEmail(email);
  if (!user) throw new LoginError(401, GENERIC);

  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) throw new LoginError(401, GENERIC);

  const token = await signToken({ sub: user.id, role: user.role, name: user.name });
  return { user: safeUser(user), token };
}
