import { describe, it, expect } from "vitest";
import { EXAMPLE_BLUEPRINT, buildProjectFromBlueprint } from "./exampleProject";

describe("EXAMPLE_BLUEPRINT", () => {
  it("6개 트랙을 가지고 각 트랙에 마커가 있다", () => {
    expect(EXAMPLE_BLUEPRINT.tracks).toHaveLength(6);
    for (const t of EXAMPLE_BLUEPRINT.tracks) {
      expect(t.sound.kind).toBe("builtin");
      expect(t.markersMs.length).toBeGreaterThan(0);
    }
  });
});

describe("buildProjectFromBlueprint", () => {
  it("새 id·baseFlow·트랙/마커 구조를 만든다", () => {
    const p = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "asset-1", 136032);
    expect(p.id).toBeTruthy();
    expect(p.baseFlow).toEqual({ kind: "audioFile", assetId: "asset-1", durationMs: 136032 });
    expect(p.tracks).toHaveLength(6);
    const first = p.tracks[0];
    expect(first.id).toBeTruthy();
    expect(first.markers.length).toBe(EXAMPLE_BLUEPRINT.tracks[0].markersMs.length);
    expect(first.markers.every((m) => typeof m.id === "string")).toBe(true);
    expect(first.markers.every((m) => m.timeMs <= 136032)).toBe(true);
    expect(p.transport).toEqual({ playPauseKey: null });
  });

  it("두 번 호출하면 서로 다른 id를 만든다", () => {
    const a = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "x", 1000);
    const b = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "x", 1000);
    expect(a.id).not.toBe(b.id);
    expect(a.tracks[0].id).not.toBe(b.tracks[0].id);
  });
});
