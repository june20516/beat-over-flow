import { describe, it, expect, beforeEach } from "vitest";
import { putAsset, getAsset, copyAsset } from "./assets";
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

  it("copyAsset은 새 id로 같은 내용을 복제하고 원본을 보존한다", async () => {
    const id = await putAsset(new Blob(["audio-bytes"], { type: "audio/mp3" }), "demo.mp3");
    const copyId = await copyAsset(id);
    expect(copyId).not.toBe(id);
    expect(await (await getAsset(copyId))!.blob.text()).toBe("audio-bytes");
    expect(await (await getAsset(id))!.blob.text()).toBe("audio-bytes"); // 원본 유지
  });

  it("copyAsset은 없는 id면 throw 한다", async () => {
    await expect(copyAsset("nope")).rejects.toThrow();
  });
});
