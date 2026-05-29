import { describe, it, expect } from "vitest";
import { normalizeAssetName, resolveNameCollision, NAME_MAX_LENGTH } from "./assetName";

describe("normalizeAssetName", () => {
  it("확장자를 제거하고 trim한다", () => {
    expect(normalizeAssetName("  kick.wav ")).toBe("kick");
    expect(normalizeAssetName("Bass-Drop-Lo.mp3")).toBe("Bass-Drop-Lo");
  });

  it("확장자 없는 파일은 그대로", () => {
    expect(normalizeAssetName("kick")).toBe("kick");
  });

  it(`${NAME_MAX_LENGTH}자를 초과하면 자른다`, () => {
    const long = "a".repeat(50);
    expect(normalizeAssetName(long).length).toBe(NAME_MAX_LENGTH);
  });

  it("점이 여러 개여도 마지막 점 이후만 확장자로 본다", () => {
    expect(normalizeAssetName("my.cool.sample.mp3")).toBe("my.cool.sample");
  });

  it("선행 점만 있는 이름은 확장자로 보지 않는다", () => {
    // 의도: ".hidden"은 Unix 숨김 파일 관례상 이름이고,
    // ".wav"는 사용자 입력으로 잘 안 나오는 경계이므로 안전 측으로 그대로 둔다.
    expect(normalizeAssetName(".hidden")).toBe(".hidden");
    expect(normalizeAssetName(".wav")).toBe(".wav");
  });
});

describe("resolveNameCollision", () => {
  it("기존에 없으면 그대로", () => {
    expect(resolveNameCollision("kick", [])).toBe("kick");
    expect(resolveNameCollision("kick", ["snare", "hat"])).toBe("kick");
  });

  it("충돌 시 (2) 접미", () => {
    expect(resolveNameCollision("kick", ["kick"])).toBe("kick (2)");
  });

  it("(2)도 차 있으면 (3)", () => {
    expect(resolveNameCollision("kick", ["kick", "kick (2)"])).toBe("kick (3)");
  });

  it("접미 추가 후에도 32자 제한 유지", () => {
    const base = "a".repeat(NAME_MAX_LENGTH);
    const result = resolveNameCollision(base, [base]);
    expect(result.length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    expect(result.endsWith(" (2)")).toBe(true);
  });

  it("1000회 이상 충돌은 호출 측 버그 — throw", () => {
    const existing = ["kick"];
    for (let n = 2; n < 1000; n++) {
      const suffix = ` (${n})`;
      existing.push("kick".slice(0, Math.max(0, NAME_MAX_LENGTH - suffix.length)) + suffix);
    }
    expect(() => resolveNameCollision("kick", existing)).toThrow(/1000회/);
  });
});
