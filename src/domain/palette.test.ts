import { describe, it, expect } from "vitest";
import { pickColor, PALETTE } from "./palette";

describe("pickColor", () => {
  it("인덱스를 팔레트 길이로 순환한다", () => {
    expect(pickColor(0)).toBe(PALETTE[0]);
    expect(pickColor(PALETTE.length)).toBe(PALETTE[0]);
    expect(pickColor(PALETTE.length + 1)).toBe(PALETTE[1]);
  });
});
