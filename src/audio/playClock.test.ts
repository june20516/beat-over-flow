import { describe, it, expect } from "vitest";
import { elapsedMs } from "./playClock";

describe("elapsedMs", () => {
  it("재생 중: (현재 ctx시각 - 시작 ctx시각) + 시작 오프셋", () => {
    // ctxStartSec=10초에 offset 2000ms부터 재생, 현재 ctx 12.5초
    expect(elapsedMs(12.5, 10, 2000)).toBeCloseTo(2000 + 2500);
  });

  it("durationMs로 상한 클램프는 호출자 몫이 아니라 여기서 하지 않는다(원시값 반환)", () => {
    expect(elapsedMs(20, 10, 0)).toBeCloseTo(10000);
  });
});
