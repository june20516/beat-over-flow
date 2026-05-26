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
