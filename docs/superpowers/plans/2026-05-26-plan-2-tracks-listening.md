# 계획 2 — 트랙 + 사운드 + 자동재생(리스닝 모드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트랙을 추가하고 사운드를 할당해 마커를 배치하면, 베이스 플로우와 정밀하게 동기 재생되는 리스닝 모드를 완성한다.

**Architecture:** 트랙/마커 상태는 Zustand 스토어에 추가한다. 모드×상태 동작은 순수함수 `resolveTrackBehavior`로 도출. `Scheduler`는 "A Tale of Two Clocks" 룩어헤드 패턴으로, 다가오는 `auto` 트랙 마커를 `AudioContext` 정밀 시각에 예약한다. 사운드는 `SampleLibrary`(내장 CC0 + 업로드)가 디코드해 `SamplePlayer`가 재생. 캔버스는 베이스 레인 아래 트랙 레인과 마커를 그린다.

**Tech Stack:** 계획 1과 동일 (Vite, React, TS, Zustand, idb, Vitest). 신규 에셋: `public/samples/*.ogg` (CC0).

**선행 조건:** 계획 1 완료 (types.ts, runtime.ts, useStore, TimelineCanvas 등 존재).

---

## 파일 구조 (이 계획에서 생성/수정)

```
src/
  domain/
    mode.ts                생성: resolveTrackBehavior
    mode.test.ts           생성
    palette.ts             생성: 트랙 색상 선택
  audio/
    SampleLibrary.ts       생성: 내장+업로드 샘플 디코드/캐시
    builtinSamples.ts      생성: CC0 샘플 레지스트리
    SamplePlayer.ts        생성: 샘플 1회 재생
    Scheduler.ts           생성: 룩어헤드 스케줄러
    Scheduler.test.ts      생성: 순수 로직 테스트
  store/
    useStore.ts            수정: mode/트랙/마커 액션 추가
    useStore.test.ts       수정: 신규 액션 테스트 추가
  audio/
    runtime.ts             수정: 스케줄러 기동/정지 결선
  render/
    TimelineCanvas.tsx     수정: 트랙 레인 + 마커 렌더, 레인 클릭→마커
  ui/
    TrackHeader.tsx        생성: 트랙별 컨트롤
    TrackList.tsx          생성: 트랙 헤더 목록 + 추가 버튼
    Editor.tsx             수정: TrackList 결합
  public/samples/          생성: CC0 원샷 파일들
```

---

## Task 1: 모드×상태 도출 순수함수

**Files:**
- Create: `src/domain/mode.ts`, `src/domain/mode.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/mode.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveTrackBehavior } from "./mode";
import type { GlobalMode, TrackStatus } from "../types";

describe("resolveTrackBehavior", () => {
  it("mute는 모든 모드에서 silent", () => {
    for (const m of ["listening", "play", "record"] as GlobalMode[]) {
      expect(resolveTrackBehavior(m, "mute")).toBe("silent");
    }
  });

  it("리스닝 모드에서는 mute 외 모두 auto", () => {
    expect(resolveTrackBehavior("listening", "listening")).toBe("auto");
    expect(resolveTrackBehavior("listening", "play")).toBe("auto");
    expect(resolveTrackBehavior("listening", "write")).toBe("auto");
  });

  it("플레이 모드: play 상태만 perform, 나머지는 auto", () => {
    expect(resolveTrackBehavior("play", "play")).toBe("perform");
    expect(resolveTrackBehavior("play", "listening")).toBe("auto");
    expect(resolveTrackBehavior("play", "write")).toBe("auto");
  });

  it("레코드 모드: write 상태만 record, 나머지는 auto", () => {
    expect(resolveTrackBehavior("record", "write")).toBe("record");
    expect(resolveTrackBehavior("record", "listening")).toBe("auto");
    expect(resolveTrackBehavior("record", "play")).toBe("auto");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/mode.test.ts`
Expected: FAIL — `resolveTrackBehavior` not defined.

- [ ] **Step 3: 구현**

`src/domain/mode.ts`:
```ts
import type { GlobalMode, TrackStatus } from "../types";

/** 곱셈 모델: 트랙이 현재 모드에서 무슨 동작을 하는지. */
export type TrackBehavior = "silent" | "auto" | "perform" | "record";

export function resolveTrackBehavior(mode: GlobalMode, status: TrackStatus): TrackBehavior {
  if (status === "mute") return "silent";
  if (mode === "play" && status === "play") return "perform";
  if (mode === "record" && status === "write") return "record";
  return "auto";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/domain/mode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/mode.ts src/domain/mode.test.ts
git commit -m "feat: 모드×상태 동작 도출 순수함수"
```

