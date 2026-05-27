import { describe, it, expect } from "vitest";
import { classifyPointerSequence, dragToRegion } from "./laneGesture";
import type { Viewport } from "./viewportMath";

describe("classifyPointerSequence", () => {
  it("이동량이 임계 미만이면 click", () => {
    expect(classifyPointerSequence(100, 103, 5)).toBe("click");
    expect(classifyPointerSequence(100, 100, 5)).toBe("click");
  });
  it("이동량이 임계 이상이면 drag", () => {
    expect(classifyPointerSequence(100, 106, 5)).toBe("drag");
    expect(classifyPointerSequence(100, 90, 5)).toBe("drag");
  });
  it("경계(정확히 임계)는 drag로 본다", () => {
    expect(classifyPointerSequence(100, 105, 5)).toBe("drag");
  });
});

describe("dragToRegion", () => {
  const vp: Viewport = { pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 };
  it("start<end로 정렬해 ms 구간을 만든다", () => {
    expect(dragToRegion(100, 300, vp, 100000)).toEqual({ startMs: 1000, endMs: 3000 });
  });
  it("역방향 드래그도 정렬한다", () => {
    expect(dragToRegion(300, 100, vp, 100000)).toEqual({ startMs: 1000, endMs: 3000 });
  });
  it("0..durationMs로 클램프한다", () => {
    const scrolled: Viewport = { ...vp, scrollLeftPx: 0 };
    expect(dragToRegion(-50, 2000000, scrolled, 100000)).toEqual({ startMs: 0, endMs: 100000 });
  });
});
