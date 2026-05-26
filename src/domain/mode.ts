import type { GlobalMode, TrackStatus } from "../types";

/** 곱셈 모델: 트랙이 현재 모드에서 무슨 동작을 하는지. */
export type TrackBehavior = "silent" | "auto" | "perform" | "record";

export function resolveTrackBehavior(mode: GlobalMode, status: TrackStatus): TrackBehavior {
  if (status === "mute") return "silent";
  if (mode === "play" && status === "play") return "perform";
  if (mode === "record" && status === "write") return "record";
  return "auto";
}
