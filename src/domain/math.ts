/** 0..1 범위로 클램프. 진행률·볼륨 등 정규화된 스칼라에 사용. */
export function clamp01(p: number): number {
  return Math.max(0, Math.min(1, p));
}
