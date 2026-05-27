import { useState, type CSSProperties } from "react";
import { X } from "@phosphor-icons/react";
import { useStore } from "../store/useStore";
import { BUILTIN_SAMPLES } from "../audio/builtinSamples";
import type { Track, TrackStatus } from "../types";

const STATUSES: TrackStatus[] = ["mute", "listening", "play", "write"];
const STATUS_LABEL: Record<TrackStatus, string> = {
  mute: "뮤트",
  listening: "리스닝",
  play: "플레이",
  write: "라이트",
};

export function TrackHeader({ track }: { track: Track }) {
  const setTrackStatus = useStore((s) => s.setTrackStatus);
  const setTrackName = useStore((s) => s.setTrackName);
  const setTrackVolume = useStore((s) => s.setTrackVolume);
  const setTrackSound = useStore((s) => s.setTrackSound);
  const setTrackKeyBinding = useStore((s) => s.setTrackKeyBinding);
  const removeTrack = useStore((s) => s.removeTrack);
  const setSelectedTrack = useStore((s) => s.setSelectedTrack);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const [capturing, setCapturing] = useState(false);

  function onKeyCapture(e: React.KeyboardEvent) {
    e.preventDefault();
    setTrackKeyBinding(track.id, e.code);
    setCapturing(false);
  }

  const selected = selectedTrackId === track.id;

  return (
    <div
      onClick={() => setSelectedTrack(track.id)}
      className={selected ? "track-row track-row--selected" : "track-row"}
      style={{ "--track-color": track.color } as CSSProperties}
    >
      <input
        className="track-row__name"
        value={track.name}
        onChange={(e) => setTrackName(track.id, e.target.value)}
      />
      <select
        value={track.status}
        onChange={(e) => setTrackStatus(track.id, e.target.value as TrackStatus)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <select
        value={track.sound.kind === "builtin" ? track.sound.sampleId : ""}
        onChange={(e) => setTrackSound(track.id, { kind: "builtin", sampleId: e.target.value })}
      >
        {BUILTIN_SAMPLES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        className={capturing ? "keycap keycap--capturing" : "keycap"}
        onKeyDown={capturing ? onKeyCapture : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setCapturing(true);
        }}
        title="클릭 후 키를 누르세요"
      >
        {capturing ? "입력…" : track.keyBinding ?? "키 없음"}
      </button>
      <input
        className="range-fill"
        style={{ "--pct": `${track.volume * 100}%` } as CSSProperties}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
      />
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
