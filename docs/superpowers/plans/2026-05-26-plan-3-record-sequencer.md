# 계획 3 — 마커 작성(레코드 모드 + 스텝 시퀀서) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세 가지 방식(스텝 시퀀서·레인 마우스 클릭·레코드 중 키 입력)으로 마커를 작성할 수 있게 한다. 전역 모드 전환을 도입하고, 시퀀서는 이동/크기조절 구간 + 범위지정 반복 채우기를 지원한다.

**Architecture:** 시퀀서 계산(칸 시각·반복 타일링·그리드 정렬 read-back)은 순수함수 `sequencer.ts`로 TDD. 모든 입력 방식은 동일한 마커를 생성한다(찍기 모델). 레코드 모드는 `write` 트랙만 인터랙티브(레인 클릭·키 입력 기록), 그 외 트랙은 자동재생(계획 2 스케줄러 재사용). 반복 채우기는 패턴을 구간 길이 단위로 실제 마커로 복제한다.

**Tech Stack:** 계획 1·2와 동일.

**선행 조건:** 계획 2 완료 (resolveTrackBehavior, 스토어 마커 액션, TimelineCanvas 레인, runtime 스케줄러 존재).

---

## 파일 구조 (이 계획에서 생성/수정)

```
src/
  domain/
    sequencer.ts            생성: 칸 시각/반복 타일링/정렬 read-back
    sequencer.test.ts       생성
  store/
    useStore.ts             수정: selectedTrackId, toggleMarkerAt, removeMarkersInRange, addMarkersBulk
    useStore.test.ts        수정: 신규 액션 테스트
  input/
    KeyboardController.ts    생성: 레코드 중 키→마커
  render/
    TimelineCanvas.tsx      수정: 구간/그리드 오버레이, 레인 클릭 게이팅 콜백 유지
  ui/
    ModeSwitcher.tsx        생성: 전역 모드 전환
    StepSequencerPanel.tsx  생성: 구간/칸/반복 UI
    TrackHeader.tsx         수정: 키 바인딩 설정 + 선택
    Editor.tsx              수정: 모드/시퀀서/키보드 결선, 레인 클릭 게이팅
```

---

## Task 1: 시퀀서 순수 계산

**Files:**
- Create: `src/domain/sequencer.ts`, `src/domain/sequencer.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/sequencer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  stepTimes,
  activeStepsToMarkerTimes,
  tilePattern,
  markersAlignedToSteps,
} from "./sequencer";

describe("stepTimes", () => {
  it("구간을 stepCount개로 균등분할한 각 칸 시작 시각", () => {
    expect(Array.from(stepTimes(0, 800, 4))).toEqual([0, 200, 400, 600]);
  });
  it("offset 구간도 정확", () => {
    expect(Array.from(stepTimes(1000, 1800, 4))).toEqual([1000, 1200, 1400, 1600]);
  });
});

describe("activeStepsToMarkerTimes", () => {
  it("켜진 칸 인덱스의 시각만 반환", () => {
    expect(activeStepsToMarkerTimes(0, 800, 4, [0, 2])).toEqual([0, 400]);
  });
});

describe("tilePattern", () => {
  it("count: 패턴을 구간 길이만큼 N회 복제", () => {
    // 구간 [0,400), 패턴 0,200 → 3회 → 0,200,400,600,800,1000
    expect(tilePattern([0, 200], 0, 400, { kind: "count", count: 3 })).toEqual([
      0, 200, 400, 600, 800, 1000,
    ]);
  });
  it("until: 지정 지점 이전까지만", () => {
    // 구간 [0,400), 패턴 0,200 → until 900 → 0,200,400,600,800
    expect(tilePattern([0, 200], 0, 400, { kind: "until", untilMs: 900 })).toEqual([
      0, 200, 400, 600, 800,
    ]);
  });
  it("toEnd: endMs 이전까지", () => {
    expect(tilePattern([0], 0, 400, { kind: "toEnd", endMs: 1000 })).toEqual([0, 400, 800]);
  });
  it("offset 구간의 패턴도 상대오프셋 유지하며 타일링", () => {
    // 구간 [1000,1400), 패턴 1000,1300 → count 2 → 1000,1300,1400,1700
    expect(tilePattern([1000, 1300], 1000, 400, { kind: "count", count: 2 })).toEqual([
      1000, 1300, 1400, 1700,
    ]);
  });
});

describe("markersAlignedToSteps", () => {
  it("각 칸에 허용오차 내 마커가 있으면 true", () => {
    const steps = [0, 200, 400, 600];
    const markers = [5, 401]; // 0칸(±10), 2칸(±10)
    expect(markersAlignedToSteps(markers, steps, 10)).toEqual([true, false, true, false]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/sequencer.test.ts`
