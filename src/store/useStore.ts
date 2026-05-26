import { create } from "zustand";
import type { Project } from "../types";

interface StoreState {
  project: Project | null;
  playing: boolean;
  playheadMs: number;

  setProject: (project: Project | null) => void;
  renameProject: (name: string) => void;
  setMasterVolume: (v: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlayheadMs: (ms: number) => void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export const useStore = create<StoreState>((set) => ({
  project: null,
  playing: false,
  playheadMs: 0,

  setProject: (project) => set({ project }),

  renameProject: (name) =>
    set((s) => (s.project ? { project: { ...s.project, name, updatedAt: Date.now() } } : s)),

  setMasterVolume: (v) =>
    set((s) =>
      s.project
        ? { project: { ...s.project, master: { volume: clamp01(v) }, updatedAt: Date.now() } }
        : s,
    ),

  setPlaying: (playing) => set({ playing }),
  setPlayheadMs: (ms) => set({ playheadMs: ms }),
}));
