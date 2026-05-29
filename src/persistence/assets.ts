import { getDb, type StoredAsset } from "./db";
import { newId } from "../domain/ids";

export async function putAsset(blob: Blob, name: string): Promise<string> {
  const db = await getDb();
  const asset: StoredAsset = { id: newId(), name, blob, createdAt: Date.now() };
  await db.put("assets", asset);
  return asset.id;
}

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const db = await getDb();
  const raw = await db.get("assets", id);
  if (!raw) return null;
  return { ...raw, createdAt: raw.createdAt ?? 0 };
}

export async function copyAsset(id: string): Promise<string> {
  const asset = await getAsset(id);
  if (!asset) throw new Error("asset not found: " + id);
  return putAsset(asset.blob, asset.name);
}

// 신규 API들(listAssetsByIds/deleteAsset/renameAsset)은 후속 Task에서 추가.
