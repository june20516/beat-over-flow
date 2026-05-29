import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { saveProject, loadProject } from "./projects";
import { getDb, resetDbCache } from "./db";
import type { Project } from "../types";

describe("project load normalize", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("recentSounds 누락 트랙은 시드로 채워진다", async () => {
    const db = await getDb();
    const stored = {
      id: "p1",
      name: "old",
      createdAt: 0,
      updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
      master: { volume: 1 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "listening",
          sound: { kind: "builtin", sampleId: "snare" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
          // recentSounds 누락
        },
      ],
      // libraryAssetIds 누락
    } as unknown as Project;
    await db.put("projects", stored);

    const loaded = await loadProject("p1");
    expect(loaded).not.toBeNull();
    expect(loaded!.tracks[0].recentSounds[0]).toEqual({ kind: "builtin", sampleId: "snare" });
    expect(loaded!.tracks[0].recentSounds.length).toBe(6);
    expect(loaded!.libraryAssetIds).toEqual([]);
  });

  it("트랙 sound가 upload인데 libraryAssetIds에 없으면 자동 등록", async () => {
    const db = await getDb();
    const stored = {
      id: "p2",
      name: "old",
      createdAt: 0,
      updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
      master: { volume: 1 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "listening",
          sound: { kind: "upload", assetId: "asset-orphan" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
        },
      ],
    } as unknown as Project;
    await db.put("projects", stored);

    const loaded = await loadProject("p2");
    expect(loaded!.libraryAssetIds).toContain("asset-orphan");
  });

  it("레거시 status \"write\" 트랙은 \"record\"로 정규화된다", async () => {
    const db = await getDb();
    const stored = {
      id: "p-legacy-write",
      name: "legacy",
      createdAt: 0,
      updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
      master: { volume: 1 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "write",
          sound: { kind: "builtin", sampleId: "kick" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
        },
      ],
    } as unknown as Project;
    await db.put("projects", stored);
    const loaded = await loadProject("p-legacy-write");
    expect(loaded!.tracks[0].status).toBe("record");
  });

  it("이미 정상 형태인 프로젝트는 그대로 통과 (저장 → 로드 라운드트립)", async () => {
    const p: Project = {
      id: "p3",
      name: "ok",
      createdAt: 1,
      updatedAt: 1,
      baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
      master: { volume: 0.5 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "listening",
          sound: { kind: "builtin", sampleId: "kick" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
          recentSounds: [{ kind: "builtin", sampleId: "kick" }],
        },
      ],
      libraryAssetIds: ["a", "b"],
    };
    await saveProject(p);
    const loaded = await loadProject("p3");
    expect(loaded!.libraryAssetIds).toEqual(["a", "b"]);
    expect(loaded!.tracks[0].recentSounds.length).toBe(6);
  });

  it("baseFlowView 누락 시 기본값(mini/0.5)으로 채운다", async () => {
    const db = await getDb();
    const legacy = {
      id: "p-bfv", name: "t", createdAt: 0, updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
      tracks: [], master: { volume: 1 }, libraryAssetIds: [],
    } as unknown as Project;
    await db.put("projects", legacy);
    const loaded = await loadProject("p-bfv");
    expect(loaded?.baseFlowView).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });
});
