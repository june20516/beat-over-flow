import { describe, it, expect } from "vitest";
import { ScoringEngine, type PlayableMarker } from "./ScoringEngine";

function markers(): PlayableMarker[] {
  return [
    { trackId: "t1", markerId: "m1", timeMs: 1000 },
    { trackId: "t1", markerId: "m2", timeMs: 2000 },
    { trackId: "t2", markerId: "m3", timeMs: 1000 },
  ];
}

describe("ScoringEngine", () => {
  it("정확한 타이밍 키 입력은 perfect", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t1", 1010)).toBe("perfect");
    expect(e.scoreState.score).toBe(100);
    expect(e.scoreState.combo).toBe(1);
  });

  it("good 윈도우 밖(±100 초과)이면 고스트(null), 점수 변화 없음", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t1", 1200)).toBeNull();
    expect(e.scoreState.totalJudged).toBe(0);
  });

  it("같은 마커를 두 번 치면 두 번째는 null(이미 처리)", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t1", 1000)).toBe("perfect");
    expect(e.registerPress("t1", 1000)).toBeNull();
  });

  it("트랙이 다르면 해당 트랙 마커만 매칭", () => {
    const e = new ScoringEngine(markers());
    expect(e.registerPress("t2", 1000)).toBe("perfect"); // m3
    // t1의 m1은 여전히 미처리
    expect(e.registerPress("t1", 1000)).toBe("perfect");
  });

  it("update: 지나간 미처리 마커는 miss 처리(콤보 리셋)", () => {
    const e = new ScoringEngine(markers());
    e.registerPress("t1", 1000); // m1 perfect, combo 1
    const misses = e.update(1200); // 1000ms 마커들 중 미처리(m3)가 지남(1200-100=1100>1000)
    expect(misses).toBe(1); // m3
    expect(e.scoreState.combo).toBe(0);
    expect(e.scoreState.miss).toBe(1);
  });

  it("total은 전체 마커 수", () => {
    expect(new ScoringEngine(markers()).total).toBe(3);
  });
});
