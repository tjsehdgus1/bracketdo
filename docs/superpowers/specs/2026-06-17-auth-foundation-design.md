# 1단계 설계: 인증 토대 (Auth Foundation)

작성일: 2026-06-17

## 배경

KendoBracket은 현재 순수 클라이언트 앱(바닐라 JS + Vite, `localStorage` 저장, 서버/DB 없음)으로
Vercel에 정적 배포되어 있다. 이를 **대회 참가 관리 플랫폼**으로 확장하려 한다.

등장 역할은 3종류:
- **관리자(운영자)** — 대회 개설·대진표 운영
- **단체 대표(감독)** — 단체 생성, 소속 선수 관리, 대회 참가 신청
- **선수** — 개인 계정으로 가입 → 단체에 소속 → 대회 참가

전체 흐름:
```
선수 가입 ─┐
            ├─▶ 단체(대표가 생성) ─▶ 대회 참가신청 ─▶ 관리자 승인 ─▶ 대진표 자동생성 ─▶ 전광판
관리자 ─▶ 대회 개설 ──────────────────────────────┘
```

이는 단일 스펙으로 한 번에 짓기엔 큰 다중 역할 플랫폼이므로 단계로 분할한다.

## 단계 분할 (전체 로드맵)

| 단계 | 내용 | 결과물 |
|------|------|--------|
| **1단계 (이 문서)** | Neon 연결 + Vercel 백엔드(API) + 회원가입/로그인 + 역할 + 세션 | "회원가입하고 로그인" 동작 |
| 2단계 | 단체 생성, 선수의 단체 가입 신청/승인 | 단체-선수 관계 완성 |
| 3단계 | 관리자 대회 개설 + 단체의 참가 신청 + 승인 | 대회 신청 흐름 |
| 4단계 | 신청 데이터 → 기존 대진표 자동 시드 (localStorage → DB 연동) | 전체 통합 |

이 문서는 **1단계(인증 토대)만** 다룬다. 나머지 전부의 토대가 되는 DB·백엔드·인증을 만든다.

## 1단계 범위 결정 사항

- **인증 구현 방식**: 직접 구현 (외부 인증 서비스 사용 안 함). 모든 계정/역할 데이터는 Neon에 저장.
- **역할 배정**: 일반 가입 화면에서는 `club_manager`(단체대표)와 `player`(선수)만 선택 가능.
  `admin`은 가입으로 만들 수 없고 시드 스크립트로 최초 1명을 생성, 이후 관리자가 다른 사람을 관리자로 지정(지정 기능은 후속 단계).
- **로그인 식별자**: 이메일 + 비밀번호.
- **전광판(`display.html`)**: 로그인 없이 공개 유지 (경기장 큰 화면용).
- **대회 데이터**: 1단계에서는 DB로 옮기지 않는다. 기존 `localStorage` 대진표는 그대로 유지. DB 연동은 4단계.

## 아키텍처

```
[브라우저: Vite 정적 프론트]  ──HTTP──▶  [Vercel 서버리스 함수 /api/*]  ──▶  [Neon Postgres]
     index.html (관리자 도구, 게이트)
     login.html / signup.html (신규)
     display.html (공개 유지)
```

- 기존 Vite 구조 유지, `/api` 폴더에 서버리스 함수 추가 (Vercel이 자동 인식)
- DB 드라이버: `@neondatabase/serverless` (HTTP 기반, 서버리스 친화)
- 환경변수: `DATABASE_URL`(Neon 연결 문자열), `JWT_SECRET`(토큰 서명 비밀키). Vercel 대시보드에 설정, 로컬은 `.env`(gitignore).

## 데이터 모델 (Neon)

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin','club_manager','player')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

- 마이그레이션 파일: `db/migrations/001_init.sql`. Neon 콘솔 또는 마이그레이션 스크립트로 실행.
- 최초 관리자 시드: `scripts/create-admin.mjs` — 이메일·비밀번호를 받아 해싱 후 `role='admin'`으로 삽입.

## API 엔드포인트

| 메서드 | 경로 | 동작 |
|--------|------|------|
| POST | `/api/auth/signup` | 가입. `role`은 `club_manager`/`player`만 허용, `admin` 요청은 거부(403). 성공 시 로그인 쿠키 설정. |
| POST | `/api/auth/login` | 이메일+비번 검증 → JWT를 httpOnly 쿠키로 설정. |
| POST | `/api/auth/logout` | 쿠키 삭제. |
| GET  | `/api/auth/me` | 쿠키의 JWT 검증 → 현재 사용자 `{ id, email, name, role }` 반환. 미인증 시 401. |

- 비밀번호 해싱: `bcryptjs` (순수 JS — 서버리스에서 네이티브 빌드 이슈 없음).
- 토큰: `jose`로 JWT 발급/검증. 쿠키 속성: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, 만료 7일.

## 프론트엔드 동작

- **signup.html / login.html**: 신규 페이지. 기존 디자인 톤(`style.css`)에 맞춤.
  - 가입 폼: 이메일, 비밀번호, 이름, 역할 선택(단체대표/선수).
- **index.html (관리자 도구)**: 진입 시 `/api/auth/me` 호출.
  - 미로그인 → `login.html`로 리다이렉트.
  - `admin` → 기존 대진표 도구 그대로 노출.
  - `club_manager`/`player` → "준비 중 (2단계에서 열림)" 안내 랜딩 + 로그아웃 버튼.
  - 상단에 로그인 사용자 이름 + 로그아웃 버튼 표시.
- **display.html**: 변경 없음(공개 유지).

## 에러 처리 / 검증

- 입력 검증(서버 권위): 이메일 형식, 비밀번호 최소 8자, 이름 필수. 프론트 검증은 보조.
- 중복 이메일 → 409.
- 잘못된 로그인 → 401, 이메일/비번 어느 쪽이 틀렸는지 구분하지 않는 일반 메시지.
- `admin` 역할로 가입 시도 → 403.
- DB·토큰 등 서버 오류 → 500, 사용자에겐 일반 메시지.

## 테스트

- 기존 Jest로 **순수 로직 단위 테스트**:
  - 입력 검증 함수(이메일/비번/이름, 허용 역할).
  - 비밀번호 해싱/검증 래퍼.
  - JWT 발급/파싱 래퍼.
- 서버리스 API 통합 테스트는 1단계 제외. 단, 핸들러 로직을 순수 함수로 분리해 단위 테스트 가능하도록 설계.

## 신규/변경 파일 요약

신규:
- `api/auth/signup.js`, `api/auth/login.js`, `api/auth/logout.js`, `api/auth/me.js`
- `src/server/db.js` (Neon 연결), `src/server/auth.js` (해싱/JWT/쿠키 헬퍼), `src/server/validation.js` (검증)
- `login.html`, `signup.html`, 관련 프론트 스크립트
- `db/migrations/001_init.sql`, `scripts/create-admin.mjs`
- `.env.example`
- 단위 테스트 파일들

변경:
- `index.html` / `app.js` — 인증 게이트 및 역할 분기
- `package.json` — 의존성(`@neondatabase/serverless`, `bcryptjs`, `jose`) 추가
- `.gitignore` — `.env` 추가 확인
- `README.md` — 환경변수·실행·마이그레이션 안내

## 범위 밖 (후속 단계)

- 단체/선수/대회/신청 테이블 및 화면 (2~4단계)
- 비밀번호 재설정, 이메일 인증
- 관리자가 다른 사용자를 관리자로 지정하는 UI
- 대진표 데이터의 DB 이전 (4단계)
