import { describe, expect, it } from "vitest";
import { formatKeyCode } from "./formatKeyCode";

describe("formatKeyCode", () => {
  it("null이면 'Key'", () => {
    expect(formatKeyCode(null)).toBe("Key");
  });
  it("빈 문자열이면 'Key'", () => {
    expect(formatKeyCode("")).toBe("Key");
  });
  it("KeyA → 'A'", () => {
    expect(formatKeyCode("KeyA")).toBe("A");
  });
  it("KeyZ → 'Z'", () => {
    expect(formatKeyCode("KeyZ")).toBe("Z");
  });
  it("Digit0 → '0'", () => {
    expect(formatKeyCode("Digit0")).toBe("0");
  });
  it("Digit9 → '9'", () => {
    expect(formatKeyCode("Digit9")).toBe("9");
  });
  it("Numpad0 → '0'", () => {
    expect(formatKeyCode("Numpad0")).toBe("0");
  });
  it("Numpad9 → '9'", () => {
    expect(formatKeyCode("Numpad9")).toBe("9");
  });
  it("Space → 'Space'", () => {
    expect(formatKeyCode("Space")).toBe("Space");
  });
  it("ArrowLeft → '←'", () => {
    expect(formatKeyCode("ArrowLeft")).toBe("←");
  });
  it("ArrowRight → '→'", () => {
    expect(formatKeyCode("ArrowRight")).toBe("→");
  });
  it("ArrowUp → '↑'", () => {
    expect(formatKeyCode("ArrowUp")).toBe("↑");
  });
  it("ArrowDown → '↓'", () => {
    expect(formatKeyCode("ArrowDown")).toBe("↓");
  });
  it("Escape → 'Esc'", () => {
    expect(formatKeyCode("Escape")).toBe("Esc");
  });
  it("Enter → 'Enter'", () => {
    expect(formatKeyCode("Enter")).toBe("Enter");
  });
  it("그 외 코드는 원문 그대로", () => {
    expect(formatKeyCode("F5")).toBe("F5");
    expect(formatKeyCode("Tab")).toBe("Tab");
  });
});
