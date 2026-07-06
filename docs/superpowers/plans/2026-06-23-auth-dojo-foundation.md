# 인증 + 검도관 토대 (Auth & Dojo Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 순수 클라이언트 앱에 Neon(Postgres) 기반 회원가입/로그인/세션과 검도관(단체) 엔티티를 추가하고, 역할(4종) 기반 라우팅을 붙인다.

**Architecture:** Vercel 서버리스 함수(`/api/*`)가 Neon에 붙는다. 결정 로직은 라이브 DB·서버리스 없이 테스트 가능하도록 순수 모듈(`src/server/*`)로 분리하고, DB 접근은 포트(port) 객체로 주입한다. API 핸들러는 파싱/쿠키/응답만 담당하는 얇은 어댑터다. 프론트는 기존 Vite 정적 구조를 유지한 채 `login.html`/`signup.html`을 추가하고 `index.html`에 인증 게이트를 건다.

**Tech Stack:** Vite(기존), Node ESM, `@neondatabase/serverless`, `bcryptjs`, `jose`(JWT), Jest + Babel(기존 테스트).

**근거 스펙:** `docs/superpowers/specs/2026-06-23-auth-foundation-design.md`

---

## 파일 구조

신규 (서버 로직 — 테스트 대상):
- `src/data/regions.js` — 시/도·시군구 상수 + 검증/조회 헬퍼 (서버·클라이언트 공용)
- `src/server/validation.js` — 가입/로그인 입력 검증 (순수)
- `src/server/auth.js` — 비번 해싱, JWT 발급/검증, 쿠키 직렬화/파싱
- `src/server/signup-logic.js` — 가입 오케스트레이션 (역할 분기, db 포트 주입, 순수)
- `src/server/login-logic.js` — 로그인 오케스트레이션 (순수)

신규 (인프라 — 라이브 DB 필요, 단위테스트 제외):
- `src/server/db.js` — Neon 연결 + db 포트 구현
- `db/migrations/001_init.sql` — 스키마
- `scripts/create-superadmin.mjs` — 최초 최고관리자 시드

신규 (API 핸들러 — 얇은 어댑터):
- `api/auth/signup.js`, `api/auth/login.js`, `api/auth/logout.js`, `api/auth/me.js`
- `api/dojos.js`

신규 (프론트):
- `login.html`, `signup.html`
- `src/auth-pages.js` — 로그인/가입 페이지 스크립트 (지역 캐스케이드, 검도관 드롭다운)
- `src/auth-gate.js` — 인증 게이트 + 역할 라우팅 헬퍼

신규 (설정/문서):
- `.env.example`

변경:
- `package.json` — dependencies 추가
- `.gitignore` — `.env`
- `app.js` — 관리자 진입 시 인증 게이트 호출
- `index.html` — 헤더에 사용자/로그아웃 영역, 게이트 안내 컨테이너
- `README.md` — 환경변수·마이그레이션·로컬 실행 안내

신규 테스트:
- `tests/regions.test.js`, `tests/validation.test.js`, `tests/auth.test.js`,
  `tests/signup-logic.test.js`, `tests/login-logic.test.js`

---

## Task 1: 의존성 및 환경 설정

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: 런타임 의존성 설치**

Run:
```bash
cd /e/DEV/bracketdo
npm install @neondatabase/serverless@^0.10.4 bcryptjs@^2.4.3 jose@^5.9.6
```
Expected: `package.json`에 `dependencies` 블록이 생기고 세 패키지가 추가됨. (기존 `devDependencies`는 유지)

- [ ] **Step 2: `.gitignore`에 `.env` 추가**

`.gitignore` 파일에 다음 줄을 추가:
```
.env
.vercel/
```

- [ ] **Step 3: `.env.example` 작성**

Create `.env.example`:
```
# Neon Postgres 연결 문자열 (Neon 콘솔 > Connection Details)
DATABASE_URL=postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# JWT 서명 비밀키 (openssl rand -base64 48 등으로 생성한 긴 랜덤 문자열)
JWT_SECRET=replace-with-a-long-random-secret
```

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: add auth/db runtime deps and env template"
```

---

## Task 2: 행정구역 데이터 모듈

행정구역은 시/도(17개) → 시/군/구 2단계. 서버 검증과 클라이언트 드롭다운이 같은 소스를 쓰도록 `src/data/regions.js`에 둔다.

**Files:**
- Create: `src/data/regions.js`
- Test: `tests/regions.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/regions.test.js`:
```js
import { REGIONS, isValidRegion, regionNames } from '../src/data/regions.js';

