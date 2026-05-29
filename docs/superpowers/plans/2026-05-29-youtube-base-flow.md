# 유튜브 임베드 베이스 플로우 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유튜브 영상을 베이스 플로우 소스로 파일과 동등하게 사용하고, 트랜스포트로 제어하며 마커·마커힛을 보존한다.

**Architecture:** 기존 `BaseFlowSource` 추상화에 `YouTubeSource`를 추가한다. 유튜브의 거친 `getCurrentTime()`을 순수 `InterpolatedClock`으로 매끄럽게 만들어 스케줄러/RAF를 무변경으로 재사용한다. `BaseFlowRef`를 union으로 확장하고 `loadBaseFlow`만 `kind`로 분기한다. UI는 미니/앰비언트 플레이어 토글 + 베이스 플로우 피커 + nudge 슬라이더를 더한다.

**Tech Stack:** TypeScript, React 18, zustand 4, vitest 2(+jsdom), idb. YouTube IFrame Player API. (RTL 미설치 → 컴포넌트는 수동 검증, 로직은 순수함수/스토어 단위 테스트.)

**참고 스펙:** `docs/superpowers/specs/2026-05-29-youtube-base-flow-design.md`

**테스트 실행:** 단일 파일은 `yarn vitest run <path>`, 전체는 `yarn test:run`.

---

## File Structure

신규:
- `src/domain/youtube.ts` — `parseYouTubeId` 순수 함수.
- `src/domain/youtube.test.ts`
- `src/domain/baseFlowView.ts` — `DEFAULT_BASE_FLOW_VIEW`, `resolveBaseFlowView`.
- `src/domain/baseFlowView.test.ts`
- `src/domain/markerClip.ts` — `clipMarkersForDisplay` 순수 함수.
- `src/domain/markerClip.test.ts`
- `src/audio/InterpolatedClock.ts` — 보간 클럭(순수, 주입형 now).
- `src/audio/InterpolatedClock.test.ts`
- `src/audio/youtubeApi.ts` — IFrame API 로더 + `YTPlayerLike` 타입 + `createYouTubePlayer`.
- `src/audio/YouTubeSource.ts` — `BaseFlowSource` 구현.
- `src/audio/YouTubeSource.test.ts`
- `src/ui/YouTubePlayer.tsx` — 플레이어 마운트(미니/앰비언트).
- `src/ui/ProgressBarLane.tsx` — 유튜브용 진행바 레인(파형 레인 대체).
- `src/ui/BaseFlowPicker.tsx` — 파일/유튜브 탭 + URL 입력.

수정:
- `src/types.ts` — `BaseFlowRef` union, `Project.baseFlowView`.
- `src/persistence/projects.ts` — `normalizeProject` 기본값, `duplicateProject` 유튜브 분기.
- `src/store/useStore.ts` — `baseFlowLoading` + 베이스 플로우 액션들.
- `src/audio/runtime.ts` — `loadBaseFlow` 분기, 로딩 상태.
- `src/ui/Editor.tsx` — 로드 분기, 플레이어/레인/피커 통합.
- `src/ui/Timeline.tsx` — 진행바 레인 vs 파형 분기, 마커 클립.
- `src/ui/TransportBar.tsx` — 로딩 중 재생 비활성, nudge 슬라이더.

---

## Task 1: 타입 확장 (`BaseFlowRef` union + `baseFlowView`)

**Files:**
- Modify: `src/types.ts:4` (BaseFlowRef), `src/types.ts:28-39` (Project)

- [ ] **Step 1: `BaseFlowRef`를 union으로 확장**

`src/types.ts`의 4번 줄을 교체:

```ts
export type BaseFlowRef =
  | { kind: "audioFile"; assetId: string; durationMs: number }
  | { kind: "youtube"; videoId: string; durationMs: number; startMs?: number; offsetMs?: number };
```

- [ ] **Step 2: `Project`에 `baseFlowView` 추가**

`src/types.ts`의 `Project` 인터페이스에 필드 추가(`libraryAssetIds` 위/아래 아무 곳):

```ts
  /** 유튜브 플레이어 배치/표현 뷰 설정(프로젝트당 영속). 구 저장본엔 없을 수 있어 optional. */
  baseFlowView?: { layout: "mini" | "ambient"; ambientIntensity: number };
```

- [ ] **Step 3: 타입체크로 컴파일 확인**

Run: `yarn tsc -b`
Expected: 기존 코드에서 `baseFlow.assetId` 직접 접근부가 union 때문에 에러가 날 수 있다. 다음 Task들에서 분기/가드로 해소한다. 이 시점에 나는 에러 목록을 메모해두고 진행한다(예: `runtime.ts`, `Editor.tsx`, `persistence/projects.ts`, `TransportBar.tsx`). `durationMs`는 두 variant 공통이라 `TransportBar`의 `baseFlow.durationMs`는 통과한다.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add youtube BaseFlowRef variant and baseFlowView"
```

---

## Task 2: `parseYouTubeId` 순수 함수

**Files:**
- Create: `src/domain/youtube.ts`, `src/domain/youtube.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/domain/youtube.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseYouTubeId } from "./youtube";

