// scripts/analysisCore.test.mjs
import { describe, it, expect } from "vitest";
import { fft, quantize, dedupeSorted, peakPick, estimateBpm } from "./analysisCore.mjs";
import { spectralFluxEnvelope, routeOnsets } from "./analysisCore.mjs";

function magnitudes(re, im) {
  const out = new Array(re.length);
  for (let i = 0; i < re.length; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}

describe("fft", () => {
  it("상수 신호는 bin0에 에너지가 몰린다", () => {
    const re = [1, 1, 1, 1], im = [0, 0, 0, 0];
    fft(re, im);
    const mag = magnitudes(re, im);
    expect(mag[0]).toBeCloseTo(4, 6);
    expect(mag[1]).toBeCloseTo(0, 6);
    expect(mag[2]).toBeCloseTo(0, 6);
  });

  it("임펄스는 모든 bin 크기가 1", () => {
    const re = [1, 0, 0, 0], im = [0, 0, 0, 0];
    fft(re, im);
    for (const m of magnitudes(re, im)) expect(m).toBeCloseTo(1, 6);
  });

  it("단일 사인은 해당 bin에 봉우리", () => {
    const n = 16, k = 3;
    const re = [], im = [];
    for (let i = 0; i < n; i++) { re.push(Math.cos((2 * Math.PI * k * i) / n)); im.push(0); }
    fft(re, im);
    const mag = magnitudes(re, im);
    let argmax = 0;
    for (let i = 1; i <= n / 2; i++) if (mag[i] > mag[argmax]) argmax = i;
    expect(argmax).toBe(k);
  });
});

describe("quantize / dedupeSorted", () => {
  it("그리드에 스냅하고 중복을 제거한다", () => {
    const snapped = quantize([95, 205, 210, 500], 100, 0);
    expect(snapped).toEqual([100, 200, 200, 500]);
    expect(dedupeSorted(snapped, 1)).toEqual([100, 200, 500]);
  });
});

describe("peakPick", () => {
  it("배경 위 봉우리만 잡고 최소간격을 지킨다", () => {
    const env = new Array(40).fill(0.1);
    env[10] = 1.0; env[11] = 0.9; env[25] = 1.0;
    const peaks = peakPick(env, { window: 5, multiplier: 1.5, minGap: 3 });
    expect(peaks).toContain(10);
    expect(peaks).toContain(25);
    expect(peaks).not.toContain(11); // 최소간격 내 두 번째 봉우리 배제
  });
});

describe("estimateBpm", () => {
  it("주기적 엔벨로프에서 BPM을 복원한다", () => {
    const hopSec = 60 / 120 / 4; // 16분음표 hop → 정확히 120bpm 비트 = 4 hop
    const env = [];
    for (let i = 0; i < 256; i++) env.push(i % 4 === 0 ? 1 : 0);
    const bpm = estimateBpm(env, hopSec, { min: 90, max: 160 });
    expect(bpm).toBeCloseTo(120, 0);
  });
});

describe("spectralFluxEnvelope", () => {
  it("무음→톤 전환 지점에서 플럭스가 솟는다", () => {
    const sr = 8000, n = 8000;
    const sig = new Float32Array(n);
    for (let i = 0; i < n; i++) sig[i] = i < n / 2 ? 0 : Math.sin((2 * Math.PI * 440 * i) / sr);
    const { env, hopSec } = spectralFluxEnvelope(sig, sr, { fftSize: 512, hop: 256, loHz: 100, hiHz: 2000 });
    const onsetFrame = Math.round(n / 2 / 256);
    let argmax = 0;
    for (let i = 1; i < env.length; i++) if (env[i] > env[argmax]) argmax = i;
    expect(Math.abs(argmax - onsetFrame)).toBeLessThanOrEqual(2);
    expect(hopSec).toBeCloseTo(256 / sr, 6);
  });
});

describe("routeOnsets", () => {
  it("대역 온셋을 6개 트랙으로 분배한다", () => {
    const beatMs = 500, phaseMs = 0;
    const peaks = {
      low: [0, 250, 1000, 1250],
      mid: [500, 1000],
      high: [0, 125, 250, 375],
    };
    const out = routeOnsets(peaks, beatMs, phaseMs);
    expect(Object.keys(out).sort()).toEqual(["clap", "hat", "kick", "perc", "snare", "tom"]);
    expect(out.kick.length + out.tom.length).toBe(4);
    expect(out.snare.length + out.clap.length).toBe(2);
    expect(out.hat.length + out.perc.length).toBe(4);
  });
});
