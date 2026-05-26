/** 앱 전역 단일 AudioContext와 마스터 게인을 보유한다. */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  /** 브라우저 자동재생 정책 대응: 사용자 제스처 안에서 호출. */
  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setMasterVolume(v: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  async decode(blob: Blob): Promise<AudioBuffer> {
    const buf = await blob.arrayBuffer();
    return await this.ctx.decodeAudioData(buf);
  }
}
