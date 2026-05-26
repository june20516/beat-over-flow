import { describe, it, expect } from "vitest";
import { markersInWindow, ctxTimeForMarker } from "./Scheduler";
import type { Track } from "../types";

function track(id: string, times: number[]): Track {
  return {
    id, name: id, status: "listening",
    sound: { kind: "builtin", sampleId: "kick" },
    keyBinding: null,
    markers: times.map((t, i) => ({ id: `${id}-${i}`, timeMs: t })),
    volume: 1, color: "#fff",
  };
}

describe("markersInWindow", () => {
  it("(from, to] 구간의 마커만, 트랙별로 모은다", () => {
    const tracks = [track("a", [100, 250, 400]), track("b", [200])];
    const due = markersInWindow(tracks, 100, 250);
    // from 초과 ~ to 이하: a의 250, b의 200
    expect(due.map((d) => [d.trackId, d.marker.timeMs]).sort()).toEqual([
      ["a", 250],
      ["b", 200],
    ]);
  });

  it("from은 배타적, to는 포함", () => {
    const tracks = [track("a", [100, 200])];
    expect(markersInWindow(tracks, 100, 200).map((d) => d.marker.timeMs)).toEqual([200]);
  });
});

describe("ctxTimeForMarker", () => {
  it("미래 마커의 ctx 예약시각(초) = 현재ctx초 + (마커ms - 현재ms)/1000", () => {
    expect(ctxTimeForMarker(10, 1200, 1000)).toBeCloseTo(10 + 0.2);
  });
});
