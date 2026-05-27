import { getDb } from "./db";
import type { Project } from "../types";
import { newId } from "../domain/ids";
import { copyAsset } from "./assets";

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put("projects", project);
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDb();
  return (await db.get("projects", id)) ?? null;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return await db.getAll("projects");
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("projects", id);
}

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
