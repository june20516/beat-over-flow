# 계획 4 — 플레이 모드 + 채점 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 만든 곡을 리듬게임으로 연주한다. 플레이 모드에서 `play` 트랙의 마커 타이밍에 바인딩 키를 누르면 Perfect/Good/Miss로 채점되고, 점수·콤보·정확도가 표시된다.

**Architecture:** 채점 판정·점수 누적은 순수함수 `scoring.ts`로 TDD. 입력↔마커 매칭과 miss 검출은 `ScoringEngine` 클래스(순수, 명시적 시각 입력)로 TDD. 플레이 세션 수명과 스토어 반영은 `playSession.ts` 글루가 담당. `perform` 트랙은 스케줄러 자동재생에서 제외되며(계획 2), 키 입력 시 소리 재생 + 채점한다. miss는 RAF 루프에서 지나간 미처리 마커로 검출.

**Tech Stack:** 계획 1~3과 동일.

**선행 조건:** 계획 3 완료 (resolveTrackBehavior, KeyboardController, runtime RAF/스케줄러, ModeSwitcher 존재).

---

## 파일 구조 (이 계획에서 생성/수정)

```
src/
  scoring/
    scoring.ts             생성: judge/applyJudgment/accuracy
    scoring.test.ts        생성
    ScoringEngine.ts       생성: 입력↔마커 매칭 + miss 검출
    ScoringEngine.test.ts  생성
    playSession.ts         생성: 세션 수명 + 스토어 반영 글루
  store/
    useStore.ts            수정: score 상태 + 액션
    useStore.test.ts       수정
  input/
    KeyboardController.ts   수정: perform 처리(소리+채점)
  audio/
    runtime.ts             수정: 플레이 세션 시작/종료, RAF에서 miss 업데이트
  ui/
    ScoreHud.tsx           생성: 점수/콤보/정확도 HUD
    Editor.tsx             수정: 모드별 세션 결선 + HUD
```

---

## Task 1: 채점 순수함수

**Files:**
- Create: `src/scoring/scoring.ts`, `src/scoring/scoring.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/scoring/scoring.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { judge, applyJudgment, accuracy, emptyScore, SCORE } from "./scoring";

describe("judge", () => {
  it("±40ms 이내 perfect", () => {
    expect(judge(0)).toBe("perfect");
    expect(judge(40)).toBe("perfect");
    expect(judge(-40)).toBe("perfect");
  });
  it("±100ms 이내 good", () => {
    expect(judge(41)).toBe("good");
    expect(judge(-100)).toBe("good");
  });
  it("그 밖 miss", () => {
    expect(judge(101)).toBe("miss");
  });
});

describe("applyJudgment", () => {
  it("perfect는 점수+콤보 증가", () => {
    const s = applyJudgment(emptyScore(), "perfect");
    expect(s.score).toBe(SCORE.perfect);
    expect(s.combo).toBe(1);
    expect(s.perfect).toBe(1);
    expect(s.totalJudged).toBe(1);
  });
  it("miss는 콤보 리셋, 점수 변화 없음", () => {
    let s = applyJudgment(emptyScore(), "perfect");
    s = applyJudgment(s, "miss");
    expect(s.combo).toBe(0);
    expect(s.score).toBe(SCORE.perfect);
    expect(s.miss).toBe(1);
  });
  it("maxCombo는 최대 콤보를 유지", () => {
    let s = emptyScore();
    s = applyJudgment(s, "good");
    s = applyJudgment(s, "good");
    s = applyJudgment(s, "miss");
    expect(s.maxCombo).toBe(2);
  });
});

describe("accuracy", () => {
  it("판정 합계 대비 획득 점수 비율(0..1)", () => {
    let s = emptyScore();
    s = applyJudgment(s, "perfect"); // 100/100
    s = applyJudgment(s, "miss"); // +0/100
    expect(accuracy(s)).toBeCloseTo(100 / 200);
  });
  it("판정 없으면 1", () => {
    expect(accuracy(emptyScore())).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/scoring/scoring.test.ts`
Expected: FAIL — 미정의.

- [ ] **Step 3: 구현**

