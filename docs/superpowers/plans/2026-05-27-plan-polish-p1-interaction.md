# [Polish P1 — Interaction: Zoom/Wheel + Lane Gesture + Region Drag] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폴리싱 #3(줌 동작/휠 버그/더블클릭 선점)·#6(마커는 클릭에서만)·#7(레인 드래그로 시퀀서 구간 지정)을 구현한다.

**Architecture:** 휠 의도 판정·포인터 제스처 분류·드래그→구간 변환을 React에서 분리한 순수함수로 TDD하고, `useViewport`에 중앙 앵커 줌 액션을 추가한다. `useLaneGesture` 훅이 pointerdown→move→up을 클릭/드래그로 분류해 BaseFlowLane(클릭=seek/드래그=구간)·MarkerEditor(클릭=마커/우클릭=삭제/드래그=구간)가 공유한다. macOS Shift+휠이 deltaX를 싣는 버그를 dominant-delta로 수정하고, 휠 처리를 타임라인 우측 전체로 확장한다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest

**기준 문서:** `docs/superpowers/specs/2026-05-27-editor-v2-polish-design.md` (§3 A·B·C). 헤드리스 검증은 `public/samples/moodmode-demo.mp3` 업로드로 한다. any 금지.

---

## 파일 구조

```
src/
  timeline/
    wheelIntent.ts (+test)        생성: resolveWheelIntent 순수
    laneGesture.ts (+test)        생성: classifyPointerSequence / dragToRegion 순수
  input/
    useLaneGesture.ts             생성: 포인터 제스처 훅
  store/
    viewport.ts (+test)           수정: zoomByAtCenter 액션
  ui/
    Timeline.tsx                  수정: 휠 처리(전체영역+dominant delta), 줌 버튼 연동
    EditorToolbar.tsx             수정: +/-/맞춤 버튼
    BaseFlowLane.tsx              수정: 더블클릭 제거, 제스처(클릭=seek/드래그=구간)
    MarkerEditor.tsx              수정: 제스처(클릭=마커/우클릭=삭제/드래그=구간) + 구간 오버레이
    styles.css                   수정: region-drag-overlay, 줌 버튼
```

---

## Task 1: `zoomByAtCenter` 액션 (TDD)

**Files:** Modify `src/store/viewport.ts`, `src/store/viewport.test.ts`

- [ ] **RED** — `src/store/viewport.test.ts`의 `describe("useViewport")` 안에 추가:
```ts
  it("zoomByAtCenter는 가시영역 중앙을 앵커로 확대한다", () => {
    const s = useViewport.getState();
    s.setDuration(100000);
    s.setContainerWidth(1000);
    s.fitAll(); // pxPerMs = 0.01
    useViewport.setState({ pxPerMs: 0.02, scrollLeftPx: 0 });
    const centerTimeBefore = (500 + useViewport.getState().scrollLeftPx) / 0.02;
    useViewport.getState().zoomByAtCenter(2);
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.04);
    // 중앙(x=500)의 시간이 줌 후에도 x=500 부근에 유지
    expect((500 + v.scrollLeftPx) / v.pxPerMs).toBeCloseTo(centerTimeBefore, 0);
  });

  it("zoomByAtCenter는 MAX/min을 넘지 않는다", () => {
    const s = useViewport.getState();
    s.setDuration(100000);
    s.setContainerWidth(1000);
    useViewport.setState({ pxPerMs: 0.4 });
    s.zoomByAtCenter(100);
    expect(useViewport.getState().pxPerMs).toBe(0.5); // MAX_PX_PER_MS
  });
```

- [ ] **확인(RED)** — Run: `yarn vitest run src/store/viewport.test.ts` → `zoomByAtCenter is not a function`로 실패.

