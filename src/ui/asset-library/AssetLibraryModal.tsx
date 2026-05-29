import { useCallback, useEffect, useState } from "react";
import { CaretRight, CaretDown } from "@phosphor-icons/react";
import { Modal } from "../primitives/Modal";
import { AssetCard } from "./AssetCard";
import { AssetUploadDropzone, AssetUploadButton } from "./AssetUploadDropzone";
import { uploadAssets, type UploadFailure, type UploadFailureReason } from "./uploadAssets";
import { makeDecoder } from "./useAudioDecoder";
import { listAssetsByIds, deleteAsset, renameAsset } from "../../persistence/assets";
import { useStore } from "../../store/useStore";
import { useAssetLibrary } from "../../store/assetLibrary";
import { useLoadingOverlay } from "../../store/loadingOverlay";
import { BUILTIN_SAMPLES } from "../../audio/builtinSamples";
import { previewSound, stopPreview } from "./preview";
import type { StoredAsset } from "../../persistence/db";
import type { SoundRef } from "../../types";
import styles from "./AssetLibraryModal.module.css";

const BUILTINS_COLLAPSED_KEY = "assetLibrary.builtinsCollapsed";

function readBuiltinsCollapsed(): boolean {
  try { return localStorage.getItem(BUILTINS_COLLAPSED_KEY) !== "false"; } catch { return true; }
}
function writeBuiltinsCollapsed(v: boolean) {
  try { localStorage.setItem(BUILTINS_COLLAPSED_KEY, String(v)); } catch { /* ignore */ }
}

function reasonText(reason: UploadFailureReason, detail?: string): string {
  switch (reason) {
    case "not-audio": return `음원 파일이 아닙니다${detail ? ` (${detail})` : ""}`;
    case "too-large": return `용량 초과${detail ? ` (${detail} > 5MB)` : ""}`;
    case "decode-failed": return `지원하지 않는 포맷 또는 손상됨${detail ? ` (${detail})` : ""}`;
    case "too-long": return `길이 초과${detail ? ` (${detail} > 5s)` : ""}`;
  }
}

