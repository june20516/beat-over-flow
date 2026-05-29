import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStore } from "./useStore";
import { startAutosave } from "./autosave";
import { listProjects, loadProject } from "../persistence/projects";
import { resetDbCache } from "../persistence/db";
import type { Project, Track } from "../types";

function track(id: string, name: string): Track {
  return {
    id,
    name,
    status: "listening",
    sound: { kind: "builtin", sampleId: "kick" },
    keyBinding: null,
    markers: [],
    volume: 1,
    color: "#fff",
    recentSounds: [{ kind: "builtin", sampleId: "kick" }],
  };
}

function projectWith3Tracks(): Project {
  return {
    id: "p1",
    name: "곡",
    createdAt: 1,
    updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 5000 },
    tracks: [track("t0", "A"), track("t1", "B"), track("t2", "C")],
    master: { volume: 1 },
    libraryAssetIds: [],
  };
}

describe("reorderTracks 영속(통합)", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
    useStore.setState({ project: null, playing: false, playheadMs: 0 });
  });

  it("순서변경 후 autosave가 새 순서를 IndexedDB에 저장한다", async () => {
    vi.useFakeTimers();
    const stop = startAutosave(0);
    useStore.getState().setProject(projectWith3Tracks());
    useStore.getState().reorderTracks(0, 2);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const saved = await loadProject("p1");
    expect(saved?.tracks.map((t) => t.name)).toEqual(["B", "C", "A"]);

    const all = await listProjects();
    expect(all).toHaveLength(1);
    expect(all[0].tracks.map((t) => t.id)).toEqual(["t1", "t2", "t0"]);
    stop();
  });

  it("from===to(전이 없음)는 저장을 유발하지 않는다", async () => {
    vi.useFakeTimers();
    const stop = startAutosave(0);
    useStore.getState().setProject(projectWith3Tracks());
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const before = await loadProject("p1");

    vi.useFakeTimers();
    useStore.getState().reorderTracks(1, 1);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const after = await loadProject("p1");
    expect(after?.tracks.map((t) => t.name)).toEqual(
      before?.tracks.map((t) => t.name),
    );
    expect(after?.tracks.map((t) => t.name)).toEqual(["A", "B", "C"]);
    stop();
  });
});
