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
  const removeTrack = useStore((s) => s.removeTrack);

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        height: 40,
        padding: "0 6px",
        borderLeft: `4px solid ${track.color}`,
      }}
    >
      <input
        value={track.name}
        onChange={(e) => setTrackName(track.id, e.target.value)}
        style={{ width: 80 }}
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
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
        style={{ width: 60 }}
      />
      <button onClick={() => removeTrack(track.id)}>✕</button>
    </div>
  );
}
