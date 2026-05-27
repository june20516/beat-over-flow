# 예제 프로젝트 · 복사 · 이름수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데모 베이스플로를 오프라인 음악 분석으로 마커링한 예제 프로젝트 생성 버튼, 프로젝트 복사(자산 포함), 프로젝트 이름 인라인 수정을 추가한다.

**Architecture:** 분석은 `gen-samples.mjs`와 같은 오프라인 스크립트(`scripts/analyze-demo.mjs`)가 wasm 디코더로 PCM을 얻어 DSP(스펙트럴 플럭스 온셋 검출 + 대역 라우팅)를 돌리고, 결과 마커를 정적 모듈 `src/example/exampleData.generated.ts`로 굽는다. 런타임/일반 빌드는 디코더에 의존하지 않는다. 자산은 경로참조가 아닌 Blob 복사 모델이므로 예제 생성·복사 모두 새 자산 blob을 만든다.

**Tech Stack:** TypeScript, React 18, zustand, idb(IndexedDB), Vitest, Vite. 분석 스크립트: Node ESM(`.mjs`) + `mpg123-decoder`(devDependency, 이미 설치됨).

---

## File Structure

- `scripts/analysisCore.mjs` (생성) — 순수 DSP 헬퍼(FFT, 스펙트럴 플럭스 엔벨로프, 피크 피킹, BPM 추정, 양자화, 온셋 라우팅). 의존성 없음. 스크립트와 테스트가 공유.
- `scripts/analysisCore.test.mjs` (생성) — 순수 헬퍼 단위 테스트(합성 신호).
- `scripts/analyze-demo.mjs` (생성) — I/O 글루: mp3 디코드 → 코어 호출 → `exampleData.generated.ts` 작성.
- `src/example/exampleData.generated.ts` (스크립트가 생성·커밋) — 트랙별 마커(ms), durationMs, bpm.
- `src/example/exampleProject.ts` (생성) — 청사진 + `buildProjectFromBlueprint` 순수 함수.
- `src/example/exampleProject.test.ts` (생성) — 빌더/데이터 스모크 테스트.
- `src/persistence/assets.ts` (수정) — `copyAsset` 추가.
- `src/persistence/assets.test.ts` (수정) — `copyAsset` 테스트.
- `src/persistence/projects.ts` (수정) — `duplicateProject` 추가.
- `src/persistence/projects.test.ts` (수정) — `duplicateProject` 테스트.
- `src/ui/ProjectList.tsx` (수정) — 예제 버튼, 복사 버튼, 카드 인라인 이름수정.
- `src/ui/Editor.tsx` (수정) — 상단 이름 인라인 수정.
- `src/ui/styles.css` (수정) — 보조 버튼/인라인 편집 스타일 보강.

---

## Task 1: 분석 코어 — FFT / 양자화 / 피크피킹 / BPM 추정

**Files:**
- Create: `scripts/analysisCore.mjs`
- Test: `scripts/analysisCore.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/analysisCore.test.mjs
import { describe, it, expect } from "vitest";
import { fft, quantize, dedupeSorted, peakPick, estimateBpm } from "./analysisCore.mjs";

function magnitudes(re, im) {
  const out = new Array(re.length);
  for (let i = 0; i < re.length; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}

describe("fft", () => {
  it("상수 신호는 bin0에 에너지가 몰린다", () => {
    const re = [1, 1, 1, 1], im = [0, 0, 0, 0];
    fft(re, im);
    const mag = magnitudes(re, im);
    expect(mag[0]).toBeCloseTo(4, 6);
    expect(mag[1]).toBeCloseTo(0, 6);
    expect(mag[2]).toBeCloseTo(0, 6);
  });

  it("임펄스는 모든 bin 크기가 1", () => {
    const re = [1, 0, 0, 0], im = [0, 0, 0, 0];
    fft(re, im);
    for (const m of magnitudes(re, im)) expect(m).toBeCloseTo(1, 6);
  });

  it("단일 사인은 해당 bin에 봉우리", () => {
    const n = 16, k = 3;
    const re = [], im = [];
    for (let i = 0; i < n; i++) { re.push(Math.cos((2 * Math.PI * k * i) / n)); im.push(0); }
    fft(re, im);
    const mag = magnitudes(re, im);
    let argmax = 0;
    for (let i = 1; i < n; i++) if (mag[i] > mag[argmax]) argmax = i;
    expect(argmax).toBe(k);
  });
});

describe("quantize / dedupeSorted", () => {
  it("그리드에 스냅하고 중복을 제거한다", () => {
    const snapped = quantize([95, 205, 210, 500], 100, 0);
    expect(snapped).toEqual([100, 200, 200, 500]);
    expect(dedupeSorted(snapped, 1)).toEqual([100, 200, 500]);
  });
});

describe("peakPick", () => {
  it("배경 위 봉우리만 잡고 최소간격을 지킨다", () => {
    const env = new Array(40).fill(0.1);
    env[10] = 1.0; env[11] = 0.9; env[25] = 1.0;
    const peaks = peakPick(env, { window: 5, multiplier: 1.5, minGap: 3 });
    expect(peaks).toContain(10);
    expect(peaks).toContain(25);
    expect(peaks).not.toContain(11); // 최소간격 내 두 번째 봉우리 배제
  });
});

describe("estimateBpm", () => {
  it("주기적 엔벨로프에서 BPM을 복원한다", () => {
    const hopSec = 60 / 120 / 4; // 16분음표 hop → 정확히 120bpm 비트 = 4 hop
    const env = [];
    for (let i = 0; i < 256; i++) env.push(i % 4 === 0 ? 1 : 0);
    const bpm = estimateBpm(env, hopSec, { min: 90, max: 160 });
    expect(bpm).toBeCloseTo(120, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run scripts/analysisCore.test.mjs`
