import type { SoundRef } from "../../types";
import { getAudioEngine, getLibrary } from "../../audio/runtime";

// 모달이 열려있는 동안 단일 미리듣기 소스만 살아있도록 모듈 단위 상태로 보관.
let activePreview: { source: AudioBufferSourceNode } | null = null;

/**
 * 지정된 SoundRef를 미리 듣는다.
 * - 이전 미리듣기가 있으면 먼저 중지한다.
 * - AudioEngine.masterGain 을 통해 재생하므로 마스터 볼륨/뮤트 설정이 반영된다.
 * - SampleLibrary는 runtime의 단일 인스턴스를 공유 — preloadTrackSounds로 warm된
 *   캐시도 미리듣기에서 그대로 사용된다.
 */
export async function previewSound(ref: SoundRef): Promise<void> {
  stopPreview();
  const engine = getAudioEngine();
  const buf = await getLibrary().load(ref);
  const source = engine.ctx.createBufferSource();
  source.buffer = buf;
  source.connect(engine.masterGain);
  source.start();
  // 캡처된 참조와 현재 활성 참조를 비교해, 이미 다른 소스로 교체된 뒤
  // 늦게 발화하는 onended가 새 소스 슬롯을 null로 덮어쓰지 않게 한다.
  const captured = { source };
  activePreview = captured;
  source.onended = () => {
    if (activePreview === captured) activePreview = null;
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
