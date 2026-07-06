# KendoBracket

검도 대회 대진표 운영 시스템 — Vite 프론트 + Vercel 서버리스 + Neon(Postgres) 인증, localStorage 기반 전광판 동기화.

## 실행 방법

1. 로컬 서버 실행: 관리자 화면은 인증 API가 필요하므로 `npx vercel dev`로 실행 (전광판/정적 미리보기는 `npm run dev`도 가능).

2. 브라우저에서 `http://localhost:3000` 열기 (관리자 화면)

3. 전광판은 관리자 화면의 **"전광판 열기 ↗"** 버튼으로 새 탭에서 열기

## 주요 기능

- **복수 체급 지원** — 탭으로 전환하며 독립 대진표 관리
- **개인전 + 단체전** — 단체전은 5~6인 라인업, 포지션별 대결 결과 입력
- **SVG 브라켓** — 자동 생성, 드래그앤드롭으로 위치 교환
- **전광판 3가지 모드** — 현재 경기 / 대진표 전체 / 결과 하이라이트
- **실시간 동기화** — localStorage로 관리자↔전광판 탭 간 자동 업데이트
- **JSON 백업** — 내보내기/불러오기로 대회 데이터 저장

## 개발

```bash
# 의존성 설치 (Jest + Babel — 테스트 전용)
npm install

# 테스트 실행
npm test
```

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

## 파일 구조

```
├── index.html          관리자 화면
├── display.html        전광판 화면
├── style.css           공통 + 화면별 스타일
├── app.js              진입점 (initAdmin / initDisplay 분기)
└── src/
    ├── state.js        STATE 관리 (저장/불러오기)
    ├── bracket-engine.js  토너먼트 브라켓 생성 알고리즘
    ├── scoring.js      승패 계산 (개인전 + 단체전)
    ├── svg-bracket.js  SVG 브라켓 렌더링
    ├── admin-ui.js     관리자 화면 UI
    ├── match-modal.js  경기 결과 입력 모달
    └── display-ui.js   전광판 화면 UI
```

## 브라우저 지원

Chrome 90+ / Edge 90+ (오프라인 동작 가능)
