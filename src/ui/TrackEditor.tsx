import { type CSSProperties } from "react";
import { Trash, DotsSixVertical } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import styles from "./TrackEditor.module.css";
import { cx } from "./cx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../store/useStore";
import { useAssetLibrary } from "../store/assetLibrary";
import { StatusGrid } from "./StatusGrid";
import { VolumeControl } from "./VolumeControl";
import { KeyCap } from "./KeyCap";
import { TrackSoundSelect } from "./asset-library/TrackSoundSelect";
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
  const openSelect = useAssetLibrary((s) => s.openSelect);

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
    <div
      ref={setNodeRef}
      className={styles.trackEditor}
      style={style}
    >
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
      <StatusGrid value={track.status} onChange={(s) => setTrackStatus(track.id, s)} compact={!focused} />
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
      <VolumeControl value={track.volume} onChange={(v) => setTrackVolume(track.id, v)} />
      {focused && (
        <button
          type="button"
          className={cx(controls.btn, controls.btnIcon)}
          title="마커 전체 비우기"
          onClick={(e) => {
            e.stopPropagation();
            clearMarkers(track.id);
          }}
        >
          <Trash size={14} />
        </button>
      )}
    </div>
  );
}
