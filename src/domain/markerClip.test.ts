import { describe, expect, it } from "vitest";
import { clipMarkersForDisplay } from "./markerClip";
import type { Marker } from "../types";

const mk = (id: string, timeMs: number): Marker => ({ id, timeMs });

describe("clipMarkersForDisplay", () => {
  it("durationMs 이하만 남긴다(절대시간 보존, 표시만 클립)", () => {
    const markers = [mk("a", 0), mk("b", 500), mk("c", 1500)];
    expect(clipMarkersForDisplay(markers, 1000)).toEqual([mk("a", 0), mk("b", 500)]);
  });
  it("경계값 포함(== durationMs)", () => {
    expect(clipMarkersForDisplay([mk("a", 1000)], 1000)).toEqual([mk("a", 1000)]);
  });
  it("durationMs 0 또는 음수면 빈 배열", () => {
    expect(clipMarkersForDisplay([mk("a", 0)], 0)).toEqual([]);
  });
});
