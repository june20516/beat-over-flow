import { xToTime, type Viewport } from "./viewportMath";

export type PointerKind = "click" | "drag";

/** 시작/종료 x의 이동량이 임계 이상이면 drag, 아니면 click. */
export function classifyPointerSequence(downX: number, upX: number, thresholdPx: number): PointerKind {
  return Math.abs(upX - downX) >= thresholdPx ? "drag" : "click";
}

export interface Region {
  startMs: number;
  endMs: number;
}

/** 드래그 두 x를 정렬된 ms 구간으로(0..durationMs 클램프). */
export function dragToRegion(x1: number, x2: number, vp: Viewport, durationMs: number): Region {
  const a = xToTime(Math.min(x1, x2), vp);
  const b = xToTime(Math.max(x1, x2), vp);
  const clamp = (t: number) => Math.max(0, Math.min(durationMs, t));
  return { startMs: clamp(a), endMs: clamp(b) };
}
