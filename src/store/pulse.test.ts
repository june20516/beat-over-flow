import { describe, it, expect, beforeEach } from "vitest";
import { usePulse } from "./pulse";

describe("usePulse", () => {
  beforeEach(() => usePulse.setState({ events: {} }));

  it("pulse는 트랙 nonce를 증가시킨다", () => {
    usePulse.getState().pulse("t1", "key");
    expect(usePulse.getState().events["t1"]?.nonce).toBe(1);
    usePulse.getState().pulse("t1", "key");
    expect(usePulse.getState().events["t1"]?.nonce).toBe(2);
  });
  it("트랙별로 독립적이다", () => {
    usePulse.getState().pulse("t1", "key");
    usePulse.getState().pulse("t2", "auto");
    expect(usePulse.getState().events["t1"]?.nonce).toBe(1);
    expect(usePulse.getState().events["t2"]?.nonce).toBe(1);
  });
  it("없던 트랙은 1부터 시작", () => {
    usePulse.getState().pulse("x", "key");
    expect(usePulse.getState().events["x"]?.nonce).toBe(1);
  });
  it("source가 마지막 호출 값으로 갱신된다", () => {
    usePulse.getState().pulse("t1", "key");
    expect(usePulse.getState().events["t1"]?.source).toBe("key");
    usePulse.getState().pulse("t1", "auto");
    expect(usePulse.getState().events["t1"]?.source).toBe("auto");
    expect(usePulse.getState().events["t1"]?.nonce).toBe(2);
  });
});
