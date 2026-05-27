# [Track Rows & Marker Editor] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1의 `TrackList`/`TrackHeader`(헤더 컬럼) + 단일 캔버스 마커 렌더를 **행 기반(`TrackRow` = `TrackEditor` + `MarkerEditor`)** 구조로 분해한다. 마커 편집을 우측 `MarkerEditor`로 옮겨, 포커스 트랙은 가상화 SVG(좌클릭 추가 / 우클릭 삭제, 레코드 동작에서만), 언포커스 트랙은 캔버스 오버뷰로 렌더한다. 포커스 트랙은 행 높이 확장 + 풀 컨트롤, 언포커스는 축소 + 간결 컨트롤로 CSS 트랜지션 애니메이션한다. (요구 5·9·11)

**Architecture:** 계획 1의 `useViewport`(휘발성 zustand)와 `src/timeline/viewportMath.ts`(`timeToX`/`xToTime`/`Viewport`)가 이미 존재한다고 전제한다. 마커 편집 게이팅(레코드 동작에서만)·가시 마커 가상화·우클릭 대상 마커 찾기 등 React에서 분리 가능한 로직은 `src/timeline/markerMath.ts`의 순수함수로 빼서 TDD로 검증한다. 행 UI는 좌측 고정폭 `TrackEditor`(이 단계에선 기존 스타일 컨트롤 유지) + 우측 `MarkerEditor`로 구성하고, `Editor`는 트랙별 `TrackRow`를 좌/우 컬럼이 세로 정렬되도록 렌더한다. 마커 추가/삭제는 모두 store 액션(`addMarker`/`removeMarker`/`toggleMarkerAt`)으로 일원화한다. SVG/캔버스 실제 렌더·포커스 애니메이션은 브라우저 검증 스텝으로 분리한다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest

---

## 파일 구조 (이 계획에서 생성/수정/삭제)

```
src/
  timeline/
    markerMath.ts          생성: 순수 — 가시 마커 가상화, 우클릭 대상 찾기, 편집 활성 판정
    markerMath.test.ts     생성
  ui/
    TrackEditor.tsx        생성: 좌측 고정폭 설정 영역(기존 스타일 컨트롤)
    MarkerEditor.tsx       생성: 우측 마커 레인(포커스 SVG / 언포커스 캔버스)
    TrackRow.tsx           생성: TrackEditor + MarkerEditor 합성 행
    Editor.tsx             수정: TrackRow들로 좌/우 컬럼 렌더
    styles.css             수정: track-row/editor 분해 클래스 + 포커스 높이 트랜지션
    TrackList.tsx          삭제(대체됨)
    TrackHeader.tsx        삭제(대체됨)
```

**선행 조건(계획 1):** `src/timeline/viewportMath.ts`(`Viewport`, `timeToX`, `xToTime`), `src/store/viewport.ts`(`useViewport`), `src/ui/Timeline.tsx`가 존재한다. 본 계획은 `MarkerEditor`가 `useViewport`를 직접 구독해 `Viewport`를 얻는다고 가정한다.

**계약 정합:** 본 계획의 모든 props 타입·store 액션 시그니처는 `2026-05-27-v2-contracts.md` §3·§8을 단일 기준으로 따른다. `any`는 사용하지 않는다.

---

## Task 1: 마커 순수 로직 (`markerMath.ts`) — TDD

**Files:**
- Create: `src/timeline/markerMath.ts`, `src/timeline/markerMath.test.ts`

이 Task는 `MarkerEditor`에서 React/DOM에 의존하는 부분을 떼어내 순수함수로 검증한다. 세 가지를 다룬다.
1. `isMarkerEditingEnabled(mode, status)` — 레코드 동작(`resolveTrackBehavior === "record"`)에서만 편집 활성.
2. `visibleMarkers(markers, vp, widthPx)` — `timeToX`가 `[0, widthPx]` 범위인 마커만 반환(가시영역 가상화). 각 항목에 화면 x좌표 동봉.
3. `findNearestMarker(markers, timeMs, toleranceMs)` — 우클릭 삭제 대상: tolerance 이내에서 가장 가까운 마커. 없으면 `null`.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/timeline/markerMath.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  isMarkerEditingEnabled,
  visibleMarkers,
  findNearestMarker,
} from "./markerMath";
import type { Viewport } from "./viewportMath";
import type { Marker } from "../types";

