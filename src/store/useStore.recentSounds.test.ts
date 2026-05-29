import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";
import { seedRecentSounds } from "../domain/recentSounds";

function mkProject(): Project {
  const sound = { kind: "builtin" as const, sampleId: "kick" };
  return {
    id: "p",
    name: "P",
    createdAt: 0,
    updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
    master: { volume: 1 },
    tracks: [
      {
        id: "t1",
        name: "T1",
        status: "listening",
        sound,
        keyBinding: null,
        markers: [],
        volume: 1,
        color: "#fff",
        recentSounds: seedRecentSounds(sound),
      },
    ],
    libraryAssetIds: [],
  };
}

describe("selectTrackSound", () => {
  beforeEach(() => {
    useStore.setState({ project: mkProject() });
  });

  it("track.sound와 recentSounds[0]을 동시에 갱신한다", () => {
    useStore.getState().selectTrackSound("t1", { kind: "builtin", sampleId: "snare" });
    const t = useStore.getState().project!.tracks[0];
    expect(t.sound).toEqual({ kind: "builtin", sampleId: "snare" });
    expect(t.recentSounds[0]).toEqual({ kind: "builtin", sampleId: "snare" });
  });

  it("기존에 있던 sound를 다시 고르면 중복 없이 [0]으로 이동", () => {
    useStore.getState().selectTrackSound("t1", { kind: "builtin", sampleId: "snare" });
    useStore.getState().selectTrackSound("t1", { kind: "builtin", sampleId: "kick" });
    const t = useStore.getState().project!.tracks[0];
    expect(t.recentSounds[0]).toEqual({ kind: "builtin", sampleId: "kick" });
    const kicks = t.recentSounds.filter((s) => s.kind === "builtin" && s.sampleId === "kick");
    expect(kicks.length).toBe(1);
  });
});

describe("addTrack은 recentSounds를 빌트인 시드로 만든다", () => {
  it("새 트랙의 recentSounds.length === 6, [0] === sound", () => {
    useStore.setState({ project: mkProject() });
    useStore.getState().addTrack();
    const tracks = useStore.getState().project!.tracks;
    const last = tracks[tracks.length - 1];
    expect(last.recentSounds.length).toBe(6);
    expect(JSON.stringify(last.recentSounds[0])).toBe(JSON.stringify(last.sound));
  });
});
