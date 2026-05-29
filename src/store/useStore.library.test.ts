import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";
import { seedRecentSounds } from "../domain/recentSounds";

function mkProject(libraryAssetIds: string[] = []): Project {
  const sound = { kind: "builtin" as const, sampleId: "kick" };
  return {
    id: "p", name: "P", createdAt: 0, updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
    master: { volume: 1 },
    tracks: [{
      id: "t1", name: "T1", status: "listening", sound,
      keyBinding: null, markers: [], volume: 1, color: "#fff",
      recentSounds: seedRecentSounds(sound),
    }],
    libraryAssetIds,
  };
}

describe("addAssetToLibrary", () => {
  beforeEach(() => useStore.setState({ project: mkProject() }));

  it("libraryAssetIds에 추가한다", () => {
    useStore.getState().addAssetToLibrary("a1");
    expect(useStore.getState().project!.libraryAssetIds).toEqual(["a1"]);
  });

  it("중복은 추가하지 않는다", () => {
    useStore.getState().addAssetToLibrary("a1");
    useStore.getState().addAssetToLibrary("a1");
    expect(useStore.getState().project!.libraryAssetIds).toEqual(["a1"]);
  });
});

describe("canDeleteAsset", () => {
  it("어느 트랙에서도 현재 sound로 안 쓰면 ok", () => {
    useStore.setState({ project: mkProject(["a1"]) });
    const r = useStore.getState().canDeleteAsset("a1");
    expect(r.ok).toBe(true);
  });

  it("쓰는 트랙이 있으면 usedBy 반환", () => {
    const proj = mkProject(["a1"]);
    proj.tracks[0].sound = { kind: "upload", assetId: "a1" };
    proj.tracks[0].recentSounds = [{ kind: "upload", assetId: "a1" }, ...proj.tracks[0].recentSounds.slice(1)];
    useStore.setState({ project: proj });
    const r = useStore.getState().canDeleteAsset("a1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.usedBy.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("removeAssetFromLibrary", () => {
  it("libraryAssetIds에서 제거 + 모든 트랙 recentSounds에서 제거 후 빌트인 fallback", () => {
    const proj = mkProject(["a1", "a2"]);
    proj.tracks[0].recentSounds = [
      { kind: "builtin", sampleId: "kick" },
      { kind: "upload", assetId: "a1" },
    ];
    useStore.setState({ project: proj });
    useStore.getState().removeAssetFromLibrary("a1");
    const p = useStore.getState().project!;
    expect(p.libraryAssetIds).toEqual(["a2"]);
    const recents = p.tracks[0].recentSounds;
    expect(recents.length).toBe(6);
    expect(recents.some((s) => s.kind === "upload" && s.assetId === "a1")).toBe(false);
  });

  it("사용 중이면 no-op (가드 책임은 호출자, 단 store는 안전망으로 ignore)", () => {
    const proj = mkProject(["a1"]);
    proj.tracks[0].sound = { kind: "upload", assetId: "a1" };
    useStore.setState({ project: proj });
    useStore.getState().removeAssetFromLibrary("a1");
    expect(useStore.getState().project!.libraryAssetIds).toEqual(["a1"]);
  });
});
