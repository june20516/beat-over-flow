/** 재생 경과 시각(ms) = (현재 ctx초 - 재생 시작 ctx초)*1000 + 시작 오프셋(ms) */
export function elapsedMs(nowCtxSec: number, startCtxSec: number, startOffsetMs: number): number {
  return (nowCtxSec - startCtxSec) * 1000 + startOffsetMs;
}
