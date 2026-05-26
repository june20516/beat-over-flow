import { getDb } from "./db";
import type { Project } from "../types";

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
