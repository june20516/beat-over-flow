import type { CSSProperties } from "react";
import type { TrackStatus } from "../types";
import { metaOf, nextStatus } from "../domain/trackStatus";
import styles from "./StatusBadge.module.css";

interface Props {
  value: TrackStatus;
  /** 다음 상태로 변경. compact badge 클릭 시 nextStatus(value)가 전달된다. */
  onChange(next: TrackStatus): void;
}

/**
 * 트랙 행 1단(주 컨트롤)에 표시되는 1글자 색 배지.
 * 클릭하면 TRACK_STATUS_META 순서대로 다음 상태로 순환한다.
 * 풀 명칭으로 상태를 고르고 싶을 때는 2단의 <StatusButtons>를 사용한다.
 */
export function StatusBadge({ value, onChange }: Props) {
  const m = metaOf(value);
  const nextM = metaOf(nextStatus(value));
  return (
    <button
      type="button"
      className={styles.badge}
      style={{ "--tone": m.color } as CSSProperties}
      title={`${m.label} (클릭 → ${nextM.label})`}
      aria-label={`상태: ${m.label}. 클릭하면 ${nextM.label}로 바뀝니다.`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(nextStatus(value));
      }}
    >
      {m.letter}
    </button>
  );
}
