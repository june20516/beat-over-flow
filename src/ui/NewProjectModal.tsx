import { useState } from "react";
import type { Project } from "../types";
import { Modal } from "./primitives/Modal";
import { parseYouTubeId } from "../domain/youtube";
import { buildAudioFileProject, buildYouTubeProject } from "../domain/newProject";
import { normalizeAssetName } from "../domain/assetName";
import { putAsset } from "../persistence/assets";
import { saveProject } from "../persistence/projects";
import { getEngine } from "../audio/runtime";
import { AssetUploadDropzone, AssetUploadButton } from "./asset-library/AssetUploadDropzone";
import styles from "./NewProjectModal.module.css";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 생성·저장 완료된 프로젝트. 호출부가 setProject + 에디터 진입을 처리한다. */
  onCreated(project: Project): void;
}

export function NewProjectModal({ open, onOpenChange, onCreated }: Props) {
  const [tab, setTab] = useState<"file" | "youtube">("file");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleOpenChange(next: boolean) {
    // 닫힐 때 입력/에러/탭/진행 상태를 리셋한다(Radix Dialog는 unmount하지 않으므로 잔류 방지).
    if (!next) {
      setTab("file");
      setUrl("");
      setName("");
      setError(null);
      setBusy(false);
    }
    onOpenChange(next);
  }

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    try {
      const buffer = await getEngine().decode(file);
      const cleanName = normalizeAssetName(file.name);
      const assetId = await putAsset(file, cleanName);
      const project = buildAudioFileProject(cleanName, assetId, buffer.duration * 1000);
      await saveProject(project);
      onCreated(project);
    } catch (e) {
      console.error("[NewProjectModal] file create failed", e);
      setError(`오디오를 불러오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function applyYouTube() {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("유효한 유튜브 URL 또는 영상 ID가 아닙니다.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const project = buildYouTubeProject(id, name);
      await saveProject(project);
      onCreated(project);
    } catch (e) {
      console.error("[NewProjectModal] youtube create failed", e);
      setError(`프로젝트 생성에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} title="새 프로젝트" size="sm">
      <div className={styles.picker}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === "file" ? styles.tabActive : styles.tab}
            onClick={() => { setTab("file"); setError(null); }}
          >
            오디오 업로드
          </button>
          <button
            type="button"
            className={tab === "youtube" ? styles.tabActive : styles.tab}
            onClick={() => { setTab("youtube"); setError(null); }}
          >
            유튜브
          </button>
        </div>

        {tab === "file" ? (
          <AssetUploadDropzone onFiles={handleFiles}>
            <div className={styles.body}>
              <p className={styles.hint}>오디오 파일을 드롭하거나 선택하세요.</p>
              <AssetUploadButton onFiles={handleFiles} />
            </div>
          </AssetUploadDropzone>
        ) : (
          <div className={styles.body}>
            <input
              className={styles.input}
              placeholder="https://youtu.be/... 또는 영상 ID"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void applyYouTube(); }}
              autoFocus
            />
            <input
              className={styles.input}
              placeholder="프로젝트 이름 (선택, 비우면 '유튜브 프로젝트')"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void applyYouTube(); }}
            />
            <button className={styles.apply} disabled={busy} onClick={() => void applyYouTube()}>
              만들기
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {busy && <p className={styles.hint}>준비 중...</p>}
      </div>
    </Modal>
  );
}
