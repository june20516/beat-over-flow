import { describe, it, expect, beforeEach } from "vitest";
import { saveProject, loadProject, listProjects, deleteProject } from "./projects";
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
});
