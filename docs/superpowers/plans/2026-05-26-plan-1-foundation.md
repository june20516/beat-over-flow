# 계획 1 — 기반 + 베이스 플로우 재생 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오디오 파일을 베이스 플로우로 업로드해 파형을 보며 재생/정지/탐색하고, 작업이 IndexedDB에 자동 저장되어 새로고침에도 유지되는 최소 동작 앱을 만든다.

**Architecture:** Vite + React + TypeScript. 오디오는 Raw Web Audio API(`AudioContext`)를 `AudioEngine`/`AudioFileSource`로 감싼다. 상태는 Zustand 단일 스토어, 영속화는 `idb` 기반 `ProjectRepository`/`AssetRepository`. 타임라인은 Canvas로 렌더. 순수 로직(피크 계산·시각 매핑·디바운스)은 Vitest로 TDD, Web Audio/Canvas 글루는 실제 코드 작성 후 수동 검증.

**Tech Stack:** Vite, React 18, TypeScript, Zustand, idb, Vitest, fake-indexeddb, jsdom.

---

## 파일 구조 (이 계획에서 생성/수정)

```
beat-over-flow/
  package.json              생성: 의존성·스크립트
  tsconfig.json             생성
  vite.config.ts            생성
  vitest.config.ts          생성
  index.html                생성: 앱 진입 HTML
  src/
    main.tsx                생성: React 부트스트랩
    App.tsx                 생성: 라우팅(목록 ↔ 에디터)
    types.ts                생성: 공유 도메인 타입
    domain/
      ids.ts                생성: id 생성기
      debounce.ts           생성: 디바운스 유틸
    audio/
      AudioEngine.ts        생성: AudioContext 래퍼 + 디코딩
      BaseFlowSource.ts     생성: 인터페이스
      AudioFileSource.ts    생성: AudioBuffer 재생 구현
    persistence/
      db.ts                 생성: idb 스키마
      assets.ts             생성: AssetRepository
      projects.ts           생성: ProjectRepository
    store/
      useStore.ts           생성: Zustand 스토어
    render/
      waveform.ts           생성: 파형 피크 계산
      TimelineCanvas.tsx    생성: 베이스 레인 + 플레이헤드
    ui/
      ProjectList.tsx       생성: 홈(목록/새 프로젝트)
      Editor.tsx            생성: 에디터 셸
      TransportBar.tsx      생성: 재생/탐색/볼륨
  src/**/*.test.ts          생성: 단위 테스트
```

각 파일은 단일 책임을 가진다. `types.ts`는 전 계획이 공유하는 도메인 타입의 단일 출처다.

---

## Task 1: 프로젝트 스캐폴드 + 테스트 러너

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test-setup.ts`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "beat-over-flow",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.8",
    "jsdom": "^25.0.1",
    "fake-indexeddb": "^6.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vite.config.ts / vitest.config.ts 작성**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

`src/test-setup.ts`:
```ts
import "fake-indexeddb/auto";
```

- [ ] **Step 4: index.html / 진입점 작성**

`index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BeatOverflow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:
```tsx
export function App() {
  return <div>BeatOverflow</div>;
}
```

- [ ] **Step 5: 설치 및 검증**

