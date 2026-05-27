import type { GlobalMode, Track } from "../types";

export interface KeyContext {
  code: string;
  repeat: boolean;
  targetTag: string; // e.target의 tagName (대문자). 없으면 "".
  mode: GlobalMode;
  playPauseKey: string | null; // project.transport?.playPauseKey ?? null
  tracks: Track[];
}

export type KeyAction =
  | { kind: "ignore"; preventDefault: false }
  | { kind: "noop"; preventDefault: boolean }
  | { kind: "toggle-play"; preventDefault: boolean }
  | { kind: "trigger-tracks"; preventDefault: boolean; trackIds: string[] };

const TYPING_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** 계약 §9: keydown을 어떻게 처리할지 결정하는 순수함수. */
export function decideKeyAction(ctx: KeyContext): KeyAction {
  // 1. repeat 무시
  if (ctx.repeat) return { kind: "ignore", preventDefault: false };
  // 2. 입력 필드 타깃이면 타이핑 허용(무시)
  if (TYPING_TAGS.has(ctx.targetTag)) return { kind: "ignore", preventDefault: false };
  // 3. play/record 모드면 모든 키 기본동작 차단 (요구 6)
  const preventDefault = ctx.mode === "play" || ctx.mode === "record";
  // 4. 재생키 일치 → 토글 (모든 모드, 트랙키보다 우선) (요구 12)
  if (ctx.playPauseKey !== null && ctx.code === ctx.playPauseKey) {
    return { kind: "toggle-play", preventDefault };
  }
  // 5. 트랙 키 일치 → 트리거
  const trackIds = ctx.tracks.filter((t) => t.keyBinding === ctx.code).map((t) => t.id);
  if (trackIds.length > 0) {
    return { kind: "trigger-tracks", preventDefault, trackIds };
  }
  return { kind: "noop", preventDefault };
}
