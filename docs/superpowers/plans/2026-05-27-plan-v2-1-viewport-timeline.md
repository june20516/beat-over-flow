# [Viewport & Timeline] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v2 요구 10(공유 가로 스크롤/줌)의 코어를 구현한다. 시간↔픽셀 변환을 전담하는 순수 수학 모듈(`viewportMath`)과 휘발성 뷰포트 스토어(`useViewport`)를 만들고, 단일 캔버스 `TimelineCanvas`를 공유 좌표계 기반의 `Timeline`(스크롤/줌 컨테이너) + `BaseFlowLane`(파형) + `PlayheadOverlay`(플레이헤드)로 분해·대체한다. 트랙 레인은 계획 2에서 추가하므로 이 단계에선 빈 트랙 영역 stub만 둔다.

**Architecture:** 네이티브 스크롤바를 쓰지 않는다. `useViewport`가 `pxPerMs`/`scrollLeftPx`/`containerWidthPx`/`durationMs`를 보유하고, 모든 레인은 `timeToX`/`xToTime`로 콘텐츠를 offset해 그린다. 각 클램프/줌 앵커링은 `viewportMath`의 순수함수에서만 수행하고 스토어 액션은 이를 호출만 한다. `Timeline`은 ResizeObserver로 우측 arrange 폭을 측정해 `setContainerWidth`를 호출하고, wheel→`panByPx`, shift+wheel→`zoomAt(앵커=커서x)`를 처리한다. `BaseFlowLane` 클릭=seek, 더블클릭=`fitAll`. `PlayheadOverlay`는 `playheadMs`를 `timeToX`로 변환한 위치에 시안 세로선을 그린다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest

계약 기준: `docs/superpowers/plans/2026-05-27-v2-contracts.md` §1(파일구조), §4(뷰포트 수학), §5(뷰포트 스토어), §8(컴포넌트 props). 설계: `docs/superpowers/specs/2026-05-27-editor-architecture-v2-design.md` §5, §9.

---

### Task 1: viewportMath 순수함수 (계약 §4) — 완전한 TDD

시간↔픽셀 변환과 클램프/줌 앵커링 순수함수. React/스토어 의존 없음. 단위테스트로 전부 커버.

**Files:**
- Create: `src/timeline/viewportMath.ts`
- Test: `src/timeline/viewportMath.test.ts`

- [ ] **실패 테스트 작성** — `src/timeline/viewportMath.test.ts` 생성:

