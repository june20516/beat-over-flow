import { useState, type CSSProperties } from "react";
import { Trash, DotsSixVertical, X } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import styles from "./TrackEditor.module.css";
import { cx } from "./cx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../store/useStore";
import { useAssetLibrary } from "../store/assetLibrary";
import { StatusBadge } from "./StatusBadge";
import { StatusButtons } from "./StatusButtons";
import { VolumeControl } from "./VolumeControl";
import { KeyCap } from "./KeyCap";
import { TrackSoundSelect } from "./asset-library/TrackSoundSelect";
import { ConfirmDialog } from "./primitives/ConfirmDialog";
import type { Track } from "../types";

interface TrackEditorProps {
  track: Track;
  focused: boolean;
}

export function TrackEditor({ track, focused }: TrackEditorProps) {
  const setTrackStatus = useStore((s) => s.setTrackStatus);
  const setTrackName = useStore((s) => s.setTrackName);
  const setTrackVolume = useStore((s) => s.setTrackVolume);
  const selectTrackSound = useStore((s) => s.selectTrackSound);
  const setTrackKeyBinding = useStore((s) => s.setTrackKeyBinding);
  const clearMarkers = useStore((s) => s.clearMarkers);
  const removeTrack = useStore((s) => s.removeTrack);
  const openSelect = useAssetLibrary((s) => s.openSelect);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style: CSSProperties = {
    "--track-color": track.color,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as CSSProperties;

  return (
    <div ref={setNodeRef} className={cx(styles.trackEditor, focused && styles.focused)} style={style}>
      <div className={styles.row}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.dragHandle}
          aria-label={`${track.name} 트랙 순서 이동`}
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical weight="bold" />
        </button>
        <input
          className={cx(controls.input, styles.name)}
          value={track.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setTrackName(track.id, e.target.value)}
        />
        <StatusBadge value={track.status} onChange={(next) => setTrackStatus(track.id, next)} />
        <div className={styles.selectSlot}>
          <TrackSoundSelect
            trackId={track.id}
            sound={track.sound}
            recentSounds={track.recentSounds}
            onChange={(next) => selectTrackSound(track.id, next)}
            onOpenLibrary={() => openSelect(track.id)}
          />
        </div>
        <KeyCap code={track.keyBinding} onCapture={(code) => setTrackKeyBinding(track.id, code)} />
        <VolumeControl value={track.volume} onChange={(v) => setTrackVolume(track.id, v)} buttonClassName={styles.volumeBtn} />
      </div>
      {focused && (
        <div className={styles.actionRow}>
          <StatusButtons value={track.status} onChange={(s) => setTrackStatus(track.id, s)} />
          <span className={styles.actionSpacer} />
          <button
            type="button"
            className={cx(controls.btn, styles.actionBtn)}
            title="마커 전체 비우기"
            onClick={(e) => {
              e.stopPropagation();
              clearMarkers(track.id);
            }}
          >
            <Trash size={14} />
            <span>마커 비우기</span>
          </button>
          <button
            type="button"
            className={cx(styles.actionBtn, styles.destructive)}
            title="트랙 삭제"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
          >
            <X size={14} weight="bold" />
            <span>트랙 삭제</span>
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="트랙 삭제"
        description={
          <>
            <strong>{track.name}</strong> 트랙과 모든 마커가 사라집니다.
            <br />
            되돌릴 수 없습니다.
          </>
        }
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={() => removeTrack(track.id)}
      />
    </div>
  );
}
