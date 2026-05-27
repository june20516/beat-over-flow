import { ScoringEngine, type PlayableMarker } from "./ScoringEngine";
import { useStore } from "../store/useStore";
import { resolveTrackBehavior } from "../domain/mode";
import type { Judgment } from "./scoring";

let engine: ScoringEngine | null = null;

/** 현재 play(perform) 트랙들의 마커로 채점 세션을 시작한다. */
export function startPlaySession(): void {
  const state = useStore.getState();
  const project = state.project;
  if (!project) return;
  const markers: PlayableMarker[] = [];
  for (const t of project.tracks) {
    if (resolveTrackBehavior("play", t.status) !== "perform") continue;
    for (const m of t.markers) {
      markers.push({ trackId: t.id, markerId: m.id, timeMs: m.timeMs });
    }
  }
  engine = new ScoringEngine(markers);
  useStore.getState().resetScore();
}

export function endPlaySession(): void {
  engine = null;
}

/** perform 트랙 키 입력 채점. 판정(또는 고스트 null) 반환. */
export function pressTrack(trackId: string, inputMs: number): Judgment | null {
  if (!useStore.getState().playing) return null; // 재생 중에만 채점 (폴리싱 #10)
  if (!engine) return null;
  const j = engine.registerPress(trackId, inputMs);
  if (j) useStore.getState().setScore(engine.scoreState);
  return j;
}

/** 시간 진행에 따른 miss 갱신. */
export function updatePlay(nowMs: number): void {
  if (!engine) return;
  const misses = engine.update(nowMs);
  if (misses > 0) useStore.getState().setScore(engine.scoreState);
}
