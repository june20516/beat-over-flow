# CSS Modules 일괄 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전역 `src/ui/styles.css`(1112줄)를 컴포넌트 스코프 CSS Modules로 일괄 전환하고, 전역 엘리먼트 셀렉터를 제거해 특이도 우회를 없앤다.

**Architecture:** 전역은 `base.css`(토큰+reset)만 남기고, 공유 프리미티브는 모듈(`controls`/`primitives`/`screen`), 컴포넌트별 스타일은 코로케이션 `*.module.css`로 분리. 각 커밋이 빌드·렌더를 유지하도록 (globals → controls → 공유 → 컴포넌트별 → styles.css 삭제) 순서로 진행. 일괄 전환의 회귀 리스크는 Playwright(시스템 Chrome) 스크린샷 baseline/after 비교로 검증.

**Tech Stack:** React 18, Vite 5, TypeScript, CSS Modules(Vite 내장), Playwright(devDependency, `channel: 'chrome'`).

---

## 전환 규칙 (모든 태스크 공통)

1. **CSS 규칙 본문은 값 변경 없이 그대로 이동.** 각 태스크가 지정한 `styles.css` 라인 범위의 규칙을 대상 모듈로 옮기고, **셀렉터 이름만** 매핑표대로 바꾼다(kebab→camelCase, 블록 접두사 제거). 색·여백·그림자 등 값은 절대 바꾸지 않는다.
2. **네이밍:** camelCase로 작성(`.trackRow`). TS에서 `styles.trackRow`로 접근(Vite 기본 변환).
3. **여러 클래스 결합:** `cx(...)` 헬퍼로 조합. 예: `cx(controls.btnGhost, controls.btnIcon, styles.edit)`.
4. **규칙 없는 className은 드롭:** 아래 9개는 CSS 규칙도 JS 참조도 없으므로 JSX에서 제거한다 — `base-flow-lane`, `lane-playhead`, `playhead-overlay`, `playhead-overlay__line`, `timeline__arrange`, `track-row-wrap`, `track-editor__clear`, `volume-control__trigger`, `track-row--collapsed`.
5. **`.brand`(styles.css:95-103)는 미사용 → 이동하지 않고 삭제.**
6. **`@keyframes`는 사용처 모듈에 함께 둔다**(CSS Modules가 스코프하고 같은 파일 내 `animation` 참조를 자동 치환): `pulse`→KeyCap, `track-pulse`→TrackRow, `spin`→screen.
7. **커밋 후 게이트:** 각 태스크 끝에서 `yarn build`(tsc+vite)와 `yarn test:run`이 통과해야 한다. (주의: CSS Modules 클래스 오타는 타입상 `string`이라 tsc가 못 잡는다. 최종 시각 검증이 안전망이다.)

> 참고: `styles.css`는 각 태스크에서 점진적으로 비워지며, 마지막 태스크에서 빈 파일이 되어 삭제된다. 매 커밋마다 "규칙은 styles.css 또는 모듈 중 정확히 한 곳"에 존재해 화면이 항상 동일하게 유지된다.

---

## 셀렉터 → 모듈 배치 요약

| 모듈 파일 | 담는 셀렉터(현 BEM) | styles.css 라인 |
|---|---|---|
| `base.css`(전역) | @import 폰트, `:root`, `*box-sizing`, html/body/#root, body, `::selection`, 스크롤바 | 1-92 |
| `controls.module.css` | `button`, `.btn--*`, `input/select/range`, `.range-fill` | 111-250 |
| `primitives.module.css` | `.section-title`, `.panel` | 105-109, 292-296 |
| `screen.module.css` | `.screen`, `.screen__*` + `@keyframes spin` | 671-746 |
| `Editor.module.css` | `.app-shell`, `.top-bar*`, `.editor-main*`, `button.top-bar__name*` | 255-290, 325-338, 1093-1112 |
| `EditorToolbar.module.css` | `.editor-toolbar*` | 917-928, 943 |
| `Timeline.module.css` | `.timeline*`, `.track-drag-overlay` | 340-380, 945-958 |
| `TrackRow.module.css` | `.track-row*`(+sequencer/delete/pulse) + `@keyframes track-pulse` | 748-784, 931-942, 977-1026 |
| `TrackEditor.module.css` | `.track-editor*`(+drag-handle) | 786-809, 902-915 |
| `MarkerEditor.module.css` | `.marker-editor*` | 811-821 |
| `StatusGrid.module.css` | `.status-grid*` | 823-846, 960-975 |
| `VolumeControl.module.css` | `.volume-control*` | 848-900 |
| `StepSequencerPanel.module.css` | `.seq-panel*`, `.field`, `.step-grid`, `.step-cell*`, `.seq-controls`, `.empty-hint` | 443-507, 571-577 |
| `ScoreHud.module.css` | `.score-hud*` | 512-569 |
| `ModeSwitcher.module.css` | `.seg*` | 410-438 |
| `KeyCap.module.css` | `.keycap*` + `@keyframes pulse` | 383-405 |
| `ProjectList.module.css` | `.landing*`, `.project-grid`, `.project-card*` | 582-666, 1040-1091 |
| `RegionOverlay.module.css` | `.region-overlay` | 1028-1038 |

`Home`/`NotFound`/`PlayPlaceholder`/`App`(spinner)은 자체 모듈 없이 `screen.module.css`+`controls.module.css`만 사용. `BaseFlowLane`/`LanePlayhead`/`PlayheadOverlay`는 규칙 없는 className만 가지므로 드롭만 한다.

---

## Task 1: 도구 설정 + 헬퍼 + base.css + 검증 하네스 + baseline 캡처

**Files:**
- Create: `src/vite-env.d.ts`
- Create: `src/ui/cx.ts`
- Create: `src/ui/base.css`
- Create: `scripts/visual-snap.mjs`
- Modify: `package.json` (devDependency, script)

- [ ] **Step 1: CSS Modules 타입 참조 추가**

`src/vite-env.d.ts` 생성:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 2: cx 헬퍼 작성**

`src/ui/cx.ts` 생성:

```ts
/** falsy 값을 걸러 공백으로 결합하는 className 헬퍼. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
```

- [ ] **Step 3: base.css 작성 (전역 토큰 + reset)**

`src/ui/base.css` 생성: 현재 `src/ui/styles.css`의 **1-92행을 그대로 복사**한다(폰트 `@import` 2줄, `:root` 블록, `*box-sizing`, `html/body/#root`, `body`, `::selection`, 스크롤바). 값·셀렉터 변경 없음. 아직 어디서도 import하지 않는다(다음 태스크에서 연결).

