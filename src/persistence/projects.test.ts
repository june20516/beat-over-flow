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
    libraryAssetIds: [],
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
          keyBinding: "KeyS", markers: [{ id: "m1", timeMs: 100 }], volume: 1, color: "#22d3ee",
          recentSounds: [{ kind: "builtin", sampleId: "kick" }] },
        { id: "t2", name: "업로드", status: "listening", sound: { kind: "upload", assetId: uploadId },
          keyBinding: null, markers: [], volume: 1, color: "#f472b6",
          recentSounds: [{ kind: "upload", assetId: uploadId }] },
      ],
      master: { volume: 1 },
      transport: { playPauseKey: null },
      libraryAssetIds: [],
    };
    await saveProject(original);

    const copy = await duplicateProject(original);

    // 새 id + 이름 접미사
    expect(copy.id).not.toBe("orig");
    expect(copy.name).toBe("원본곡 (사본)");
    expect(copy.tracks[0].id).not.toBe("t1");
    expect(copy.tracks[0].markers[0].id).not.toBe("m1");

    // baseFlow 자산이 새 id이며 내용은 동일
    expect(copy.baseFlow.kind).toBe("audioFile");
    if (copy.baseFlow.kind === "audioFile") {
      expect(copy.baseFlow.assetId).not.toBe(assetId);
      expect(await (await getAsset(copy.baseFlow.assetId))!.blob.text()).toBe("base");
    }

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

  it("duplicateProject는 libraryAssetIds를 깊은 복사하고 idMap으로 중복 copyAsset을 방지한다", async () => {
    const origAsset = await putAsset(new Blob(["x"]), "shared");
    const baseFlow = await putAsset(new Blob(["bf"]), "bf");
    const original: Project = {
      id: "p",
      name: "orig",
      createdAt: 0,
      updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: baseFlow, durationMs: 1000 },
      master: { volume: 1 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "listening",
          sound: { kind: "upload", assetId: origAsset },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
          recentSounds: [{ kind: "upload", assetId: origAsset }, { kind: "builtin", sampleId: "kick" }],
        },
        {
          id: "t2",
          name: "T2",
          status: "listening",
          sound: { kind: "builtin", sampleId: "snare" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
          recentSounds: [{ kind: "builtin", sampleId: "snare" }, { kind: "upload", assetId: origAsset }],
        },
      ],
      libraryAssetIds: [origAsset],
    };
    await saveProject(original);

    const copy = await duplicateProject(original);

    expect(copy.libraryAssetIds).toHaveLength(1);
    expect(copy.libraryAssetIds[0]).not.toBe(origAsset);

    const t1Sound = copy.tracks[0].sound;
    const t2RecentUpload = copy.tracks[1].recentSounds.find((s) => s.kind === "upload");
    expect(t1Sound.kind).toBe("upload");
    if (t1Sound.kind === "upload") {
      expect(t1Sound.assetId).toBe(copy.libraryAssetIds[0]);
    }
    expect(t2RecentUpload?.kind).toBe("upload");
    if (t2RecentUpload?.kind === "upload") {
      expect(t2RecentUpload.assetId).toBe(copy.libraryAssetIds[0]);
    }

    expect(JSON.stringify(copy.tracks[0].recentSounds[0])).toBe(JSON.stringify(copy.tracks[0].sound));
  });
});
