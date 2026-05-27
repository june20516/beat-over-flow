# [Toolbar & Inline Sequencer] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 요구 4를 구현한다 — 전역 `EditorToolbar`(시퀀서 on/off 토글 + 줌 리셋)를 추가하고, 시퀀서 구간/칸수 상태를 `useEditorUi` 휘발성 스토어로 옮긴다. `sequencerOpen && 포커스 트랙` 일 때 `StepSequencerPanel`을 그 포커스 `TrackRow` **바로 아래 자식**으로 렌더하며(우측 marker editor 폭에 정렬), 포커스 트랙이 바뀌면 구간/칸수를 초기화한다.

**Architecture:** 시퀀서의 구간(`region`)/칸수(`stepCount`)와 시퀀서 열림 여부(`sequencerOpen`)는 영속되지 않는 UI 상태이므로 project 스토어(`useStore`)와 분리된 별도 zustand 스토어 `useEditorUi`(계약 §6)가 단일 소스로 보관한다. 액션 동작(`setStepCount`의 `max(1,n)`, `resetForTrack`의 기본값)은 React와 무관한 순수 전이이므로 **TDD**로 검증한다. `StepSequencerPanel`은 props로 받던 region/stepCount/setter를 `useEditorUi`에서 직접 읽고 쓰도록 바꾸되, 시퀀서 계산 로직(`domain/sequencer`)·마커 액션 호출은 그대로 유지한다. 시퀀서는 `Editor` 하단의 고정 패널이 아니라 포커스 `TrackRow`의 자식으로 들어가므로, 배치/정렬의 시각 검증은 헤드리스 Chrome(무인이면 사람 검증 필요로 기록)으로 한다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest

**선행 조건:** v2 계획 1~4 완료. 특히 `src/store/viewport.ts`의 `useViewport`(+ `fitAll()`), `src/ui/TrackRow.tsx`(`TrackRowProps { track; index; focused }`, 좌 `TrackEditor` + 우 `MarkerEditor` 2컬럼), `src/store/useStore.ts`의 `selectedTrackId`, `src/domain/sequencer.ts`가 존재한다. 계약 문서: `2026-05-27-v2-contracts.md`(§6 editorUi, §1 파일구조, §8 props). 스펙: `2026-05-27-editor-architecture-v2-design.md`(요구 4).

---

## 파일 구조 (이 계획에서 생성/수정)

```
src/
  store/
    editorUi.ts         생성: useEditorUi (sequencerOpen/region/stepCount + 액션)
    editorUi.test.ts    생성: 액션 TDD
  ui/
    EditorToolbar.tsx   생성: 전역 툴바(시퀀서 토글 + 줌 리셋)
    StepSequencerPanel.tsx  수정: region/stepCount를 useEditorUi에서 읽기/쓰기 (props 제거)
    TrackRow.tsx        수정: 포커스 && sequencerOpen 이면 행 바로 아래 StepSequencerPanel 자식 렌더
    Editor.tsx          수정: EditorToolbar 배치, 로컬 region/stepCount state 제거, selectedTrackId 변경 시 resetForTrack
```

---

## Task 1: `useEditorUi` 스토어 (TDD)

> 계약 §6 그대로. 시퀀서 토글/구간/칸수를 보관하는 휘발성 zustand 스토어. 순수 전이이므로 실패 테스트 먼저.

