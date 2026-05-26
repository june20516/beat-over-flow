import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { GlobalMode, Project } from "../types";

function sampleProject(): Project {
  return {
    id: "p1",
    name: "테스트곡",
    createdAt: 1,
    updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 5000 },
    tracks: [],
    master: { volume: 1 },
  };
}

describe("useStore", () => {
  beforeEach(() => {
    useStore.setState({ project: null, playing: false, playheadMs: 0, mode: "listening" });
  });

  it("setProject로 현재 프로젝트를 교체한다", () => {
    useStore.getState().setProject(sampleProject());
    expect(useStore.getState().project?.name).toBe("테스트곡");
  });

  it("renameProject는 이름과 updatedAt을 갱신한다", () => {
    useStore.getState().setProject(sampleProject());
    useStore.getState().renameProject("새 이름");
    expect(useStore.getState().project?.name).toBe("새 이름");
    expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(
      useStore.getState().project!.createdAt,
    );
  });

  it("setMasterVolume은 0..1로 클램프한다", () => {
    useStore.getState().setProject(sampleProject());
    useStore.getState().setMasterVolume(2);
    expect(useStore.getState().project!.master.volume).toBe(1);
  });
});

describe("useStore 트랙/마커", () => {
  beforeEach(() => {
    useStore.setState({ project: sampleProject(), playing: false, playheadMs: 0, mode: "listening" });
  });

  it("addTrack은 기본 트랙을 추가한다", () => {
    useStore.getState().addTrack();
    const tracks = useStore.getState().project!.tracks;
    expect(tracks.length).toBe(1);
    expect(tracks[0].status).toBe("listening");
    expect(tracks[0].markers).toEqual([]);
  });

  it("setTrackStatus는 해당 트랙 상태를 바꾼다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().setTrackStatus(id, "play");
    expect(useStore.getState().project!.tracks[0].status).toBe("play");
  });

  it("addMarker는 시각순으로 마커를 넣는다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().addMarker(id, 500);
    useStore.getState().addMarker(id, 100);
    const times = useStore.getState().project!.tracks[0].markers.map((m) => m.timeMs);
    expect(times).toEqual([100, 500]);
  });

  it("removeMarker는 해당 마커를 제거한다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().addMarker(id, 100);
    const mid = useStore.getState().project!.tracks[0].markers[0].id;
    useStore.getState().removeMarker(id, mid);
    expect(useStore.getState().project!.tracks[0].markers).toEqual([]);
  });

  it("removeTrack은 트랙을 제거한다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().removeTrack(id);
    expect(useStore.getState().project!.tracks).toEqual([]);
  });

  it("setMode는 전역 모드를 바꾼다", () => {
    useStore.getState().setMode("record" as GlobalMode);
    expect(useStore.getState().mode).toBe("record");
  });
});