---

## Task 2: 트랙 색상 팔레트

**Files:**
- Create: `src/domain/palette.ts`, `src/domain/palette.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/palette.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickColor, PALETTE } from "./palette";

describe("pickColor", () => {
  it("인덱스를 팔레트 길이로 순환한다", () => {
    expect(pickColor(0)).toBe(PALETTE[0]);
    expect(pickColor(PALETTE.length)).toBe(PALETTE[0]);
    expect(pickColor(PALETTE.length + 1)).toBe(PALETTE[1]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/palette.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/domain/palette.ts`:
```ts
export const PALETTE = ["#6cc4ff", "#ffd86b", "#7bdc9a", "#ff7b7b", "#c08bff", "#ff9f5b"] as const;

export function pickColor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `npx vitest run src/domain/palette.test.ts`
Expected: PASS.
```bash
git add src/domain/palette.ts src/domain/palette.test.ts
git commit -m "feat: 트랙 색상 팔레트"
```

---

## Task 3: 스토어 — 모드/트랙/마커 액션

**Files:**
- Modify: `src/store/useStore.ts`, `src/store/useStore.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/store/useStore.test.ts`에 다음 describe를 추가:
```ts
import type { GlobalMode } from "../types";

describe("useStore 트랙/마커", () => {
  beforeEach(() => {
    useStore.setState({ project: sampleProject(), playing: false, playheadMs: 0, mode: "listening" });
  });

  it("addTrack은 기본 트랙을 추가한다", () => {
    useStore.getState().addTrack();
    const tracks = useStore.getState().project!.tracks;
    expect(tracks.length).toBe(1);
    expect(tracks[0].status).toBe("listening");
    expect(tracks[0].markers).toEqual([]);
  });

  it("setTrackStatus는 해당 트랙 상태를 바꾼다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().setTrackStatus(id, "play");
    expect(useStore.getState().project!.tracks[0].status).toBe("play");
  });

  it("addMarker는 시각순으로 마커를 넣는다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().addMarker(id, 500);
    useStore.getState().addMarker(id, 100);
    const times = useStore.getState().project!.tracks[0].markers.map((m) => m.timeMs);
    expect(times).toEqual([100, 500]);
  });

  it("removeMarker는 해당 마커를 제거한다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().addMarker(id, 100);
    const mid = useStore.getState().project!.tracks[0].markers[0].id;
    useStore.getState().removeMarker(id, mid);
    expect(useStore.getState().project!.tracks[0].markers).toEqual([]);
  });

  it("removeTrack은 트랙을 제거한다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().removeTrack(id);
    expect(useStore.getState().project!.tracks).toEqual([]);
  });

  it("setMode는 전역 모드를 바꾼다", () => {
    useStore.getState().setMode("record" as GlobalMode);
    expect(useStore.getState().mode).toBe("record");
  });
});
```

> 주의: 기존 `useStore.test.ts`의 `beforeEach`가 `mode`를 setState에 포함하도록 보강한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: FAIL — `mode`/`addTrack` 등 미정의.

- [ ] **Step 3: 스토어 확장 구현**

`src/store/useStore.ts`를 다음으로 교체:
```ts
import { create } from "zustand";
import type { GlobalMode, Marker, Project, SoundRef, Track, TrackStatus } from "../types";
import { newId } from "../domain/ids";
import { pickColor } from "../domain/palette";

interface StoreState {
  project: Project | null;
  mode: GlobalMode;
  playing: boolean;
  playheadMs: number;

