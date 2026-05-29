import type { BaseFlowSource } from "./BaseFlowSource";
import { InterpolatedClock } from "./InterpolatedClock";
import { YT_STATE, type YTPlayerLike } from "./youtubeApi";

const POLL_INTERVAL_MS = 250;

/** 유튜브 플레이어를 BaseFlowSource로 어댑트한다. 보간 클럭으로 매끄러운 위치 제공. */
export class YouTubeSource implements BaseFlowSource {
  readonly durationMs: number;
  private readonly clock: InterpolatedClock;
  private playing = false;
  private offsetMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly player: YTPlayerLike,
    offsetMs: number,
    now: () => number = () => performance.now(),
  ) {
    this.offsetMs = offsetMs;
    this.durationMs = player.getDuration() * 1000;
    this.clock = new InterpolatedClock(now);
    this.clock.sync(player.getCurrentTime() * 1000);
    this.startPolling();
  }

  /** youtubeApi onStateChange 핸들러에서 호출(외부 배선). */
  onStateChange(state: number): void {
    const wasPlaying = this.playing;
    this.playing = state === YT_STATE.PLAYING;
    // 상태 전환 시 신뢰할 수 있는 위치로 리싱크
    this.clock.sync(this.player.getCurrentTime() * 1000);
    if (this.playing !== wasPlaying) this.clock.setRunning(this.playing);
  }

  currentTimeMs(): number {
    const t = this.clock.currentMs() + this.offsetMs;
    return Math.min(this.durationMs, Math.max(0, t));
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** 마커 타이밍 보정(nudge) 값을 현재 소스에 즉시 반영. */
  setOffsetMs(ms: number): void {
    this.offsetMs = ms;
  }

  play(): void {
    this.player.playVideo();
  }

  pause(): void {
    this.player.pauseVideo();
  }

  seek(ms: number): void {
    const clamped = Math.min(this.durationMs, Math.max(0, ms));
    this.player.seekTo(clamped / 1000, true);
    this.clock.sync(clamped);
  }

  dispose(): void {
    this.stopPolling();
    this.player.destroy();
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = setInterval(() => {
      // 재생 중에만 주기적 리싱크(드리프트 보정).
      if (this.playing) this.clock.sync(this.player.getCurrentTime() * 1000);
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
