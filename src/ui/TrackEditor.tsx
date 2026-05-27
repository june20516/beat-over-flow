import { type CSSProperties } from "react";
import { X, Trash } from "@phosphor-icons/react";
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
  const removeTrack = useStore((s) => s.removeTrack);

  return (
    <div
      className={focused ? "track-editor track-editor--focused" : "track-editor"}
      style={{ "--track-color": track.color } as CSSProperties}
    >
      <input
        className="track-editor__name"
        value={track.name}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setTrackName(track.id, e.target.value)}
      />
      <StatusGrid value={track.status} onChange={(s) => setTrackStatus(track.id, s)} />
      <select
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
      <button
        type="button"
        className="btn--icon track-editor__clear"
        title="마커 전체 비우기"
        onClick={(e) => {
          e.stopPropagation();
          clearMarkers(track.id);
        }}
      >
        <Trash size={14} />
      </button>
      <button
        className="btn--danger"
        onClick={(e) => {
          e.stopPropagation();
          removeTrack(track.id);
        }}
        title="트랙 삭제"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
