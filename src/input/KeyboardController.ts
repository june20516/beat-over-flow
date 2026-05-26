import { useStore } from "../store/useStore";
import { resolveTrackBehavior } from "../domain/mode";
import { getEngine, getLibrary } from "../audio/runtime";
import { playSample } from "../audio/SamplePlayer";

/** 전역 키보드 리스너를 부착하고 해제 함수를 반환. */
export function startKeyboard(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
      return; // 입력 필드 타이핑 중에는 무시
    }
    const state = useStore.getState();
    const project = state.project;
    if (!project) return;

    const matched = project.tracks.filter((t) => t.keyBinding === e.code);
    if (matched.length === 0) return;

    for (const track of matched) {
      const behavior = resolveTrackBehavior(state.mode, track.status);
      if (behavior === "record") {
        useStore.getState().addMarker(track.id, state.playheadMs);
        const buffer = getLibrary().get(track.sound);
        if (buffer) {
          const eng = getEngine();
          playSample(eng.ctx, buffer, eng.masterGain, eng.ctx.currentTime, track.volume);
        }
      }
      // behavior === "perform" 은 계획 4(채점)에서 처리
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
