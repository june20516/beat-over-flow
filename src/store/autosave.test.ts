import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStore } from "./useStore";
import { startAutosave } from "./autosave";
import { loadProject } from "../persistence/projects";
import { resetDbCache } from "../persistence/db";
import type { Project } from "../types";

function sampleProject(): Project {
  return {
    id: "p1", name: "곡", createdAt: 1, updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 5000 },
    tracks: [], master: { volume: 1 },
  };
}

describe("startAutosave", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
    useStore.setState({ project: null, playing: false, playheadMs: 0 });
  });

  it("project 변경 시 디바운스 후 저장한다", async () => {
    vi.useFakeTimers();
    const stop = startAutosave(0); // 디바운스 0ms
    useStore.getState().setProject(sampleProject());
    useStore.getState().renameProject("바뀐곡");
    // runAllTimersAsync: 디바운스 타이머 + fake-indexeddb 내부 작업까지 모두 플러시
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    const saved = await loadProject("p1");
    expect(saved?.name).toBe("바뀐곡");
    stop();
  });
});
