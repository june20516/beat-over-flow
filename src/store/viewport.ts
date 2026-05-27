import { create } from "zustand";
import {
  clampPxPerMs,
  clampScrollLeftPx,
  centeredScrollLeftPx,
  minPxPerMs,
  zoomedViewport,
  type Viewport,
} from "../timeline/viewportMath";

interface ViewportState {
  pxPerMs: number;
  scrollLeftPx: number;
  containerWidthPx: number;
  durationMs: number;
  followPlayhead: boolean;
  setContainerWidth: (px: number) => void;
  setDuration: (ms: number) => void;
  fitAll: () => void;
  panByPx: (dx: number) => void;
  zoomAt: (factor: number, anchorX: number) => void;
  setFollowPlayhead: (b: boolean) => void;
  followTo: (timeMs: number) => void;
}

/** 현재 스토어 상태에서 Viewport(순수타입)를 추출. */
function toVp(s: ViewportState): Viewport {
  return {
    pxPerMs: s.pxPerMs,
    scrollLeftPx: s.scrollLeftPx,
    containerWidthPx: s.containerWidthPx,
  };
}

export const useViewport = create<ViewportState>((set) => ({
  pxPerMs: 0,
  scrollLeftPx: 0,
  containerWidthPx: 1,
  durationMs: 0,
  followPlayhead: true,

  setContainerWidth: (px) =>
    set((s) => {
      const containerWidthPx = Math.max(1, px);
      const pxPerMs = clampPxPerMs(s.pxPerMs, containerWidthPx, s.durationMs);
      const next = { ...s, containerWidthPx, pxPerMs };
      const scrollLeftPx = clampScrollLeftPx(s.scrollLeftPx, toVp(next), s.durationMs);
      return { containerWidthPx, pxPerMs, scrollLeftPx };
    }),

  setDuration: (ms) =>
    set((s) => {
      const durationMs = Math.max(0, ms);
      const pxPerMs = clampPxPerMs(s.pxPerMs, s.containerWidthPx, durationMs);
      const next = { ...s, durationMs, pxPerMs };
      const scrollLeftPx = clampScrollLeftPx(s.scrollLeftPx, toVp(next), durationMs);
      return { durationMs, pxPerMs, scrollLeftPx };
    }),

  fitAll: () =>
    set((s) => ({
      pxPerMs: minPxPerMs(s.containerWidthPx, s.durationMs),
      scrollLeftPx: 0,
    })),

  panByPx: (dx) =>
    set((s) => ({
      scrollLeftPx: clampScrollLeftPx(s.scrollLeftPx + dx, toVp(s), s.durationMs),
      followPlayhead: false,
    })),

  zoomAt: (factor, anchorX) =>
    set((s) => {
      const z = zoomedViewport(toVp(s), s.durationMs, factor, anchorX);
      return { pxPerMs: z.pxPerMs, scrollLeftPx: z.scrollLeftPx };
    }),

  setFollowPlayhead: (b) => set({ followPlayhead: b }),

  followTo: (timeMs) =>
    set((s) => {
      if (!s.followPlayhead) return s;
      const next = centeredScrollLeftPx(timeMs, toVp(s), s.durationMs);
      return next === s.scrollLeftPx ? s : { scrollLeftPx: next };
    }),
}));
