import { describe, it, expect, beforeEach } from "vitest";
import { saveProject, loadProject, listProjects, deleteProject, duplicateProject } from "./projects";
import { putAsset, getAsset } from "./assets";
import { resetDbCache } from "./db";
import type { Project } from "../types";

function sampleProject(id: string): Project {
  return {
    id,
    name: "곡 " + id,
    createdAt: 1,
    updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
    tracks: [],
    master: { volume: 1 },
  };
}

describe("ProjectRepository", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("저장한 프로젝트를 id로 되읽는다", async () => {
    await saveProject(sampleProject("p1"));
    const got = await loadProject("p1");
    expect(got?.name).toBe("곡 p1");
  });

  it("목록은 저장된 모든 프로젝트를 반환한다", async () => {
    await saveProject(sampleProject("p1"));
    await saveProject(sampleProject("p2"));
    const list = await listProjects();
    expect(list.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("삭제하면 더 이상 읽히지 않는다", async () => {
    await saveProject(sampleProject("p1"));
    await deleteProject("p1");
    expect(await loadProject("p1")).toBeNull();
  });

  it("duplicateProject는 새 id·분리된 자산·이름 접미사를 만든다", async () => {
    const assetId = await putAsset(new Blob(["base"], { type: "audio/mp3" }), "demo.mp3");
    const uploadId = await putAsset(new Blob(["snd"], { type: "audio/wav" }), "snd.wav");
    const original: import("../types").Project = {
      id: "orig",
      name: "원본곡",
      createdAt: 1,
      updatedAt: 1,
      baseFlow: { kind: "audioFile", assetId, durationMs: 1000 },
      tracks: [
        { id: "t1", name: "킥", status: "listening", sound: { kind: "builtin", sampleId: "kick" },
          keyBinding: "KeyS", markers: [{ id: "m1", timeMs: 100 }], volume: 1, color: "#22d3ee" },
        { id: "t2", name: "업로드", status: "listening", sound: { kind: "upload", assetId: uploadId },
          keyBinding: null, markers: [], volume: 1, color: "#f472b6" },
      ],
      master: { volume: 1 },
      transport: { playPauseKey: null },
    };
    await saveProject(original);

    const copy = await duplicateProject(original);

    // 새 id + 이름 접미사
    expect(copy.id).not.toBe("orig");
    expect(copy.name).toBe("원본곡 (사본)");
    expect(copy.tracks[0].id).not.toBe("t1");
    expect(copy.tracks[0].markers[0].id).not.toBe("m1");

    // baseFlow 자산이 새 id이며 내용은 동일
    expect(copy.baseFlow.assetId).not.toBe(assetId);
    expect(await (await getAsset(copy.baseFlow.assetId))!.blob.text()).toBe("base");

    // upload 사운드 자산도 분리되고 내용 동일
    const copyUpload = copy.tracks[1].sound;
    expect(copyUpload.kind).toBe("upload");
    if (copyUpload.kind === "upload") {
      expect(copyUpload.assetId).not.toBe(uploadId);
      expect(await (await getAsset(copyUpload.assetId))!.blob.text()).toBe("snd");
    }

    // 사본이 저장되어 다시 읽힌다
    const reloaded = await loadProject(copy.id);
    expect(reloaded?.name).toBe("원본곡 (사본)");
  });
});