- [ ] **Step 4: Playwright 설치 (시스템 Chrome 사용)**

Run:
```bash
yarn add -D playwright
```
Expected: `playwright`가 devDependencies에 추가됨. (브라우저 바이너리는 받지 않는다 — `channel: 'chrome'`로 설치된 Chrome을 쓴다.)

- [ ] **Step 5: 스크린샷 하네스 작성**

`scripts/visual-snap.mjs` 생성:

```js
// 사용법: node scripts/visual-snap.mjs <outDir>
// dev 서버(http://localhost:5173)가 떠 있어야 한다.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = process.argv[2] ?? "snapshots/baseline";
const BASE = process.env.SNAP_BASE ?? "http://localhost:5173";
const VIEWPORT = { width: 1440, height: 900 };

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: VIEWPORT });

async function snap(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // 폰트/애니메이션 안정화
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
}

async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
}

// 1) 정적 라우트
await goto("/");            await snap("01-home");
await goto("/play");        await snap("02-play");
await goto("/nope");        await snap("03-notfound");
await goto("/edit");        await snap("04-projectlist");

// 5) 예제 프로젝트로 에디터 진입 (랜딩의 "예제" CTA 클릭)
await goto("/edit");
await page.getByRole("button", { name: /예제/ }).first().click();
await page.waitForURL(/\/edit\/.+/);
await snap("05-editor");

// 6) 상호작용 상태: 첫 트랙 행 포커스 확장
await page.locator(".track-row, [class*='trackRow']").first().click();
await snap("06-track-focused");

await browser.close();
console.log(`✔ snapshots written to ${outDir}`);
```

> 주의: 셀렉터 `.track-row, [class*='trackRow']`는 전환 전(kebab)·후(해시) 양쪽을 커버한다. "예제" CTA의 정확한 라벨은 `src/ui/ProjectList.tsx`에서 확인해 `name` 정규식을 맞춘다.

- [ ] **Step 6: package.json에 스냅샷 스크립트 추가**

`scripts`에 추가:
```json
"snap": "node scripts/visual-snap.mjs"
```

- [ ] **Step 7: snapshots를 git에서 제외**

`.gitignore`에 한 줄 추가:
```
snapshots/
```

- [ ] **Step 8: baseline 캡처 (전환 전 = main 상태)**

Run (두 터미널 또는 백그라운드):
```bash
yarn dev &           # http://localhost:5173
sleep 4
node scripts/visual-snap.mjs snapshots/baseline
kill %1
```
Expected: `snapshots/baseline/01-home.png` ~ `06-track-focused.png` 6개 PNG 생성. 콘솔에 `✔ snapshots written`.

- [ ] **Step 9: 커밋**

```bash
git add src/vite-env.d.ts src/ui/cx.ts src/ui/base.css scripts/visual-snap.mjs package.json yarn.lock .gitignore
git commit -m "chore: CSS Modules 전환 준비 — base.css/cx 헬퍼/스냅샷 하네스 + baseline"
```

---

## Task 2: 전역 globals를 base.css로 이관

styles.css의 토큰/reset 부분을 base.css가 인수하고, 진입점을 연결한다.

**Files:**
- Modify: `src/main.tsx:4`
- Modify: `src/ui/styles.css:1-92` (삭제)

- [ ] **Step 1: main.tsx에서 base.css를 styles.css보다 먼저 import**

`src/main.tsx`의 `import "./ui/styles.css";`(4행)를 다음으로 교체:
```ts
import "./ui/base.css";
import "./ui/styles.css";
```

- [ ] **Step 2: styles.css에서 중복 globals 제거**

`src/ui/styles.css`의 **1-92행 전체 삭제**(헤더 주석, 폰트 `@import`, `:root`, reset, body, `::selection`, 스크롤바 — 모두 base.css로 이관됨). 파일은 이제 `.brand`(95행)부터 시작.

- [ ] **Step 3: 빌드/테스트 게이트**

Run:
```bash
yarn build && yarn test:run
```
Expected: 빌드 성공, 198 테스트 통과.

- [ ] **Step 4: 커밋**

```bash
git add src/main.tsx src/ui/styles.css
git commit -m "refactor(css): 전역 토큰/reset을 base.css로 이관"
```

---

## Task 3: controls.module.css — 폼 컨트롤/버튼 클래스화 (전역 엘리먼트 셀렉터 제거)

이 리팩터의 핵심. 전역 `button`/`input`/`select`/`input[type=range]` 셀렉터를 없애고 클래스로 전환한다.

**Files:**
- Create: `src/ui/controls.module.css`
- Modify: `src/ui/styles.css` (111-250행 이동, `.brand` 95-103 삭제)
- Modify (JSX, className 교체): `Editor.tsx`, `EditorToolbar.tsx`, `Home.tsx`, `NotFound.tsx`, `PlayPlaceholder.tsx`, `ProjectList.tsx`, `StepSequencerPanel.tsx`, `Timeline.tsx`, `TrackEditor.tsx`, `TrackRow.tsx`, `TransportBar.tsx`, `VolumeControl.tsx`, `ModeSwitcher.tsx`

- [ ] **Step 1: controls.module.css 작성**

`src/ui/styles.css`의 **111-250행**(`button` ~ range-fill)을 `src/ui/controls.module.css`로 이동하며 셀렉터를 아래 매핑으로 변경. 엘리먼트 셀렉터(`button`, `input[...]`, `select`, `option`)는 **클래스로 승격**한다.

| 현재 셀렉터 | 모듈 클래스 |
|---|---|
| `button` | `.btn` |
| `button svg` | `.btn svg` |
| `button:hover` | `.btn:hover` |
| `button:active` | `.btn:active` |
| `button:focus-visible` | `.btn:focus-visible` |
| `.btn--primary`(+:hover) | `.btnPrimary`(+:hover) |
| `.btn--ghost`(+:hover) | `.btnGhost`(+:hover) |
| `.btn--icon` | `.btnIcon` |
| `.btn--danger`(+:hover) | `.btnDanger`(+:hover) |
| `input[type="text"], input[type="number"], input:not([type]), select` | `.input, .select` |
| `input:focus, select:focus` | `.input:focus, .select:focus` |
| `select`(화살표 배경) | `.select` |
| `option` | `.select option` |
| `input[type="range"]`(+thumb/focus) | `.range`(+thumb/focus) |
| `input[type="range"].range-fill` | `.range.rangeFill` |

