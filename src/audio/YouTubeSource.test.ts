import { describe, expect, it } from "vitest";
import { YouTubeSource } from "./YouTubeSource";
import { YT_STATE, type YTPlayerLike } from "./youtubeApi";

class FakePlayer implements YTPlayerLike {
  state = YT_STATE.PAUSED;
  current = 0;        // seconds
  duration = 100;     // seconds
  played = false;
  paused = false;
  sought: number | null = null;
  destroyed = false;
  playVideo() { this.played = true; }
  pauseVideo() { this.paused = true; }
  seekTo(s: number) { this.sought = s; this.current = s; }
  getCurrentTime() { return this.current; }
  getDuration() { return this.duration; }
  getPlayerState() { return this.state; }
  destroy() { this.destroyed = true; }
}

function fakeNow() {
  let t = 0;
  return { fn: () => t, advance: (ms: number) => { t += ms; } };
}

describe("YouTubeSource", () => {
  it("durationMs는 player.getDuration()*1000", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    expect(s.durationMs).toBe(100000);
  });

  it("play/pause/seek를 플레이어에 위임", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    s.play(); expect(p.played).toBe(true);
    s.pause(); expect(p.paused).toBe(true);
    s.seek(5000); expect(p.sought).toBe(5); // ms→s
  });

  it("PLAYING 상태에서만 isPlaying true", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    p.state = YT_STATE.BUFFERING; s.onStateChange(YT_STATE.BUFFERING);
    expect(s.isPlaying()).toBe(false);
    p.state = YT_STATE.PLAYING; s.onStateChange(YT_STATE.PLAYING);
    expect(s.isPlaying()).toBe(true);
  });

  it("재생 중 currentTimeMs는 보간되고 offsetMs가 더해진다", () => {
    const p = new FakePlayer();
    const clk = fakeNow();
    const s = new YouTubeSource(p, 120, clk.fn); // offset 120ms
    p.current = 10; // 10s
    p.state = YT_STATE.PLAYING;
    s.onStateChange(YT_STATE.PLAYING); // sync(10000) + running
    clk.advance(250);
    expect(s.currentTimeMs()).toBe(10000 + 250 + 120);
  });

  it("currentTimeMs는 [0, durationMs]로 클램프", () => {
    const p = new FakePlayer();
    p.duration = 5; p.current = 5;
    const s = new YouTubeSource(p, 1000, fakeNow().fn);
    p.state = YT_STATE.PLAYING; s.onStateChange(YT_STATE.PLAYING);
    expect(s.currentTimeMs()).toBe(5000); // 5000+offset이 dur로 클램프
  });

  it("dispose는 player.destroy 호출", () => {
    const p = new FakePlayer();
    const s = new YouTubeSource(p, 0, fakeNow().fn);
    s.dispose();
    expect(p.destroyed).toBe(true);
  });
});
