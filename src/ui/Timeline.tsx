import { useEffect, useRef } from "react";
import { useViewport } from "../store/viewport";
import { BaseFlowLane } from "./BaseFlowLane";
import { PlayheadOverlay } from "./PlayheadOverlay";

interface TimelineProps {
  peaks: Float32Array | null;
  durationMs: number;
}

const ZOOM_IN_FACTOR = 1.0015; // wheel 1deltaY당 줌 배율(부드럽게)

export function Timeline({ peaks, durationMs }: TimelineProps) {
  const arrangeRef = useRef<HTMLDivElement>(null);
  const setContainerWidth = useViewport((s) => s.setContainerWidth);
  const setDuration = useViewport((s) => s.setDuration);
  const panByPx = useViewport((s) => s.panByPx);
  const zoomAt = useViewport((s) => s.zoomAt);

  // 프로젝트 길이 반영
  useEffect(() => {
    setDuration(durationMs);
  }, [durationMs, setDuration]);

  // 우측 arrange 폭 측정
  useEffect(() => {
    const el = arrangeRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setContainerWidth]);

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.shiftKey) {
      const rect = e.currentTarget.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      // 위로 스크롤(deltaY<0)=확대(factor>1)
      const factor = Math.pow(ZOOM_IN_FACTOR, -e.deltaY);
      zoomAt(factor, anchorX);
    } else {
      // 가로 휠(deltaX) 우선, 없으면 deltaY로 가로 팬
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      panByPx(dx);
    }
  }

  return (
    <div className="timeline">
      <div className="timeline__fixed-col">
        {/* 헤더 슬롯: 좌측 고정 컬럼(트랙 에디터 컬럼)은 계획 2에서 채운다. */}
      </div>
      <div
        ref={arrangeRef}
        className="timeline__arrange"
        onWheel={handleWheel}
        style={{ position: "relative", flex: 1, overflow: "hidden" }}
      >
        <BaseFlowLane peaks={peaks} durationMs={durationMs} />
        {/* 트랙 레인 영역 stub — 계획 2에서 TrackRow[]로 채운다. */}
        <div className="timeline__tracks-stub" />
        <PlayheadOverlay />
      </div>
    </div>
  );
}
