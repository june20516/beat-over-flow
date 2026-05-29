import { create } from "zustand";
import { clamp01 } from "../domain/math";

export type OverlayMode = "indeterminate" | "determinate";

interface LoadingOverlayState {
  open: boolean;
  mode: OverlayMode;
  /** 0..1. undefined = "값 없음"(indeterminate 모드). 0과 의도적으로 구분한다. */
  progress?: number;
  label?: string;
  show: (opts: { mode: OverlayMode; label?: string }) => void;
  setProgress: (p: number) => void;
  hide: () => void;
}

export const useLoadingOverlay = create<LoadingOverlayState>((set) => ({
  open: false,
  mode: "indeterminate",
  progress: undefined,
  label: undefined,
  show: ({ mode, label }) =>
    set({ open: true, mode, label, progress: mode === "determinate" ? 0 : undefined }),
  // indeterminate 모드에선 progress를 무시 — "값 없음" 불변량 유지.
  setProgress: (p) => set((s) => (s.mode === "determinate" ? { progress: clamp01(p) } : {})),
  hide: () => set({ open: false, progress: undefined, label: undefined }),
}));