```ts
import { describe, it, expect } from "vitest";
import {
  MAX_PX_PER_MS,
  minPxPerMs,
  clampPxPerMs,
  maxScrollLeftPx,
  clampScrollLeftPx,
  timeToX,
  xToTime,
  zoomedViewport,
  type Viewport,
} from "./viewportMath";

function vp(partial: Partial<Viewport> = {}): Viewport {
  return { pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000, ...partial };
}

describe("MAX_PX_PER_MS", () => {
  it("상한은 0.5 (1초당 500px)", () => {
    expect(MAX_PX_PER_MS).toBe(0.5);
  });
});

describe("minPxPerMs", () => {
  it("곡 전체가 컨테이너 폭에 딱 맞는 비율", () => {
    // 10000ms를 1000px에 → 0.1 px/ms
    expect(minPxPerMs(1000, 10000)).toBeCloseTo(0.1);
  });
  it("durationMs<=0 이면 0", () => {
    expect(minPxPerMs(1000, 0)).toBe(0);
    expect(minPxPerMs(1000, -5)).toBe(0);
  });
});

describe("clampPxPerMs", () => {
  it("min 미만이면 min(=minPxPerMs)으로 올린다", () => {
    // min = 1000/10000 = 0.1
    expect(clampPxPerMs(0.01, 1000, 10000)).toBeCloseTo(0.1);
  });
  it("MAX 초과면 MAX로 내린다", () => {
    expect(clampPxPerMs(99, 1000, 10000)).toBe(MAX_PX_PER_MS);
  });
  it("범위 내면 그대로", () => {
    expect(clampPxPerMs(0.2, 1000, 10000)).toBeCloseTo(0.2);
  });
});

describe("maxScrollLeftPx", () => {
  it("durationMs*pxPerMs - containerWidthPx", () => {
    // 10000*0.2 - 1000 = 1000
    expect(maxScrollLeftPx(vp({ pxPerMs: 0.2 }), 10000)).toBe(1000);
  });
  it("콘텐츠가 컨테이너보다 좁으면 0", () => {
    expect(maxScrollLeftPx(vp({ pxPerMs: 0.05 }), 10000)).toBe(0);
  });
});

describe("clampScrollLeftPx", () => {
  it("[0, maxScrollLeftPx]로 클램프", () => {
    const v = vp({ pxPerMs: 0.2 }); // max = 1000
    expect(clampScrollLeftPx(-50, v, 10000)).toBe(0);
    expect(clampScrollLeftPx(5000, v, 10000)).toBe(1000);
    expect(clampScrollLeftPx(400, v, 10000)).toBe(400);
  });
});

describe("timeToX / xToTime", () => {
  it("timeToX = ms*pxPerMs - scrollLeftPx", () => {
    expect(timeToX(2000, vp({ pxPerMs: 0.2, scrollLeftPx: 100 }))).toBeCloseTo(300);
  });
  it("xToTime = (x + scrollLeftPx)/pxPerMs", () => {
    expect(xToTime(300, vp({ pxPerMs: 0.2, scrollLeftPx: 100 }))).toBeCloseTo(2000);
  });
  it("timeToX와 xToTime은 역함수", () => {
    const v = vp({ pxPerMs: 0.2, scrollLeftPx: 100 });
    expect(xToTime(timeToX(2000, v), v)).toBeCloseTo(2000);
  });
});

describe("zoomedViewport", () => {
  it("앵커 커서의 시간이 줌 후에도 같은 화면 x에 유지된다", () => {
    const v = vp({ pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 });
    const before = xToTime(500, v);
    const z = zoomedViewport(v, 10000, 2, 500);
    expect(xToTime(500, z)).toBeCloseTo(before);
    expect(z.pxPerMs).toBeCloseTo(0.2);
    expect(z.containerWidthPx).toBe(1000);
  });
  it("factor가 커도 pxPerMs는 MAX로 클램프된다", () => {
    const v = vp({ pxPerMs: 0.4, scrollLeftPx: 0, containerWidthPx: 1000 });
    const z = zoomedViewport(v, 10000, 100, 0);
    expect(z.pxPerMs).toBe(MAX_PX_PER_MS);
  });
  it("factor<1로 축소해도 pxPerMs는 minPxPerMs 아래로 안 내려간다", () => {
    const v = vp({ pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 });
    const z = zoomedViewport(v, 10000, 0.01, 500); // min = 0.1
    expect(z.pxPerMs).toBeCloseTo(0.1);
    expect(z.scrollLeftPx).toBe(0);
  });
  it("newScroll은 클램프된다(음수 방지)", () => {
    const v = vp({ pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 });
    const z = zoomedViewport(v, 10000, 2, 0); // anchorX=0 → anchorTime=0
    expect(z.scrollLeftPx).toBe(0);
  });
});
```

- [ ] **실패 확인** — 실행: `yarn vitest run src/timeline/viewportMath.test.ts`. 예상: 모듈 `./viewportMath`를 찾을 수 없어 전체 실패(import error).

- [ ] **최소 구현** — `src/timeline/viewportMath.ts` 생성:

```ts
export interface Viewport {
  pxPerMs: number;
  scrollLeftPx: number;
  containerWidthPx: number;
}

/** 줌 상한: 1초당 500px. */
export const MAX_PX_PER_MS = 0.5;

/** 곡 전체가 컨테이너 폭에 딱 맞는 비율(=100% 줌아웃). durationMs<=0 → 0. */
export function minPxPerMs(containerWidthPx: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return containerWidthPx / durationMs;
}

/** pxPerMs를 [minPxPerMs, MAX_PX_PER_MS]로 클램프. */
export function clampPxPerMs(
  pxPerMs: number,
  containerWidthPx: number,
  durationMs: number,
): number {
  const min = minPxPerMs(containerWidthPx, durationMs);
  return Math.max(min, Math.min(MAX_PX_PER_MS, pxPerMs));
}

/** 스크롤 가능한 최대 오프셋. max(0, durationMs*pxPerMs - containerWidthPx). */
export function maxScrollLeftPx(vp: Viewport, durationMs: number): number {
  return Math.max(0, durationMs * vp.pxPerMs - vp.containerWidthPx);
}

/** scrollLeftPx를 [0, maxScrollLeftPx]로 클램프. */
export function clampScrollLeftPx(
  scrollLeftPx: number,
  vp: Viewport,
  durationMs: number,
): number {
  return Math.max(0, Math.min(maxScrollLeftPx(vp, durationMs), scrollLeftPx));
}

/** 시간(ms) → 화면 x(px). */
export function timeToX(ms: number, vp: Viewport): number {
  return ms * vp.pxPerMs - vp.scrollLeftPx;
}

/** 화면 x(px) → 시간(ms). */
export function xToTime(x: number, vp: Viewport): number {
  return (x + vp.scrollLeftPx) / vp.pxPerMs;
}

/**
 * 커서(anchorX)의 시간이 제자리 유지되도록 줌. factor>1 확대.
 * anchorTime = xToTime(anchorX) → newPx = clampPxPerMs(pxPerMs*factor)
 * → newScroll = clampScrollLeftPx(anchorTime*newPx - anchorX).
 */
export function zoomedViewport(
  vp: Viewport,
  durationMs: number,
  factor: number,
  anchorX: number,
): Viewport {
  const anchorTime = xToTime(anchorX, vp);
  const newPx = clampPxPerMs(vp.pxPerMs * factor, vp.containerWidthPx, durationMs);
  const candidate: Viewport = {
    pxPerMs: newPx,
    scrollLeftPx: 0,
    containerWidthPx: vp.containerWidthPx,
  };
  const newScroll = clampScrollLeftPx(anchorTime * newPx - anchorX, candidate, durationMs);
  return { pxPerMs: newPx, scrollLeftPx: newScroll, containerWidthPx: vp.containerWidthPx };
}
```