**Files:**
- Create: `src/store/editorUi.ts`, `src/store/editorUi.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/store/editorUi.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useEditorUi } from "./editorUi";

describe("useEditorUi", () => {
  beforeEach(() => {
    useEditorUi.setState({
      sequencerOpen: false,
      region: { startMs: 0, endMs: 4000 },
      stepCount: 8,
    });
  });

  it("초기 상태: 닫힘, region {0,4000}, stepCount 8", () => {
    const s = useEditorUi.getState();
    expect(s.sequencerOpen).toBe(false);
    expect(s.region).toEqual({ startMs: 0, endMs: 4000 });
    expect(s.stepCount).toBe(8);
  });

  it("toggleSequencer는 열림 여부를 반전한다", () => {
    useEditorUi.getState().toggleSequencer();
    expect(useEditorUi.getState().sequencerOpen).toBe(true);
    useEditorUi.getState().toggleSequencer();
    expect(useEditorUi.getState().sequencerOpen).toBe(false);
  });

  it("setSequencerOpen은 값을 그대로 설정한다", () => {
    useEditorUi.getState().setSequencerOpen(true);
    expect(useEditorUi.getState().sequencerOpen).toBe(true);
    useEditorUi.getState().setSequencerOpen(false);
    expect(useEditorUi.getState().sequencerOpen).toBe(false);
  });

  it("setRegion은 구간을 교체한다", () => {
    useEditorUi.getState().setRegion({ startMs: 1000, endMs: 1800 });
    expect(useEditorUi.getState().region).toEqual({ startMs: 1000, endMs: 1800 });
  });

  it("setStepCount는 max(1, n)으로 클램프한다", () => {
    useEditorUi.getState().setStepCount(16);
    expect(useEditorUi.getState().stepCount).toBe(16);
    useEditorUi.getState().setStepCount(0);
    expect(useEditorUi.getState().stepCount).toBe(1);
    useEditorUi.getState().setStepCount(-5);
    expect(useEditorUi.getState().stepCount).toBe(1);
  });

  it("resetForTrack은 region={0,4000}, stepCount=8로 되돌린다(열림 여부는 보존)", () => {
    useEditorUi.setState({
      sequencerOpen: true,
      region: { startMs: 1000, endMs: 5000 },
      stepCount: 32,
    });
    useEditorUi.getState().resetForTrack();
    const s = useEditorUi.getState();
    expect(s.region).toEqual({ startMs: 0, endMs: 4000 });
    expect(s.stepCount).toBe(8);
    expect(s.sequencerOpen).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/store/editorUi.test.ts`
Expected: FAIL — `useEditorUi` 미정의.

- [ ] **Step 3: 구현**

`src/store/editorUi.ts`:
```ts
import { create } from "zustand";

export interface EditorUiRegion {
  startMs: number;
  endMs: number;
}

interface EditorUiState {
  sequencerOpen: boolean;
  region: EditorUiRegion;
  stepCount: number;
  toggleSequencer: () => void;
  setSequencerOpen: (b: boolean) => void;
  setRegion: (r: EditorUiRegion) => void;
  setStepCount: (n: number) => void;
  resetForTrack: () => void;
}

const DEFAULT_REGION: EditorUiRegion = { startMs: 0, endMs: 4000 };
const DEFAULT_STEP_COUNT = 8;

export const useEditorUi = create<EditorUiState>((set) => ({
  sequencerOpen: false,
  region: DEFAULT_REGION,
  stepCount: DEFAULT_STEP_COUNT,
  toggleSequencer: () => set((s) => ({ sequencerOpen: !s.sequencerOpen })),
  setSequencerOpen: (b) => set({ sequencerOpen: b }),
  setRegion: (r) => set({ region: r }),
  setStepCount: (n) => set({ stepCount: Math.max(1, n) }),
  resetForTrack: () => set({ region: DEFAULT_REGION, stepCount: DEFAULT_STEP_COUNT }),
}));
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `yarn test:run && yarn tsc -b`
Expected: 모든 테스트 PASS(editorUi 6개 포함), 타입 에러 없음.
```bash
git add src/store/editorUi.ts src/store/editorUi.test.ts
git commit -m "feat: useEditorUi 스토어 (시퀀서 토글/구간/칸수, TDD)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `EditorToolbar` 전역 툴바

> 시퀀서 on/off 토글(`useEditorUi.toggleSequencer`)과 줌 리셋(`useViewport.fitAll`) 두 버튼. 토글 버튼은 `sequencerOpen` 상태를 시각적으로 반영(active).

**Files:**
- Create: `src/ui/EditorToolbar.tsx`

- [ ] **Step 1: 구현**