  setProject: (project: Project | null) => void;
  renameProject: (name: string) => void;
  setMasterVolume: (v: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlayheadMs: (ms: number) => void;
  setMode: (mode: GlobalMode) => void;

  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  setTrackStatus: (trackId: string, status: TrackStatus) => void;
  setTrackName: (trackId: string, name: string) => void;
  setTrackVolume: (trackId: string, v: number) => void;
  setTrackSound: (trackId: string, sound: SoundRef) => void;
  setTrackKeyBinding: (trackId: string, key: string | null) => void;
  addMarker: (trackId: string, timeMs: number) => void;
  removeMarker: (trackId: string, markerId: string) => void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 트랙 배열을 변환하며 project.updatedAt을 갱신하는 헬퍼. */
function mutate(
  s: StoreState,
  fn: (tracks: Track[]) => Track[],
): Partial<StoreState> {
  if (!s.project) return s;
  return { project: { ...s.project, tracks: fn(s.project.tracks), updatedAt: Date.now() } };
}

function mapTrack(tracks: Track[], id: string, fn: (t: Track) => Track): Track[] {
  return tracks.map((t) => (t.id === id ? fn(t) : t));
}

export const useStore = create<StoreState>((set) => ({
  project: null,
  mode: "listening",
  playing: false,
  playheadMs: 0,

  setProject: (project) => set({ project }),
  renameProject: (name) =>
    set((s) => (s.project ? { project: { ...s.project, name, updatedAt: Date.now() } } : s)),
  setMasterVolume: (v) =>
    set((s) =>
      s.project
        ? { project: { ...s.project, master: { volume: clamp01(v) }, updatedAt: Date.now() } }
        : s,
    ),
  setPlaying: (playing) => set({ playing }),
  setPlayheadMs: (ms) => set({ playheadMs: ms }),
  setMode: (mode) => set({ mode }),

  addTrack: () =>
    set((s) =>
      mutate(s, (tracks) => [
        ...tracks,
        {
          id: newId(),
          name: `트랙 ${tracks.length + 1}`,
          status: "listening",
          sound: { kind: "builtin", sampleId: "kick" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: pickColor(tracks.length),
        },
      ]),
    ),

  removeTrack: (trackId) => set((s) => mutate(s, (tracks) => tracks.filter((t) => t.id !== trackId))),

  setTrackStatus: (trackId, status) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, status })))),

  setTrackName: (trackId, name) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, name })))),

  setTrackVolume: (trackId, v) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, volume: clamp01(v) })))),

  setTrackSound: (trackId, sound) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, sound })))),

  setTrackKeyBinding: (trackId, key) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, keyBinding: key })))),

  addMarker: (trackId, timeMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => {
          const marker: Marker = { id: newId(), timeMs };
          const markers = [...t.markers, marker].sort((a, b) => a.timeMs - b.timeMs);
          return { ...t, markers };
        }),
      ),
    ),

  removeMarker: (trackId, markerId) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => ({
          ...t,
          markers: t.markers.filter((m) => m.id !== markerId),
        })),
      ),
    ),
}));
```

- [ ] **Step 4: 기존 테스트 beforeEach 보강**

`src/store/useStore.test.ts`의 첫 describe 및 자동저장 테스트에서 `useStore.setState({...})` 호출에 `mode: "listening"`을 포함하도록 수정(누락 시 타입 에러).

- [ ] **Step 5: 전체 스토어 테스트 통과 확인**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: PASS (기존 3 + 신규 6 = 9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/store/useStore.ts src/store/useStore.test.ts
git commit -m "feat: 스토어에 모드/트랙/마커 액션 추가"
```

---

## Task 4: 스케줄러 순수 로직

**Files:**
- Create: `src/audio/Scheduler.ts`, `src/audio/Scheduler.test.ts`

> 룩어헤드 스케줄러의 결정 로직(어떤 마커가 이번 윈도우에 들어오는지, 그 ctx 예약시각)을 순수함수로 분리해 TDD한다. setInterval 루프는 Task 7에서 얇게 결선.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/audio/Scheduler.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { markersInWindow, ctxTimeForMarker } from "./Scheduler";
import type { Track } from "../types";

function track(id: string, times: number[]): Track {
  return {
    id, name: id, status: "listening",
    sound: { kind: "builtin", sampleId: "kick" },
    keyBinding: null,
    markers: times.map((t, i) => ({ id: `${id}-${i}`, timeMs: t })),
    volume: 1, color: "#fff",
  };
}

describe("markersInWindow", () => {
  it("(from, to] 구간의 마커만, 트랙별로 모은다", () => {
    const tracks = [track("a", [100, 250, 400]), track("b", [200])];
    const due = markersInWindow(tracks, 100, 250);
    // from 초과 ~ to 이하: a의 250, b의 200
    expect(due.map((d) => [d.trackId, d.marker.timeMs]).sort()).toEqual([
      ["a", 250],
      ["b", 200],
    ]);
  });

  it("from은 배타적, to는 포함", () => {
    const tracks = [track("a", [100, 200])];
    expect(markersInWindow(tracks, 100, 200).map((d) => d.marker.timeMs)).toEqual([200]);
  });
});

