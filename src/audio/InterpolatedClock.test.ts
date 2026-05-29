import { describe, expect, it } from "vitest";
import { InterpolatedClock } from "./InterpolatedClock";

/** 주입형 가짜 시계. */
function fakeNow() {
  let t = 0;
  const fn = () => t;
  return { fn, advance: (ms: number) => { t += ms; } };
}

describe("InterpolatedClock", () => {
  it("정지 상태에선 마지막 동기화 값을 반환", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(2000);
    clk.advance(500);
    expect(c.currentMs()).toBe(2000);
  });

  it("재생 중에는 now 경과만큼 보간", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(2000);
    c.setRunning(true);
    clk.advance(300);
    expect(c.currentMs()).toBe(2300);
  });

  it("setRunning(false)는 현재 보간값을 고정", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(1000);
    c.setRunning(true);
    clk.advance(400);
    c.setRunning(false); // 1400에서 고정
    clk.advance(1000);
    expect(c.currentMs()).toBe(1400);
  });

  it("재생 중 sync는 드리프트를 보정(리싱크)", () => {
    const clk = fakeNow();
    const c = new InterpolatedClock(clk.fn);
    c.sync(1000);
    c.setRunning(true);
    clk.advance(500); // 보간상 1500
    c.sync(1480);     // 실제 유튜브가 1480이라고 알림 → 리앵커
    clk.advance(100);
    expect(c.currentMs()).toBe(1580);
  });
});
