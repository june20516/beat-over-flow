import { useEffect, useRef, useState } from "react";
import { listProjects, saveProject, deleteProject } from "../persistence/projects";
import { putAsset } from "../persistence/assets";
import { getEngine } from "../audio/runtime";
import { useStore } from "../store/useStore";
import { newId } from "../domain/ids";
import type { Project } from "../types";

interface Props {
  onOpen: (project: Project) => void;
}

export function ProjectList({ onOpen }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const setProject = useStore((s) => s.setProject);

  async function refresh() {
    setProjects(await listProjects());
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await getEngine().decode(file);
    const assetId = await putAsset(file, file.name);
    const project: Project = {
      id: newId(),
      name: file.name.replace(/\.[^.]+$/, ""),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      baseFlow: { kind: "audioFile", assetId, durationMs: buffer.duration * 1000 },
      tracks: [],
      master: { volume: 1 },
    };
    await saveProject(project);
    setProject(project);
    onOpen(project);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>BeatOverflow</h1>
      <button onClick={() => fileRef.current?.click()}>＋ 새 프로젝트 (오디오 업로드)</button>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <ul>
        {projects.map((p) => (
          <li key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => {
                setProject(p);
                onOpen(p);
              }}
            >
              {p.name}
            </button>
            <button
              onClick={async () => {
                await deleteProject(p.id);
                await refresh();
              }}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
