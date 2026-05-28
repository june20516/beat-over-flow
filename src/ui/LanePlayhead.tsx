import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { timeToX } from "../timeline/viewportMath";

/** 레인 위 시안 세로 플레이헤드 선(부모 position:relative 기준). */
export function LanePlayhead() {
  const playheadMs = useStore((s) => s.playheadMs);
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const x = timeToX(playheadMs, { pxPerMs, scrollLeftPx, containerWidthPx });
  if (x < 0 || x > containerWidthPx) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: x,
        width: 2,
        background: "#22d3ee",
        boxShadow: "0 0 8px #22d3ee",
        pointerEvents: "none",
        zIndex: 4,
      }}
    />
  );
}