describe('regions — 행정구역 데이터/검증', () => {
  test('17개 시/도가 있다', () => {
    expect(REGIONS).toHaveLength(17);
  });

  test('서울(11)은 25개 시군구를 가진다', () => {
    const seoul = REGIONS.find(r => r.code === '11');
    expect(seoul).toBeDefined();
    expect(seoul.sigungu).toHaveLength(25);
  });

  test('isValidRegion: 존재하는 시도+시군구 조합은 true', () => {
    expect(isValidRegion('11', '11680')).toBe(true); // 서울 강남구
  });

  test('isValidRegion: 없는 시도는 false', () => {
    expect(isValidRegion('99', '11680')).toBe(false);
  });

  test('isValidRegion: 시도는 맞지만 시군구가 다른 시도 소속이면 false', () => {
    expect(isValidRegion('11', '41110')).toBe(false); // 41110은 경기 수원
  });

  test('regionNames: 코드로 표시명을 돌려준다', () => {
    expect(regionNames('11', '11680')).toEqual({ sidoName: '서울특별시', sigunguName: '강남구' });
  });

  test('regionNames: 잘못된 조합이면 null 이름', () => {
    expect(regionNames('99', '00000')).toEqual({ sidoName: null, sigunguName: null });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/regions.test.js`
Expected: FAIL — `Cannot find module '../src/data/regions.js'`

- [ ] **Step 3: `regions.js` 구현**

Create `src/data/regions.js`. 아래는 헬퍼 + 서울(25개 구) 완전 데이터 + 경기 일부(테스트 41110 포함)를 담은 시작 형태다. **나머지 시/도의 시군구는 동일한 `{ code, name }` 형식으로 행정표준코드관리시스템(https://www.code.go.kr) 법정동/행정구역 코드에서 채운다 — 이는 로직이 아닌 참조 데이터 입력이다.** `isValidRegion`/`regionNames`는 데이터 양과 무관하게 동작한다.

```js
// src/data/regions.js
// 시/도 code = 법정동 코드 앞 2자리, 시/군/구 code = 앞 5자리.

export const REGIONS = [
  {
    code: '11', name: '서울특별시', sigungu: [
      { code: '11110', name: '종로구' }, { code: '11140', name: '중구' },
      { code: '11170', name: '용산구' }, { code: '11200', name: '성동구' },
      { code: '11215', name: '광진구' }, { code: '11230', name: '동대문구' },
      { code: '11260', name: '중랑구' }, { code: '11290', name: '성북구' },
      { code: '11305', name: '강북구' }, { code: '11320', name: '도봉구' },
      { code: '11350', name: '노원구' }, { code: '11380', name: '은평구' },
      { code: '11410', name: '서대문구' }, { code: '11440', name: '마포구' },
      { code: '11470', name: '양천구' }, { code: '11500', name: '강서구' },
      { code: '11530', name: '구로구' }, { code: '11545', name: '금천구' },
      { code: '11560', name: '영등포구' }, { code: '11590', name: '동작구' },
      { code: '11620', name: '관악구' }, { code: '11650', name: '서초구' },
      { code: '11680', name: '강남구' }, { code: '11710', name: '송파구' },
      { code: '11740', name: '강동구' },
    ],
  },
  { code: '26', name: '부산광역시', sigungu: [] },
  { code: '27', name: '대구광역시', sigungu: [] },
  { code: '28', name: '인천광역시', sigungu: [] },
  { code: '29', name: '광주광역시', sigungu: [] },
  { code: '30', name: '대전광역시', sigungu: [] },
  { code: '31', name: '울산광역시', sigungu: [] },
  { code: '36', name: '세종특별자치시', sigungu: [] },
  {
    code: '41', name: '경기도', sigungu: [
      { code: '41110', name: '수원시' }, // 나머지 시군구는 동일 형식으로 채움
    ],
  },
  { code: '43', name: '충청북도', sigungu: [] },
  { code: '44', name: '충청남도', sigungu: [] },
  { code: '46', name: '전라남도', sigungu: [] },
  { code: '47', name: '경상북도', sigungu: [] },
  { code: '48', name: '경상남도', sigungu: [] },
  { code: '50', name: '제주특별자치도', sigungu: [] },
  { code: '51', name: '강원특별자치도', sigungu: [] },
  { code: '52', name: '전북특별자치도', sigungu: [] },
];

export function findSido(sidoCode) {
  return REGIONS.find(r => r.code === sidoCode) ?? null;
}

export function isValidRegion(sidoCode, sigunguCode) {
  const sido = findSido(sidoCode);
  if (!sido) return false;
  return sido.sigungu.some(g => g.code === sigunguCode);
}

export function regionNames(sidoCode, sigunguCode) {
  const sido = findSido(sidoCode);
  if (!sido) return { sidoName: null, sigunguName: null };
  const gu = sido.sigungu.find(g => g.code === sigunguCode);
  if (!gu) return { sidoName: null, sigunguName: null };
  return { sidoName: sido.name, sigunguName: gu.name };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/regions.test.js`
Expected: PASS (7 tests). (서울 25개, 경기 41110 포함으로 모든 단언 성립)

- [ ] **Step 5: 커밋**

```bash
git add src/data/regions.js tests/regions.test.js
git commit -m "feat: add region (sido/sigungu) data module with validation"
```

---

## Task 3: 입력 검증 모듈

**Files:**
- Create: `src/server/validation.js`
- Test: `tests/validation.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/validation.test.js`:
```js
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/validation.test.js`
Expected: FAIL — `Cannot find module '../src/server/validation.js'`

- [ ] **Step 3: `validation.js` 구현**

Create `src/server/validation.js`:
```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/validation.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/server/validation.js tests/validation.test.js
git commit -m "feat: add signup/login input validation"
```

---

## Task 4: 인증 헬퍼 (해싱 / JWT / 쿠키)

**Files:**
- Create: `src/server/auth.js`
- Test: `tests/auth.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/auth.test.js`:
```js
process.env.JWT_SECRET = 'test-secret-please-change-1234567890';

import {
  hashPassword, verifyPassword, signToken, verifyToken,
  serializeAuthCookie, clearAuthCookie, parseCookies,
} from '../src/server/auth.js';

describe('auth helpers', () => {
  test('해시는 원문과 다르고 verify로 확인된다', async () => {
    const hash = await hashPassword('supersecret');
    expect(hash).not.toBe('supersecret');
    expect(await verifyPassword('supersecret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  test('JWT 발급 후 검증하면 payload가 복원된다', async () => {
    const token = await signToken({ sub: 'u1', role: 'player', name: '홍길동' });
    const payload = await verifyToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('player');
  });

  test('변조된 토큰은 검증 실패', async () => {
    await expect(verifyToken('not.a.jwt')).rejects.toBeDefined();
  });

  test('쿠키 직렬화에 HttpOnly/Path/SameSite 포함', () => {
    const c = serializeAuthCookie('abc');
    expect(c).toContain('kendo_token=abc');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Path=/');
    expect(c).toContain('SameSite=Lax');
  });

  test('clearAuthCookie는 Max-Age=0', () => {
    expect(clearAuthCookie()).toContain('Max-Age=0');
  });

  test('parseCookies는 헤더 문자열을 객체로', () => {
    expect(parseCookies('kendo_token=abc; other=1')).toEqual({ kendo_token: 'abc', other: '1' });
    expect(parseCookies('')).toEqual({});
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/auth.test.js`
Expected: FAIL — `Cannot find module '../src/server/auth.js'`

- [ ] **Step 3: `auth.js` 구현**

Create `src/server/auth.js`:
```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/auth.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/server/auth.js tests/auth.test.js
git commit -m "feat: add password hashing, JWT, and cookie helpers"
```

---

## Task 5: 가입 오케스트레이션 로직 (순수)

DB 접근은 `db` 포트로 주입하여 페이크로 테스트한다. 포트 메서드: `emailExists`, `findDojoByNameRegion`, `findDojoById`, `createUser`, `createClubManagerWithDojo`.

**Files:**
- Create: `src/server/signup-logic.js`
- Test: `tests/signup-logic.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/signup-logic.test.js`:
```js
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/signup-logic.test.js`
Expected: FAIL — `Cannot find module '../src/server/signup-logic.js'`

- [ ] **Step 3: `signup-logic.js` 구현**

Create `src/server/signup-logic.js`:
```js
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
  const { db, hashPassword, signToken } = deps;

  const errors = validateSignupInput(input);
  if (errors.length) throw new SignupError(400, errors.join(' '));

  if (input.role === 'admin' || input.role === 'super_admin') {
    throw new SignupError(403, '해당 역할로는 가입할 수 없습니다.');
  }

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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/signup-logic.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/server/signup-logic.js tests/signup-logic.test.js
git commit -m "feat: add signup orchestration logic with role branching"
```

---

## Task 6: 로그인 오케스트레이션 로직 (순수)

**Files:**
- Create: `src/server/login-logic.js`
- Test: `tests/login-logic.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/login-logic.test.js`:
```js
import { performLogin, LoginError } from '../src/server/login-logic.js';

function makeDeps(user) {
  const db = { getUserByEmail: async (email) => (user && user.email === email ? user : null) };
  return {
    db,
    verifyPassword: async (pw, hash) => pw === 'correct' && hash === 'HASH',
    signToken: async () => 'TOKEN',
  };
}
const user = { id: 'u1', email: 'a@b.com', password_hash: 'HASH', role: 'player', name: '홍' };

describe('performLogin', () => {
  test('올바른 자격증명 → 토큰 + 안전 사용자', async () => {
    const res = await performLogin({ email: 'a@b.com', password: 'correct' }, makeDeps(user));
    expect(res.token).toBe('TOKEN');
    expect(res.user.password_hash).toBeUndefined();
  });

  test('없는 이메일 → 401', async () => {
    await expect(performLogin({ email: 'x@y.com', password: 'correct' }, makeDeps(user)))
      .rejects.toMatchObject({ status: 401 });
  });

  test('틀린 비번 → 401', async () => {
    await expect(performLogin({ email: 'a@b.com', password: 'wrong' }, makeDeps(user)))
      .rejects.toMatchObject({ status: 401 });
  });

  test('이메일 형식 불량 → 401 (사용자 존재 노출 안 함)', async () => {
    await expect(performLogin({ email: 'bad', password: 'correct' }, makeDeps(user)))
      .rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- tests/login-logic.test.js`
Expected: FAIL — `Cannot find module '../src/server/login-logic.js'`

- [ ] **Step 3: `login-logic.js` 구현**

Create `src/server/login-logic.js`:
```js
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

  if (!isValidEmail(input.email) || !input.password) {
    throw new LoginError(401, GENERIC);
  }
  const user = await db.getUserByEmail(input.email);
  if (!user) throw new LoginError(401, GENERIC);

  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) throw new LoginError(401, GENERIC);

  const token = await signToken({ sub: user.id, role: user.role, name: user.name });
  return { user: safeUser(user), token };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/login-logic.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/server/login-logic.js tests/login-logic.test.js
git commit -m "feat: add login orchestration logic"
```

---

## Task 7: 마이그레이션 SQL + Neon DB 포트 구현

DB 접근은 라이브 Neon이 필요하므로 단위테스트 대상이 아니다. 스키마와 포트 구현을 작성하고 마이그레이션을 실제 Neon에 적용한다.

**Files:**
- Create: `db/migrations/001_init.sql`
- Create: `src/server/db.js`

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `db/migrations/001_init.sql`:
```sql
-- 001_init: users + dojos (인증 + 검도관 토대)
-- Neon(Postgres 15+)은 gen_random_uuid() 내장.

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  phone         text,
  sido_code     text,
  sido_name     text,
  sigungu_code  text,
  sigungu_name  text,
  dojo_id       uuid,
  role          text NOT NULL CHECK (role IN ('super_admin','admin','club_manager','player')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dojos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  sido_code     text NOT NULL,
  sido_name     text NOT NULL,
  sigungu_code  text NOT NULL,
  sigungu_name  text NOT NULL,
  owner_id      uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, sido_code, sigungu_code)
);

-- users.dojo_id → dojos.id (dojos 생성 이후에 FK 부여)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_dojo_fk,
  ADD CONSTRAINT users_dojo_fk FOREIGN KEY (dojo_id) REFERENCES dojos(id);

CREATE INDEX IF NOT EXISTS idx_dojos_region ON dojos (sido_code, sigungu_code);
```

- [ ] **Step 2: 마이그레이션을 Neon에 적용**

`.env`에 실제 `DATABASE_URL`을 넣은 뒤(없으면 Neon 콘솔에서 생성), Neon SQL Editor에 위 SQL을 붙여넣어 실행하거나 psql로 적용:
```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql
```
Expected: `users`, `dojos` 테이블 생성. 재실행해도 `IF NOT EXISTS`로 안전.

- [ ] **Step 3: `db.js` 포트 구현**

Create `src/server/db.js`:
```js
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const db = {
  async emailExists(email) {
    const rows = await sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`;
    return rows.length > 0;
  },

  async getUserByEmail(email) {
    const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    return rows[0] ?? null;
  },

  async getUserById(id) {
    const rows = await sql`
      SELECT u.*, d.name AS dojo_name
      FROM users u LEFT JOIN dojos d ON d.id = u.dojo_id
      WHERE u.id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  },

  async findDojoById(id) {
    const rows = await sql`SELECT * FROM dojos WHERE id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  },

  async findDojoByNameRegion(name, sidoCode, sigunguCode) {
    const rows = await sql`
      SELECT * FROM dojos
      WHERE name = ${name} AND sido_code = ${sidoCode} AND sigungu_code = ${sigunguCode}
      LIMIT 1`;
    return rows[0] ?? null;
  },

  async listDojos(sidoCode, sigunguCode) {
    if (sidoCode && sigunguCode) {
      return sql`SELECT id, name FROM dojos
        WHERE sido_code = ${sidoCode} AND sigungu_code = ${sigunguCode}
        ORDER BY name`;
    }
    return sql`SELECT id, name FROM dojos ORDER BY name LIMIT 200`;
  },

  async createUser(u) {
    const rows = await sql`
      INSERT INTO users
        (email, password_hash, name, phone, sido_code, sido_name, sigungu_code, sigungu_name, dojo_id, role)
      VALUES
        (${u.email}, ${u.password_hash}, ${u.name}, ${u.phone}, ${u.sido_code}, ${u.sido_name},
         ${u.sigungu_code}, ${u.sigungu_name}, ${u.dojo_id ?? null}, ${u.role})
      RETURNING *`;
    return rows[0];
  },

  // 단일 문장 CTE로 원자적 처리: 유저 생성 → 검도관 생성(owner=유저) → 유저.dojo_id 갱신
  async createClubManagerWithDojo(u, d) {
    const rows = await sql`
      WITH new_user AS (
        INSERT INTO users
          (email, password_hash, name, phone, sido_code, sido_name, sigungu_code, sigungu_name, role)
        VALUES
          (${u.email}, ${u.password_hash}, ${u.name}, ${u.phone}, ${u.sido_code}, ${u.sido_name},
           ${u.sigungu_code}, ${u.sigungu_name}, ${u.role})
        RETURNING id
      ),
      new_dojo AS (
        INSERT INTO dojos (name, sido_code, sido_name, sigungu_code, sigungu_name, owner_id)
        SELECT ${d.name}, ${d.sido_code}, ${d.sido_name}, ${d.sigungu_code}, ${d.sigungu_name}, id
        FROM new_user
        RETURNING id
      )
      UPDATE users SET dojo_id = (SELECT id FROM new_dojo)
      WHERE id = (SELECT id FROM new_user)
      RETURNING *`;
    const user = rows[0];
    return { user, dojo: { id: user.dojo_id, ...d } };
  },
};
```

- [ ] **Step 4: 커밋**

```bash
git add db/migrations/001_init.sql src/server/db.js
git commit -m "feat: add schema migration and Neon db port implementation"
```

---

## Task 8: 최고관리자 시드 스크립트

**Files:**
- Create: `scripts/create-superadmin.mjs`

- [ ] **Step 1: 스크립트 작성**

Create `scripts/create-superadmin.mjs`:
```js
// 사용법: node --env-file=.env scripts/create-superadmin.mjs <email> <password> "<name>"
import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../src/server/auth.js';

const [email, password, name] = process.argv.slice(2);

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
```

- [ ] **Step 2: 실행 확인 (라이브 DB 필요)**

Run:
```bash
node --env-file=.env scripts/create-superadmin.mjs admin@kendo.kr "changeme123" "최고관리자"
```
Expected: `최고관리자 생성 완료: { id: ..., email: 'admin@kendo.kr', role: 'super_admin' }`. 재실행 시 중복 이메일 에러.

- [ ] **Step 3: 커밋**

```bash
git add scripts/create-superadmin.mjs
git commit -m "feat: add super_admin seed script"
```

---

## Task 9: API 핸들러 (얇은 어댑터)

Vercel Node 함수 시그니처(`(req, res)`)를 사용한다. `req.body`는 Vercel이 JSON을 자동 파싱한다.

**Files:**
- Create: `api/auth/signup.js`, `api/auth/login.js`, `api/auth/logout.js`, `api/auth/me.js`
- Create: `api/dojos.js`

- [ ] **Step 1: `signup.js`**

Create `api/auth/signup.js`:
```js
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
    console.error('signup error:', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
```

- [ ] **Step 2: `login.js`**

Create `api/auth/login.js`:
```js
import { db } from '../../src/server/db.js';
import { verifyPassword, signToken, serializeAuthCookie } from '../../src/server/auth.js';
import { performLogin, LoginError } from '../../src/server/login-logic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { user, token } = await performLogin(req.body ?? {}, { db, verifyPassword, signToken });
    res.setHeader('Set-Cookie', serializeAuthCookie(token));
    return res.status(200).json({ user });
  } catch (e) {
    if (e instanceof LoginError) return res.status(e.status).json({ error: e.message });
    console.error('login error:', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
```

- [ ] **Step 3: `logout.js`**

Create `api/auth/logout.js`:
```js
import { clearAuthCookie } from '../../src/server/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  res.setHeader('Set-Cookie', clearAuthCookie());
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: `me.js`**

Create `api/auth/me.js`:
```js
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
```

- [ ] **Step 5: `dojos.js`**

Create `api/dojos.js`:
```js
import { db } from '../src/server/db.js';

export default async function handler(req, res) {
  try {
    const { sido, sigungu } = req.query;
    const dojos = await db.listDojos(sido, sigungu);
    return res.status(200).json({ dojos });
  } catch (e) {
    console.error('dojos error:', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
```

- [ ] **Step 6: 로컬 통합 확인 (vercel dev)**

Vite dev 서버는 `/api`를 서빙하지 않으므로 Vercel CLI로 확인:
```bash
npx vercel dev
# 다른 터미널에서:
curl -i -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"m@x.com","password":"12345678","name":"관장","role":"club_manager","sidoCode":"11","sigunguCode":"11680","dojoName":"강남검도관"}'
```
Expected: `HTTP/1.1 201`, `Set-Cookie: kendo_token=...`, 본문에 `user`. (라이브 `DATABASE_URL`/`JWT_SECRET` 필요) 확인이 어려우면 이 스텝은 실제 배포/DB 준비 후로 미룬다.

- [ ] **Step 7: 커밋**

```bash
git add api/
git commit -m "feat: add auth and dojos API handlers"
```

---

## Task 10: 로그인 페이지

**Files:**
- Create: `login.html`
- Create: `src/auth-pages.js` (로그인 부분 먼저)

- [ ] **Step 1: `login.html` 작성**

Create `login.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KendoBracket — 로그인</title>
  <link rel="stylesheet" href="style.css">
</head>
<body data-page="login">
  <main class="auth-wrap">
    <h1 class="auth-title">🏆 KendoBracket 로그인</h1>
    <form id="login-form" class="auth-form" autocomplete="on">
      <label>이메일 <input type="email" name="email" required></label>
      <label>비밀번호 <input type="password" name="password" required></label>
      <button type="submit">로그인</button>
      <p id="login-error" class="auth-error" role="alert"></p>
    </form>
    <p class="auth-link">계정이 없으신가요? <a href="signup.html">회원가입</a></p>
  </main>
  <script type="module" src="src/auth-pages.js"></script>
</body>
</html>
```

- [ ] **Step 2: `auth-pages.js` 로그인 로직**

Create `src/auth-pages.js`:
```js
// 로그인/가입 페이지 진입점. data-page로 분기.
const page = document.body.dataset.page;

function showError(el, msg) { el.textContent = msg; }

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

if (page === 'login') {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(errEl, '');
    const fd = new FormData(form);
    const { ok, data } = await postJSON('/api/auth/login', {
      email: fd.get('email'), password: fd.get('password'),
    });
    if (ok) { window.location.href = 'index.html'; }
    else { showError(errEl, data.error || '로그인에 실패했습니다.'); }
  });
}
```

- [ ] **Step 3: 스타일 추가**

`style.css` 맨 아래에 인증 화면용 최소 스타일 추가:
```css
/* --- 인증 화면 --- */
.auth-wrap { max-width: 420px; margin: 8vh auto; padding: 0 20px; }
.auth-title { text-align: center; margin-bottom: 24px; }
.auth-form { display: flex; flex-direction: column; gap: 14px; }
.auth-form label { display: flex; flex-direction: column; gap: 6px; font-weight: 600; }
.auth-form input, .auth-form select { padding: 10px; font-size: 15px; }
.auth-form button { padding: 12px; font-size: 16px; cursor: pointer; }
.auth-error { color: #dc2626; min-height: 1.2em; margin: 4px 0 0; }
.auth-link { text-align: center; margin-top: 16px; }
.auth-fieldset { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
```

- [ ] **Step 4: 빌드가 login.html을 포함하도록 `vite.config.js` 입력 추가**

Modify `vite.config.js` — `build.rollupOptions.input`에 항목 추가:
```js
      input: {
        main: 'index.html',
        display: 'display.html',
        login: 'login.html',
        signup: 'signup.html',
      },
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공, `dist/login.html` 생성. (signup.html은 Task 11에서 만들어지므로, 이 스텝은 Task 11 완료 후 재확인. 순서상 지금은 signup 항목이 없으면 에러 → Task 11까지 마친 뒤 실행)

- [ ] **Step 6: 커밋**

```bash
git add login.html src/auth-pages.js style.css vite.config.js
git commit -m "feat: add login page"
```

---

## Task 11: 회원가입 페이지 (지역 캐스케이드 + 검도관)

**Files:**
- Create: `signup.html`
- Modify: `src/auth-pages.js` (가입 분기 추가)

- [ ] **Step 1: `signup.html` 작성**

Create `signup.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KendoBracket — 회원가입</title>
  <link rel="stylesheet" href="style.css">
</head>
<body data-page="signup">
  <main class="auth-wrap">
    <h1 class="auth-title">🏆 KendoBracket 회원가입</h1>
    <form id="signup-form" class="auth-form" autocomplete="on">
      <label>역할
        <select name="role" id="role-select" required>
          <option value="player">선수</option>
          <option value="club_manager">단체대표(지도자)</option>
        </select>
      </label>
      <label>성명 <input type="text" name="name" required></label>
      <label>연락처 <input type="tel" name="phone" placeholder="010-0000-0000"></label>
      <label>이메일 <input type="email" name="email" required></label>
      <label>비밀번호 <input type="password" name="password" minlength="8" required></label>

      <fieldset class="auth-fieldset">
        <legend>소속 지역·검도관</legend>
        <label>시/도 <select name="sido" id="sido-select" required></select></label>
        <label>시/군/구 <select name="sigungu" id="sigungu-select" required></select></label>

        <!-- 선수: 기존 검도관 선택 -->
        <label id="dojo-select-wrap">소속 검도관
          <select name="dojoId" id="dojo-select">
            <option value="">소속 미정 (나중에 선택)</option>
          </select>
        </label>

        <!-- 단체대표: 새 검도관명 입력 -->
        <label id="dojo-name-wrap" hidden>검도관명
          <input type="text" name="dojoName" id="dojo-name" placeholder="예: 강남검도관">
        </label>
      </fieldset>

      <button type="submit">가입하기</button>
      <p id="signup-error" class="auth-error" role="alert"></p>
    </form>
    <p class="auth-link">이미 계정이 있으신가요? <a href="login.html">로그인</a></p>
  </main>
  <script type="module" src="src/auth-pages.js"></script>
</body>
</html>
```

- [ ] **Step 2: `auth-pages.js`에 가입 분기 추가**

`src/auth-pages.js` 맨 위 import 추가 + 파일 끝에 signup 블록 추가:
```js
// (파일 상단에 추가)
import { REGIONS } from './data/regions.js';
```
```js
// (파일 끝에 추가)
if (page === 'signup') {
  const form = document.getElementById('signup-form');
  const errEl = document.getElementById('signup-error');
  const roleSel = document.getElementById('role-select');
  const sidoSel = document.getElementById('sido-select');
  const sigunguSel = document.getElementById('sigungu-select');
  const dojoSel = document.getElementById('dojo-select');
  const dojoSelectWrap = document.getElementById('dojo-select-wrap');
  const dojoNameWrap = document.getElementById('dojo-name-wrap');

  // 시/도 채우기
  sidoSel.innerHTML = '<option value="">선택</option>' +
    REGIONS.map(r => `<option value="${r.code}">${r.name}</option>`).join('');

  function fillSigungu() {
    const sido = REGIONS.find(r => r.code === sidoSel.value);
    const list = sido ? sido.sigungu : [];
    sigunguSel.innerHTML = '<option value="">선택</option>' +
      list.map(g => `<option value="${g.code}">${g.name}</option>`).join('');
    dojoSel.innerHTML = '<option value="">소속 미정 (나중에 선택)</option>';
  }

  async function fillDojos() {
    if (!sidoSel.value || !sigunguSel.value) return;
    const res = await fetch(`/api/dojos?sido=${sidoSel.value}&sigungu=${sigunguSel.value}`);
    const { dojos = [] } = await res.json().catch(() => ({ dojos: [] }));
    dojoSel.innerHTML = '<option value="">소속 미정 (나중에 선택)</option>' +
      dojos.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  function applyRole() {
    const isManager = roleSel.value === 'club_manager';
    dojoNameWrap.hidden = !isManager;   // 대표: 검도관명 입력
    dojoSelectWrap.hidden = isManager;  // 선수: 검도관 선택
  }

  sidoSel.addEventListener('change', fillSigungu);
  sigunguSel.addEventListener('change', fillDojos);
  roleSel.addEventListener('change', applyRole);
  applyRole();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(errEl, '');
    const fd = new FormData(form);
    const body = {
      role: fd.get('role'), name: fd.get('name'), phone: fd.get('phone'),
      email: fd.get('email'), password: fd.get('password'),
      sidoCode: fd.get('sido'), sigunguCode: fd.get('sigungu'),
    };
    if (body.role === 'club_manager') body.dojoName = fd.get('dojoName');
    else body.dojoId = fd.get('dojoId') || undefined;

    const { ok, data } = await postJSON('/api/auth/signup', body);
    if (ok) { window.location.href = 'index.html'; }
    else { showError(errEl, data.error || '가입에 실패했습니다.'); }
  });
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공, `dist/login.html`·`dist/signup.html` 생성.

- [ ] **Step 4: 커밋**

```bash
git add signup.html src/auth-pages.js
git commit -m "feat: add signup page with region cascade and dojo selection"
```

---

## Task 12: 관리자 화면 인증 게이트 + 역할 라우팅

**Files:**
- Create: `src/auth-gate.js`
- Modify: `app.js:7-13` (admin 분기 진입부)
- Modify: `index.html:14-22` (헤더 사용자 영역)

- [ ] **Step 1: `auth-gate.js` 작성**

Create `src/auth-gate.js`:
```js
// 현재 로그인 사용자를 확인하고, 권한에 따라 진입 여부를 판단한다.
// 반환: { user } (통과) | null (리다이렉트 처리됨)

export async function requireAuth() {
  let res;
  try {
    res = await fetch('/api/auth/me');
  } catch {
    window.location.href = 'login.html';
    return null;
  }
  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  const { user } = await res.json();
  return { user };
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
}

export function renderNotReadyLanding(user) {
  document.body.innerHTML = `
    <main class="auth-wrap">
      <h1 class="auth-title">🏆 KendoBracket</h1>
      <p style="text-align:center">
        <strong>${user.name}</strong>님 (${roleLabel(user.role)})으로 로그인했습니다.<br>
        이 역할의 화면은 다음 단계에서 열립니다.
      </p>
      <p class="auth-link"><button id="logout-btn">로그아웃</button></p>
    </main>`;
  document.getElementById('logout-btn').addEventListener('click', logout);
}

export function roleLabel(role) {
  return {
    super_admin: '최고관리자', admin: '일반관리자',
    club_manager: '단체대표', player: '선수',
  }[role] ?? role;
}
```

- [ ] **Step 2: `app.js`의 admin 분기에 게이트 적용**

Modify `app.js` — `if (page === 'admin') {` 블록 진입부를 아래로 교체(기존 `setRenderCallback`~`initAdmin()` 호출을 게이트 이후로 감싼다):
```js
import { loadState, setRenderCallback, getState, updateState } from './src/state.js';
import { initAdmin, renderAll } from './src/admin-ui.js';
import { initDisplay } from './src/display-ui.js';
import { openMatchModal, closeMatchModal } from './src/match-modal.js';
import { requireAuth, logout, renderNotReadyLanding } from './src/auth-gate.js';

const page = document.body.dataset.page;

if (page === 'admin') {
  const auth = await requireAuth();
  if (auth) {
    const { user } = auth;
    if (user.role === 'admin' || user.role === 'super_admin') {
      // 헤더에 사용자/로그아웃 표시
      const bar = document.getElementById('user-bar');
      if (bar) {
        bar.textContent = `${user.name} · `;
        const btn = document.createElement('button');
        btn.textContent = '로그아웃';
        btn.addEventListener('click', logout);
        bar.appendChild(btn);
      }
      setRenderCallback(renderAll);
      loadState();
      initAdmin();
      window._matchModal = { openMatchModal, closeMatchModal };
      initBackupButtons();
    } else {
      renderNotReadyLanding(user); // club_manager / player
    }
  }
} else if (page === 'display') {
  initDisplay();
}
```
그리고 기존의 JSON 내보내기/불러오기 이벤트 등록 코드(현재 `app.js:16-53`)를 `function initBackupButtons() { ... }`로 감싸서 위에서 호출한다. (본문 로직은 그대로 이동)

> 주의: 최상위 `await`는 `app.js`가 ES 모듈(`<script type="module">`)로 로드되므로 사용 가능하다. `index.html`은 이미 `type="module"`이다.

- [ ] **Step 3: `index.html` 헤더에 사용자 영역 추가**

Modify `index.html` — `<div class="header-right">` 내부에 사용자 바 추가:
```html
    <div class="header-right">
      <span id="user-bar" class="user-bar"></span>
      <button id="btn-open-display">전광판 열기 ↗</button>
    </div>
```

- [ ] **Step 4: 게이트 동작 확인 (vercel dev)**

Run: `npx vercel dev` 후 브라우저에서 `http://localhost:3000/index.html` 접속.
Expected: 미로그인 → `login.html`로 이동. `super_admin`으로 로그인 → 기존 대진표 도구 표시 + 헤더에 이름/로그아웃. `player`로 로그인 → "다음 단계에서 열립니다" 랜딩.
(라이브 DB 없으면 이 스텝은 배포 후 확인으로 미룸)

- [ ] **Step 5: 기존 테스트 회귀 확인**

Run: `npm test`
Expected: 신규 5개 테스트 + 기존 테스트 모두 PASS. (app.js는 테스트가 직접 import하지 않음)

- [ ] **Step 6: 커밋**

```bash
git add src/auth-gate.js app.js index.html
git commit -m "feat: gate admin page behind auth with role-based routing"
```

---

## Task 13: 문서 갱신

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README에 백엔드/환경 안내 추가**

`README.md`의 "## 개발" 섹션 앞이나 뒤에 아래 섹션을 추가:
```markdown
## 백엔드 / 계정 (1단계)

Vercel 서버리스 함수 + Neon(Postgres) 기반 인증이 추가되었습니다.

### 환경변수
`.env.example`을 복사해 `.env`를 만들고 채웁니다.
- `DATABASE_URL` — Neon 연결 문자열
- `JWT_SECRET` — 긴 랜덤 문자열 (`openssl rand -base64 48`)

Vercel 배포 시 두 변수를 프로젝트 Environment Variables에 등록합니다.

### DB 마이그레이션
```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql
```

### 최고관리자 생성
```bash
node --env-file=.env scripts/create-superadmin.mjs <email> <password> "<name>"
```

### 로컬 실행 (API 포함)
Vite dev는 `/api`를 서빙하지 않으므로 API까지 확인하려면:
```bash
npx vercel dev
```
```

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: document auth backend setup and migration"
```

---

## 자체 검토 결과 (Self-Review)

**스펙 커버리지:**
- 이메일 로그인 → Task 4,6,10 ✓
- 4역할 + 가입은 club_manager/player만 → Task 3,5 ✓
- super_admin 시드 → Task 8 ✓
- 검도관 모델 B(대표 생성/선수 선택/소속 미정) → Task 5,7,11 ✓
- 행정구역 2단계, 검도관·사용자 양쪽 저장 → Task 2,5,7 ✓
- API(signup/login/logout/me/dojos) → Task 9 ✓
- 역할 기반 라우팅 + 게이트 → Task 12 ✓
- 전광판 공개 유지 → display 분기 미변경 ✓
- 마이그레이션/문서 → Task 7,13 ✓

**범위 밖(스펙과 일치, 계획에 미포함):** 폴링 실시간, Tailwind 전면 전환, 최고관리자 대시보드, claim 흐름, 대회/신청/대진표 연동 — 후속 단계.

**타입 일관성:** db 포트 메서드명(`emailExists`, `getUserByEmail`, `getUserById`, `findDojoById`, `findDojoByNameRegion`, `listDojos`, `createUser`, `createClubManagerWithDojo`)이 Task 5·6·7·9 전반에서 동일. `safeUser`는 signup-logic에서 정의해 login-logic/me가 재사용.

**알려진 제약:** `regions.js`의 시군구 전체 데이터는 참조 데이터 입력(공식 코드표)으로 남음 — 로직/테스트는 서울·경기 표본으로 완결. DB·서버리스 통합 스텝(Task 7,9,12)은 라이브 Neon이 있어야 실제 확인 가능하며, 그 전까지는 순수 로직 단위테스트로 검증된다.
