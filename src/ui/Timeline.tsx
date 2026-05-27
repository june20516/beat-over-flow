import { useEffect, useRef } from "react";
import { Plus } from "@phosphor-icons/react";
import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { BaseFlowLane } from "./BaseFlowLane";
import { PlayheadOverlay } from "./PlayheadOverlay";
import { TrackRow } from "./TrackRow";

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

  const tracks = useStore((s) => s.project?.tracks ?? []);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const addTrack = useStore((s) => s.addTrack);

  // 프로젝트 길이 반영
  useEffect(() => {
    setDuration(durationMs);
  }, [durationMs, setDuration]);

  // 우측 arrange 폭 측정(모든 레인의 가시 폭 = containerWidthPx)
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

  // wheel은 non-passive로 등록해야 preventDefault로 페이지 스크롤을 막을 수 있다
  // (React onWheel은 passive라 preventDefault가 무시됨).
  useEffect(() => {
    const el = arrangeRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        const rect = el.getBoundingClientRect();
        const anchorX = e.clientX - rect.left;
        // 위로 스크롤(deltaY<0)=확대(factor>1)
        const factor = Math.pow(ZOOM_IN_FACTOR, -e.deltaY);
        zoomAt(factor, anchorX);
      } else {
        // 가로 휠(deltaX) 우선, 없으면 deltaY로 가로 팬
        const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        panByPx(dx);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [panByPx, zoomAt]);

  return (
    <div className="timeline">
      {/* 헤더 행: 좌측 고정 컬럼(트랙 헤더) | 우측 arrange(베이스 파형 + 플레이헤드) */}
      <div className="timeline__header-row">
        <div className="timeline__fixed-col">
          <div className="timeline__head">
            <h2 className="section-title">트랙</h2>
            <button className="btn--primary" onClick={addTrack}>
              <Plus size={15} weight="bold" />
              트랙
            </button>
          </div>
        </div>
        <div
          ref={arrangeRef}
          className="timeline__arrange"
          style={{ position: "relative", flex: 1, overflow: "hidden" }}
        >
          <BaseFlowLane peaks={peaks} durationMs={durationMs} />
          <PlayheadOverlay />
        </div>
      </div>

      {/* 트랙 행들: 좌측 TrackEditor | 우측 MarkerEditor가 한 행 안에서 세로 정렬 */}
      <div className="timeline__rows">
        {tracks.map((t, index) => (
          <TrackRow
            key={t.id}
            track={t}
            index={index}
            focused={selectedTrackId === t.id}
          />
        ))}
      </div>
    </div>
  );
}