const vp: Viewport = { pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 100 };

describe("isMarkerEditingEnabled", () => {
  it("record 모드 + write 트랙에서만 true", () => {
    expect(isMarkerEditingEnabled("record", "write")).toBe(true);
  });
  it("record 모드라도 write가 아니면 false", () => {
    expect(isMarkerEditingEnabled("record", "play")).toBe(false);
    expect(isMarkerEditingEnabled("record", "listening")).toBe(false);
    expect(isMarkerEditingEnabled("record", "mute")).toBe(false);
  });
  it("record가 아닌 모드는 항상 false", () => {
    expect(isMarkerEditingEnabled("listening", "write")).toBe(false);
    expect(isMarkerEditingEnabled("play", "write")).toBe(false);
  });
});

describe("visibleMarkers", () => {
  const markers: Marker[] = [
    { id: "a", timeMs: 0 },     // x=0   (경계 포함)
    { id: "b", timeMs: 500 },   // x=50
    { id: "c", timeMs: 1000 },  // x=100 (경계 포함)
    { id: "d", timeMs: 2000 },  // x=200 (범위 밖)
  ];

  it("[0,width] 범위(경계 포함)인 마커만 x좌표와 함께 반환", () => {
    const result = visibleMarkers(markers, vp, 100);
    expect(result.map((r) => r.marker.id)).toEqual(["a", "b", "c"]);
    expect(result.map((r) => r.x)).toEqual([0, 50, 100]);
  });

  it("scrollLeftPx가 적용되면 가시 윈도가 이동한다", () => {
    const scrolled: Viewport = { ...vp, scrollLeftPx: 100 };
    // x = ms*0.1 - 100 → b:-50(밖), c:0, d:100
    const result = visibleMarkers(markers, scrolled, 100);
    expect(result.map((r) => r.marker.id)).toEqual(["c", "d"]);
    expect(result.map((r) => r.x)).toEqual([0, 100]);
  });

  it("빈 배열은 빈 배열을 반환", () => {
    expect(visibleMarkers([], vp, 100)).toEqual([]);
  });
});

