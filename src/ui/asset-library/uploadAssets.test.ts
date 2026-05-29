import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { uploadAssets } from "./uploadAssets";
import { resetDbCache } from "../../persistence/db";
import { listAssetsByIds } from "../../persistence/assets";
import type { DecodeFn } from "./validateUpload";

const okDecode: DecodeFn = async () => ({ durationMs: 1500 });

function f(name: string, bytes = 100, type = "audio/wav"): File {
  return new File([new Blob([new Uint8Array(bytes)], { type })], name, { type });
}

describe("uploadAssets", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("성공 파일만 newAssetIds에 들어가고 실패는 failures로", async () => {
    const files = [f("kick.wav"), f("img.png", 100, "image/png")];
    const out = await uploadAssets(files, [], okDecode);
    expect(out.newAssetIds.length).toBe(1);
    expect(out.failures.length).toBe(1);
    expect(out.failures[0].reason).toBe("not-audio");
  });

  it("동명 충돌 시 (2) 접미", async () => {
    const out = await uploadAssets([f("kick.wav"), f("kick.wav")], [], okDecode);
    const stored = await listAssetsByIds(out.newAssetIds);
    const names = stored.map((s) => s.name).sort();
    expect(names).toEqual(["kick", "kick (2)"]);
  });

  it("onProgress는 파일마다 current 증가", async () => {
    const seen: number[] = [];
    await uploadAssets([f("a.wav"), f("b.wav")], [], okDecode, (p) => seen.push(p.current));
    expect(seen).toEqual([1, 2]);
  });
});
