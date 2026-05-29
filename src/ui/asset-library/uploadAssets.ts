import { validateUpload, type DecodeFn } from "./validateUpload";
import { normalizeAssetName, resolveNameCollision } from "../../domain/assetName";
import { putAsset, listAssetsByIds } from "../../persistence/assets";

export type UploadFailureReason = "not-audio" | "too-large" | "decode-failed" | "too-long";

export interface UploadFailure {
  fileName: string;
  reason: UploadFailureReason;
  detail?: string;
}

export interface UploadProgress {
  current: number;
  total: number;
}

export interface UploadOutcome {
  newAssetIds: string[];
  failures: UploadFailure[];
}

/**
 * 파일들을 검증 → IDB 저장 후 새 assetId 목록 반환.
 * 진행률 콜백은 매 파일 완료 직후 호출.
 */
export async function uploadAssets(
  files: File[],
  existingAssetIds: string[],
  decode: DecodeFn,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadOutcome> {
  const existing = await listAssetsByIds(existingAssetIds);
  const usedNames = new Set(existing.map((a) => a.name));

  const newAssetIds: string[] = [];
  const failures: UploadFailure[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const result = await validateUpload(f, decode);
    if (!result.ok) {
      failures.push({ fileName: f.name, reason: result.reason, detail: result.detail });
    } else {
      const base = normalizeAssetName(f.name);
      const name = resolveNameCollision(base, Array.from(usedNames));
      usedNames.add(name);
      const id = await putAsset(f, name);
      newAssetIds.push(id);
    }
    onProgress?.({ current: i + 1, total: files.length });
  }

  return { newAssetIds, failures };
}