Run: `npm install && npm run test:run`
Expected: 설치 성공. Vitest는 "no test files found"로 종료(에러 아님). `npm run dev` 실행 시 "BeatOverflow" 표시.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: Vite+React+TS 스캐폴드 및 Vitest 설정"
```

---

## Task 2: 공유 도메인 타입 + id 생성기

**Files:**
- Create: `src/types.ts`, `src/domain/ids.ts`, `src/domain/ids.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/ids.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("생성된 id는 비어있지 않다", () => {
    expect(newId().length).toBeGreaterThan(0);
  });

  it("연속 호출 시 서로 다른 id를 반환한다", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/ids.test.ts`
Expected: FAIL — `newId` is not defined.

- [ ] **Step 3: 최소 구현**

`src/domain/ids.ts`:
```ts
export function newId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 4: 공유 타입 작성 (테스트 불필요한 선언)**

`src/types.ts`:
```ts
export type TrackStatus = "mute" | "listening" | "play" | "write";
export type GlobalMode = "listening" | "play" | "record";

export type BaseFlowRef = { kind: "audioFile"; assetId: string; durationMs: number };

export type SoundRef =
  | { kind: "builtin"; sampleId: string }
  | { kind: "upload"; assetId: string };

export interface Marker {
  id: string;
  timeMs: number;
}

export interface Track {
  id: string;
  name: string;
  status: TrackStatus;
  sound: SoundRef;
  keyBinding: string | null;
  markers: Marker[];
  volume: number; // 0..1
  color: string; // CSS color
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  baseFlow: BaseFlowRef;
  tracks: Track[];
  master: { volume: number }; // 0..1
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/domain/ids.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/domain/ids.ts src/domain/ids.test.ts
git commit -m "feat: 공유 도메인 타입 및 id 생성기"
```

---

## Task 3: 디바운스 유틸 (자동저장용)

**Files:**
- Create: `src/domain/debounce.ts`, `src/domain/debounce.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/debounce.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  it("연속 호출 시 마지막 한 번만, 지연 후 실행한다", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/debounce.test.ts`
Expected: FAIL — `debounce` is not defined.

- [ ] **Step 3: 최소 구현**

`src/domain/debounce.ts`:
```ts
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/domain/debounce.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/domain/debounce.ts src/domain/debounce.test.ts
git commit -m "feat: 디바운스 유틸"
```

---

## Task 4: IndexedDB 스키마 + AssetRepository

**Files:**
- Create: `src/persistence/db.ts`, `src/persistence/assets.ts`, `src/persistence/assets.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/persistence/assets.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { putAsset, getAsset } from "./assets";

describe("AssetRepository", () => {
  beforeEach(async () => {
    indexedDB = new IDBFactory(); // fake-indexeddb/auto가 전역 제공
  });

  it("blob을 저장하고 같은 id로 되읽는다", async () => {
    const blob = new Blob(["hello"], { type: "audio/wav" });
    const id = await putAsset(blob, "kick.wav");
    const got = await getAsset(id);
    expect(got).not.toBeNull();
    expect(got!.name).toBe("kick.wav");
    expect(await got!.blob.text()).toBe("hello");
  });

  it("없는 id는 null을 반환한다", async () => {
    expect(await getAsset("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/persistence/assets.test.ts`
Expected: FAIL — `putAsset`/`getAsset` not defined.

- [ ] **Step 3: db 스키마 구현**

`src/persistence/db.ts`:
```ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface StoredAsset {
  id: string;
  name: string;
  blob: Blob;
}

interface BeatOverflowDB extends DBSchema {
  assets: { key: string; value: StoredAsset };
  projects: { key: string; value: import("../types").Project };
}

let dbPromise: Promise<IDBPDatabase<BeatOverflowDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BeatOverflowDB>> {
  if (dbPromise === null) {
    dbPromise = openDB<BeatOverflowDB>("beat-overflow", 1, {
      upgrade(db) {
        db.createObjectStore("assets", { keyPath: "id" });
        db.createObjectStore("projects", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

// 테스트에서 fake-indexeddb 재생성 후 캐시를 비우기 위함
export function resetDbCache(): void {
  dbPromise = null;
}
```

- [ ] **Step 4: AssetRepository 구현**

`src/persistence/assets.ts`:
```ts
import { getDb, type StoredAsset } from "./db";
import { newId } from "../domain/ids";

export async function putAsset(blob: Blob, name: string): Promise<string> {
  const db = await getDb();
  const asset: StoredAsset = { id: newId(), name, blob };
  await db.put("assets", asset);
  return asset.id;
}

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const db = await getDb();
  return (await db.get("assets", id)) ?? null;
}
```

- [ ] **Step 5: 테스트 setup 보정**

`src/persistence/assets.test.ts`의 `beforeEach`를 다음으로 교체(캐시 리셋 포함):
```ts
import { resetDbCache } from "./db";
// ...
beforeEach(() => {
  indexedDB = new IDBFactory();
  resetDbCache();
});
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/persistence/assets.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/persistence/db.ts src/persistence/assets.ts src/persistence/assets.test.ts
git commit -m "feat: IndexedDB 스키마 및 AssetRepository"
```

---

## Task 5: ProjectRepository

**Files:**
- Create: `src/persistence/projects.ts`, `src/persistence/projects.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/persistence/projects.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { saveProject, loadProject, listProjects, deleteProject } from "./projects";
import { resetDbCache } from "./db";
import type { Project } from "../types";

function sampleProject(id: string): Project {
  return {
    id,
    name: "곡 " + id,
    createdAt: 1,
    updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
    tracks: [],
    master: { volume: 1 },
  };
}

describe("ProjectRepository", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("저장한 프로젝트를 id로 되읽는다", async () => {
    await saveProject(sampleProject("p1"));
    const got = await loadProject("p1");
    expect(got?.name).toBe("곡 p1");
  });

  it("목록은 저장된 모든 프로젝트를 반환한다", async () => {
    await saveProject(sampleProject("p1"));
    await saveProject(sampleProject("p2"));
    const list = await listProjects();
    expect(list.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("삭제하면 더 이상 읽히지 않는다", async () => {
    await saveProject(sampleProject("p1"));
    await deleteProject("p1");
    expect(await loadProject("p1")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/persistence/projects.test.ts`
Expected: FAIL — 함수 미정의.

- [ ] **Step 3: 구현**

`src/persistence/projects.ts`:
```ts
import { getDb } from "./db";
import type { Project } from "../types";

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put("projects", project);
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDb();
  return (await db.get("projects", id)) ?? null;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return await db.getAll("projects");
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("projects", id);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/persistence/projects.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/persistence/projects.ts src/persistence/projects.test.ts
git commit -m "feat: ProjectRepository (CRUD)"
```

---

## Task 6: 파형 피크 계산

**Files:**
- Create: `src/render/waveform.ts`, `src/render/waveform.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/render/waveform.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computePeaks } from "./waveform";

describe("computePeaks", () => {
  it("buckets 개수만큼의 양수 피크를 반환한다", () => {
    const data = new Float32Array(1000).map((_, i) => Math.sin(i));
    const peaks = computePeaks(data, 50);
    expect(peaks.length).toBe(50);
    for (const p of peaks) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("각 버킷은 해당 구간의 최대 절댓값이다", () => {
    const data = new Float32Array([0, 0.5, 0, 0, -1, 0]);
    const peaks = computePeaks(data, 2);
    expect(peaks[0]).toBeCloseTo(0.5); // 앞 3개 중 최대 절댓값
    expect(peaks[1]).toBeCloseTo(1.0); // 뒤 3개 중 최대 절댓값
  });

  it("buckets가 샘플 수보다 많아도 안전하다", () => {
    const data = new Float32Array([0.2, -0.4]);
    const peaks = computePeaks(data, 10);
    expect(peaks.length).toBe(10);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/render/waveform.test.ts`
Expected: FAIL — `computePeaks` not defined.

- [ ] **Step 3: 최소 구현**

`src/render/waveform.ts`:
```ts
/** 모노 채널 데이터를 buckets개의 버킷으로 나눠 각 버킷의 최대 절댓값(0..1)을 반환한다. */
export function computePeaks(channelData: Float32Array, buckets: number): Float32Array {
  const peaks = new Float32Array(buckets);
  if (channelData.length === 0) return peaks;
  const samplesPerBucket = channelData.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * samplesPerBucket);
    const end = Math.max(start + 1, Math.floor((b + 1) * samplesPerBucket));
    let max = 0;
    for (let i = start; i < end && i < channelData.length; i++) {
      const v = Math.abs(channelData[i]);
      if (v > max) max = v;
    }
    peaks[b] = Math.min(1, max);
  }
  return peaks;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/render/waveform.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/waveform.ts src/render/waveform.test.ts
git commit -m "feat: 파형 피크 계산"
```

---

## Task 7: AudioEngine + BaseFlowSource 인터페이스 + AudioFileSource

> Web Audio는 jsdom 미구현이라 재생 동작은 수동 검증한다. 시각 계산(`currentTimeMs`)만 순수 함수로 분리해 TDD한다.

**Files:**
- Create: `src/audio/BaseFlowSource.ts`, `src/audio/playClock.ts`, `src/audio/playClock.test.ts`, `src/audio/AudioEngine.ts`, `src/audio/AudioFileSource.ts`

- [ ] **Step 1: 인터페이스 선언**

`src/audio/BaseFlowSource.ts`:
```ts
/** 베이스 플로우 재생 소스 추상화. v1은 AudioFileSource, v2는 YouTubeSource가 구현. */
export interface BaseFlowSource {
  readonly durationMs: number;
  /** 현재 재생 위치(ms). 정지 중이면 마지막 위치. */
  currentTimeMs(): number;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  /** 자원 해제. */
  dispose(): void;
}
```

- [ ] **Step 2: 재생 시각 계산 순수함수 — 실패 테스트**

`src/audio/playClock.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { elapsedMs } from "./playClock";

describe("elapsedMs", () => {
  it("재생 중: (현재 ctx시각 - 시작 ctx시각) + 시작 오프셋", () => {
    // ctxStartSec=10초에 offset 2000ms부터 재생, 현재 ctx 12.5초
    expect(elapsedMs(12.5, 10, 2000)).toBeCloseTo(2000 + 2500);
  });

  it("durationMs로 상한 클램프는 호출자 몫이 아니라 여기서 하지 않는다(원시값 반환)", () => {
    expect(elapsedMs(20, 10, 0)).toBeCloseTo(10000);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/audio/playClock.test.ts`
Expected: FAIL — `elapsedMs` not defined.

- [ ] **Step 4: 구현**

`src/audio/playClock.ts`:
```ts
/** 재생 경과 시각(ms) = (현재 ctx초 - 재생 시작 ctx초)*1000 + 시작 오프셋(ms) */
export function elapsedMs(nowCtxSec: number, startCtxSec: number, startOffsetMs: number): number {
  return (nowCtxSec - startCtxSec) * 1000 + startOffsetMs;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/audio/playClock.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: AudioEngine 구현 (수동 검증)**

`src/audio/AudioEngine.ts`:
```ts
/** 앱 전역 단일 AudioContext와 마스터 게인을 보유한다. */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  /** 브라우저 자동재생 정책 대응: 사용자 제스처 안에서 호출. */
  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setMasterVolume(v: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  async decode(blob: Blob): Promise<AudioBuffer> {
    const buf = await blob.arrayBuffer();
    return await this.ctx.decodeAudioData(buf);
  }
}
```

- [ ] **Step 7: AudioFileSource 구현 (수동 검증)**

`src/audio/AudioFileSource.ts`:
```ts
import type { BaseFlowSource } from "./BaseFlowSource";
import { elapsedMs } from "./playClock";

/** 디코드된 AudioBuffer를 BaseFlowSource로 재생한다. */
export class AudioFileSource implements BaseFlowSource {
  readonly durationMs: number;
  private node: AudioBufferSourceNode | null = null;
  private startCtxSec = 0;
  private startOffsetMs = 0;
  private pausedAtMs = 0;
  private playing = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffer: AudioBuffer,
    private readonly destination: AudioNode,
  ) {
    this.durationMs = buffer.duration * 1000;
  }

  currentTimeMs(): number {
    if (!this.playing) return this.pausedAtMs;
    const t = elapsedMs(this.ctx.currentTime, this.startCtxSec, this.startOffsetMs);
    return Math.min(this.durationMs, Math.max(0, t));
  }

  isPlaying(): boolean {
    return this.playing;
  }

  play(): void {
    if (this.playing) return;
    const node = this.ctx.createBufferSource();
    node.buffer = this.buffer;
    node.connect(this.destination);
    this.startCtxSec = this.ctx.currentTime;
    this.startOffsetMs = this.pausedAtMs;
    node.start(0, this.pausedAtMs / 1000);
    node.onended = () => {
      if (this.node === node && this.playing) {
        this.playing = false;
        this.pausedAtMs = this.durationMs;
      }
    };
    this.node = node;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.pausedAtMs = this.currentTimeMs();
    this.stopNode();
    this.playing = false;
  }

  seek(ms: number): void {
    const clamped = Math.min(this.durationMs, Math.max(0, ms));
    const wasPlaying = this.playing;
    if (wasPlaying) this.stopNode();
    this.pausedAtMs = clamped;
    this.playing = false;
    if (wasPlaying) this.play();
  }

  dispose(): void {
    this.stopNode();
    this.playing = false;
  }

  private stopNode(): void {
    if (this.node) {
      this.node.onended = null;
      try {
        this.node.stop();
      } catch {
        /* 이미 정지됨 */
      }
      this.node.disconnect();
      this.node = null;
    }
  }
}
```

- [ ] **Step 8: 빌드 타입체크**

Run: `npx tsc -b`
Expected: 타입 에러 없음.

- [ ] **Step 9: Commit**

```bash
git add src/audio
git commit -m "feat: AudioEngine, BaseFlowSource, AudioFileSource"
```

---

## Task 8: Zustand 스토어 (프로젝트/트랜스포트 상태)

> 스토어는 도메인 상태(프로젝트)와 런타임 상태(현 프로젝트 id, 재생 여부)를 보유한다. 오디오 객체(AudioEngine/Source)는 스토어 바깥의 모듈 싱글턴(다음 Task)에서 관리하고, 스토어는 직렬화 가능한 상태만 갖는다.

**Files:**
- Create: `src/store/useStore.ts`, `src/store/useStore.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/store/useStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";

