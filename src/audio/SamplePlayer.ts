/** 디코드된 샘플을 지정 ctx시각(초)에 1회 재생한다. */
export function playSample(
  ctx: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
  whenSec: number,
  volume: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  src.connect(gain).connect(destination);
  src.start(Math.max(whenSec, ctx.currentTime));
  src.onended = () => {
    src.disconnect();
    gain.disconnect();
  };
}
