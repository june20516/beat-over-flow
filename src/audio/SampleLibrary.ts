import type { SoundRef } from "../types";
import { sampleUrl } from "./builtinSamples";
import { getAsset } from "../persistence/assets";

/** SoundRef → AudioBuffer를 디코드/캐시한다. */
export class SampleLibrary {
  private cache = new Map<string, AudioBuffer>();

  constructor(private readonly ctx: AudioContext) {}

  private key(ref: SoundRef): string {
    return ref.kind === "builtin" ? `b:${ref.sampleId}` : `u:${ref.assetId}`;
  }

  async load(ref: SoundRef): Promise<AudioBuffer> {
    const k = this.key(ref);
    const cached = this.cache.get(k);
    if (cached) return cached;

    let arrayBuf: ArrayBuffer;
    if (ref.kind === "builtin") {
      const res = await fetch(sampleUrl(ref.sampleId));
      arrayBuf = await res.arrayBuffer();
    } else {
      const asset = await getAsset(ref.assetId);
      if (!asset) throw new Error("sample asset not found: " + ref.assetId);
      arrayBuf = await asset.blob.arrayBuffer();
    }
    const buffer = await this.ctx.decodeAudioData(arrayBuf);
    this.cache.set(k, buffer);
    return buffer;
  }

  get(ref: SoundRef): AudioBuffer | null {
    return this.cache.get(this.key(ref)) ?? null;
  }
}
