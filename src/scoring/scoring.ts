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