- [ ] **통과 확인** — 실행: `yarn vitest run src/timeline/viewportMath.test.ts`. 예상: 모든 테스트(8 describe 블록) green.

- [ ] **태스크 검증** — 실행: `yarn test:run && yarn tsc -b`. 예상: 둘 다 통과.

- [ ] **커밋**:

```sh
git add src/timeline/viewportMath.ts src/timeline/viewportMath.test.ts
git commit -m "$(cat <<'EOF'
feat(timeline): add viewportMath pure time<->pixel functions

계약 §4 순수함수(minPxPerMs/clampPxPerMs/maxScrollLeftPx/
clampScrollLeftPx/timeToX/xToTime/zoomedViewport, MAX_PX_PER_MS) TDD 구현.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: useViewport 휘발성 스토어 (계약 §5)

§4 함수를 사용하는 zustand 스토어. 액션 동작을 단위테스트.

**Files:**
- Create: `src/store/viewport.ts`
- Test: `src/store/viewport.test.ts`

- [ ] **실패 테스트 작성** — `src/store/viewport.test.ts` 생성:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useViewport } from "./viewport";
import { MAX_PX_PER_MS } from "../timeline/viewportMath";

function reset() {
  useViewport.setState({ pxPerMs: 0, scrollLeftPx: 0, containerWidthPx: 1, durationMs: 0 });
}

describe("useViewport", () => {
  beforeEach(reset);

  it("초기값: containerWidthPx=1(0분모방지), durationMs=0", () => {
    const s = useViewport.getState();
    expect(s.containerWidthPx).toBe(1);
    expect(s.durationMs).toBe(0);
  });

  it("setDuration + setContainerWidth 후 fitAll로 minPxPerMs/scroll0", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    s.fitAll();
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.1); // 1000/10000
    expect(v.scrollLeftPx).toBe(0);
  });

  it("setDuration은 재클램프하며 pxPerMs가 0이면 최소줌으로 채운다", () => {
    const s = useViewport.getState();
    s.setContainerWidth(1000);
    s.setDuration(10000);
    const v = useViewport.getState();
    // 초기 pxPerMs=0이 minPxPerMs(0.1)로 클램프됨
    expect(v.pxPerMs).toBeCloseTo(0.1);
  });

  it("setContainerWidth는 pxPerMs/scroll을 재클램프한다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    s.fitAll();          // pxPerMs=0.1
    s.setContainerWidth(500); // min이 0.05로 내려가도 0.1은 유효 → 유지, scroll 재클램프
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.1);
    expect(v.scrollLeftPx).toBe(0);
  });

  it("panByPx는 scrollLeftPx를 클램프 이동한다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    useViewport.setState({ pxPerMs: 0.2 }); // max scroll = 10000*0.2-1000 = 1000
    s.panByPx(500);
    expect(useViewport.getState().scrollLeftPx).toBe(500);
    s.panByPx(9999); // 클램프
    expect(useViewport.getState().scrollLeftPx).toBe(1000);
    s.panByPx(-9999);
    expect(useViewport.getState().scrollLeftPx).toBe(0);
  });

  it("zoomAt은 앵커 시간을 유지하며 확대한다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    s.fitAll(); // pxPerMs=0.1, scroll=0
    s.zoomAt(2, 500);
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.2);
    // anchorTime = (500+0)/0.1 = 5000ms → 줌후 화면 x: 5000*0.2 - scroll = 500
    expect(5000 * v.pxPerMs - v.scrollLeftPx).toBeCloseTo(500);
  });

  it("zoomAt은 MAX_PX_PER_MS를 넘지 않는다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    useViewport.setState({ pxPerMs: 0.4 });
    s.zoomAt(100, 0);
    expect(useViewport.getState().pxPerMs).toBe(MAX_PX_PER_MS);
  });
});
```