`src/ui/EditorToolbar.tsx`:
```tsx
import { GridFour, MagnifyingGlassMinus } from "@phosphor-icons/react";
import { useEditorUi } from "../store/editorUi";
import { useViewport } from "../store/viewport";

export function EditorToolbar() {
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const toggleSequencer = useEditorUi((s) => s.toggleSequencer);
  const fitAll = useViewport((s) => s.fitAll);

  return (
    <div className="editor-toolbar">
      <button
        type="button"
        className={"btn--ghost" + (sequencerOpen ? " is-active" : "")}
        aria-pressed={sequencerOpen}
        onClick={toggleSequencer}
        title="스텝 시퀀서 열기/닫기"
      >
        <GridFour size={15} weight="bold" />
        시퀀서
      </button>
      <button type="button" className="btn--ghost" onClick={fitAll} title="줌 리셋(전체 보기)">
        <MagnifyingGlassMinus size={15} weight="bold" />
        줌 리셋
      </button>
    </div>
  );
}
```

> `GridFour`/`MagnifyingGlassMinus`는 `@phosphor-icons/react`(기존 의존성)에 존재하는 아이콘이다. `is-active` 클래스는 styles.css에 이미 없다면 다음 스텝에서 추가한다.

- [ ] **Step 2: 스타일 추가**

`src/ui/styles.css` 끝에 추가(기존 토큰/색과 조화되게):
```css
.editor-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #222833;
}
.editor-toolbar .btn--ghost.is-active {
  background: #2a3550;
  color: #fff;
}
```

- [ ] **Step 3: 타입체크 & Commit**

Run: `yarn tsc -b`
Expected: 에러 없음(아직 Editor에서 미사용이어도 단독 컴파일됨).
```bash
git add src/ui/EditorToolbar.tsx src/ui/styles.css
git commit -m "feat: EditorToolbar (시퀀서 토글 + 줌 리셋)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `StepSequencerPanel` — props 제거, `useEditorUi` 사용

> region/stepCount/setRegion/setStepCount를 props 대신 `useEditorUi`에서 읽고 쓴다. 나머지 시퀀서 로직(`domain/sequencer` 계산, 마커 토글/벌크/범위삭제 호출)은 그대로 유지한다. 컴포넌트는 더 이상 props를 받지 않는다(`Props` 제거).

**Files:**
- Modify: `src/ui/StepSequencerPanel.tsx`

- [ ] **Step 1: import 및 시그니처 변경**

상단 import에 추가:
```ts
import { useEditorUi } from "../store/editorUi";
```

`Region` 인터페이스와 `Props` 인터페이스, 그리고 컴포넌트 시그니처를 다음으로 교체한다.

기존:
```tsx
interface Region {
  startMs: number;
  endMs: number;
}

interface Props {
  region: Region;
  setRegion: (r: Region) => void;
  stepCount: number;
  setStepCount: (n: number) => void;
}

