import { useViewport } from "../store/viewport";
import { seek } from "../audio/runtime";
import { xToTime } from "../timeline/viewportMath";
import { useLaneGesture } from "../input/useLaneGesture";
import { dragToRegion } from "../timeline/laneGesture";
import { useEditorUi } from "../store/editorUi";
import { useSequencerActive } from "../input/useSequencerActive";
import { RegionOverlay } from "./RegionOverlay";

interface Props {
  durationMs: number;
}

const HEIGHT = 80;

/** 유튜브 베이스 플로우용 진행바 레인(파형 없음). 클릭=seek, 드래그=region. */
export function ProgressBarLane({ durationMs }: Props) {
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);
  const setRegion = useEditorUi((s) => s.setRegion);
  const sequencerActive = useSequencerActive();
  const vp = { pxPerMs, scrollLeftPx, containerWidthPx };

  const gesture = useLaneGesture({
    onClick: (x) => {
      if (durationMs > 0 && pxPerMs > 0) seek(xToTime(x, vp));
    },
    onDragMove: (a, b) => {
      if (sequencerActive && pxPerMs > 0) setRegion(dragToRegion(a, b, vp, durationMs));
    },
    onDragEnd: (a, b) => {
      if (sequencerActive && pxPerMs > 0) setRegion(dragToRegion(a, b, vp, durationMs));
    },
  });

  return (
    <div
      {...gesture}
      data-base-flow-lane
      style={{
        position: "relative",
        width: "100%",
        height: HEIGHT,
        overflow: "hidden",
        cursor: "pointer",
        background: "linear-gradient(180deg,#13102b,#0d0a1f)",
        borderBottom: "1px solid #2a2a44",
      }}
    >
      {sequencerActive && <RegionOverlay />}
    </div>
  );
}
