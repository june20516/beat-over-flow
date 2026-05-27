import { describe, expect, it } from "vitest";
import { decideKeyAction, type KeyContext } from "./keyAction";
import type { GlobalMode, Track } from "../types";

function track(over: Partial<Track> = {}): Track {
  return {
    id: "t1",
    name: "t",
    status: "write",
    sound: { kind: "builtin", sampleId: "kick" },
    keyBinding: "KeyA",
    markers: [],
    volume: 1,
    color: "#fff",
    ...over,
  };
}

function ctx(over: Partial<KeyContext> = {}): KeyContext {
  return {
    code: "KeyA",
    repeat: false,
    targetTag: "DIV",
    mode: "record" as GlobalMode,
    playPauseKey: null,
    tracks: [track()],
    ...over,
  };
}

describe("decideKeyAction", () => {
  it("repeat면 ignore (preventDefault 없음)", () => {
    const a = decideKeyAction(ctx({ repeat: true, mode: "record" }));
    expect(a).toEqual({ kind: "ignore", preventDefault: false });
  });

  it("타깃이 INPUT이면 ignore", () => {
    expect(decideKeyAction(ctx({ targetTag: "INPUT" }))).toEqual({ kind: "ignore", preventDefault: false });
  });
  it("타깃이 SELECT면 ignore", () => {
    expect(decideKeyAction(ctx({ targetTag: "SELECT" }))).toEqual({ kind: "ignore", preventDefault: false });
  });
  it("타깃이 TEXTAREA면 ignore", () => {
    expect(decideKeyAction(ctx({ targetTag: "TEXTAREA" }))).toEqual({ kind: "ignore", preventDefault: false });
  });

  it("record 모드: 매칭 트랙 없는 키도 preventDefault=true (요구 6)", () => {
    const a = decideKeyAction(ctx({ mode: "record", code: "KeyZ", tracks: [track({ keyBinding: "KeyA" })] }));
    expect(a.preventDefault).toBe(true);
    expect(a.kind).toBe("noop");
  });

  it("play 모드: 매칭 없는 키도 preventDefault=true (요구 6)", () => {
    const a = decideKeyAction(ctx({ mode: "play", code: "KeyZ", tracks: [] }));
    expect(a.preventDefault).toBe(true);
    expect(a.kind).toBe("noop");
  });

  it("listening 모드: 매칭 없는 키는 preventDefault=false", () => {
    const a = decideKeyAction(ctx({ mode: "listening", code: "KeyZ", tracks: [] }));
    expect(a).toEqual({ kind: "noop", preventDefault: false });
  });

  it("재생키 매칭이 트랙키보다 우선, 모든 모드에서 toggle (요구 12)", () => {
    const a = decideKeyAction(
      ctx({ mode: "listening", code: "Space", playPauseKey: "Space", tracks: [track({ keyBinding: "Space" })] }),
    );
    expect(a.kind).toBe("toggle-play");
  });

  it("재생키는 play/record 모드에서도 preventDefault=true와 함께 toggle", () => {
    const a = decideKeyAction(ctx({ mode: "record", code: "Space", playPauseKey: "Space", tracks: [] }));
    expect(a).toMatchObject({ kind: "toggle-play", preventDefault: true });
  });

  it("재생키가 null이면 토글하지 않는다", () => {
    const a = decideKeyAction(ctx({ mode: "listening", code: "Space", playPauseKey: null, tracks: [] }));
    expect(a.kind).toBe("noop");
  });

  it("트랙 키 매칭 시 trigger-tracks에 매칭 트랙 id가 담긴다", () => {
    const t = track({ id: "tx", keyBinding: "KeyA" });
    const a = decideKeyAction(ctx({ mode: "record", code: "KeyA", playPauseKey: null, tracks: [t] }));
    expect(a.kind).toBe("trigger-tracks");
    if (a.kind === "trigger-tracks") expect(a.trackIds).toEqual(["tx"]);
  });

  it("같은 키를 가진 트랙 여러 개를 모두 담는다", () => {
    const a = decideKeyAction(
      ctx({
        mode: "record",
        code: "KeyA",
        playPauseKey: null,
        tracks: [track({ id: "t1", keyBinding: "KeyA" }), track({ id: "t2", keyBinding: "KeyA" })],
      }),
    );
    if (a.kind === "trigger-tracks") expect(a.trackIds).toEqual(["t1", "t2"]);
  });
});