Expected: FAIL — 함수 미정의.

- [ ] **Step 3: 구현**

`src/domain/sequencer.ts`:
```ts
export type RepeatTarget =
  | { kind: "count"; count: number }
  | { kind: "until"; untilMs: number }
  | { kind: "toEnd"; endMs: number };

/** 구간을 stepCount개로 균등분할한 각 칸의 시작 시각(ms). */
export function stepTimes(regionStartMs: number, regionEndMs: number, stepCount: number): number[] {
  const span = (regionEndMs - regionStartMs) / stepCount;
  const out: number[] = [];
  for (let i = 0; i < stepCount; i++) out.push(regionStartMs + i * span);
  return out;
}

/** 켜진 칸 인덱스들의 시각만 반환. */
export function activeStepsToMarkerTimes(
  regionStartMs: number,
  regionEndMs: number,
  stepCount: number,
  activeSteps: number[],
): number[] {
  const all = stepTimes(regionStartMs, regionEndMs, stepCount);
  return activeSteps
    .filter((i) => i >= 0 && i < stepCount)
    .sort((a, b) => a - b)
    .map((i) => all[i]);
}

/** 패턴(구간 내 절대 시각들)을 구간 길이 단위로 복제한다. 찍기 모델. */
export function tilePattern(
  patternTimes: number[],
  regionStartMs: number,
  regionLengthMs: number,
  target: RepeatTarget,
): number[] {
  const offsets = patternTimes.map((t) => t - regionStartMs);
  let copies: number;
  let limit = Infinity;
  if (target.kind === "count") {
    copies = Math.max(0, Math.floor(target.count));
  } else {
    limit = target.kind === "until" ? target.untilMs : target.endMs;
    copies = Math.max(0, Math.ceil((limit - regionStartMs) / regionLengthMs));
  }
  const out: number[] = [];
  for (let k = 0; k < copies; k++) {
    const base = regionStartMs + k * regionLengthMs;
    for (const off of offsets) {
      const t = base + off;
      if (t < limit) out.push(t);
    }
  }
  return out.sort((a, b) => a - b);
}

/** 각 칸 시각에 허용오차 내 마커가 존재하는지(read-back). */
export function markersAlignedToSteps(
  markerTimes: number[],
  steps: number[],
  toleranceMs: number,
): boolean[] {
  return steps.map((s) => markerTimes.some((m) => Math.abs(m - s) <= toleranceMs));
}
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `npx vitest run src/domain/sequencer.test.ts`
Expected: PASS (8 tests).
```bash
git add src/domain/sequencer.ts src/domain/sequencer.test.ts
git commit -m "feat: 시퀀서 순수 계산 (칸/반복 타일링/정렬)"
```

---

## Task 2: 스토어 — 선택 트랙 + 마커 토글/범위삭제/벌크추가

**Files:**
- Modify: `src/store/useStore.ts`, `src/store/useStore.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/store/useStore.test.ts`에 추가:
```ts
describe("useStore 시퀀서 보조 액션", () => {
  beforeEach(() => {
    useStore.setState({
      project: sampleProject(),
      playing: false,
      playheadMs: 0,
      mode: "listening",
      selectedTrackId: null,
    });
    useStore.getState().addTrack();
  });

  function trackId() {
    return useStore.getState().project!.tracks[0].id;
  }

  it("setSelectedTrack은 선택 트랙을 기록", () => {
    useStore.getState().setSelectedTrack(trackId());
    expect(useStore.getState().selectedTrackId).toBe(trackId());
  });

  it("toggleMarkerAt: 없으면 추가, 허용오차 내 있으면 제거", () => {
    const id = trackId();
    useStore.getState().toggleMarkerAt(id, 200, 10);
    expect(useStore.getState().project!.tracks[0].markers.length).toBe(1);
    useStore.getState().toggleMarkerAt(id, 205, 10); // 오차 내 → 제거
    expect(useStore.getState().project!.tracks[0].markers.length).toBe(0);
  });

  it("removeMarkersInRange: [from,to] 내 마커 제거", () => {
    const id = trackId();
    [100, 300, 500].forEach((t) => useStore.getState().addMarker(id, t));
    useStore.getState().removeMarkersInRange(id, 200, 400);
    expect(useStore.getState().project!.tracks[0].markers.map((m) => m.timeMs)).toEqual([100, 500]);
  });

  it("addMarkersBulk: 여러 마커를 시각순으로 추가", () => {
    const id = trackId();
    useStore.getState().addMarkersBulk(id, [400, 100, 250]);
    expect(useStore.getState().project!.tracks[0].markers.map((m) => m.timeMs)).toEqual([
      100, 250, 400,
    ]);
  });
});
```

> 기존 setState 호출들에도 `selectedTrackId: null`을 포함하도록 보강한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: FAIL — 신규 액션/필드 미정의.

- [ ] **Step 3: 스토어 확장**

`src/store/useStore.ts`의 `StoreState` 인터페이스에 추가:
```ts
  selectedTrackId: string | null;
  setSelectedTrack: (trackId: string | null) => void;
  toggleMarkerAt: (trackId: string, timeMs: number, toleranceMs: number) => void;
  removeMarkersInRange: (trackId: string, fromMs: number, toMs: number) => void;
  addMarkersBulk: (trackId: string, timesMs: number[]) => void;
