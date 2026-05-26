import { describe, it, expect, beforeEach } from "vitest";
import { putAsset, getAsset } from "./assets";
import { resetDbCache } from "./db";

describe("AssetRepository", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory(); // fake-indexeddb/auto가 전역 제공
    resetDbCache();
  });

  it("blob을 저장하고 같은 id로 되읽는다", async () => {
    const blob = new Blob(["hello"], { type: "audio/wav" });
    const id = await putAsset(blob, "kick.wav");
    const got = await getAsset(id);
    expect(got).not.toBeNull();
    expect(got!.name).toBe("kick.wav");
    expect(await got!.blob.text()).toBe("hello");
  });

  it("없는 id는 null을 반환한다", async () => {
    expect(await getAsset("nope")).toBeNull();
  });
});
