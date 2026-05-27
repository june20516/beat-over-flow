import { describe, it, expect } from "vitest";
import { resolveWheelIntent, type WheelLike } from "./wheelIntent";

function w(over: Partial<WheelLike> = {}): WheelLike {
  return { deltaX: 0, deltaY: 0, shiftKey: false, ctrlKey: false, metaKey: false, ...over };
}

describe("resolveWheelIntent", () => {
  it("modifier 없으면 가로 팬: deltaX 우선", () => {
    expect(resolveWheelIntent(w({ deltaX: 30, deltaY: 5 }))).toEqual({ kind: "pan", amount: 30 });
  });
  it("modifier 없고 deltaX=0이면 deltaY로 팬", () => {
    expect(resolveWheelIntent(w({ deltaX: 0, deltaY: 12 }))).toEqual({ kind: "pan", amount: 12 });
  });
  it("Shift+휠은 줌: deltaY 우선", () => {
    expect(resolveWheelIntent(w({ shiftKey: true, deltaY: -40, deltaX: 0 }))).toEqual({ kind: "zoom", amount: -40 });
  });
  it("Shift+휠인데 macOS처럼 deltaX에 값이 실리면 그 값을 줌에 쓴다", () => {
    expect(resolveWheelIntent(w({ shiftKey: true, deltaY: 0, deltaX: -40 }))).toEqual({ kind: "zoom", amount: -40 });
  });
  it("Ctrl/Meta+휠도 줌(트랙패드 핀치)", () => {
    expect(resolveWheelIntent(w({ ctrlKey: true, deltaY: 8 }))).toEqual({ kind: "zoom", amount: 8 });
    expect(resolveWheelIntent(w({ metaKey: true, deltaY: 8 }))).toEqual({ kind: "zoom", amount: 8 });
  });
  it("delta가 전부 0이면 none", () => {
    expect(resolveWheelIntent(w())).toEqual({ kind: "none", amount: 0 });
  });
});
