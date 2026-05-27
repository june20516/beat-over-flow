import { useEditorUi } from "../store/editorUi";
import { useViewport } from "../store/viewport";
import { timeToX } from "../timeline/viewportMath";

/** 시퀀서 구간(editorUi.region)을 레인 위 반투명 밴드로 표시. 부모는 position:relative 여야 한다. */
export function RegionOverlay() {
  const region = useEditorUi((s) => s.region);
  const pxPerMs = useViewport((s) => s.pxPerMs);
  const scrollLeftPx = useViewport((s) => s.scrollLeftPx);
  const containerWidthPx = useViewport((s) => s.containerWidthPx);

  const vp = { pxPerMs, scrollLeftPx, containerWidthPx };
  const x1 = timeToX(region.startMs, vp);
  const x2 = timeToX(region.endMs, vp);
  const left = Math.max(0, Math.min(x1, x2));
  const right = Math.min(containerWidthPx, Math.max(x1, x2));
  if (right <= 0 || left >= containerWidthPx || right <= left) return null;

  return <div className="region-overlay" style={{ left, width: right - left }} />;
}
