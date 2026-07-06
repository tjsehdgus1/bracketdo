import { validateSignupInput } from './validation.js';
import { regionNames } from '../data/regions.js';

export class SignupError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'SignupError';
    this.status = status;
  }
}

export function safeUser(user) {
  if (!user) return user;
  const { password_hash, ...rest } = user;
  return rest;
}

export async function performSignup(input = {}, deps) {
  input = { ...input, email: typeof input.email === 'string' ? input.email.trim().toLowerCase() : input.email };
  const { db, hashPassword, signToken } = deps;

  if (input.role === 'admin' || input.role === 'super_admin') {
    throw new SignupError(403, '해당 역할로는 가입할 수 없습니다.');
  }

  const errors = validateSignupInput(input);
  if (errors.length) throw new SignupError(400, errors.join(' '));

  if (await db.emailExists(input.email)) {
    throw new SignupError(409, '이미 가입된 이메일입니다.');
  }

  const { sidoName, sigunguName } = regionNames(input.sidoCode, input.sigunguCode);
  const password_hash = await hashPassword(input.password);

  const baseUser = {
    email: input.email,
    password_hash,
    name: String(input.name).trim(),
    phone: input.phone ? String(input.phone).trim() : null,
    sido_code: input.sidoCode,
    sido_name: sidoName,
    sigungu_code: input.sigunguCode,
    sigungu_name: sigunguName,
    role: input.role,
  };

  let user;
  if (input.role === 'club_manager') {
    const name = String(input.dojoName).trim();
    if (await db.findDojoByNameRegion(name, input.sidoCode, input.sigunguCode)) {
      throw new SignupError(409, '같은 지역에 동일한 검도관이 이미 등록되어 있습니다.');
    }
    const result = await db.createClubManagerWithDojo(baseUser, {
      name,
      sido_code: input.sidoCode,
      sido_name: sidoName,
      sigungu_code: input.sigunguCode,
      sigungu_name: sigunguName,
    });
    user = result.user;
  } else {
    let dojoId = null;
    if (input.dojoId) {
      const dojo = await db.findDojoById(input.dojoId);
      if (!dojo) throw new SignupError(400, '선택한 검도관을 찾을 수 없습니다.');
      dojoId = dojo.id;
    }
    user = await db.createUser({ ...baseUser, dojo_id: dojoId });
  }

  const token = await signToken({ sub: user.id, role: user.role, name: user.name });
  return { user: safeUser(user), token };
}
