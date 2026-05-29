import { getDb } from "./db";
import type { Project, SoundRef, Track, TrackStatus } from "../types";
import { newId } from "../domain/ids";
import { copyAsset } from "./assets";
import { seedRecentSounds, fillWithBuiltins } from "../domain/recentSounds";

function normalizeTrack(t: Track): Track {
  const recentSounds =
    t.recentSounds && t.recentSounds.length > 0
      ? fillWithBuiltins(t.recentSounds)
      : seedRecentSounds(t.sound);
  // 레거시 status "write"는 새 단어 "record"로 정규화. 의미는 동일(전역 record 모드에서 키 입력 받음).
  const status = (t.status as string) === "write" ? ("record" as TrackStatus) : t.status;
  return { ...t, recentSounds, status };
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
 * `?? []` 방어를 둔다.
 *
 * baseFlow.assetId는 `libraryAssetIds`/트랙 sound와 의미가 다르므로 의도적으로 idMap을
 * 우회해 별도 copyAsset을 호출한다(현재 타입상 두 영역은 교집합이 없어 안전).
 *
 * ⚠️ 가정이 깨질 시점: 향후 베이스 오디오를 라이브러리 샘플로 재사용하거나, 트랙 sound로
 * 직접 참조하는 기능이 생기면 동일 원본 assetId가 baseFlow와 라이브러리 양쪽에 등장한다.
 * 그 경우 같은 원본이 두 번 copyAsset 호출되어 사본이 갈라진다(원본=A → A1, A2).
 * 그 시점에는 baseFlow도 idMap을 거치도록 본 함수를 갱신해야 한다.
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
