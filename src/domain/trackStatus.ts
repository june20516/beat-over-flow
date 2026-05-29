import type { TrackStatus } from "../types";

export interface TrackStatusMeta {
  status: TrackStatus;
  letter: string;
  label: string;
  /** 활성 시 사용되는 토큰 색. */
  color: string;
}

/**
 * UI에 노출되는 트랙 상태 순서. compact badge 클릭 시 이 순서로 순환한다.
 * 의도적 순서: 비활성 → 듣기 → 연주 → 기록.
 */
export const TRACK_STATUS_META: TrackStatusMeta[] = [
  { status: "mute", letter: "M", label: "뮤트", color: "#6b7280" },
  { status: "listening", letter: "L", label: "리스닝", color: "#22d3ee" },
  { status: "play", letter: "P", label: "플레이", color: "#4ade80" },
  { status: "record", letter: "R", label: "레코드", color: "#ec4899" },
];

export function metaOf(s: TrackStatus): TrackStatusMeta {
  const m = TRACK_STATUS_META.find((x) => x.status === s);
  if (!m) throw new Error(`unknown TrackStatus: ${s}`);
  return m;
}

/** TRACK_STATUS_META 순서대로 다음 상태를 반환. 마지막이면 처음으로 순환. */
export function nextStatus(s: TrackStatus): TrackStatus {
  const i = TRACK_STATUS_META.findIndex((x) => x.status === s);
  return TRACK_STATUS_META[(i + 1) % TRACK_STATUS_META.length].status;
}
