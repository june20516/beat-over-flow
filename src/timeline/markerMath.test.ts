import { describe, it, expect } from "vitest";
import {
  isMarkerEditingEnabled,
  visibleMarkers,
  findNearestMarker,
} from "./markerMath";
import type { Viewport } from "./viewportMath";
import type { Marker } from "../types";

const vp: Viewport = { pxPerMs: 0.1, scrollLeftPx: 0, containerWidthPx: 100 };

describe("isMarkerEditingEnabled", () => {
  it("record 모드 + record 트랙에서만 true", () => {
    expect(isMarkerEditingEnabled("record", "record")).toBe(true);
  });
  it("record 모드라도 record가 아니면 false", () => {
    expect(isMarkerEditingEnabled("record", "play")).toBe(false);
    expect(isMarkerEditingEnabled("record", "listening")).toBe(false);
    expect(isMarkerEditingEnabled("record", "mute")).toBe(false);
  });
  it("record가 아닌 모드는 항상 false", () => {
    expect(isMarkerEditingEnabled("listening", "record")).toBe(false);
    expect(isMarkerEditingEnabled("play", "record")).toBe(false);
  });
});

describe("visibleMarkers", () => {
  const markers: Marker[] = [
    { id: "a", timeMs: 0 },
    { id: "b", timeMs: 500 },
    { id: "c", timeMs: 1000 },
    { id: "d", timeMs: 2000 },
  ];

  it("[0,width] 범위(경계 포함)인 마커만 x좌표와 함께 반환", () => {
    const result = visibleMarkers(markers, vp, 100);
    expect(result.map((r) => r.marker.id)).toEqual(["a", "b", "c"]);
    expect(result.map((r) => r.x)).toEqual([0, 50, 100]);
  });

  it("scrollLeftPx가 적용되면 가시 윈도가 이동한다", () => {
    const scrolled: Viewport = { ...vp, scrollLeftPx: 100 };
    const result = visibleMarkers(markers, scrolled, 100);
    expect(result.map((r) => r.marker.id)).toEqual(["c", "d"]);
    expect(result.map((r) => r.x)).toEqual([0, 100]);
  });

  it("빈 배열은 빈 배열을 반환", () => {
    expect(visibleMarkers([], vp, 100)).toEqual([]);
  });
});

describe("findNearestMarker", () => {
  const markers: Marker[] = [
    { id: "a", timeMs: 100 },
    { id: "b", timeMs: 300 },
    { id: "c", timeMs: 320 },
  ];

  it("tolerance 이내에서 가장 가까운 마커를 반환", () => {
    expect(findNearestMarker(markers, 90, 50)?.id).toBe("a");
    expect(findNearestMarker(markers, 310, 50)?.id).toBe("b");
    expect(findNearestMarker(markers, 318, 50)?.id).toBe("c");
  });

  it("tolerance 밖이면 null", () => {
    expect(findNearestMarker(markers, 200, 30)).toBeNull();
  });

  it("빈 배열이면 null", () => {
    expect(findNearestMarker([], 100, 50)).toBeNull();
  });
});
