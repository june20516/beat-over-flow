import type { CSSProperties } from "react";
import type { TrackStatus } from "../types";
import { cx } from "./cx";
import styles from "./StatusGrid.module.css";

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
      <div className={cx(styles.statusGrid, styles.compact)} title={m.label} style={{ "--tone": m.color } as CSSProperties}>
        <span className={styles.letter}>{m.letter}</span>
      </div>
    );
  }
  return (
    <div className={styles.statusGrid} role="group" aria-label="트랙 상태">
      {STATUS_META.map((m) => {
        const selected = m.status === value;
        return (
          <button
            key={m.status}
            type="button"
            className={cx(styles.cell, selected && styles.cellOn)}
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
