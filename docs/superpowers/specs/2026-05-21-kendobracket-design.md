# KendoBracket 설계 문서

> 작성일: 2026-05-21  
> 프로젝트: 검도 대회 대진표 운영 시스템

---

## 1. 프로젝트 개요

대회 운영자가 브라우저만으로 대진표를 작성·편집하고, 별도 전광판 창에 실시간 표출하는 오프라인 웹 시스템. 서버 없음, 외부 의존성 없음, localStorage 기반 탭 간 실시간 동기화.

---

## 2. 확정된 설계 결정사항

| 항목 | 결정 |
|------|------|
| 브라켓 시각화 | SVG 기반 |
| 관리자 레이아웃 | 좌우 분할 (좌: 선수/팀·전광판 제어, 우: 대진표) |
| 전광판 모드 | 현재 경기 + 대진표 전체 + 결과 하이라이트 (3개 모두) |
| 파일 분리 | index.html (관리자) / display.html (전광판) 완전 분리 |
| 상태 관리 | 렌더 함수 기반 (`STATE` 변경 → `saveState()` → `renderAll()`) |
| 체급 지원 | 복수 체급, 각각 독립 대진표 |
| 경기 방식 | 개인전 + 단체전 모두 지원 |
| 단체전 팀 인원 | 5~6명 유연하게 설정 |
| 단체전 승패 | 표준 검도 규정 (승수 → 본수 합산 → 대표전) |
| 라인업 재배치 | 드래그앤드롭 (경기 전 포지션 순서 변경) |
| 선수 목록 순서 | ↑↓ 버튼 |
| 대진표 선수 위치 교환 | 드래그앤드롭 |
| JSON 내보내기/불러오기 | 초기 버전 포함 |

---

## 3. 파일 구조

```
KendoBracket/
├── index.html      # 관리자 화면
├── display.html    # 전광판 화면
├── style.css       # 공통 + 화면별 스타일
└── app.js          # 상태 관리 · 브라켓 엔진 · 이벤트 핸들러
```

`app.js`는 두 HTML이 모두 로드하며 `data-page` 속성으로 분기:

```js
if (document.body.dataset.page === 'admin') initAdmin();
else if (document.body.dataset.page === 'display') initDisplay();
```

---

## 4. 데이터 구조

```js
const STATE = {
  meta: {
    title: "제00회 순천검도협회장기",
    updatedAt: 0  // timestamp
  },

  activeDivision: 0,  // 현재 편집 중인 체급 인덱스

  divisions: [
    {
      name: "일반부",
      type: "team",        // "individual" | "team"
      teamSize: 5,         // 5 또는 6 (6인: ["선봉","차봉","부중견","중견","부장","대장"] 등 커스텀)
      positions: ["선봉", "차봉", "중견", "부장", "대장"],  // teamSize에 맞게 설정

      // 개인전일 때 사용
      players: [
        { id: "p1", name: "홍길동", club: "순천검도관", seed: 1 }
      ],

      // 단체전일 때 사용
      teams: [
        {
          id: "t1",
          name: "순천검도관",
          roster: [
            { id: "p1", name: "홍길동" },
            { id: "p2", name: "김태호" },
            { id: "p3", name: "이영희" },
            { id: "p4", name: "박민준" },
            { id: "p5", name: "최수진" }
          ],
          lastLineup: ["p1","p2","p3","p4","p5"]  // 직전 경기 라인업 → 다음 경기 기본값
        }
      ],

      bracket: {
        rounds: [
          {
            roundNo: 1,
            label: "8강",
            matches: [
              // 개인전 경기
              {
                id: "m1",
                type: "individual",
                player1: "p1",
                player2: "p2",
                score1: 2,
                score2: 1,
                winner: "p1",
                status: "done"   // "pending" | "ongoing" | "done"
              },

              // 단체전 경기
              {
                id: "m2",
                type: "team",
                team1: "t1",
                team2: "t2",
                lineup1: ["p1","p2","p3","p4","p5"],  // 포지션 순서 (경기마다 변경 가능)
                lineup2: ["p6","p7","p8","p9","p10"],
                bouts: [
                  // 포지션별 개인 대결 결과
                  { position: "선봉", score1: 2, score2: 1, winner: "t1", status: "done" },
                  { position: "차봉", score1: 0, score2: 2, winner: "t2", status: "done" },
                  { position: "중견", score1: 1, score2: 1, winner: null,  status: "done" },
                  { position: "부장", score1: 0, score2: 0, winner: null,  status: "ongoing" },
                  { position: "대장", score1: 0, score2: 0, winner: null,  status: "pending" }
                ],
                wins1: 1, wins2: 1,   // 팀 승수 (자동 계산)
                // 승수·본수 모두 동점일 때 대표전 추가 (null = 대표전 불필요)
                tiebreaker: null,  // { score1, score2, winner, status } | null
                winner: null,
                status: "ongoing"
              }
            ]
          }
        ]
      }
    }
  ],

  display: {
    mode: "bracket",        // "current" | "bracket" | "result"
    currentMatchId: null,
    autoSlide: true,
    slideInterval: 10000
  }
};
```

---

## 5. 상태 관리 패턴

```
사용자 액션 발생
      ↓
STATE 객체 직접 수정
      ↓
saveState()
  ├─ JSON.stringify → localStorage.setItem("kendo_state", ...)
  └─ dispatchEvent(new StorageEvent("storage", ...))  ← 같은 탭 동기화용
      ↓
renderAll()  ← index.html
  ├─ renderDivisionTabs()
  ├─ renderPlayerList() / renderTeamList()
  ├─ renderBracketSVG()
  └─ renderDisplayControls()

[display.html 탭]
window.addEventListener("storage", () => {
  STATE = JSON.parse(localStorage.getItem("kendo_state"));
  renderDisplay();
})
```

