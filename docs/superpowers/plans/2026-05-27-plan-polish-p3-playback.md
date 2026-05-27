# [Polish P3 — Playback: Lane Playhead + Scoring Gate] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폴리싱 #4(플레이 모드 × play 상태 트랙 레인에 플레이헤드)·#10(키 입력은 항상 소리, 채점은 재생 중에만)을 구현한다.

**Architecture:** 베이스/트랙 레인이 공유하는 세로 플레이헤드 선 컴포넌트 `LanePlayhead`를 만들어, `mode==='play' && resolveTrackBehavior('play', status)==='perform'`인 트랙 레인에 렌더한다. perform 소리는 이미 재생 여부와 무관하게 나므로, 채점(`pressTrack`)만 `useStore.playing`일 때로 게이트한다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest

**기준 문서:** `docs/superpowers/specs/2026-05-27-editor-v2-polish-design.md` (§3 E·I). 헤드리스 검증은 `public/samples/moodmode-demo.mp3`. any 금지.

---

## 파일 구조

```
src/
  scoring/
    playSession.ts (+test)   수정: pressTrack을 playing일 때만 채점
  ui/
    LanePlayhead.tsx         생성: 공유 세로 플레이헤드 선
    MarkerEditor.tsx         수정: play×perform 트랙 레인에 LanePlayhead 렌더
```

---

## Task 1: 채점 playing 게이트 (TDD, #10)

**Files:** Modify `src/scoring/playSession.ts`; Create/append `src/scoring/playSession.test.ts`

- [ ] **RED** — `src/scoring/playSession.test.ts`(없으면 생성):
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../store/useStore";
import { startPlaySession, endPlaySession, pressTrack } from "./playSession";
import type { Project } from "../types";

function projectWithPerformTrack(): Project {
  return {
    id: "p1", name: "t", createdAt: 0, updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 10000 },
    master: { volume: 1 },
    tracks: [
      {
        id: "t1", name: "T", status: "play",
        sound: { kind: "builtin", sampleId: "kick" },
        keyBinding: "KeyA", markers: [{ id: "m1", timeMs: 1000 }],
        volume: 1, color: "#fff",
      },
    ],
  };
}