- [ ] **실패 확인** — 실행: `yarn vitest run src/store/viewport.test.ts`. 예상: `./viewport` 모듈 없음으로 전체 실패.

- [ ] **최소 구현** — `src/store/viewport.ts` 생성:

```ts
import { create } from "zustand";
import {
  clampPxPerMs,
  clampScrollLeftPx,
  minPxPerMs,
  zoomedViewport,
  type Viewport,
} from "../timeline/viewportMath";

interface ViewportState {
  pxPerMs: number;
  scrollLeftPx: number;
  containerWidthPx: number;
  durationMs: number;
  setContainerWidth: (px: number) => void;
  setDuration: (ms: number) => void;
  fitAll: () => void;
  panByPx: (dx: number) => void;
  zoomAt: (factor: number, anchorX: number) => void;
}

/** 현재 스토어 상태에서 Viewport(순수타입)를 추출. */
function toVp(s: ViewportState): Viewport {
  return {
    pxPerMs: s.pxPerMs,
    scrollLeftPx: s.scrollLeftPx,
    containerWidthPx: s.containerWidthPx,
  };
}

export const useViewport = create<ViewportState>((set) => ({
  pxPerMs: 0,
  scrollLeftPx: 0,
  containerWidthPx: 1,
  durationMs: 0,

  setContainerWidth: (px) =>
    set((s) => {
      const containerWidthPx = Math.max(1, px);
      const pxPerMs = clampPxPerMs(s.pxPerMs, containerWidthPx, s.durationMs);
      const next = { ...s, containerWidthPx, pxPerMs };
      const scrollLeftPx = clampScrollLeftPx(s.scrollLeftPx, toVp(next), s.durationMs);
      return { containerWidthPx, pxPerMs, scrollLeftPx };
    }),

  setDuration: (ms) =>
    set((s) => {
      const durationMs = Math.max(0, ms);
      const pxPerMs = clampPxPerMs(s.pxPerMs, s.containerWidthPx, durationMs);
      const next = { ...s, durationMs, pxPerMs };
      const scrollLeftPx = clampScrollLeftPx(s.scrollLeftPx, toVp(next), durationMs);
      return { durationMs, pxPerMs, scrollLeftPx };
    }),

  fitAll: () =>
    set((s) => ({
      pxPerMs: minPxPerMs(s.containerWidthPx, s.durationMs),
      scrollLeftPx: 0,
    })),

  panByPx: (dx) =>
    set((s) => ({
      scrollLeftPx: clampScrollLeftPx(s.scrollLeftPx + dx, toVp(s), s.durationMs),
    })),

  zoomAt: (factor, anchorX) =>
    set((s) => {
      const z = zoomedViewport(toVp(s), s.durationMs, factor, anchorX);
      return { pxPerMs: z.pxPerMs, scrollLeftPx: z.scrollLeftPx };
    }),
}));
```

> 비고: `setDuration`은 초기 `pxPerMs=0`이 `clampPxPerMs`를 거치며 `minPxPerMs`로 올라가므로 별도 fitAll 분기 없이도 "필요시 fitAll" 효과를 낸다(테스트 3번이 이를 검증). 명시적 fitAll은 `BaseFlowLane` 더블클릭과 프로젝트 로드 시 `Timeline`에서 호출한다.

- [ ] **통과 확인** — 실행: `yarn vitest run src/store/viewport.test.ts`. 예상: 모든 테스트 green.

- [ ] **태스크 검증** — 실행: `yarn test:run && yarn tsc -b`. 예상: 둘 다 통과.

- [ ] **커밋**:

```sh
git add src/store/viewport.ts src/store/viewport.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add useViewport volatile viewport store

계약 §5: setContainerWidth/setDuration/fitAll/panByPx/zoomAt.
모든 클램프는 §4 순수함수 사용. 단위테스트로 액션 동작 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: BaseFlowLane (계약 §8) — 베이스 파형 캔버스

`TimelineCanvas`의 파형 렌더부를 이전. 캔버스 폭은 `durationMs*pxPerMs`이지만 화면엔 컨테이너 폭만 보이고, 콘텐츠는 `scrollLeftPx`만큼 transform offset. 클릭=seek(`xToTime`로 시각 계산), 더블클릭=`fitAll`. 파형 색은 기존 그라데이션 유지.

순수하게 검증할 로직(클릭 시각 계산)은 단위테스트로 잡을 수 없는 캔버스 렌더와 섞이지 않도록, 클릭 핸들러는 `xToTime`만 사용한다(이미 Task 1에서 검증됨). 캔버스 렌더/transform은 브라우저 검증으로 확인한다.

**Files:**
- Create: `src/ui/BaseFlowLane.tsx`

- [ ] **구현** — `src/ui/BaseFlowLane.tsx` 생성:

```tsx
import { useEffect, useRef } from "react";
import { useViewport } from "../store/viewport";
import { seek } from "../audio/runtime";
import { xToTime } from "../timeline/viewportMath";

interface BaseFlowLaneProps {
  peaks: Float32Array | null;
  durationMs: number;
}

const HEIGHT = 80;

export function BaseFlowLane({ peaks, durationMs }: BaseFlowLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);
  const fitAll = useViewport((s) => s.fitAll);

  // 캔버스 내부 해상도 = 콘텐츠 전체 폭(durationMs*pxPerMs). 화면엔 컨테이너 폭만.
  const contentWidth = Math.max(1, Math.round(durationMs * pxPerMs));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = contentWidth;
    ctx.clearRect(0, 0, w, HEIGHT);
    ctx.fillStyle = "#100c24";
    ctx.fillRect(0, 0, w, HEIGHT);
    if (peaks && peaks.length > 0) {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#a855f7");
      grad.addColorStop(1, "#ec4899");
      ctx.fillStyle = grad;
      const mid = HEIGHT / 2;
      const barW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const bh = peaks[i] * (HEIGHT - 8);
        ctx.fillRect(i * barW, mid - bh / 2, Math.max(1, barW - 1), bh);
      }
    }
  }, [peaks, contentWidth]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (durationMs <= 0 || pxPerMs <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    seek(xToTime(x, { pxPerMs, scrollLeftPx, containerWidthPx }));
  }

  return (
    <div
      className="base-flow-lane"
      onClick={handleClick}
      onDoubleClick={fitAll}
      style={{ position: "relative", width: "100%", height: HEIGHT, overflow: "hidden", cursor: "pointer" }}
    >
      <canvas
        ref={canvasRef}
        width={contentWidth}
        height={HEIGHT}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: contentWidth,
          height: HEIGHT,
          transform: `translateX(${-scrollLeftPx}px)`,
          display: "block",
        }}
      />
    </div>
  );
}
```

> 비고: 클릭 좌표 `x`는 컨테이너 기준이라 transform과 무관하게 `xToTime(x, vp)`가 올바르다(`xToTime`가 `scrollLeftPx`를 더하므로). 캔버스만 translate한다.

- [ ] **태스크 검증** — 실행: `yarn test:run && yarn tsc -b`. 예상: 기존 테스트 영향 없음, tsc 통과. (이 컴포넌트는 Task 5에서 `Timeline`에 배치된 뒤 브라우저 검증한다. 단독 import만으로 타입 통과 확인.)

- [ ] **커밋**:

```sh
git add src/ui/BaseFlowLane.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add BaseFlowLane waveform canvas with viewport offset

계약 §8: peaks/durationMs props. 캔버스 폭=durationMs*pxPerMs,
화면엔 컨테이너폭만(overflow hidden + translateX(-scrollLeftPx)).
클릭=seek(xToTime), 더블클릭=fitAll. 기존 그라데이션 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: PlayheadOverlay (계약 §8)

`playheadMs`를 `timeToX`로 변환한 위치에 시안 세로선. 뷰포트/플레이헤드 구독. 캔버스 리렌더와 무관한 별도 오버레이(설계 §9).

**Files:**
- Create: `src/ui/PlayheadOverlay.tsx`

- [ ] **구현** — `src/ui/PlayheadOverlay.tsx` 생성:

```tsx
import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { timeToX } from "../timeline/viewportMath";

export function PlayheadOverlay() {
  const playheadMs = useStore((s) => s.playheadMs);
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const x = timeToX(playheadMs, { pxPerMs, scrollLeftPx, containerWidthPx });
  const visible = x >= 0 && x <= containerWidthPx;

  return (
    <div
      className="playhead-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {visible && (
        <div
          className="playhead-overlay__line"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: x,
            width: 2,
            background: "#22d3ee",
            boxShadow: "0 0 8px #22d3ee",
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **태스크 검증** — 실행: `yarn test:run && yarn tsc -b`. 예상: tsc 통과, 기존 테스트 영향 없음.

- [ ] **커밋**:

```sh
git add src/ui/PlayheadOverlay.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add PlayheadOverlay cyan playhead line

playheadMs를 timeToX로 변환한 위치에 세로선. 뷰포트/플레이헤드 구독,
가시 범위 밖이면 숨김. pointer-events none 오버레이.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Timeline 컨테이너 (계약 §1, 설계 §4·§5)

좌(고정 컬럼 슬롯)·우(arrange) 레이아웃. ResizeObserver로 우측 폭 측정→`setContainerWidth`. 프로젝트 `durationMs`를 `setDuration`으로 반영. wheel: 기본 `deltaY`→`panByPx`, shift+wheel→`zoomAt`(앵커=커서x). 우측엔 `BaseFlowLane` + `PlayheadOverlay` + 빈 트랙영역 stub(계획 2에서 채움).

**Files:**
- Create: `src/ui/Timeline.tsx`

- [ ] **구현** — `src/ui/Timeline.tsx` 생성:

```tsx
import { useEffect, useRef } from "react";
import { useViewport } from "../store/viewport";
import { BaseFlowLane } from "./BaseFlowLane";
import { PlayheadOverlay } from "./PlayheadOverlay";

interface TimelineProps {
  peaks: Float32Array | null;
  durationMs: number;
}

const ZOOM_IN_FACTOR = 1.0015; // wheel 1deltaY당 줌 배율(부드럽게)

export function Timeline({ peaks, durationMs }: TimelineProps) {
  const arrangeRef = useRef<HTMLDivElement>(null);
  const setContainerWidth = useViewport((s) => s.setContainerWidth);
  const setDuration = useViewport((s) => s.setDuration);
  const panByPx = useViewport((s) => s.panByPx);
  const zoomAt = useViewport((s) => s.zoomAt);

  // 프로젝트 길이 반영
  useEffect(() => {
    setDuration(durationMs);
  }, [durationMs, setDuration]);

  // 우측 arrange 폭 측정
  useEffect(() => {
    const el = arrangeRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setContainerWidth]);

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.shiftKey) {
      const rect = e.currentTarget.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      // 위로 스크롤(deltaY<0)=확대(factor>1)
      const factor = Math.pow(ZOOM_IN_FACTOR, -e.deltaY);
      zoomAt(factor, anchorX);
    } else {
      // 가로 휠(deltaX) 우선, 없으면 deltaY로 가로 팬
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      panByPx(dx);
    }
  }

  return (
    <div className="timeline">
      <div className="timeline__fixed-col">
        {/* 헤더 슬롯: 좌측 고정 컬럼(트랙 에디터 컬럼)은 계획 2에서 채운다. */}
      </div>
      <div
        ref={arrangeRef}
        className="timeline__arrange"
        onWheel={handleWheel}
        style={{ position: "relative", flex: 1, overflow: "hidden" }}
      >
        <BaseFlowLane peaks={peaks} durationMs={durationMs} />
        {/* 트랙 레인 영역 stub — 계획 2에서 TrackRow[]로 채운다. */}
        <div className="timeline__tracks-stub" />
        <PlayheadOverlay />
      </div>
    </div>
  );
}
```

> 비고: React의 `onWheel`은 passive listener라 `preventDefault`가 경고를 낼 수 있다. 브라우저 검증에서 가로 팬/줌이 페이지 스크롤 없이 동작하는지 확인하고, 막히면 `arrangeRef`에 `addEventListener("wheel", handler, { passive: false })`로 전환한다(이 경우 핸들러를 effect 내부로 이동). 일단 `onWheel`로 시작.

- [ ] **태스크 검증** — 실행: `yarn test:run && yarn tsc -b`. 예상: tsc 통과(아직 Editor가 Timeline을 안 쓰므로 미사용 경고 없음 — Task 6에서 연결).

- [ ] **커밋**:

```sh
git add src/ui/Timeline.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Timeline scroll/zoom container

좌(고정)·우(arrange) 레이아웃. ResizeObserver로 arrange 폭→setContainerWidth,
durationMs→setDuration. wheel→panByPx, shift+wheel→zoomAt(앵커=커서x).
우측에 BaseFlowLane + PlayheadOverlay + 트랙영역 stub 배치.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Editor 연결 + TimelineCanvas 삭제

`Editor`에서 `TimelineCanvas` 사용을 제거하고 `Timeline`을 사용. `src/render/TimelineCanvas.tsx`를 삭제. 앱이 빌드되고 베이스 파형/플레이헤드가 보이는 상태 유지. 트랙 마커 표시는 계획 2 몫이라 이 단계엔 없어도 됨.

이 단계에선 region/stepCount는 아직 `StepSequencerPanel`에서만 쓰이므로 Editor의 로컬 state를 유지한다(계획 5에서 `useEditorUi`로 이관). `onSeek`/`onLaneClick` prop은 `Timeline`이 자체적으로 seek를 처리하므로 제거된다(마커 클릭 추가는 계획 2의 `MarkerEditor`로 이동).

**Files:**
- Modify: `src/ui/Editor.tsx`
- Delete: `src/render/TimelineCanvas.tsx`

- [ ] **구현 (1/3) — import 교체** — `src/ui/Editor.tsx`에서:

```ts
import { TimelineCanvas } from "../render/TimelineCanvas";
```

를

```ts
import { Timeline } from "./Timeline";
```

로 교체.

- [ ] **구현 (2/3) — 사용처 교체** — `editor-main`의 `TimelineCanvas` 블록을 `Timeline`으로 교체. 즉:

```tsx
      <div className="editor-main">
        <TrackList />
        <div className="editor-main__timeline">
          <TimelineCanvas
            peaks={peaks}
            durationMs={project.baseFlow.durationMs}
            tracks={tracks}
            region={region}
            stepCount={stepCount}
            onSeek={seek}
            onLaneClick={handleLaneClick}
          />
        </div>
      </div>
```

를

```tsx
      <div className="editor-main">
        <TrackList />
        <div className="editor-main__timeline">
          <Timeline peaks={peaks} durationMs={project.baseFlow.durationMs} />
        </div>
      </div>
```

로 교체.

- [ ] **구현 (3/3) — 미사용 정리** — `Timeline`이 seek/마커클릭을 자체 처리하므로 Editor에서 미사용이 된 항목을 제거한다:
  - `import { ... seek } from "../audio/runtime";` 에서 `seek` 제거(다른 사용 없으면 import 라인 정리). `getEngine`, `loadBaseFlow`는 peaks 계산에 여전히 필요하므로 유지.
  - `handleLaneClick` 함수 제거.
  - `handleLaneClick`에서만 쓰이던 `addMarker`, `resolveTrackBehavior`, `mode`, `tracks` 변수 중 **다른 곳에서 안 쓰는 것**을 제거. 단, `mode`는 `startPlaySession` effect에서 쓰이므로 유지. `tracks`는 `TrackList`가 자체 store 구독이면 제거 가능 — `TrackList` 사용처에 props로 안 넘기므로 `tracks`/`addMarker`/`resolveTrackBehavior` 제거.

  결과적으로 `Editor`는 다음 import만 남도록 한다(예시):

```ts
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getEngine, loadBaseFlow } from "../audio/runtime";
import { getAsset } from "../persistence/assets";
import { computePeaks } from "../render/waveform";
import { Timeline } from "./Timeline";
import { TransportBar } from "./TransportBar";
import { TrackList } from "./TrackList";
import { ModeSwitcher } from "./ModeSwitcher";
import { StepSequencerPanel } from "./StepSequencerPanel";
import { ScoreHud } from "./ScoreHud";
import { startKeyboard } from "../input/KeyboardController";
import { startPlaySession, endPlaySession } from "../scoring/playSession";
```

  그리고 `mode`는 effect용으로 유지하되, `addMarker`/`tracks` 구독 라인과 `handleLaneClick`을 삭제.

> 비고: 컴파일 에러가 나는 미사용 변수는 `yarn tsc -b`(noUnusedLocals 설정 시)가 정확히 짚어주므로, tsc 출력을 보고 해당 라인만 제거한다. 추측으로 더 지우지 말 것.

- [ ] **삭제** — 실행: `git rm src/render/TimelineCanvas.tsx`.

- [ ] **타입/테스트 확인** — 실행: `yarn test:run && yarn tsc -b`. 예상: 둘 다 통과. tsc가 미사용 변수를 지적하면 위 (3/3)에 따라 해당 라인만 제거 후 재실행.

- [ ] **브라우저 검증** — 베이스 파형·플레이헤드·스크롤·줌은 단위테스트로 못 잡으므로 헤드리스 Chrome으로 확인한다.
  - 사전 준비(샘플 wav가 없으면): 실행
    ```sh
    node /tmp/bof-driver/gen-wav.mjs && ls -la /tmp/bof-sample.wav
    ```
  - dev 서버 백그라운드 기동 후 스크린샷:
    ```sh
    yarn dev &
    until curl -sf http://localhost:5173 >/dev/null; do sleep 0.5; done
    OUT_DIR=/tmp node /tmp/bof-driver/shot.mjs
    ```
    (드라이버에 줌/스크롤 단계가 없으면 `/tmp/bof-driver/shot.mjs`에 다음을 임시로 추가해 검증: 에디터 진입 후
    ```js
    const arrange = page.locator(".timeline__arrange");
    await arrange.dispatchEvent("wheel", { deltaY: -300, shiftKey: true, clientX: 700 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "/tmp/bof-zoom.png", fullPage: true });
    await arrange.dispatchEvent("wheel", { deltaY: 400 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "/tmp/bof-pan.png", fullPage: true });
    ```
    )
  - 확인 항목: `/tmp/bof-editor.png`에 베이스 파형(보라→핑크 그라데이션)이 보인다 / `/tmp/bof-play.png`에 시안 플레이헤드 선이 보인다 / `/tmp/bof-zoom.png`에서 파형이 커서(700px) 기준으로 확대된다 / `/tmp/bof-pan.png`에서 파형이 가로로 이동한다 / page error/pageerror 로그가 없다.
  - 검증 후 dev 서버 종료: `kill %1` (또는 해당 vite 프로세스).
  - **무인 실행이라 스크린샷을 사람이 못 보는 경우:** `IMPLEMENTATION_NOTES.md`에 "Timeline 베이스파형/플레이헤드/스크롤/줌 — 사람 검증 필요(스크린샷 경로 기록)"로 적고 성공을 단정하지 않는다. 콘솔 에러 0건만 무인으로 확인 가능.

- [ ] **커밋**:

```sh
git add src/ui/Editor.tsx
git commit -m "$(cat <<'EOF'
refactor(ui): replace TimelineCanvas with Timeline in Editor

