import { getDb } from "./db";
import type { Project, SoundRef, Track } from "../types";
import { newId } from "../domain/ids";
import { copyAsset } from "./assets";
import { seedRecentSounds, fillWithBuiltins } from "../domain/recentSounds";

function normalizeTrack(t: Track): Track {
  const recentSounds =
    t.recentSounds && t.recentSounds.length > 0
      ? fillWithBuiltins(t.recentSounds)
      : seedRecentSounds(t.sound);
  return { ...t, recentSounds };
}

function normalizeProject(p: Project): Project {
  const tracks = p.tracks.map(normalizeTrack);
  const declared = new Set(p.libraryAssetIds ?? []);
  for (const t of tracks) {
    if (t.sound.kind === "upload") declared.add(t.sound.assetId);
    for (const s of t.recentSounds) {
      if (s.kind === "upload") declared.add(s.assetId);
    }
  }
  return { ...p, tracks, libraryAssetIds: Array.from(declared) };
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put("projects", project);
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDb();
  const raw = await db.get("projects", id);
  return raw ? normalizeProject(raw) : null;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const all = await db.getAll("projects");
  return all.map(normalizeProject);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("projects", id);
}

/**
 * 프로젝트를 깊은 복사. `idMap`으로 동일 assetId가 여러 위치에 나타나도 copyAsset을 한 번만 호출한다.
 *
 * 입력 가정: `project`는 `normalizeProject`를 거친 정규화된 형태가 표준이지만,
 * 일부 호출 경로(테스트 픽스처 등)는 raw Project를 직접 넘길 수 있다 — 이 경우를 위해
 * `?? []` 방어를 둔다. baseFlow.assetId는 `libraryAssetIds`와 의미가 다르므로 의도적으로
 * idMap을 우회해 별도 copyAsset을 호출한다(현재 타입상 교집합이 없으므로 안전).
 */
export async function duplicateProject(project: Project): Promise<Project> {
  const clone: Project = structuredClone(project);
  clone.id = newId();
  clone.name = `${project.name} (사본)`;
  const now = Date.now();
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.baseFlow = { ...clone.baseFlow, assetId: await copyAsset(clone.baseFlow.assetId) };

  const idMap = new Map<string, string>();
  const remap = async (oldId: string): Promise<string> => {
    const hit = idMap.get(oldId);
    if (hit) return hit;
    const next = await copyAsset(oldId);
    idMap.set(oldId, next);
    return next;
  };

  clone.libraryAssetIds = await Promise.all((clone.libraryAssetIds ?? []).map(remap));

  for (const track of clone.tracks) {
    track.id = newId();
    track.markers = track.markers.map((m) => ({ ...m, id: newId() }));
    if (track.sound.kind === "upload") {
      track.sound = { kind: "upload", assetId: await remap(track.sound.assetId) };
    }
    track.recentSounds = await Promise.all(
      (track.recentSounds ?? []).map(async (s): Promise<SoundRef> =>
        s.kind === "upload" ? { kind: "upload", assetId: await remap(s.assetId) } : s,
      ),
    );
  }

  await saveProject(clone);
  return clone;
}
