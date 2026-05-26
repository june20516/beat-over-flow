import { AudioEngine } from "./AudioEngine";
import { AudioFileSource } from "./AudioFileSource";
import type { BaseFlowSource } from "./BaseFlowSource";
import { getAsset } from "../persistence/assets";
import { useStore } from "../store/useStore";

let engine: AudioEngine | null = null;
let source: BaseFlowSource | null = null;
let rafId: number | null = null;

export function getEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}

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
  source.play();
  useStore.getState().setPlaying(true);
  startRaf();
}

export function pause(): void {
  if (!source) return;
  source.pause();
  useStore.getState().setPlaying(false);
  stopRaf();
  useStore.getState().setPlayheadMs(source.currentTimeMs());
}

export function seek(ms: number): void {
  if (!source) return;
  source.seek(ms);
  useStore.getState().setPlayheadMs(source.currentTimeMs());
}

function startRaf(): void {
  if (rafId !== null) return;
  const tick = () => {
    if (!source) return;
    useStore.getState().setPlayheadMs(source.currentTimeMs());
    if (!source.isPlaying()) {
      useStore.getState().setPlaying(false);
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
