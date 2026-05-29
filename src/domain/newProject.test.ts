import { describe, expect, it } from "vitest";
import { buildAudioFileProject, buildYouTubeProject } from "./newProject";

describe("buildAudioFileProject", () => {
  it("audioFile baseFlow와 빈 트랙·기본값을 만든다", () => {
    const p = buildAudioFileProject("내 곡", "asset-1", 5000);
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("내 곡");
    expect(p.baseFlow).toEqual({ kind: "audioFile", assetId: "asset-1", durationMs: 5000 });
    expect(p.tracks).toEqual([]);
    expect(p.master).toEqual({ volume: 1 });
    expect(p.transport).toEqual({ playPauseKey: null });
    expect(p.libraryAssetIds).toEqual([]);
    expect(p.baseFlowView).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });

  it("두 번 호출하면 서로 다른 id", () => {
    const a = buildAudioFileProject("x", "a", 1);
    const b = buildAudioFileProject("x", "a", 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe("buildYouTubeProject", () => {
  it("youtube baseFlow(durationMs 0)와 기본값을 만든다", () => {
    const p = buildYouTubeProject("dQw4w9WgXcQ", "리믹스");
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("리믹스");
    expect(p.baseFlow).toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 0 });
    expect(p.tracks).toEqual([]);
    expect(p.master).toEqual({ volume: 1 });
    expect(p.transport).toEqual({ playPauseKey: null });
    expect(p.libraryAssetIds).toEqual([]);
    expect(p.baseFlowView).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });

  it("이름이 공백이면 '유튜브 프로젝트'로 대체", () => {
    expect(buildYouTubeProject("dQw4w9WgXcQ", "   ").name).toBe("유튜브 프로젝트");
    expect(buildYouTubeProject("dQw4w9WgXcQ", "").name).toBe("유튜브 프로젝트");
  });

  it("이름 앞뒤 공백은 trim", () => {
    expect(buildYouTubeProject("dQw4w9WgXcQ", "  곡  ").name).toBe("곡");
  });
});
