import { describe, it, expect } from "vitest";
import { BUILTIN_SAMPLES, sampleUrl } from "./builtinSamples";

describe("builtinSamples", () => {
  it("모든 항목은 id와 label을 갖는다", () => {
    for (const s of BUILTIN_SAMPLES) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it("sampleUrl은 id로 경로를 만든다", () => {
    expect(sampleUrl("kick")).toBe("/samples/kick.ogg");
  });
});
