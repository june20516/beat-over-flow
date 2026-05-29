import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../store/useStore";
import { startPlaySession, endPlaySession, pressTrack } from "./playSession";
import type { Project } from "../types";

function projectWithPerformTrack(): Project {
  return {
    id: "p1", name: "t", createdAt: 0, updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 10000 },
    master: { volume: 1 },
    libraryAssetIds: [],
    tracks: [
      {
        id: "t1", name: "T", status: "play",
        sound: { kind: "builtin", sampleId: "kick" },
        keyBinding: "KeyA", markers: [{ id: "m1", timeMs: 1000 }],
        volume: 1, color: "#fff",
        recentSounds: [{ kind: "builtin", sampleId: "kick" }],
      },
    ],
  };
}

describe("pressTrack playing 게이트", () => {
  beforeEach(() => {
    useStore.setState({ project: projectWithPerformTrack(), mode: "play", playing: false });
    startPlaySession();
  });

  it("재생 중이 아니면 채점하지 않는다(null)", () => {
    useStore.setState({ playing: false });
    expect(pressTrack("t1", 1000)).toBeNull();
  });

  it("재생 중이면 채점한다(판정 반환)", () => {
    useStore.setState({ playing: true });
    const j = pressTrack("t1", 1000);
    expect(j).not.toBeNull();
  });

  it("재생 중 아닐 때 누른 키는 점수에 영향 없다", () => {
    useStore.setState({ playing: false });
    pressTrack("t1", 1000);
    useStore.setState({ playing: true });
    expect(pressTrack("t1", 1000)).not.toBeNull();
    endPlaySession();
  });
});
