import type { CSSProperties } from "react";
import type { TrackStatus } from "../types";
import { TRACK_STATUS_META } from "../domain/trackStatus";
import { cx } from "./cx";
import styles from "./StatusButtons.module.css";

interface Props {
  value: TrackStatus;
  onChange(s: TrackStatus): void;
}

/**
 * 트랙 행 2단(액션)의 좌측에 표시되는 풀 명칭 4버튼.
 * 각 버튼은 색을 가지며, 선택된 상태는 채워진 칩으로 표시된다.
 */
export function StatusButtons({ value, onChange }: Props) {
  return (
    <div className={styles.group} role="group" aria-label="트랙 상태">
      {TRACK_STATUS_META.map((m) => {
        const selected = m.status === value;
        return (
          <button
            key={m.status}
            type="button"
            className={cx(styles.btn, selected && styles.selected)}
            style={{ "--tone": m.color } as CSSProperties}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onChange(m.status);
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
