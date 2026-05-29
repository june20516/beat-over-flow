/** YouTubeSource가 의존하는 최소 플레이어 인터페이스(실제 YT.Player의 부분집합). */
export interface YTPlayerLike {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  /** -1 UNSTARTED, 0 ENDED, 1 PLAYING, 2 PAUSED, 3 BUFFERING, 5 CUED */
  getPlayerState(): number;
  destroy(): void;
}

export const YT_STATE = {
  UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5,
} as const;

interface YTGlobal {
  Player: new (el: HTMLElement, opts: unknown) => YTPlayerLike;
}
declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTGlobal> | null = null;

/** IFrame API 스크립트를 1회 주입하고 준비될 때까지 대기. */
export function loadYouTubeIframeApi(): Promise<YTGlobal> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTGlobal>((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export interface CreatePlayerHandlers {
  onReady: () => void;
  onStateChange: (state: number) => void;
  onError: (code: number) => void;
}

/** 컨테이너에 플레이어를 생성하고 onReady 후 resolve. */
export async function createYouTubePlayer(
  container: HTMLElement,
  videoId: string,
  startSeconds: number,
  handlers: CreatePlayerHandlers,
): Promise<YTPlayerLike> {
  const YT = await loadYouTubeIframeApi();
  return new Promise<YTPlayerLike>((resolve) => {
    const player: YTPlayerLike = new YT.Player(container, {
      // host/origin을 명시하지 않으면 IFrame API의 postMessage 타깃 오리진이
      // iframe 실제 오리진(www.youtube.com)과 어긋나 "target origin does not match"가
      // 발생하고 부모↔플레이어 통신(playVideo·이벤트)이 깨진다. 둘을 고정해 핸드셰이크를 맞춘다.
      host: "https://www.youtube.com",
      videoId,
      playerVars: {
        start: Math.floor(startSeconds),
        playsinline: 1,
        rel: 0,
        controls: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          handlers.onReady();
          resolve(player);
        },
        onStateChange: (e: { data: number }) => handlers.onStateChange(e.data),
        onError: (e: { data: number }) => handlers.onError(e.data),
      },
    });
  });
}