describe("pressTrack playing 게이트", () => {
  beforeEach(() => {
    useStore.setState({ project: projectWithPerformTrack(), mode: "play", playing: false });
    startPlaySession();
  });

  it("재생 중이 아니면 채점하지 않는다(null)", () => {
    useStore.setState({ playing: false });
    expect(pressTrack("t1", 1000)).toBeNull();
  });

  it("재생 중이면 채점한다(판정 반환)", () => {
    useStore.setState({ playing: true });
    const j = pressTrack("t1", 1000); // 마커 m1(1000ms)과 일치
    expect(j).not.toBeNull();
  });

  it("재생 중 아닐 때 누른 키는 점수에 영향 없다", () => {
    useStore.setState({ playing: false });
    pressTrack("t1", 1000);
    // 재생 시작 후 같은 마커를 다시 칠 수 있어야 함(앞선 미재생 입력이 마커를 소진하지 않음)
    useStore.setState({ playing: true });
    expect(pressTrack("t1", 1000)).not.toBeNull();
    endPlaySession();
  });
});
```

- [ ] **확인(RED)** — `yarn vitest run src/scoring/playSession.test.ts` → 미재생 입력이 채점되어(현재는 게이트 없음) 1번/3번 테스트 실패.

- [ ] **GREEN** — `src/scoring/playSession.ts`의 `pressTrack` 맨 위에 게이트 추가:
```ts
export function pressTrack(trackId: string, inputMs: number): Judgment | null {
  if (!useStore.getState().playing) return null; // 재생 중에만 채점 (폴리싱 #10)
  if (!engine) return null;
  const j = engine.registerPress(trackId, inputMs);
  if (j) useStore.getState().setScore(engine.scoreState);
  return j;
}
```

- [ ] **확인(GREEN)** — `yarn vitest run src/scoring/playSession.test.ts` → PASS. `yarn test:run && yarn tsc -b` 그린.

> 비고: perform 소리는 `KeyboardController.triggerTrack`에서 항상 재생되므로(채점과 분리) 별도 변경 없이 "재생 전 미리듣기"가 성립한다.

- [ ] **커밋**
```bash
git add src/scoring/playSession.ts src/scoring/playSession.test.ts && git commit -m "$(cat <<'EOF'
feat(scoring): pressTrack을 재생 중에만 채점(미리듣기 소리는 유지) (폴리싱 #10)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `LanePlayhead` 공유 컴포넌트 + 트랙 레인 렌더 (#4)

**Files:** Create `src/ui/LanePlayhead.tsx`; Modify `src/ui/MarkerEditor.tsx`

- [ ] **LanePlayhead 생성** — 뷰포트+playheadMs 구독, `timeToX`로 위치, 가시범위 밖이면 숨김. 부모(`position:relative`) 기준 absolute 세로선.
```tsx
import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { timeToX } from "../timeline/viewportMath";

/** 레인 위 시안 세로 플레이헤드 선(부모 position:relative 기준). */
export function LanePlayhead() {
  const playheadMs = useStore((s) => s.playheadMs);
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const x = timeToX(playheadMs, { pxPerMs, scrollLeftPx, containerWidthPx });
  if (x < 0 || x > containerWidthPx) return null;

  return (
    <div
      className="lane-playhead"
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: x,
        width: 2,
        background: "#22d3ee",
        boxShadow: "0 0 8px #22d3ee",
        pointerEvents: "none",
        zIndex: 4,
      }}
    />
  );
}
```

- [ ] **MarkerEditor 수정** — play 모드 × perform 상태 트랙 레인에 `LanePlayhead` 렌더. `MarkerEditor`는 현재 focused면 `FocusedMarkerEditor`(svg), else `OverviewMarkerEditor`(canvas)를 직접 반환한다. 두 경우 모두 위에 플레이헤드를 얹기 위해 fragment로 감싼다.
  - import: `import { LanePlayhead } from "./LanePlayhead";`, `import { resolveTrackBehavior } from "../domain/mode";`, `useStore`(mode) 구독.
  - `MarkerEditor` 본문:
    ```tsx
    export function MarkerEditor({ track, focused }: MarkerEditorProps) {
      const mode = useStore((s) => s.mode);
      const showPlayhead = mode === "play" && resolveTrackBehavior("play", track.status) === "perform";
      return (
        <>
          {focused ? <FocusedMarkerEditor track={track} /> : <OverviewMarkerEditor track={track} />}
          {showPlayhead && <LanePlayhead />}
        </>
      );
    }
    ```
    (`useStore` import가 이미 있으면 재사용. `.track-row__lane`이 position:relative이므로 LanePlayhead가 그 기준으로 배치된다.)

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/LanePlayhead.tsx src/ui/MarkerEditor.tsx && git commit -m "$(cat <<'EOF'
feat(ui): LanePlayhead — 플레이 모드 play 트랙 레인에 플레이헤드 표시 (폴리싱 #4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 브라우저 검증 (P3)

- [ ] dev 후 데모 mp3 업로드, 트랙 추가 → 상태 '플레이'(play)로 설정, 키 바인딩. 헤드리스 확인:
  - **플레이 모드**에서 play 상태 트랙 레인에 시안 플레이헤드가 베이스와 함께 표시되고, 재생 시 함께 이동. mute/listening/write 트랙엔 표시 안 됨. 다른 모드(listening/record)에선 트랙 레인에 표시 안 됨.
  - 플레이 모드에서 **재생 전** 키 입력 → 소리는 나지만 점수 변화 없음. **재생 중** 키 입력 → 채점되어 점수/콤보 변동.
  - 콘솔 에러(favicon 제외) 없음.
- [ ] 무인이면 `IMPLEMENTATION_NOTES.md`에 P3 결과/미검증 기록(꾸미지 말 것).
- [ ] `yarn test:run && yarn tsc -b` 최종 그린.
- [ ] **커밋**(노트)
```bash
git add IMPLEMENTATION_NOTES.md && git commit -m "$(cat <<'EOF'
docs: P3(레인 플레이헤드/채점 게이트) 브라우저 검증 기록

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (스펙 대조)
- §3 E(레인 플레이헤드): Task 2 LanePlayhead + play×perform 조건. #4. ✓
- §3 I(채점 분리): Task 1 pressTrack playing 게이트(소리는 KeyboardController에서 항상). #10. ✓
- 순수/로직 TDD(pressTrack 게이트), 시각은 헤드리스(데모 mp3). any 없음. 각 Task 그린+커밋.
