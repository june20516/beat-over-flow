import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { classifyPointerSequence } from "../timeline/laneGesture";

const DRAG_THRESHOLD_PX = 5;

export interface LaneGestureHandlers {
  onClick?: (localX: number) => void;
  onContextClick?: (localX: number) => void;
  onDragMove?: (startX: number, endX: number) => void;
  onDragEnd?: (startX: number, endX: number) => void;
}

/** 레인 요소에 스프레드할 포인터 핸들러를 반환. */
export function useLaneGesture(handlers: LaneGestureHandlers) {
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  function localX(e: { clientX: number; currentTarget: Element }): number {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left;
  }

  function onPointerDown(e: ReactPointerEvent<Element>) {
    if (e.button !== 0) return;
    startXRef.current = localX(e);
    draggingRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<Element>) {
    if (startXRef.current === null) return;
    const x = localX(e);
    if (!draggingRef.current && classifyPointerSequence(startXRef.current, x, DRAG_THRESHOLD_PX) === "drag") {
      draggingRef.current = true;
    }
    if (draggingRef.current) handlers.onDragMove?.(startXRef.current, x);
  }

  function onPointerUp(e: ReactPointerEvent<Element>) {
    if (startXRef.current === null) return;
    const x = localX(e);
    if (draggingRef.current) handlers.onDragEnd?.(startXRef.current, x);
    else handlers.onClick?.(x);
    startXRef.current = null;
    draggingRef.current = false;
  }

  function onContextMenu(e: ReactMouseEvent<Element>) {
    e.preventDefault();
    handlers.onContextClick?.(localX(e));
  }

  return { onPointerDown, onPointerMove, onPointerUp, onContextMenu };
}
