import type { Project, SoundRef, Track, TrackStatus } from "../types";
import { newId } from "../domain/ids";
import { PALETTE } from "../domain/palette";
import { EXAMPLE_TRACK_MARKERS, EXAMPLE_DURATION_MS } from "./exampleData.generated";
import { seedRecentSounds } from "../domain/recentSounds";

export interface ExampleTrackBlueprint {
  name: string;
  status: TrackStatus;
  sound: SoundRef;
  keyBinding: string | null;
  volume: number;
  color: string;
  markersMs: number[];
}

export interface ExampleBlueprint {
  name: string;
  master: { volume: number };
  durationMs: number;
  tracks: ExampleTrackBlueprint[];
}

const SAMPLE_DEFS: { id: string; name: string; key: string }[] = [
  { id: "kick", name: "킥", key: "KeyS" },
  { id: "snare", name: "스네어", key: "KeyD" },
  { id: "hat", name: "하이햇", key: "KeyF" },
  { id: "clap", name: "클랩", key: "KeyJ" },
  { id: "tom", name: "톰", key: "KeyK" },
  { id: "perc", name: "퍼커션", key: "KeyL" },
];

export const EXAMPLE_BLUEPRINT: ExampleBlueprint = {
  name: "예제 프로젝트",
  master: { volume: 1 },
  durationMs: EXAMPLE_DURATION_MS,
  tracks: SAMPLE_DEFS.map((def, i) => ({
    name: def.name,
    status: "listening" as TrackStatus,
    sound: { kind: "builtin", sampleId: def.id },
    keyBinding: def.key,
    volume: 1,
    color: PALETTE[i % PALETTE.length],
    markersMs: EXAMPLE_TRACK_MARKERS[def.id] ?? [],
  })),
};

/** 청사진과 (생성된) 자산·길이로 새 id를 부여한 Project를 만든다. fetch/decode와 무관한 순수 함수. */
export function buildProjectFromBlueprint(
  blueprint: ExampleBlueprint,
  assetId: string,
  durationMs: number,
): Project {
  const now = Date.now();
  const tracks: Track[] = blueprint.tracks.map((t) => ({
    id: newId(),
    name: t.name,
    status: t.status,
    sound: t.sound,
    keyBinding: t.keyBinding,
    markers: t.markersMs.map((timeMs) => ({ id: newId(), timeMs })),
    volume: t.volume,
    color: t.color,
    recentSounds: seedRecentSounds(t.sound),
  }));
  return {
    id: newId(),
    name: blueprint.name,
    createdAt: now,
    updatedAt: now,
    baseFlow: { kind: "audioFile", assetId, durationMs },
    tracks,
    master: { volume: blueprint.master.volume },
    transport: { playPauseKey: null },
    libraryAssetIds: [],
  };
}