```

초기 상태에 `selectedTrackId: null` 추가. 액션 구현 추가(`mapTrack`/`mutate`/`newId` 재사용):
```ts
  setSelectedTrack: (trackId) => set({ selectedTrackId: trackId }),

  toggleMarkerAt: (trackId, timeMs, toleranceMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => {
          const hit = t.markers.find((m) => Math.abs(m.timeMs - timeMs) <= toleranceMs);
          if (hit) {
            return { ...t, markers: t.markers.filter((m) => m.id !== hit.id) };
          }
          const markers = [...t.markers, { id: newId(), timeMs }].sort((a, b) => a.timeMs - b.timeMs);
          return { ...t, markers };
        }),
      ),
    ),

  removeMarkersInRange: (trackId, fromMs, toMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => ({
          ...t,
          markers: t.markers.filter((m) => m.timeMs < fromMs || m.timeMs > toMs),
        })),
      ),
    ),

  addMarkersBulk: (trackId, timesMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => {
          const added = timesMs.map((timeMs) => ({ id: newId(), timeMs }));
          const markers = [...t.markers, ...added].sort((a, b) => a.timeMs - b.timeMs);
          return { ...t, markers };
        }),
      ),
    ),
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: PASS (기존 + 신규 4).
```bash
git add src/store/useStore.ts src/store/useStore.test.ts
git commit -m "feat: 스토어 선택트랙/마커 토글·범위삭제·벌크추가"
```

---

## Task 3: ModeSwitcher UI

**Files:**
- Create: `src/ui/ModeSwitcher.tsx`

- [ ] **Step 1: 구현**

