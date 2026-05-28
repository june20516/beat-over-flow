import { type CSSProperties } from "react";
import { Trash, DotsSixVertical } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import { cx } from "./cx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../store/useStore";
import { BUILTIN_SAMPLES } from "../audio/builtinSamples";
import { StatusGrid } from "./StatusGrid";
import { VolumeControl } from "./VolumeControl";
import { KeyCap } from "./KeyCap";
import type { Track } from "../types";

interface TrackEditorProps {
  track: Track;
  focused: boolean;
}

export function TrackEditor({ track, focused }: TrackEditorProps) {
  const setTrackStatus = useStore((s) => s.setTrackStatus);
  const setTrackName = useStore((s) => s.setTrackName);
  const setTrackVolume = useStore((s) => s.setTrackVolume);
  const setTrackSound = useStore((s) => s.setTrackSound);
  const setTrackKeyBinding = useStore((s) => s.setTrackKeyBinding);
  const clearMarkers = useStore((s) => s.clearMarkers);

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
      className={focused ? "track-editor track-editor--focused" : "track-editor"}
      style={style}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="track-editor__drag-handle"
        aria-label={`${track.name} 트랙 순서 이동`}
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical weight="bold" />
      </button>
      <input
        className={cx(controls.input, "track-editor__name")}
        value={track.name}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setTrackName(track.id, e.target.value)}
      />
      <StatusGrid value={track.status} onChange={(s) => setTrackStatus(track.id, s)} compact={!focused} />
      <select
        className={controls.select}
        value={track.sound.kind === "builtin" ? track.sound.sampleId : ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setTrackSound(track.id, { kind: "builtin", sampleId: e.target.value })}
      >
        {BUILTIN_SAMPLES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
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
