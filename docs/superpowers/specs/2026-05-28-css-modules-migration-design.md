# CSS Modules 일괄 전환 설계

작성일: 2026-05-28
브랜치: `feat/css-modules-migration`

## 배경 / 목적

현재 스타일은 단일 전역 `src/ui/styles.css`(1112줄)가 18개 컴포넌트를 담당한다. 토큰
시스템(`:root` CSS 변수)과 BEM 류 네이밍은 잘 잡혀 있으나, 전역 엘리먼트 셀렉터
(`button`, `input`, `select`, `input[type="range"]`)가 컴포넌트별 오버라이드와
충돌해 특이도 우회가 이미 코드에 누적되고 있다. 컴포넌트가 늘수록 이 우회가
증식하는 구조다.

증상 근거(전환으로 제거 대상):
- `styles.css:872` `input.volume-control__range` — 전역 `input[type=range]`를 이기려 접두사로 특이도 상향
- `styles.css:1022` `.track-row__delete-btn:hover` — 전역 `button:hover`(보라)에 덮이지 않으려 빨강 재지정
- `styles.css:1094` `button.top-bar__name` — 전역 `button` 오버라이드

목적: 컴포넌트 스코프 스타일링(CSS Modules)으로 전환해 전역 엘리먼트 셀렉터를
제거하고, 특이도를 (0,1,0)으로 통일해 우회를 근본적으로 없앤다.

## 기술 선택 결론

CSS Modules. 근거: ① 기존 `:root` 토큰을 그대로 재사용 가능, ② Vite 내장(의존성·
런타임 0), ③ 빌드 도구 기능이라 유지보수 중단 리스크 없음. 동적 스타일은 이미
인라인 CSS 변수(`--pct` 등) 관용구로 해결돼 있어 추가 라이브러리 불필요.
(대안 vanilla-extract는 토큰 재작성·빌드 플러그인·종속 비용 대비 이점이 이 규모에서
한계효용이 낮아 제외.)

## 전환 전략: 일괄(big-bang)

전역 `styles.css`를 한 번에 18개 컴포넌트 모듈로 분배한다. 과도기 없이 깔끔하나
단일 거대 변경이므로 **화면 회귀 검증을 강하게 둔다**(아래 4절).

## 1. 파일 구조

```
src/ui/
  base.css                 # 전역 1개: :root 토큰 + reset + body 배경 + 스크롤바 + ::selection
  controls.module.css      # 공유 디자인시스템 프리미티브(.btn, .btnPrimary, .input, .select, .range …)
  cx.ts                    # className 조합 헬퍼(의존성 0)
  Editor.tsx + Editor.module.css
  TrackRow.tsx + TrackRow.module.css
  … (18개 컴포넌트 각각 코로케이션)
```

- 기존 `styles.css` 삭제.
- `base.css`만 진입점(`main.tsx`)에서 1회 import. 나머지는 각 컴포넌트가 자기 모듈 import.
- 버튼/인풋은 거의 모든 컴포넌트가 쓰므로 중복 방지를 위해 `controls.module.css`
  하나에 모아 공유 import. 전역 클래스명을 만들지 않고(모듈 해시) 명시적 import로
  유지 → 진짜 모듈식.

## 2. 전역 vs 모듈 분리 규칙

**base.css에 남는 것(반드시 전역인 것만):**
- `:root` 변수 전체
- `*, *::before, *::after { box-sizing }`
- `html, body, #root` 높이
- `body` 배경 그라데이션 + 폰트/렌더링
- `::selection`
- 커스텀 스크롤바
- 폰트 `@import`(Pretendard, Jua, DM Mono)
- **엘리먼트 셀렉터 0개**

**완전 클래스화:** `button{}`→`.btn`, `.btn--primary`→`.btnPrimary`,
`input[type=range]`→`.range`/`.rangeFill`, `input[type=text]/select`→`.input`/`.select`
등. 전역 엘리먼트·속성 셀렉터를 전부 제거 → 특이도 (0,1,0)으로 통일.
결과적으로 현재 우회 3곳이 모두 불필요.

## 3. 네이밍 & 매핑

- camelCase 클래스명(`.trackRow`, `.btnPrimary`) — TS에서 `styles.trackRow`로 접근.
- BEM 단축: 모듈 파일 자체가 스코프이므로 `.track-row__editor` → `TrackRow.module.css`의 `.editor`.
- 동적 인라인 CSS 변수(`--pct`, `--cell-color`, `--track-color`, `--tone`)는 그대로 유지.
- 여러 클래스 결합(공유 `controls` + 로컬 모듈)은 `cx(controls.btn, styles.deleteBtn)`로.

## 4. 검증 하네스 (핵심)

- **도구:** Playwright(devDependency), `channel: 'chrome'`로 시스템 Chrome 사용
  (브라우저 다운로드 없음). 1회용 스크립트 `scripts/visual-snap.mjs`.
- **캡처 상태:**
  - `/` (home)
  - `/edit` (프로젝트 목록, 예제 포함)
  - `/play` (준비중)
  - `/unknown` (404)
  - `/edit/:id` (에디터 — 예제 프로젝트 로드: 트랜스포트/타임라인/트랙행)
  - 상호작용: 트랙행 포커스 확장 / 볼륨 팝오버 열림 / 스텝시퀀서 패널 / 모드 스위처 / 스코어 HUD
- **절차:**
  1. 전환 전(브랜치 시작점 = main 상태)에서 baseline PNG 캡처
  2. 마이그레이션 수행
  3. 동일 상태 재캡처
  4. baseline/after 쌍을 직접 시각 비교(Read)해 회귀 플래그. 필요 시 pixelmatch 정밀 diff
- 뷰포트 1440×900 고정, 웹폰트 로딩 대기, 캡처 전 애니메이션 안정화 대기.

## 5. 리뷰 & 통합

- 브랜치: `feat/css-modules-migration`
- 커밋 단위:
  1. base.css + controls 모듈 + cx 헬퍼 + 검증 스크립트
  2. 컴포넌트 모듈 전환(논리적 묶음으로 몇 커밋)
  3. styles.css 삭제
- **게이트:** `yarn test:run`(198 통과 유지) + 빌드(`tsc -b && vite build`) 통과 + 스크린샷 diff 무회귀
- 병합 전 코드 리뷰(`requesting-code-review`).

## 비목표 (YAGNI)

- 시각 디자인/레이아웃 변경 없음(픽셀 단위 동일 유지가 성공 기준).
- 반응형 재설계 없음(고정 384px 컬럼 등 현행 유지).
- 토큰 값 변경 없음(이전만, 재정의 아님).
- vanilla-extract/Tailwind 등 추가 라이브러리 도입 없음.
