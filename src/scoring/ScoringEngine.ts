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
