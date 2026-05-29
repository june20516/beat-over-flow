import { create } from "zustand";

export type OverlayMode = "indeterminate" | "determinate";

interface LoadingOverlayState {
  open: boolean;
  mode: OverlayMode;
  progress?: number; // 0..1
  label?: string;
  show: (opts: { mode: OverlayMode; label?: string }) => void;
  setProgress: (p: number) => void;
  hide: () => void;
}

function clamp01(p: number): number {
  return Math.max(0, Math.min(1, p));
}

export const useLoadingOverlay = create<LoadingOverlayState>((set) => ({
  open: false,
  mode: "indeterminate",
  progress: undefined,
  label: undefined,
  show: ({ mode, label }) =>
    set({ open: true, mode, label, progress: mode === "determinate" ? 0 : undefined }),
  setProgress: (p) => set({ progress: clamp01(p) }),
  hide: () => set({ open: false, progress: undefined, label: undefined }),
}));
