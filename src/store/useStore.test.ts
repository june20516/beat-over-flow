import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";

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
    useStore.setState({ project: null, playing: false, playheadMs: 0 });
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
