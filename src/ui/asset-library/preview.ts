import type { SoundRef } from "../../types";
import { getAudioEngine } from "../../audio/runtime";
import { SampleLibrary } from "../../audio/SampleLibrary";

// 모달이 열려있는 동안 단일 미리듣기 소스만 살아있도록 모듈 단위 상태로 보관.
let activePreview: { source: AudioBufferSourceNode } | null = null;
let library: SampleLibrary | null = null;

function getLibrary(): SampleLibrary {
  const engine = getAudioEngine();
  // AudioEngine.ctx 가 AudioContext를 노출하므로 그대로 전달.
  if (!library) library = new SampleLibrary(engine.ctx);
  return library;
}

/**
 * 지정된 SoundRef를 미리 듣는다.
 * - 이전 미리듣기가 있으면 먼저 중지한다.
 * - AudioEngine.masterGain 을 통해 재생하므로 마스터 볼륨/뮤트 설정이 반영된다.
 */
export async function previewSound(ref: SoundRef): Promise<void> {
  stopPreview();
  const engine = getAudioEngine();
  const buf = await getLibrary().load(ref);
  const source = engine.ctx.createBufferSource();
  source.buffer = buf;
  // AudioEngine은 masterGain을 공개 속성으로 노출하므로 직접 연결.
  // 이 경로를 쓰면 마스터 볼륨·뮤트가 미리듣기에도 적용된다.
  source.connect(engine.masterGain);
  source.start();
  activePreview = { source };
  source.onended = () => {
    activePreview = null;
  };
}

/**
 * 현재 재생 중인 미리듣기를 중지한다.
 * 아무것도 재생 중이지 않아도 안전하게 호출할 수 있다.
 */
export function stopPreview(): void {
  if (activePreview) {
    try {
      activePreview.source.stop();
    } catch {
      /* already stopped */
    }
    activePreview = null;
  }
}