export function StepSequencerPanel({ region, setRegion, stepCount, setStepCount }: Props) {
  const selectedTrackId = useStore((s) => s.selectedTrackId);
```

변경 후:
```tsx
export function StepSequencerPanel() {
  const region = useEditorUi((s) => s.region);
  const setRegion = useEditorUi((s) => s.setRegion);
  const stepCount = useEditorUi((s) => s.stepCount);
  const setStepCount = useEditorUi((s) => s.setStepCount);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
```

> `Region` 타입은 `useEditorUi`가 보유하므로 패널의 로컬 정의를 제거한다. 본문에서 `region`/`setRegion`/`stepCount`/`setStepCount`를 쓰는 부분(구간 시작/끝/칸수 입력, `stepTimes`, `fill`, `clearAndRefill`)은 그대로 둔다 — 동일한 변수명이므로 수정 불필요.

- [ ] **Step 2: setStepCount 호출 정리(중복 클램프 제거)**

칸수 입력의 onChange는 스토어가 `max(1,n)`을 보장하므로 `Math.max(1, ...)`를 제거해 단일 소스로 만든다.

기존:
```tsx
            onChange={(e) => setStepCount(Math.max(1, Number(e.target.value)))}
```
변경 후:
```tsx
            onChange={(e) => setStepCount(Number(e.target.value))}
```

- [ ] **Step 3: 타입체크 & Commit**

Run: `yarn tsc -b`
Expected: `StepSequencerPanel`에 props를 넘기던 `Editor.tsx`가 아직 수정 전이면 타입 에러 발생 — Task 5에서 호출부를 함께 고친다. 본 태스크에서는 패널 단독 변경을 우선 커밋한다(전체 그린은 Task 5 종료 시 확인).
```bash
git add src/ui/StepSequencerPanel.tsx
git commit -m "refactor: StepSequencerPanel이 useEditorUi에서 region/stepCount 사용

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `TrackRow` — 포커스 && sequencerOpen 이면 행 아래 시퀀서 자식 렌더

> 포커스 트랙(`focused`)이고 `useEditorUi.sequencerOpen` 이면, 행의 2컬럼(`TrackEditor` | `MarkerEditor`) **바로 아래**에 `StepSequencerPanel`을 자식으로 렌더한다. 좌측 TrackEditor 폭만큼 들여쓰고 우측 marker editor 폭에 정렬되도록 좌측 컬럼 폭과 동일한 빈 영역 + 시퀀서 영역으로 배치한다. 언포커스이거나 토글 오프이면 렌더하지 않는다.

**Files:**
- Modify: `src/ui/TrackRow.tsx`

- [ ] **Step 1: import 및 조건부 렌더 추가**

`src/ui/TrackRow.tsx` 상단 import에 추가:
```ts
import { useEditorUi } from "../store/editorUi";
import { StepSequencerPanel } from "./StepSequencerPanel";
```

컴포넌트 본문에서 시퀀서 열림 상태를 구독:
```ts
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const showSequencer = focused && sequencerOpen;
```

기존 행 렌더(좌 `TrackEditor` + 우 `MarkerEditor`를 감싸는 행 컨테이너)는 유지하되, 그 행과 시퀀서를 함께 묶는 래퍼로 감싼다. 행 컨테이너를 다음 구조로 만든다(클래스명은 계획 2 산출물 기준에 맞춰 조정; 핵심은 "행 컨테이너 다음 형제로 시퀀서가 오고, 좌측 폭만큼 비운 뒤 우측에 정렬"):

```tsx
  return (
    <div className="track-row-wrap">
      <div className="track-row">
        {/* 기존: 좌측 TrackEditor 컬럼 + 우측 MarkerEditor 컬럼 (계획 2 구조 유지) */}
        {/* ...기존 내용... */}
      </div>
      {showSequencer && (
        <div className="track-row__sequencer">
          <div className="track-row__sequencer-gutter" aria-hidden="true" />
          <div className="track-row__sequencer-body">
            <StepSequencerPanel />
          </div>
        </div>
      )}
    </div>
  );
```

> 계획 2의 `TrackRow`가 행을 어떤 래퍼/그리드로 감싸는지에 맞춰 위 구조를 통합한다. 불변 요건: (a) 시퀀서는 행 **바로 아래**의 형제로 온다, (b) `track-row__sequencer-gutter` 폭 = 좌측 TrackEditor 컬럼 폭이라 시퀀서 본문이 우측 MarkerEditor와 좌우 정렬된다, (c) `showSequencer`가 false면 시퀀서 노드 자체가 없다.

- [ ] **Step 2: 정렬 스타일 추가**

`src/ui/styles.css`에 추가. 좌측 컬럼 폭은 계획 2/3에서 쓰는 TrackEditor 폭 토큰과 동일해야 한다. 계획 2가 `--track-editor-width`(또는 동등 상수)를 쓰면 그 값을 그대로 참조하고, 없으면 아래처럼 변수를 정의해 TrackEditor 컬럼과 공유한다:
```css
:root {
  --track-editor-width: 320px; /* 계획 2의 TrackEditor 컬럼 폭과 반드시 동일하게 */
}
.track-row__sequencer {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #222833;
}
.track-row__sequencer-gutter {
  flex: 0 0 var(--track-editor-width);
}
.track-row__sequencer-body {
  flex: 1 1 auto;
  min-width: 0;
}
```

> 계획 2가 이미 좌측 컬럼 폭 변수를 정의했다면 `:root` 블록은 중복 정의하지 말고 기존 변수를 재사용한다.

- [ ] **Step 3: 타입체크 & Commit**

Run: `yarn tsc -b`
Expected: 에러 없음(`StepSequencerPanel`은 Task 3에서 props 없는 시그니처가 됨).
```bash
git add src/ui/TrackRow.tsx src/ui/styles.css
git commit -m "feat: 포커스 트랙 아래 StepSequencerPanel 인라인 렌더

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `Editor` — 툴바 배치, 로컬 state 제거, 포커스 변경 시 resetForTrack

> `EditorToolbar`를 TransportBar 아래에 배치한다. `Editor`의 로컬 `region`/`stepCount` state와 하단 고정 `StepSequencerPanel`을 제거한다(시퀀서는 이제 TrackRow 자식). `selectedTrackId`(포커스 트랙) 변경 시 `useEditorUi.resetForTrack()`을 호출하는 useEffect를 추가한다.

**Files:**
- Modify: `src/ui/Editor.tsx`

> 아래는 계획 1~4 적용 후의 `Editor.tsx`를 전제로 한 변경점이다. 계획 1~2가 `TimelineCanvas`를 `Timeline`/`BaseFlowLane`/`MarkerEditor`로, `TrackList`를 `TrackRow[]`로 이미 교체했을 것이므로, 그 구조 위에서 다음 4가지만 적용한다. (계획 1~4 미적용 상태라면 그 계획들을 먼저 완료할 것.)

- [ ] **Step 1: import 정리**

`Editor.tsx` import에 추가:
```ts
import { EditorToolbar } from "./EditorToolbar";
import { useEditorUi } from "../store/editorUi";
```
하단 고정 패널용 `StepSequencerPanel` import가 `Editor`에 남아 있으면 제거한다(시퀀서는 TrackRow가 렌더).

- [ ] **Step 2: 로컬 region/stepCount state 제거**

다음 두 줄을 삭제한다(있다면):
```ts
  const [region, setRegion] = useState({ startMs: 0, endMs: 4000 });
  const [stepCount, setStepCount] = useState(8);
```
이로 인해 `useState` import가 더 이상 필요 없으면 import 목록에서 정리한다(다른 곳에서 쓰면 유지).

- [ ] **Step 3: 포커스 변경 시 resetForTrack**

`selectedTrackId`를 구독하고, 변경 시 `resetForTrack`을 호출하는 effect를 추가한다.
```ts
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const resetForTrack = useEditorUi((s) => s.resetForTrack);

  useEffect(() => {
    resetForTrack();
  }, [selectedTrackId, resetForTrack]);
```

> `resetForTrack`은 region/stepCount만 기본값으로 되돌리고 `sequencerOpen`은 보존한다(Task 1 테스트로 보장). 따라서 트랙을 바꿔도 시퀀서 열림 상태는 유지되고 구간/칸수만 초기화된다 — 요구 4의 "포커스 트랙 변경 시 초기화"와 일치.

- [ ] **Step 4: 툴바 배치 + 하단 시퀀서 패널 제거**

`TransportBar` 바로 아래에 `<EditorToolbar />`를 둔다:
```tsx
      <TransportBar />
      <EditorToolbar />
      {/* Timeline / TrackRow[] ... (계획 1~2 구조) */}
```
그리고 `Editor` 하단에 있던 고정 `<StepSequencerPanel region=... />` 블록을 **통째로 삭제**한다. `handleLaneClick` 등 시퀀서와 무관한 기존 로직은 유지한다.

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `yarn test:run && yarn tsc -b`
Expected: 모든 테스트 PASS, 타입 에러 없음. (`StepSequencerPanel`에 props를 넘기는 곳이 더는 없어야 한다.)

- [ ] **Step 6: 브라우저 검증 (시각/정렬)**

단위테스트로 못 잡는 항목 — 헤드리스 Chrome 드라이버(`/tmp/bof-driver`)로 확인하거나, 무인 실행이면 `IMPLEMENTATION_NOTES.md`에 "사람 검증 필요"로 기록하고 **성공을 꾸미지 않는다.**

확인 항목:
1. 툴바의 "시퀀서" 토글 → 포커스 트랙이 있으면 그 트랙 행 **바로 아래**에 스텝 시퀀서가 나타난다(다시 누르면 사라짐). 토글 버튼이 active로 강조된다.
2. 시퀀서 본문 좌측 끝이 우측 MarkerEditor 좌측 끝과 **세로로 정렬**된다(좌측 gutter 폭 = TrackEditor 컬럼 폭).
3. 포커스가 없으면(선택 트랙 없음) 토글을 켜도 시퀀서가 보이지 않는다. 다른 트랙을 선택하면 시퀀서가 그 새 포커스 행 아래로 이동한다.
4. 포커스 트랙을 바꾸면 구간(시작/끝)·칸수가 기본값(0/4000/8)으로 초기화되고, 시퀀서 열림 상태는 유지된다.
5. "줌 리셋" 버튼 → 타임라인이 전체 보기(`fitAll`)로 되돌아간다(최소 줌, 스크롤 0).
6. 시퀀서 칸 토글/반복 채우기 등 기존 동작이 그대로 작동한다.

무인 실행 시 기록 예시(`IMPLEMENTATION_NOTES.md`):
```
## 계획 5 (toolbar + inline sequencer) — 사람 검증 필요
단위테스트(editorUi 6개) + tsc 그린 확인 완료.
다음 항목은 브라우저 시각/정렬 확인이 필요하며 무인 환경에서 미검증:
- 시퀀서가 포커스 TrackRow 바로 아래에 붙고 MarkerEditor와 좌우 정렬되는지
- 줌 리셋(fitAll) 동작
- 포커스 변경 시 region/stepCount 초기화의 화면 반영
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/Editor.tsx
git commit -m "feat: Editor에 EditorToolbar 배치, 시퀀서 인라인화, 포커스 변경 시 초기화

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review 결과 (계약 §6/§1/§8 · 스펙 요구 4 대조)

- **계약 §6 일치:** `useEditorUi` 상태/시그니처가 계약과 정확히 일치 — `sequencerOpen: boolean`, `region: {startMs;endMs}`, `stepCount: number`, `toggleSequencer/setSequencerOpen/setRegion(r)/setStepCount(n: max(1,n))/resetForTrack(region={0,4000}, stepCount=8)`. (Task 1, TDD 6테스트로 검증)
- **계약 §1 일치:** 신규 `src/store/editorUi.ts`(+test), `src/ui/EditorToolbar.tsx`. 수정 `src/ui/StepSequencerPanel.tsx`(region/stepCount를 useEditorUi에서 읽음, props 정리), `src/ui/Editor.tsx`. `src/ui/TrackRow.tsx`는 계획 2 산출물에 "포커스 && sequencerOpen이면 하단 StepSequencerPanel 자식"이라 명시됨 — 본 계획이 그 자식 렌더를 구현(Task 4).
- **계약 §8 일치:** TrackRow는 계약상 props 외 추가 props 없이 `sequencerOpen`을 스토어에서 구독한다(본 계획 준수). EditorToolbar는 props 없음(스토어 구독).
- **스펙 요구 4 커버리지:** (a) 전역 EditorToolbar 토글이 sequencerOpen 제어 — Task 2. (b) sequencerOpen && 포커스 트랙이면 포커스 TrackRow 바로 아래 자식 렌더 — Task 4. (c) 시퀀서 내부 로직(domain/sequencer) 유지 — Task 3에서 계산/마커 호출 보존. (d) region/stepCount를 UI 상태로 보관 + 포커스 트랙 변경 시 초기화 — Task 1(스토어) + Task 5(useEffect resetForTrack). 추가로 줌 리셋(fitAll)도 툴바에 포함(스펙 §4 EditorToolbar "줌 리셋").
- **TDD:** editorUi 스토어는 진짜 TDD(실패→구현→통과). 시퀀서 인라인 배치/정렬은 단위테스트 불가 → 브라우저 검증, 무인이면 IMPLEMENTATION_NOTES.md 기록(꾸미지 않음).
- **타입/any:** any 미사용. `EditorUiRegion` 타입을 export해 StepSequencerPanel/TrackRow가 공유. setStepCount 클램프는 스토어 단일 소스(패널의 중복 `Math.max` 제거).
- **각 Task 종료:** Task 1·5는 `yarn test:run && yarn tsc -b` 그린 확인 스텝 포함. Task 2~4는 중간 상태(호출부 미수정)라 단독 `tsc -b`로 진행 후 Task 5에서 전체 그린 확정(의존 순서상 불가피하며 명시함).
- **개선 메모:** Task 4의 좌측 gutter 폭은 계획 2의 TrackEditor 컬럼 폭과 **동일 변수**를 공유해야 정렬이 보장된다. 계획 2가 폭 변수를 도입했는지 구현 시점에 확인하고, 없으면 공유 CSS 변수로 도입한다(중복 정의 금지).
