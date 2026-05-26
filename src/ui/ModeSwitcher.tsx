import { useStore } from "../store/useStore";
import type { GlobalMode } from "../types";

const MODES: { mode: GlobalMode; label: string }[] = [
  { mode: "listening", label: "🎧 리스닝" },
  { mode: "play", label: "🎮 플레이" },
  { mode: "record", label: "⏺ 레코드" },
];

export function ModeSwitcher() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {MODES.map((m) => (
        <button
          key={m.mode}
          onClick={() => setMode(m.mode)}
          style={{
            fontWeight: mode === m.mode ? 700 : 400,
            background: mode === m.mode ? "#2a3550" : undefined,
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
