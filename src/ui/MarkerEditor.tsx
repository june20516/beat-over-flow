import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./MarkerEditor.module.css";
import { cx } from "./cx";
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
import { clipMarkersForDisplay } from "../domain/markerClip";
import type { Track } from "../types";
import { LanePlayhead } from "./LanePlayhead";
import { RegionOverlay } from "./RegionOverlay";
import { resolveTrackBehavior } from "../domain/mode";

interface MarkerEditorProps {
  track: Track;
  focused: boolean;
}

const HIT_TOLERANCE_PX = 8;
const OVERVIEW_HEIGHT = 28;

export function MarkerEditor({ track, focused }: MarkerEditorProps) {
  const mode = useStore((s) => s.mode);
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const showPlayhead = mode === "play" && resolveTrackBehavior("play", track.status) === "perform";
  const showRegion = focused && sequencerOpen && resolveTrackBehavior(mode, track.status) === "record";
  return (
    <>
      {focused ? <FocusedMarkerEditor track={track} /> : <OverviewMarkerEditor track={track} />}
      {showRegion && <RegionOverlay />}
      {showPlayhead && <LanePlayhead />}
    </>
  );
}

/** 포커스 트랙: 가상화 SVG. 좌클릭 추가 / 우클릭 삭제(레코드 동작에서만) / 드래그=구간(시퀀서 활성 시). */
function FocusedMarkerEditor({ track }: { track: Track }) {
  const mode = useStore((s) => s.mode);
  const addMarker = useStore((s) => s.addMarker);
  const removeMarker = useStore((s) => s.removeMarker);
  const durationMs = useStore((s) => s.project?.baseFlow.durationMs ?? 0);

  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const setRegion = useEditorUi((s) => s.setRegion);
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);

  const vp: Viewport = { pxPerMs, scrollLeftPx, containerWidthPx };
  const editable = isMarkerEditingEnabled(mode, track.status);
  const sequencerActive = sequencerOpen && editable;
  const visible = visibleMarkers(clipMarkersForDisplay(track.markers, durationMs), vp, containerWidthPx);

  const gesture = useLaneGesture({
    onClick: (x) => {
      if (editable && pxPerMs > 0) addMarker(track.id, xToTime(x, vp));
    },
    onContextClick: (x) => {
      if (!editable || pxPerMs <= 0) return;
      const timeMs = xToTime(x, vp);
      const hit = findNearestMarker(track.markers, timeMs, HIT_TOLERANCE_PX / pxPerMs);
      if (hit) removeMarker(track.id, hit.id);
    },
    onDragMove: (a, b) => {
      if (sequencerActive && pxPerMs > 0) setRegion(dragToRegion(a, b, vp, durationMs));
    },
    onDragEnd: (a, b) => {
      if (sequencerActive && pxPerMs > 0) setRegion(dragToRegion(a, b, vp, durationMs));
    },
  });

  return (
    <svg
      className={cx(styles.markerEditor, editable && styles.editable)}
      width={containerWidthPx}
      height="100%"
      style={{ "--track-color": track.color } as CSSProperties}
      {...gesture}
    >
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
  const durationMs = useStore((s) => s.project?.baseFlow.durationMs ?? 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const vp: Viewport = { pxPerMs, scrollLeftPx, containerWidthPx };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = track.color;
    for (const { x } of visibleMarkers(clipMarkersForDisplay(track.markers, durationMs), vp, containerWidthPx)) {
      ctx.fillRect(x, 0, 1, canvas.height);
    }
  }, [track.markers, track.color, pxPerMs, scrollLeftPx, containerWidthPx, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className={cx(styles.markerEditor, styles.overview)}
      width={Math.max(1, Math.round(containerWidthPx))}
      height={OVERVIEW_HEIGHT}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