describe("ctxTimeForMarker", () => {
  it("미래 마커의 ctx 예약시각(초) = 현재ctx초 + (마커ms - 현재ms)/1000", () => {
    expect(ctxTimeForMarker(10, 1200, 1000)).toBeCloseTo(10 + 0.2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/audio/Scheduler.test.ts`
Expected: FAIL — 함수 미정의.

- [ ] **Step 3: 구현**

`src/audio/Scheduler.ts`:
```ts
import type { Track } from "../types";

export interface DueMarker {
  trackId: string;
  marker: { id: string; timeMs: number };
}

/** (fromMs, toMs] 구간에 속한 모든 트랙의 마커를 모은다. */
export function markersInWindow(tracks: Track[], fromMs: number, toMs: number): DueMarker[] {
  const due: DueMarker[] = [];
  for (const t of tracks) {
    for (const m of t.markers) {
      if (m.timeMs > fromMs && m.timeMs <= toMs) {
        due.push({ trackId: t.id, marker: m });
      }
    }
  }
  return due;
}

/** 미래 마커의 AudioContext 예약 시각(초). */
export function ctxTimeForMarker(nowCtxSec: number, markerMs: number, nowMs: number): number {
  return nowCtxSec + (markerMs - nowMs) / 1000;
}
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `npx vitest run src/audio/Scheduler.test.ts`
Expected: PASS (3 tests).
```bash
git add src/audio/Scheduler.ts src/audio/Scheduler.test.ts
git commit -m "feat: 스케줄러 순수 결정 로직"
```

---

## Task 5: 내장 샘플 레지스트리 + SampleLibrary + SamplePlayer

> 실제 CC0 파일은 `public/samples/`에 둔다. 디코딩/재생은 수동 검증.

**Files:**
- Create: `src/audio/builtinSamples.ts`, `src/audio/SampleLibrary.ts`, `src/audio/SamplePlayer.ts`, `src/audio/builtinSamples.test.ts`
- Create: `public/samples/` (CC0 원샷 파일)

- [ ] **Step 1: CC0 샘플 파일 배치**

`public/samples/`에 최소 6개의 CC0 원샷을 ogg로 둔다(Freesound CC0 또는 Kenney.nl 출처). 파일명: `kick.ogg`, `snare.ogg`, `hat.ogg`, `clap.ogg`, `tom.ogg`, `perc.ogg`. 각 출처를 `public/samples/licenses.md`에 기록.

- [ ] **Step 2: 레지스트리 테스트 작성**

`src/audio/builtinSamples.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { BUILTIN_SAMPLES, sampleUrl } from "./builtinSamples";

describe("builtinSamples", () => {
  it("모든 항목은 id와 label을 갖는다", () => {
    for (const s of BUILTIN_SAMPLES) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it("sampleUrl은 id로 경로를 만든다", () => {
    expect(sampleUrl("kick")).toBe("/samples/kick.ogg");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/audio/builtinSamples.test.ts`
Expected: FAIL.

- [ ] **Step 4: 레지스트리 구현**

`src/audio/builtinSamples.ts`:
```ts
export interface BuiltinSample {
  id: string;
  label: string;
}

export const BUILTIN_SAMPLES: BuiltinSample[] = [
  { id: "kick", label: "킥" },
  { id: "snare", label: "스네어" },
  { id: "hat", label: "하이햇" },
  { id: "clap", label: "클랩" },
  { id: "tom", label: "톰" },
  { id: "perc", label: "퍼커션" },
];

export function sampleUrl(id: string): string {
  return `/samples/${id}.ogg`;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/audio/builtinSamples.test.ts`
Expected: PASS.

- [ ] **Step 6: SampleLibrary 구현 (수동 검증)**

`src/audio/SampleLibrary.ts`:
```ts
import type { SoundRef } from "../types";
import { sampleUrl } from "./builtinSamples";
import { getAsset } from "../persistence/assets";

/** SoundRef → AudioBuffer를 디코드/캐시한다. */
export class SampleLibrary {
  private cache = new Map<string, AudioBuffer>();

  constructor(private readonly ctx: AudioContext) {}

  private key(ref: SoundRef): string {
    return ref.kind === "builtin" ? `b:${ref.sampleId}` : `u:${ref.assetId}`;
  }

  async load(ref: SoundRef): Promise<AudioBuffer> {
    const k = this.key(ref);
    const cached = this.cache.get(k);
    if (cached) return cached;

    let arrayBuf: ArrayBuffer;
    if (ref.kind === "builtin") {
      const res = await fetch(sampleUrl(ref.sampleId));
      arrayBuf = await res.arrayBuffer();
    } else {
      const asset = await getAsset(ref.assetId);
      if (!asset) throw new Error("sample asset not found: " + ref.assetId);
      arrayBuf = await asset.blob.arrayBuffer();
    }
    const buffer = await this.ctx.decodeAudioData(arrayBuf);
    this.cache.set(k, buffer);
    return buffer;
  }

  get(ref: SoundRef): AudioBuffer | null {
    return this.cache.get(this.key(ref)) ?? null;
  }
}
```

- [ ] **Step 7: SamplePlayer 구현 (수동 검증)**

`src/audio/SamplePlayer.ts`:
```ts
/** 디코드된 샘플을 지정 ctx시각(초)에 1회 재생한다. */
export function playSample(
  ctx: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
  whenSec: number,
  volume: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  src.connect(gain).connect(destination);
  src.start(Math.max(whenSec, ctx.currentTime));
  src.onended = () => {
    src.disconnect();
    gain.disconnect();
  };
}
```

- [ ] **Step 8: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/audio/builtinSamples.ts src/audio/builtinSamples.test.ts src/audio/SampleLibrary.ts src/audio/SamplePlayer.ts public/samples
git commit -m "feat: 내장 CC0 샘플 레지스트리, SampleLibrary, SamplePlayer"
```

---

## Task 6: 트랙 사운드 프리로드 + 스케줄러 결선 (runtime)

> 재생 중 룩어헤드 루프가 `auto` 트랙의 마커를 예약한다. 수동 검증.

**Files:**
- Modify: `src/audio/runtime.ts`

- [ ] **Step 1: runtime.ts에 라이브러리/스케줄러 결선 추가**

`src/audio/runtime.ts` 상단 import에 추가:
```ts
import { SampleLibrary } from "./SampleLibrary";
import { playSample } from "./SamplePlayer";
import { markersInWindow, ctxTimeForMarker } from "./Scheduler";
import { resolveTrackBehavior } from "../domain/mode";
```

모듈 변수 추가:
```ts
let library: SampleLibrary | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let lastScheduledMs = 0;

const LOOKAHEAD_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_MS = 120;

export function getLibrary(): SampleLibrary {
  if (!library) library = new SampleLibrary(getEngine().ctx);
  return library;
}

/** 현재 프로젝트의 모든 트랙 사운드를 미리 디코드한다. */
export async function preloadTrackSounds(): Promise<void> {
  const project = useStore.getState().project;
  if (!project) return;
  await Promise.all(project.tracks.map((t) => getLibrary().load(t.sound).catch(() => null)));
}
```

스케줄러 루프 함수 추가:
```ts
function startScheduler(): void {
  if (schedulerTimer !== null) return;
  lastScheduledMs = useStore.getState().playheadMs;
  const eng = getEngine();
  schedulerTimer = setInterval(() => {
    if (!source || !source.isPlaying()) return;
    const nowMs = source.currentTimeMs();
    const windowEnd = nowMs + SCHEDULE_AHEAD_MS;
    const state = useStore.getState();
    const project = state.project;
    if (!project) return;

    const autoTracks = project.tracks.filter(
      (t) => resolveTrackBehavior(state.mode, t.status) === "auto",
    );
    const due = markersInWindow(autoTracks, lastScheduledMs, windowEnd);
    for (const { trackId, marker } of due) {
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) continue;
      const buffer = getLibrary().get(track.sound);
      if (!buffer) continue;
      const whenSec = ctxTimeForMarker(eng.ctx.currentTime, marker.timeMs, nowMs);
      playSample(eng.ctx, buffer, eng.masterGain, whenSec, track.volume);
    }
    lastScheduledMs = windowEnd;
  }, LOOKAHEAD_INTERVAL_MS);
}

function stopScheduler(): void {
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
```

`play`/`pause`/`seek`를 수정해 스케줄러를 기동/정지/리셋:
```ts
export async function play(): Promise<void> {
  if (!source) return;
  await getEngine().resume();
  await preloadTrackSounds();
  source.play();
  useStore.getState().setPlaying(true);
  lastScheduledMs = source.currentTimeMs();
  startScheduler();
  startRaf();
}

export function pause(): void {
  if (!source) return;
  source.pause();
  useStore.getState().setPlaying(false);
  stopScheduler();
  stopRaf();
  useStore.getState().setPlayheadMs(source.currentTimeMs());
}

export function seek(ms: number): void {
  if (!source) return;
  source.seek(ms);
  lastScheduledMs = source.currentTimeMs();
  useStore.getState().setPlayheadMs(source.currentTimeMs());
}
```

`startRaf` 내부에서 재생 종료 감지 시 `stopScheduler()`도 호출하도록 수정:
```ts
    if (!source.isPlaying()) {
      useStore.getState().setPlaying(false);
      stopScheduler();
      rafId = null;
      return;
    }
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/audio/runtime.ts
git commit -m "feat: 룩어헤드 스케줄러 결선 (auto 트랙 마커 정밀 재생)"
```

---

## Task 7: TimelineCanvas — 트랙 레인 + 마커 렌더 + 레인 클릭

> 베이스 레인 아래 각 트랙 레인을 그리고 마커를 점으로 표시한다. 레인 클릭 시 그 시각에 마커 추가(리스닝 검증용 — 계획 3에서 모드별로 정교화).

**Files:**
- Modify: `src/render/TimelineCanvas.tsx`

- [ ] **Step 1: 교체 구현**

`src/render/TimelineCanvas.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import type { Track } from "../types";

interface Props {
  peaks: Float32Array | null;
  durationMs: number;
  tracks: Track[];
  onSeek: (ms: number) => void;
  onLaneClick: (trackId: string, timeMs: number) => void;
}

const BASE_HEIGHT = 80;
const TRACK_HEIGHT = 40;

export function TimelineCanvas({ peaks, durationMs, tracks, onSeek, onLaneClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadMs = useStore((s) => s.playheadMs);
  const height = BASE_HEIGHT + tracks.length * TRACK_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    ctx.clearRect(0, 0, w, canvas.height);

    // 베이스 레인
    ctx.fillStyle = "#10131a";
    ctx.fillRect(0, 0, w, BASE_HEIGHT);
    if (peaks && peaks.length > 0) {
      ctx.fillStyle = "#6cc4ff";
      const mid = BASE_HEIGHT / 2;
      const barW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const bh = peaks[i] * (BASE_HEIGHT - 8);
        ctx.fillRect(i * barW, mid - bh / 2, Math.max(1, barW - 1), bh);
      }
    }

    // 트랙 레인 + 마커
    tracks.forEach((t, idx) => {
      const top = BASE_HEIGHT + idx * TRACK_HEIGHT;
      ctx.fillStyle = idx % 2 === 0 ? "#161a22" : "#12151c";
      ctx.fillRect(0, top, w, TRACK_HEIGHT);
      ctx.strokeStyle = "#222833";
      ctx.strokeRect(0, top, w, TRACK_HEIGHT);
      if (durationMs > 0) {
        ctx.fillStyle = t.color;
        const cy = top + TRACK_HEIGHT / 2;
        for (const m of t.markers) {
          const x = (m.timeMs / durationMs) * w;
          ctx.beginPath();
          ctx.arc(x, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // 플레이헤드
    if (durationMs > 0) {
      const x = (playheadMs / durationMs) * w;
      ctx.fillStyle = "#ff7b7b";
      ctx.fillRect(x - 1, 0, 2, canvas.height);
    }
  }, [peaks, durationMs, tracks, playheadMs, height]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || durationMs <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const timeMs = xRatio * durationMs;
    if (y < BASE_HEIGHT) {
      onSeek(timeMs);
    } else {
      const idx = Math.floor((y - BASE_HEIGHT) / TRACK_HEIGHT);
      const track = tracks[idx];
      if (track) onLaneClick(track.id, timeMs);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={height}
      onClick={handleClick}
      style={{ width: "100%", height, cursor: "pointer", display: "block" }}
    />
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: TimelineCanvas 호출부(Editor)가 아직 옛 props라 에러날 수 있음 — 다음 Task에서 결선하므로, 이 단계는 `tsc` 에러를 무시하지 말고 Task 9까지 묶어 진행한다. 우선 커밋:
```bash
git add src/render/TimelineCanvas.tsx
git commit -m "feat: TimelineCanvas 트랙 레인+마커 렌더 및 레인 클릭"
```

---

## Task 8: TrackHeader + TrackList UI

**Files:**
- Create: `src/ui/TrackHeader.tsx`, `src/ui/TrackList.tsx`

- [ ] **Step 1: TrackHeader 구현**

`src/ui/TrackHeader.tsx`:
```tsx
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
  const removeTrack = useStore((s) => s.removeTrack);

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        height: 40,
        padding: "0 6px",
        borderLeft: `4px solid ${track.color}`,
      }}
    >
      <input
        value={track.name}
        onChange={(e) => setTrackName(track.id, e.target.value)}
        style={{ width: 80 }}
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
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
        style={{ width: 60 }}
      />
      <button onClick={() => removeTrack(track.id)}>✕</button>
    </div>
  );
}
```

- [ ] **Step 2: TrackList 구현**

`src/ui/TrackList.tsx`:
```tsx
import { useStore } from "../store/useStore";
import { TrackHeader } from "./TrackHeader";

export function TrackList() {
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const addTrack = useStore((s) => s.addTrack);

  return (
    <div style={{ width: 320 }}>
      <div style={{ height: 80, display: "flex", alignItems: "center", padding: "0 6px" }}>
        <strong>트랙</strong>
        <button onClick={addTrack} style={{ marginLeft: "auto" }}>
          ＋ 트랙
        </button>
      </div>
      {tracks.map((t) => (
        <TrackHeader key={t.id} track={t} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음(호출부 외).
```bash
git add src/ui/TrackHeader.tsx src/ui/TrackList.tsx
git commit -m "feat: TrackHeader/TrackList UI"
```

---

## Task 9: Editor 통합 (트랙 헤더 + 캔버스 정렬)

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
import { TimelineCanvas } from "../render/TimelineCanvas";
import { TransportBar } from "./TransportBar";
import { TrackList } from "./TrackList";

interface Props {
  onExit: () => void;
}

export function Editor({ onExit }: Props) {
  const project = useStore((s) => s.project);
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const addMarker = useStore((s) => s.addMarker);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: 8 }}>
        <strong>{project.name}</strong>
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
            onSeek={seek}
            onLaneClick={(trackId, timeMs) => addMarker(trackId, timeMs)}
          />
        </div>
      </div>
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
1. 에디터에서 "＋ 트랙"으로 트랙 추가 → 좌측 헤더 + 우측 레인 생성.
2. 트랙 사운드를 선택(킥/스네어 등), 트랙 레인을 클릭해 마커 여러 개 배치.
3. ▶ 재생 → 플레이헤드가 마커를 지날 때 해당 샘플이 **베이스와 동기로** 들림.
4. 트랙 상태를 "뮤트"로 바꾸면 그 트랙은 안 들림.
5. 볼륨 슬라이더로 트랙 음량 변화.
6. 새로고침 후 트랙·마커가 유지됨.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Editor.tsx
git commit -m "feat: Editor에 트랙 헤더+레인 통합 (리스닝 모드 완성)"
```

---

## Self-Review 결과

- **스펙 커버리지**: 트랙 생성/사운드 할당/상태/볼륨(Task 3,8), 내장 CC0+업로드 샘플(Task 5; 업로드는 SampleLibrary가 `upload` ref 지원, UI 연결은 계획 3에서 보강), 마커 모델(Task 3), 룩어헤드 스케줄러 동기 재생(Task 4,6), 트랙 레인/마커 렌더(Task 7), 모드×상태 도출(Task 1), 리스닝 모드(Task 6,9). ✅
- **플레이스홀더**: 없음. (`public/samples/`의 실제 CC0 파일 배치는 Task 5 Step 1의 구체 작업 항목)
- **타입 일관성**: `resolveTrackBehavior`/`TrackBehavior`, `markersInWindow`/`ctxTimeForMarker`/`DueMarker`, `SampleLibrary.load/get`, `playSample`, 스토어 액션명(`addTrack`/`setTrackStatus`/`addMarker` 등) — 계획 3·4에서 동일 시그니처로 참조.
- **주의(계획 3에서 정교화)**: 현재 레인 클릭은 모드 무관하게 마커를 추가한다(리스닝 검증용). 계획 3에서 "레코드 모드 + write 트랙"으로 게이팅한다.
