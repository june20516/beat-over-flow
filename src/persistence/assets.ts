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

export async function listAssetsByIds(ids: string[]): Promise<StoredAsset[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const results = await Promise.all(ids.map((id) => db.get("assets", id)));
  return results
    .filter((a): a is StoredAsset => a !== undefined)
    .map((a) => ({ ...a, createdAt: a.createdAt ?? 0 }));
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