`src/ui/ModeSwitcher.tsx`:
```tsx
import { useStore } from "../store/useStore";
import type { GlobalMode } from "../types";

const MODES: { mode: GlobalMode; label: string }[] = [
  { mode: "listening", label: "🎧 리스닝" },
  { mode: "play", label: "🎮 플레이" },
  { mode: "record", label: "⏺ 레코드" },
];

export function ModeSwitcher() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {MODES.map((m) => (
        <button
          key={m.mode}
          onClick={() => setMode(m.mode)}
          style={{
            fontWeight: mode === m.mode ? 700 : 400,
            background: mode === m.mode ? "#2a3550" : undefined,
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/ui/ModeSwitcher.tsx
git commit -m "feat: ModeSwitcher (전역 모드 전환)"
```

---

## Task 4: 키보드 입력 컨트롤러 (레코드 중 키→마커)

> 레코드 모드에서 `write` 트랙의 바인딩 키를 누르면 현재 플레이헤드 시각에 마커를 기록하고 소리 피드백. (플레이 모드 채점은 계획 4에서 같은 컨트롤러에 추가)

**Files:**
- Create: `src/input/KeyboardController.ts`

- [ ] **Step 1: 구현**

`src/input/KeyboardController.ts`:
```ts
import { useStore } from "../store/useStore";
import { resolveTrackBehavior } from "../domain/mode";
import { getEngine, getLibrary } from "../audio/runtime";
import { playSample } from "../audio/SamplePlayer";

/** 전역 키보드 리스너를 부착하고 해제 함수를 반환. */
export function startKeyboard(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
      return; // 입력 필드 타이핑 중에는 무시
    }
    const state = useStore.getState();
    const project = state.project;
    if (!project) return;

    const matched = project.tracks.filter((t) => t.keyBinding === e.code);
    if (matched.length === 0) return;

    for (const track of matched) {
      const behavior = resolveTrackBehavior(state.mode, track.status);
      if (behavior === "record") {
        useStore.getState().addMarker(track.id, state.playheadMs);
        const buffer = getLibrary().get(track.sound);
        if (buffer) {
          const eng = getEngine();
          playSample(eng.ctx, buffer, eng.masterGain, eng.ctx.currentTime, track.volume);
        }
      }
      // behavior === "perform" 은 계획 4(채점)에서 처리
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/input/KeyboardController.ts
git commit -m "feat: 레코드 모드 키 입력→마커 기록"
```

---

## Task 5: TrackHeader — 키 바인딩 설정 + 트랙 선택

**Files:**
- Modify: `src/ui/TrackHeader.tsx`

- [ ] **Step 1: 키 캡처 + 선택 추가**

`src/ui/TrackHeader.tsx`를 수정한다. import에 추가:
```ts
import { useState } from "react";
```

`TrackHeader` 컴포넌트 내부에 선택/키캡처 로직을 추가하고, 최상위 `div`에 클릭 시 선택, 키 버튼을 넣는다. 컴포넌트 전체를 다음으로 교체:
```tsx
import { useState } from "react";
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

export function TrackHeader({ track }: { track: Track }) {
  const setTrackStatus = useStore((s) => s.setTrackStatus);
  const setTrackName = useStore((s) => s.setTrackName);
  const setTrackVolume = useStore((s) => s.setTrackVolume);
  const setTrackSound = useStore((s) => s.setTrackSound);
  const setTrackKeyBinding = useStore((s) => s.setTrackKeyBinding);
  const removeTrack = useStore((s) => s.removeTrack);
  const setSelectedTrack = useStore((s) => s.setSelectedTrack);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const [capturing, setCapturing] = useState(false);

  function onKeyCapture(e: React.KeyboardEvent) {
    e.preventDefault();
    setTrackKeyBinding(track.id, e.code);
    setCapturing(false);
  }

  const selected = selectedTrackId === track.id;

  return (
    <div
      onClick={() => setSelectedTrack(track.id)}
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        height: 40,
        padding: "0 6px",
        borderLeft: `4px solid ${track.color}`,
        background: selected ? "#1d2433" : undefined,
      }}
    >
      <input
        value={track.name}
        onChange={(e) => setTrackName(track.id, e.target.value)}
        style={{ width: 70 }}
      />
      <select
        value={track.status}
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
        onChange={(e) => setTrackSound(track.id, { kind: "builtin", sampleId: e.target.value })}
      >
        {BUILTIN_SAMPLES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        onKeyDown={capturing ? onKeyCapture : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setCapturing(true);
        }}
        title="클릭 후 키를 누르세요"
      >
        {capturing ? "키 입력..." : track.keyBinding ?? "키 없음"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
        style={{ width: 50 }}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeTrack(track.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/ui/TrackHeader.tsx
git commit -m "feat: 트랙 키 바인딩 설정 및 트랙 선택"
```

