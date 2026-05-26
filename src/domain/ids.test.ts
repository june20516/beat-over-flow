import { describe, it, expect } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("생성된 id는 비어있지 않다", () => {
    expect(newId().length).toBeGreaterThan(0);
  });

  it("연속 호출 시 서로 다른 id를 반환한다", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});
