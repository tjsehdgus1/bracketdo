import {
  isValidEmail, isValidPassword, SIGNUP_ROLES, validateSignupInput,
} from '../src/server/validation.js';

const base = {
  email: 'a@b.com', password: '12345678', name: '홍길동',
  role: 'player', sidoCode: '11', sigunguCode: '11680',
};

describe('validation', () => {
  test('isValidEmail', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  test('isValidPassword: 8자 이상만 통과', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('1234567')).toBe(false);
  });

  test('SIGNUP_ROLES는 club_manager/player만', () => {
    expect(SIGNUP_ROLES).toEqual(['club_manager', 'player']);
  });

  test('정상 player 입력은 에러 없음', () => {
    expect(validateSignupInput(base)).toEqual([]);
  });

  test('club_manager는 dojoName 필수', () => {
    const errors = validateSignupInput({ ...base, role: 'club_manager', dojoName: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('club_manager에 dojoName 있으면 통과', () => {
    expect(validateSignupInput({ ...base, role: 'club_manager', dojoName: '강남검도관' })).toEqual([]);
  });

  test('admin 역할은 화이트리스트 밖 → 에러', () => {
    expect(validateSignupInput({ ...base, role: 'admin' }).length).toBeGreaterThan(0);
  });

  test('잘못된 행정구역 → 에러', () => {
    expect(validateSignupInput({ ...base, sigunguCode: '99999' }).length).toBeGreaterThan(0);
  });
});
