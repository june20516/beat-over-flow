import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";

function baseProject(): Project {
  return {
    id: "p1", name: "t", createdAt: 0, updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
    tracks: [], master: { volume: 1 }, libraryAssetIds: [],
    baseFlowView: { layout: "mini", ambientIntensity: 0.5 },
  };
}

describe("store baseFlow 액션", () => {
  beforeEach(() => useStore.getState().setProject(baseProject()));

  it("setBaseFlow는 baseFlow를 교체(마커/트랙 불변)", () => {
    useStore.getState().setBaseFlow({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 5000 });
    const bf = useStore.getState().project!.baseFlow;
    expect(bf.kind).toBe("youtube");
    expect(bf.durationMs).toBe(5000);
  });

  it("setBaseFlowDurationMs는 현재 baseFlow 길이만 갱신", () => {
    useStore.getState().setBaseFlowDurationMs(7777);
    expect(useStore.getState().project!.baseFlow.durationMs).toBe(7777);
  });

  it("setBaseFlowView는 부분 병합", () => {
    useStore.getState().setBaseFlowView({ layout: "ambient" });
    expect(useStore.getState().project!.baseFlowView).toEqual({ layout: "ambient", ambientIntensity: 0.5 });
  });

  it("setBaseFlowOffsetMs는 youtube일 때만 반영", () => {
    useStore.getState().setBaseFlow({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 5000 });
    useStore.getState().setBaseFlowOffsetMs(120);
    const bf = useStore.getState().project!.baseFlow;
    expect(bf.kind === "youtube" && bf.offsetMs).toBe(120);
  });

  it("baseFlowLoading 토글", () => {
    useStore.getState().setBaseFlowLoading(true);
    expect(useStore.getState().baseFlowLoading).toBe(true);
  });
});
