/**
 * 거친 미디어 시간(유튜브 getCurrentTime 등)을 매끄러운 재생 위치로 보간한다.
 * - sync(mediaMs): 외부에서 신뢰할 수 있는 위치를 알려줄 때(폴링/시크/상태변경) 호출. 리앵커.
 * - setRunning(bool): 재생/정지 전환. 정지 시 현재 보간값을 고정.
 * - currentMs(): 재생 중이면 now 경과를 더해 보간, 정지면 고정값.
 * now는 주입(테스트 용이). 실사용은 () => performance.now().
 */
export class InterpolatedClock {
  private mediaMs = 0;
  private anchorNow: number;
  private running = false;

  constructor(private readonly now: () => number) {
    this.anchorNow = now();
  }

  sync(mediaMs: number): void {
    this.mediaMs = mediaMs;
    this.anchorNow = this.now();
  }

  setRunning(running: boolean): void {
    this.mediaMs = this.currentMs(); // 전환 직전 보간값 고정
    this.anchorNow = this.now();
    this.running = running;
  }

  currentMs(): number {
    if (!this.running) return this.mediaMs;
    return this.mediaMs + (this.now() - this.anchorNow);
  }
}
