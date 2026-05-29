import { create } from "zustand";
import type { BaseFlowRef, GlobalMode, Marker, Project, SoundRef, Track, TrackStatus } from "../types";
import { newId } from "../domain/ids";
import { resolveBaseFlowView } from "../domain/baseFlowView";
import { pickColor } from "../domain/palette";
import { emptyScore, type ScoreState } from "../scoring/scoring";
import { fillWithBuiltins, removeAssetFromRecents, seedRecentSounds, pushRecent } from "../domain/recentSounds";
import { clamp01 } from "../domain/math";

interface StoreState {
  project: Project | null;
  mode: GlobalMode;
  playing: boolean;
  playheadMs: number;
  selectedTrackId: string | null;
  score: ScoreState;
  baseFlowLoading: boolean;

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
  /** 트랙 sound 변경의 단일 진입점. MRU 큐(recentSounds)를 함께 갱신한다. */
  selectTrackSound: (trackId: string, sound: SoundRef) => void;
  setTrackKeyBinding: (trackId: string, key: string | null) => void;
  addMarker: (trackId: string, timeMs: number) => void;
  removeMarker: (trackId: string, markerId: string) => void;
  clearMarkers: (trackId: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void; // 범위 밖/동일이면 무시

  setSelectedTrack: (trackId: string | null) => void;
  toggleMarkerAt: (trackId: string, timeMs: number, toleranceMs: number) => void;
  removeMarkersInRange: (trackId: string, fromMs: number, toMs: number) => void;
  addMarkersBulk: (trackId: string, timesMs: number[]) => void;

  setScore: (score: ScoreState) => void;
  resetScore: () => void;

  setPlayPauseKey: (key: string | null) => void; // project.transport.playPauseKey 갱신

  setBaseFlow: (ref: BaseFlowRef) => void;
  setBaseFlowDurationMs: (ms: number) => void;
  setBaseFlowView: (patch: Partial<{ layout: "mini" | "ambient"; ambientIntensity: number }>) => void;
  setBaseFlowOffsetMs: (ms: number) => void;
  setBaseFlowLoading: (loading: boolean) => void;

  addAssetToLibrary: (assetId: string) => void;
  canDeleteAsset: (assetId: string) => { ok: true } | { ok: false; usedBy: Track[] };
  removeAssetFromLibrary: (assetId: string) => void;
}


/** 트랙 배열을 변환하며 project.updatedAt을 갱신하는 헬퍼. */
function mutate(
  s: StoreState,
  fn: (tracks: Track[]) => Track[],
): Partial<StoreState> {
  if (!s.project) return s;
  return { project: { ...s.project, tracks: fn(s.project.tracks), updatedAt: Date.now() } };
}

/** 배열을 복사해 from→to로 한 요소를 이동한다(불변). 인덱스 가정은 호출부에서 보장. */
function moveItem<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function mapTrack(tracks: Track[], id: string, fn: (t: Track) => Track): Track[] {
  return tracks.map((t) => (t.id === id ? fn(t) : t));
}

/** 트랙의 현재 sound가 주어진 assetId의 업로드 에셋인가. recents는 검사하지 않는다. */
function trackUsesAsset(t: Track, assetId: string): boolean {
  return t.sound.kind === "upload" && t.sound.assetId === assetId;
}

export const useStore = create<StoreState>((set, get) => ({
  project: null,
  mode: "listening",
  playing: false,
  playheadMs: 0,
  selectedTrackId: null,
  score: emptyScore(),
  baseFlowLoading: false,

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
      mutate(s, (tracks) => {
        const sound: SoundRef = { kind: "builtin", sampleId: "kick" };
        return [
          ...tracks,
          {
            id: newId(),
            name: `트랙 ${tracks.length + 1}`,
            status: "listening",
            sound,
            keyBinding: null,
            markers: [],
            volume: 1,
            color: pickColor(tracks.length),
            recentSounds: seedRecentSounds(sound),
          },
        ];
      }),
    ),

  removeTrack: (trackId) => set((s) => mutate(s, (tracks) => tracks.filter((t) => t.id !== trackId))),

  setTrackStatus: (trackId, status) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, status })))),

  setTrackName: (trackId, name) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, name })))),

  setTrackVolume: (trackId, v) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, volume: clamp01(v) })))),

  selectTrackSound: (trackId, sound) =>
    set((s) =>
      mutate(s, (tracks) =>
        mapTrack(tracks, trackId, (t) => ({
          ...t,
          sound,
          recentSounds: pushRecent(t.recentSounds, sound),
        })),
      ),
    ),

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

  clearMarkers: (trackId) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, markers: [] })))),

  reorderTracks: (fromIndex, toIndex) =>
    set((s) => {
      if (!s.project) return s;
      const len = s.project.tracks.length;
      const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < len;
      if (fromIndex === toIndex || !inRange(fromIndex) || !inRange(toIndex)) {
        return s;
      }
      return mutate(s, (tracks) => moveItem(tracks, fromIndex, toIndex));
    }),

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

  setScore: (score) => set({ score }),
  resetScore: () => set({ score: emptyScore() }),

  setPlayPauseKey: (key) =>
    set((s) =>
      s.project
        ? { project: { ...s.project, transport: { playPauseKey: key }, updatedAt: Date.now() } }
        : s,
    ),

  setBaseFlow: (ref) =>
    set((s) => (s.project ? { project: { ...s.project, baseFlow: ref, updatedAt: Date.now() } } : s)),

  setBaseFlowDurationMs: (ms) =>
    set((s) =>
      s.project
        ? { project: { ...s.project, baseFlow: { ...s.project.baseFlow, durationMs: ms }, updatedAt: Date.now() } }
        : s,
    ),

  setBaseFlowView: (patch) =>
    set((s) =>
      s.project
        ? {
            project: {
              ...s.project,
              baseFlowView: { ...resolveBaseFlowView(s.project.baseFlowView), ...patch },
              updatedAt: Date.now(),
            },
          }
        : s,
    ),

  setBaseFlowOffsetMs: (ms) =>
    set((s) => {
      if (!s.project || s.project.baseFlow.kind !== "youtube") return s;
      return {
        project: {
          ...s.project,
          baseFlow: { ...s.project.baseFlow, offsetMs: ms },
          updatedAt: Date.now(),
        },
      };
    }),

  setBaseFlowLoading: (loading) => set({ baseFlowLoading: loading }),

  addAssetToLibrary: (assetId) =>
    set((s) => {
      if (!s.project) return s;
      if (s.project.libraryAssetIds.includes(assetId)) return s;
      return {
        project: {
          ...s.project,
          libraryAssetIds: [...s.project.libraryAssetIds, assetId],
          updatedAt: Date.now(),
        },
      };
    }),

  canDeleteAsset: (assetId) => {
    const p = get().project;
    if (!p) return { ok: true };
    const usedBy = p.tracks.filter((t) => trackUsesAsset(t, assetId));
    return usedBy.length === 0 ? { ok: true } : { ok: false, usedBy };
  },

  removeAssetFromLibrary: (assetId) =>
    set((s) => {
      if (!s.project) return s;
      const usedBy = s.project.tracks.filter((t) => trackUsesAsset(t, assetId));
      if (usedBy.length > 0) return s;
      return {
        project: {
          ...s.project,
          libraryAssetIds: s.project.libraryAssetIds.filter((id) => id !== assetId),
          tracks: s.project.tracks.map((t) => ({
            ...t,
            recentSounds: fillWithBuiltins(removeAssetFromRecents(t.recentSounds, assetId)),
          })),
          updatedAt: Date.now(),
        },
      };
    }),
}));