describe("findNearestMarker", () => {
  const markers: Marker[] = [
    { id: "a", timeMs: 100 },
    { id: "b", timeMs: 300 },
    { id: "c", timeMs: 320 },
  ];

  it("tolerance 이내에서 가장 가까운 마커를 반환", () => {
    expect(findNearestMarker(markers, 90, 50)?.id).toBe("a");
    expect(findNearestMarker(markers, 310, 50)?.id).toBe("b");
    expect(findNearestMarker(markers, 318, 50)?.id).toBe("c");
  });

  it("tolerance 밖이면 null", () => {
    expect(findNearestMarker(markers, 200, 30)).toBeNull();
  });

  it("빈 배열이면 null", () => {
    expect(findNearestMarker([], 100, 50)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/timeline/markerMath.test.ts
```
모듈 미존재로 실패해야 한다.

- [ ] **Step 3: `markerMath.ts` 구현**

`src/timeline/markerMath.ts`:
```ts
import type { GlobalMode, Marker, TrackStatus } from "../types";
import { resolveTrackBehavior } from "../domain/mode";
import { timeToX, type Viewport } from "./viewportMath";

/** 마커 편집(좌/우클릭)은 레코드 동작(레코드 모드 + write 트랙)일 때만 활성. */
export function isMarkerEditingEnabled(mode: GlobalMode, status: TrackStatus): boolean {
  return resolveTrackBehavior(mode, status) === "record";
}

export interface VisibleMarker {
  marker: Marker;
  x: number;
}

/** timeToX가 [0, widthPx] 범위(경계 포함)인 마커만 화면 x좌표와 함께 반환(가상화). */
export function visibleMarkers(
  markers: Marker[],
  vp: Viewport,
  widthPx: number,
): VisibleMarker[] {
  const result: VisibleMarker[] = [];
  for (const marker of markers) {
    const x = timeToX(marker.timeMs, vp);
    if (x >= 0 && x <= widthPx) result.push({ marker, x });
  }
  return result;
}

/** tolerance(ms) 이내에서 timeMs에 가장 가까운 마커. 없으면 null(우클릭 삭제 대상). */
export function findNearestMarker(
  markers: Marker[],
  timeMs: number,
  toleranceMs: number,
): Marker | null {
  let best: Marker | null = null;
  let bestDist = Infinity;
  for (const m of markers) {
    const dist = Math.abs(m.timeMs - timeMs);
    if (dist <= toleranceMs && dist < bestDist) {
      best = m;
      bestDist = dist;
    }
  }
  return best;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/timeline/markerMath.test.ts && npx tsc -b
```

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat(timeline): 마커 가상화/편집게이팅 순수함수(markerMath)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `TrackEditor` — 좌측 설정 영역(기존 스타일 유지)

**Files:**
- Create: `src/ui/TrackEditor.tsx`

계약 §8 `TrackEditorProps = { track: Track; focused: boolean }`. 이 단계에선 **기존 `TrackHeader` 컨트롤 수준을 유지**한다(StatusGrid/VolumeControl/KeyCap/마커비우기 고급화는 계획 3에서 교체). 구성: 이름 input, 상태 `<select>`(기존 STATUS_LABEL), 사운드 `<select>`(BUILTIN_SAMPLES), 키 표시 버튼(원시 keyBinding 텍스트), 볼륨 range, 삭제 버튼. 행 클릭 시 포커스는 상위 `TrackRow`가 처리하므로, `TrackEditor` 내부 컨트롤(버튼/select/input)은 `e.stopPropagation()`으로 포커스 토글과 충돌하지 않게 한다(기존 TrackHeader와 동일 패턴). `focused`는 이 단계에선 컨테이너 클래스 토글에만 사용(고급 컨트롤 분기는 계획 3).

- [ ] **Step 1: `TrackEditor.tsx` 생성**

`src/ui/TrackEditor.tsx`:
```tsx
import { useState, type CSSProperties } from "react";
import { X } from "@phosphor-icons/react";
import { useStore } from "../store/useStore";
import { BUILTIN_SAMPLES } from "../audio/builtinSamples";
import type { Track, TrackStatus } from "../types";

const STATUSES: TrackStatus[] = ["mute", "listening", "play", "write"];
const STATUS_LABEL: Record<TrackStatus, string> = {
  mute: "뮤트",
  listening: "리스닝",
  play: "플레이",
  write: "라이트",
};

interface TrackEditorProps {
  track: Track;
  focused: boolean;
}

export function TrackEditor({ track, focused }: TrackEditorProps) {
  const setTrackStatus = useStore((s) => s.setTrackStatus);
  const setTrackName = useStore((s) => s.setTrackName);
  const setTrackVolume = useStore((s) => s.setTrackVolume);
  const setTrackSound = useStore((s) => s.setTrackSound);
  const setTrackKeyBinding = useStore((s) => s.setTrackKeyBinding);
  const removeTrack = useStore((s) => s.removeTrack);
  const [capturing, setCapturing] = useState(false);

  function onKeyCapture(e: React.KeyboardEvent) {
    e.preventDefault();
    setTrackKeyBinding(track.id, e.code);
    setCapturing(false);
  }

  return (
    <div
      className={focused ? "track-editor track-editor--focused" : "track-editor"}
      style={{ "--track-color": track.color } as CSSProperties}
    >
      <input
        className="track-editor__name"
        value={track.name}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setTrackName(track.id, e.target.value)}
      />
      <select
        value={track.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setTrackStatus(track.id, e.target.value as TrackStatus)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <select
        value={track.sound.kind === "builtin" ? track.sound.sampleId : ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setTrackSound(track.id, { kind: "builtin", sampleId: e.target.value })}
      >
        {BUILTIN_SAMPLES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        className={capturing ? "keycap keycap--capturing" : "keycap"}
        onKeyDown={capturing ? onKeyCapture : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setCapturing(true);
        }}
        title="클릭 후 키를 누르세요"
      >
        {capturing ? "입력…" : track.keyBinding ?? "키 없음"}
      </button>
      <input
        className="range-fill"
        style={{ "--pct": `${track.volume * 100}%` } as CSSProperties}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
      />
      <button
        className="btn--danger"
        onClick={(e) => {
          e.stopPropagation();
          removeTrack(track.id);
        }}
        title="트랙 삭제"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 통과 확인**

```bash
npx tsc -b
```

- [ ] **Step 3: 커밋**

```bash
git add -A && git commit -m "feat(ui): TrackEditor 좌측 설정 영역(기존 스타일 컨트롤)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `MarkerEditor` — 우측 마커 레인(포커스 SVG / 언포커스 캔버스)

**Files:**
- Create: `src/ui/MarkerEditor.tsx`

계약 §8 `MarkerEditorProps = { track: Track; focused: boolean }`. 동작:
- **포커스 트랙 → SVG 마커**: `useViewport`를 구독해 `Viewport`를 구성하고, `visibleMarkers`로 `[0,width]` 범위 마커만 렌더(가상화). 좌클릭=마커 추가(`xToTime`로 시각 → `addMarker`), 우클릭(`onContextMenu`, `preventDefault`)=`findNearestMarker`로 가장 가까운 마커를 찾아 `removeMarker`. **단, `isMarkerEditingEnabled(mode, track.status)`가 true일 때만 좌/우클릭을 처리**(아니면 무시).
- **언포커스 트랙 → 캔버스 오버뷰**: 가는 세로 틱. `visibleMarkers`로 가시 마커만 그린다(가볍게). 편집 비활성.

폭은 `useViewport`의 `containerWidthPx`를 사용한다(계획 1이 ResizeObserver로 갱신). SVG `viewBox`/좌표는 px 단위로 직접 그린다. 마커 x는 `visibleMarkers`가 돌려준 값을 사용. `addMarker`로 추가할 시각은 클릭 위치 px를 `xToTime(x, vp)`로 변환한다(클릭 좌표는 `getBoundingClientRect`로 레인 로컬 px 산출). 우클릭 tolerance는 픽셀 기준이 아니라 시간 기준으로 환산: `toleranceMs = HIT_TOLERANCE_PX / vp.pxPerMs`(pxPerMs=0 방지: `vp.pxPerMs > 0`일 때만).

- [ ] **Step 1: `MarkerEditor.tsx` 생성**

`src/ui/MarkerEditor.tsx`:
```tsx
import { useEffect, useRef, type CSSProperties } from "react";
import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { xToTime, type Viewport } from "../timeline/viewportMath";
import {
  isMarkerEditingEnabled,
  visibleMarkers,
  findNearestMarker,
} from "../timeline/markerMath";
import type { Track } from "../types";

interface MarkerEditorProps {
  track: Track;
  focused: boolean;
}

const HIT_TOLERANCE_PX = 8;
const OVERVIEW_HEIGHT = 28;

export function MarkerEditor({ track, focused }: MarkerEditorProps) {
  if (focused) return <FocusedMarkerEditor track={track} />;
  return <OverviewMarkerEditor track={track} />;
}

/** 포커스 트랙: 가상화 SVG. 좌클릭 추가 / 우클릭 삭제(레코드 동작에서만). */
function FocusedMarkerEditor({ track }: { track: Track }) {
  const mode = useStore((s) => s.mode);
  const addMarker = useStore((s) => s.addMarker);
  const removeMarker = useStore((s) => s.removeMarker);

  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const vp: Viewport = { pxPerMs, scrollLeftPx, containerWidthPx };
  const editable = isMarkerEditingEnabled(mode, track.status);
  const visible = visibleMarkers(track.markers, vp, containerWidthPx);

  const ref = useRef<SVGSVGElement>(null);

  function localX(clientX: number): number {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? clientX - rect.left : 0;
  }

  function onClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!editable || pxPerMs <= 0) return;
    const timeMs = xToTime(localX(e.clientX), vp);
    addMarker(track.id, timeMs);
  }

  function onContextMenu(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();
    if (!editable || pxPerMs <= 0) return;
    const timeMs = xToTime(localX(e.clientX), vp);
    const toleranceMs = HIT_TOLERANCE_PX / pxPerMs;
    const hit = findNearestMarker(track.markers, timeMs, toleranceMs);
    if (hit) removeMarker(track.id, hit.id);
  }

  return (
    <svg
      ref={ref}
      className={editable ? "marker-editor marker-editor--editable" : "marker-editor"}
      width={containerWidthPx}
      height="100%"
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ "--track-color": track.color } as CSSProperties}
    >
      {visible.map(({ marker, x }) => (
        <circle key={marker.id} cx={x} cy="50%" r={5} fill={track.color} />
      ))}
    </svg>
  );
}

/** 언포커스 트랙: 캔버스 오버뷰(가는 틱). 편집 비활성. */
function OverviewMarkerEditor({ track }: { track: Track }) {
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const vp: Viewport = { pxPerMs, scrollLeftPx, containerWidthPx };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = track.color;
    for (const { x } of visibleMarkers(track.markers, vp, containerWidthPx)) {
      ctx.fillRect(x, 0, 1, canvas.height);
    }
  }, [track.markers, track.color, pxPerMs, scrollLeftPx, containerWidthPx]);

  return (
    <canvas
      ref={canvasRef}
      className="marker-editor marker-editor--overview"
      width={Math.max(1, Math.round(containerWidthPx))}
      height={OVERVIEW_HEIGHT}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
```

- [ ] **Step 2: 타입체크 통과 확인**

```bash
npx tsc -b
```
계획 1의 `useViewport`/`viewportMath` export(`pxPerMs`, `scrollLeftPx`, `containerWidthPx`, `xToTime`, `Viewport`)와 시그니처가 일치하는지 확인한다. 어긋나면 계약 §4·§5에 맞춰 본 파일의 구독 셀렉터를 조정한다(계약이 단일 기준).

- [ ] **Step 3: 커밋**

```bash
git add -A && git commit -m "feat(ui): MarkerEditor 우측 마커 레인(포커스 SVG 가상화/언포커스 캔버스)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `TrackRow` — 행 합성

**Files:**
- Create: `src/ui/TrackRow.tsx`

계약 §8 `TrackRowProps = { track: Track; index: number; focused: boolean }`. `TrackEditor`(좌) + `MarkerEditor`(우)를 한 행으로 합성한다. 시퀀서 자식 렌더와 dnd-kit sortable은 계획 5/4에서 추가하므로 여기선 단순 행이다. 행 전체 클릭 = 포커스(`setSelectedTrack(track.id)`). `index`는 이 단계에선 stripe(짝/홀 배경) 클래스에만 쓰고, 이후 계획 4의 sortable 인덱스로 재사용된다.

- [ ] **Step 1: `TrackRow.tsx` 생성**

`src/ui/TrackRow.tsx`:
```tsx
import { useStore } from "../store/useStore";
import { TrackEditor } from "./TrackEditor";
import { MarkerEditor } from "./MarkerEditor";
import type { Track } from "../types";

interface TrackRowProps {
  track: Track;
  index: number;
  focused: boolean;
}

export function TrackRow({ track, index, focused }: TrackRowProps) {
  const setSelectedTrack = useStore((s) => s.setSelectedTrack);

  const rowClass = [
    "track-row",
    focused ? "track-row--focused" : "track-row--collapsed",
    index % 2 === 0 ? "track-row--even" : "track-row--odd",
  ].join(" ");

  return (
    <div className={rowClass} onClick={() => setSelectedTrack(track.id)}>
      <div className="track-row__editor">
        <TrackEditor track={track} focused={focused} />
      </div>
      <div className="track-row__lane">
        <MarkerEditor track={track} focused={focused} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 통과 확인**

```bash
npx tsc -b
```

- [ ] **Step 3: 커밋**

```bash
git add -A && git commit -m "feat(ui): TrackRow — TrackEditor+MarkerEditor 행 합성

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: styles.css — 행 분해 레이아웃 + 포커스 높이 트랜지션(요구 9)

**Files:**
- Modify: `src/ui/styles.css`

`track-row`를 좌측 고정폭 `track-row__editor`(=`track-editor`) + 우측 신축 `track-row__lane`(=`marker-editor`)의 2컬럼 행으로 재정의한다. 포커스 트랙은 높은 행 + 풀 컨트롤, 언포커스는 낮은 행 + 간결로, `height`에 CSS transition을 건다(요구 9). 기존 `.keycap`/`.range-fill`/색 변수는 그대로 재사용한다. 좌측 컬럼 폭은 기존 `.tracklist` 폭(384px)에서 컨트롤이 들어갈 수 있는 고정폭으로 둔다.

- [ ] **Step 1: 분해 클래스 추가**

`src/ui/styles.css`의 `/* --- 트랙 리스트 --- */` 블록(현재 `.tracklist`~`.track-row input[type="range"]`) 바로 아래에 다음을 추가한다(기존 `.track-row` 규칙은 Task 6에서 정리):
```css
/* --- v2 행 분해: TrackRow = TrackEditor | MarkerEditor --------------------- */
.track-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 40px; /* 언포커스 기본 높이 */
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  overflow: hidden;
  transition: height 0.18s ease, background 0.15s ease;
}
.track-row--even {
  background: #130d33;
}
.track-row--odd {
  background: #171041;
}
.track-row:hover {
  background: rgba(255, 255, 255, 0.03);
}
.track-row--focused {
  height: 88px; /* 포커스 확장 */
  background: rgba(255, 255, 255, 0.04);
}

.track-row__editor {
  width: 384px;
  flex: none;
  border-right: 1px solid var(--line);
  overflow: hidden;
}
.track-row__lane {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.track-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 10px 0 8px;
  border-left: 4px solid var(--track-color, var(--purple));
}
.track-editor__name {
  width: 52px;
  flex: none;
  padding: 5px 6px;
  font-size: 12px;
}
.track-editor select {
  flex: none;
  width: 58px;
  font-size: 11px;
  padding: 5px 18px 5px 6px;
}
.track-editor input[type="range"] {
  width: 40px;
  flex: none;
}

.marker-editor {
  width: 100%;
  height: 100%;
  display: block;
}
.marker-editor--editable {
  cursor: crosshair;
}
.marker-editor--overview {
  opacity: 0.7;
}
```

- [ ] **Step 2: 빌드 무결성 확인(스타일은 브라우저 검증 대상)**

```bash
npx tsc -b
```
CSS 자체는 타입체크 대상이 아니므로, 실제 레이아웃·포커스 높이 트랜지션은 Task 7의 브라우저 검증에서 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add -A && git commit -m "style(ui): TrackRow 2컬럼 레이아웃 + 포커스 높이 트랜지션

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `Editor` 결선 + `TrackList`/`TrackHeader` 삭제

**Files:**
- Modify: `src/ui/Editor.tsx`
- Modify: `src/ui/styles.css` (구식 `.track-row__name`/`.track-row select`/`.track-row input[type="range"]`/`.track-row--selected` 제거)
- Delete: `src/ui/TrackList.tsx`, `src/ui/TrackHeader.tsx`

`Editor`가 트랙별 `TrackRow`를 렌더하도록 수정한다. 포커스 여부는 `selectedTrackId === track.id`. 마커 클릭 핸들링은 이제 `MarkerEditor`가 store 액션으로 직접 처리하므로, `Editor`의 `handleLaneClick`/`onLaneClick` 경로는 제거한다. 좌측 고정 컬럼(TrackEditor)과 우측 arrange 영역(MarkerEditor)이 같은 트랙 순서·같은 행 높이로 세로 정렬되도록, `TrackRow`가 좌/우를 한 행 안에 함께 렌더한다(계약 §4 "좌/우 2컬럼 동기"). 트랙 추가 버튼(기존 `TrackList` 헤더)은 트랙 목록 위 헤더로 옮긴다.

> 참고: 계획 1이 이미 `Editor`를 `Timeline`/`BaseFlowLane`/`PlayheadOverlay`로 재구성했을 수 있다. 그 경우 본 Task는 "트랙 행 렌더 부분"만 `TrackRow` 목록으로 교체하고, 베이스 레인/플레이헤드/뷰포트 결선은 계획 1 산출물을 그대로 둔다. 아래 코드는 계획 1 미반영(현 v1) 상태 기준의 최소 결선 예시이며, 계획 1이 반영돼 있으면 트랙 목록 렌더 블록만 이식한다.

- [ ] **Step 1: `Editor.tsx`에서 트랙 행을 `TrackRow`로 렌더**

기존 import 교체:
```tsx
// 제거
import { TrackList } from "./TrackList";
// 추가
import { TrackRow } from "./TrackRow";
import { Plus } from "@phosphor-icons/react";
```

`selectedTrackId` 구독 추가 및 `addTrack` 가져오기(컴포넌트 상단 훅 영역):
```tsx
const selectedTrackId = useStore((s) => s.selectedTrackId);
const addTrack = useStore((s) => s.addTrack);
```

`handleLaneClick` 함수와 `onLaneClick` prop 사용을 제거한다(마커 추가는 `MarkerEditor`가 담당). `editor-main` 영역의 `<TrackList />` + `TimelineCanvas` 렌더를 트랙 행 목록으로 교체한다(계획 1 미반영 기준):
```tsx
<div className="editor-main">
  <div className="track-rows">
    <div className="track-rows__head">
      <h2 className="section-title">트랙</h2>
      <button className="btn--primary" onClick={addTrack}>
        <Plus size={15} weight="bold" />
        트랙
      </button>
    </div>
    {tracks.map((t, index) => (
      <TrackRow
        key={t.id}
        track={t}
        index={index}
        focused={selectedTrackId === t.id}
      />
    ))}
  </div>
</div>
```
계획 1이 이미 반영돼 `Timeline` 컨테이너가 있으면, 위 `tracks.map(...)` 블록만 `Timeline`의 트랙 영역(arrange/좌측 컬럼)에 이식하고 `track-rows` 래퍼는 그 레이아웃에 맞춘다.

- [ ] **Step 2: 사용하지 않는 import/상태 정리**

`TimelineCanvas` import·`resolveTrackBehavior` import·`onSeek`/`region`/`stepCount` 관련 미사용 항목이 본 단계에서 남으면 tsc가 `noUnusedLocals`로 잡는다. 마커 추가 게이팅은 `MarkerEditor`로 옮겨졌으므로 `Editor`에서 `resolveTrackBehavior`/`addMarker` 직접 사용은 제거한다. (시퀀서 `region`/`stepCount`는 계획 5에서 `useEditorUi`로 이전하므로, 본 계획에선 `StepSequencerPanel`이 동작하도록 기존 로컬 상태를 유지해도 무방하다.)

- [ ] **Step 3: 구식 CSS 정리**

`src/ui/styles.css`에서 Task 5와 충돌하는 v1 잔재를 제거한다: `.track-row--selected`, 그리고 v1의 `.track-row__name`/`.track-row select`/`.track-row input[type="range"]`(이제 `.track-editor__name`/`.track-editor select`/`.track-editor input[type="range"]`가 대체). `.tracklist`/`.tracklist__head`는 트랙 목록 헤더용으로 남기되, 새 `.track-rows`/`.track-rows__head` 클래스를 추가하거나 기존 `.tracklist*`를 재명명한다. 충돌·중복 셀렉터가 없도록 한 가지로 통일한다.

- [ ] **Step 4: `TrackList`/`TrackHeader` 삭제**

```bash
git rm src/ui/TrackList.tsx src/ui/TrackHeader.tsx
```

- [ ] **Step 5: 전체 테스트 + 타입체크 통과 확인**

```bash
npm run test:run && npx tsc -b
```
`TrackList`/`TrackHeader`를 import하던 곳이 더 없는지(`grep -rn "TrackList\|TrackHeader" src`) 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "refactor(ui): Editor를 TrackRow 렌더로 전환, TrackList/TrackHeader 삭제

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 브라우저 검증(SVG/캔버스 렌더 + 포커스 애니메이션)

**Files:**
- (검증 전용; 무인 실행 시) Create/Modify: `IMPLEMENTATION_NOTES.md`

단위테스트로 못 잡는 시각 동작을 헤드리스 Chrome 드라이버(`/tmp/bof-driver`)로 확인한다. 무인 실행이면 "사람 검증 필요"로 `IMPLEMENTATION_NOTES.md`에 기록하고 **성공을 꾸미지 않는다**(계약 §0).

검증 항목:
1. 트랙 행이 좌(TrackEditor) / 우(MarkerEditor) 2컬럼으로 세로 정렬되어 렌더되는가.
2. 트랙 클릭 시 포커스 트랙이 높은 행으로 확장되고(높이 트랜지션), 다른 트랙은 축소되는가(요구 9).
3. 포커스 트랙 + 레코드 모드 + write 상태에서 마커 레인 좌클릭 시 SVG 마커가 추가, 우클릭 시 가장 가까운 마커가 삭제되는가(요구 5). 레코드 동작이 아니면 클릭이 무시되는가.
4. 언포커스 트랙은 캔버스 오버뷰(가는 틱)로 가볍게 렌더되는가.
5. 가시영역 가상화: 스크롤/줌 시 `[0,width]` 범위 마커만 보이는가(계획 1 뷰포트와 결합 확인).

- [ ] **Step 1: 헤드리스 드라이버로 단계별 스크린샷**

`/tmp/bof-driver`로 위 5개 항목을 캡처해 시각 확인한다.

- [ ] **Step 2: 무인 실행이면 미검증 기록**

드라이버 사용 불가/무인 실행이면 `IMPLEMENTATION_NOTES.md`에 아래를 추가한다(성공으로 위장 금지):
```md
## 계획 v2-2 브라우저 검증 — 사람 검증 필요
- TrackRow 2컬럼 정렬 / 포커스 높이 트랜지션(요구 9) 미검증
- MarkerEditor 좌클릭 추가·우클릭 삭제(요구 5, 레코드 동작 게이팅) 미검증
- 언포커스 캔버스 오버뷰 / 가시영역 가상화(스크롤·줌) 미검증
- 순수 로직(markerMath)·타입은 단위테스트/tsc로 통과 확인됨.
```

- [ ] **Step 3: 최종 그린 확인**

```bash
npm run test:run && npx tsc -b
```

- [ ] **Step 4: 커밋(노트 기록 시)**

```bash
git add -A && git commit -m "docs: 계획 v2-2 브라우저 검증 노트(미검증 항목 기록)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (계약·스펙 대조)

- **요구 5(좌/우클릭 편집, 레코드 동작에서만):** Task 3 `MarkerEditor`가 좌클릭=`addMarker`, 우클릭(`onContextMenu`+`preventDefault`)=`findNearestMarker`→`removeMarker`. 게이팅은 Task 1 `isMarkerEditingEnabled`(=`resolveTrackBehavior === "record"`)로 분리·TDD 검증. ✔
- **요구 9(포커스 확장/축소 + 애니메이션):** Task 5에서 `.track-row--focused` 높이 88px / 언포커스 40px + `transition: height`. Task 4에서 행 클릭=포커스(`setSelectedTrack`), Task 6에서 `focused = selectedTrackId === t.id`. ✔
- **요구 11(TrackEditor/MarkerEditor 분리):** Task 2/3에서 컴포넌트 경계 확정, Task 4 `TrackRow`가 합성. ✔
- **계약 §8 props:** `TrackRowProps`/`TrackEditorProps`/`MarkerEditorProps` 시그니처 정확히 일치. ✔
- **계약 §3 store 액션:** 마커 추가/삭제는 기존 `addMarker`/`removeMarker`(+옵션 `toggleMarkerAt`)만 사용, 신규 액션 추가 없음(이 계획 범위 외). ✔
- **계약 §9 가상화:** `visibleMarkers`가 `timeToX ∈ [0,width]`만 반환, 포커스=SVG / 언포커스=캔버스. ✔
- **삭제(§1):** Task 6에서 `TrackList`/`TrackHeader` `git rm`. ✔
- **분리 가능한 순수 로직 TDD:** Task 1에서 게이팅·가상화·우클릭 대상 찾기 단위테스트. SVG/캔버스/애니메이션은 Task 7 브라우저 검증/미검증 기록. ✔
- **계획 1 의존:** `useViewport`/`viewportMath` export에 `MarkerEditor`를 결선, 어긋나면 계약 기준으로 셀렉터 조정(Task 3 Step 2 명시). 시퀀서 자식·dnd-kit은 범위 밖(계획 4/5). ✔
- **각 Task 종료 시 `npm run test:run && npx tsc -b`:** Task 1·6에 명시, 코드 Task(2·3·4·5)는 `npx tsc -b` + 전체 그린은 Task 6에서 확정. ✔
- **any 미사용:** `CSSProperties` 캐스팅 외 명시 타입만 사용. ✔
```
