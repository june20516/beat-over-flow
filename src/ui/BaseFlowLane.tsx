import { useEffect, useRef, useState } from "react";
import { useViewport } from "../store/viewport";
import { seek } from "../audio/runtime";
import { xToTime } from "../timeline/viewportMath";
import { useLaneGesture } from "../input/useLaneGesture";
import { dragToRegion } from "../timeline/laneGesture";
import { useEditorUi } from "../store/editorUi";

interface BaseFlowLaneProps {
  peaks: Float32Array | null;
  durationMs: number;
}

const HEIGHT = 80;

export function BaseFlowLane({ peaks, durationMs }: BaseFlowLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);
  const setRegion = useEditorUi((s) => s.setRegion);
  const setSequencerOpen = useEditorUi((s) => s.setSequencerOpen);
  const [dragPx, setDragPx] = useState<{ a: number; b: number } | null>(null);
  // 캔버스 내부 해상도 = 콘텐츠 전체 폭(durationMs*pxPerMs). 화면엔 컨테이너 폭만.
  const contentWidth = Math.max(1, Math.round(durationMs * pxPerMs));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = contentWidth;
    ctx.clearRect(0, 0, w, HEIGHT);
    ctx.fillStyle = "#100c24";
    ctx.fillRect(0, 0, w, HEIGHT);
    if (peaks && peaks.length > 0) {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#a855f7");
      grad.addColorStop(1, "#ec4899");
      ctx.fillStyle = grad;
      const mid = HEIGHT / 2;
      const barW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const bh = peaks[i] * (HEIGHT - 8);
        ctx.fillRect(i * barW, mid - bh / 2, Math.max(1, barW - 1), bh);
      }
    }
  }, [peaks, contentWidth]);

  const vp = { pxPerMs, scrollLeftPx, containerWidthPx };
  const gesture = useLaneGesture({
    onClick: (x) => { if (durationMs > 0 && pxPerMs > 0) seek(xToTime(x, vp)); },
    onDragMove: (a, b) => setDragPx({ a, b }),
    onDragEnd: (a, b) => {
      setDragPx(null);
      if (pxPerMs <= 0) return;
      setRegion(dragToRegion(a, b, vp, durationMs));
      setSequencerOpen(true);
    },
  });

  return (
    <div
      className="base-flow-lane"
      {...gesture}
      style={{ position: "relative", width: "100%", height: HEIGHT, overflow: "hidden", cursor: "pointer" }}
    >
      <canvas
        ref={canvasRef}
        width={contentWidth}
        height={HEIGHT}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: contentWidth,
          height: HEIGHT,
          transform: `translateX(${-scrollLeftPx}px)`,
          display: "block",
        }}
      />
      {dragPx && (
        <div
          className="region-drag-overlay"
          style={{ left: Math.min(dragPx.a, dragPx.b), width: Math.abs(dragPx.b - dragPx.a) }}
        />
      )}
    </div>
  );
}
