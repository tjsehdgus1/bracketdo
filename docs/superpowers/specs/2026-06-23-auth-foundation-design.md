# 1단계 설계: 인증 토대 (Auth Foundation) — PRD 반영본

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
  - `club_manager` (단체대표/지도자) — 단체 생성·소속 선수 관리·단체전 신청
  - `player` (선수) — 개인 계정, 개인전 신청·단체 소속
  - ※ PRD의 "Competitor"를 협의에 따라 `club_manager`/`player`로 분리.
- **역할 배정**:
  - 일반 가입 화면: `club_manager`/`player`만 선택 가능.
  - `admin`: `super_admin`이 발급 (해당 UI는 후속 "최고관리자" 단계).
  - `super_admin`: 시드 스크립트로 최초 1명 생성.
- **실시간 동기화**: 폴링. (1단계 인증에는 큰 영향 없음. 대회/대진표 단계에서 본격 적용)
- **전광판(`display.html`)**: 로그인 없이 공개 유지.
- **대회 데이터**: 1단계에서는 DB로 옮기지 않음. 기존 `localStorage` 대진표 유지(연동은 4단계).

## 단계 분할 (PRD 반영 로드맵)

| 단계 | 내용 | PRD 매핑 |
|------|------|----------|
| **1단계 (이 문서)** | 인증 토대: 가입/로그인/세션 + 4역할 + 역할 기반 라우팅 | 4.1 |
| 2단계 | 단체(검도관) 등록, 선수의 단체 소속/승인 | 4.4 단체 기반 |
| 3단계 | 관리자 대회 개설(상태머신: 모집중→대진확정) + 참가 신청(개인/단체) | 4.3, 4.4 |
| 4단계 | 신청 데이터 → 기존 SVG 브라켓 엔진 연동 (부전승·48강·6인 단체 보강) | 4.3 대진표 |
| 5단계 | 최고관리자 대시보드(역할별 통계, 관리자 발급, 회원 Data Grid) | 4.2 |
| 횡단 | 폴링 기반 실시간 갱신, Tailwind 반응형 UI 전환 | 4.1, 5 |

이 문서는 **1단계(인증 토대)만** 다룬다.

## 1단계 범위

PRD 4.1(인증)과 역할 기반 라우팅의 토대를 만든다. 4.2~4.4의 도메인 기능은 범위 밖.

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

