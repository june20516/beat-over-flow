import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { xToTime, type Viewport } from "../timeline/viewportMath";
import {
  isMarkerEditingEnabled,
  visibleMarkers,
  findNearestMarker,
} from "../timeline/markerMath";
import { useLaneGesture } from "../input/useLaneGesture";
import { dragToRegion } from "../timeline/laneGesture";
import { useEditorUi } from "../store/editorUi";
import type { Track } from "../types";

interface MarkerEditorProps {
  track: Track;
  focused: boolean;
}

const HIT_TOLERANCE_PX = 8;
const OVERVIEW_HEIGHT = 28;

export function MarkerEditor({ track, focused }: MarkerEditorProps) {
  if (focused) return <FocusedMarkerEditor track={track} />;
  return <OverviewMarkerEditor track={track} />;
}

/** 포커스 트랙: 가상화 SVG. 좌클릭 추가 / 우클릭 삭제(레코드 동작에서만) / 드래그=구간 설정. */
function FocusedMarkerEditor({ track }: { track: Track }) {
  const mode = useStore((s) => s.mode);
  const addMarker = useStore((s) => s.addMarker);
  const removeMarker = useStore((s) => s.removeMarker);
  const durationMs = useStore((s) => s.project?.baseFlow.durationMs ?? 0);

  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const setRegion = useEditorUi((s) => s.setRegion);
  const setSequencerOpen = useEditorUi((s) => s.setSequencerOpen);

  const vp: Viewport = { pxPerMs, scrollLeftPx, containerWidthPx };
  const editable = isMarkerEditingEnabled(mode, track.status);
  const visible = visibleMarkers(track.markers, vp, containerWidthPx);

  const [dragPx, setDragPx] = useState<{ a: number; b: number } | null>(null);

  const gesture = useLaneGesture({
    onClick: (x) => { if (editable && pxPerMs > 0) addMarker(track.id, xToTime(x, vp)); },
    onContextClick: (x) => {
      if (!editable || pxPerMs <= 0) return;
      const timeMs = xToTime(x, vp);
      const hit = findNearestMarker(track.markers, timeMs, HIT_TOLERANCE_PX / pxPerMs);
      if (hit) removeMarker(track.id, hit.id);
    },
    onDragMove: (a, b) => setDragPx({ a, b }),
    onDragEnd: (a, b) => {
      setDragPx(null);
      if (pxPerMs <= 0) return;
      setRegion(dragToRegion(a, b, vp, durationMs));
      setSequencerOpen(true);
    },
  });

  return (
    <svg
      className={editable ? "marker-editor marker-editor--editable" : "marker-editor"}
      width={containerWidthPx}
      height="100%"
      style={{ "--track-color": track.color } as CSSProperties}
      {...gesture}
    >
      {dragPx && (
        <rect
          x={Math.min(dragPx.a, dragPx.b)}
          y={0}
          width={Math.abs(dragPx.b - dragPx.a)}
          height="100%"
          fill="rgba(168,85,247,0.22)"
          pointerEvents="none"
        />
      )}
      {visible.map(({ marker, x }) => (
        <circle key={marker.id} cx={x} cy="50%" r={5} fill={track.color} />
      ))}
    </svg>
  );
}

/** 언포커스 트랙: 캔버스 오버뷰(가는 틱). 편집 비활성. */
function OverviewMarkerEditor({ track }: { track: Track }) {
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const vp: Viewport = { pxPerMs, scrollLeftPx, containerWidthPx };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = track.color;
    for (const { x } of visibleMarkers(track.markers, vp, containerWidthPx)) {
      ctx.fillRect(x, 0, 1, canvas.height);
    }
  }, [track.markers, track.color, pxPerMs, scrollLeftPx, containerWidthPx]);

  return (
    <canvas
      ref={canvasRef}
      className="marker-editor marker-editor--overview"
      width={Math.max(1, Math.round(containerWidthPx))}
      height={OVERVIEW_HEIGHT}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
