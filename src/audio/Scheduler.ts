import type { Track } from "../types";

export interface DueMarker {
  trackId: string;
  marker: { id: string; timeMs: number };
}

/** (fromMs, toMs] 구간에 속한 모든 트랙의 마커를 모은다. */
export function markersInWindow(tracks: Track[], fromMs: number, toMs: number): DueMarker[] {
  const due: DueMarker[] = [];
  for (const t of tracks) {
    for (const m of t.markers) {
      if (m.timeMs > fromMs && m.timeMs <= toMs) {
        due.push({ trackId: t.id, marker: m });
      }
    }
  }
  return due;
}

/** 미래 마커의 AudioContext 예약 시각(초). */
export function ctxTimeForMarker(nowCtxSec: number, markerMs: number, nowMs: number): number {
  return nowCtxSec + (markerMs - nowMs) / 1000;
}
