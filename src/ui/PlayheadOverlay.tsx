import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { timeToX } from "../timeline/viewportMath";

export function PlayheadOverlay() {
  const playheadMs = useStore((s) => s.playheadMs);
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const x = timeToX(playheadMs, { pxPerMs, scrollLeftPx, containerWidthPx });
  const visible = x >= 0 && x <= containerWidthPx;

  return (
    <div
      className="playhead-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {visible && (
        <div
          className="playhead-overlay__line"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: x,
            width: 2,
            background: "#22d3ee",
            boxShadow: "0 0 8px #22d3ee",
          }}
        />
      )}
    </div>
  );
}
