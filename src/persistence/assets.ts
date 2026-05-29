import { getDb, type StoredAsset } from "./db";
import { newId } from "../domain/ids";

/** 누락 저장본의 createdAt을 0으로 정규화한다. db.ts의 StoredAsset.createdAt 주석 참조. */
function normalizeAsset(raw: StoredAsset): StoredAsset {
  return { ...raw, createdAt: raw.createdAt ?? 0 };
}

export async function putAsset(blob: Blob, name: string): Promise<string> {
  const db = await getDb();
  const asset: StoredAsset = { id: newId(), name, blob, createdAt: Date.now() };
  await db.put("assets", asset);
  return asset.id;
}

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const db = await getDb();
  const raw = await db.get("assets", id);
  return raw ? normalizeAsset(raw) : null;
}

export async function copyAsset(id: string): Promise<string> {
  const asset = await getAsset(id);
  if (!asset) throw new Error("asset not found: " + id);
  return putAsset(asset.blob, asset.name);
}

/**
 * 주어진 id들에 해당하는 에셋을 조회한다.
 * 결과 순서는 입력 ids 순서와 같지 않을 수 있다 — 누락된 id는 결과에서 제외되며,
 * 순서가 중요한 호출자는 자체적으로 정렬/매핑해야 한다.
 */
export async function listAssetsByIds(ids: string[]): Promise<StoredAsset[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const results = await Promise.all(ids.map((id) => db.get("assets", id)));
  return results.filter((a): a is StoredAsset => a !== undefined).map(normalizeAsset);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("assets", id);
}

export async function renameAsset(id: string, newName: string): Promise<void> {
  const db = await getDb();
  const asset = await db.get("assets", id);
  if (!asset) throw new Error("asset not found: " + id);
  await db.put("assets", { ...asset, name: newName });
}
