import { useEffect, useState } from "react";
import { Play, Lock, Pencil, Trash, Check, X } from "@phosphor-icons/react";
import { cx } from "../cx";
import { NAME_MAX_LENGTH } from "../../domain/assetName";
import styles from "./AssetCard.module.css";

export type AssetCardAsset =
  | { kind: "builtin"; sampleId: string; label: string }
  | { kind: "upload"; id: string; name: string; durationMs: number; createdAt: number };

interface Props {
  asset: AssetCardAsset;
  mode: "manage" | "select";
  isCurrent?: boolean;
  onSelect?(): void;
  onRename?(newName: string): void;
  onDelete?(): void;
  onPreview(): void;
}

function relative(ms: number): string {
  if (ms === 0) return "오래 전";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

export function AssetCard({ asset, mode, isCurrent, onSelect, onRename, onDelete, onPreview }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asset.kind === "upload" ? asset.name : "");

  // 동일 인스턴스가 다른 asset을 받을 때 draft가 stale 되지 않도록 동기화.
  // 편집 중에는 사용자 입력 보존을 위해 동기화하지 않음.
  const externalName = asset.kind === "upload" ? asset.name : "";
  useEffect(() => {
    if (!editing) setDraft(externalName);
  }, [externalName, editing]);

  const clickable = mode === "select";
  const isBuiltin = asset.kind === "builtin";

  return (
    <div
      className={cx(styles.card, isCurrent && styles.current, clickable && styles.clickable)}
      onClick={clickable ? onSelect : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={asset.kind === "upload" ? asset.name : undefined}
    >
      <button
        type="button"
        className={styles.previewBtn}
        aria-label="미리듣기"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
      >
        <Play size={14} weight="fill" />
      </button>

      {isBuiltin ? (
        <div className={styles.meta}>
          <div className={styles.name}>
            <Lock size={12} weight="bold" /> {asset.label}
          </div>
          <div className={styles.sub}>builtin</div>
        </div>
      ) : editing ? (
        <div className={styles.editRow} onClick={(e) => e.stopPropagation()}>
          <input
            className={styles.editInput}
            value={draft}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = draft.trim() || asset.name;
                if (next !== asset.name) onRename?.(next);
                setEditing(false);
              } else if (e.key === "Escape") {
                setDraft(asset.name);
                setEditing(false);
              }
            }}
            autoFocus
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              const next = draft.trim() || asset.name;
              if (next !== asset.name) onRename?.(next);
              setEditing(false);
            }}
            aria-label="확인"
          >
            <Check size={12} weight="bold" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              setDraft(asset.name);
              setEditing(false);
            }}
            aria-label="취소"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      ) : (
        <div className={styles.meta}>
          <div className={styles.name}>{asset.name}</div>
          <div className={styles.sub}>
            {(asset.durationMs / 1000).toFixed(1)}s · {relative(asset.createdAt)}
          </div>
        </div>
      )}

      {mode === "manage" && !isBuiltin && !editing && (
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.iconBtn} aria-label="이름 변경" onClick={() => setEditing(true)}>
            <Pencil size={12} />
          </button>
          <button type="button" className={styles.iconBtn} aria-label="삭제" onClick={onDelete}>
            <Trash size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