Editor가 Timeline(공유 뷰포트)을 사용. seek/마커클릭은 Timeline/하위
컴포넌트가 처리. render/TimelineCanvas.tsx 삭제. 베이스 파형·플레이헤드
유지(트랙 레인은 계획 2).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (계약 대조)

- 계약 §4 함수 7개 + 상수 전부 Task 1에 구현·테스트(minPxPerMs, clampPxPerMs, maxScrollLeftPx, clampScrollLeftPx, timeToX, xToTime, zoomedViewport, MAX_PX_PER_MS). 시그니처/`Viewport` 타입 정확히 일치, any 없음. ✓
- 계약 §5 `useViewport` 5개 액션 + 초기값(containerWidthPx=1, durationMs=0) Task 2. 클램프는 §4 함수만 사용. ✓
- 계약 §8 `BaseFlowLane`(peaks/durationMs, 클릭=seek, 더블클릭=fitAll), `PlayheadOverlay`(props 없음) 시그니처 일치. Task 3·4. ✓
- 설계 §4·§5 `Timeline`(좌/우 레이아웃, ResizeObserver→setContainerWidth, wheel 팬, shift+wheel 줌 앵커) Task 5. 트랙 레인은 stub. ✓
- 계약 §1·§10 `TimelineCanvas` 삭제(rm 단계 포함) + Editor 교체 Task 6. ✓
- 요구 10 코어(공유 가로 스크롤/줌이 베이스 파형·플레이헤드에 동기 적용, 최소줌=폭100%, 더블클릭 리셋, 커서 앵커 줌) 전부 커버. 트랙 마커 동기는 계획 2에서 같은 뷰포트를 구독하므로 자동.
- 순수 로직(뷰포트 수학·스토어)은 진짜 TDD. 캔버스/스크롤/줌 UI는 브라우저 검증 스텝 + 무인 시 IMPLEMENTATION_NOTES 기록 규약 준수. 플레이스홀더 없음(모든 코드 스텝에 실제 코드).
- 각 Task 종료에 `yarn test:run && yarn tsc -b` 검증 스텝 존재. 커밋 메시지 끝에 Co-Authored-By 포함.
