import { isValidRegion } from '../data/regions.js';

export const ROLES = ['super_admin', 'admin', 'club_manager', 'player'];
export const SIGNUP_ROLES = ['club_manager', 'player'];

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8;
}

export function validateSignupInput(input = {}) {
  const errors = [];
  if (!isValidEmail(input.email)) errors.push('이메일 형식이 올바르지 않습니다.');
  if (!isValidPassword(input.password)) errors.push('비밀번호는 8자 이상이어야 합니다.');
  if (!input.name || !String(input.name).trim()) errors.push('성명을 입력하세요.');
  if (!SIGNUP_ROLES.includes(input.role)) errors.push('가입 가능한 역할이 아닙니다.');
  if (!isValidRegion(input.sidoCode, input.sigunguCode)) errors.push('행정구역을 선택하세요.');
  if (input.role === 'club_manager' && !String(input.dojoName || '').trim()) {
    errors.push('검도관명을 입력하세요.');
  }
  return errors;
}
