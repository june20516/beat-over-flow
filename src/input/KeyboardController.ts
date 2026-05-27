import { useStore } from "../store/useStore";
import { usePulse } from "../store/pulse";
import { resolveTrackBehavior } from "../domain/mode";
import { getEngine, getLibrary, play, pause } from "../audio/runtime";
import { playSample } from "../audio/SamplePlayer";
import { pressTrack } from "../scoring/playSession";
import { decideKeyAction } from "./keyAction";
import type { Track } from "../types";

/** 한 트랙에 대해 현재 모드의 record/perform 동작을 실행한다(기존 동작 유지). */
function triggerTrack(track: Track): void {
  usePulse.getState().pulse(track.id);
  const state = useStore.getState();
  const behavior = resolveTrackBehavior(state.mode, track.status);
  if (behavior === "record") {
    state.addMarker(track.id, state.playheadMs);
    const buffer = getLibrary().get(track.sound);
    if (buffer) {
      const eng = getEngine();
      playSample(eng.ctx, buffer, eng.masterGain, eng.ctx.currentTime, track.volume);
    }
  } else if (behavior === "perform") {
    // 소리는 항상 재생(악기처럼), 채점은 가장 가까운 마커와 매칭
    const buffer = getLibrary().get(track.sound);
    if (buffer) {
      const eng = getEngine();
      playSample(eng.ctx, buffer, eng.masterGain, eng.ctx.currentTime, track.volume);
    }
    pressTrack(track.id, state.playheadMs);
  }
}

/** 전역 키보드 리스너를 부착하고 해제 함수를 반환. */
export function startKeyboard(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const state = useStore.getState();
    const project = state.project;
    if (!project) return;

    const target = e.target as HTMLElement | null;
    const action = decideKeyAction({
      code: e.code,
      repeat: e.repeat,
      targetTag: target?.tagName ?? "",
      mode: state.mode,
      playPauseKey: project.transport?.playPauseKey ?? null,
      tracks: project.tracks,
    });

    if (action.kind === "ignore") return;
    if (action.preventDefault) e.preventDefault();

    if (action.kind === "toggle-play") {
      if (useStore.getState().playing) pause();
      else void play();
      return;
    }

    if (action.kind === "trigger-tracks") {
      for (const id of action.trackIds) {
        const track = project.tracks.find((t) => t.id === id);
        if (track) triggerTrack(track);
      }
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
