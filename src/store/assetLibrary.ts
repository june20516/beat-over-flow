import { create } from "zustand";

export type AssetLibraryMode = "manage" | "select";

interface AssetLibraryState {
  open: boolean;
  mode: AssetLibraryMode;
  targetTrackId: string | null;
  openManage(): void;
  openSelect(trackId: string): void;
  close(): void;
}

export const useAssetLibrary = create<AssetLibraryState>((set) => ({
  open: false,
  mode: "manage",
  targetTrackId: null,
  openManage: () => set({ open: true, mode: "manage", targetTrackId: null }),
  openSelect: (trackId) => set({ open: true, mode: "select", targetTrackId: trackId }),
  close: () => set({ open: false, targetTrackId: null }),
}));
