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

// Task 11 will rewrite duplicateProject. Keep existing implementation for now.
export async function duplicateProject(project: Project): Promise<Project> {
  const clone: Project = structuredClone(project);
  clone.id = newId();
  clone.name = `${project.name} (사본)`;
  const now = Date.now();
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.baseFlow = { ...clone.baseFlow, assetId: await copyAsset(clone.baseFlow.assetId) };
  for (const track of clone.tracks) {
    track.id = newId();
    track.markers = track.markers.map((m) => ({ ...m, id: newId() }));
    if (track.sound.kind === "upload") {
      track.sound = { kind: "upload", assetId: await copyAsset(track.sound.assetId) };
    }
  }
  await saveProject(clone);
  return clone;
}
