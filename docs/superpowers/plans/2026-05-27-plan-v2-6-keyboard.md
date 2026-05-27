# [Keyboard Layer] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v2 키보드 레이어를 완성한다. (1) `Project.transport.playPauseKey`를 모델에 추가하고(계약 §2), (2) `setPlayPauseKey` 스토어 액션을 TDD로 추가하며(계약 §3), (3) `KeyboardController`를 계약 §9의 keydown 처리 순서대로 재구성한다 — 모드가 play/record면 모든 키 기본동작 차단(요구 6), 재생키 일치 시 모든 모드에서 재생/일시정지 토글(요구 12), 트랙 키 일치 시 기존 record/perform 유지. (4) `TransportBar`에 재생키 `KeyCap`을 붙인다(요구 12).

**Architecture:** keydown 분기는 부수효과(window 이벤트·소리·runtime 호출)와 분리된 순수 결정 함수 `decideKeyAction(...)`로 추출해 단위테스트한다. `KeyboardController`는 이 함수가 돌려준 액션을 실행만 한다. 재생키 토글은 `useStore.getState().playing`을 참고해 `runtime.play()`/`runtime.pause()`를 호출한다. 키 저장값은 `e.code`(예: `"KeyA"`) 원문이며 표시는 plan 3 산출물 `formatKeyCode`/`KeyCap`을 재사용한다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest

**선행 의존성:** plan 3에서 `src/domain/formatKeyCode.ts`와 `src/ui/KeyCap.tsx`(props 계약 §8: `{ code: string | null; onCapture: (code: string) => void }`)가 이미 구현되어 있어야 한다. Task 4 진입 전 두 파일 존재를 확인한다.

---

### Task 1: `Project.transport` 타입 추가 (계약 §2)

**Files:**
- `src/types.ts` (수정)

- [ ] `src/types.ts`의 `Project` 인터페이스에 `transport` 필드를 추가한다. 기존 저장본 호환을 위해 optional로 둔다.

```ts
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  baseFlow: BaseFlowRef;
  tracks: Track[];
  master: { volume: number }; // 0..1
  transport?: { playPauseKey: string | null }; // 신규(영속). 기존 저장본엔 없을 수 있어 optional. 읽을 때 ?? null.
}
```

- [ ] `yarn tsc -b`로 타입체크 통과를 확인한다(이 시점에 컴파일 에러가 없어야 함).
- [ ] `yarn test:run`으로 기존 테스트 회귀가 없는지 확인한다.
- [ ] 커밋한다.

```
feat(types): add Project.transport.playPauseKey (optional, 계약 §2)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 2: `setPlayPauseKey` 스토어 액션 — TDD (계약 §3)

**Files:**
- `src/store/useStore.test.ts` (신규 또는 기존 파일에 추가)
- `src/store/useStore.ts` (수정)

> 진짜 TDD: 먼저 실패하는 테스트를 작성하고(RED), 액션을 구현해 통과시킨다(GREEN). 테스트는 대상과 같은 디렉터리에 공존(계약 §0).

- [ ] **RED.** `src/store/useStore.test.ts`에 다음 테스트를 추가한다. 헬퍼로 최소 프로젝트를 만들어 store에 주입한다.

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "test",
    createdAt: 0,
    updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
    tracks: [],
    master: { volume: 1 },
    ...overrides,
  };
}

describe("setPlayPauseKey", () => {
  beforeEach(() => {
    useStore.setState({ project: makeProject() });
  });

  it("transport가 없던 프로젝트에 playPauseKey를 설정한다", () => {
    useStore.getState().setPlayPauseKey("KeyP");
    expect(useStore.getState().project?.transport?.playPauseKey).toBe("KeyP");
  });

  it("기존 playPauseKey를 다른 키로 교체한다", () => {
    useStore.setState({ project: makeProject({ transport: { playPauseKey: "KeyP" } }) });
    useStore.getState().setPlayPauseKey("Space");
    expect(useStore.getState().project?.transport?.playPauseKey).toBe("Space");
  });

  it("null로 바인딩을 해제한다", () => {
    useStore.setState({ project: makeProject({ transport: { playPauseKey: "KeyP" } }) });
    useStore.getState().setPlayPauseKey(null);
    expect(useStore.getState().project?.transport?.playPauseKey).toBeNull();
  });

  it("updatedAt을 갱신한다 (단일 전이)", () => {
    const before = useStore.getState().project!.updatedAt;
    useStore.getState().setPlayPauseKey("KeyP");
    expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("project가 null이면 아무 일도 하지 않는다", () => {
    useStore.setState({ project: null });
    useStore.getState().setPlayPauseKey("KeyP");
    expect(useStore.getState().project).toBeNull();
  });
});
```

