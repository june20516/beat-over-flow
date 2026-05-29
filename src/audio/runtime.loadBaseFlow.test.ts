import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeGainNode { gain = { value: 1 }; connect<T>(n: T) { return n; } disconnect() {} }
class FakeAudioContext {
  state = "suspended"; currentTime = 0; destination = {};
  createGain() { return new FakeGainNode(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({ duration: 2, getChannelData: () => new Float32Array(10) }); }
}
vi.stubGlobal("AudioContext", FakeAudioContext);

describe("loadBaseFlow 분기", () => {
  beforeEach(() => vi.resetModules());

  it("youtube ref는 컨테이너가 없으면 던진다(가드)", async () => {
    const { loadBaseFlow } = await import("./runtime");
    await expect(
      loadBaseFlow({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 0 }),
    ).rejects.toThrow();
  });
});
