import { AudioEngine } from "./AudioEngine";
import { AudioFileSource } from "./AudioFileSource";
import type { BaseFlowSource } from "./BaseFlowSource";
import { getAsset } from "../persistence/assets";
import { useStore } from "../store/useStore";
import { useViewport } from "../store/viewport";
import { SampleLibrary } from "./SampleLibrary";
import { playSample } from "./SamplePlayer";
import { markersInWindow, ctxTimeForMarker } from "./Scheduler";
import { resolveTrackBehavior } from "../domain/mode";
import { startPlaySession, endPlaySession, updatePlay } from "../scoring/playSession";
import type { Project } from "../types";

let engine: AudioEngine | null = null;
let source: BaseFlowSource | null = null;
let rafId: number | null = null;

let library: SampleLibrary | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let lastScheduledMs = 0;

const LOOKAHEAD_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_MS = 120;

export function getLibrary(): SampleLibrary {
  if (!library) library = new SampleLibrary(getEngine().ctx);
  return library;
}

/** 현재 프로젝트의 모든 트랙 사운드를 미리 디코드한다. */
export async function preloadTrackSounds(): Promise<void> {
  const project = useStore.getState().project;
  if (!project) return;
  await Promise.all(project.tracks.map((t) => getLibrary().load(t.sound).catch(() => null)));
}

export function getEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine();
    // 새로 만든 영구 노드를 즉시 현재 store 상태와 일치시킨다(생성 시점 동기화).
    applyAudioState(engine, useStore.getState().project);
  }
  return engine;
}

/**
 * store 상태를 "수명이 긴 영구 오디오 노드"에 반영하는 단일 동기화 지점.
 *
 * 전역(트랙 무관) 오디오 파라미터를 새로 추가할 때는 반드시 이 함수에 연결한다.
 * store 값만 바꾸고 여기에 연결하지 않으면 UI는 동작하지만 소리에는 반영되지 않는다
 * (마스터 볼륨이 실제로 그랬던 버그). 개별 샘플/트랙 파라미터는 재생 시점에
 * store에서 직접 읽으므로(예: playSample(track.volume)) 이 함수의 대상이 아니다.
 */
export function applyAudioState(eng: AudioEngine, project: Project | null): void {
  eng.setMasterVolume(project?.master.volume ?? 1);
}

// store가 바뀔 때마다 영구 노드를 자동 재동기화한다. 엔진이 아직 없으면 무시하고,
// 생성 시점 동기화(getEngine)가 최신 상태를 보장한다.
useStore.subscribe((state) => {
  if (engine) applyAudioState(engine, state.project);
});

export function getSource(): BaseFlowSource | null {
  return source;
}

/** 현재 프로젝트의 베이스 플로우 에셋을 디코드해 소스를 만든다. */
export async function loadBaseFlow(assetId: string): Promise<void> {
  const eng = getEngine();
  const asset = await getAsset(assetId);
  if (!asset) throw new Error("base flow asset not found: " + assetId);
  const buffer = await eng.decode(asset.blob);
  disposeSource();
  source = new AudioFileSource(eng.ctx, buffer, eng.masterGain);
}

export async function play(): Promise<void> {
  if (!source) return;
  await getEngine().resume();
  await preloadTrackSounds();
  source.play();
  useStore.getState().setPlaying(true);
  useViewport.getState().setFollowPlayhead(true);
  if (useStore.getState().mode === "play") {
    startPlaySession();
  }
  lastScheduledMs = source.currentTimeMs();
  startScheduler();
  startRaf();
}

export function pause(): void {
  if (!source) return;
  source.pause();
  useStore.getState().setPlaying(false);
  stopScheduler();
  endPlaySession();
  stopRaf();
  useStore.getState().setPlayheadMs(source.currentTimeMs());
}

export function seek(ms: number): void {
  if (!source) return;
  source.seek(ms);
  lastScheduledMs = source.currentTimeMs();
  useStore.getState().setPlayheadMs(source.currentTimeMs());
  useViewport.getState().followTo(useStore.getState().playheadMs);
}

function startScheduler(): void {
  if (schedulerTimer !== null) return;
  lastScheduledMs = useStore.getState().playheadMs;
  const eng = getEngine();
  schedulerTimer = setInterval(() => {
    if (!source || !source.isPlaying()) return;
    const nowMs = source.currentTimeMs();
    const windowEnd = nowMs + SCHEDULE_AHEAD_MS;
    const state = useStore.getState();
    const project = state.project;
    if (!project) return;

    const autoTracks = project.tracks.filter(
      (t) => resolveTrackBehavior(state.mode, t.status) === "auto",
    );
    const due = markersInWindow(autoTracks, lastScheduledMs, windowEnd);
    for (const { trackId, marker } of due) {
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) continue;
      const buffer = getLibrary().get(track.sound);
      if (!buffer) continue;
      const whenSec = ctxTimeForMarker(eng.ctx.currentTime, marker.timeMs, nowMs);
      playSample(eng.ctx, buffer, eng.masterGain, whenSec, track.volume);
    }
    lastScheduledMs = windowEnd;
  }, LOOKAHEAD_INTERVAL_MS);
}

function stopScheduler(): void {
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

function startRaf(): void {
  if (rafId !== null) return;
  const tick = () => {
    if (!source) return;
    const st = useStore.getState();
    st.setPlayheadMs(source.currentTimeMs());
    useViewport.getState().followTo(source.currentTimeMs());
    if (st.mode === "play") {
      updatePlay(source.currentTimeMs());
    }
    if (!source.isPlaying()) {
      useStore.getState().setPlaying(false);
      stopScheduler();
      endPlaySession();
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopRaf(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function disposeSource(): void {
  stopRaf();
  source?.dispose();
  source = null;
}