function sampleProject(): Project {
  return {
    id: "p1",
    name: "테스트곡",
    createdAt: 1,
    updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 5000 },
    tracks: [],
    master: { volume: 1 },
  };
}

describe("useStore", () => {
  beforeEach(() => {
    useStore.setState({ project: null, playing: false, playheadMs: 0 });
  });

  it("setProject로 현재 프로젝트를 교체한다", () => {
    useStore.getState().setProject(sampleProject());
    expect(useStore.getState().project?.name).toBe("테스트곡");
  });

  it("renameProject는 이름과 updatedAt을 갱신한다", () => {
    useStore.getState().setProject(sampleProject());
    useStore.getState().renameProject("새 이름");
    expect(useStore.getState().project?.name).toBe("새 이름");
    expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(
      useStore.getState().project!.createdAt,
    );
  });

  it("setMasterVolume은 0..1로 클램프한다", () => {
    useStore.getState().setProject(sampleProject());
    useStore.getState().setMasterVolume(2);
    expect(useStore.getState().project!.master.volume).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: FAIL — 모듈/액션 미정의.

- [ ] **Step 3: 구현**

`src/store/useStore.ts`:
```ts
import { create } from "zustand";
import type { Project } from "../types";

interface StoreState {
  project: Project | null;
  playing: boolean;
  playheadMs: number;

  setProject: (project: Project | null) => void;
  renameProject: (name: string) => void;
  setMasterVolume: (v: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlayheadMs: (ms: number) => void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export const useStore = create<StoreState>((set) => ({
  project: null,
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
}));
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/useStore.ts src/store/useStore.test.ts
git commit -m "feat: Zustand 스토어 (프로젝트/트랜스포트)"
```

---

## Task 9: 자동저장 구독 (스토어 → ProjectRepository)

**Files:**
- Create: `src/store/autosave.ts`, `src/store/autosave.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/store/autosave.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStore } from "./useStore";
import { startAutosave } from "./autosave";
import { loadProject } from "../persistence/projects";
import { resetDbCache } from "../persistence/db";
import type { Project } from "../types";

function sampleProject(): Project {
  return {
    id: "p1", name: "곡", createdAt: 1, updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 5000 },
    tracks: [], master: { volume: 1 },
  };
}

describe("startAutosave", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
    useStore.setState({ project: null, playing: false, playheadMs: 0 });
  });

  it("project 변경 시 디바운스 후 저장한다", async () => {
    vi.useFakeTimers();
    const stop = startAutosave(0); // 디바운스 0ms
    useStore.getState().setProject(sampleProject());
    useStore.getState().renameProject("바뀐곡");
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    const saved = await loadProject("p1");
    expect(saved?.name).toBe("바뀐곡");
    stop();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/store/autosave.test.ts`
Expected: FAIL — `startAutosave` not defined.

- [ ] **Step 3: 구현**

`src/store/autosave.ts`:
```ts
import { useStore } from "./useStore";
import { saveProject } from "../persistence/projects";
import { debounce } from "../domain/debounce";
import type { Project } from "../types";

/** project 상태 변경을 구독해 디바운스 저장한다. 구독 해제 함수를 반환. */
export function startAutosave(delayMs = 500): () => void {
  const persist = debounce((p: Project) => {
    void saveProject(p);
  }, delayMs);

  return useStore.subscribe((state, prev) => {
    if (state.project && state.project !== prev.project) {
      persist(state.project);
    }
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/store/autosave.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/store/autosave.ts src/store/autosave.test.ts
git commit -m "feat: 디바운스 자동저장 구독"
```

---

## Task 10: 오디오 런타임 싱글턴 (엔진/소스 수명 관리)

> React 바깥에서 AudioEngine과 현재 BaseFlowSource를 보유하고, 베이스 플로우 에셋을 로드해 소스를 만든다. requestAnimationFrame으로 재생 위치를 스토어 `playheadMs`에 반영한다. 수동 검증.

**Files:**
- Create: `src/audio/runtime.ts`

- [ ] **Step 1: 구현**

`src/audio/runtime.ts`:
```ts
import { AudioEngine } from "./AudioEngine";
import { AudioFileSource } from "./AudioFileSource";
import type { BaseFlowSource } from "./BaseFlowSource";
import { getAsset } from "../persistence/assets";
import { useStore } from "../store/useStore";

let engine: AudioEngine | null = null;
let source: BaseFlowSource | null = null;
let rafId: number | null = null;

export function getEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}

export function getSource(): BaseFlowSource | null {
  return source;
}

/** 현재 프로젝트의 베이스 플로우 에셋을 디코드해 소스를 만든다. */
export async function loadBaseFlow(assetId: string): Promise<void> {
  const eng = getEngine();
  const asset = await getAsset(assetId);
  if (!asset) throw new Error("base flow asset not found: " + assetId);
  const buffer = await eng.decode(asset.blob);
  disposeSource();
  source = new AudioFileSource(eng.ctx, buffer, eng.masterGain);
}

export async function play(): Promise<void> {
  if (!source) return;
  await getEngine().resume();
  source.play();
  useStore.getState().setPlaying(true);
  startRaf();
}

export function pause(): void {
  if (!source) return;
  source.pause();
  useStore.getState().setPlaying(false);
  stopRaf();
  useStore.getState().setPlayheadMs(source.currentTimeMs());
}

export function seek(ms: number): void {
  if (!source) return;
  source.seek(ms);
  useStore.getState().setPlayheadMs(source.currentTimeMs());
}

function startRaf(): void {
  if (rafId !== null) return;
  const tick = () => {
    if (!source) return;
    useStore.getState().setPlayheadMs(source.currentTimeMs());
    if (!source.isPlaying()) {
      useStore.getState().setPlaying(false);
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopRaf(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function disposeSource(): void {
  stopRaf();
  source?.dispose();
  source = null;
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc -b`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/audio/runtime.ts
git commit -m "feat: 오디오 런타임 싱글턴 (엔진/소스/플레이헤드 RAF)"
```

---

## Task 11: TimelineCanvas (베이스 레인 + 플레이헤드)

> Canvas 렌더는 수동/시각 검증. 스토어의 `playheadMs`와 전달된 피크로 그린다.

**Files:**
- Create: `src/render/TimelineCanvas.tsx`

- [ ] **Step 1: 구현**

`src/render/TimelineCanvas.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";

interface Props {
  peaks: Float32Array | null;
  durationMs: number;
  onSeek: (ms: number) => void;
}

const LANE_HEIGHT = 80;

export function TimelineCanvas({ peaks, durationMs, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadMs = useStore((s) => s.playheadMs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 베이스 레인 배경
    ctx.fillStyle = "#10131a";
    ctx.fillRect(0, 0, w, LANE_HEIGHT);

    // 파형
    if (peaks && peaks.length > 0) {
      ctx.fillStyle = "#6cc4ff";
      const mid = LANE_HEIGHT / 2;
      const barW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const bh = peaks[i] * (LANE_HEIGHT - 8);
        ctx.fillRect(i * barW, mid - bh / 2, Math.max(1, barW - 1), bh);
      }
    }

    // 플레이헤드
    if (durationMs > 0) {
      const x = (playheadMs / durationMs) * w;
      ctx.fillStyle = "#ff7b7b";
      ctx.fillRect(x - 1, 0, 2, h);
    }
  }, [peaks, durationMs, playheadMs]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || durationMs <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * durationMs);
  }

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={LANE_HEIGHT}
      onClick={handleClick}
      style={{ width: "100%", height: LANE_HEIGHT, cursor: "pointer", display: "block" }}
    />
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc -b`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/render/TimelineCanvas.tsx
git commit -m "feat: TimelineCanvas 베이스 레인+플레이헤드 렌더"
```

---

## Task 12: TransportBar UI

**Files:**
- Create: `src/ui/TransportBar.tsx`

- [ ] **Step 1: 구현**

`src/ui/TransportBar.tsx`:
```tsx
import { useStore } from "../store/useStore";
import { play, pause, seek } from "../audio/runtime";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function TransportBar() {
  const playing = useStore((s) => s.playing);
  const playheadMs = useStore((s) => s.playheadMs);
  const project = useStore((s) => s.project);
  const setMasterVolume = useStore((s) => s.setMasterVolume);
  const durationMs = project?.baseFlow.durationMs ?? 0;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 8 }}>
      <button onClick={() => (playing ? pause() : void play())}>
        {playing ? "⏸" : "▶"}
      </button>
      <span style={{ fontFamily: "monospace" }}>
        {fmt(playheadMs)} / {fmt(durationMs)}
      </span>
      <input
        type="range"
        min={0}
        max={durationMs}
        value={playheadMs}
        onChange={(e) => seek(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <label>
        🔊
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={project?.master.volume ?? 1}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/ui/TransportBar.tsx
git commit -m "feat: TransportBar (재생/탐색/볼륨)"
```

---

## Task 13: Editor 화면 (베이스 로드 + 캔버스 + 트랜스포트 결선)

**Files:**
- Create: `src/ui/Editor.tsx`

- [ ] **Step 1: 구현**

`src/ui/Editor.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getEngine, loadBaseFlow, seek } from "../audio/runtime";
import { getAsset } from "../persistence/assets";
import { computePeaks } from "../render/waveform";
import { TimelineCanvas } from "../render/TimelineCanvas";
import { TransportBar } from "./TransportBar";

interface Props {
  onExit: () => void;
}

export function Editor({ onExit }: Props) {
  const project = useStore((s) => s.project);
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
      <TimelineCanvas
        peaks={peaks}
        durationMs={project.baseFlow.durationMs}
        onSeek={seek}
      />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/ui/Editor.tsx
git commit -m "feat: Editor 화면 (베이스 로드+캔버스+트랜스포트)"
```

---

## Task 14: ProjectList 홈 (새 프로젝트 = 베이스 업로드, 열기, 삭제)

**Files:**
- Create: `src/ui/ProjectList.tsx`

- [ ] **Step 1: 구현**

`src/ui/ProjectList.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { listProjects, saveProject, deleteProject } from "../persistence/projects";
import { putAsset } from "../persistence/assets";
import { getEngine } from "../audio/runtime";
import { useStore } from "../store/useStore";
import { newId } from "../domain/ids";
import type { Project } from "../types";

interface Props {
  onOpen: (project: Project) => void;
}

export function ProjectList({ onOpen }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const setProject = useStore((s) => s.setProject);

  async function refresh() {
    setProjects(await listProjects());
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await getEngine().decode(file);
    const assetId = await putAsset(file, file.name);
    const project: Project = {
      id: newId(),
      name: file.name.replace(/\.[^.]+$/, ""),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      baseFlow: { kind: "audioFile", assetId, durationMs: buffer.duration * 1000 },
      tracks: [],
      master: { volume: 1 },
    };
    await saveProject(project);
    setProject(project);
    onOpen(project);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>BeatOverflow</h1>
      <button onClick={() => fileRef.current?.click()}>＋ 새 프로젝트 (오디오 업로드)</button>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <ul>
        {projects.map((p) => (
          <li key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => {
                setProject(p);
                onOpen(p);
              }}
            >
              {p.name}
            </button>
            <button
              onClick={async () => {
                await deleteProject(p.id);
                await refresh();
              }}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/ui/ProjectList.tsx
git commit -m "feat: ProjectList 홈 (업로드/열기/삭제)"
```

---

## Task 15: App 결선 + 자동저장 기동

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 구현**

`src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { ProjectList } from "./ui/ProjectList";
import { Editor } from "./ui/Editor";
import { startAutosave } from "./store/autosave";

export function App() {
  const [view, setView] = useState<"list" | "editor">("list");

  useEffect(() => {
    const stop = startAutosave();
    return stop;
  }, []);

  return view === "list" ? (
    <ProjectList onOpen={() => setView("editor")} />
  ) : (
    <Editor onExit={() => setView("list")} />
  );
}
```

- [ ] **Step 2: 전체 테스트 + 타입체크**

Run: `npm run test:run && npx tsc -b`
Expected: 모든 단위 테스트 PASS, 타입 에러 없음.

- [ ] **Step 3: 수동 검증 (브라우저)**

Run: `npm run dev`
확인 항목:
1. 홈에서 오디오 파일 업로드 → 에디터로 진입, 파형 표시.
2. ▶ 누르면 재생되고 플레이헤드가 좌→우로 이동.
3. 캔버스/슬라이더 클릭으로 탐색.
4. 볼륨 슬라이더로 음량 변화.
5. 새로고침 후 홈에 프로젝트가 남아있고, 열면 파형/재생 정상.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App 결선 및 자동저장 기동"
```

---

## Self-Review 결과

- **스펙 커버리지**: 베이스 플로우 업로드/디코딩/파형(Task 6,7,11,14), 재생/정지/탐색(Task 7,10,12), IndexedDB 자동저장+다중 프로젝트(Task 4,5,9,14), 가로 타임라인 베이스 레인(Task 11). ✅ (트랙/마커/모드/채점은 계획 2~4)
- **플레이스홀더**: 없음. 모든 코드 스텝에 실제 코드 포함.
- **타입 일관성**: `Project`/`Track`/`BaseFlowRef`(types.ts), `BaseFlowSource.currentTimeMs()`, `loadBaseFlow/play/pause/seek`(runtime.ts), `computePeaks`, `newId`, `debounce` — 후속 계획에서 동일 시그니처로 참조.
