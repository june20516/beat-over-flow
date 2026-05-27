export interface Viewport {
  pxPerMs: number;
  scrollLeftPx: number;
  containerWidthPx: number;
}

/** 줌 상한: 1초당 500px. */
export const MAX_PX_PER_MS = 0.5;

/** 곡 전체가 컨테이너 폭에 딱 맞는 비율(=100% 줌아웃). durationMs<=0 → 0. */
export function minPxPerMs(containerWidthPx: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return containerWidthPx / durationMs;
}

/** pxPerMs를 [minPxPerMs, MAX_PX_PER_MS]로 클램프. */
export function clampPxPerMs(
  pxPerMs: number,
  containerWidthPx: number,
  durationMs: number,
): number {
  const min = minPxPerMs(containerWidthPx, durationMs);
  return Math.max(min, Math.min(MAX_PX_PER_MS, pxPerMs));
}

/** 스크롤 가능한 최대 오프셋. max(0, durationMs*pxPerMs - containerWidthPx). */
export function maxScrollLeftPx(vp: Viewport, durationMs: number): number {
  return Math.max(0, durationMs * vp.pxPerMs - vp.containerWidthPx);
}

/** scrollLeftPx를 [0, maxScrollLeftPx]로 클램프. */
export function clampScrollLeftPx(
  scrollLeftPx: number,
  vp: Viewport,
  durationMs: number,
): number {
  return Math.max(0, Math.min(maxScrollLeftPx(vp, durationMs), scrollLeftPx));
}

/** 시간(ms) → 화면 x(px). */
export function timeToX(ms: number, vp: Viewport): number {
  return ms * vp.pxPerMs - vp.scrollLeftPx;
}

/** 화면 x(px) → 시간(ms). */
export function xToTime(x: number, vp: Viewport): number {
  return (x + vp.scrollLeftPx) / vp.pxPerMs;
}

/** auto-follow: timeMs가 가시영역 가로 중앙에 오도록 한 scrollLeftPx (클램프 포함). */
export function centeredScrollLeftPx(timeMs: number, vp: Viewport, durationMs: number): number {
  return clampScrollLeftPx(timeMs * vp.pxPerMs - vp.containerWidthPx / 2, vp, durationMs);
}

/**
 * 커서(anchorX)의 시간이 제자리 유지되도록 줌. factor>1 확대.
 * anchorTime = xToTime(anchorX) → newPx = clampPxPerMs(pxPerMs*factor)
 * → newScroll = clampScrollLeftPx(anchorTime*newPx - anchorX).
 */
export function zoomedViewport(
  vp: Viewport,
  durationMs: number,
  factor: number,
  anchorX: number,
): Viewport {
  const anchorTime = xToTime(anchorX, vp);
  const newPx = clampPxPerMs(vp.pxPerMs * factor, vp.containerWidthPx, durationMs);
  const candidate: Viewport = {
    pxPerMs: newPx,
    scrollLeftPx: 0,
    containerWidthPx: vp.containerWidthPx,
  };
  const newScroll = clampScrollLeftPx(anchorTime * newPx - anchorX, candidate, durationMs);
  return { pxPerMs: newPx, scrollLeftPx: newScroll, containerWidthPx: vp.containerWidthPx };
}
