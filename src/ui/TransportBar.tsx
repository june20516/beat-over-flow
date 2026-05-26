import { useStore } from "../store/useStore";
import { play, pause, seek } from "../audio/runtime";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function TransportBar() {
  const playing = useStore((s) => s.playing);
  const playheadMs = useStore((s) => s.playheadMs);
  const project = useStore((s) => s.project);
  const setMasterVolume = useStore((s) => s.setMasterVolume);
  const durationMs = project?.baseFlow.durationMs ?? 0;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 8 }}>
      <button onClick={() => (playing ? pause() : void play())}>
        {playing ? "⏸" : "▶"}
      </button>
      <span style={{ fontFamily: "monospace" }}>
        {fmt(playheadMs)} / {fmt(durationMs)}
      </span>
      <input
        type="range"
        min={0}
        max={durationMs}
        value={playheadMs}
        onChange={(e) => seek(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <label>
        🔊
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={project?.master.volume ?? 1}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
