import { describe, it, expect } from "vitest";
import { validateUpload, MAX_BYTES, MAX_DURATION_MS, type DecodeFn } from "./validateUpload";

function mkFile(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

const okDecode: DecodeFn = async () => ({ durationMs: 2000 });
const tooLongDecode: DecodeFn = async () => ({ durationMs: MAX_DURATION_MS + 100 });
const failDecode: DecodeFn = async () => {
  throw new Error("bad bytes");
};

describe("validateUpload", () => {
  it("audio/* 가 아니면 not-audio 거부", async () => {
    const f = mkFile("img.png", 100, "image/png");
    const r = await validateUpload(f, okDecode);
    expect(r).toEqual({ ok: false, reason: "not-audio", detail: "image/png" });
  });

  it("5MB 초과는 too-large", async () => {
    const f = mkFile("big.wav", MAX_BYTES + 1, "audio/wav");
    const r = await validateUpload(f, okDecode);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-large");
  });

  it("decode 실패는 decode-failed", async () => {
    const f = mkFile("a.wav", 100, "audio/wav");
    const r = await validateUpload(f, failDecode);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("decode-failed");
  });

  it("길이 초과는 too-long", async () => {
    const f = mkFile("a.wav", 100, "audio/wav");
    const r = await validateUpload(f, tooLongDecode);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-long");
  });

  it("정상 케이스는 durationMs 반환", async () => {
    const f = mkFile("a.wav", 100, "audio/wav");
    const r = await validateUpload(f, okDecode);
    expect(r).toEqual({ ok: true, durationMs: 2000 });
  });
});