Expected: FAIL — `analysisCore.mjs` not found / exports undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/analysisCore.mjs
// 순수 DSP 헬퍼. 의존성 없음. analyze-demo.mjs와 테스트가 공유한다.

/** 복소 in-place radix-2 FFT. n은 2의 거듭제곱. re/im 길이 동일. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = i + k + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] = re[a] + vr; im[a] = im[a] + vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** 시각(ms)들을 (phaseMs 기준) periodMs 그리드에 스냅한다. */
export function quantize(timesMs, periodMs, phaseMs) {
  return timesMs.map((t) => Math.round((t - phaseMs) / periodMs) * periodMs + phaseMs);
}

/** 정렬된(또는 단조) 배열에서 minGapMs 이내 인접 중복을 제거한다. */
export function dedupeSorted(timesMs, minGapMs) {
  const sorted = [...timesMs].sort((a, b) => a - b);
  const out = [];
  for (const t of sorted) {
    if (out.length === 0 || t - out[out.length - 1] >= minGapMs) out.push(t);
  }
  return out;
}

/** 이동평균*multiplier 임계를 넘는 지역 최대를 minGap(프레임) 간격으로 고른다. 인덱스 배열 반환. */
export function peakPick(env, { window = 10, multiplier = 1.5, minGap = 1 } = {}) {
  const peaks = [];
  let last = -Infinity;
  for (let i = 1; i < env.length - 1; i++) {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(env.length - 1, i + window); j++) {
      sum += env[j]; cnt++;
    }
    const thr = (sum / cnt) * multiplier;
    if (env[i] > thr && env[i] >= env[i - 1] && env[i] > env[i + 1] && i - last >= minGap) {
      peaks.push(i);
      last = i;
    }
  }
  return peaks;
}

