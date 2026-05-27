import { describe, it, expect, beforeEach } from "vitest";
import { usePulse } from "./pulse";

describe("usePulse", () => {
  beforeEach(() => usePulse.setState({ nonce: {} }));

  it("pulse는 트랙 nonce를 증가시킨다", () => {
    usePulse.getState().pulse("t1");
    expect(usePulse.getState().nonce["t1"]).toBe(1);
    usePulse.getState().pulse("t1");
    expect(usePulse.getState().nonce["t1"]).toBe(2);
  });
  it("트랙별로 독립적이다", () => {
    usePulse.getState().pulse("t1");
    usePulse.getState().pulse("t2");
    expect(usePulse.getState().nonce["t1"]).toBe(1);
    expect(usePulse.getState().nonce["t2"]).toBe(1);
  });
  it("없던 트랙은 1부터 시작", () => {
    usePulse.getState().pulse("x");
    expect(usePulse.getState().nonce["x"]).toBe(1);
  });
});
