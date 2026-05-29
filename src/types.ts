export type TrackStatus = "mute" | "listening" | "play" | "record";
export type GlobalMode = "listening" | "play" | "record";

export type BaseFlowRef =
  | { kind: "audioFile"; assetId: string; durationMs: number }
  | { kind: "youtube"; videoId: string; durationMs: number; startMs?: number; offsetMs?: number };

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
  /** 트랙 스코프 MRU 큐. recentSounds[0] === sound 불변량. 최대 6. */
  recentSounds: SoundRef[];
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
  /** 이 프로젝트의 "내 에셋" 멤버십(업로드만). 빌트인은 미포함. */
  libraryAssetIds: string[];
  /** 유튜브 플레이어 배치/표현 뷰 설정(프로젝트당 영속). 구 저장본엔 없을 수 있어 optional. */
  baseFlowView?: { layout: "mini" | "ambient"; ambientIntensity: number };
}