- [ ] `yarn vitest run src/store/useStore.test.ts`로 RED를 확인한다(`setPlayPauseKey` 미존재로 실패).
- [ ] **GREEN.** `src/store/useStore.ts`의 `StoreState` 인터페이스에 시그니처를 추가한다(계약 §3 정확히 일치).

```ts
  setPlayPauseKey: (key: string | null) => void; // project.transport.playPauseKey 갱신
```

- [ ] 같은 파일의 `create<StoreState>(...)` 구현 객체에 액션을 추가한다. 기존 `master` 갱신과 동일하게 `project` 단일 전이 + `updatedAt` 갱신.

```ts
  setPlayPauseKey: (key) =>
    set((s) =>
      s.project
        ? { project: { ...s.project, transport: { playPauseKey: key }, updatedAt: Date.now() } }
        : s,
    ),
```

- [ ] `yarn vitest run src/store/useStore.test.ts`로 GREEN을 확인한다.
- [ ] `yarn test:run && yarn tsc -b` 둘 다 통과를 확인한다.
- [ ] 커밋한다.

```
feat(store): add setPlayPauseKey action with tests (계약 §3, 요구 12)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 3: 프로젝트 생성 시 transport 기본값 설정 (ProjectList)

**Files:**
- `src/ui/ProjectList.tsx` (수정)

> 신규 프로젝트는 `transport: { playPauseKey: null }`로 시작한다. 기존 저장본은 optional + `?? null`로 호환(Task 1).

- [ ] `src/ui/ProjectList.tsx`의 `handleFile` 내부 `const project: Project = { ... }` 객체 리터럴에 `transport` 기본값을 추가한다.

```ts
    const project: Project = {
      id: newId(),
      name: file.name.replace(/\.[^.]+$/, ""),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      baseFlow: { kind: "audioFile", assetId, durationMs: buffer.duration * 1000 },
      tracks: [],
      master: { volume: 1 },
      transport: { playPauseKey: null },
    };
```

- [ ] `yarn test:run && yarn tsc -b` 둘 다 통과를 확인한다.
- [ ] 커밋한다.

```
feat(project): default transport.playPauseKey to null on new project

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 4: keydown 결정 로직 순수함수 추출 — TDD (계약 §9)

**Files:**
- `src/input/keyAction.ts` (신규)
- `src/input/keyAction.test.ts` (신규)

> 계약 §9의 처리 순서를 부수효과 없는 순수함수로 만든다. window 이벤트·소리·runtime은 Task 5에서 이 함수의 결과를 보고 실행한다. 입력은 keydown에서 뽑은 평범한 값(`code`, `repeat`, `targetTag`, `mode`, `playPauseKey`, `tracks`)이며, 출력은 차별적 union 액션이다.

- [ ] **RED.** `src/input/keyAction.test.ts`를 작성한다. 먼저 작성하고 실패시킨다.