`src/scoring/scoring.ts`:
```ts
export type Judgment = "perfect" | "good" | "miss";

export const WINDOWS = { perfectMs: 40, goodMs: 100 } as const;
export const SCORE: Record<Judgment, number> = { perfect: 100, good: 50, miss: 0 };

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  totalJudged: number;
}

export function emptyScore(): ScoreState {
  return { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, totalJudged: 0 };
}

/** 마커와의 시간차(ms, 부호 무관)로 판정. */
export function judge(deltaMs: number): Judgment {
  const d = Math.abs(deltaMs);
  if (d <= WINDOWS.perfectMs) return "perfect";
  if (d <= WINDOWS.goodMs) return "good";
  return "miss";
}

export function applyJudgment(s: ScoreState, j: Judgment): ScoreState {
  const next: ScoreState = {
    ...s,
    score: s.score + SCORE[j],
    combo: j === "miss" ? 0 : s.combo + 1,
    perfect: s.perfect + (j === "perfect" ? 1 : 0),
    good: s.good + (j === "good" ? 1 : 0),
    miss: s.miss + (j === "miss" ? 1 : 0),
    totalJudged: s.totalJudged + 1,
  };
  next.maxCombo = Math.max(s.maxCombo, next.combo);
  return next;
}

/** 판정 합계 대비 획득 점수 비율(0..1). 판정이 없으면 1. */
export function accuracy(s: ScoreState): number {
  if (s.totalJudged === 0) return 1;
  return s.score / (s.totalJudged * SCORE.perfect);
}
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `npx vitest run src/scoring/scoring.test.ts`
Expected: PASS.
```bash
git add src/scoring/scoring.ts src/scoring/scoring.test.ts
git commit -m "feat: 채점 순수함수 (judge/applyJudgment/accuracy)"
```

---

## Task 2: ScoringEngine

**Files:**
- Create: `src/scoring/ScoringEngine.ts`, `src/scoring/ScoringEngine.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/scoring/ScoringEngine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ScoringEngine, type PlayableMarker } from "./ScoringEngine";

function markers(): PlayableMarker[] {
  return [
    { trackId: "t1", markerId: "m1", timeMs: 1000 },
    { trackId: "t1", markerId: "m2", timeMs: 2000 },
    { trackId: "t2", markerId: "m3", timeMs: 1000 },
  ];
}

