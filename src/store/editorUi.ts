import { create } from "zustand";

export interface EditorUiRegion {
  startMs: number;
  endMs: number;
}

interface EditorUiState {
  sequencerOpen: boolean;
  region: EditorUiRegion;
  stepCount: number;
  toggleSequencer: () => void;
  setSequencerOpen: (b: boolean) => void;
  setRegion: (r: EditorUiRegion) => void;
  setStepCount: (n: number) => void;
  resetForTrack: () => void;
}

const DEFAULT_REGION: EditorUiRegion = { startMs: 0, endMs: 4000 };
const DEFAULT_STEP_COUNT = 8;

export const useEditorUi = create<EditorUiState>((set) => ({
  sequencerOpen: false,
  region: DEFAULT_REGION,
  stepCount: DEFAULT_STEP_COUNT,
  toggleSequencer: () => set((s) => ({ sequencerOpen: !s.sequencerOpen })),
  setSequencerOpen: (b) => set({ sequencerOpen: b }),
  setRegion: (r) => set({ region: r }),
  setStepCount: (n) => set({ stepCount: Math.max(1, n) }),
  resetForTrack: () => set({ region: DEFAULT_REGION, stepCount: DEFAULT_STEP_COUNT }),
}));
