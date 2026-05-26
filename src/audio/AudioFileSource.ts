import type { BaseFlowSource } from "./BaseFlowSource";
import { elapsedMs } from "./playClock";

/** 디코드된 AudioBuffer를 BaseFlowSource로 재생한다. */
export class AudioFileSource implements BaseFlowSource {
  readonly durationMs: number;
  private node: AudioBufferSourceNode | null = null;
  private startCtxSec = 0;
  private startOffsetMs = 0;
  private pausedAtMs = 0;
  private playing = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffer: AudioBuffer,
    private readonly destination: AudioNode,
  ) {
    this.durationMs = buffer.duration * 1000;
  }

  currentTimeMs(): number {
    if (!this.playing) return this.pausedAtMs;
    const t = elapsedMs(this.ctx.currentTime, this.startCtxSec, this.startOffsetMs);
    return Math.min(this.durationMs, Math.max(0, t));
  }

  isPlaying(): boolean {
    return this.playing;
  }

  play(): void {
    if (this.playing) return;
    const node = this.ctx.createBufferSource();
    node.buffer = this.buffer;
    node.connect(this.destination);
    this.startCtxSec = this.ctx.currentTime;
    this.startOffsetMs = this.pausedAtMs;
    node.start(0, this.pausedAtMs / 1000);
    node.onended = () => {
      if (this.node === node && this.playing) {
        this.playing = false;
        this.pausedAtMs = this.durationMs;
      }
    };
    this.node = node;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.pausedAtMs = this.currentTimeMs();
    this.stopNode();
    this.playing = false;
  }

  seek(ms: number): void {
    const clamped = Math.min(this.durationMs, Math.max(0, ms));
    const wasPlaying = this.playing;
    if (wasPlaying) this.stopNode();
    this.pausedAtMs = clamped;
    this.playing = false;
    if (wasPlaying) this.play();
  }

  dispose(): void {
    this.stopNode();
    this.playing = false;
  }

  private stopNode(): void {
    if (this.node) {
      this.node.onended = null;
      try {
        this.node.stop();
      } catch {
        /* 이미 정지됨 */
      }
      this.node.disconnect();
      this.node = null;
    }
  }
}