---

## Task 6: TimelineCanvas — 구간/그리드 오버레이

**Files:**
- Modify: `src/render/TimelineCanvas.tsx`

- [ ] **Step 1: region/steps props 추가 및 렌더**

`src/render/TimelineCanvas.tsx`의 `Props`에 추가:
```ts
  region: { startMs: number; endMs: number } | null;
  stepCount: number;
```

`useEffect` 렌더 본문에서 플레이헤드 그리기 **직전**에 구간/그리드 오버레이를 추가:
```ts
    // 구간 + 그리드 오버레이
    if (region && durationMs > 0) {
      const x0 = (region.startMs / durationMs) * w;
      const x1 = (region.endMs / durationMs) * w;
      ctx.fillStyle = "rgba(255,216,107,0.10)";
      ctx.fillRect(x0, 0, x1 - x0, canvas.height);
      ctx.strokeStyle = "rgba(255,216,107,0.5)";
      ctx.beginPath();
      ctx.moveTo(x0, 0); ctx.lineTo(x0, canvas.height);
      ctx.moveTo(x1, 0); ctx.lineTo(x1, canvas.height);
      ctx.stroke();
      // 칸 경계
      ctx.strokeStyle = "rgba(255,216,107,0.25)";
      for (let i = 1; i < stepCount; i++) {
        const gx = x0 + ((x1 - x0) * i) / stepCount;
        ctx.beginPath();
        ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height);
        ctx.stroke();
      }
    }
```

`useEffect` 의존성 배열에 `region, stepCount` 추가.

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 호출부(Editor) 미수정으로 에러 가능 — Task 8까지 묶어 진행. 우선 커밋:
```bash
git add src/render/TimelineCanvas.tsx
git commit -m "feat: TimelineCanvas 구간/그리드 오버레이"
```

---

## Task 7: StepSequencerPanel

> 선택된 트랙에 대해 구간/칸수/반복 대상을 다루는 패널. read-back으로 칸 on/off를 표시, 토글은 마커 추가/삭제, 반복 채우기는 패턴을 타일링해 벌크 추가.

**Files:**
- Create: `src/ui/StepSequencerPanel.tsx`

- [ ] **Step 1: 구현**

