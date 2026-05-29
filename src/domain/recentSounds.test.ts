import { describe, it, expect } from "vitest";
import type { SoundRef } from "../types";
import {
  pushRecent,
  fillWithBuiltins,
  removeAssetFromRecents,
  seedRecentSounds,
  RECENT_SLOTS,
} from "./recentSounds";

const b = (id: string): SoundRef => ({ kind: "builtin", sampleId: id });
const u = (id: string): SoundRef => ({ kind: "upload", assetId: id });

describe("pushRecent", () => {
  it("새 sound는 [0]에 오고 나머지는 뒤로 밀린다", () => {
    const prev = [b("kick"), b("snare"), b("hat")];
    expect(pushRecent(prev, b("clap"))).toEqual([b("clap"), b("kick"), b("snare"), b("hat")]);
  });

  it("중복은 제거되고 맨 앞으로 이동", () => {
    const prev = [b("kick"), b("snare"), b("hat")];
    expect(pushRecent(prev, b("hat"))).toEqual([b("hat"), b("kick"), b("snare")]);
  });

  it(`최대 ${RECENT_SLOTS}개로 잘린다`, () => {
    const prev = [b("a"), b("b"), b("c"), b("d"), b("e"), b("f")];
    const got = pushRecent(prev, b("g"));
    expect(got.length).toBe(RECENT_SLOTS);
    expect(got[0]).toEqual(b("g"));
    expect(got).not.toContainEqual(b("f"));
  });

  it("upload sound도 동일 동작", () => {
    expect(pushRecent([b("kick")], u("a1"))).toEqual([u("a1"), b("kick")]);
  });
});

describe("removeAssetFromRecents", () => {
  it("주어진 assetId의 upload sound만 제거", () => {
    const prev = [u("a"), b("kick"), u("a"), b("snare")];
    expect(removeAssetFromRecents(prev, "a")).toEqual([b("kick"), b("snare")]);
  });

  it("빌트인은 영향 없음", () => {
    const prev = [b("kick"), b("snare")];
    expect(removeAssetFromRecents(prev, "kick")).toEqual([b("kick"), b("snare")]);
  });
});

describe("fillWithBuiltins", () => {
  it("부족한 슬롯을 빌트인 정의 순서로 채워 RECENT_SLOTS 개를 보장", () => {
    const got = fillWithBuiltins([b("kick"), b("snare")]);
    expect(got.length).toBe(RECENT_SLOTS);
    expect(got[0]).toEqual(b("kick"));
    expect(got[1]).toEqual(b("snare"));
  });

  it("이미 RECENT_SLOTS 개면 그대로", () => {
    const arr: SoundRef[] = [b("a"), b("b"), b("c"), b("d"), b("e"), b("f")];
    expect(fillWithBuiltins(arr)).toEqual(arr);
  });
});

describe("seedRecentSounds", () => {
  it("현재 sound가 [0], 나머지는 빌트인 중복 제거 후 정의 순", () => {
    const seed = seedRecentSounds(b("snare"));
    expect(seed[0]).toEqual(b("snare"));
    expect(seed.length).toBe(RECENT_SLOTS);
    expect(seed.filter((s) => JSON.stringify(s) === JSON.stringify(b("snare"))).length).toBe(1);
  });

  it("현재 sound가 upload여도 OK", () => {
    const seed = seedRecentSounds(u("up1"));
    expect(seed[0]).toEqual(u("up1"));
    expect(seed.length).toBe(RECENT_SLOTS);
  });
});