describe("ScoringEngine", () => {
  it("정확한 타이밍 키 입력은 perfect", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t1", 1010)).toBe("perfect");
    expect(e.scoreState.score).toBe(100);
    expect(e.scoreState.combo).toBe(1);
  });

  it("good 윈도우 밖(±100 초과)이면 고스트(null), 점수 변화 없음", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t1", 1200)).toBeNull();
    expect(e.scoreState.totalJudged).toBe(0);
  });

  it("같은 마커를 두 번 치면 두 번째는 null(이미 처리)", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t1", 1000)).toBe("perfect");
    expect(e.registerPress("t1", 1000)).toBeNull();
  });

  it("트랙이 다르면 해당 트랙 마커만 매칭", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t2", 1000)).toBe("perfect"); // m3
    // t1의 m1은 여전히 미처리
    expect(e.registerPress("t1", 1000)).toBe("perfect");
  });

  it("update: 지나간 미처리 마커는 miss 처리(콤보 리셋)", () => {
    const e = new ScoringEngine(markers());
    e.registerPress("t1", 1000); // m1 perfect, combo 1
    const misses = e.update(1200); // 1000ms 마커들 중 미처리(m3)가 지남(1200-100=1100>1000)
    expect(misses).toBe(1); // m3
    expect(e.scoreState.combo).toBe(0);
    expect(e.scoreState.miss).toBe(1);
  });

  it("total은 전체 마커 수", () => {
    expect(new ScoringEngine(markers()).total).toBe(3);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/scoring/ScoringEngine.test.ts`
Expected: FAIL — 미정의.

- [ ] **Step 3: 구현**

`src/scoring/ScoringEngine.ts`:
```ts
import { judge, applyJudgment, emptyScore, WINDOWS, type Judgment, type ScoreState } from "./scoring";

export interface PlayableMarker {
  trackId: string;
  markerId: string;
  timeMs: number;
}

/** 플레이 모드 채점 엔진. 키 입력을 마커와 매칭하고 지나간 마커를 miss 처리한다. */
export class ScoringEngine {
  private readonly hit = new Set<string>();
  private readonly missed = new Set<string>();
  private state: ScoreState = emptyScore();

  constructor(private readonly markers: PlayableMarker[]) {}

  get scoreState(): ScoreState {
    return this.state;
  }

  get total(): number {
    return this.markers.length;
  }

  /** 키 입력 시 같은 트랙의 가장 가까운 미처리 마커를 good 윈도우 내에서 찾아 판정. 없으면 null(고스트). */
  registerPress(trackId: string, inputMs: number): Judgment | null {
    let best: PlayableMarker | null = null;
    let bestDelta = Infinity;
    for (const m of this.markers) {
      if (m.trackId !== trackId) continue;
      if (this.hit.has(m.markerId) || this.missed.has(m.markerId)) continue;
      const delta = Math.abs(m.timeMs - inputMs);
      if (delta <= WINDOWS.goodMs && delta < bestDelta) {
        best = m;
        bestDelta = delta;
      }
    }
    if (!best) return null;
    this.hit.add(best.markerId);
    const j = judge(bestDelta);
    this.state = applyJudgment(this.state, j);
    return j;
  }

  /** 현재 시각 기준, good 윈도우를 지난 미처리 마커를 miss 처리. miss 개수 반환. */
  update(nowMs: number): number {
    let misses = 0;
    for (const m of this.markers) {
      if (this.hit.has(m.markerId) || this.missed.has(m.markerId)) continue;
      if (m.timeMs < nowMs - WINDOWS.goodMs) {
        this.missed.add(m.markerId);
        this.state = applyJudgment(this.state, "miss");
        misses++;
      }
    }
    return misses;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `npx vitest run src/scoring/ScoringEngine.test.ts`
Expected: PASS (6 tests).
```bash
git add src/scoring/ScoringEngine.ts src/scoring/ScoringEngine.test.ts
git commit -m "feat: ScoringEngine (입력↔마커 매칭, miss 검출)"
```

---

## Task 3: 스토어 — 점수 상태

**Files:**
- Modify: `src/store/useStore.ts`, `src/store/useStore.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/store/useStore.test.ts`에 추가:
```ts
import { emptyScore, applyJudgment } from "../scoring/scoring";

describe("useStore 점수", () => {
  beforeEach(() => {
    useStore.setState({
      project: sampleProject(), playing: false, playheadMs: 0,
      mode: "play", selectedTrackId: null, score: emptyScore(),
    });
  });
  it("setScore로 점수 상태 교체", () => {
    const s = applyJudgment(emptyScore(), "perfect");
    useStore.getState().setScore(s);
    expect(useStore.getState().score.score).toBe(100);
  });
  it("resetScore로 초기화", () => {
    useStore.getState().setScore(applyJudgment(emptyScore(), "perfect"));
    useStore.getState().resetScore();
    expect(useStore.getState().score.totalJudged).toBe(0);
  });
});
```

> 기존 모든 `useStore.setState({...})` 호출에 `score: emptyScore()`를 포함하도록 보강(타입 충족). 파일 상단에 `import { emptyScore } from "../scoring/scoring";` 추가.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: FAIL — `score`/`setScore` 미정의.

- [ ] **Step 3: 스토어 확장**

`src/store/useStore.ts` 상단 import 추가:
```ts
import { emptyScore, type ScoreState } from "../scoring/scoring";
```

`StoreState`에 추가:
```ts
  score: ScoreState;
  setScore: (score: ScoreState) => void;
  resetScore: () => void;
```

초기 상태에 `score: emptyScore()` 추가, 액션 구현:
```ts
  setScore: (score) => set({ score }),
  resetScore: () => set({ score: emptyScore() }),
```

- [ ] **Step 4: 테스트 통과 확인 & Commit**

Run: `npx vitest run src/store/useStore.test.ts`
Expected: PASS.
```bash
git add src/store/useStore.ts src/store/useStore.test.ts
git commit -m "feat: 스토어 점수 상태"
```

---

## Task 4: 플레이 세션 글루

> 스토어에서 `play` 트랙의 마커를 모아 ScoringEngine을 만들고, 판정 결과를 스토어 `score`에 반영한다.

**Files:**
- Create: `src/scoring/playSession.ts`

- [ ] **Step 1: 구현**

`src/scoring/playSession.ts`:
```ts
import { ScoringEngine, type PlayableMarker } from "./ScoringEngine";
import { useStore } from "../store/useStore";
import { resolveTrackBehavior } from "../domain/mode";
import type { Judgment } from "./scoring";

let engine: ScoringEngine | null = null;

/** 현재 play(perform) 트랙들의 마커로 채점 세션을 시작한다. */
export function startPlaySession(): void {
  const state = useStore.getState();
  const project = state.project;
  if (!project) return;
  const markers: PlayableMarker[] = [];
  for (const t of project.tracks) {
    if (resolveTrackBehavior("play", t.status) !== "perform") continue;
    for (const m of t.markers) {
      markers.push({ trackId: t.id, markerId: m.id, timeMs: m.timeMs });
    }
  }
  engine = new ScoringEngine(markers);
  useStore.getState().resetScore();
}

export function endPlaySession(): void {
  engine = null;
}

/** perform 트랙 키 입력 채점. 판정(또는 고스트 null) 반환. */
export function pressTrack(trackId: string, inputMs: number): Judgment | null {
  if (!engine) return null;
  const j = engine.registerPress(trackId, inputMs);
  if (j) useStore.getState().setScore(engine.scoreState);
  return j;
}

/** 시간 진행에 따른 miss 갱신. */
export function updatePlay(nowMs: number): void {
  if (!engine) return;
  const misses = engine.update(nowMs);
  if (misses > 0) useStore.getState().setScore(engine.scoreState);
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/scoring/playSession.ts
git commit -m "feat: 플레이 세션 글루 (엔진↔스토어)"
```

---

## Task 5: KeyboardController — perform 처리

**Files:**
- Modify: `src/input/KeyboardController.ts`

- [ ] **Step 1: perform 분기 추가**

`src/input/KeyboardController.ts` 상단 import에 추가:
```ts
import { pressTrack } from "../scoring/playSession";
```

`for (const track of matched)` 루프에서 `behavior === "record"` 처리 뒤에 perform 분기를 추가:
```ts
      if (behavior === "perform") {
        // 소리는 항상 재생(악기처럼), 채점은 가장 가까운 마커와 매칭
        const buffer = getLibrary().get(track.sound);
        if (buffer) {
          const eng = getEngine();
          playSample(eng.ctx, buffer, eng.masterGain, eng.ctx.currentTime, track.volume);
        }
        pressTrack(track.id, state.playheadMs);
      }
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/input/KeyboardController.ts
git commit -m "feat: 플레이 모드 키 입력 채점+소리"
```

---

## Task 6: runtime — 플레이 세션 시작/종료 + miss 업데이트

**Files:**
- Modify: `src/audio/runtime.ts`

- [ ] **Step 1: import 및 RAF/play 결선**

`src/audio/runtime.ts` 상단 import에 추가:
```ts
import { startPlaySession, endPlaySession, updatePlay } from "../scoring/playSession";
```

`play()`에서 재생 시작 직후(스케줄러 기동 부근)에 플레이 세션 시작 결선:
```ts
  if (useStore.getState().mode === "play") {
    startPlaySession();
  }
```

`startRaf()`의 tick 안에서 `setPlayheadMs` 직후 플레이 모드면 miss 업데이트를 호출:
```ts
    const st = useStore.getState();
    st.setPlayheadMs(source.currentTimeMs());
    if (st.mode === "play") {
      updatePlay(source.currentTimeMs());
    }
```

`pause()`와 재생 종료 처리에서 세션 종료:
```ts
// pause() 안:
  endPlaySession();
// startRaf tick의 재생 종료 분기 안(stopScheduler 옆):
  endPlaySession();
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/audio/runtime.ts
git commit -m "feat: runtime 플레이 세션 시작/종료 및 miss 업데이트"
```

---

## Task 7: ScoreHud

**Files:**
- Create: `src/ui/ScoreHud.tsx`

- [ ] **Step 1: 구현**

`src/ui/ScoreHud.tsx`:
```tsx
import { useStore } from "../store/useStore";
import { accuracy } from "../scoring/scoring";

export function ScoreHud() {
  const mode = useStore((s) => s.mode);
  const score = useStore((s) => s.score);
  if (mode !== "play") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        padding: "10px 14px",
        background: "rgba(16,19,26,0.9)",
        border: "1px solid #2a3140",
        borderRadius: 8,
        fontFamily: "monospace",
        textAlign: "right",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700 }}>{score.score}</div>
      <div>콤보 {score.combo} (최대 {score.maxCombo})</div>
      <div>정확도 {(accuracy(score) * 100).toFixed(1)}%</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>
        P {score.perfect} · G {score.good} · M {score.miss}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 & Commit**

Run: `npx tsc -b`
Expected: 에러 없음.
```bash
git add src/ui/ScoreHud.tsx
git commit -m "feat: ScoreHud (점수/콤보/정확도)"
```

---

## Task 8: Editor 통합 (모드 전환 시 세션 + HUD)

**Files:**
- Modify: `src/ui/Editor.tsx`

- [ ] **Step 1: HUD 및 모드 효과 추가**

`src/ui/Editor.tsx`의 import에 추가:
```ts
import { ScoreHud } from "./ScoreHud";
import { startPlaySession, endPlaySession } from "../scoring/playSession";
```

모드 전환 시 세션을 준비/정리하는 effect 추가(기존 effect들 옆):
```ts
  useEffect(() => {
    if (mode === "play") startPlaySession();
    else endPlaySession();
  }, [mode]);
```

`return`의 최상위 컨테이너 안에 `<ScoreHud />`를 추가(예: `<TransportBar />` 위 또는 div 바로 아래):
```tsx
      <ScoreHud />
```

- [ ] **Step 2: 전체 테스트 + 타입체크**

Run: `npm run test:run && npx tsc -b`
Expected: 모든 테스트 PASS, 타입 에러 없음.

- [ ] **Step 3: 수동 검증 (브라우저)**

Run: `npm run dev`
확인 항목:
1. 트랙을 만들고 마커 작성(계획 3), 트랙 상태를 **플레이**로, 키 바인딩 설정.
2. **플레이 모드**로 전환 → HUD 표시(점수 0).
3. ▶ 재생 → play 트랙은 자동재생되지 않음. 마커 타이밍에 키를 누르면 소리 + 판정.
4. 정확히 누르면 Perfect(점수↑, 콤보↑), 약간 빗나가면 Good, 놓치면(또는 늦으면) Miss로 콤보 리셋·M 증가.
5. 정확도% 갱신. 여러 play 트랙의 점수가 합산됨.
6. listening 상태 트랙은 플레이 모드에서도 반주로 자동재생(채점 대상 아님).
7. 리스닝/레코드 모드로 돌아가면 HUD 사라지고 채점 없음.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Editor.tsx
git commit -m "feat: Editor 플레이 세션 결선 및 ScoreHud 통합 (v1 완성)"
```

---

## Self-Review 결과

- **스펙 커버리지**: 정확도 채점 Perfect(±40)/Good(±100)/Miss(Task 1), 점수·콤보·정확도(Task 1,7), 입력↔마커 매칭+miss(Task 2), 여분 키 고스트(점수변화 없음, Task 2 registerPress null + KeyboardController가 소리는 재생), 여러 play 트랙 합산(Task 4 단일 엔진), 플레이 모드에서 listening 트랙 반주 자동재생(계획 2 스케줄러가 auto 처리). ✅
- **플레이스홀더**: 없음.
- **타입 일관성**: `Judgment/ScoreState/judge/applyJudgment/accuracy/emptyScore/WINDOWS/SCORE`, `ScoringEngine/PlayableMarker`, `startPlaySession/endPlaySession/pressTrack/updatePlay`, 스토어 `score/setScore/resetScore` — 계획 간 동일 시그니처. KeyboardController는 계획 3의 record 분기에 perform 분기를 더한 형태로 일관.
- **스펙 §14 열린 항목**: 채점 윈도우(40/100), read-back tolerance(min(20, 칸간격/2))는 본 계획·계획 3에 구체값으로 확정. 출력 지연 보정은 v1 미포함(후속).
```
```

> **전체 v1 완료 정의:** 계획 1~4를 순서대로 구현하면 — 곡 업로드 → 트랙/사운드/마커 작성(3방식) → 리스닝 동기재생 → 플레이 채점까지, 스펙 §12의 v1 IN 범위가 모두 동작한다. 유튜브·세로뷰·BPM 그리드·내보내기 등은 §13의 v2+ 대상.
