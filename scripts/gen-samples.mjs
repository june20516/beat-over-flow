// 내장 퍼커션 원샷을 합성 생성한다(직접 합성한 자작 사운드 → CC0).
// ffmpeg/sox 없이 16-bit PCM mono WAV 바이트를 생성하고 .ogg 파일명으로 저장한다.
// Web Audio decodeAudioData는 확장자가 아닌 내용(RIFF/WAVE 헤더)으로 포맷을 판별하므로 정상 재생된다.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples");
mkdirSync(OUT, { recursive: true });

function noise() {
  return Math.random() * 2 - 1;
}

/** 각 샘플을 Float32 모노 배열로 합성한다. */
function synth(id) {
  const sounds = {
    // 킥: 60→40Hz로 떨어지는 사인, 빠른 감쇠
    kick: (durSec = 0.35) => {
      const n = Math.floor(SR * durSec);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = 60 * Math.exp(-18 * t) + 40;
        const env = Math.exp(-9 * t);
        out[i] = Math.sin(2 * Math.PI * f * t) * env;
      }
      return out;
    },
    // 스네어: 톤(180Hz) + 노이즈, 중간 감쇠
    snare: (durSec = 0.2) => {
      const n = Math.floor(SR * durSec);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const env = Math.exp(-22 * t);
        const tone = Math.sin(2 * Math.PI * 180 * t) * 0.4;
        out[i] = (tone + noise() * 0.8) * env;
      }
      return out;
    },
    // 하이햇: 고역 노이즈, 아주 짧은 감쇠
    hat: (durSec = 0.06) => {
      const n = Math.floor(SR * durSec);
      const out = new Float32Array(n);
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const env = Math.exp(-60 * t);
        const hp = noise() - prev; // 간단한 1차 하이패스
        prev = noise();
        out[i] = hp * env;
      }
      return out;
    },
    // 클랩: 짧은 노이즈 버스트 3회
    clap: (durSec = 0.22) => {
      const n = Math.floor(SR * durSec);
      const out = new Float32Array(n);
      const bursts = [0, 0.012, 0.024];
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        let env = 0;
        for (const b of bursts) {
          if (t >= b) env += Math.exp(-50 * (t - b));
        }
        env = Math.min(1, env) * Math.exp(-8 * t);
        out[i] = noise() * env;
      }
      return out;
    },
    // 톰: 120→90Hz 사인, 중간 감쇠
    tom: (durSec = 0.3) => {
      const n = Math.floor(SR * durSec);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = 120 * Math.exp(-6 * t) + 90;
        const env = Math.exp(-10 * t);
        out[i] = Math.sin(2 * Math.PI * f * t) * env;
      }
      return out;
    },
    // 퍼커션: 400Hz 사인 + 약간의 노이즈, 짧은 감쇠
    perc: (durSec = 0.12) => {
      const n = Math.floor(SR * durSec);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const env = Math.exp(-30 * t);
        out[i] = (Math.sin(2 * Math.PI * 400 * t) * 0.7 + noise() * 0.3) * env;
      }
      return out;
    },
  };
  return sounds[id]();
}

/** Float32(-1..1) 모노 → 16-bit PCM WAV Buffer */
function toWav(samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 0.9 * 32767), 44 + i * 2);
  }
  return buf;
}

const ids = ["kick", "snare", "hat", "clap", "tom", "perc"];
for (const id of ids) {
  const wav = toWav(synth(id));
  writeFileSync(join(OUT, `${id}.ogg`), wav);
  console.log(`wrote ${id}.ogg (${wav.length} bytes)`);
}
