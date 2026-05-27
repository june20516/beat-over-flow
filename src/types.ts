export type TrackStatus = "mute" | "listening" | "play" | "write";
export type GlobalMode = "listening" | "play" | "record";

export type BaseFlowRef = { kind: "audioFile"; assetId: string; durationMs: number };

export type SoundRef =
  | { kind: "builtin"; sampleId: string }
  | { kind: "upload"; assetId: string };

export interface Marker {
  id: string;
  timeMs: number;
}

export interface Track {
  id: string;
  name: string;
  status: TrackStatus;
  sound: SoundRef;
  keyBinding: string | null;
  markers: Marker[];
  volume: number; // 0..1
  color: string; // CSS color
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  baseFlow: BaseFlowRef;
  tracks: Track[];
  master: { volume: number }; // 0..1
  transport?: { playPauseKey: string | null }; // 신규(영속). 기존 저장본엔 없을 수 있어 optional. 읽을 때 ?? null.
}
