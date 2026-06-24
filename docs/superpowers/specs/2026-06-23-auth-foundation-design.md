# 1단계 설계: 인증 + 검도관 토대 (Auth & Dojo Foundation) — PRD 반영본

작성일: 2026-06-23
근거 문서: PRD v1.0 "스마트 검도 토너먼트 대진 관리 플랫폼" (2026-06-23, 김상현)

## 배경

KendoBracket은 현재 순수 클라이언트 앱(바닐라 JS + Vite, `localStorage` 저장, 서버/DB 없음)으로
Vercel에 정적 배포되어 있다. PRD가 요구하는 **클라우드 기반 대회 참가 관리 플랫폼**으로 확장한다.

PRD는 백엔드로 Firebase Firestore를 명시하지만, **본 프로젝트는 Vercel + Neon(Postgres) 구조를 유지**한다.
따라서 Firestore 관련 요구(onSnapshot 실시간)는 우리 스택에 맞게 **폴링(주기적 갱신)**으로 대체한다.

## 확정된 결정 사항 (PRD + 협의)

- **아키텍처**: Vercel 서버리스 함수(`/api`) + Neon Postgres. Firebase 미사용.
- **인증 구현**: 직접 구현. 모든 계정/역할 데이터는 Neon에 저장.
- **로그인 식별자**: **이메일 + 비밀번호**. (PRD는 아이디 기반이나 이메일로 확정)
- **역할 체계 (4종)**:
  - `super_admin` (최고관리자) — 플랫폼 총괄, 하위 관리자 발급
  - `admin` (일반관리자) — 개별 대회 개설·운영
  - `club_manager` (단체대표/지도자) — 검도관 생성·소속 선수 관리·단체전 신청
  - `player` (선수) — 개인 계정, 개인전 신청·검도관 소속
  - ※ PRD의 "Competitor"를 협의에 따라 `club_manager`/`player`로 분리.
- **역할 배정**:
  - 일반 가입 화면: `club_manager`/`player`만 선택 가능.
  - `admin`: `super_admin`이 발급 (해당 UI는 후속 "최고관리자" 단계).
  - `super_admin`: 시드 스크립트로 최초 1명 생성.
- **검도관(단체) 모델 — 모델 B**:
  - 검도관(`dojos`)을 1단계로 당겨서 만든다. 이것이 플랫폼의 중심 단체 엔티티이며, 향후 단체전 단위가 된다.
  - **생성 권한은 `club_manager`만**. 검도관을 만든 대표가 그 **관장(owner)**이 된다.
  - **`player`는 기존 검도관 선택만** 가능(생성 불가). 소속 검도관이 아직 없으면 **"소속 미정"으로 가입** 후 나중에 선택(하드 블록하지 않음).
- **행정구역**:
  - `시/도` → `시/군/구` **2단계** Select. 프론트 상수(JSON)로 번들.
  - **검도관과 사용자 양쪽에 모두 저장** (코드 + 표시명).
- **실시간 동기화**: 폴링. (1단계엔 큰 영향 없음. 대회/대진표 단계에서 본격 적용)
- **전광판(`display.html`)**: 로그인 없이 공개 유지.
- **대회 데이터**: 1단계에서는 DB로 옮기지 않음. 기존 `localStorage` 대진표 유지(연동은 4단계).

## 단계 분할 (PRD 반영 로드맵)

모델 B로 검도관을 1단계에 넣으면서, 기존 "단체 등록" 단계는 1단계에 흡수되고 2단계는 멤버십 정교화로 재정의된다.

| 단계 | 내용 | PRD 매핑 |
|------|------|----------|
| **1단계 (이 문서)** | 인증 + 검도관 토대: 가입/로그인/세션 + 4역할 + 역할 기반 라우팅 + 검도관 생성/선택 | 4.1 |
| 2단계 | 검도관 멤버십 정교화: 임시(소속 미정) 선수의 검도관 선택, claim(귀속), 관장의 소속 선수 관리 | 4.4 단체 기반 |
| 3단계 | 관리자 대회 개설(상태머신: 모집중→대진확정) + 참가 신청(개인/단체) | 4.3, 4.4 |
| 4단계 | 신청 데이터 → 기존 SVG 브라켓 엔진 연동 (부전승·48강·6인 단체 보강) | 4.3 대진표 |
| 5단계 | 최고관리자 대시보드(역할별 통계, 관리자 발급, 회원 Data Grid) | 4.2 |
| 횡단 | 폴링 기반 실시간 갱신, Tailwind 반응형 UI 전환 | 4.1, 5 |

