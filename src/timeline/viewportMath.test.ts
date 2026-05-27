import { describe, it, expect } from "vitest";
import {
  MAX_PX_PER_MS,
  minPxPerMs,
  clampPxPerMs,
  maxScrollLeftPx,
  clampScrollLeftPx,
  timeToX,
  xToTime,
  zoomedViewport,
  centeredScrollLeftPx,
  type Viewport,
} from "./viewportMath";

function vp(partial: Partial<Viewport> = {}): Viewport {
  return { pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000, ...partial };
}

describe("MAX_PX_PER_MS", () => {
  it("상한은 0.5 (1초당 500px)", () => {
    expect(MAX_PX_PER_MS).toBe(0.5);
  });
});

describe("minPxPerMs", () => {
  it("곡 전체가 컨테이너 폭에 딱 맞는 비율", () => {
    expect(minPxPerMs(1000, 10000)).toBeCloseTo(0.1);
  });
  it("durationMs<=0 이면 0", () => {
    expect(minPxPerMs(1000, 0)).toBe(0);
    expect(minPxPerMs(1000, -5)).toBe(0);
  });
});

describe("clampPxPerMs", () => {
  it("min 미만이면 min(=minPxPerMs)으로 올린다", () => {
    expect(clampPxPerMs(0.01, 1000, 10000)).toBeCloseTo(0.1);
  });
  it("MAX 초과면 MAX로 내린다", () => {
    expect(clampPxPerMs(99, 1000, 10000)).toBe(MAX_PX_PER_MS);
  });
  it("범위 내면 그대로", () => {
    expect(clampPxPerMs(0.2, 1000, 10000)).toBeCloseTo(0.2);
  });
});

describe("maxScrollLeftPx", () => {
  it("durationMs*pxPerMs - containerWidthPx", () => {
    expect(maxScrollLeftPx(vp({ pxPerMs: 0.2 }), 10000)).toBe(1000);
  });
  it("콘텐츠가 컨테이너보다 좁으면 0", () => {
    expect(maxScrollLeftPx(vp({ pxPerMs: 0.05 }), 10000)).toBe(0);
  });
});

describe("clampScrollLeftPx", () => {
  it("[0, maxScrollLeftPx]로 클램프", () => {
    const v = vp({ pxPerMs: 0.2 });
    expect(clampScrollLeftPx(-50, v, 10000)).toBe(0);
    expect(clampScrollLeftPx(5000, v, 10000)).toBe(1000);
    expect(clampScrollLeftPx(400, v, 10000)).toBe(400);
  });
});

describe("timeToX / xToTime", () => {
  it("timeToX = ms*pxPerMs - scrollLeftPx", () => {
    expect(timeToX(2000, vp({ pxPerMs: 0.2, scrollLeftPx: 100 }))).toBeCloseTo(300);
  });
  it("xToTime = (x + scrollLeftPx)/pxPerMs", () => {
    expect(xToTime(300, vp({ pxPerMs: 0.2, scrollLeftPx: 100 }))).toBeCloseTo(2000);
  });
  it("timeToX와 xToTime은 역함수", () => {
    const v = vp({ pxPerMs: 0.2, scrollLeftPx: 100 });
    expect(xToTime(timeToX(2000, v), v)).toBeCloseTo(2000);
  });
});

describe("zoomedViewport", () => {
  it("앵커 커서의 시간이 줌 후에도 같은 화면 x에 유지된다", () => {
    const v = vp({ pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 });
    const before = xToTime(500, v);
    const z = zoomedViewport(v, 10000, 2, 500);
    expect(xToTime(500, z)).toBeCloseTo(before);
    expect(z.pxPerMs).toBeCloseTo(0.2);
    expect(z.containerWidthPx).toBe(1000);
  });
  it("factor가 커도 pxPerMs는 MAX로 클램프된다", () => {
    const v = vp({ pxPerMs: 0.4, scrollLeftPx: 0, containerWidthPx: 1000 });
    const z = zoomedViewport(v, 10000, 100, 0);
    expect(z.pxPerMs).toBe(MAX_PX_PER_MS);
  });
  it("factor<1로 축소해도 pxPerMs는 minPxPerMs 아래로 안 내려간다", () => {
    const v = vp({ pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 });
    const z = zoomedViewport(v, 10000, 0.01, 500);
    expect(z.pxPerMs).toBeCloseTo(0.1);
    expect(z.scrollLeftPx).toBe(0);
  });
  it("newScroll은 클램프된다(음수 방지)", () => {
    const v = vp({ pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 });
    const z = zoomedViewport(v, 10000, 2, 0);
    expect(z.scrollLeftPx).toBe(0);
  });
});

describe("centeredScrollLeftPx", () => {
  const vp = { pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 1000 };
  it("플레이헤드를 가시영역 중앙에 두는 scrollLeft", () => {
    expect(centeredScrollLeftPx(50000, vp, 100000)).toBe(4500);
  });
  it("시작 부근은 0으로 클램프", () => {
    expect(centeredScrollLeftPx(0, vp, 100000)).toBe(0);
    expect(centeredScrollLeftPx(2000, vp, 100000)).toBe(0);
  });
  it("끝 부근은 maxScrollLeftPx로 클램프", () => {
    expect(centeredScrollLeftPx(100000, vp, 100000)).toBe(9000);
  });
  it("최소줌(곡 전체 가시)이면 항상 0", () => {
    const min = { pxPerMs: 0.01, scrollLeftPx: 0, containerWidthPx: 1000 };
    expect(centeredScrollLeftPx(50000, min, 100000)).toBe(0);
  });
});