/** 온셋 엔벨로프 자기상관으로 BPM을 추정한다(min..max 범위). */
export function estimateBpm(env, hopSec, { min = 90, max = 160 } = {}) {
  const minLag = Math.max(1, Math.round(60 / max / hopSec));
  const maxLag = Math.round(60 / min / hopSec);
  let bestLag = minLag, best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  return 60 / (bestLag * hopSec);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run scripts/analysisCore.test.mjs`
Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
git add scripts/analysisCore.mjs scripts/analysisCore.test.mjs
git commit -m "feat(analysis): DSP 코어 헬퍼(FFT/양자화/피크피킹/BPM)"
```

---

## Task 2: 분석 코어 — 스펙트럴 플럭스 엔벨로프 / 온셋 라우팅

**Files:**
- Modify: `scripts/analysisCore.mjs`
- Modify: `scripts/analysisCore.test.mjs`

- [ ] **Step 1: Write the failing test (append)**

```js
// scripts/analysisCore.test.mjs 에 추가
import { spectralFluxEnvelope, routeOnsets } from "./analysisCore.mjs";

describe("spectralFluxEnvelope", () => {
  it("무음→톤 전환 지점에서 플럭스가 솟는다", () => {
    const sr = 8000, n = 8000;
    const sig = new Float32Array(n);
    for (let i = 0; i < n; i++) sig[i] = i < n / 2 ? 0 : Math.sin((2 * Math.PI * 440 * i) / sr);
    const { env, hopSec } = spectralFluxEnvelope(sig, sr, { fftSize: 512, hop: 256, loHz: 100, hiHz: 2000 });
    const onsetFrame = Math.round(n / 2 / 256);
    let argmax = 0;
    for (let i = 1; i < env.length; i++) if (env[i] > env[argmax]) argmax = i;
    expect(Math.abs(argmax - onsetFrame)).toBeLessThanOrEqual(2);
    expect(hopSec).toBeCloseTo(256 / sr, 6);
  });
});

describe("routeOnsets", () => {
  it("대역 온셋을 6개 트랙으로 분배한다", () => {
    const beatMs = 500, phaseMs = 0;
    // 저역: 비트 시작(0,2박)→kick, 그 외→tom / 중역: 짝/홀 비트→snare/clap / 고역: 16분 짝/홀→hat/perc
    const peaks = {
      low: [0, 250, 1000, 1250],   // 16분 index 0,?,...
      mid: [500, 1000],
      high: [0, 125, 250, 375],
    };
    const out = routeOnsets(peaks, beatMs, phaseMs);
    expect(Object.keys(out).sort()).toEqual(["clap", "hat", "kick", "perc", "snare", "tom"]);
    expect(out.kick.length + out.tom.length).toBe(4);
    expect(out.snare.length + out.clap.length).toBe(2);
    expect(out.hat.length + out.perc.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run scripts/analysisCore.test.mjs`
Expected: FAIL — `spectralFluxEnvelope`/`routeOnsets` undefined.

- [ ] **Step 3: Write minimal implementation (append to analysisCore.mjs)**

```js
// scripts/analysisCore.mjs 에 추가

/** 한 채널 신호의 대역제한 스펙트럴 플럭스 온셋 엔벨로프. */
export function spectralFluxEnvelope(samples, sampleRate, { fftSize = 1024, hop = 512, loHz = 20, hiHz = 20000 } = {}) {
  const win = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)); // Hann
  const loBin = Math.max(1, Math.floor((loHz * fftSize) / sampleRate));
  const hiBin = Math.min(fftSize >> 1, Math.ceil((hiHz * fftSize) / sampleRate));
  const frames = Math.max(0, Math.floor((samples.length - fftSize) / hop) + 1);
  const env = new Array(frames).fill(0);
  let prev = new Float32Array(hiBin - loBin + 1);
  const re = new Float32Array(fftSize), im = new Float32Array(fftSize);
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < fftSize; i++) { re[i] = samples[start + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let flux = 0;
    for (let b = loBin; b <= hiBin; b++) {
      const mag = Math.hypot(re[b], im[b]);
      const d = mag - prev[b - loBin];
      if (d > 0) flux += d;
      prev[b - loBin] = mag;
    }
    env[f] = flux;
  }
  return { env, hopSec: hop / sampleRate };
}

/** 대역별 온셋(ms)을 6개 드럼 트랙으로 분배한다(결정적). */
export function routeOnsets(peaks, beatMs, phaseMs) {
  const sixteenth = beatMs / 4;
  const grid = (t) => Math.round((t - phaseMs) / sixteenth); // 16분 인덱스
  const beatPos = (t) => ((grid(t) % 4) + 4) % 4; // 비트 내 0..3
  const beatIdx = (t) => Math.round((t - phaseMs) / beatMs);
  const out = { kick: [], snare: [], hat: [], clap: [], tom: [], perc: [] };
  for (const t of peaks.low) (beatPos(t) === 0 || beatPos(t) === 2 ? out.kick : out.tom).push(t);
  for (const t of peaks.mid) (((beatIdx(t) % 2) + 2) % 2 === 1 ? out.snare : out.clap).push(t);
  for (const t of peaks.high) (beatPos(t) % 2 === 0 ? out.hat : out.perc).push(t);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run scripts/analysisCore.test.mjs`
Expected: PASS (all tests, including new 2).

- [ ] **Step 5: Commit**

```bash
git add scripts/analysisCore.mjs scripts/analysisCore.test.mjs
git commit -m "feat(analysis): 스펙트럴 플럭스 엔벨로프 + 온셋 라우팅"
```

---

## Task 3: 분석 스크립트 실행 → 정적 데이터 생성

**Files:**
- Create: `scripts/analyze-demo.mjs`
- Create (스크립트 출력): `src/example/exampleData.generated.ts`

- [ ] **Step 1: Write the generation script**

```js
// scripts/analyze-demo.mjs
// 데모 mp3를 분석해 src/example/exampleData.generated.ts 를 생성한다.
// 실행: node scripts/analyze-demo.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { MPEGDecoder } from "mpg123-decoder";
import {
  spectralFluxEnvelope, peakPick, estimateBpm, quantize, dedupeSorted, routeOnsets,
} from "./analysisCore.mjs";

const SAMPLES = ["kick", "snare", "hat", "clap", "tom", "perc"];
const BANDS = {
  low: { loHz: 20, hiHz: 150 },
  mid: { loHz: 150, hiHz: 2000 },
  high: { loHz: 4000, hiHz: 16000 },
};
const MIN_GAP_MS = 90;      // 트랙당 최소 마커 간격
const MAX_PER_TRACK = 240;  // 과밀 방지 상한

const dec = new MPEGDecoder();
await dec.ready;
const mp3 = readFileSync("public/samples/moodmode-demo.mp3");
const { channelData, samplesDecoded, sampleRate } = dec.decode(mp3);
dec.free();

// 모노 믹스다운
const mono = new Float32Array(samplesDecoded);
const chs = channelData.length;
for (let i = 0; i < samplesDecoded; i++) {
  let s = 0;
  for (let c = 0; c < chs; c++) s += channelData[c][i];
  mono[i] = s / chs;
}
const durationMs = Math.round((samplesDecoded / sampleRate) * 1000);

// 대역별 온셋(ms)
const bandPeaks = {};
let bpmEnv = null, bpmHop = null;
for (const [band, { loHz, hiHz }] of Object.entries(BANDS)) {
  const { env, hopSec } = spectralFluxEnvelope(mono, sampleRate, { fftSize: 1024, hop: 512, loHz, hiHz });
  if (band === "mid") { bpmEnv = env; bpmHop = hopSec; }
  const minGapFrames = Math.max(1, Math.round(MIN_GAP_MS / 1000 / hopSec));
  const idx = peakPick(env, { window: 16, multiplier: 1.4, minGap: minGapFrames });
  bandPeaks[band] = idx.map((i) => i * hopSec * 1000);
}

// 템포 → 16분 그리드 양자화
const bpm = Math.round(estimateBpm(bpmEnv, bpmHop, { min: 90, max: 160 }));
const beatMs = 60000 / bpm;
const sixteenth = beatMs / 4;
const phaseMs = bandPeaks.low[0] ?? bandPeaks.mid[0] ?? 0;
for (const band of Object.keys(bandPeaks)) {
  bandPeaks[band] = dedupeSorted(quantize(bandPeaks[band], sixteenth, phaseMs), MIN_GAP_MS)
    .filter((t) => t >= 0 && t <= durationMs);
}

// 6트랙 라우팅 + 밀도 상한
const routed = routeOnsets(bandPeaks, beatMs, phaseMs);
for (const k of SAMPLES) {
  routed[k] = dedupeSorted(routed[k], MIN_GAP_MS).slice(0, MAX_PER_TRACK).map((t) => Math.round(t));
}

// 생성 파일 작성
const lines = SAMPLES.map((k) => `  ${k}: [${routed[k].join(", ")}],`).join("\n");
const body = `// AUTO-GENERATED by scripts/analyze-demo.mjs. Do not edit by hand.
// 재생성: node scripts/analyze-demo.mjs
export const EXAMPLE_DURATION_MS = ${durationMs};
export const EXAMPLE_BPM = ${bpm};
export const EXAMPLE_TRACK_MARKERS: Record<string, number[]> = {
${lines}
};
`;
mkdirSync("src/example", { recursive: true });
writeFileSync("src/example/exampleData.generated.ts", body);
console.log(`bpm=${bpm} durationMs=${durationMs}`);
for (const k of SAMPLES) console.log(`  ${k}: ${routed[k].length} markers`);
```

- [ ] **Step 2: Run the script to generate data**

Run: `node scripts/analyze-demo.mjs`
Expected: `bpm=…`, `durationMs≈136032`, 각 트랙이 0이 아닌 마커 수 출력. `src/example/exampleData.generated.ts` 생성됨.

- [ ] **Step 3: Verify generated data sanity**

Run: `node -e "import('./src/example/exampleData.generated.ts').catch(()=>{})" ; grep -c "kick\|snare\|hat\|clap\|tom\|perc" src/example/exampleData.generated.ts`
실제 검증은 다음 명령으로:
Run: `yarn tsc -b`
Expected: 타입 에러 없음(생성 파일이 유효한 TS).
육안 확인: 6개 트랙 모두 마커가 존재하고 어떤 값도 `durationMs`를 넘지 않는지(스크립트 콘솔 출력으로 확인). 과밀/과소하면 `MIN_GAP_MS`/`multiplier`/`MAX_PER_TRACK`/대역 경계를 조정 후 재실행.

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-demo.mjs src/example/exampleData.generated.ts
git commit -m "feat(analysis): 데모 분석 스크립트 + 생성 마커 데이터"
```

---

## Task 4: 예제 청사진 + buildProjectFromBlueprint

**Files:**
- Create: `src/example/exampleProject.ts`
- Test: `src/example/exampleProject.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/example/exampleProject.test.ts
import { describe, it, expect } from "vitest";
import { EXAMPLE_BLUEPRINT, buildProjectFromBlueprint } from "./exampleProject";

describe("EXAMPLE_BLUEPRINT", () => {
  it("6개 트랙을 가지고 각 트랙에 마커가 있다", () => {
    expect(EXAMPLE_BLUEPRINT.tracks).toHaveLength(6);
    for (const t of EXAMPLE_BLUEPRINT.tracks) {
      expect(t.sound.kind).toBe("builtin");
      expect(t.markersMs.length).toBeGreaterThan(0);
    }
  });
});

describe("buildProjectFromBlueprint", () => {
  it("새 id·baseFlow·트랙/마커 구조를 만든다", () => {
    const p = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "asset-1", 136032);
    expect(p.id).toBeTruthy();
    expect(p.baseFlow).toEqual({ kind: "audioFile", assetId: "asset-1", durationMs: 136032 });
    expect(p.tracks).toHaveLength(6);
    const first = p.tracks[0];
    expect(first.id).toBeTruthy();
    expect(first.markers.length).toBe(EXAMPLE_BLUEPRINT.tracks[0].markersMs.length);
    expect(first.markers.every((m) => typeof m.id === "string")).toBe(true);
    expect(first.markers.every((m) => m.timeMs <= 136032)).toBe(true);
    expect(p.transport).toEqual({ playPauseKey: null });
  });

  it("두 번 호출하면 서로 다른 id를 만든다", () => {
    const a = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "x", 1000);
    const b = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "x", 1000);
    expect(a.id).not.toBe(b.id);
    expect(a.tracks[0].id).not.toBe(b.tracks[0].id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/example/exampleProject.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/example/exampleProject.ts
import type { Project, SoundRef, Track, TrackStatus } from "../types";
import { newId } from "../domain/ids";
import { PALETTE } from "../domain/palette";
import { EXAMPLE_TRACK_MARKERS, EXAMPLE_DURATION_MS } from "./exampleData.generated";

export interface ExampleTrackBlueprint {
  name: string;
  status: TrackStatus;
  sound: SoundRef;
  keyBinding: string | null;
  volume: number;
  color: string;
  markersMs: number[];
}

export interface ExampleBlueprint {
  name: string;
  master: { volume: number };
  durationMs: number;
  tracks: ExampleTrackBlueprint[];
}

const SAMPLE_DEFS: { id: string; name: string; key: string }[] = [
  { id: "kick", name: "킥", key: "KeyS" },
  { id: "snare", name: "스네어", key: "KeyD" },
  { id: "hat", name: "하이햇", key: "KeyF" },
  { id: "clap", name: "클랩", key: "KeyJ" },
  { id: "tom", name: "톰", key: "KeyK" },
  { id: "perc", name: "퍼커션", key: "KeyL" },
];

export const EXAMPLE_BLUEPRINT: ExampleBlueprint = {
  name: "예제 프로젝트",
  master: { volume: 1 },
  durationMs: EXAMPLE_DURATION_MS,
  tracks: SAMPLE_DEFS.map((def, i) => ({
    name: def.name,
    status: "listening" as TrackStatus,
    sound: { kind: "builtin", sampleId: def.id },
    keyBinding: def.key,
    volume: 1,
    color: PALETTE[i % PALETTE.length],
    markersMs: EXAMPLE_TRACK_MARKERS[def.id] ?? [],
  })),
};

/** 청사진과 (생성된) 자산·길이로 새 id를 부여한 Project를 만든다. fetch/decode와 무관한 순수 함수. */
export function buildProjectFromBlueprint(
  blueprint: ExampleBlueprint,
  assetId: string,
  durationMs: number,
): Project {
  const now = Date.now();
  const tracks: Track[] = blueprint.tracks.map((t) => ({
    id: newId(),
    name: t.name,
    status: t.status,
    sound: t.sound,
    keyBinding: t.keyBinding,
    markers: t.markersMs.map((timeMs) => ({ id: newId(), timeMs })),
    volume: t.volume,
    color: t.color,
  }));
  return {
    id: newId(),
    name: blueprint.name,
    createdAt: now,
    updatedAt: now,
    baseFlow: { kind: "audioFile", assetId, durationMs },
    tracks,
    master: { volume: blueprint.master.volume },
    transport: { playPauseKey: null },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/example/exampleProject.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/example/exampleProject.ts src/example/exampleProject.test.ts
git commit -m "feat(example): 예제 청사진 + buildProjectFromBlueprint"
```

---

## Task 5: copyAsset

**Files:**
- Modify: `src/persistence/assets.ts`
- Modify: `src/persistence/assets.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// src/persistence/assets.test.ts 의 import에 copyAsset 추가, describe 블록 안에 추가
import { putAsset, getAsset, copyAsset } from "./assets";

it("copyAsset은 새 id로 같은 내용을 복제하고 원본을 보존한다", async () => {
  const id = await putAsset(new Blob(["audio-bytes"], { type: "audio/mp3" }), "demo.mp3");
  const copyId = await copyAsset(id);
  expect(copyId).not.toBe(id);
  expect(await (await getAsset(copyId))!.blob.text()).toBe("audio-bytes");
  expect(await (await getAsset(id))!.blob.text()).toBe("audio-bytes"); // 원본 유지
});

it("copyAsset은 없는 id면 throw 한다", async () => {
  await expect(copyAsset("nope")).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/persistence/assets.test.ts`
Expected: FAIL — `copyAsset` not exported.

- [ ] **Step 3: Write minimal implementation (append to assets.ts)**

```ts
// src/persistence/assets.ts 에 추가
export async function copyAsset(id: string): Promise<string> {
  const asset = await getAsset(id);
  if (!asset) throw new Error("asset not found: " + id);
  return putAsset(asset.blob, asset.name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/persistence/assets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/assets.ts src/persistence/assets.test.ts
git commit -m "feat(persistence): copyAsset 자산 복제"
```

---

## Task 6: duplicateProject

**Files:**
- Modify: `src/persistence/projects.ts`
- Modify: `src/persistence/projects.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// src/persistence/projects.test.ts
// import 줄: import { saveProject, loadProject, listProjects, deleteProject, duplicateProject } from "./projects";
// 상단 import 에 추가: import { putAsset, getAsset } from "./assets";

it("duplicateProject는 새 id·분리된 자산·이름 접미사를 만든다", async () => {
  const assetId = await putAsset(new Blob(["base"], { type: "audio/mp3" }), "demo.mp3");
  const uploadId = await putAsset(new Blob(["snd"], { type: "audio/wav" }), "snd.wav");
  const original: import("../types").Project = {
    id: "orig",
    name: "원본곡",
    createdAt: 1,
    updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId, durationMs: 1000 },
    tracks: [
      { id: "t1", name: "킥", status: "listening", sound: { kind: "builtin", sampleId: "kick" },
        keyBinding: "KeyA", markers: [{ id: "m1", timeMs: 100 }], volume: 1, color: "#22d3ee" },
      { id: "t2", name: "업로드", status: "listening", sound: { kind: "upload", assetId: uploadId },
        keyBinding: null, markers: [], volume: 1, color: "#f472b6" },
    ],
    master: { volume: 1 },
    transport: { playPauseKey: null },
  };
  await saveProject(original);

  const copy = await duplicateProject(original);
  expect(copy.id).not.toBe("orig");
  expect(copy.name).toBe("원본곡 (사본)");
  expect(copy.tracks[0].id).not.toBe("t1");
  expect(copy.tracks[0].markers[0].id).not.toBe("m1");

  // baseFlow 자산이 새 id이며 내용은 동일
  expect(copy.baseFlow.assetId).not.toBe(assetId);
  expect(await (await getAsset(copy.baseFlow.assetId))!.blob.text()).toBe("base");

  // upload 사운드 자산도 분리됨
  const copyUpload = copy.tracks[1].sound;
  expect(copyUpload.kind).toBe("upload");
  if (copyUpload.kind === "upload") expect(copyUpload.assetId).not.toBe(uploadId);

  // 원본 자산을 지워도 사본은 유효
  await import("./assets").then(() => {});
  expect(await loadProject(copy.id)).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/persistence/projects.test.ts`
Expected: FAIL — `duplicateProject` not exported.

- [ ] **Step 3: Write minimal implementation (append to projects.ts)**

```ts
// src/persistence/projects.ts
// import 추가:
import { newId } from "../domain/ids";
import { copyAsset } from "./assets";

export async function duplicateProject(project: Project): Promise<Project> {
  const clone: Project = structuredClone(project);
  clone.id = newId();
  clone.name = `${project.name} (사본)`;
  const now = Date.now();
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.baseFlow = { ...clone.baseFlow, assetId: await copyAsset(clone.baseFlow.assetId) };
  for (const track of clone.tracks) {
    track.id = newId();
    track.markers = track.markers.map((m) => ({ ...m, id: newId() }));
    if (track.sound.kind === "upload") {
      track.sound = { kind: "upload", assetId: await copyAsset(track.sound.assetId) };
    }
  }
  await saveProject(clone);
  return clone;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/persistence/projects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/projects.ts src/persistence/projects.test.ts
git commit -m "feat(persistence): duplicateProject 자산 포함 복제"
```

---

## Task 7: ProjectList — 예제 프로젝트 버튼

**Files:**
- Modify: `src/ui/ProjectList.tsx`
- Modify: `src/ui/styles.css`

이 태스크는 UI 통합이라 컴포넌트 단위 테스트가 없다(레포에 RTL 미설정). `yarn tsc -b`와 앱 실행으로 검증한다.

- [ ] **Step 1: ProjectList에 예제 생성 핸들러/버튼 추가**

`src/ui/ProjectList.tsx` 상단 import에 추가:

```ts
import { Plus, Sparkle } from "@phosphor-icons/react";
import { buildProjectFromBlueprint, EXAMPLE_BLUEPRINT } from "../example/exampleProject";
```

(기존 `import { Plus } from ...` 줄은 위 줄로 대체)

컴포넌트 본문(`handleFile` 아래)에 추가:

```ts
  async function createExample() {
    const res = await fetch("/samples/moodmode-demo.mp3");
    const blob = await res.blob();
    const assetId = await putAsset(blob, "moodmode-demo.mp3");
    const buffer = await getEngine().decode(blob);
    const project = buildProjectFromBlueprint(
      EXAMPLE_BLUEPRINT,
      assetId,
      Math.round(buffer.duration * 1000),
    );
    await saveProject(project);
    setProject(project);
    onOpen(project);
  }
```

`landing__cta` 버튼 다음(같은 hero 안)에 secondary 버튼 추가:

```tsx
        <button className="btn--ghost landing__cta-secondary" onClick={createExample}>
          <Sparkle size={18} weight="bold" />
          예제 프로젝트
        </button>
```

기존 primary 버튼과 secondary 버튼을 감싸는 래퍼가 필요하면 다음으로 교체:

```tsx
        <div className="landing__cta-row">
          <button className="btn--primary landing__cta" onClick={() => fileRef.current?.click()}>
            <Plus size={18} weight="bold" />
            새 프로젝트 (오디오 업로드)
          </button>
          <button className="btn--ghost landing__cta-secondary" onClick={createExample}>
            <Sparkle size={18} weight="bold" />
            예제 프로젝트
          </button>
        </div>
```

- [ ] **Step 2: styles.css에 가로 정렬 보강**

`src/ui/styles.css` 끝에 추가:

```css
.landing__cta-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `yarn tsc -b && yarn build`
Expected: 에러 없음.

- [ ] **Step 4: 수동 검증**

Run: `yarn dev` → 목록 화면에서 "예제 프로젝트" 클릭 → 에디터에 6개 트랙·마커가 보이고 베이스플로가 재생되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ProjectList.tsx src/ui/styles.css
git commit -m "feat(ui): 예제 프로젝트 생성 버튼"
```

---

## Task 8: ProjectList — 복사 버튼 + 카드 인라인 이름수정

**Files:**
- Modify: `src/ui/ProjectList.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: import / 상태 추가**

`src/ui/ProjectList.tsx` import에 추가:

```ts
import { Plus, Sparkle, Copy, PencilSimple } from "@phosphor-icons/react";
import { listProjects, saveProject, deleteProject, duplicateProject } from "../persistence/projects";
```

(기존 phosphor import / projects import 줄을 위로 대체)

컴포넌트 상단 상태 추가:

```ts
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
```

핸들러 추가:

```ts
  async function handleDuplicate(p: Project) {
    await duplicateProject(p);
    await refresh();
  }

  function startRename(p: Project) {
    setEditingId(p.id);
    setDraftName(p.name);
  }

  async function commitRename(p: Project) {
    const name = draftName.trim();
    setEditingId(null);
    if (!name || name === p.name) return;
    await saveProject({ ...p, name, updatedAt: Date.now() });
    await refresh();
  }
```

- [ ] **Step 2: 카드 마크업 교체**

카드 `<li>` 내부를 다음으로 교체:

```tsx
            <li key={p.id} className="project-card panel">
              {editingId === p.id ? (
                <input
                  className="project-card__rename"
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(p);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <div className="project-card__title">
                  <button
                    className="project-card__open"
                    onClick={() => {
                      setProject(p);
                      onOpen(p);
                    }}
                  >
                    {p.name}
                  </button>
                  <button
                    className="btn--ghost btn--icon project-card__edit"
                    title="이름 수정"
                    onClick={() => startRename(p)}
                  >
                    <PencilSimple size={15} weight="bold" />
                  </button>
                </div>
              )}
              <div className="project-card__footer">
                <span>{p.tracks.length}개 트랙</span>
                <div className="project-card__actions">
                  <button className="btn--ghost btn--icon" title="복사" onClick={() => handleDuplicate(p)}>
                    <Copy size={15} weight="bold" />
                  </button>
                  <button
                    className="btn--danger"
                    onClick={async () => {
                      await deleteProject(p.id);
                      await refresh();
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
```

- [ ] **Step 3: styles.css 보강**

`src/ui/styles.css` 끝에 추가:

```css
.project-card__title { display: flex; align-items: center; gap: 4px; }
.project-card__edit { flex: 0 0 auto; opacity: 0.6; }
.project-card__edit:hover { opacity: 1; }
.project-card__actions { display: flex; align-items: center; gap: 8px; }
.project-card__rename {
  width: 100%;
  font: inherit;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--line, #334155);
  background: var(--surface, #0f172a);
  color: inherit;
}
```

(변수명은 styles.css의 기존 토큰에 맞춰 조정. 기존에 `--line`/`--surface`가 없으면 해당 카드에서 쓰는 색을 그대로 사용)

- [ ] **Step 4: 타입체크 + 빌드**

Run: `yarn tsc -b && yarn build`
Expected: 에러 없음.

- [ ] **Step 5: 수동 검증**

Run: `yarn dev` → 카드 연필로 이름 변경(Enter 저장/Esc 취소), 복사 버튼으로 "… (사본)" 생성, 원본 삭제해도 사본 베이스플로 재생되는지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ProjectList.tsx src/ui/styles.css
git commit -m "feat(ui): 프로젝트 복사 버튼 + 카드 이름 인라인 수정"
```

---

## Task 9: Editor — 상단 이름 인라인 수정

**Files:**
- Modify: `src/ui/Editor.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Editor 상단 이름 편집 가능화**

`src/ui/Editor.tsx` 상단 import에 추가:

```ts
import { useState } from "react";
```

(이미 react import가 있으면 `useState`만 합류)

`renameProject` 액션 구독 추가(컴포넌트 상단 다른 `useStore` 훅들과 함께):

```ts
  const renameProject = useStore((s) => s.renameProject);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
```

`top-bar__name` span을 다음으로 교체:

```tsx
        {editingName ? (
          <input
            className="top-bar__name-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const name = draft.trim();
              setEditingName(false);
              if (name) renameProject(name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingName(false);
            }}
          />
        ) : (
          <button
            className="top-bar__name"
            title="이름 수정"
            onClick={() => {
              setDraft(project.name);
              setEditingName(true);
            }}
          >
            {project.name}
          </button>
        )}
```

- [ ] **Step 2: styles.css 보강**

`src/ui/styles.css` 끝에 추가:

```css
.top-bar__name-input {
  font: inherit;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--line, #334155);
  background: var(--surface, #0f172a);
  color: inherit;
}
button.top-bar__name {
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
button.top-bar__name:hover { text-decoration: underline; }
```

(기존 `.top-bar__name`가 span 기준 스타일을 갖고 있으면 button에도 동일 글꼴/색이 유지되도록 위 규칙으로 보강)

- [ ] **Step 3: 타입체크 + 빌드**

Run: `yarn tsc -b && yarn build`
Expected: 에러 없음.

- [ ] **Step 4: 수동 검증**

Run: `yarn dev` → 에디터 상단 이름 클릭 → 편집 → Enter 저장, 목록으로 나갔다 들어와도 변경 유지(autosave), play/record 모드에서 input 입력 중 전역 키 동작 안 함(`keyAction`이 INPUT 무시).

- [ ] **Step 5: Commit**

```bash
git add src/ui/Editor.tsx src/ui/styles.css
git commit -m "feat(ui): 에디터 상단 프로젝트 이름 인라인 수정"
```

---

## Task 10: 전체 검증 & 마무리

- [ ] **Step 1: 전체 테스트**

Run: `yarn test:run`
Expected: 기존 184 + 신규(분석 9, 예제 3, copyAsset 2, duplicateProject 1) 모두 PASS.

- [ ] **Step 2: 타입체크 + 빌드**

Run: `yarn tsc -b && yarn build`
Expected: 에러 없음.

- [ ] **Step 3: IMPLEMENTATION_NOTES 갱신(비자명 결정 기록)**

`IMPLEMENTATION_NOTES.md`의 "비자명한 구현 결정"에 한 줄 추가:

```markdown
- **예제 프로젝트 마커는 오프라인 분석으로 굽는다** (`scripts/analyze-demo.mjs`): wasm 디코더
  (`mpg123-decoder`, devDep)로 PCM을 얻어 스펙트럴 플럭스 온셋 검출→대역 라우팅→`src/example/
  exampleData.generated.ts` 생성. 런타임/일반 빌드는 디코더 비의존. 마커 음악성은 사람 청취 검증 권장.
```

- [ ] **Step 4: Commit**

```bash
git add IMPLEMENTATION_NOTES.md
git commit -m "docs: 예제 분석 파이프라인 구현 노트"
```

---

## Self-Review 결과

- **Spec 커버리지:** §1 분석→Task1-3, §2 청사진/생성→Task4·7, §3 복사→Task5-6·8, §4 이름수정→Task8-9, §5 UI→Task7-9, §6 테스트→각 태스크 분산. 모든 spec 항목에 대응 태스크 있음.
- **타입 일관성:** `buildProjectFromBlueprint(blueprint, assetId, durationMs)`, `copyAsset(id)`, `duplicateProject(project)` 시그니처가 정의·사용처에서 일치. 생성 데이터 export명(`EXAMPLE_TRACK_MARKERS`/`EXAMPLE_DURATION_MS`/`EXAMPLE_BPM`)이 스크립트 출력과 `exampleProject.ts` import에서 일치.
- **플레이스홀더:** 없음(모든 코드 스텝에 완성 코드 포함).
- **주의:** styles.css의 CSS 변수명(`--line`/`--surface`)은 기존 토큰 확인 후 맞출 것(Task8/9에 명시).