`src/ui/StepSequencerPanel.tsx`:
```tsx
import { useState } from "react";
import { useStore } from "../store/useStore";
import {
  stepTimes,
  activeStepsToMarkerTimes,
  markersAlignedToSteps,
  tilePattern,
  type RepeatTarget,
} from "../domain/sequencer";

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
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const durationMs = useStore((s) => s.project?.baseFlow.durationMs ?? 0);
  const toggleMarkerAt = useStore((s) => s.toggleMarkerAt);
  const addMarkersBulk = useStore((s) => s.addMarkersBulk);
  const removeMarkersInRange = useStore((s) => s.removeMarkersInRange);

  const [repeatKind, setRepeatKind] = useState<"count" | "until" | "toEnd">("toEnd");
  const [count, setCount] = useState(4);
  const [untilMs, setUntilMs] = useState(90000);

  const track = tracks.find((t) => t.id === selectedTrackId) ?? null;
  if (!track) {
    return <div style={{ padding: 8 }}>트랙을 선택하면 스텝 시퀀서가 표시됩니다.</div>;
  }

  const steps = stepTimes(region.startMs, region.endMs, stepCount);
  const stepSpacing = (region.endMs - region.startMs) / stepCount;
  const tolerance = Math.min(20, stepSpacing / 2);
  const active = markersAlignedToSteps(
    track.markers.map((m) => m.timeMs),
    steps,
    tolerance,
  );

  function fill() {
    const activeIdx = active.flatMap((on, i) => (on ? [i] : []));
    const pattern = activeStepsToMarkerTimes(region.startMs, region.endMs, stepCount, activeIdx);
    if (pattern.length === 0) return;
    const regionLen = region.endMs - region.startMs;
    let target: RepeatTarget;
    if (repeatKind === "count") target = { kind: "count", count };
    else if (repeatKind === "until") target = { kind: "until", untilMs };
    else target = { kind: "toEnd", endMs: durationMs };
    const tiled = tilePattern(pattern, region.startMs, regionLen, target);
    // 첫 구간(원본 패턴)은 이미 존재하므로 그 이후만 추가
    const toAdd = tiled.filter((t) => t >= region.endMs);
    addMarkersBulk(track!.id, toAdd);
  }

  function clearAndRefill() {
    const regionLen = region.endMs - region.startMs;
    let endLimit: number;
    if (repeatKind === "count") endLimit = region.startMs + regionLen * count;
    else if (repeatKind === "until") endLimit = untilMs;
    else endLimit = durationMs;
    removeMarkersInRange(track!.id, region.endMs, endLimit);
    fill();
  }

  return (
    <div style={{ padding: 8, borderTop: "1px solid #222833" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <strong>스텝 시퀀서 — {track.name}</strong>
        <label>
          구간 시작(ms)
          <input
            type="number"
            value={Math.round(region.startMs)}
            onChange={(e) => setRegion({ ...region, startMs: Number(e.target.value) })}
            style={{ width: 80 }}
          />
        </label>
        <label>
          끝(ms)
          <input
            type="number"
            value={Math.round(region.endMs)}
            onChange={(e) => setRegion({ ...region, endMs: Number(e.target.value) })}
            style={{ width: 80 }}
          />
        </label>
        <label>
          칸수
          <input
            type="number"
            min={1}
            max={64}
            value={stepCount}
            onChange={(e) => setStepCount(Math.max(1, Number(e.target.value)))}
            style={{ width: 50 }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        {steps.map((t, i) => (
          <button
            key={i}
            onClick={() => toggleMarkerAt(track.id, t, tolerance)}
            style={{
              flex: 1,
              height: 32,
              background: active[i] ? track.color : "#1a1f29",
              border: "1px solid #2a3140",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span>반복:</span>
        <select value={repeatKind} onChange={(e) => setRepeatKind(e.target.value as typeof repeatKind)}>
          <option value="toEnd">곡 끝까지</option>
          <option value="count">N회</option>
          <option value="until">지정 지점까지</option>
        </select>
        {repeatKind === "count" && (
          <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 60 }} />
        )}
        {repeatKind === "until" && (
          <input type="number" min={0} value={untilMs} onChange={(e) => setUntilMs(Number(e.target.value))} style={{ width: 90 }} />
        )}
        <button onClick={fill}>⟳ 반복 채우기</button>
        <button onClick={clearAndRefill}>범위 지우고 다시 채우기</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/ui/StepSequencerPanel.tsx
git commit -m "feat: StepSequencerPanel (구간/칸/반복 채우기)"
```

---

## Task 8: Editor 통합 (모드/시퀀서/키보드/레인 클릭 게이팅)

**Files:**
- Modify: `src/ui/Editor.tsx`

- [ ] **Step 1: 교체 구현**