> `.btnPrimary` 등 변종은 `.btn`과 **함께** 적용되어야 기본 스타일을 상속한다(원래는 `button` 전역이 깔렸으므로). JSX에서 항상 `cx(controls.btn, controls.btnPrimary)`로 결합한다.

- [ ] **Step 2: JSX className 일괄 교체**

각 파일 상단에 `import controls from "./controls.module.css";` 와 (없으면) `import { cx } from "./cx";` 추가 후, `btn--*`/엘리먼트 의존 className을 교체. 정확한 치환:

- `Editor.tsx`: `className="btn--ghost"` → `className={cx(controls.btn, controls.btnGhost)}`
- `EditorToolbar.tsx`:
  - `className="btn--ghost btn--icon"` → `className={cx(controls.btn, controls.btnGhost, controls.btnIcon)}`
  - `className={"btn--ghost" + (sequencerOpen ? " is-active" : "")}` → `className={cx(controls.btn, controls.btnGhost, sequencerOpen && styles.isActive)}` (※ `.is-active`는 EditorToolbar 모듈 소속 → Task 5에서 `styles.isActive` 정의. 이 태스크에서는 우선 `controls.btn, controls.btnGhost`만 적용하고 `is-active`는 임시 문자열 `"is-active"` 유지)
- `Home.tsx`: `className="btn--ghost screen__cta"` → `className={cx(controls.btn, controls.btnGhost, "screen__cta")}`; `className="btn--primary screen__cta"` → `className={cx(controls.btn, controls.btnPrimary, "screen__cta")}` (screen__cta는 Task 4에서 screen 모듈로)
- `NotFound.tsx`: `className="btn--ghost"` → `className={cx(controls.btn, controls.btnGhost)}`
- `PlayPlaceholder.tsx`: `className="btn--ghost"` → `className={cx(controls.btn, controls.btnGhost)}`
- `ProjectList.tsx`:
  - `className="btn--danger"` → `className={cx(controls.btn, controls.btnDanger)}`
  - `className="btn--ghost btn--icon project-card__edit"` → `className={cx(controls.btn, controls.btnGhost, controls.btnIcon, "project-card__edit")}`
  - `className="btn--ghost btn--icon"` → `className={cx(controls.btn, controls.btnGhost, controls.btnIcon)}`
  - `className="btn--ghost landing__cta-secondary"` → `className={cx(controls.btn, controls.btnGhost, "landing__cta-secondary")}`
  - `className="btn--primary landing__cta"` → `className={cx(controls.btn, controls.btnPrimary, "landing__cta")}`
- `StepSequencerPanel.tsx`: `className="btn--ghost"` → `cx(controls.btn, controls.btnGhost)`; `className="btn--primary"` → `cx(controls.btn, controls.btnPrimary)`
- `Timeline.tsx`: `className="btn--primary"` → `cx(controls.btn, controls.btnPrimary)`
- `TrackEditor.tsx`: `className="btn--icon track-editor__clear"` → `cx(controls.btn, controls.btnIcon)` (track-editor__clear는 규칙 없음 → 드롭)
- `TrackRow.tsx`: `className="track-row__delete-btn"`은 `<button>`이므로 `cx(controls.btn, "track-row__delete-btn")` (delete-btn 규칙은 Task 8에서 모듈로)
- `TransportBar.tsx`:
  - `className="btn--icon btn--primary"` → `cx(controls.btn, controls.btnIcon, controls.btnPrimary)`
  - `className="range-fill"` → `cx(controls.range, controls.rangeFill)`
  - `className="transport__seek range-fill"` → `cx("transport__seek", controls.range, controls.rangeFill)`
- `VolumeControl.tsx`: `className="btn--icon volume-control__trigger"` → `cx(controls.btn, controls.btnIcon)` (trigger 규칙 없음 → 드롭); `className="volume-control__range"`는 `<input type=range>`이므로 `cx(controls.range, "volume-control__range")` (range 세로 변형은 Task 9에서)
- `ModeSwitcher.tsx`: `.seg__btn`은 `<button>`이지만 `.seg__btn`이 `border:none` 등 자체 스타일 → Task 12에서 모듈화. 이 태스크에선 `<select>`/`<input>`/`<button>` 중 `btn--*`만 교체(해당 없음). **변경 없음.**

> **모든 `<select>`와 `<input type=text|number>`**: 현재 전역 셀렉터로 스타일되므로, 전역 제거 후엔 클래스가 필요하다. 각 파일에서 해당 엘리먼트에 `className={controls.select}` / `className={controls.input}`를 추가한다. 대상 확인: `StepSequencerPanel.tsx`(select, input×2), `TrackEditor.tsx`(select), `Timeline.tsx`(없으면 skip), `ProjectList.tsx`(rename input은 `project-card__rename` 클래스 보유 → Task 13), `Editor.tsx`(`top-bar__name-input` 보유 → Task 5), `MarkerEditor.tsx`(없음). grep으로 누락 점검: `grep -nE "<select|<input" src/ui/*.tsx`.

- [ ] **Step 3: styles.css에서 controls 규칙 + .brand 삭제**

`src/ui/styles.css`에서 `.brand`(95-103) 및 `button`~`range-fill`(111-250) 규칙을 삭제. 주석 구분선은 정리.

- [ ] **Step 4: 빌드/테스트 게이트 + 중간 시각 점검**

