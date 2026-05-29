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
