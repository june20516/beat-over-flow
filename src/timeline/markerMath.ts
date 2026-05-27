import type { GlobalMode, Marker, TrackStatus } from "../types";
import { resolveTrackBehavior } from "../domain/mode";
import { timeToX, type Viewport } from "./viewportMath";

/** 마커 편집(좌/우클릭)은 레코드 동작(레코드 모드 + write 트랙)일 때만 활성. */
export function isMarkerEditingEnabled(mode: GlobalMode, status: TrackStatus): boolean {
  return resolveTrackBehavior(mode, status) === "record";
}

export interface VisibleMarker {
  marker: Marker;
  x: number;
}

/** timeToX가 [0, widthPx] 범위(경계 포함)인 마커만 화면 x좌표와 함께 반환(가상화). */
export function visibleMarkers(
  markers: Marker[],
  vp: Viewport,
  widthPx: number,
): VisibleMarker[] {
  const result: VisibleMarker[] = [];
  for (const marker of markers) {
    const x = timeToX(marker.timeMs, vp);
    if (x >= 0 && x <= widthPx) result.push({ marker, x });
  }
  return result;
}

/** tolerance(ms) 이내에서 timeMs에 가장 가까운 마커. 없으면 null(우클릭 삭제 대상). */
export function findNearestMarker(
  markers: Marker[],
  timeMs: number,
  toleranceMs: number,
): Marker | null {
  let best: Marker | null = null;
  let bestDist = Infinity;
  for (const m of markers) {
    const dist = Math.abs(m.timeMs - timeMs);
    if (dist <= toleranceMs && dist < bestDist) {
      best = m;
      bestDist = dist;
    }
  }
  return best;
}
