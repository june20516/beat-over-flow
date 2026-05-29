import { describe, it, expect } from "vitest";
import { nextStatus, metaOf, TRACK_STATUS_META } from "./trackStatus";

describe("nextStatus", () => {
  it("정의 순으로 순환한다 (M → L → P → R → M)", () => {
    expect(nextStatus("mute")).toBe("listening");
    expect(nextStatus("listening")).toBe("play");
    expect(nextStatus("play")).toBe("record");
    expect(nextStatus("record")).toBe("mute");
  });
});

describe("metaOf", () => {
  it("각 상태의 메타를 반환한다", () => {
    expect(metaOf("mute").label).toBe("뮤트");
    expect(metaOf("record").letter).toBe("R");
  });
});

describe("TRACK_STATUS_META", () => {
  it("네 상태가 모두 등록되어 있다", () => {
    expect(TRACK_STATUS_META.map((m) => m.status).sort()).toEqual(
      ["listening", "mute", "play", "record"],
    );
  });
});
