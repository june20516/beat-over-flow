import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface StoredAsset {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number; // epoch ms. 누락 저장본은 로드 시 0으로 정규화
}

interface BeatOverflowDB extends DBSchema {
  assets: { key: string; value: StoredAsset };
  projects: { key: string; value: import("../types").Project };
}

let dbPromise: Promise<IDBPDatabase<BeatOverflowDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BeatOverflowDB>> {
  if (dbPromise === null) {
    dbPromise = openDB<BeatOverflowDB>("beat-overflow", 1, {
      upgrade(db) {
        db.createObjectStore("assets", { keyPath: "id" });
        db.createObjectStore("projects", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

// 테스트에서 fake-indexeddb 재생성 후 캐시를 비우기 위함
export function resetDbCache(): void {
  dbPromise = null;
}
