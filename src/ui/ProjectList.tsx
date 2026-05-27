import { useEffect, useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
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
      transport: { playPauseKey: null },
    };
    await saveProject(project);
    setProject(project);
    onOpen(project);
  }

  return (
    <div className="landing">
      <header className="landing__hero">
        <h1 className="landing__title">BeatOverflow</h1>
        <p className="landing__tagline">오디오 위에 비트를 쌓고, 플레이하며 점수를 노려보세요.</p>
        <button className="btn--primary landing__cta" onClick={() => fileRef.current?.click()}>
          <Plus size={18} weight="bold" />
          새 프로젝트 (오디오 업로드)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </header>

      {projects.length === 0 ? (
        <p className="landing__empty">아직 프로젝트가 없어요. 오디오를 업로드해 시작하세요.</p>
      ) : (
        <ul className="project-grid">
          {projects.map((p) => (
            <li key={p.id} className="project-card panel">
              <button
                className="project-card__open"
                onClick={() => {
                  setProject(p);
                  onOpen(p);
                }}
              >
                {p.name}
              </button>
              <div className="project-card__footer">
                <span>{p.tracks.length}개 트랙</span>
                <button
                  className="btn--danger"
                  onClick={async () => {
                    await deleteProject(p.id);
                    await refresh();
                  }}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