export function AssetLibraryModal() {
  const { open, mode, targetTrackId, close } = useAssetLibrary();
  const project = useStore((s) => s.project);
  const selectTrackSound = useStore((s) => s.selectTrackSound);
  const addAssetToLibrary = useStore((s) => s.addAssetToLibrary);
  const canDeleteAsset = useStore((s) => s.canDeleteAsset);
  const removeAssetFromLibrary = useStore((s) => s.removeAssetFromLibrary);

  const [uploads, setUploads] = useState<StoredAsset[]>([]);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [deleteWarn, setDeleteWarn] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readBuiltinsCollapsed());

  // idsKey로 의존성을 안정화 — 프로젝트 객체가 바뀌어도 libraryAssetIds 내용이
  // 동일하면 effect/콜백이 재실행되지 않는다(불필요한 IDB 호출 방지).
  const ids = project?.libraryAssetIds ?? [];
  const idsKey = ids.join("|");
  const refetch = useCallback(async () => {
    const currentIds = idsKey ? idsKey.split("|") : [];
    const xs = await listAssetsByIds(currentIds);
    xs.sort((a, b) => b.createdAt - a.createdAt);
    setUploads(xs);
  }, [idsKey]);

  useEffect(() => {
    if (open) {
      void refetch();
    } else {
      stopPreview();
      setFailures([]);
      setDeleteWarn(null);
    }
  }, [open, refetch]);

  const currentSound: SoundRef | undefined =
    project?.tracks.find((t) => t.id === targetTrackId)?.sound;

  async function handleFiles(files: File[]) {
    setFailures([]);
    const { show, setProgress, hide } = useLoadingOverlay.getState();
    show({ mode: "determinate", label: "업로드 중..." });
    try {
      // 항상 최신 libraryAssetIds로 collision check — 렌더 시점의 stale closure 회피.
      const currentIds = useStore.getState().project?.libraryAssetIds ?? [];
      const { newAssetIds, failures: fs } = await uploadAssets(
        files,
        currentIds,
        makeDecoder(),
        ({ current, total }) => setProgress(current / total),
      );
      for (const id of newAssetIds) addAssetToLibrary(id);
      setFailures(fs);
      // refetch는 호출하지 않는다 — idsKey 변경이 effect를 자동 재실행하여
      // 항상 새 libraryAssetIds로 listAssetsByIds를 부른다.
    } finally {
      hide();
    }
  }

  function handleRename(assetId: string, newName: string) {
    void renameAsset(assetId, newName)
      .then(refetch)
      .catch((e) => console.error("[AssetLibrary] renameAsset failed", e));
  }

  async function handleDelete(asset: StoredAsset) {
    const guard = canDeleteAsset(asset.id);
    if (!guard.ok) {
      setDeleteWarn(
        `${asset.name}은 트랙 ${guard.usedBy.map((t) => `'${t.name}'`).join(", ")}에서 사용 중입니다. 먼저 다른 사운드로 변경하세요.`,
      );
      return;
    }
    // IDB 먼저 → 성공 시 store 갱신. 실패 시 store는 그대로 유지되어 orphan blob을 만들지 않는다.
    try {
      await deleteAsset(asset.id);
      removeAssetFromLibrary(asset.id);
    } catch (e) {
      console.error("[AssetLibrary] deleteAsset failed", e);
      setDeleteWarn(`삭제에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleSelect(sound: SoundRef) {
    if (mode !== "select" || !targetTrackId) return;
    selectTrackSound(targetTrackId, sound);
    close();
  }

  return (
    <Modal open={open} onOpenChange={(o) => (o ? null : close())} title="샘플" size="lg">
      <AssetUploadDropzone onFiles={handleFiles}>
        <Modal.Body>
          {failures.length > 0 && (
            <div className={styles.errorPanel}>
              <div className={styles.errorTitle}>⚠ {failures.length}개 파일을 추가하지 못했습니다.</div>
              <ul className={styles.errorList}>
                {failures.map((f, i) => (
                  <li key={`${f.fileName}:${i}`}>
                    <code>{f.fileName}</code> — {reasonText(f.reason, f.detail)}
                  </li>
                ))}
              </ul>
              <button className={styles.errorClose} onClick={() => setFailures([])}>닫기</button>
            </div>
          )}
          {deleteWarn && (
            <div className={styles.errorPanel}>
              <div>{deleteWarn}</div>
              <button className={styles.errorClose} onClick={() => setDeleteWarn(null)}>닫기</button>
            </div>
          )}

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <CaretDown size={12} weight="bold" />
              <span>내 샘플 ({uploads.length})</span>
              <span className={styles.sectionAction}>
                <AssetUploadButton onFiles={handleFiles} />
              </span>
            </header>
            {uploads.length === 0 ? (
              <div className={styles.emptyHint}>업로드된 샘플이 없습니다. [업로드]를 누르거나 파일을 끌어다 놓으세요.</div>
            ) : (
              <div className={styles.grid}>
                {uploads.map((a) => (
                  <AssetCard
                    key={a.id}
                    // TODO: durationMs는 StoredAsset에 영속되면 a.durationMs로 교체.
                    // 지금은 카드에 0.0s로 표시됨 — UX 한계로 인지.
                    asset={{ kind: "upload", id: a.id, name: a.name, durationMs: 0, createdAt: a.createdAt }}
                    mode={mode}
                    isCurrent={
                      mode === "select" &&
                      currentSound?.kind === "upload" &&
                      currentSound.assetId === a.id
                    }
                    onSelect={() => handleSelect({ kind: "upload", assetId: a.id })}
                    onRename={(name) => handleRename(a.id, name)}
                    onDelete={() => handleDelete(a)}
                    onPreview={() => void previewSound({ kind: "upload", assetId: a.id })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                writeBuiltinsCollapsed(next);
              }}
              aria-expanded={!collapsed}
            >
              {collapsed ? <CaretRight size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
              <span>빌트인 ({BUILTIN_SAMPLES.length})</span>
            </button>
            {!collapsed && (
              <div className={styles.grid}>
                {BUILTIN_SAMPLES.map((b) => (
                  <AssetCard
                    key={b.id}
                    asset={{ kind: "builtin", sampleId: b.id, label: b.label }}
                    mode={mode}
                    isCurrent={
                      mode === "select" &&
                      currentSound?.kind === "builtin" &&
                      currentSound.sampleId === b.id
                    }
                    onSelect={() => handleSelect({ kind: "builtin", sampleId: b.id })}
                    onPreview={() => void previewSound({ kind: "builtin", sampleId: b.id })}
                  />
                ))}
              </div>
            )}
          </section>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className={styles.closeBtn} onClick={close}>닫기</button>
        </Modal.Footer>
      </AssetUploadDropzone>
    </Modal>
  );
}
