import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../types";

/** jsdom엔 Web Audio가 없으므로 AudioEngine 생성에 필요한 최소 노드만 stub한다. */
class FakeGainNode {
  gain = { value: 1 };
  connect<T>(node: T): T {
    return node;
  }
  disconnect(): void {}
}
class FakeAudioContext {
  state = "suspended";
  currentTime = 0;
  destination = {};
  createGain(): FakeGainNode {
    return new FakeGainNode();
  }
  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }
}
vi.stubGlobal("AudioContext", FakeAudioContext);

function makeProject(masterVolume: number): Project {
  return {
    id: "p1",
    name: "t",
    createdAt: 0,
    updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
    tracks: [],
    master: { volume: masterVolume },
    libraryAssetIds: [],
  };
}

describe("applyAudioState — store→그래프 단일 동기화 지점", () => {
  it("project.master.volume를 masterGain에 반영한다", async () => {
    const { AudioEngine } = await import("./AudioEngine");
    const { applyAudioState } = await import("./runtime");
    const eng = new AudioEngine();

    applyAudioState(eng, makeProject(0.4));
    expect(eng.masterGain.gain.value).toBe(0.4);
  });

  it("project가 없으면 기본 볼륨 1로 둔다", async () => {
    const { AudioEngine } = await import("./AudioEngine");
    const { applyAudioState } = await import("./runtime");
    const eng = new AudioEngine();
    eng.masterGain.gain.value = 0.2;

    applyAudioState(eng, null);
    expect(eng.masterGain.gain.value).toBe(1);
  });
});

describe("배선 회귀 방지 — store 볼륨 변경이 실제 엔진에 도달한다", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("setMasterVolume 호출 시 masterGain.gain.value가 따라간다", async () => {
    const { getEngine } = await import("./runtime");
    const { useStore } = await import("../store/useStore");

    useStore.getState().setProject(makeProject(1));
    const eng = getEngine();

    useStore.getState().setMasterVolume(0.25);
    expect(eng.masterGain.gain.value).toBe(0.25);
  });

  it("엔진 생성 시점에 현재 store 볼륨으로 즉시 동기화된다", async () => {
    const { getEngine } = await import("./runtime");
    const { useStore } = await import("../store/useStore");

    useStore.getState().setProject(makeProject(0.6));
    const eng = getEngine();

    expect(eng.masterGain.gain.value).toBe(0.6);
  });
});