```ts
import { describe, expect, it } from "vitest";
import { decideKeyAction, type KeyContext } from "./keyAction";
import type { GlobalMode, Track } from "../types";

function track(over: Partial<Track> = {}): Track {
  return {
    id: "t1",
    name: "t",
    status: "write",
    sound: { kind: "builtin", sampleId: "kick" },
    keyBinding: "KeyA",
    markers: [],
    volume: 1,
    color: "#fff",
    ...over,
  };
}

function ctx(over: Partial<KeyContext> = {}): KeyContext {
  return {
    code: "KeyA",
    repeat: false,
    targetTag: "DIV",
    mode: "record" as GlobalMode,
    playPauseKey: null,
    tracks: [track()],
    ...over,
  };
}

describe("decideKeyAction", () => {
  it("repeat면 ignore (preventDefault 없음)", () => {
    const a = decideKeyAction(ctx({ repeat: true, mode: "record" }));
    expect(a).toEqual({ kind: "ignore", preventDefault: false });
  });

  it("타깃이 INPUT이면 ignore", () => {
    expect(decideKeyAction(ctx({ targetTag: "INPUT" }))).toEqual({ kind: "ignore", preventDefault: false });
  });
  it("타깃이 SELECT면 ignore", () => {
    expect(decideKeyAction(ctx({ targetTag: "SELECT" }))).toEqual({ kind: "ignore", preventDefault: false });
  });
  it("타깃이 TEXTAREA면 ignore", () => {
    expect(decideKeyAction(ctx({ targetTag: "TEXTAREA" }))).toEqual({ kind: "ignore", preventDefault: false });
  });

  it("record 모드: 매칭 트랙 없는 키도 preventDefault=true (요구 6)", () => {
    const a = decideKeyAction(ctx({ mode: "record", code: "KeyZ", tracks: [track({ keyBinding: "KeyA" })] }));
    expect(a.preventDefault).toBe(true);
    expect(a.kind).toBe("noop");
  });

  it("play 모드: 매칭 없는 키도 preventDefault=true (요구 6)", () => {
    const a = decideKeyAction(ctx({ mode: "play", code: "KeyZ", tracks: [] }));
    expect(a.preventDefault).toBe(true);
    expect(a.kind).toBe("noop");
  });

  it("listening 모드: 매칭 없는 키는 preventDefault=false", () => {
    const a = decideKeyAction(ctx({ mode: "listening", code: "KeyZ", tracks: [] }));
    expect(a).toEqual({ kind: "noop", preventDefault: false });
  });

  it("재생키 매칭이 트랙키보다 우선, 모든 모드에서 toggle (요구 12)", () => {
    const a = decideKeyAction(
      ctx({ mode: "listening", code: "Space", playPauseKey: "Space", tracks: [track({ keyBinding: "Space" })] }),
    );
    expect(a.kind).toBe("toggle-play");
  });

  it("재생키는 play/record 모드에서도 preventDefault=true와 함께 toggle", () => {
    const a = decideKeyAction(ctx({ mode: "record", code: "Space", playPauseKey: "Space", tracks: [] }));
    expect(a).toMatchObject({ kind: "toggle-play", preventDefault: true });
  });

  it("재생키가 null이면 토글하지 않는다", () => {
    const a = decideKeyAction(ctx({ mode: "listening", code: "Space", playPauseKey: null, tracks: [] }));
    expect(a.kind).toBe("noop");
  });

  it("트랙 키 매칭 시 trigger-tracks에 매칭 트랙 id가 담긴다", () => {
    const t = track({ id: "tx", keyBinding: "KeyA" });
    const a = decideKeyAction(ctx({ mode: "record", code: "KeyA", playPauseKey: null, tracks: [t] }));
    expect(a.kind).toBe("trigger-tracks");
    if (a.kind === "trigger-tracks") expect(a.trackIds).toEqual(["tx"]);
  });

  it("같은 키를 가진 트랙 여러 개를 모두 담는다", () => {
    const a = decideKeyAction(
      ctx({
        mode: "record",
        code: "KeyA",
        playPauseKey: null,
        tracks: [track({ id: "t1", keyBinding: "KeyA" }), track({ id: "t2", keyBinding: "KeyA" })],
      }),
    );
    if (a.kind === "trigger-tracks") expect(a.trackIds).toEqual(["t1", "t2"]);
  });
});
```

- [ ] `yarn vitest run src/input/keyAction.test.ts`로 RED를 확인한다.
- [ ] **GREEN.** `src/input/keyAction.ts`를 작성한다. 계약 §9 순서를 그대로 구현한다.

```ts
import type { GlobalMode, Track } from "../types";

export interface KeyContext {
  code: string;
  repeat: boolean;
  targetTag: string; // e.target의 tagName (대문자). 없으면 "".
  mode: GlobalMode;
  playPauseKey: string | null; // project.transport?.playPauseKey ?? null
  tracks: Track[];
}

export type KeyAction =
  | { kind: "ignore"; preventDefault: false }
  | { kind: "noop"; preventDefault: boolean }
  | { kind: "toggle-play"; preventDefault: boolean }
  | { kind: "trigger-tracks"; preventDefault: boolean; trackIds: string[] };

const TYPING_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** 계약 §9: keydown을 어떻게 처리할지 결정하는 순수함수. */
export function decideKeyAction(ctx: KeyContext): KeyAction {
  // 1. repeat 무시
  if (ctx.repeat) return { kind: "ignore", preventDefault: false };
  // 2. 입력 필드 타깃이면 타이핑 허용(무시)
  if (TYPING_TAGS.has(ctx.targetTag)) return { kind: "ignore", preventDefault: false };
  // 3. play/record 모드면 모든 키 기본동작 차단 (요구 6)
  const preventDefault = ctx.mode === "play" || ctx.mode === "record";
  // 4. 재생키 일치 → 토글 (모든 모드, 트랙키보다 우선) (요구 12)
  if (ctx.playPauseKey !== null && ctx.code === ctx.playPauseKey) {
    return { kind: "toggle-play", preventDefault };
  }
  // 5. 트랙 키 일치 → 트리거
  const trackIds = ctx.tracks.filter((t) => t.keyBinding === ctx.code).map((t) => t.id);
  if (trackIds.length > 0) {
    return { kind: "trigger-tracks", preventDefault, trackIds };
  }
  return { kind: "noop", preventDefault };
}
```

