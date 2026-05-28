import { useEffect, useRef, useState } from "react";
import { Plus, Sparkle, Copy, PencilSimple } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import primitives from "./primitives.module.css";
import { cx } from "./cx";
import { listProjects, saveProject, deleteProject, duplicateProject } from "../persistence/projects";
import { putAsset } from "../persistence/assets";
import { getEngine } from "../audio/runtime";
import { useStore } from "../store/useStore";
import { newId } from "../domain/ids";
import { buildProjectFromBlueprint, EXAMPLE_BLUEPRINT } from "../example/exampleProject";
import type { Project } from "../types";

interface Props {
  onOpen: (project: Project) => void;
}

export function ProjectList({ onOpen }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const cancelRenameRef = useRef(false);
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

  async function createExample() {
    const res = await fetch("/samples/moodmode-demo.mp3");
    const blob = await res.blob();
    const assetId = await putAsset(blob, "moodmode-demo.mp3");
    const buffer = await getEngine().decode(blob);
    const project = buildProjectFromBlueprint(
      EXAMPLE_BLUEPRINT,
      assetId,
      Math.round(buffer.duration * 1000),
    );
    await saveProject(project);
    setProject(project);
    onOpen(project);
  }

  async function handleDuplicate(p: Project) {
    await duplicateProject(p);
    await refresh();
  }

  function startRename(p: Project) {
    setEditingId(p.id);
    setDraftName(p.name);
  }

  async function commitRename(p: Project) {
    const name = draftName.trim();
    if (!name || name === p.name) return;
    await saveProject({ ...p, name, updatedAt: Date.now() });
    await refresh();
  }

  function handleRenameBlur(p: Project) {
    setEditingId(null);
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    void commitRename(p);
  }

  return (
    <div className="landing">
      <header className="landing__hero">
        <h1 className="landing__title">BeatOverflow</h1>
        <p className="landing__tagline">오디오 위에 비트를 쌓고, 플레이하며 점수를 노려보세요.</p>
        <div className="landing__cta-row">
          <button className={cx(controls.btn, controls.btnPrimary, "landing__cta")} onClick={() => fileRef.current?.click()}>
            <Plus size={18} weight="bold" />
            새 프로젝트 (오디오 업로드)
          </button>
          <button className={cx(controls.btn, controls.btnGhost, "landing__cta-secondary")} onClick={createExample}>
            <Sparkle size={18} weight="bold" />
            예제 프로젝트
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </header>

      {projects.length === 0 ? (
        <p className="landing__empty">아직 프로젝트가 없어요. 오디오를 업로드하거나 예제로 시작하세요.</p>
      ) : (
        <ul className="project-grid">
          {projects.map((p) => (
            <li key={p.id} className={cx("project-card", primitives.panel)}>
              {editingId === p.id ? (
                <input
                  className={cx(controls.input, "project-card__rename")}
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => handleRenameBlur(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      cancelRenameRef.current = true;
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              ) : (
                <div className="project-card__title">
                  <button
                    className="project-card__open"
                    onClick={() => {
                      setProject(p);
                      onOpen(p);
                    }}
                  >
                    {p.name}
                  </button>
                  <button
                    className={cx(controls.btn, controls.btnGhost, controls.btnIcon, "project-card__edit")}
                    title="이름 수정"
                    onClick={() => startRename(p)}
                  >
                    <PencilSimple size={15} weight="bold" />
                  </button>
                </div>
              )}
              <div className="project-card__footer">
                <span>{p.tracks.length}개 트랙</span>
                <div className="project-card__actions">
                  <button
                    className={cx(controls.btn, controls.btnGhost, controls.btnIcon)}
                    title="복사"
                    onClick={() => handleDuplicate(p)}
                  >
                    <Copy size={15} weight="bold" />
                  </button>
                  <button
                    className={cx(controls.btn, controls.btnDanger)}
                    onClick={async () => {
                      await deleteProject(p.id);
                      await refresh();
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
