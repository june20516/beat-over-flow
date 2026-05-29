import type { SoundRef } from "../types";
import { BUILTIN_SAMPLES } from "../audio/builtinSamples";

export const RECENT_SLOTS = 6;

function sameRef(a: SoundRef, b: SoundRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "builtin" && b.kind === "builtin") return a.sampleId === b.sampleId;
  if (a.kind === "upload" && b.kind === "upload") return a.assetId === b.assetId;
  return false;
}

/** sound를 [0]에 두고 prev에서 중복 제거. 최대 RECENT_SLOTS 개로 자른다. */
export function pushRecent(prev: SoundRef[], sound: SoundRef): SoundRef[] {
  const filtered = prev.filter((s) => !sameRef(s, sound));
  return [sound, ...filtered].slice(0, RECENT_SLOTS);
}

/** upload assetId가 일치하는 항목만 제거. 빌트인은 영향 없음. */
export function removeAssetFromRecents(prev: SoundRef[], assetId: string): SoundRef[] {
  return prev.filter((s) => !(s.kind === "upload" && s.assetId === assetId));
}

/** 부족한 슬롯을 빌트인 정의 순으로 채워 RECENT_SLOTS 보장. 이미 있는 빌트인은 스킵. */
export function fillWithBuiltins(arr: SoundRef[]): SoundRef[] {
  if (arr.length >= RECENT_SLOTS) return arr.slice(0, RECENT_SLOTS);
  const result = arr.slice();
  for (const b of BUILTIN_SAMPLES) {
    if (result.length >= RECENT_SLOTS) break;
    const ref: SoundRef = { kind: "builtin", sampleId: b.id };
    if (!result.some((s) => sameRef(s, ref))) result.push(ref);
  }
  return result;
}

/** 새 트랙/마이그레이션용 시드. 현재 sound가 [0], 그 뒤로 빌트인 fallback. */
export function seedRecentSounds(currentSound: SoundRef): SoundRef[] {
  return fillWithBuiltins([currentSound]);
}