- [ ] `yarn vitest run src/input/keyAction.test.ts`로 GREEN을 확인한다.
- [ ] `yarn test:run && yarn tsc -b` 둘 다 통과를 확인한다.
- [ ] 커밋한다.

```
feat(input): pure decideKeyAction for keydown routing (계약 §9, 요구 6·12)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 5: `KeyboardController`를 결정 함수 기반으로 재구성 (계약 §9)

**Files:**
- `src/input/KeyboardController.ts` (수정)

> `decideKeyAction`의 결과만 실행한다. 부수효과(소리·marker 추가·채점·재생토글)는 여기서만 일어난다. 기존 record/perform 동작에 회귀가 없어야 한다. 재생 토글은 `useStore.getState().playing`을 참고해 `play()`/`pause()`를 호출(계약 §9-4, 요구 12).

- [ ] `src/input/KeyboardController.ts`를 아래로 교체한다. 트랙 트리거 로직(record/perform)은 기존과 동일한 동작을 유지하되, 매칭된 트랙 id 목록을 `decideKeyAction`에서 받아 처리하도록 정리한다.

```ts
import { useStore } from "../store/useStore";
import { resolveTrackBehavior } from "../domain/mode";
import { getEngine, getLibrary, play, pause } from "../audio/runtime";
import { playSample } from "../audio/SamplePlayer";
import { pressTrack } from "../scoring/playSession";
import { decideKeyAction } from "./keyAction";
import type { Track } from "../types";

/** 한 트랙에 대해 현재 모드의 record/perform 동작을 실행한다(기존 동작 유지). */
function triggerTrack(track: Track): void {
  const state = useStore.getState();
  const behavior = resolveTrackBehavior(state.mode, track.status);
  if (behavior === "record") {
    state.addMarker(track.id, state.playheadMs);
    const buffer = getLibrary().get(track.sound);
    if (buffer) {
      const eng = getEngine();
      playSample(eng.ctx, buffer, eng.masterGain, eng.ctx.currentTime, track.volume);
    }
  } else if (behavior === "perform") {
    // 소리는 항상 재생(악기처럼), 채점은 가장 가까운 마커와 매칭
    const buffer = getLibrary().get(track.sound);
    if (buffer) {
      const eng = getEngine();
      playSample(eng.ctx, buffer, eng.masterGain, eng.ctx.currentTime, track.volume);
    }
    pressTrack(track.id, state.playheadMs);
  }
}

