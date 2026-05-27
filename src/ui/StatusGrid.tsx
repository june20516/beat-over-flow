import type { CSSProperties } from "react";
import type { TrackStatus } from "../types";

interface StatusGridProps {
  value: TrackStatus;
  onChange: (s: TrackStatus) => void;
  compact?: boolean;
}

interface StatusMeta {
  status: TrackStatus;
  letter: string;
  label: string;
  color: string;
}

const STATUS_META: StatusMeta[] = [
  { status: "mute", letter: "M", label: "뮤트", color: "#6b7280" },
  { status: "listening", letter: "L", label: "리스닝", color: "#22d3ee" },
  { status: "play", letter: "P", label: "플레이", color: "#4ade80" },
  { status: "write", letter: "W", label: "라이트", color: "#ec4899" },
];

export function StatusGrid({ value, onChange, compact }: StatusGridProps) {
  if (compact) {
    const m = STATUS_META.find((x) => x.status === value)!;
    return (
      <div className="status-grid status-grid--compact" title={m.label} style={{ "--tone": m.color } as CSSProperties}>
        <span className="status-grid__letter">{m.letter}</span>
      </div>
    );
  }
  return (
    <div className="status-grid" role="group" aria-label="트랙 상태">
      {STATUS_META.map((m) => {
        const selected = m.status === value;
        return (
          <button
            key={m.status}
            type="button"
            className={selected ? "status-grid__cell status-grid__cell--on" : "status-grid__cell"}
            style={{ "--tone": m.color } as CSSProperties}
            title={m.label}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onChange(m.status);
            }}
          >
            {m.letter}
          </button>
        );
      })}
    </div>
  );
}
