import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Plus } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import primitives from "./primitives.module.css";
import styles from "./Timeline.module.css";
import { cx } from "./cx";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { resolveWheelIntent } from "../timeline/wheelIntent";
import { BaseFlowLane } from "./BaseFlowLane";
import { PlayheadOverlay } from "./PlayheadOverlay";
import { TrackRow } from "./TrackRow";

interface TimelineProps {
  peaks: Float32Array | null;
  durationMs: number;
}

const ZOOM_IN_FACTOR = 1.0015; // wheel 1deltaY당 줌 배율(부드럽게)

export function Timeline({ peaks, durationMs }: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const arrangeRef = useRef<HTMLDivElement>(null);
  const setContainerWidth = useViewport((s) => s.setContainerWidth);
  const setDuration = useViewport((s) => s.setDuration);
  const panByPx = useViewport((s) => s.panByPx);
  const zoomAt = useViewport((s) => s.zoomAt);

  const tracks = useStore((s) => s.project?.tracks ?? []);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const addTrack = useStore((s) => s.addTrack);
  const reorderTracks = useStore((s) => s.reorderTracks);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // 작은 이동(8px)부터 드래그로 인식 → 핸들 클릭과 드래그 구분, 오작동 방지
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }
    const from = tracks.findIndex((t) => t.id === active.id);
    const to = tracks.findIndex((t) => t.id === over.id);
    if (from === -1 || to === -1) {
      setActiveId(null);
      return;
    }
    reorderTracks(from, to);
    setActiveId(null);
  }

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
  // 타임라인 전체 영역에서 휠을 받되, 좌측 고정 컬럼(헤더/에디터)은 제외.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest(".timeline__fixed-col, .track-row__editor")) return;
      const arrange = arrangeRef.current;
      if (!arrange) return;
      const intent = resolveWheelIntent(e);
      if (intent.kind === "none") return;
      e.preventDefault();
      const rect = arrange.getBoundingClientRect();
      const anchorX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      if (intent.kind === "zoom") {
        zoomAt(Math.pow(ZOOM_IN_FACTOR, -intent.amount), anchorX);
      } else {
        panByPx(intent.amount);
      }
    };
    const el = timelineRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [panByPx, zoomAt]);

  return (
    <div ref={timelineRef} className={styles.timeline}>
      {/* 헤더 행: 좌측 고정 컬럼(트랙 헤더) | 우측 arrange(베이스 파형 + 플레이헤드) */}
      <div className={styles.headerRow}>
        <div className={styles.fixedCol}>
          <div className={styles.head}>
            <h2 className={cx(primitives.sectionTitle, styles.headTitle)}>트랙</h2>
            <button className={cx(controls.btn, controls.btnPrimary)} onClick={addTrack}>
              <Plus size={15} weight="bold" />
              트랙
            </button>
          </div>
        </div>
        <div
          ref={arrangeRef}
          style={{ position: "relative", flex: 1, overflow: "hidden" }}
        >
          <BaseFlowLane peaks={peaks} durationMs={durationMs} />
          <PlayheadOverlay />
        </div>
      </div>

      {/* 트랙 행들: 드래그 정렬(좌측 핸들) + 좌/우 2컬럼 세로 정렬 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext
          items={tracks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={styles.rows}>
            {tracks.map((t, index) => (
              <TrackRow
                key={t.id}
                track={t}
                index={index}
                focused={selectedTrackId === t.id}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId
            ? (() => {
                const t = tracks.find((x) => x.id === activeId);
                return t ? (
                  <div className={styles.trackDragOverlay} style={{ "--track-color": t.color } as CSSProperties}>
                    {t.name}
                  </div>
                ) : null;
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
