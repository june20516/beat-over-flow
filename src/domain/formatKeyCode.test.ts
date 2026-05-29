import { describe, expect, it } from "vitest";
import { formatKeyCode } from "./formatKeyCode";

describe("formatKeyCode", () => {
  it("null/빈 문자열이면 'Key'", () => {
    expect(formatKeyCode(null)).toBe("Key");
    expect(formatKeyCode("")).toBe("Key");
  });

  describe("알파넘릭", () => {
    it("KeyA/Z → 'A'/'Z'", () => {
      expect(formatKeyCode("KeyA")).toBe("A");
      expect(formatKeyCode("KeyZ")).toBe("Z");
    });
    it("Digit/Numpad 0–9 → 숫자만", () => {
      expect(formatKeyCode("Digit0")).toBe("0");
      expect(formatKeyCode("Digit9")).toBe("9");
      expect(formatKeyCode("Numpad0")).toBe("0");
      expect(formatKeyCode("Numpad9")).toBe("9");
    });
  });

  describe("스페이스 / 화살표 / 편집", () => {
    it("Space는 그대로", () => {
      expect(formatKeyCode("Space")).toBe("Space");
    });
    it("화살표 → 기호", () => {
      expect(formatKeyCode("ArrowLeft")).toBe("←");
      expect(formatKeyCode("ArrowRight")).toBe("→");
      expect(formatKeyCode("ArrowUp")).toBe("↑");
      expect(formatKeyCode("ArrowDown")).toBe("↓");
    });
    it("편집 키 매핑", () => {
      expect(formatKeyCode("Escape")).toBe("Esc");
      expect(formatKeyCode("Enter")).toBe("↩");
      expect(formatKeyCode("NumpadEnter")).toBe("↩");
      expect(formatKeyCode("Backspace")).toBe("⌫");
      expect(formatKeyCode("Delete")).toBe("⌦");
      expect(formatKeyCode("Tab")).toBe("Tab");
      expect(formatKeyCode("CapsLock")).toBe("Caps");
      expect(formatKeyCode("Home")).toBe("Home");
      expect(formatKeyCode("PageUp")).toBe("PgUp");
    });
  });

  describe("punctuation", () => {
    it("주요 punctuation → 글자", () => {
      expect(formatKeyCode("Backquote")).toBe("`");
      expect(formatKeyCode("Minus")).toBe("-");
      expect(formatKeyCode("Equal")).toBe("=");
      expect(formatKeyCode("BracketLeft")).toBe("[");
      expect(formatKeyCode("BracketRight")).toBe("]");
      expect(formatKeyCode("Semicolon")).toBe(";");
      expect(formatKeyCode("Quote")).toBe("'");
      expect(formatKeyCode("Comma")).toBe(",");
      expect(formatKeyCode("Period")).toBe(".");
      expect(formatKeyCode("Slash")).toBe("/");
      expect(formatKeyCode("Backslash")).toBe("\\");
    });
  });

  describe("modifier 좌/우 구분", () => {
    it("Ctrl/Shift/Alt는 OS 무관 L*/R* 라벨", () => {
      expect(formatKeyCode("ControlLeft")).toBe("LCtrl");
      expect(formatKeyCode("ControlRight")).toBe("RCtrl");
      expect(formatKeyCode("ShiftLeft")).toBe("LShift");
      expect(formatKeyCode("ShiftRight")).toBe("RShift");
      expect(formatKeyCode("AltLeft")).toBe("LAlt");
      expect(formatKeyCode("AltRight")).toBe("RAlt");
    });
    it("Meta는 mac에서 ⌘, 그 외 Win", () => {
      expect(formatKeyCode("MetaLeft", { mac: true })).toBe("L⌘");
      expect(formatKeyCode("MetaRight", { mac: true })).toBe("R⌘");
      expect(formatKeyCode("MetaLeft", { mac: false })).toBe("LWin");
      expect(formatKeyCode("MetaRight", { mac: false })).toBe("RWin");
    });
  });

  it("F1–F12 등 매핑되지 않은 코드는 원문 그대로", () => {
    expect(formatKeyCode("F5")).toBe("F5");
    expect(formatKeyCode("F12")).toBe("F12");
    expect(formatKeyCode("ScrollLock")).toBe("ScrollLock");
  });
});