- [ ] **GREEN** — `src/store/viewport.ts`: `ViewportState` 인터페이스에 `zoomByAtCenter: (factor: number) => void;` 추가. import에 `zoomedViewport`가 이미 있음. 액션 추가(`zoomAt` 근처):
```ts
  zoomByAtCenter: (factor) =>
    set((s) => {
      const z = zoomedViewport(toVp(s), s.durationMs, factor, s.containerWidthPx / 2);
      return { pxPerMs: z.pxPerMs, scrollLeftPx: z.scrollLeftPx };
    }),
```

- [ ] **확인(GREEN)** — `yarn vitest run src/store/viewport.test.ts` → PASS. 그다음 `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/store/viewport.ts src/store/viewport.test.ts && git commit -m "$(cat <<'EOF'
feat(viewport): zoomByAtCenter 중앙 앵커 줌 액션 (폴리싱 #3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `resolveWheelIntent` 순수함수 (TDD)

휠 이벤트(평범한 값)를 줌/팬 의도로 변환. macOS Shift+휠=deltaX 버그 대응(0이 아닌 dominant delta 사용).

**Files:** Create `src/timeline/wheelIntent.ts`, `src/timeline/wheelIntent.test.ts`

- [ ] **RED** — `src/timeline/wheelIntent.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveWheelIntent, type WheelLike } from "./wheelIntent";

function w(over: Partial<WheelLike> = {}): WheelLike {
  return { deltaX: 0, deltaY: 0, shiftKey: false, ctrlKey: false, metaKey: false, ...over };
}