describe("parseYouTubeId", () => {
  it("watch?v= URL에서 id 추출", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("부가 쿼리가 있어도 id 추출", () => {
    expect(parseYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
  });
  it("youtu.be 단축 URL", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
  });
  it("embed URL", () => {
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("순수 11자 id 입력은 그대로", () => {
    expect(parseYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("유효하지 않으면 null", () => {
    expect(parseYouTubeId("https://example.com/foo")).toBeNull();
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId("not a url")).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/domain/youtube.test.ts`
Expected: FAIL — `parseYouTubeId` 미정의.

- [ ] **Step 3: 구현**

`src/domain/youtube.ts`:

```ts
/** 유튜브 영상 ID는 11자의 [A-Za-z0-9_-]. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** URL 또는 순수 ID에서 11자 영상 ID를 추출한다. 실패 시 null. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (ID_RE.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/embed/")) {
      candidate = url.pathname.slice("/embed/".length).split("/")[0] ?? null;
    }
  }

  return candidate && ID_RE.test(candidate) ? candidate : null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/domain/youtube.test.ts`
Expected: PASS (6 케이스).

- [ ] **Step 5: Commit**

```bash
git add src/domain/youtube.ts src/domain/youtube.test.ts
git commit -m "feat(domain): parseYouTubeId from url or raw id"
```

---

## Task 3: `baseFlowView` 기본값 + normalize + duplicate 유튜브 분기

**Files:**
- Create: `src/domain/baseFlowView.ts`, `src/domain/baseFlowView.test.ts`
- Modify: `src/persistence/projects.ts:17-27` (normalizeProject), `src/persistence/projects.ts:66-101` (duplicateProject)
- Test: `src/persistence/projects.migrate.test.ts`

- [ ] **Step 1: baseFlowView 기본값 헬퍼 테스트**

`src/domain/baseFlowView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_FLOW_VIEW, resolveBaseFlowView } from "./baseFlowView";

describe("resolveBaseFlowView", () => {
  it("없으면 기본값", () => {
    expect(resolveBaseFlowView(undefined)).toEqual(DEFAULT_BASE_FLOW_VIEW);
  });
  it("기본값은 mini / 0.5", () => {
    expect(DEFAULT_BASE_FLOW_VIEW).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });
  it("주어지면 그대로", () => {
    const v = { layout: "ambient" as const, ambientIntensity: 0.8 };
    expect(resolveBaseFlowView(v)).toEqual(v);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/domain/baseFlowView.test.ts`
Expected: FAIL — 모듈 미정의.

- [ ] **Step 3: 구현**

`src/domain/baseFlowView.ts`:

```ts
import type { Project } from "../types";

export type BaseFlowView = NonNullable<Project["baseFlowView"]>;

export const DEFAULT_BASE_FLOW_VIEW: BaseFlowView = {
  layout: "mini",
  ambientIntensity: 0.5,
};

export function resolveBaseFlowView(view: Project["baseFlowView"]): BaseFlowView {
  return view ?? DEFAULT_BASE_FLOW_VIEW;
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/domain/baseFlowView.test.ts`
Expected: PASS.

- [ ] **Step 5: normalizeProject에 기본값 주입(레거시 호환)**

`src/persistence/projects.ts`의 `normalizeProject`(17-27줄)를 교체. 기존 동작 보존 + `baseFlowView` 기본값:

```ts
function normalizeProject(p: Project): Project {
  const tracks = p.tracks.map(normalizeTrack);
  const declared = new Set(p.libraryAssetIds ?? []);
  for (const t of tracks) {
    if (t.sound.kind === "upload") declared.add(t.sound.assetId);
    for (const s of t.recentSounds) {
      if (s.kind === "upload") declared.add(s.assetId);
    }
  }
  return {
    ...p,
    tracks,
    libraryAssetIds: Array.from(declared),
    baseFlowView: p.baseFlowView ?? DEFAULT_BASE_FLOW_VIEW,
  };
}
```

파일 상단 import에 추가:

```ts
import { DEFAULT_BASE_FLOW_VIEW } from "../domain/baseFlowView";
```

- [ ] **Step 6: duplicateProject 유튜브 분기(중요)**

`src/persistence/projects.ts`의 73번 줄:

```ts
  clone.baseFlow = { ...clone.baseFlow, assetId: await copyAsset(clone.baseFlow.assetId) };
```

을 다음으로 교체(유튜브는 복사할 asset이 없음):

```ts
  if (clone.baseFlow.kind === "audioFile") {
    clone.baseFlow = { ...clone.baseFlow, assetId: await copyAsset(clone.baseFlow.assetId) };
  }
  // youtube baseFlow는 blob 자산이 없어 그대로 복제된다.
```

- [ ] **Step 7: 마이그레이션 테스트 추가**

`src/persistence/projects.migrate.test.ts`에 케이스 추가(파일 끝 `describe` 블록 안):

```ts
  it("baseFlowView 누락 시 기본값(mini/0.5)으로 채운다", async () => {
    const id = newId();
    const legacy = {
      id, name: "t", createdAt: 0, updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
      tracks: [], master: { volume: 1 }, libraryAssetIds: [],
    } as unknown as Project;
    await saveProject(legacy);
    const loaded = await loadProject(id);
    expect(loaded?.baseFlowView).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });
```

> 참고: 기존 마이그레이션 테스트 상단은 `fake-indexeddb/auto` import 패턴을 따른다. 새 케이스도 동일 `describe`에 두면 같은 셋업을 공유한다.

- [ ] **Step 8: 테스트 통과 확인**

Run: `yarn vitest run src/persistence/projects.migrate.test.ts`
Expected: PASS (신규 케이스 포함).

- [ ] **Step 9: Commit**

```bash
git add src/domain/baseFlowView.ts src/domain/baseFlowView.test.ts src/persistence/projects.ts src/persistence/projects.migrate.test.ts
git commit -m "feat(persistence): default baseFlowView + youtube-safe duplicate"
```

---

## Task 4: `clipMarkersForDisplay` 순수 함수

**Files:**
- Create: `src/domain/markerClip.ts`, `src/domain/markerClip.test.ts`

- [ ] **Step 1: 실패 테스트**

`src/domain/markerClip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clipMarkersForDisplay } from "./markerClip";
import type { Marker } from "../types";

const mk = (id: string, timeMs: number): Marker => ({ id, timeMs });

describe("clipMarkersForDisplay", () => {
  it("durationMs 이하만 남긴다(절대시간 보존, 표시만 클립)", () => {
    const markers = [mk("a", 0), mk("b", 500), mk("c", 1500)];
    expect(clipMarkersForDisplay(markers, 1000)).toEqual([mk("a", 0), mk("b", 500)]);
  });
  it("경계값 포함(== durationMs)", () => {
    expect(clipMarkersForDisplay([mk("a", 1000)], 1000)).toEqual([mk("a", 1000)]);
  });
  it("durationMs 0 또는 음수면 빈 배열", () => {
    expect(clipMarkersForDisplay([mk("a", 0)], 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/domain/markerClip.test.ts`
Expected: FAIL — 미정의.

- [ ] **Step 3: 구현**

`src/domain/markerClip.ts`:

```ts
import type { Marker } from "../types";

/**
 * 표시용 마커 클립. 마커 데이터(절대시간)는 보존하고, 베이스 플로우 길이를
 * 초과하는 마커만 렌더에서 제외한다. 소스 전환 시 짧은 소스로 바뀌어도
 * 데이터는 손상되지 않는다.
 */
export function clipMarkersForDisplay(markers: Marker[], durationMs: number): Marker[] {
  if (durationMs <= 0) return [];
  return markers.filter((m) => m.timeMs <= durationMs);
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/domain/markerClip.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/markerClip.ts src/domain/markerClip.test.ts
git commit -m "feat(domain): clipMarkersForDisplay (preserve data, clip render)"
```

---

## Task 5: `InterpolatedClock` (순수 보간 클럭)

**Files:**
- Create: `src/audio/InterpolatedClock.ts`, `src/audio/InterpolatedClock.test.ts`

- [ ] **Step 1: 실패 테스트**

`src/audio/InterpolatedClock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InterpolatedClock } from "./InterpolatedClock";

/** 주입형 가짜 시계. */
function fakeNow() {
  let t = 0;
  const fn = () => t;
  return { fn, advance: (ms: number) => { t += ms; } };
}

describe("InterpolatedClock", () => {
  it("정지 상태에선 마지막 동기화 값을 반환", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(2000);
    clk.advance(500);
    expect(c.currentMs()).toBe(2000);
  });

  it("재생 중에는 now 경과만큼 보간", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(2000);
    c.setRunning(true);
    clk.advance(300);
    expect(c.currentMs()).toBe(2300);
  });

  it("setRunning(false)는 현재 보간값을 고정", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(1000);
    c.setRunning(true);
    clk.advance(400);
    c.setRunning(false); // 1400에서 고정
    clk.advance(1000);
    expect(c.currentMs()).toBe(1400);
  });

  it("재생 중 sync는 드리프트를 보정(리싱크)", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(1000);
    c.setRunning(true);
    clk.advance(500); // 보간상 1500
    c.sync(1480);     // 실제 유튜브가 1480이라고 알림 → 리앵커
    clk.advance(100);
    expect(c.currentMs()).toBe(1580);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/audio/InterpolatedClock.test.ts`
Expected: FAIL — 미정의.

- [ ] **Step 3: 구현**

`src/audio/InterpolatedClock.ts`:

```ts
/**
 * 거친 미디어 시간(유튜브 getCurrentTime 등)을 매끄러운 재생 위치로 보간한다.
 * - sync(mediaMs): 외부에서 신뢰할 수 있는 위치를 알려줄 때(폴링/시크/상태변경) 호출. 리앵커.
 * - setRunning(bool): 재생/정지 전환. 정지 시 현재 보간값을 고정.
 * - currentMs(): 재생 중이면 now 경과를 더해 보간, 정지면 고정값.
 * now는 주입(테스트 용이). 실사용은 () => performance.now().
 */
export class InterpolatedClock {
  private mediaMs = 0;
  private anchorNow: number;
  private running = false;

  constructor(private readonly now: () => number) {
    this.anchorNow = now();
  }

  sync(mediaMs: number): void {
    this.mediaMs = mediaMs;
    this.anchorNow = this.now();
  }

  setRunning(running: boolean): void {
    this.mediaMs = this.currentMs(); // 전환 직전 보간값 고정
    this.anchorNow = this.now();
    this.running = running;
  }

  currentMs(): number {
    if (!this.running) return this.mediaMs;
    return this.mediaMs + (this.now() - this.anchorNow);
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/audio/InterpolatedClock.test.ts`
Expected: PASS (4 케이스).

- [ ] **Step 5: Commit**

```bash
git add src/audio/InterpolatedClock.ts src/audio/InterpolatedClock.test.ts
git commit -m "feat(audio): InterpolatedClock for smooth media position"
```

---

## Task 6: YouTube IFrame API 로더 + `YTPlayerLike`

**Files:**
- Create: `src/audio/youtubeApi.ts`

> 이 모듈은 DOM/외부 스크립트에 의존해 단위 테스트가 어렵다. 인터페이스(`YTPlayerLike`)를 노출해 다음 Task의 `YouTubeSource`가 가짜 구현으로 테스트되게 한다. 이 파일 자체는 수동/통합 검증 대상.

- [ ] **Step 1: 구현**

`src/audio/youtubeApi.ts`:

```ts
/** YouTubeSource가 의존하는 최소 플레이어 인터페이스(실제 YT.Player의 부분집합). */
export interface YTPlayerLike {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  /** -1 UNSTARTED, 0 ENDED, 1 PLAYING, 2 PAUSED, 3 BUFFERING, 5 CUED */
  getPlayerState(): number;
  destroy(): void;
}

export const YT_STATE = {
  UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5,
} as const;

interface YTGlobal {
  Player: new (el: HTMLElement, opts: unknown) => YTPlayerLike;
}
declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTGlobal> | null = null;

/** IFrame API 스크립트를 1회 주입하고 준비될 때까지 대기. */
export function loadYouTubeIframeApi(): Promise<YTGlobal> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTGlobal>((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export interface CreatePlayerHandlers {
  onReady: () => void;
  onStateChange: (state: number) => void;
  onError: (code: number) => void;
}

/** 컨테이너에 플레이어를 생성하고 onReady 후 resolve. */
export async function createYouTubePlayer(
  container: HTMLElement,
  videoId: string,
  startSeconds: number,
  handlers: CreatePlayerHandlers,
): Promise<YTPlayerLike> {
  const YT = await loadYouTubeIframeApi();
  return new Promise<YTPlayerLike>((resolve) => {
    const player: YTPlayerLike = new YT.Player(container, {
      videoId,
      playerVars: { start: Math.floor(startSeconds), playsinline: 1, rel: 0, controls: 1 },
      events: {
        onReady: () => {
          handlers.onReady();
          resolve(player);
        },
        onStateChange: (e: { data: number }) => handlers.onStateChange(e.data),
        onError: (e: { data: number }) => handlers.onError(e.data),
      },
    });
  });
}
```

- [ ] **Step 2: 타입체크**

Run: `yarn tsc -b`
Expected: 이 파일은 통과. (전역 `Window` 확장 포함.)

- [ ] **Step 3: Commit**

```bash
git add src/audio/youtubeApi.ts
git commit -m "feat(audio): youtube iframe api loader and YTPlayerLike"
```

---

## Task 7: `YouTubeSource` (BaseFlowSource 구현)

**Files:**
- Create: `src/audio/YouTubeSource.ts`, `src/audio/YouTubeSource.test.ts`

- [ ] **Step 1: 실패 테스트(가짜 player + 가짜 clock)**

`src/audio/YouTubeSource.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { YouTubeSource } from "./YouTubeSource";
import { YT_STATE, type YTPlayerLike } from "./youtubeApi";

class FakePlayer implements YTPlayerLike {
  state = YT_STATE.PAUSED;
  current = 0;        // seconds
  duration = 100;     // seconds
  played = false;
  paused = false;
  sought: number | null = null;
  destroyed = false;
  playVideo() { this.played = true; }
  pauseVideo() { this.paused = true; }
  seekTo(s: number) { this.sought = s; this.current = s; }
  getCurrentTime() { return this.current; }
  getDuration() { return this.duration; }
  getPlayerState() { return this.state; }
  destroy() { this.destroyed = true; }
}

function fakeNow() {
  let t = 0;
  return { fn: () => t, advance: (ms: number) => { t += ms; } };
}

describe("YouTubeSource", () => {
  it("durationMs는 player.getDuration()*1000", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    expect(s.durationMs).toBe(100000);
  });

  it("play/pause/seek를 플레이어에 위임", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    s.play(); expect(p.played).toBe(true);
    s.pause(); expect(p.paused).toBe(true);
    s.seek(5000); expect(p.sought).toBe(5); // ms→s
  });

  it("PLAYING 상태에서만 isPlaying true", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    p.state = YT_STATE.BUFFERING; s.onStateChange(YT_STATE.BUFFERING);
    expect(s.isPlaying()).toBe(false);
    p.state = YT_STATE.PLAYING; s.onStateChange(YT_STATE.PLAYING);
    expect(s.isPlaying()).toBe(true);
  });

  it("재생 중 currentTimeMs는 보간되고 offsetMs가 더해진다", () => {
    const p = new FakePlayer();
    const clk = fakeNow();
    const s = new YouTubeSource(p, 120, clk.fn); // offset 120ms
    p.current = 10; // 10s
    p.state = YT_STATE.PLAYING;
    s.onStateChange(YT_STATE.PLAYING); // sync(10000) + running
    clk.advance(250);
    expect(s.currentTimeMs()).toBe(10000 + 250 + 120);
  });

  it("currentTimeMs는 [0, durationMs]로 클램프", () => {
    const p = new FakePlayer();
    p.duration = 5; p.current = 5;
    const s = new YouTubeSource(p, 1000, fakeNow().fn);
    p.state = YT_STATE.PLAYING; s.onStateChange(YT_STATE.PLAYING);
    expect(s.currentTimeMs()).toBe(5000); // 5000+offset이 dur로 클램프
  });

  it("dispose는 player.destroy 호출", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    s.dispose();
    expect(p.destroyed).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/audio/YouTubeSource.test.ts`
Expected: FAIL — 미정의.

- [ ] **Step 3: 구현**

`src/audio/YouTubeSource.ts`:

```ts
import type { BaseFlowSource } from "./BaseFlowSource";
import { InterpolatedClock } from "./InterpolatedClock";
import { YT_STATE, type YTPlayerLike } from "./youtubeApi";

const POLL_INTERVAL_MS = 250;

/** 유튜브 플레이어를 BaseFlowSource로 어댑트한다. 보간 클럭으로 매끄러운 위치 제공. */
export class YouTubeSource implements BaseFlowSource {
  readonly durationMs: number;
  private readonly clock: InterpolatedClock;
  private playing = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly player: YTPlayerLike,
    private readonly offsetMs: number,
    now: () => number = () => performance.now(),
  ) {
    this.durationMs = player.getDuration() * 1000;
    this.clock = new InterpolatedClock(now);
    this.clock.sync(player.getCurrentTime() * 1000);
    this.startPolling();
  }

  /** youtubeApi onStateChange 핸들러에서 호출(외부 배선). */
  onStateChange(state: number): void {
    const wasPlaying = this.playing;
    this.playing = state === YT_STATE.PLAYING;
    // 상태 전환 시 신뢰할 수 있는 위치로 리싱크
    this.clock.sync(this.player.getCurrentTime() * 1000);
    if (this.playing !== wasPlaying) this.clock.setRunning(this.playing);
  }

  currentTimeMs(): number {
    const t = this.clock.currentMs() + this.offsetMs;
    return Math.min(this.durationMs, Math.max(0, t));
  }

  isPlaying(): boolean {
    return this.playing;
  }

  play(): void {
    this.player.playVideo();
  }

  pause(): void {
    this.player.pauseVideo();
  }

  seek(ms: number): void {
    const clamped = Math.min(this.durationMs, Math.max(0, ms));
    this.player.seekTo(clamped / 1000, true);
    this.clock.sync(clamped);
  }

  dispose(): void {
    this.stopPolling();
    this.player.destroy();
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = setInterval(() => {
      // 재생 중에만 주기적 리싱크(드리프트 보정).
      if (this.playing) this.clock.sync(this.player.getCurrentTime() * 1000);
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
```

> 주의: `onStateChange`에서 `setRunning`은 상태가 바뀔 때만 호출하므로, 재생 중 주기적 `sync`는 클럭의 running 플래그를 유지한 채 앵커만 갱신한다(테스트 4가 이를 검증).

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/audio/YouTubeSource.test.ts`
Expected: PASS (6 케이스).

> 만약 테스트 4가 250 오차로 실패하면, `onStateChange`가 `setRunning(true)`로 앵커를 now=0에서 잡은 뒤 advance(250) → currentMs=mediaMs(10000)+250, +offset 120 = 10370. 기대값과 일치해야 한다. 불일치 시 `setRunning` 호출 순서(먼저 sync 후 setRunning)를 확인한다.

- [ ] **Step 5: Commit**

```bash
git add src/audio/YouTubeSource.ts src/audio/YouTubeSource.test.ts
git commit -m "feat(audio): YouTubeSource adapting iframe player to BaseFlowSource"
```

---

## Task 8: 스토어 — `baseFlowLoading` + 베이스 플로우 액션

**Files:**
- Modify: `src/store/useStore.ts` (interface 9-50, 구현 79~)
- Test: `src/store/useStore.baseFlow.test.ts` (신규)

- [ ] **Step 1: 실패 테스트**

`src/store/useStore.baseFlow.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";

function baseProject(): Project {
  return {
    id: "p1", name: "t", createdAt: 0, updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
    tracks: [], master: { volume: 1 }, libraryAssetIds: [],
    baseFlowView: { layout: "mini", ambientIntensity: 0.5 },
  };
}

describe("store baseFlow 액션", () => {
  beforeEach(() => useStore.getState().setProject(baseProject()));

  it("setBaseFlow는 baseFlow를 교체(마커/트랙 불변)", () => {
    useStore.getState().setBaseFlow({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 5000 });
    const bf = useStore.getState().project!.baseFlow;
    expect(bf.kind).toBe("youtube");
    expect(bf.durationMs).toBe(5000);
  });

  it("setBaseFlowDurationMs는 현재 baseFlow 길이만 갱신", () => {
    useStore.getState().setBaseFlowDurationMs(7777);
    expect(useStore.getState().project!.baseFlow.durationMs).toBe(7777);
  });

  it("setBaseFlowView는 부분 병합", () => {
    useStore.getState().setBaseFlowView({ layout: "ambient" });
    expect(useStore.getState().project!.baseFlowView).toEqual({ layout: "ambient", ambientIntensity: 0.5 });
  });

  it("setBaseFlowOffsetMs는 youtube일 때만 반영", () => {
    useStore.getState().setBaseFlow({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 5000 });
    useStore.getState().setBaseFlowOffsetMs(120);
    const bf = useStore.getState().project!.baseFlow;
    expect(bf.kind === "youtube" && bf.offsetMs).toBe(120);
  });

  it("baseFlowLoading 토글", () => {
    useStore.getState().setBaseFlowLoading(true);
    expect(useStore.getState().baseFlowLoading).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/store/useStore.baseFlow.test.ts`
Expected: FAIL — 액션/상태 미정의.

- [ ] **Step 3: StoreState 인터페이스에 추가**

`src/store/useStore.ts`의 `interface StoreState`에 상태/액션 추가. `import type`에 `BaseFlowRef` 추가:

```ts
import type { BaseFlowRef, GlobalMode, Marker, Project, SoundRef, Track, TrackStatus } from "../types";
import { resolveBaseFlowView } from "../domain/baseFlowView";
```

상태(예: `score` 아래):

```ts
  baseFlowLoading: boolean;
```

액션(예: `setPlayPauseKey` 아래):

```ts
  setBaseFlow: (ref: BaseFlowRef) => void;
  setBaseFlowDurationMs: (ms: number) => void;
  setBaseFlowView: (patch: Partial<{ layout: "mini" | "ambient"; ambientIntensity: number }>) => void;
  setBaseFlowOffsetMs: (ms: number) => void;
  setBaseFlowLoading: (loading: boolean) => void;
```

- [ ] **Step 4: 구현 추가**

초기 상태(`score: emptyScore(),` 아래):

```ts
  baseFlowLoading: false,
```

액션 구현(`setPlayPauseKey` 구현 아래, `addAssetToLibrary` 위):

```ts
  setBaseFlow: (ref) =>
    set((s) => (s.project ? { project: { ...s.project, baseFlow: ref, updatedAt: Date.now() } } : s)),

  setBaseFlowDurationMs: (ms) =>
    set((s) =>
      s.project
        ? { project: { ...s.project, baseFlow: { ...s.project.baseFlow, durationMs: ms }, updatedAt: Date.now() } }
        : s,
    ),

  setBaseFlowView: (patch) =>
    set((s) =>
      s.project
        ? {
            project: {
              ...s.project,
              baseFlowView: { ...resolveBaseFlowView(s.project.baseFlowView), ...patch },
              updatedAt: Date.now(),
            },
          }
        : s,
    ),

  setBaseFlowOffsetMs: (ms) =>
    set((s) => {
      if (!s.project || s.project.baseFlow.kind !== "youtube") return s;
      return {
        project: {
          ...s.project,
          baseFlow: { ...s.project.baseFlow, offsetMs: ms },
          updatedAt: Date.now(),
        },
      };
    }),

  setBaseFlowLoading: (loading) => set({ baseFlowLoading: loading }),
```

- [ ] **Step 5: 통과 확인**

Run: `yarn vitest run src/store/useStore.baseFlow.test.ts`
Expected: PASS (5 케이스).

- [ ] **Step 6: Commit**

```bash
git add src/store/useStore.ts src/store/useStore.baseFlow.test.ts
git commit -m "feat(store): baseFlow actions and loading state"
```

---

## Task 9: 런타임 — `loadBaseFlow` 분기

**Files:**
- Modify: `src/audio/runtime.ts:78-85` (loadBaseFlow), import부
- Test: `src/audio/runtime.loadBaseFlow.test.ts` (신규)

- [ ] **Step 1: 실패 테스트(audioFile 경로 + youtube 인자 검증)**

`src/audio/runtime.loadBaseFlow.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeGainNode { gain = { value: 1 }; connect<T>(n: T) { return n; } disconnect() {} }
class FakeAudioContext {
  state = "suspended"; currentTime = 0; destination = {};
  createGain() { return new FakeGainNode(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({ duration: 2, getChannelData: () => new Float32Array(10) }); }
}
vi.stubGlobal("AudioContext", FakeAudioContext);

describe("loadBaseFlow 분기", () => {
  beforeEach(() => vi.resetModules());

  it("youtube ref는 컨테이너가 없으면 던진다(가드)", async () => {
    const { loadBaseFlow } = await import("./runtime");
    await expect(
      loadBaseFlow({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 0 }),
    ).rejects.toThrow();
  });
});
```

> audioFile 경로의 실제 decode는 `getAsset`(idb)·`AudioEngine.decode`에 의존해 통합 성격이 강하다. 여기서는 youtube 가드만 단위로 검증하고, audioFile 회귀는 기존 `runtime.audioSync.test.ts`가 커버한다.

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/audio/runtime.loadBaseFlow.test.ts`
Expected: FAIL — 현재 `loadBaseFlow(assetId: string)` 시그니처라 타입/동작 불일치.

- [ ] **Step 3: 구현**

`src/audio/runtime.ts` import부에 추가:

```ts
import type { BaseFlowRef, Project } from "../types";
import { YouTubeSource } from "./YouTubeSource";
import { createYouTubePlayer } from "./youtubeApi";
```

(기존 `import type { Project }`가 있다면 위 BaseFlowRef를 합쳐 한 줄로.)

`loadBaseFlow`(78-85줄)를 교체:

```ts
/**
 * 현재 프로젝트의 베이스 플로우 ref로 소스를 만든다.
 * - audioFile: 에셋을 디코드해 AudioFileSource.
 * - youtube: container에 플레이어를 생성해 YouTubeSource. container 필수.
 */
export async function loadBaseFlow(ref: BaseFlowRef, container?: HTMLElement): Promise<void> {
  const eng = getEngine();
  if (ref.kind === "audioFile") {
    const asset = await getAsset(ref.assetId);
    if (!asset) throw new Error("base flow asset not found: " + ref.assetId);
    const buffer = await eng.decode(asset.blob);
    disposeSource();
    source = new AudioFileSource(eng.ctx, buffer, eng.masterGain);
    return;
  }
  // youtube
  if (!container) throw new Error("youtube base flow requires a container element");
  disposeSource();
  let ytSource: YouTubeSource | null = null;
  const player = await createYouTubePlayer(container, ref.videoId, (ref.startMs ?? 0) / 1000, {
    onReady: () => {},
    onStateChange: (state) => ytSource?.onStateChange(state),
    onError: (code) => useStore.getState().setBaseFlowLoading(false) ?? console.error("yt error", code),
  });
  ytSource = new YouTubeSource(player, ref.offsetMs ?? 0);
  source = ytSource;
  // 준비 후 확정된 길이를 store에 write-back.
  useStore.getState().setBaseFlowDurationMs(ytSource.durationMs);
}
```

> `onError`의 `?? console.error` 표현은 `setBaseFlowLoading`(void) 이후 항상 에러 로그를 남기기 위한 관용 표현이다. 가독성이 거슬리면 두 줄로 풀어도 된다:
> ```ts
> onError: (code) => { useStore.getState().setBaseFlowLoading(false); console.error("yt error", code); },
> ```

- [ ] **Step 4: 통과 확인 + 기존 회귀**

Run: `yarn vitest run src/audio/runtime.loadBaseFlow.test.ts src/audio/runtime.audioSync.test.ts`
Expected: PASS(신규 가드) + 기존 audioSync 통과.

- [ ] **Step 5: Commit**

```bash
git add src/audio/runtime.ts src/audio/runtime.loadBaseFlow.test.ts
git commit -m "feat(audio): loadBaseFlow branches on ref.kind (audioFile|youtube)"
```

---

## Task 10: `YouTubePlayer` 컴포넌트 (미니/앰비언트)

**Files:**
- Create: `src/ui/YouTubePlayer.tsx`, `src/ui/YouTubePlayer.module.css`

> RTL 미설치 → 수동 검증. 컴포넌트는 컨테이너 div를 제공하고 배치/표현만 담당한다. 플레이어 생성은 Editor가 `loadBaseFlow(ref, container)`로 수행한다(Task 12).

- [ ] **Step 1: CSS 작성**

`src/ui/YouTubePlayer.module.css`:

```css
.mini {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 240px;
  height: 135px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 50;
  background: #000;
}
.ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #000;
}
/* 앰비언트: 강도(intensity)에 따라 opacity/blur를 인라인 스타일로 조절 */
.host {
  width: 100%;
  height: 100%;
}
.host iframe {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 2: 컴포넌트 작성**

`src/ui/YouTubePlayer.tsx`:

```tsx
import { forwardRef } from "react";
import styles from "./YouTubePlayer.module.css";
import type { BaseFlowView } from "../domain/baseFlowView";

interface Props {
  view: BaseFlowView;
}

/**
 * 유튜브 플레이어 호스트. ref로 컨테이너 div를 노출해 Editor가
 * loadBaseFlow(ref, container)에 전달한다. layout에 따라 미니/앰비언트 배치.
 * 앰비언트는 intensity로 영상 노출 강도(opacity/blur)를 조절(균형 기본).
 */
export const YouTubePlayer = forwardRef<HTMLDivElement, Props>(function YouTubePlayer({ view }, ref) {
  if (view.layout === "ambient") {
    // intensity 0 → 마커 우선(거의 안 보임), 1 → 영상 우선
    const opacity = 0.12 + view.ambientIntensity * 0.7; // 0.12~0.82
    const blurPx = 6 - view.ambientIntensity * 5; // 6px~1px
    return (
      <div className={styles.ambient} aria-hidden>
        <div className={styles.host} style={{ opacity, filter: `blur(${blurPx}px)` }} ref={ref} />
        <div style={{ position: "absolute", inset: 0, background: `rgba(8,6,20,${0.7 - view.ambientIntensity * 0.4})` }} />
      </div>
    );
  }
  return (
    <div className={styles.mini}>
      <div className={styles.host} ref={ref} />
    </div>
  );
});
```

> `BaseFlowView` 타입은 Task 3에서 `src/domain/baseFlowView.ts`에 export됨.

- [ ] **Step 3: 타입체크**

Run: `yarn tsc -b`
Expected: 이 파일 통과(Editor 미연결 상태라 사용처 경고는 다음 Task에서 해소).

- [ ] **Step 4: Commit**

```bash
git add src/ui/YouTubePlayer.tsx src/ui/YouTubePlayer.module.css
git commit -m "feat(ui): YouTubePlayer host with mini/ambient layout"
```

---

## Task 11: `ProgressBarLane` + Timeline 분기 + 마커 클립

**Files:**
- Create: `src/ui/ProgressBarLane.tsx`
- Modify: `src/ui/Timeline.tsx:10-15,29-30` (props + BaseFlowLane 렌더 분기)
- Modify: `src/ui/TrackLane.tsx:12` (마커 클립)

> 확인된 구조: `Timeline`(15줄)이 `BaseFlowLane`을 30줄에서 렌더하고, 마커는 트랙별 `TrackLane`(`src/ui/TrackLane.tsx:12` `const markers = track.markers`)에서 `MarkerView`로 그린다.

- [ ] **Step 1: ProgressBarLane 작성**

`src/ui/ProgressBarLane.tsx` (파형 없는 유튜브용 단순 진행바 레인. BaseFlowLane과 동일한 클릭→seek/region 제스처를 유지):

```tsx
import { useViewport } from "../store/viewport";
import { seek } from "../audio/runtime";
import { xToTime } from "../timeline/viewportMath";
import { useLaneGesture } from "../input/useLaneGesture";
import { dragToRegion } from "../timeline/laneGesture";
import { useEditorUi } from "../store/editorUi";
import { useSequencerActive } from "../input/useSequencerActive";
import { RegionOverlay } from "./RegionOverlay";

interface Props {
  durationMs: number;
}

const HEIGHT = 80;

/** 유튜브 베이스 플로우용 진행바 레인(파형 없음). 클릭=seek, 드래그=region. */
export function ProgressBarLane({ durationMs }: Props) {
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);
  const setRegion = useEditorUi((s) => s.setRegion);
  const sequencerActive = useSequencerActive();
  const vp = { pxPerMs, scrollLeftPx, containerWidthPx };

  const gesture = useLaneGesture({
    onClick: (x) => {
      if (durationMs > 0 && pxPerMs > 0) seek(xToTime(x, vp));
    },
    onDragMove: (a, b) => {
      if (sequencerActive && pxPerMs > 0) setRegion(dragToRegion(a, b, vp, durationMs));
    },
    onDragEnd: (a, b) => {
      if (sequencerActive && pxPerMs > 0) setRegion(dragToRegion(a, b, vp, durationMs));
    },
  });

  return (
    <div
      {...gesture}
      data-base-flow-lane
      style={{
        position: "relative",
        width: "100%",
        height: HEIGHT,
        overflow: "hidden",
        cursor: "pointer",
        background: "linear-gradient(180deg,#13102b,#0d0a1f)",
        borderBottom: "1px solid #2a2a44",
      }}
    >
      {sequencerActive && <RegionOverlay />}
    </div>
  );
}
```

- [ ] **Step 2: Timeline에 `baseFlowKind` prop 추가 + 레인 분기**

`src/ui/Timeline.tsx`의 `TimelineProps`(10-13줄)에 prop 추가:

```tsx
interface TimelineProps {
  peaks: Float32Array | null;
  durationMs: number;
  baseFlowKind: "audioFile" | "youtube";
}
```

함수 시그니처도 `export function Timeline({ peaks, durationMs, baseFlowKind }: TimelineProps)`로 수정.

30번 줄의 `<BaseFlowLane peaks={peaks} durationMs={durationMs} />`를 분기로 교체:

```tsx
      {baseFlowKind === "youtube"
        ? <ProgressBarLane durationMs={durationMs} />
        : <BaseFlowLane peaks={peaks} durationMs={durationMs} />}
```

import 추가: `import { ProgressBarLane } from "./ProgressBarLane";`

(Editor가 `Timeline`에 `baseFlowKind={project.baseFlow.kind}`를 넘기는 부분은 Task 12 Step 3에서 처리.)

- [ ] **Step 3: TrackLane 마커 렌더에 클립 적용**

`src/ui/TrackLane.tsx`의 12번 줄:

```ts
  const markers = track.markers;
```

를 교체:

```ts
  const markers = clipMarkersForDisplay(track.markers, durationMs);
```

import 추가: `import { clipMarkersForDisplay } from "../domain/markerClip";`

> 표시(렌더) 경로에만 적용한다. 편집(store 액션)·스케줄(`runtime.ts`/`Scheduler.ts`)은 원본 `track.markers`를 그대로 쓰므로 데이터는 보존된다.

- [ ] **Step 4: 타입체크 + 기존 테스트 회귀**

Run: `yarn tsc -b && yarn test:run`
Expected: 컴파일 통과, 기존 테스트 그린.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ProgressBarLane.tsx src/ui/Timeline.tsx
git commit -m "feat(ui): progress-bar lane for youtube + clip markers on render"
```

---

## Task 12: `BaseFlowPicker` + Editor 통합

**Files:**
- Create: `src/ui/BaseFlowPicker.tsx`, `src/ui/BaseFlowPicker.module.css`
- Modify: `src/ui/Editor.tsx` (로드 분기, 플레이어 마운트, 피커, 뷰 토글)

> 먼저 `src/ui/Editor.tsx`의 로드 effect(55-69줄)와 메인 레이아웃(73-127줄)을 다시 확인한다.

- [ ] **Step 1: BaseFlowPicker 작성**

`src/ui/BaseFlowPicker.tsx` — 파일/유튜브 탭. 파일 탭은 기존 에셋 라이브러리 모달 진입 버튼을 재사용(있다면), 유튜브 탭은 URL 입력→파싱→`setBaseFlow`:

```tsx
import { useState } from "react";
import { useStore } from "../store/useStore";
import { parseYouTubeId } from "../domain/youtube";
import styles from "./BaseFlowPicker.module.css";

interface Props {
  onClose: () => void;
}

export function BaseFlowPicker({ onClose }: Props) {
  const setBaseFlow = useStore((s) => s.setBaseFlow);
  const [tab, setTab] = useState<"file" | "youtube">("youtube");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function applyYouTube() {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("유효한 유튜브 URL 또는 영상 ID가 아닙니다.");
      return;
    }
    // durationMs는 onReady 후 write-back되므로 0으로 시작.
    setBaseFlow({ kind: "youtube", videoId: id, durationMs: 0 });
    onClose();
  }

  return (
    <div className={styles.picker}>
      <div className={styles.tabs}>
        <button className={tab === "file" ? styles.tabActive : styles.tab} onClick={() => setTab("file")}>파일</button>
        <button className={tab === "youtube" ? styles.tabActive : styles.tab} onClick={() => setTab("youtube")}>유튜브</button>
      </div>
      {tab === "youtube" ? (
        <div className={styles.body}>
          <input
            className={styles.input}
            placeholder="https://youtu.be/... 또는 영상 ID"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") applyYouTube(); }}
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.apply} onClick={applyYouTube}>적용</button>
        </div>
      ) : (
        <div className={styles.body}>
          {/* 파일 베이스 플로우는 기존 업로드/에셋 흐름을 사용한다. */}
          <p className={styles.hint}>파일 베이스 플로우는 프로젝트 생성/에셋 업로드 흐름을 사용하세요.</p>
        </div>
      )}
    </div>
  );
}
```

`src/ui/BaseFlowPicker.module.css`:

```css
.picker { display: flex; flex-direction: column; gap: 12px; padding: 16px; min-width: 320px; }
.tabs { display: flex; gap: 8px; }
.tab, .tabActive { padding: 6px 14px; border-radius: 6px; border: 1px solid #2a2a44; background: transparent; color: #9ca3c4; cursor: pointer; }
.tabActive { background: #2a1b45; color: #fff; border-color: #7c2d92; }
.body { display: flex; flex-direction: column; gap: 8px; }
.input { padding: 8px 10px; border-radius: 6px; border: 1px solid #2a2a44; background: #0d0a1f; color: #fff; }
.apply { align-self: flex-end; padding: 6px 16px; border-radius: 6px; border: none; background: #7c2d92; color: #fff; cursor: pointer; }
.error { color: #f87171; font-size: 12px; margin: 0; }
.hint { color: #9ca3c4; font-size: 12px; margin: 0; }
```

- [ ] **Step 2: Editor 로드 effect를 ref 분기로 교체**

`src/ui/Editor.tsx`의 55-69줄 effect를 교체. 유튜브면 컨테이너 ref를 넘기고 peaks는 비운다:

```tsx
  const playerHostRef = useRef<HTMLDivElement>(null);
  const setBaseFlowLoading = useStore((s) => s.setBaseFlowLoading);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const ref = project.baseFlow;
    setBaseFlowLoading(true);
    (async () => {
      try {
        if (ref.kind === "audioFile") {
          await loadBaseFlow(ref);
          const asset = await getAsset(ref.assetId);
          if (!asset || cancelled) return;
          const buffer = await getEngine().decode(asset.blob);
          if (cancelled) return;
          setPeaks(computePeaks(buffer.getChannelData(0), 1000));
        } else {
          setPeaks(null);
          await loadBaseFlow(ref, playerHostRef.current ?? undefined);
        }
      } finally {
        if (!cancelled) setBaseFlowLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.id, project?.baseFlow, setBaseFlowLoading]);
```

> 의존성에 `project?.baseFlow`를 넣어 소스 전환(setBaseFlow) 시 재로드되게 한다. `loadBaseFlow`가 내부에서 이전 소스를 `disposeSource`로 정리한다.

- [ ] **Step 3: 플레이어 호스트 + 피커 + 뷰 토글 렌더**

`src/ui/Editor.tsx` 메인 레이아웃에 추가. `project.baseFlow.kind === "youtube"`일 때만 `YouTubePlayer`를 마운트하고 `playerHostRef`를 연결. 앰비언트면 타임라인 컨테이너 안(배경), 미니면 fixed:

```tsx
  const view = resolveBaseFlowView(project.baseFlowView);
  const isYouTube = project.baseFlow.kind === "youtube";
```

```tsx
      <div className={styles.editorMain} onClick={handleMainClick}>
        <div className={styles.editorMainTimeline} style={{ position: "relative" }}>
          {isYouTube && view.layout === "ambient" && <YouTubePlayer view={view} ref={playerHostRef} />}
          <Timeline peaks={peaks} durationMs={project.baseFlow.durationMs} baseFlowKind={project.baseFlow.kind} />
        </div>
      </div>
      {isYouTube && view.layout === "mini" && <YouTubePlayer view={view} ref={playerHostRef} />}
```

import 추가:

```tsx
import { YouTubePlayer } from "./YouTubePlayer";
import { BaseFlowPicker } from "./BaseFlowPicker";
import { resolveBaseFlowView } from "../domain/baseFlowView";
```

> 피커 진입점: 에디터 툴바 또는 상단바에 "베이스 플로우 변경" 버튼을 두고, 클릭 시 Radix Dialog(이미 의존성에 있음, `@radix-ui/react-dialog`)로 `BaseFlowPicker`를 연다. 기존 `AssetLibraryModal`의 Dialog 사용 패턴을 참고해 동일 스타일로 배선한다. 뷰 토글(미니↔앰비언트)과 강도 슬라이더도 유튜브일 때 이 다이얼로그 또는 툴바에 노출하고 `setBaseFlowView`에 연결.
>
> ⚠️ 미니/앰비언트를 전환하면 `YouTubePlayer`가 언마운트/리마운트되어 `playerHostRef`가 가리키는 DOM이 바뀐다. effect 의존성에 `view.layout`을 추가해 레이아웃 전환 시 플레이어를 재생성하도록 한다(Step 2 effect 의존성 배열에 `view.layout` 추가). 이는 의도된 동작(전환 시 짧은 재로드).

- [ ] **Step 4: 타입체크 + 전체 테스트**

Run: `yarn tsc -b && yarn test:run`
Expected: 컴파일 통과, 기존 + 신규 단위테스트 그린.

- [ ] **Step 5: 수동 검증(개발 서버)**

Run: `yarn dev` 후 브라우저에서:
- 유튜브 URL로 베이스 플로우 설정 → 미니 플레이어 표시, 재생 버튼으로 재생/일시정지/시크 동작.
- 플레이헤드가 영상과 함께 진행, 마커 자동 펄스/사운드가 영상 박자에 합리적으로 정렬.
- 앰비언트 토글 → 배경 영상 + 마커 가독성 확인.
- 파일↔유튜브 전환 시 마커 보존(짧은 소스에선 초과 마커만 숨김).

- [ ] **Step 6: Commit**

```bash
git add src/ui/BaseFlowPicker.tsx src/ui/BaseFlowPicker.module.css src/ui/Editor.tsx
git commit -m "feat(ui): base flow picker, youtube player mount, view toggle"
```

---

## Task 13: nudge 슬라이더 + 로딩 중 재생 비활성

**Files:**
- Modify: `src/ui/TransportBar.tsx`

- [ ] **Step 1: 로딩 중 재생 버튼 비활성**

`src/ui/TransportBar.tsx`에서 `baseFlowLoading`을 구독해 재생 버튼 `disabled`:

```tsx
  const baseFlowLoading = useStore((s) => s.baseFlowLoading);
```

재생 버튼에 `disabled={baseFlowLoading}` 추가.

- [ ] **Step 2: nudge 슬라이더(유튜브일 때만)**

볼륨 슬라이더 옆 등에 추가. youtube일 때만 노출:

```tsx
  const isYouTube = project?.baseFlow.kind === "youtube";
  const offsetMs = project?.baseFlow.kind === "youtube" ? (project.baseFlow.offsetMs ?? 0) : 0;
  const setBaseFlowOffsetMs = useStore((s) => s.setBaseFlowOffsetMs);
```

```tsx
      {isYouTube && (
        <label className={styles.vol} title="마커 타이밍 보정(nudge)">
          <span style={{ fontSize: 12, color: "#9ca3c4" }}>nudge</span>
          <input
            type="range"
            min={-500}
            max={500}
            step={10}
            value={offsetMs}
            onChange={(e) => setBaseFlowOffsetMs(Number(e.target.value))}
          />
          <span style={{ fontSize: 11, color: "#9ca3c4", width: 44 }}>{offsetMs}ms</span>
        </label>
      )}
```

> ⚠️ `offsetMs` 변경은 `setBaseFlowOffsetMs`로 store만 갱신한다. 그러나 현재 재생 중인 `YouTubeSource`는 생성 시점 `offsetMs`를 캡처한다. 즉시 반영하려면 두 가지 중 택1:
> (a) 간단: nudge 변경 시 소스를 재로드하지 않고, 다음 재생/시크부터 반영(YAGNI 허용 — 단, UX상 즉시 반영이 자연스러움).
> (b) 권장: `YouTubeSource`에 `setOffsetMs(ms)` 메서드를 추가하고, runtime에 `setBaseFlowOffsetMs(ms)` 패스스루를 두어 현재 소스에 즉시 반영. 아래 Step 3에서 (b)를 구현.

- [ ] **Step 3: 즉시 반영 배선(권장 b)**

`src/audio/YouTubeSource.ts`에 `offsetMs`를 가변으로 바꾸고 setter 추가:

```ts
  // 생성자 파라미터를 private readonly 대신 가변 필드로:
  private offsetMs: number;
  constructor(player, offsetMs: number, now = ...) { this.offsetMs = offsetMs; ... }

  setOffsetMs(ms: number): void { this.offsetMs = ms; }
```

`src/audio/runtime.ts`에 패스스루 추가:

```ts
export function setBaseFlowOffsetMs(ms: number): void {
  if (source instanceof YouTubeSource) source.setOffsetMs(ms);
}
```

`TransportBar`의 onChange를 store + runtime 둘 다 호출:

```tsx
onChange={(e) => {
  const ms = Number(e.target.value);
  setBaseFlowOffsetMs(ms);            // store(영속)
  runtimeSetBaseFlowOffsetMs(ms);     // 현재 소스 즉시 반영
}}
```

import: `import { play, pause, seek, setBaseFlowOffsetMs as runtimeSetBaseFlowOffsetMs } from "../audio/runtime";`

> `YouTubeSource` 변경 후 Task 7의 테스트가 여전히 통과하는지 확인(생성자 시그니처 동일 유지: `(player, offsetMs, now?)`).

- [ ] **Step 4: 타입체크 + 테스트**

Run: `yarn tsc -b && yarn vitest run src/audio/YouTubeSource.test.ts`
Expected: 컴파일 통과, YouTubeSource 테스트 그린.

- [ ] **Step 5: Commit**

```bash
git add src/ui/TransportBar.tsx src/audio/YouTubeSource.ts src/audio/runtime.ts
git commit -m "feat(ui): nudge slider with live offset + disable play while loading"
```

---

## Task 14: 최종 검증

- [ ] **Step 1: 전체 테스트**

Run: `yarn test:run`
Expected: 전부 PASS(기존 198 + 신규).

- [ ] **Step 2: 타입체크/빌드**

Run: `yarn build`
Expected: tsc + vite 빌드 성공.

- [ ] **Step 3: 수동 종합 시나리오(`yarn dev`)**

- 새 프로젝트에 유튜브 URL 설정 → onReady 후 duration이 트랜스포트에 표시.
- 재생/일시정지/시크 정상, 시크 직후 버퍼링 동안 마커가 침묵에 발화되지 않음.
- 마커 자동 펄스가 영상 박자에 합리적으로 정렬, nudge로 미세 보정 시 즉시 반영.
- 미니↔앰비언트 전환 동작, 앰비언트 강도 슬라이더로 가독성 조절.
- 파일↔유튜브 전환 시 마커 데이터 보존(초과분만 표시 숨김).
- 프로젝트 복제 시 유튜브 baseFlow가 copyAsset 호출 없이 정상 복제.
- 임베드 불가 영상 입력 시 콘솔 에러 + 로딩 해제(앱 비크래시).
- 새로고침 후 baseFlowView(미니/앰비언트·강도), videoId, offsetMs 영속 복원.

- [ ] **Step 4: 최종 커밋(필요 시)**

```bash
git add -A && git commit -m "chore: youtube base flow final polish"
```

---

## Self-Review 메모

- 스펙 §3 데이터 모델 → Task 1, 8. §4 소스 추상화 → Task 5, 6, 7. §5 런타임 → Task 9.
  §6 UI(배치 토글/피커/nudge/진행바 레인/마커 클립) → Task 10~13. §7 엣지/에러 → Task 9(onError),
  Task 12(파싱 에러), Task 13(로딩 비활성). §8 테스트 → 각 Task TDD + Task 14.
- `duplicateProject` 유튜브 분기(스펙에 암시된 asset 무관성) → Task 3 Step 6에서 명시 처리.
- 타입 시그니처 일관성: `loadBaseFlow(ref, container?)`, `setBaseFlowDurationMs`, `setBaseFlowOffsetMs`,
  `YouTubeSource(player, offsetMs, now?)` + `onStateChange`/`setOffsetMs`, `BaseFlowView` 일관 사용.
- 확인 완료: 마커 렌더는 `TrackLane.tsx:12`, 레인 렌더는 `Timeline.tsx:30`(Task 11에 반영).
- 미해결 가정(실행 중 검증): Radix Dialog 배선 패턴(Task 12 — 기존 AssetLibraryModal 참고),
  앰비언트 전환 시 ref 재생성(Task 12 Step 3). 둘 다 기존 패턴 참고로 해소 가능.