---

## 6. 관리자 화면 레이아웃 (index.html)

```
┌─────────────────────────────────────────────────────────┐
│  🏆 KendoBracket  |  [대회명 입력]       [전광판 열기 ↗]  │ ← 헤더
├─────────────────────┬───────────────────────────────────┤
│                     │                                   │
│  [일반부][고등부][+] │   SVG 대진표 브라켓               │
│  ─────────────────  │                                   │
│  ▸ 개인전 / 단체전  │   완료: 녹색  진행중: 주황 펄스    │
│                     │   미정: 흐린색  BYE: 점선          │
│  선수/팀 목록        │                                   │
│  [+추가] [자동생성]  │   [경기 클릭 → 결과 입력 모달]    │
│                     │                                   │
│  ─────────────────  │                                   │
│  전광판 제어         │                                   │
│  [모드 선택]         │                                   │
│  [현재경기 지정]     │                                   │
│  [자동슬라이드 ON]   │                                   │
│                     │                                   │
│  ─────────────────  │                                   │
│  [JSON 내보내기]     │                                   │
│  [JSON 불러오기]     │                                   │
└─────────────────────┴───────────────────────────────────┘
```

---

## 7. 단체전 라인업 재배치 UI

경기 클릭 시 모달 오픈. 상단에 라인업 재배치, 하단에 개별 대결 결과 입력.

**라인업 재배치 (경기 시작 전):**
- 양 팀 포지션 목록 나란히 표시
- 드래그앤드롭으로 포지션 순서 변경 (`dragstart` / `dragover` / `drop`)
- 변경 즉시 STATE 반영. 경기 확정 시 `team.lastLineup` 갱신 → 다음 경기 모달 열 때 기본값으로 자동 로드

**개별 대결 결과 입력:**
```
선봉: 홍길동  [2] : [1]  김철수   → 팀1 승
차봉: 김태호  [0] : [2]  최동욱   → 팀2 승
중견: 이영희  [1] : [1]  정우성   → 무승부
부장: 박민준  [ ] : [ ]  한지민   → 진행중
대장: 최수진  [ ] : [ ]  오준혁   → 대기
```
- 각 대결 결과 입력 시 팀 승수 자동 집계
- 이미 승패 확정 시 나머지 대결도 계속 진행 (실제 검도 규정)

---

## 8. 전광판 화면 (display.html)

### 3가지 모드

**현재 경기 모드 (`current`):**
- 양 선수/팀명 대형 표시 (최소 48px, 한글 고딕)
- 단체전: 현재 진행 포지션 + 팀 누적 승수 표시
- 배경: 짙은 남색 (#050510)

**대진표 전체 모드 (`bracket`):**
- SVG 브라켓 트리 전체 렌더링
- 완료 경기: 녹색 강조, 진행중: 주황 펄스 애니메이션, 미정: 흐린 색
- 체급 탭으로 전환 가능

**결과 하이라이트 모드 (`result`):**
- 최근 완료 경기 결과 크게 표시
- 다음 예정 경기 예고

### 공통 기능
- 풀스크린 버튼 (`requestFullscreen API`)
- 자동 슬라이드 (10초마다 3모드 순환, ON/OFF)
- 모드 전환 시 페이드 애니메이션

---

## 9. 토너먼트 브라켓 자동 생성 알고리즘

1. 참가자 수 n → 다음 2의 제곱수 N 계산
2. BYE 수 = N - n, 1라운드 하단부터 배치
3. 시드 배치: 1번 상단, 2번 하단, 3·4번 교차 배치
4. 나머지 랜덤 셔플 후 빈 슬롯 채우기
5. 같은 소속/팀 인접 시 스왑 (최대 10회 시도)
6. 단체전은 팀 단위로 동일 알고리즘 적용

---

## 10. SVG 브라켓 렌더링

- 라운드별 x좌표, 경기별 y좌표를 참가자 수 기반으로 동적 계산
- 연결선: `<path>` 요소로 꺾임선 표현
- 상태별 스타일:
  - `done` + 승자: `stroke: #22c55e`, 텍스트 `fill: #86efac`
  - `ongoing`: `stroke: #f59e0b`, 펄스 애니메이션 (`<animate>`)
  - `pending`: `stroke: #374151`, 텍스트 `fill: #4b5563`
  - BYE: `stroke-dasharray: 4,2`
- 최대 64명(32팀) 지원

---

## 11. JSON 내보내기/불러오기

- **내보내기**: `JSON.stringify(STATE)` → `Blob` → `<a download>` 트리거
- **불러오기**: `<input type="file">` → `FileReader` → STATE 복원 → `renderAll()`
- 파일명 형식: `kendobracket_YYYYMMDD_HHMMSS.json`

---

## 12. 개발 마일스톤

| 단계 | 내용 |
|------|------|
| M1 | 파일 골격 + 대회 설정 + 체급 탭 + 선수/팀 CRUD |
| M2 | 토너먼트 브라켓 자동 생성 + SVG 렌더링 |
| M3 | 개인전 경기 결과 입력 모달 + 진출 처리 |
| M4 | 단체전 팀 관리 + 라인업 드래그앤드롭 + 대결 결과 입력 |
| M5 | display.html 전광판 3모드 + localStorage 동기화 |
| M6 | 풀스크린 · 자동슬라이드 · JSON 내보내기/불러오기 |

---

## 13. 제약사항

- Chrome 90+ / Edge 90+ 지원
- 완전 오프라인 동작 (CDN 없음)
- 단일 관리자 전제 (다중 탭 동시 편집 시 마지막 저장 우선)
- 모바일: 전광판 가로 모드 최적화, 관리자는 태블릿 이상 권장
- `@media print` CSS로 대진표 인쇄 지원
