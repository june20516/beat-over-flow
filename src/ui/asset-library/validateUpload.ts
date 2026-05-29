export const MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_DURATION_MS = 5_000; // 5s

export interface DecodeFn {
  (buf: ArrayBuffer): Promise<{ durationMs: number }>;
}

export type ValidateResult =
  | { ok: true; durationMs: number }
  | {
      ok: false;
      reason: "not-audio" | "too-large" | "decode-failed" | "too-long";
      detail?: string;
    };

export async function validateUpload(file: File, decode: DecodeFn): Promise<ValidateResult> {
  // 클라이언트 사용자 의도 검사일 뿐 보안 검사가 아님 — file.type은 브라우저가 확장자로 추정함.
  // 본 프로젝트는 서버 업로드가 없어 충분하나, 향후 업로드 경로가 추가되면 서버측 재검증 필요.
  if (!file.type.startsWith("audio/")) {
    return { ok: false, reason: "not-audio", detail: file.type || "unknown" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "too-large", detail: `${(file.size / 1024 / 1024).toFixed(1)}MB` };
  }
  let durationMs: number;
  try {
    const buf = await file.arrayBuffer();
    ({ durationMs } = await decode(buf));
  } catch (e) {
    return { ok: false, reason: "decode-failed", detail: e instanceof Error ? e.message : String(e) };
  }
  if (durationMs > MAX_DURATION_MS) {
    return { ok: false, reason: "too-long", detail: `${(durationMs / 1000).toFixed(1)}s` };
  }
  return { ok: true, durationMs };
}
