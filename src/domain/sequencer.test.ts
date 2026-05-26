import { describe, it, expect } from "vitest";
import {
  stepTimes,
  activeStepsToMarkerTimes,
  tilePattern,
  markersAlignedToSteps,
} from "./sequencer";

describe("stepTimes", () => {
  it("구간을 stepCount개로 균등분할한 각 칸 시작 시각", () => {
    expect(Array.from(stepTimes(0, 800, 4))).toEqual([0, 200, 400, 600]);
  });
  it("offset 구간도 정확", () => {
    expect(Array.from(stepTimes(1000, 1800, 4))).toEqual([1000, 1200, 1400, 1600]);
  });
});

describe("activeStepsToMarkerTimes", () => {
  it("켜진 칸 인덱스의 시각만 반환", () => {
    expect(activeStepsToMarkerTimes(0, 800, 4, [0, 2])).toEqual([0, 400]);
  });
});

describe("tilePattern", () => {
  it("count: 패턴을 구간 길이만큼 N회 복제", () => {
    // 구간 [0,400), 패턴 0,200 → 3회 → 0,200,400,600,800,1000
    expect(tilePattern([0, 200], 0, 400, { kind: "count", count: 3 })).toEqual([
      0, 200, 400, 600, 800, 1000,
    ]);
  });
  it("until: 지정 지점 이전까지만", () => {
    // 구간 [0,400), 패턴 0,200 → until 900 → 0,200,400,600,800
    expect(tilePattern([0, 200], 0, 400, { kind: "until", untilMs: 900 })).toEqual([
      0, 200, 400, 600, 800,
    ]);
  });
  it("toEnd: endMs 이전까지", () => {
    expect(tilePattern([0], 0, 400, { kind: "toEnd", endMs: 1000 })).toEqual([0, 400, 800]);
  });
  it("offset 구간의 패턴도 상대오프셋 유지하며 타일링", () => {
    // 구간 [1000,1400), 패턴 1000,1300 → count 2 → 1000,1300,1400,1700
    expect(tilePattern([1000, 1300], 1000, 400, { kind: "count", count: 2 })).toEqual([
      1000, 1300, 1400, 1700,
    ]);
  });
});

describe("markersAlignedToSteps", () => {
  it("각 칸에 허용오차 내 마커가 있으면 true", () => {
    const steps = [0, 200, 400, 600];
    const markers = [5, 401]; // 0칸(±10), 2칸(±10)
    expect(markersAlignedToSteps(markers, steps, 10)).toEqual([true, false, true, false]);
  });
});