describe("resolveWheelIntent", () => {
  it("modifier 없으면 가로 팬: deltaX 우선", () => {
    expect(resolveWheelIntent(w({ deltaX: 30, deltaY: 5 }))).toEqual({ kind: "pan", amount: 30 });
  });
  it("modifier 없고 deltaX=0이면 deltaY로 팬", () => {
    expect(resolveWheelIntent(w({ deltaX: 0, deltaY: 12 }))).toEqual({ kind: "pan", amount: 12 });
  });
  it("Shift+휠은 줌: deltaY 우선", () => {
    expect(resolveWheelIntent(w({ shiftKey: true, deltaY: -40, deltaX: 0 }))).toEqual({ kind: "zoom", amount: -40 });
  });
  it("Shift+휠인데 macOS처럼 deltaX에 값이 실리면 그 값을 줌에 쓴다", () => {
    expect(resolveWheelIntent(w({ shiftKey: true, deltaY: 0, deltaX: -40 }))).toEqual({ kind: "zoom", amount: -40 });
  });
  it("Ctrl/Meta+휠도 줌(트랙패드 핀치)", () => {
    expect(resolveWheelIntent(w({ ctrlKey: true, deltaY: 8 }))).toEqual({ kind: "zoom", amount: 8 });
    expect(resolveWheelIntent(w({ metaKey: true, deltaY: 8 }))).toEqual({ kind: "zoom", amount: 8 });
  });
  it("delta가 전부 0이면 none", () => {
    expect(resolveWheelIntent(w())).toEqual({ kind: "none", amount: 0 });
  });
});
```

- [ ] **확인(RED)** — `yarn vitest run src/timeline/wheelIntent.test.ts` → 모듈 없음 실패.

- [ ] **GREEN** — `src/timeline/wheelIntent.ts`:
```ts
export interface WheelLike {
  deltaX: number;
  deltaY: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export type WheelIntent =
  | { kind: "zoom"; amount: number }
  | { kind: "pan"; amount: number }
  | { kind: "none"; amount: 0 };

/** 0이 아닌 dominant delta. 둘 다 0이면 0. */
function dominant(a: number, b: number): number {
  return a !== 0 ? a : b;
}

/**
 * 휠 의도 판정. modifier(Shift/Ctrl/Meta)면 줌, 아니면 가로 팬.
 * macOS는 Shift+휠을 deltaX에 싣으므로 줌도 dominant(deltaY, deltaX)를 쓴다.
 */
export function resolveWheelIntent(e: WheelLike): WheelIntent {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    const amount = dominant(e.deltaY, e.deltaX);
    return amount === 0 ? { kind: "none", amount: 0 } : { kind: "zoom", amount };
  }
  const amount = dominant(e.deltaX, e.deltaY);
  return amount === 0 ? { kind: "none", amount: 0 } : { kind: "pan", amount };
}
```

- [ ] **확인(GREEN)** — `yarn vitest run src/timeline/wheelIntent.test.ts` → PASS. `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/timeline/wheelIntent.ts src/timeline/wheelIntent.test.ts && git commit -m "$(cat <<'EOF'
feat(timeline): resolveWheelIntent 순수함수 (macOS Shift+휠 deltaX 버그 대응, 폴리싱 #3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 레인 제스처 순수함수 `classifyPointerSequence` / `dragToRegion` (TDD)

**Files:** Create `src/timeline/laneGesture.ts`, `src/timeline/laneGesture.test.ts`

- [ ] **RED** — `src/timeline/laneGesture.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyPointerSequence, dragToRegion } from "./laneGesture";
import type { Viewport } from "./viewportMath";

describe("classifyPointerSequence", () => {
  it("이동량이 임계 미만이면 click", () => {
    expect(classifyPointerSequence(100, 103, 5)).toBe("click");
    expect(classifyPointerSequence(100, 100, 5)).toBe("click");
  });
  it("이동량이 임계 이상이면 drag", () => {
    expect(classifyPointerSequence(100, 106, 5)).toBe("drag");
    expect(classifyPointerSequence(100, 90, 5)).toBe("drag");
  });
  it("경계(정확히 임계)는 drag로 본다", () => {
    expect(classifyPointerSequence(100, 105, 5)).toBe("drag");
  });
});

describe("dragToRegion", () => {
  const vp: Viewport = { pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 };
  it("start<end로 정렬해 ms 구간을 만든다", () => {
    expect(dragToRegion(100, 300, vp, 100000)).toEqual({ startMs: 1000, endMs: 3000 });
  });
  it("역방향 드래그도 정렬한다", () => {
    expect(dragToRegion(300, 100, vp, 100000)).toEqual({ startMs: 1000, endMs: 3000 });
  });
  it("0..durationMs로 클램프한다", () => {
    const scrolled: Viewport = { ...vp, scrollLeftPx: 0 };
    expect(dragToRegion(-50, 2000000, scrolled, 100000)).toEqual({ startMs: 0, endMs: 100000 });
  });
});
```

- [ ] **확인(RED)** — `yarn vitest run src/timeline/laneGesture.test.ts` → 실패.

- [ ] **GREEN** — `src/timeline/laneGesture.ts`:
```ts
import { xToTime, type Viewport } from "./viewportMath";

export type PointerKind = "click" | "drag";

/** 시작/종료 x의 이동량이 임계 이상이면 drag, 아니면 click. */
export function classifyPointerSequence(downX: number, upX: number, thresholdPx: number): PointerKind {
  return Math.abs(upX - downX) >= thresholdPx ? "drag" : "click";
}

export interface Region {
  startMs: number;
  endMs: number;
}

/** 드래그 두 x를 정렬된 ms 구간으로(0..durationMs 클램프). */
export function dragToRegion(x1: number, x2: number, vp: Viewport, durationMs: number): Region {
  const a = xToTime(Math.min(x1, x2), vp);
  const b = xToTime(Math.max(x1, x2), vp);
  const clamp = (t: number) => Math.max(0, Math.min(durationMs, t));
  return { startMs: clamp(a), endMs: clamp(b) };
}
```

- [ ] **확인(GREEN)** — `yarn vitest run src/timeline/laneGesture.test.ts` → PASS. `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/timeline/laneGesture.ts src/timeline/laneGesture.test.ts && git commit -m "$(cat <<'EOF'
feat(timeline): laneGesture 순수함수(classifyPointerSequence/dragToRegion) (폴리싱 #6·#7)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `useLaneGesture` 훅

pointerdown→move→up을 클릭/드래그로 분류해 핸들러 호출. 좌표는 요소 rect 기준 local x.

**Files:** Create `src/input/useLaneGesture.ts`

- [ ] **구현** — `src/input/useLaneGesture.ts`:
```tsx
import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { classifyPointerSequence } from "../timeline/laneGesture";

const DRAG_THRESHOLD_PX = 5;

export interface LaneGestureHandlers {
  onClick?: (localX: number) => void;
  onContextClick?: (localX: number) => void;
  onDragMove?: (startX: number, endX: number) => void;
  onDragEnd?: (startX: number, endX: number) => void;
}

/** 레인 요소에 스프레드할 포인터 핸들러를 반환. */
export function useLaneGesture(handlers: LaneGestureHandlers) {
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  function localX(e: { clientX: number; currentTarget: Element }): number {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left;
  }

  function onPointerDown(e: ReactPointerEvent<Element>) {
    if (e.button !== 0) return; // 좌클릭만 드래그/클릭
    startXRef.current = localX(e);
    draggingRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<Element>) {
    if (startXRef.current === null) return;
    const x = localX(e);
    if (!draggingRef.current && classifyPointerSequence(startXRef.current, x, DRAG_THRESHOLD_PX) === "drag") {
      draggingRef.current = true;
    }
    if (draggingRef.current) handlers.onDragMove?.(startXRef.current, x);
  }

  function onPointerUp(e: ReactPointerEvent<Element>) {
    if (startXRef.current === null) return;
    const x = localX(e);
    if (draggingRef.current) handlers.onDragEnd?.(startXRef.current, x);
    else handlers.onClick?.(x);
    startXRef.current = null;
    draggingRef.current = false;
  }

  function onContextMenu(e: ReactMouseEvent<Element>) {
    e.preventDefault();
    handlers.onContextClick?.(localX(e));
  }

  return { onPointerDown, onPointerMove, onPointerUp, onContextMenu };
}
```

- [ ] **검증** — `yarn tsc -b` 통과(아직 미사용이어도 단독 컴파일). `yarn test:run` 회귀 없음.

- [ ] **커밋**
```bash
git add src/input/useLaneGesture.ts && git commit -m "$(cat <<'EOF'
feat(input): useLaneGesture 포인터 제스처 훅(클릭/드래그 분류) (폴리싱 #6·#7)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Timeline 휠 처리 전체영역 확장 + dominant delta + 줌 버튼 연동

**Files:** Modify `src/ui/Timeline.tsx`

- [ ] **현 상태 파악** — `src/ui/Timeline.tsx`를 읽는다(현재 wheel 리스너가 `arrangeRef`에만 붙어 헤더 띠에서만 동작, `Math.pow(ZOOM_IN_FACTOR, -e.deltaY)`로 deltaY만 읽음).

- [ ] **수정** — 휠 effect를 다음 규칙으로 교체한다:
  - import 추가: `import { resolveWheelIntent } from "../timeline/wheelIntent";`
  - 리스너를 `.timeline` 루트 요소(`timelineRef`)에 붙이고, `passive:false`. 단 이벤트 target이 좌측 컬럼(`(e.target as HTMLElement).closest(".timeline__fixed-col, .track-row__editor")`)이면 무시(좌측에서 시작한 휠은 패스).
  - 앵커 x는 우측 arrange(`arrangeRef`) rect 기준: `anchorX = e.clientX - arrangeRect.left`(arrange 밖이면 클램프 0..width).
  - `const intent = resolveWheelIntent(e);` → `zoom`이면 `e.preventDefault(); zoomAt(Math.pow(ZOOM_IN_FACTOR, -intent.amount), anchorX);` / `pan`이면 `e.preventDefault(); panByPx(intent.amount);` / `none`이면 무시.
  - `timelineRef`를 `.timeline` div에 부착. `arrangeRef`는 폭 측정/앵커용으로 유지.
  - 구현 메모: 두 ref가 필요하므로 effect는 `[panByPx, zoomAt]` 의존. arrange rect는 effect 내부에서 매 이벤트 `arrangeRef.current.getBoundingClientRect()`로 얻는다.

  교체 예시(핸들러 본문):
  ```tsx
  const onWheel = (e: WheelEvent) => {
    const targetEl = e.target as HTMLElement | null;
    if (targetEl && targetEl.closest(".timeline__fixed-col, .track-row__editor")) return;
    const arrange = arrangeRef.current;
    if (!arrange) return;
    const intent = resolveWheelIntent(e);
    if (intent.kind === "none") return;
    e.preventDefault();
    const rect = arrange.getBoundingClientRect();
    const anchorX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    if (intent.kind === "zoom") {
      zoomAt(Math.pow(ZOOM_IN_FACTOR, -intent.amount), anchorX);
    } else {
      panByPx(intent.amount);
    }
  };
  const el = timelineRef.current;
  if (!el) return;
  el.addEventListener("wheel", onWheel, { passive: false });
  return () => el.removeEventListener("wheel", onWheel);
  ```
  `const timelineRef = useRef<HTMLDivElement>(null);` 추가하고 루트 `<div className="timeline" ref={timelineRef}>`.

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/Timeline.tsx && git commit -m "$(cat <<'EOF'
fix(ui): 휠 줌/팬을 타임라인 전체영역으로 + dominant delta로 수정 (폴리싱 #3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: EditorToolbar 줌 버튼 + BaseFlowLane 더블클릭 제거

**Files:** Modify `src/ui/EditorToolbar.tsx`, `src/ui/BaseFlowLane.tsx`, `src/ui/styles.css`

- [ ] **EditorToolbar 수정** — `useViewport`의 `zoomByAtCenter`/`fitAll` 구독, `+`/`−`/`맞춤` 버튼 추가(아이콘 `MagnifyingGlassPlus`/`MagnifyingGlassMinus`/`ArrowsOutLineHorizontal` 등 `@phosphor-icons/react` 존재 아이콘). 기존 시퀀서 토글/줌리셋 버튼과 함께. 예:
```tsx
import { GridFour, MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut } from "@phosphor-icons/react";
import { useEditorUi } from "../store/editorUi";
import { useViewport } from "../store/viewport";

export function EditorToolbar() {
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const toggleSequencer = useEditorUi((s) => s.toggleSequencer);
  const zoomByAtCenter = useViewport((s) => s.zoomByAtCenter);
  const fitAll = useViewport((s) => s.fitAll);
  return (
    <div className="editor-toolbar">
      <button type="button" className={"btn--ghost" + (sequencerOpen ? " is-active" : "")} aria-pressed={sequencerOpen} onClick={toggleSequencer} title="스텝 시퀀서 열기/닫기">
        <GridFour size={15} weight="bold" />시퀀서
      </button>
      <span className="editor-toolbar__sep" />
      <button type="button" className="btn--ghost btn--icon" onClick={() => zoomByAtCenter(1.4)} title="확대">
        <MagnifyingGlassPlus size={15} weight="bold" />
      </button>
      <button type="button" className="btn--ghost btn--icon" onClick={() => zoomByAtCenter(1 / 1.4)} title="축소">
        <MagnifyingGlassMinus size={15} weight="bold" />
      </button>
      <button type="button" className="btn--ghost" onClick={fitAll} title="전체 보기(맞춤)">
        <CornersOut size={15} weight="bold" />맞춤
      </button>
    </div>
  );
}
```
> 아이콘명이 export되지 않으면 STOP하고 BLOCKED로 보고(임의 대체 금지).

- [ ] **BaseFlowLane 수정** — `onDoubleClick={fitAll}` 제거(단일클릭 seek 선점 해소). `fitAll` 구독도 더 이상 필요 없으면 제거. (클릭=seek는 Task 7에서 제스처로 교체하므로 여기선 onDoubleClick만 제거하고 onClick은 유지해도 됨 — Task 7에서 정리.)

- [ ] **styles.css** — `.editor-toolbar__sep { width:1px; height:18px; background: var(--line); margin:0 4px; }` 추가(파일 끝).

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/EditorToolbar.tsx src/ui/BaseFlowLane.tsx src/ui/styles.css && git commit -m "$(cat <<'EOF'
feat(ui): 툴바 +/-/맞춤 줌 버튼 + BaseFlowLane 더블클릭 제거 (폴리싱 #3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: BaseFlowLane 제스처(클릭=seek / 드래그=구간)

**Files:** Modify `src/ui/BaseFlowLane.tsx`, `src/ui/styles.css`

- [ ] **수정** — `useLaneGesture`로 클릭=seek, 드래그=구간(`useEditorUi.setRegion` + 시퀀서 자동 열기). 드래그 중 반투명 오버레이 표시.
  - import: `useState`, `useLaneGesture`, `useEditorUi`, `dragToRegion`, `xToTime`.
  - 핸들러:
    ```tsx
    const setRegion = useEditorUi((s) => s.setRegion);
    const setSequencerOpen = useEditorUi((s) => s.setSequencerOpen);
    const [dragPx, setDragPx] = useState<{ a: number; b: number } | null>(null);
    const vp = { pxPerMs, scrollLeftPx, containerWidthPx };
    const gesture = useLaneGesture({
      onClick: (x) => { if (durationMs > 0 && pxPerMs > 0) seek(xToTime(x, vp)); },
      onDragMove: (a, b) => setDragPx({ a, b }),
      onDragEnd: (a, b) => {
        setDragPx(null);
        if (pxPerMs <= 0) return;
        setRegion(dragToRegion(a, b, vp, durationMs));
        setSequencerOpen(true);
      },
    });
    ```
  - 컨테이너 div에 `{...gesture}` 스프레드. 더블클릭/기존 onClick 제거.
  - 드래그 오버레이: `dragPx`면 `<div className="region-drag-overlay" style={{ left: Math.min(a,b), width: Math.abs(b-a) }} />`(컨테이너 기준 absolute).
  - `position:relative`는 이미 컨테이너에 있음(없으면 추가).

- [ ] **styles.css** — 파일 끝에:
```css
/* 구간 드래그 오버레이 (폴리싱 #7) */
.region-drag-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(168, 85, 247, 0.22);
  border-left: 1px solid var(--purple);
  border-right: 1px solid var(--purple);
  pointer-events: none;
  z-index: 5;
}
```

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/BaseFlowLane.tsx src/ui/styles.css && git commit -m "$(cat <<'EOF'
feat(ui): BaseFlowLane 클릭=seek/드래그=구간 제스처 (폴리싱 #7)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: MarkerEditor 제스처(클릭=마커 / 우클릭=삭제 / 드래그=구간)

**Files:** Modify `src/ui/MarkerEditor.tsx`

- [ ] **현 상태 파악** — `src/ui/MarkerEditor.tsx`(포커스 `FocusedMarkerEditor`가 onClick=addMarker, onContextMenu=removeMarker).

- [ ] **수정(FocusedMarkerEditor)** — 기존 onClick/onContextMenu를 `useLaneGesture`로 교체. `editable`(레코드 동작)일 때만 클릭=마커 추가/우클릭=삭제. **드래그=구간은 editable 무관** 동작.
  ```tsx
  import { useState } from "react";
  import { useEditorUi } from "../store/editorUi";
  import { dragToRegion } from "../timeline/laneGesture";
  import { useLaneGesture } from "../input/useLaneGesture";
  // ... 기존 구독 + setRegion/setSequencerOpen, durationMs(useStore baseFlow.durationMs)
  const setRegion = useEditorUi((s) => s.setRegion);
  const setSequencerOpen = useEditorUi((s) => s.setSequencerOpen);
  const durationMs = useStore((s) => s.project?.baseFlow.durationMs ?? 0);
  const [dragPx, setDragPx] = useState<{ a: number; b: number } | null>(null);
  const gesture = useLaneGesture({
    onClick: (x) => { if (editable && pxPerMs > 0) addMarker(track.id, xToTime(x, vp)); },
    onContextClick: (x) => {
      if (!editable || pxPerMs <= 0) return;
      const timeMs = xToTime(x, vp);
      const hit = findNearestMarker(track.markers, timeMs, HIT_TOLERANCE_PX / pxPerMs);
      if (hit) removeMarker(track.id, hit.id);
    },
    onDragMove: (a, b) => setDragPx({ a, b }),
    onDragEnd: (a, b) => {
      setDragPx(null);
      if (pxPerMs <= 0) return;
      setRegion(dragToRegion(a, b, vp, durationMs));
      setSequencerOpen(true);
    },
  });
  ```
  - SVG 요소에서 기존 `onClick`/`onContextMenu` 제거하고 `{...gesture}` 스프레드. (SVG에 pointer 핸들러 부착 가능; `setPointerCapture`는 SVGElement에도 동작.)
  - 드래그 오버레이: SVG 안에 `<rect>` 또는 SVG 위 div 오버레이. SVG 내부면 `dragPx`일 때 `<rect x={Math.min(a,b)} width={Math.abs(b-a)} y={0} height="100%" className="region-drag-overlay-rect" fill="rgba(168,85,247,0.22)" />`. (CSS 클래스 불필요, fill 인라인.)
  - `xToTime`/`vp`/`HIT_TOLERANCE_PX`/`findNearestMarker`는 기존 그대로.

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/MarkerEditor.tsx && git commit -m "$(cat <<'EOF'
feat(ui): MarkerEditor 클릭=마커/우클릭=삭제/드래그=구간 제스처 (폴리싱 #6·#7)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 브라우저 검증 (P1)

**Files:** (검증) `/tmp/bof-driver`, 기록 `IMPLEMENTATION_NOTES.md`

- [ ] dev 서버 후 `public/samples/moodmode-demo.mp3`(긴 트랙) 업로드. 헤드리스로 확인:
  - Shift+휠(및 Ctrl+휠)로 **줌이 실제로 동작**(파형 막대 밀도 변화 + scrollLeft/pxPerMs 변화). 트랙 레인 위에서도 줌/팬 동작.
  - 툴바 +/−/맞춤 버튼 동작(pxPerMs 변화/리셋).
  - 베이스 파형 단일클릭=seek(즉시), 더블클릭이 seek를 선점하지 않음(더블클릭=fitAll 없음 확인).
  - 포커스 마커 레인: 클릭=마커 추가(mousedown 아님), 우클릭=삭제, 드래그=구간(시퀀서 region 갱신 + 자동 열림).
  - 베이스 파형 드래그=구간.
  - 콘솔 에러(favicon 404 제외) 없음.
- [ ] 무인이면 `IMPLEMENTATION_NOTES.md`에 P1 검증 결과/미검증 항목 기록(성공 꾸미지 말 것).
- [ ] `yarn test:run && yarn tsc -b` 최종 그린.
- [ ] **커밋**(노트)
```bash
git add IMPLEMENTATION_NOTES.md && git commit -m "$(cat <<'EOF'
docs: P1(줌/제스처/구간드래그) 브라우저 검증 기록

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (스펙 대조)
- §3 A(줌/휠): Task 1(zoomByAtCenter)·2(resolveWheelIntent)·5(휠 전체영역+dominant)·6(버튼+더블클릭 제거). ✓
- §3 B(제스처): Task 3(분류/구간 순수)·4(훅)·7·8(적용). 마커는 클릭에서만(#6). ✓
- §3 C(구간): Task 7·8 드래그→setRegion+자동열기 + 오버레이. ✓
- 순수 로직 TDD(zoom/wheel/gesture/region), UI는 헤드리스 검증(데모 mp3). any 없음. 각 Task 그린+커밋.