`src/ui/Editor.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getEngine, loadBaseFlow, seek } from "../audio/runtime";
import { getAsset } from "../persistence/assets";
import { computePeaks } from "../render/waveform";
import { resolveTrackBehavior } from "../domain/mode";
import { TimelineCanvas } from "../render/TimelineCanvas";
import { TransportBar } from "./TransportBar";
import { TrackList } from "./TrackList";
import { ModeSwitcher } from "./ModeSwitcher";
import { StepSequencerPanel } from "./StepSequencerPanel";
import { startKeyboard } from "../input/KeyboardController";

interface Props {
  onExit: () => void;
}

export function Editor({ onExit }: Props) {
  const project = useStore((s) => s.project);
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const mode = useStore((s) => s.mode);
  const addMarker = useStore((s) => s.addMarker);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [region, setRegion] = useState({ startMs: 0, endMs: 4000 });
  const [stepCount, setStepCount] = useState(8);

  useEffect(() => {
    const stop = startKeyboard();
    return stop;
  }, []);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    (async () => {
      await loadBaseFlow(project.baseFlow.assetId);
      const asset = await getAsset(project.baseFlow.assetId);
      if (!asset || cancelled) return;
      const buffer = await getEngine().decode(asset.blob);
      if (cancelled) return;
      setPeaks(computePeaks(buffer.getChannelData(0), 1000));
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  if (!project) return null;

  function handleLaneClick(trackId: string, timeMs: number) {
    // 레코드 모드 + write 트랙에서만 클릭으로 마커 추가
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    if (resolveTrackBehavior(mode, track.status) === "record") {
      addMarker(trackId, timeMs);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: 8 }}>
        <strong>{project.name}</strong>
        <ModeSwitcher />
        <button onClick={onExit}>← 목록</button>
      </div>
      <TransportBar />
      <div style={{ display: "flex" }}>
        <TrackList />
        <div style={{ flex: 1 }}>
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
      <StepSequencerPanel
        region={region}
        setRegion={setRegion}
        stepCount={stepCount}
        setStepCount={setStepCount}
      />
    </div>
  );
}
```

- [ ] **Step 2: 전체 테스트 + 타입체크**

Run: `npm run test:run && npx tsc -b`
Expected: 모든 테스트 PASS, 타입 에러 없음.

- [ ] **Step 3: 수동 검증 (브라우저)**

Run: `npm run dev`
확인 항목:
1. 모드 스위처로 리스닝/플레이/레코드 전환.
2. **레코드 모드**에서 트랙 레인 클릭 → 마커 추가됨. 리스닝 모드에선 클릭해도 안 추가됨(탐색만).
3. 트랙에 키 바인딩 설정 → 레코드 모드 + 해당 트랙 라이트 상태에서 재생 중 키 누르면 플레이헤드 위치에 마커 기록 + 소리.
4. 트랙 선택 → 하단 스텝 시퀀서에 칸 표시. 구간(시작/끝/칸수) 조정.
5. 칸 토글 → 레인에 마커 반영. "반복 채우기(곡 끝까지/N회/지정 지점)" → 패턴이 타일링되어 마커가 박힘.
6. "범위 지우고 다시 채우기"로 재적용.
7. 새로고침 후 모든 마커 유지.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Editor.tsx
git commit -m "feat: Editor에 모드/시퀀서/키보드 통합 및 레인 클릭 게이팅"
```

---

## Self-Review 결과

- **스펙 커버리지**: 전역 모드 전환(Task 3), 레코드 모드 마우스 클릭(Task 8 게이팅), 레코드 키 입력 오버더빙(Task 4), 스텝 시퀀서 구간/칸/패턴(Task 1,7), 범위지정 반복 채우기 + B 대체 오버라이드(Task 7 clearAndRefill), 구간 이동/크기조절(Task 7 입력 + Task 6 오버레이). ✅
- **플레이스홀더**: 없음.
- **타입 일관성**: `stepTimes/activeStepsToMarkerTimes/tilePattern/markersAlignedToSteps/RepeatTarget`, 스토어 `toggleMarkerAt/removeMarkersInRange/addMarkersBulk/setSelectedTrack/selectedTrackId`, `startKeyboard`, TimelineCanvas의 `region/stepCount` props — 계획 4에서 동일 참조.
- **개선 메모**: 구간 드래그 조작은 현재 숫자 입력으로 제공(Task 7). 캔버스 드래그 핸들은 후속 UX 개선 여지(스펙 §14 수준).