PRD 가입 항목(성명·연락처·이메일·행정구역·소속검도관) 반영.

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,            -- 로그인 식별자
  password_hash text NOT NULL,
  name          text NOT NULL,                   -- 성명
  phone         text,                            -- 연락처
  region        text,                            -- 상세 행정구역
  dojo          text,                            -- 소속 검도관 (※ 아래 '결정 필요' 참고)
  role          text NOT NULL CHECK (role IN ('super_admin','admin','club_manager','player')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

- 마이그레이션: `db/migrations/001_init.sql`.
- 최초 `super_admin` 시드: `scripts/create-superadmin.mjs` (이메일·비번 입력 → 해싱 후 삽입).

> **결정 필요 ① — 소속 검도관(dojo) 처리**
> PRD는 `Select`(기존 목록 선택)지만 단체(검도관) 등록은 2단계라 1단계엔 목록이 없다. 선택지:
> (a) 1단계는 **자유 입력 text**로 받고, 2단계에서 단체 테이블 FK로 정규화 — **권장(범위 최소)**
> (b) 기본 검도관 목록을 **시드 reference 테이블**로 미리 넣고 Select 제공
> (c) 단체 등록을 1단계로 앞당김(범위 증가)

> **결정 필요 ② — 행정구역(region) 데이터 소스**
> 시/도 → 시군구 2단계 Select용 정적 데이터를 (a) 프론트 상수로 포함할지, (b) reference 테이블로 둘지.
> 기본값: **프론트 상수(JSON)로 포함** — 변동 거의 없음.

### API 엔드포인트

| 메서드 | 경로 | 동작 |
|--------|------|------|
| POST | `/api/auth/signup` | 가입. `role`은 `club_manager`/`player`만 허용, `admin`/`super_admin` 요청 거부(403). 성공 시 로그인 쿠키 설정. |
| POST | `/api/auth/login` | 이메일+비번 검증 → JWT를 httpOnly 쿠키로 설정. |
| POST | `/api/auth/logout` | 쿠키 삭제. |
| GET  | `/api/auth/me` | 쿠키 JWT 검증 → `{ id, email, name, role }` 반환. 미인증 401. |

- 비밀번호 해싱: `bcryptjs` (순수 JS — 서버리스에서 네이티브 빌드 이슈 없음).
- 토큰: `jose`로 JWT 발급/검증. 쿠키: `HttpOnly`·`Secure`·`SameSite=Lax`·`Path=/`, 만료 7일.

### 프론트엔드 동작 (역할 기반 라우팅 — PRD 4.1)

- **signup.html / login.html**: 신규 페이지(기존 디자인 톤 유지. Tailwind 전환은 횡단 과제로 후속).
  - 가입 폼: 성명·연락처·이메일·비밀번호·행정구역(Select)·소속검도관·역할(단체대표/선수).
- **로그인 성공 시 역할별 라우팅**:
  - `super_admin`/`admin` → 기존 대진표 도구(`index.html`) 노출 (최고관리자 전용 화면은 5단계).
  - `club_manager`/`player` → "준비 중 (다음 단계에서 열림)" 안내 랜딩 + 로그아웃.
- **index.html (관리자 도구)**: 진입 시 `/api/auth/me` 호출. 미로그인 → `login.html` 리다이렉트. 권한 없으면 안내 랜딩.
- 상단에 로그인 사용자 이름 + 로그아웃 버튼.
- **display.html**: 변경 없음(공개).

### 에러 처리 / 검증

- 입력 검증(서버 권위): 이메일 형식, 비밀번호 최소 8자, 성명 필수, 역할 화이트리스트.
- 중복 이메일 → 409. 잘못된 로그인 → 401(이메일/비번 구분 없는 일반 메시지).
- `admin`/`super_admin`로 가입 시도 → 403. 서버 오류 → 500(일반 메시지).

### 테스트

- 기존 Jest로 **순수 로직 단위 테스트**: 입력 검증 함수, 비번 해싱/검증 래퍼, JWT 발급/파싱 래퍼.
- 서버리스 API 통합 테스트는 1단계 제외(핸들러 로직을 순수 함수로 분리해 단위 테스트 가능하게 설계).

### 신규/변경 파일 요약

신규:
- `api/auth/signup.js`, `login.js`, `logout.js`, `me.js`
- `src/server/db.js`(Neon), `src/server/auth.js`(해싱/JWT/쿠키), `src/server/validation.js`
- `login.html`, `signup.html`, 관련 프론트 스크립트, `src/data/regions.js`(행정구역 상수)
- `db/migrations/001_init.sql`, `scripts/create-superadmin.mjs`, `.env.example`
- 단위 테스트 파일들

변경:
- `index.html` / `app.js` — 인증 게이트 및 역할 분기
- `package.json` — `@neondatabase/serverless`, `bcryptjs`, `jose` 추가
- `.gitignore` — `.env`
- `README.md` — 환경변수·실행·마이그레이션 안내

## 범위 밖 (후속 단계)

- 단체/대회/신청 엔티티 및 화면 (2~4단계)
- 최고관리자 대시보드·통계·관리자 발급 폼·회원 Data Grid (5단계 / PRD 4.2)
- 폴링 실시간 갱신, Tailwind 반응형 전면 적용 (횡단)
- 48강 등 비(非)2의거듭제곱 대진, 6인(선봉1+대기1+기본4) 단체 엔트리 구조 (4단계)
- 비밀번호 재설정, 이메일 인증