Run:
```bash
yarn build && yarn test:run
```
Expected: 빌드 성공, 198 테스트 통과. (선택) `yarn dev` 후 버튼/인풋/슬라이더가 이전과 동일하게 보이는지 눈으로 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/controls.module.css src/ui/styles.css src/ui/*.tsx
git commit -m "refactor(css): 폼 컨트롤/버튼을 controls 모듈로 클래스화, 전역 엘리먼트 셀렉터 제거"
```

---

## Task 4: primitives.module.css + screen.module.css (공유)

**Files:**
- Create: `src/ui/primitives.module.css`, `src/ui/screen.module.css`
- Modify: `src/ui/styles.css` (105-109, 292-296, 671-746 삭제)
- Modify (JSX): `ProjectList.tsx`, `TransportBar.tsx`, `StepSequencerPanel.tsx`, `Timeline.tsx`, `Home.tsx`, `NotFound.tsx`, `PlayPlaceholder.tsx`, `App.tsx`

- [ ] **Step 1: primitives.module.css 작성**

styles.css `105-109`(`.section-title`)과 `292-296`(`.panel`)을 이동.

| 현재 | 모듈 |
|---|---|
| `.section-title` | `.sectionTitle` |
| `.panel` | `.panel` |

- [ ] **Step 2: screen.module.css 작성**

styles.css `671-746`(`.screen` ~ `@keyframes spin`)을 이동.

| 현재 | 모듈 |
|---|---|
| `.screen` | `.screen` |
| `.screen__title` | `.screenTitle` |
| `.screen__title--sm` | `.screenTitleSm` |
| `.screen__lead` | `.screenLead` |
| `.screen__actions` | `.screenActions` |
| `.screen__cta` | `.screenCta` |
| `.screen__code` | `.screenCode` |
| `.screen__badge` | `.screenBadge` |
| `.screen__spinner` | `.screenSpinner` |
| `@keyframes spin` | (그대로, 모듈 내 스코프) |

- [ ] **Step 3: JSX 교체 — panel**

각 파일에 `import primitives from "./primitives.module.css";` 추가:
- `ProjectList.tsx`: `className="project-card panel"` → `className={cx("project-card", primitives.panel)}`
- `TransportBar.tsx`: `className="transport panel"` → `className={cx("transport", primitives.panel)}`
- `StepSequencerPanel.tsx`: `className="seq-panel panel"` → `cx("seq-panel", primitives.panel)`; `className="empty-hint panel"` → `cx("empty-hint", primitives.panel)`

- [ ] **Step 4: JSX 교체 — sectionTitle**

- `StepSequencerPanel.tsx`: `className="section-title"` → `className={primitives.sectionTitle}`
- `Timeline.tsx`: `className="section-title"` → `className={primitives.sectionTitle}`

- [ ] **Step 5: JSX 교체 — screen (Home/NotFound/PlayPlaceholder/App)**

각 파일에 `import screen from "./screen.module.css";`(App은 경로 `./ui/screen.module.css`) 추가:
- `Home.tsx`: `screen`→`screen.screen`, `screen__title`→`screen.screenTitle`, `screen__lead`→`screen.screenLead`, `screen__actions`→`screen.screenActions`, `screen__cta`(Task3에서 문자열로 둔 것)→`screen.screenCta`로 마무리. 예: `cx(controls.btn, controls.btnPrimary, screen.screenCta)`.
- `NotFound.tsx`: `screen`→`screen.screen`, `screen__code`→`screen.screenCode`, `screen__lead`→`screen.screenLead`.
- `PlayPlaceholder.tsx`: `screen`→`screen.screen`, `screen__badge`→`screen.screenBadge`, `screen__lead`→`screen.screenLead`, `screen__title screen__title--sm`→`cx(screen.screenTitle, screen.screenTitleSm)`.
- `App.tsx:43`: `className="screen__spinner"` → `className={screen.screenSpinner}` (필요 시 부모도 `screen.screen`). import: `import screen from "./ui/screen.module.css";`

- [ ] **Step 6: styles.css에서 해당 규칙 삭제**

styles.css `105-109`, `292-296`, `671-746` 삭제.

- [ ] **Step 7: 게이트 + 커밋**

```bash
yarn build && yarn test:run
git add src/ui/primitives.module.css src/ui/screen.module.css src/ui/*.tsx src/App.tsx src/ui/styles.css
git commit -m "refactor(css): 공유 프리미티브(panel/section-title)·screen 모듈 분리"
```

---

## Task 5: Editor.module.css

**Files:** Create `src/ui/Editor.module.css`; Modify `src/ui/Editor.tsx`, `src/ui/styles.css`(255-290, 325-338, 1093-1112)

- [ ] **Step 1: 모듈 작성** — styles.css `255-259`(.app-shell), `261-290`(.top-bar*), `325-338`(.editor-main*), `1093-1112`(button.top-bar__name*, .top-bar__name-input) 이동.

| 현재 | 모듈 |
|---|---|
| `.app-shell` | `.appShell` |
| `.top-bar` | `.topBar` |
| `.top-bar__name`(+::before) | `.topBarName` |
| `.top-bar__spacer` | `.topBarSpacer` |
| `.editor-main` | `.editorMain` |
| `.editor-main__timeline` | `.editorMainTimeline` |
| `button.top-bar__name`(+:hover) | `.topBarName`(버튼용 — 동일 클래스에 병합) |
| `.top-bar__name-input` | `.topBarNameInput` |

> `button.top-bar__name`(1094-1103)은 `.top-bar__name`(273-287)과 같은 요소의 버튼 버전이다. 모듈에선 둘 다 `.topBarName`으로 병합하되 `border:none; background:none; padding:0; cursor:pointer`와 `::before`/폰트 규칙이 공존하도록 합친다.

- [ ] **Step 2: Editor.tsx 교체** — `import styles from "./Editor.module.css";` 추가 후: `app-shell`→`styles.appShell`, `top-bar`→`styles.topBar`, `top-bar__name`→`styles.topBarName`, `top-bar__spacer`→`styles.topBarSpacer`, `editor-main`→`styles.editorMain`, `editor-main__timeline`→`styles.editorMainTimeline`, `top-bar__name-input`→`cx(controls.input, styles.topBarNameInput)` 또는 단독 `styles.topBarNameInput`(이름 입력은 자체 스타일 보유).

- [ ] **Step 3: styles.css 해당 행 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/Editor.module.css src/ui/Editor.tsx src/ui/styles.css
git commit -m "refactor(css): Editor 모듈화"
```

> 이 태스크에서 Task 3의 EditorToolbar `is-active` 임시 문자열은 다음 Task 6에서 정리한다.

---

## Task 6: EditorToolbar.module.css

**Files:** Create `src/ui/EditorToolbar.module.css`; Modify `src/ui/EditorToolbar.tsx`, `src/ui/styles.css`(917-928, 943)

- [ ] **Step 1: 모듈 작성** — styles.css `918-924`(.editor-toolbar), `925-928`(.btn--ghost.is-active), `943`(.editor-toolbar__sep) 이동.

| 현재 | 모듈 |
|---|---|
| `.editor-toolbar` | `.editorToolbar` |
| `.editor-toolbar .btn--ghost.is-active` | `.isActive` (단독 클래스로; `cx`로 btnGhost와 결합되므로 `.isActive { background:#2a3550; color:#fff; }`로 단순화) |
| `.editor-toolbar__sep` | `.editorToolbarSep` |

- [ ] **Step 2: EditorToolbar.tsx 교체** — `import styles from "./EditorToolbar.module.css";`. `editor-toolbar`→`styles.editorToolbar`; `editor-toolbar__sep`→`styles.editorToolbarSep`; Task3에서 둔 `sequencerOpen && "is-active"` → `sequencerOpen && styles.isActive`.

- [ ] **Step 3: styles.css 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/EditorToolbar.module.css src/ui/EditorToolbar.tsx src/ui/styles.css
git commit -m "refactor(css): EditorToolbar 모듈화"
```

---

## Task 7: Timeline.module.css

**Files:** Create `src/ui/Timeline.module.css`; Modify `src/ui/Timeline.tsx`, `src/ui/styles.css`(340-380, 945-958)

- [ ] **Step 1: 모듈 작성** — styles.css `341-380`(.timeline*), `945-958`(.track-drag-overlay) 이동.

| 현재 | 모듈 |
|---|---|
| `.timeline` | `.timeline` |
| `.timeline__header-row` | `.headerRow` |
| `.timeline__fixed-col` | `.fixedCol` |
| `.timeline__head`(+.section-title, +button) | `.head` (※ `.timeline__head button`은 `.head button`으로; `.timeline__head .section-title`은 `.head :global(...)` 불필요 — sectionTitle은 primitives 모듈이므로 `.head` 자식 마진은 `.head > *` 또는 해당 규칙을 `margin-left:auto` 유지하도록 `.head button{margin-left:auto}`만 남김) |
| `.timeline__rows` | `.rows` |

> `.timeline__head .section-title { font-size:16px }`(367-369): sectionTitle이 다른 모듈이라 자손 선택 불가. 대안 — Timeline.tsx에서 해당 `<*>`에 `cx(primitives.sectionTitle, styles.headTitle)` 적용하고 모듈에 `.headTitle{font-size:16px}` 추가.

- [ ] **Step 2: Timeline.tsx 교체** — `import styles from "./Timeline.module.css";`. `timeline`→`styles.timeline`, `timeline__header-row`→`styles.headerRow`, `timeline__fixed-col`→`styles.fixedCol`, `timeline__head`→`styles.head`, `timeline__rows`→`styles.rows`, `track-drag-overlay`→`styles.trackDragOverlay`, `timeline__arrange`→드롭(규칙없음). 헤더 타이틀 요소: `cx(primitives.sectionTitle, styles.headTitle)`.

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/Timeline.module.css src/ui/Timeline.tsx src/ui/styles.css
git commit -m "refactor(css): Timeline 모듈화"
```

---

## Task 8: TrackRow.module.css

**Files:** Create `src/ui/TrackRow.module.css`; Modify `src/ui/TrackRow.tsx`, `src/ui/styles.css`(748-784, 931-942, 977-1026)

- [ ] **Step 1: 모듈 작성** — styles.css `749-784`(.track-row*, editor, lane), `931-942`(.track-row__sequencer*), `977-1026`(.track-row--pulse + @keyframes track-pulse, .track-row position:relative, .track-row__delete*) 이동. `.track-row{position:relative}`(985)는 메인 `.trackRow` 규칙(749)에 병합.

| 현재 | 모듈 |
|---|---|
| `.track-row`(+position) | `.trackRow` |
| `.track-row--even` | `.even` |
| `.track-row--odd` | `.odd` |
| `.track-row:hover` | `.trackRow:hover` |
| `.track-row--focused` | `.focused` |
| `.track-row--pulse` | `.pulse` |
| `@keyframes track-pulse` | (그대로) |
| `.track-row__editor` | `.editor` |
| `.track-row__lane` | `.lane` |
| `.track-row__sequencer` | `.sequencer` |
| `.track-row__sequencer-gutter` | `.sequencerGutter` |
| `.track-row__sequencer-body` | `.sequencerBody` |
| `.track-row__delete` | `.delete` |
| `.track-row__delete-handle` | `.deleteHandle` |
| `.track-row__delete-btn`(+:hover, +.delete:hover 연동) | `.deleteBtn` |

> `.track-row__delete:hover .track-row__delete-btn`(1016) → `.delete:hover .deleteBtn`. `.track-row__delete-btn:hover`(1022)는 Task3에서 `cx(controls.btn, ...)`로 바뀌었으므로, 모듈 `.deleteBtn`(특이도 0,1,0)이 `controls.btn`과 동급이라 소스 순서로 결정 — 빨강 유지를 위해 `.deleteBtn`에 `background`를 명시(원본 1005-1015 값 유지). 전역 `button:hover`가 사라졌으므로 원래의 우회 주석은 불필요.

- [ ] **Step 2: TrackRow.tsx 교체** — `import styles from "./TrackRow.module.css";`. rowClass 배열을 모듈 참조로:
```ts
const rowClass = cx(
  styles.trackRow,
  focused ? styles.focused : null,        // track-row--collapsed는 규칙없음 → 드롭
  index % 2 === 0 ? styles.even : styles.odd,
  pulsing ? styles.pulse : null,
);
```
나머지: `track-row-wrap`→드롭(wrapper div의 className 제거), `track-row__editor`→`styles.editor`, `track-row__lane`→`styles.lane`, `track-row__delete`→`styles.delete`, `track-row__delete-handle`→`styles.deleteHandle`, `track-row__delete-btn`→`cx(controls.btn, styles.deleteBtn)`, `track-row__sequencer`→`styles.sequencer`, `track-row__sequencer-gutter`→`styles.sequencerGutter`, `track-row__sequencer-body`→`styles.sequencerBody`.

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/TrackRow.module.css src/ui/TrackRow.tsx src/ui/styles.css
git commit -m "refactor(css): TrackRow 모듈화"
```

---

## Task 9: TrackEditor.module.css

**Files:** Create `src/ui/TrackEditor.module.css`; Modify `src/ui/TrackEditor.tsx`, `src/ui/styles.css`(786-809, 902-915)

- [ ] **Step 1: 모듈 작성** — styles.css `786-809`(.track-editor*), `902-915`(.track-editor__drag-handle*) 이동.

| 현재 | 모듈 |
|---|---|
| `.track-editor` | `.trackEditor` |
| `.track-editor__name` | `.name` |
| `.track-editor select` | `.trackEditor :global select`? → 불가. 대신 `.select`(아래 주석) |
| `.track-editor input[type="range"]` | 동일 문제 |
| `.track-editor__drag-handle`(+:active) | `.dragHandle` |
| (track-editor--focused: 규칙 확인) | `.focused` (있으면) |

> `.track-editor select`(800-805)·`.track-editor input[type=range]`(806-809)는 자손 엘리먼트 선택이다. 모듈에선 폭 등 레이아웃만 필요하므로, TrackEditor.tsx의 해당 `<select>`/`<input>`에 `cx(controls.select, styles.selectSlot)` / `cx(controls.range, styles.rangeSlot)`를 주고, 모듈에 `.selectSlot{flex:none;width:58px;font-size:11px;padding:5px 18px 5px 6px}` / `.rangeSlot{width:40px;flex:none}` 정의(원본 값 유지). `track-editor--focused`가 styles.css에 있으면 `.focused`로, 없으면 무시.

- [ ] **Step 2: TrackEditor.tsx 교체** — `import styles from "./TrackEditor.module.css";`. `track-editor`(또는 focused 조건부)→`cx(styles.trackEditor, focused && styles.focused)`, `track-editor__name`→`cx(controls.input, styles.name)`, `track-editor__drag-handle`→`styles.dragHandle`, `track-editor__clear`→이미 Task3에서 드롭. select/range는 위 주석대로.

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/TrackEditor.module.css src/ui/TrackEditor.tsx src/ui/styles.css
git commit -m "refactor(css): TrackEditor 모듈화"
```

---

## Task 10: MarkerEditor.module.css

**Files:** Create `src/ui/MarkerEditor.module.css`; Modify `src/ui/MarkerEditor.tsx`, `src/ui/styles.css`(811-821)

- [ ] **Step 1: 모듈 작성** — styles.css `811-821` 이동.

| 현재 | 모듈 |
|---|---|
| `.marker-editor` | `.markerEditor` |
| `.marker-editor--editable` | `.editable` |
| `.marker-editor--overview` | `.overview` |

- [ ] **Step 2: MarkerEditor.tsx 교체** — `import styles from "./MarkerEditor.module.css";`. `marker-editor marker-editor--overview`→`cx(styles.markerEditor, styles.overview)`; 조건부 `editable ? "marker-editor marker-editor--editable" : "marker-editor"`→`cx(styles.markerEditor, editable && styles.editable)`.

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/MarkerEditor.module.css src/ui/MarkerEditor.tsx src/ui/styles.css
git commit -m "refactor(css): MarkerEditor 모듈화"
```

---

## Task 11: StatusGrid.module.css

**Files:** Create `src/ui/StatusGrid.module.css`; Modify `src/ui/StatusGrid.tsx`, `src/ui/styles.css`(823-846, 960-975)

- [ ] **Step 1: 모듈 작성** — styles.css `824-846`(.status-grid*), `960-975`(.status-grid--compact, .status-grid__letter) 이동.

| 현재 | 모듈 |
|---|---|
| `.status-grid` | `.statusGrid` |
| `.status-grid__cell` | `.cell` |
| `.status-grid__cell--on` | `.cellOn` |
| `.status-grid--compact` | `.compact` |
| `.status-grid__letter` | `.letter` |

- [ ] **Step 2: StatusGrid.tsx 교체** — `import styles from "./StatusGrid.module.css";`. `status-grid status-grid--compact`→`cx(styles.statusGrid, styles.compact)`; `status-grid__letter`→`styles.letter`; `status-grid`→`styles.statusGrid`; 조건부 `selected ? "status-grid__cell status-grid__cell--on" : "status-grid__cell"`→`cx(styles.cell, selected && styles.cellOn)`. (`.cell`은 `<button>` — 자체 스타일 보유하므로 `controls.btn` 불필요, 단독 `styles.cell`.)

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/StatusGrid.module.css src/ui/StatusGrid.tsx src/ui/styles.css
git commit -m "refactor(css): StatusGrid 모듈화"
```

---

## Task 12: VolumeControl.module.css + ModeSwitcher.module.css

**Files:** Create `src/ui/VolumeControl.module.css`, `src/ui/ModeSwitcher.module.css`; Modify `src/ui/VolumeControl.tsx`, `src/ui/ModeSwitcher.tsx`, `src/ui/styles.css`(848-900, 410-438)

- [ ] **Step 1: VolumeControl 모듈 작성** — styles.css `849-900` 이동.

| 현재 | 모듈 |
|---|---|
| `.volume-control` | `.volumeControl` |
| `.volume-control__popover` | `.popover` |
| `.volume-control__pct` | `.pct` |
| `input.volume-control__range`(+thumb/active) | `.range`(세로 변형) |

> `input.volume-control__range`(872)의 `input.` 접두사는 전역 `input[type=range]`를 이기려던 우회였다. 전역이 사라졌으므로 모듈 `.range`(VolumeControl 자체)로 충분 — JSX에서 `cx(controls.range, styles.range)`로 적용하면 세로 변형 값이 controls 기본을 덮는다(소스 순서: 컴포넌트 모듈이 controls보다 뒤 import면 승. 안전하게 세로 전용 속성 전부 명시).

- [ ] **Step 2: ModeSwitcher 모듈 작성** — styles.css `410-438` 이동.

| 현재 | 모듈 |
|---|---|
| `.seg` | `.seg` |
| `.seg__btn`(+:hover) | `.segBtn` |
| `.seg__btn--active`(+:hover) | `.segBtnActive` |

- [ ] **Step 3: JSX 교체**
- `VolumeControl.tsx`: `import styles from "./VolumeControl.module.css";`. `volume-control`→`styles.volumeControl`, `volume-control__popover`→`styles.popover`, `volume-control__pct`→`styles.pct`, `volume-control__range`(Task3에서 `cx(controls.range, "volume-control__range")`)→`cx(controls.range, styles.range)`, `volume-control__trigger`→이미 드롭.
- `ModeSwitcher.tsx`: `import styles from "./ModeSwitcher.module.css";`. `seg`→`styles.seg`; 조건부 `active ? "seg__btn seg__btn--active" : "seg__btn"`→`cx(styles.segBtn, active && styles.segBtnActive)`. (`.segBtn`은 `border:none` 등 자체 스타일 → `controls.btn` 불필요.)

- [ ] **Step 4: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/VolumeControl.module.css src/ui/ModeSwitcher.module.css src/ui/VolumeControl.tsx src/ui/ModeSwitcher.tsx src/ui/styles.css
git commit -m "refactor(css): VolumeControl·ModeSwitcher 모듈화"
```

---

## Task 13: StepSequencerPanel.module.css

**Files:** Create `src/ui/StepSequencerPanel.module.css`; Modify `src/ui/StepSequencerPanel.tsx`, `src/ui/styles.css`(443-507, 571-577)

- [ ] **Step 1: 모듈 작성** — styles.css `443-457`(.seq-panel*), `459-470`(.field), `472-498`(.step-grid, .step-cell*), `500-507`(.seq-controls), `571-577`(.empty-hint) 이동.

| 현재 | 모듈 |
|---|---|
| `.seq-panel` | `.seqPanel` |
| `.seq-panel__head` | `.head` |
| `.seq-panel__head .section-title` | (sectionTitle 자손 → JSX에서 `cx(primitives.sectionTitle, styles.headTitle)`, 모듈에 `.headTitle{font-size:15px;margin-right:4px}`) |
| `.field`(+input) | `.field`(`.field input`→`.field input` 유지 가능, 자손 엘리먼트지만 모듈 내 스코프 OK) |
| `.step-grid` | `.stepGrid` |
| `.step-cell`(+:hover) | `.stepCell` |
| `.step-cell--active` | `.stepCellActive` |
| `.step-cell--beat` | `.stepCellBeat` |
| `.seq-controls` | `.seqControls` |
| `.empty-hint` | `.emptyHint` |

- [ ] **Step 2: StepSequencerPanel.tsx 교체** — `import styles from "./StepSequencerPanel.module.css";`. `seq-panel`(panel과 결합)→`cx(styles.seqPanel, primitives.panel)`; `seq-panel__head`→`styles.head`; `section-title`(head 내)→`cx(primitives.sectionTitle, styles.headTitle)`; `field`→`styles.field`; `step-grid`→`styles.stepGrid`; `empty-hint`(panel 결합)→`cx(styles.emptyHint, primitives.panel)`; `seq-controls`→`styles.seqControls`. step-cell 동적:
```ts
className={cx(styles.stepCell, active[i] && styles.stepCellActive, i % 4 === 0 && styles.stepCellBeat)}
```
패널 내 `<select>`/`<input>`: `controls.select`/`controls.input` 부여(Task3에서 누락됐으면 여기서).

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/StepSequencerPanel.module.css src/ui/StepSequencerPanel.tsx src/ui/styles.css
git commit -m "refactor(css): StepSequencerPanel 모듈화"
```

---

## Task 14: ScoreHud.module.css

**Files:** Create `src/ui/ScoreHud.module.css`; Modify `src/ui/ScoreHud.tsx`, `src/ui/styles.css`(512-569)

- [ ] **Step 1: 모듈 작성** — styles.css `512-569` 이동.

| 현재 | 모듈 |
|---|---|
| `.score-hud` | `.scoreHud` |
| `.score-hud__label` | `.label` |
| `.score-hud__value` | `.value` |
| `.score-hud__combo`(+b) | `.combo` |
| `.score-hud__acc` | `.acc` |
| `.score-hud__judge`(+.p/.g/.m) | `.judge` (`.judge .p`, `.judge .g`, `.judge .m`로) |

- [ ] **Step 2: ScoreHud.tsx 교체** — `import styles from "./ScoreHud.module.css";`. `score-hud`→`styles.scoreHud`, `score-hud__label`→`styles.label`, `score-hud__value`→`styles.value`, `score-hud__combo`→`styles.combo`, `score-hud__acc`→`styles.acc`, `score-hud__judge`→`styles.judge`. `p`/`g`/`m`은 `.judge` 내부 자식이므로 className을 `styles.p`/`styles.g`/`styles.m`로 바꾸고 모듈에서 `.judge .p` 대신 `.p{color:var(--green)}` 단독 정의(또는 `.judge .p` 유지 시 자식에 `styles.p` 부여).

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/ScoreHud.module.css src/ui/ScoreHud.tsx src/ui/styles.css
git commit -m "refactor(css): ScoreHud 모듈화"
```

---

## Task 15: KeyCap.module.css

**Files:** Create `src/ui/KeyCap.module.css`; Modify `src/ui/KeyCap.tsx`, `src/ui/styles.css`(383-405)

- [ ] **Step 1: 모듈 작성** — styles.css `383-405`(.keycap*, @keyframes pulse) 이동.

| 현재 | 모듈 |
|---|---|
| `.keycap` | `.keycap` |
| `.keycap--capturing` | `.capturing` |
| `@keyframes pulse` | (그대로) |

- [ ] **Step 2: KeyCap.tsx 교체** — `import styles from "./KeyCap.module.css";`. 조건부 `capturing ? "keycap keycap--capturing" : "keycap"`→`cx(styles.keycap, capturing && styles.capturing)`.

- [ ] **Step 3: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/KeyCap.module.css src/ui/KeyCap.tsx src/ui/styles.css
git commit -m "refactor(css): KeyCap 모듈화"
```

---

## Task 16: ProjectList.module.css + RegionOverlay.module.css + 규칙없는 className 정리

**Files:** Create `src/ui/ProjectList.module.css`, `src/ui/RegionOverlay.module.css`; Modify `src/ui/ProjectList.tsx`, `src/ui/RegionOverlay.tsx`, `src/ui/BaseFlowLane.tsx`, `src/ui/LanePlayhead.tsx`, `src/ui/PlayheadOverlay.tsx`, `src/ui/styles.css`(582-666, 1040-1091, 1028-1038)

- [ ] **Step 1: ProjectList 모듈 작성** — styles.css `582-666`(.landing*, .project-grid, .project-card*), `1040-1091`(.landing__cta-row, .landing__cta-secondary, .project-card__title/edit/actions/rename) 이동.

| 현재 | 모듈 |
|---|---|
| `.landing` | `.landing` |
| `.landing__hero` | `.hero` |
| `.landing__title` | `.title` |
| `.landing__tagline` | `.tagline` |
| `.landing__cta` | `.cta` |
| `.landing__cta-row` | `.ctaRow` |
| `.landing__cta-secondary` | `.ctaSecondary` |
| `.landing__empty` | `.empty` |
| `.project-grid` | `.grid` |
| `.project-card`(+:hover) | `.card` |
| `.project-card__open`(+::after) | `.open` |
| `.project-card__footer` | `.footer` |
| `.project-card .btn--danger` | (JSX에서 `.card` 내 danger 버튼에 `styles.dangerSlot` 부여, 모듈 `.dangerSlot{position:relative;z-index:1}`) |
| `.project-card__title`(+ .open) | `.title2`(이름 충돌 주의 → `.cardTitle`) |
| `.project-card__edit`(+:hover) | `.edit` |
| `.project-card__actions`(+ .btn--icon) | `.actions`(자식 icon: JSX에서 `styles.actionSlot`) |
| `.project-card__rename` | `.rename` |

> 이름 충돌 주의: `.landing__title`→`.title`, `.project-card__title`→`.cardTitle`로 구분. `.project-card .btn--danger`(658)·`.project-card__actions .btn--icon`(1076)·`.project-card__edit`(1062)의 `position:relative;z-index:1`은 카드 `.open::after` 오버레이 위로 올리는 용도 → 해당 버튼 JSX에 보조 클래스(`styles.dangerSlot`/`styles.actionSlot`/`styles.edit`)로 부여.

- [ ] **Step 2: RegionOverlay 모듈 작성** — styles.css `1028-1038`(.region-overlay) 이동. `.region-overlay`→`.regionOverlay`.

- [ ] **Step 3: ProjectList.tsx 교체** — `import styles from "./ProjectList.module.css";`. 매핑표대로 전부 교체. 버튼들은 Task3에서 `cx(controls.btn, controls.btn*, "project-card__edit")` 식으로 문자열을 남겨뒀으니, 그 문자열을 `styles.edit` 등으로 마무리. 예:
  - `cx(controls.btn, controls.btnGhost, controls.btnIcon, "project-card__edit")` → `cx(controls.btn, controls.btnGhost, controls.btnIcon, styles.edit)`
  - `cx(controls.btn, controls.btnGhost, "landing__cta-secondary")` → `cx(controls.btn, controls.btnGhost, styles.ctaSecondary)`
  - `cx(controls.btn, controls.btnPrimary, "landing__cta")` → `cx(controls.btn, controls.btnPrimary, styles.cta)`
  - `cx(controls.btn, controls.btnDanger)` (danger) → `cx(controls.btn, controls.btnDanger, styles.dangerSlot)`
  - `cx("project-card", primitives.panel)` → `cx(styles.card, primitives.panel)`
  - `project-card__open`→`styles.open`, `project-card__footer`→`styles.footer`, `project-card__title`→`styles.cardTitle`, `project-card__actions`→`styles.actions`, `project-card__rename`→`cx(controls.input, styles.rename)`, `landing`→`styles.landing`, `landing__hero`→`styles.hero`, `landing__title`→`styles.title`, `landing__tagline`→`styles.tagline`, `landing__empty`→`styles.empty`, `landing__cta-row`→`styles.ctaRow`, `project-grid`→`styles.grid`.
  - actions 내 `btn--icon` 버튼: `cx(controls.btn, controls.btnIcon, styles.actionSlot)`.

- [ ] **Step 4: RegionOverlay.tsx 교체** — `import styles from "./RegionOverlay.module.css";`. `region-overlay`→`styles.regionOverlay`.

- [ ] **Step 5: 규칙없는 className 드롭** — `BaseFlowLane.tsx`의 `className="base-flow-lane"`, `LanePlayhead.tsx`의 `className="lane-playhead"`, `PlayheadOverlay.tsx`의 `className="playhead-overlay"`·`className="playhead-overlay__line"` 제거(또는 `className` 속성 삭제). 이들은 CSS 규칙·JS 참조가 없다.

- [ ] **Step 6: 삭제 → 게이트 → 커밋**

```bash
yarn build && yarn test:run
git add src/ui/ProjectList.module.css src/ui/RegionOverlay.module.css src/ui/*.tsx src/ui/styles.css
git commit -m "refactor(css): ProjectList·RegionOverlay 모듈화, 규칙없는 className 제거"
```

---

## Task 17: styles.css 삭제 + 최종 검증 (스크린샷 diff)

**Files:** Delete `src/ui/styles.css`; Modify `src/main.tsx`

- [ ] **Step 1: styles.css가 비었는지 확인**

Run: `grep -cE "[{}]" src/ui/styles.css`
Expected: `0` (규칙 없음). 남은 규칙이 있으면 해당 컴포넌트 태스크로 돌아가 이동.

- [ ] **Step 2: 파일 삭제 + import 제거**

`src/main.tsx`에서 `import "./ui/styles.css";` 삭제. 파일 삭제: `git rm src/ui/styles.css`.

- [ ] **Step 3: 전체 게이트**

Run:
```bash
yarn build && yarn test:run
```
Expected: 빌드 성공, 198 테스트 통과.

- [ ] **Step 4: after 스크린샷 캡처**

Run:
```bash
yarn dev &
sleep 4
node scripts/visual-snap.mjs snapshots/after
kill %1
```
Expected: `snapshots/after/01~06.png` 6개 생성.

- [ ] **Step 5: baseline ↔ after 시각 비교**

`snapshots/baseline/*.png`와 `snapshots/after/*.png`를 쌍으로 Read하여 시각 비교. 의도한 변경(없음) 외 차이가 있으면 회귀로 보고 원인 태스크 수정. 필요 시 정밀 픽셀 diff:
```bash
npx -y pixelmatch-cli snapshots/baseline/05-editor.png snapshots/after/05-editor.png diff-05.png 0.1 || true
```
Expected: 의미 있는 시각 차이 없음(폰트 안티앨리어싱 수준의 미세차는 허용).

- [ ] **Step 6: 커밋**

```bash
git add src/main.tsx src/ui/styles.css
git commit -m "refactor(css): 전역 styles.css 제거 — CSS Modules 전환 완료"
```

---

## Task 18: 코드 리뷰 + 마무리

- [ ] **Step 1: 리뷰** — `superpowers:requesting-code-review` 스킬로 브랜치 전체 diff 리뷰.
- [ ] **Step 2: 지적사항 반영** — `superpowers:receiving-code-review`로 검토 후 수정.
- [ ] **Step 3: 통합** — `superpowers:finishing-a-development-branch`로 병합/PR 옵션 결정.

---

## Self-Review (작성자 점검 결과)

- **Spec 커버리지:** 파일구조(Task1·각 모듈), 전역/모듈 분리(Task2·3·4), 완전 클래스화(Task3 전역 엘리먼트 제거), camelCase(전 태스크 매핑표), 동적 CSS 변수 유지(step-cell/track-color는 인라인 style 그대로, 미변경), 검증 하네스(Task1 baseline·Task17 after+비교), 리뷰/통합(Task18). 비목표(시각 동일·라이브러리 무도입)도 준수. → 누락 없음.
- **플레이스홀더:** "적절히 처리" 류 없음. 규칙 본문은 라인범위 지정+값불변, JSX는 정확한 before→after 명시.
- **타입/이름 일관성:** 공유 모듈 식별자 `controls`/`primitives`/`screen`, 컴포넌트 모듈은 `styles`로 통일. `cx` 시그니처 단일. `.landing__title`↔`.project-card__title` 충돌은 `.title`/`.cardTitle`로 분리 명시.
- **알려진 주의점:** CSS Modules는 자손 엘리먼트 셀렉터(`.x select`)를 다른 모듈로 넘기지 못하므로, 그런 규칙(track-editor·timeline head·seq head·score judge)은 보조 클래스로 치환하도록 각 태스크에 명시함.
