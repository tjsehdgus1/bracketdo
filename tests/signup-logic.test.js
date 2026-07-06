import { performSignup, SignupError, safeUser } from '../src/server/signup-logic.js';

function makeDeps(overrides = {}) {
  const calls = { createUser: null, createClubManagerWithDojo: null };
  const db = {
    emailExists: async () => false,
    findDojoByNameRegion: async () => null,
    findDojoById: async (id) => (id === 'dojo-1'
      ? { id: 'dojo-1', name: '강남검도관', sido_code: '11', sigungu_code: '11680' } : null),
    createUser: async (u) => { calls.createUser = u; return { id: 'u-1', ...u }; },
    createClubManagerWithDojo: async (u, d) => {
      calls.createClubManagerWithDojo = { u, d };
      return { user: { id: 'u-2', ...u, dojo_id: 'dojo-new' }, dojo: { id: 'dojo-new', ...d } };
    },
    ...overrides,
  };
  const deps = { db, hashPassword: async () => 'HASH', signToken: async () => 'TOKEN' };
  return { deps, calls, db };
}

const playerInput = {
  email: 'p@x.com', password: '12345678', name: '선수', role: 'player',
  sidoCode: '11', sigunguCode: '11680', dojoId: 'dojo-1',
};
const managerInput = {
  email: 'm@x.com', password: '12345678', name: '관장', role: 'club_manager',
  sidoCode: '11', sigunguCode: '11680', dojoName: '강남검도관',
};

describe('performSignup', () => {
  test('player: 검도관 선택 시 createUser에 dojo_id 연결, 토큰 반환', async () => {
    const { deps, calls } = makeDeps();
    const res = await performSignup(playerInput, deps);
    expect(calls.createUser.dojo_id).toBe('dojo-1');
    expect(calls.createUser.sido_name).toBe('서울특별시');
    expect(res.token).toBe('TOKEN');
    expect(res.user.password_hash).toBeUndefined(); // 안전 사용자
  });

  test('player: dojoId 없으면 소속 미정(null)으로 가입', async () => {
    const { deps, calls } = makeDeps();
    await performSignup({ ...playerInput, dojoId: undefined }, deps);
    expect(calls.createUser.dojo_id).toBeNull();
  });

  test('player: 없는 dojoId면 400', async () => {
    const { deps } = makeDeps();
    await expect(performSignup({ ...playerInput, dojoId: 'nope' }, deps))
      .rejects.toMatchObject({ status: 400 });
  });

  test('club_manager: 검도관+관장 생성 경로 호출', async () => {
    const { deps, calls } = makeDeps();
    const res = await performSignup(managerInput, deps);
    expect(calls.createClubManagerWithDojo.d.name).toBe('강남검도관');
    expect(res.user.role).toBe('club_manager');
  });

  test('club_manager: 같은 지역 동명 검도관 있으면 409', async () => {
    const { deps } = makeDeps({ findDojoByNameRegion: async () => ({ id: 'dup' }) });
    await expect(performSignup(managerInput, deps)).rejects.toMatchObject({ status: 409 });
  });

  test('중복 이메일 409', async () => {
    const { deps } = makeDeps({ emailExists: async () => true });
    await expect(performSignup(playerInput, deps)).rejects.toMatchObject({ status: 409 });
  });

  test('admin 역할 요청은 403', async () => {
    const { deps } = makeDeps();
    await expect(performSignup({ ...playerInput, role: 'admin' }, deps))
      .rejects.toMatchObject({ status: 403 });
  });

  test('검증 실패는 400', async () => {
    const { deps } = makeDeps();
    await expect(performSignup({ ...playerInput, email: 'bad' }, deps))
      .rejects.toMatchObject({ status: 400 });
  });

  test('safeUser는 password_hash 제거', () => {
    expect(safeUser({ id: 1, password_hash: 'x', name: 'n' })).toEqual({ id: 1, name: 'n' });
  });
});
