import { describe, it, expect } from "vitest";
import { resolveTrackBehavior } from "./mode";
import type { GlobalMode } from "../types";

describe("resolveTrackBehavior", () => {
  it("mute는 모든 모드에서 silent", () => {
    for (const m of ["listening", "play", "record"] as GlobalMode[]) {
      expect(resolveTrackBehavior(m, "mute")).toBe("silent");
    }
  });

  it("리스닝 모드에서는 mute 외 모두 auto", () => {
    expect(resolveTrackBehavior("listening", "listening")).toBe("auto");
    expect(resolveTrackBehavior("listening", "play")).toBe("auto");
    expect(resolveTrackBehavior("listening", "write")).toBe("auto");
  });

  it("플레이 모드: play 상태만 perform, 나머지는 auto", () => {
    expect(resolveTrackBehavior("play", "play")).toBe("perform");
    expect(resolveTrackBehavior("play", "listening")).toBe("auto");
    expect(resolveTrackBehavior("play", "write")).toBe("auto");
  });

  it("레코드 모드: write 상태만 record, 나머지는 auto", () => {
    expect(resolveTrackBehavior("record", "write")).toBe("record");
    expect(resolveTrackBehavior("record", "listening")).toBe("auto");
    expect(resolveTrackBehavior("record", "play")).toBe("auto");
  });
});