이 문서는 **1단계만** 다룬다.

## 1단계 범위

PRD 4.1(인증) + 역할 기반 라우팅 + 검도관 엔티티 토대. 4.2~4.3과 대회/신청/대진표는 범위 밖.

### 아키텍처

```
[브라우저: Vite 정적 프론트]  ──HTTP──▶  [Vercel 서버리스 함수 /api/*]  ──▶  [Neon Postgres]
     index.html (관리자 도구, 게이트)
     login.html / signup.html (신규)
     display.html (공개 유지)
```

- DB 드라이버: `@neondatabase/serverless` (HTTP 기반)
- 환경변수: `DATABASE_URL`, `JWT_SECRET` (Vercel 대시보드 + 로컬 `.env`)

### 데이터 모델 (Neon)

```sql
CREATE TABLE dojos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  sido_code    text NOT NULL,          -- 시/도 코드
  sido_name    text NOT NULL,          -- 시/도 표시명
  sigungu_code text NOT NULL,          -- 시/군/구 코드
  sigungu_name text NOT NULL,          -- 시/군/구 표시명
  owner_id     uuid REFERENCES users(id),   -- 관장(생성한 club_manager)
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, sido_code, sigungu_code)     -- 같은 지역 동명 검도관 중복 방지
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,           -- 로그인 식별자
  password_hash text NOT NULL,
  name          text NOT NULL,                  -- 성명
  phone         text,                           -- 연락처
  sido_code     text,                           -- 사용자 행정구역(코드/표시명)
  sido_name     text,
  sigungu_code  text,
  sigungu_name  text,
  dojo_id       uuid REFERENCES dojos(id),      -- 소속 검도관. admin/super_admin 및 '소속 미정' 선수는 NULL
  role          text NOT NULL CHECK (role IN ('super_admin','admin','club_manager','player')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

- `dojos.owner_id`와 `users.dojo_id`는 상호 참조이므로 마이그레이션에서 테이블 생성 후 FK를 부여하거나 순서를 조정한다.
- 마이그레이션: `db/migrations/001_init.sql`.
- 최초 `super_admin` 시드: `scripts/create-superadmin.mjs` (이메일·비번 입력 → 해싱 후 삽입).

### 가입 흐름 (역할 분기)

공통: 성명·연락처·이메일·비밀번호 + 행정구역(`시/도`→`시/군/구`).

- **club_manager (단체대표)**: 행정구역 선택 후 **새 검도관명 입력 → 검도관 생성**. 생성자=관장(`owner_id`).
  같은 지역 동명 검도관이 이미 있으면 중복 안내(409). 기존 검도관에 합류(다중 관장)·claim은 후속 단계.
- **player (선수)**: 행정구역 선택 → 그 지역 **검도관 드롭다운에서 기존 검도관 선택**.
  목록에 없으면 **"소속 미정"으로 가입 가능**(`dojo_id` NULL), 이후 선택. 선수는 검도관을 생성하지 못한다.

가입은 트랜잭션으로: (검도관 생성이 필요한 경우) 검도관 + 사용자 + (대표면) `owner_id`/`dojo_id` 연결을 원자적으로 처리.

### API 엔드포인트

| 메서드 | 경로 | 동작 |
|--------|------|------|
| POST | `/api/auth/signup` | 가입. `role`은 `club_manager`/`player`만 허용(`admin`/`super_admin` 거부 403). club_manager면 검도관 생성+관장 지정, player면 기존 검도관 연결(또는 미정). 성공 시 로그인 쿠키 설정. |
| POST | `/api/auth/login` | 이메일+비번 검증 → JWT를 httpOnly 쿠키로 설정. |
| POST | `/api/auth/logout` | 쿠키 삭제. |
| GET  | `/api/auth/me` | 쿠키 JWT 검증 → `{ id, email, name, role, dojo }` 반환. 미인증 401. |
| GET  | `/api/dojos?sido=&sigungu=` | 행정구역으로 필터링한 검도관 목록(가입폼 드롭다운용). 인증 불필요. |

- 비밀번호 해싱: `bcryptjs` (순수 JS — 서버리스에서 네이티브 빌드 이슈 없음).
- 토큰: `jose`로 JWT 발급/검증. 쿠키: `HttpOnly`·`Secure`·`SameSite=Lax`·`Path=/`, 만료 7일.

### 프론트엔드 동작 (역할 기반 라우팅 — PRD 4.1)

- **signup.html / login.html**: 신규 페이지(기존 디자인 톤 유지. Tailwind 전환은 횡단 과제로 후속).
  - 가입 폼: 역할 선택(단체대표/선수) → 공통 필드 + 행정구역(2단계 Select) + (대표) 검도관명 입력 / (선수) 검도관 드롭다운.
- **로그인 성공 시 역할별 라우팅**:
  - `super_admin`/`admin` → 기존 대진표 도구(`index.html`). (최고관리자 전용 화면은 5단계)
  - `club_manager`/`player` → "준비 중 (다음 단계에서 열림)" 안내 랜딩 + 로그아웃.
- **index.html**: 진입 시 `/api/auth/me` 호출. 미로그인 → `login.html` 리다이렉트. 권한 없으면 안내 랜딩.
- 상단에 로그인 사용자 이름 + 로그아웃 버튼.
- **display.html**: 변경 없음(공개).

### 에러 처리 / 검증

- 입력 검증(서버 권위): 이메일 형식, 비밀번호 최소 8자, 성명 필수, 역할/행정구역 코드 화이트리스트.
- club_manager: 검도관명 필수. 같은 지역 동명 검도관 중복 → 409.
- player: `dojo_id`가 있으면 실제 존재·지역 일치 검증. 없으면(미정) 허용.
- 중복 이메일 → 409. 잘못된 로그인 → 401(일반 메시지). `admin`/`super_admin` 가입 시도 → 403. 서버 오류 → 500.

### 테스트

- 기존 Jest로 **순수 로직 단위 테스트**: 입력 검증 함수, 행정구역 코드 검증, 비번 해싱/검증 래퍼, JWT 발급/파싱 래퍼, 가입 분기 로직(역할별 검도관 처리)을 순수 함수로 분리해 테스트.
- 서버리스 API 통합 테스트는 1단계 제외.

### 신규/변경 파일 요약

신규:
- `api/auth/signup.js`, `login.js`, `logout.js`, `me.js`, `api/dojos.js`
- `src/server/db.js`(Neon), `src/server/auth.js`(해싱/JWT/쿠키), `src/server/validation.js`, `src/server/signup-logic.js`(역할 분기 순수 로직)
- `login.html`, `signup.html`, 관련 프론트 스크립트, `src/data/regions.js`(시/도·시군구 상수)
- `db/migrations/001_init.sql`, `scripts/create-superadmin.mjs`, `.env.example`
- 단위 테스트 파일들

변경:
- `index.html` / `app.js` — 인증 게이트 및 역할 분기
- `package.json` — `@neondatabase/serverless`, `bcryptjs`, `jose` 추가
- `.gitignore` — `.env`
- `README.md` — 환경변수·실행·마이그레이션 안내

## 범위 밖 (후속 단계)

- 검도관 멤버십 정교화: '소속 미정' 선수의 사후 선택, claim(귀속), 다중 관장, 관장의 소속 선수 관리 (2단계)
- 대회/신청 엔티티 및 화면, 상태머신 (3단계)
- 신청 데이터 → 대진표 연동, 48강 등 비2의거듭제곱, 6인(선봉1+대기1+기본4) 단체 엔트리 (4단계)
- 최고관리자 대시보드·통계·관리자 발급·회원 Data Grid (5단계 / PRD 4.2)
- 폴링 실시간 갱신, Tailwind 반응형 전면 적용 (횡단)
- 비밀번호 재설정, 이메일 인증