/** 전역 키보드 리스너를 부착하고 해제 함수를 반환. */
export function startKeyboard(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const state = useStore.getState();
    const project = state.project;
    if (!project) return;

    const target = e.target as HTMLElement | null;
    const action = decideKeyAction({
      code: e.code,
      repeat: e.repeat,
      targetTag: target?.tagName ?? "",
      mode: state.mode,
      playPauseKey: project.transport?.playPauseKey ?? null,
      tracks: project.tracks,
    });

    if (action.kind === "ignore") return;
    if (action.preventDefault) e.preventDefault();

    if (action.kind === "toggle-play") {
      if (useStore.getState().playing) pause();
      else void play();
      return;
    }

    if (action.kind === "trigger-tracks") {
      for (const id of action.trackIds) {
        const track = project.tracks.find((t) => t.id === id);
        if (track) triggerTrack(track);
      }
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
```

- [ ] `runtime.ts`가 `play`/`pause`를 named export하는지 확인한다(이미 export됨: `export async function play`, `export function pause`).
- [ ] `yarn test:run && yarn tsc -b` 둘 다 통과를 확인한다.
- [ ] **브라우저 검증(또는 무인 시 IMPLEMENTATION_NOTES.md 기록).** 단위테스트로 못 잡는 항목 — 헤드리스 Chrome 드라이버(`/tmp/bof-driver`) 또는 사람이 확인한다. 무인 실행이면 `IMPLEMENTATION_NOTES.md`에 "사람 검증 필요"로 기록하고 성공을 꾸미지 않는다.
  - record 모드에서 write 트랙 키 누르면 마커 추가 + 소리(기존 동작 회귀 없음).
  - play 모드에서 트랙 키 누르면 소리 + 채점(perform) 동작.
  - play/record 모드에서 스페이스 등 기본동작 키가 페이지 스크롤/버튼 클릭을 일으키지 않음(요구 6).
  - 재생키 바인딩 후 listening/play/record 모든 모드에서 그 키로 재생/일시정지가 토글됨(요구 12).
  - input/select/textarea 포커스 중 타이핑은 키보드 컨트롤러에 가로채이지 않음.
- [ ] 커밋한다.

```
refactor(input): drive KeyboardController via decideKeyAction; mode block + play toggle (요구 6·12)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 6: `TransportBar`에 재생키 `KeyCap` 추가 (요구 12)

**Files:**
- `src/ui/TransportBar.tsx` (수정)

> plan 3 산출물 `KeyCap`(props 계약 §8)을 재사용한다. 표시는 현재 `transport.playPauseKey`, 클릭 후 캡처한 `e.code`를 `setPlayPauseKey`로 저장한다.

- [ ] 진입 전 `src/ui/KeyCap.tsx`와 `src/domain/formatKeyCode.ts`가 존재하는지 확인한다(plan 3 완료 전제). 없으면 plan 3을 먼저 끝낸다.
- [ ] `src/ui/TransportBar.tsx`에 `KeyCap` import와 `setPlayPauseKey` 구독을 추가한다.

```ts
import { useStore } from "../store/useStore";
import { play, pause, seek } from "../audio/runtime";
import { KeyCap } from "./KeyCap";
```

- [ ] 컴포넌트 본문에서 재생키와 액션을 읽는다.

```ts
  const setPlayPauseKey = useStore((s) => s.setPlayPauseKey);
  const playPauseKey = project?.transport?.playPauseKey ?? null;
```

- [ ] 재생 버튼 옆(시간 표시 앞)에 `KeyCap`을 렌더한다. 캡처된 코드를 `setPlayPauseKey`로 저장한다.

```tsx
      <button className="btn--icon btn--primary" onClick={() => (playing ? pause() : void play())}>
        {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
      </button>
      <KeyCap code={playPauseKey} onCapture={(code) => setPlayPauseKey(code)} />
      <span className="transport__time">
        {fmt(playheadMs)} / {fmt(durationMs)}
      </span>
```

- [ ] `yarn test:run && yarn tsc -b` 둘 다 통과를 확인한다.
- [ ] **브라우저 검증(또는 무인 시 IMPLEMENTATION_NOTES.md 기록).** TransportBar의 KeyCap 클릭 → 키 입력 → 라벨이 `formatKeyCode` 표시로 갱신, 저장 후 Task 5의 재생키 토글이 그 키로 동작. 무인이면 "사람 검증 필요" 기록(성공 꾸미지 말 것).
- [ ] 커밋한다.

```
feat(ui): add play/pause KeyCap to TransportBar bound to setPlayPauseKey (요구 12)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 완료 기준 (Definition of Done)

- [ ] `Project.transport?: { playPauseKey: string | null }` 추가됨(계약 §2 정확히 일치).
- [ ] `setPlayPauseKey(key: string | null): void`가 TDD로 추가되고 단일 전이 + `updatedAt` 갱신(계약 §3).
- [ ] 신규 프로젝트가 `transport: { playPauseKey: null }`로 생성됨.
- [ ] keydown 분기가 순수함수 `decideKeyAction`로 분리되어 모드별 preventDefault·재생키 매칭·트랙키 매칭이 단위테스트됨.
- [ ] `KeyboardController`가 계약 §9 순서(repeat→입력필드→모드차단→재생키토글→트랙키)를 따르고 기존 record/perform 동작에 회귀 없음.
- [ ] `TransportBar`에 재생키 `KeyCap`이 `setPlayPauseKey`와 연결됨.
- [ ] 모든 Task에서 `yarn test:run && yarn tsc -b` 그린. any 타입 미사용.
</content>
</invoke>
