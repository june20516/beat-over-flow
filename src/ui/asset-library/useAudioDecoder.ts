import type { DecodeFn } from "./validateUpload";
import { getAudioEngine } from "../../audio/runtime";

/** 프로덕션용 decode 어댑터. AudioEngine의 AudioContext 재사용. */
export function makeDecoder(): DecodeFn {
  return async (buf) => {
    const ctx = getAudioEngine().ctx;
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    return { durationMs: Math.round(decoded.duration * 1000) };
  };
}
