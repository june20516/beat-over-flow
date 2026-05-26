/** 베이스 플로우 재생 소스 추상화. v1은 AudioFileSource, v2는 YouTubeSource가 구현. */
export interface BaseFlowSource {
  readonly durationMs: number;
  /** 현재 재생 위치(ms). 정지 중이면 마지막 위치. */
  currentTimeMs(): number;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  /** 자원 해제. */
  dispose(): void;
}
