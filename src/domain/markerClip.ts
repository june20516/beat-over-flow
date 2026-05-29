import type { Marker } from "../types";

/**
 * 표시용 마커 클립. 마커 데이터(절대시간)는 보존하고, 베이스 플로우 길이를
 * 초과하는 마커만 렌더에서 제외한다. 소스 전환 시 짧은 소스로 바뀌어도
 * 데이터는 손상되지 않는다.
 */
export function clipMarkersForDisplay(markers: Marker[], durationMs: number): Marker[] {
  if (durationMs <= 0) return [];
  return markers.filter((m) => m.timeMs <= durationMs);
}
