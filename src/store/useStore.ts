import { create } from "zustand";
import type { GlobalMode, Marker, Project, SoundRef, Track, TrackStatus } from "../types";
import { newId } from "../domain/ids";
import { pickColor } from "../domain/palette";

interface StoreState {
  project: Project | null;
  mode: GlobalMode;
  playing: boolean;
  playheadMs: number;
  selectedTrackId: string | null;

  setProject: (project: Project | null) => void;
  renameProject: (name: string) => void;
  setMasterVolume: (v: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlayheadMs: (ms: number) => void;
  setMode: (mode: GlobalMode) => void;

  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  setTrackStatus: (trackId: string, status: TrackStatus) => void;
  setTrackName: (trackId: string, name: string) => void;
  setTrackVolume: (trackId: string, v: number) => void;
  setTrackSound: (trackId: string, sound: SoundRef) => void;
  setTrackKeyBinding: (trackId: string, key: string | null) => void;
  addMarker: (trackId: string, timeMs: number) => void;
  removeMarker: (trackId: string, markerId: string) => void;

  setSelectedTrack: (trackId: string | null) => void;
  toggleMarkerAt: (trackId: string, timeMs: number, toleranceMs: number) => void;
  removeMarkersInRange: (trackId: string, fromMs: number, toMs: number) => void;
  addMarkersBulk: (trackId: string, timesMs: number[]) => void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 트랙 배열을 변환하며 project.updatedAt을 갱신하는 헬퍼. */
function mutate(
  s: StoreState,
  fn: (tracks: Track[]) => Track[],
): Partial<StoreState> {
  if (!s.project) return s;
  return { project: { ...s.project, tracks: fn(s.project.tracks), updatedAt: Date.now() } };
}

function mapTrack(tracks: Track[], id: string, fn: (t: Track) => Track): Track[] {
  return tracks.map((t) => (t.id === id ? fn(t) : t));
}

export const useStore = create<StoreState>((set) => ({
  project: null,
  mode: "listening",
  playing: false,
  playheadMs: 0,
  selectedTrackId: null,

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
  setMode: (mode) => set({ mode }),

  addTrack: () =>
    set((s) =>
      mutate(s, (tracks) => [
        ...tracks,
        {
          id: newId(),
          name: `트랙 ${tracks.length + 1}`,
          status: "listening",
          sound: { kind: "builtin", sampleId: "kick" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: pickColor(tracks.length),
        },
      ]),
    ),

  removeTrack: (trackId) => set((s) => mutate(s, (tracks) => tracks.filter((t) => t.id !== trackId))),

  setTrackStatus: (trackId, status) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, status })))),

  setTrackName: (trackId, name) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, name })))),

  setTrackVolume: (trackId, v) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, volume: clamp01(v) })))),

  setTrackSound: (trackId, sound) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, sound })))),

  setTrackKeyBinding: (trackId, key) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, keyBinding: key })))),

  addMarker: (trackId, timeMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => {
          const marker: Marker = { id: newId(), timeMs };
          const markers = [...t.markers, marker].sort((a, b) => a.timeMs - b.timeMs);
          return { ...t, markers };
        }),
      ),
    ),

  removeMarker: (trackId, markerId) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => ({
          ...t,
          markers: t.markers.filter((m) => m.id !== markerId),
        })),
      ),
    ),

  setSelectedTrack: (trackId) => set({ selectedTrackId: trackId }),

  toggleMarkerAt: (trackId, timeMs, toleranceMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => {
          const hit = t.markers.find((m) => Math.abs(m.timeMs - timeMs) <= toleranceMs);
          if (hit) {
            return { ...t, markers: t.markers.filter((m) => m.id !== hit.id) };
          }
          const markers = [...t.markers, { id: newId(), timeMs }].sort((a, b) => a.timeMs - b.timeMs);
          return { ...t, markers };
        }),
      ),
    ),

  removeMarkersInRange: (trackId, fromMs, toMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => ({
          ...t,
          markers: t.markers.filter((m) => m.timeMs < fromMs || m.timeMs > toMs),
        })),
      ),
    ),

  addMarkersBulk: (trackId, timesMs) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => {
          const added = timesMs.map((timeMs) => ({ id: newId(), timeMs }));
          const markers = [...t.markers, ...added].sort((a, b) => a.timeMs - b.timeMs);
          return { ...t, markers };
        }),
      ),
    ),
}));
