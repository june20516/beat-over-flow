// scripts/analysisCore.mjs
// 순수 DSP 헬퍼. 의존성 없음. analyze-demo.mjs와 테스트가 공유한다.

/** 복소 in-place radix-2 FFT. n은 2의 거듭제곱. re/im 길이 동일. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = i + k + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] = re[a] + vr; im[a] = im[a] + vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** 시각(ms)들을 (phaseMs 기준) periodMs 그리드에 스냅한다. */
export function quantize(timesMs, periodMs, phaseMs) {
  return timesMs.map((t) => Math.round((t - phaseMs) / periodMs) * periodMs + phaseMs);
}

/** 정렬된(또는 단조) 배열에서 minGapMs 이내 인접 중복을 제거한다. */
export function dedupeSorted(timesMs, minGapMs) {
  const sorted = [...timesMs].sort((a, b) => a - b);
  const out = [];
  for (const t of sorted) {
    if (out.length === 0 || t - out[out.length - 1] >= minGapMs) out.push(t);
  }
  return out;
}

/** 이동평균*multiplier 임계를 넘는 지역 최대를 minGap(프레임) 간격으로 고른다. 인덱스 배열 반환. */
export function peakPick(env, { window = 10, multiplier = 1.5, minGap = 1 } = {}) {
  const peaks = [];
  let last = -Infinity;
  for (let i = 1; i < env.length - 1; i++) {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(env.length - 1, i + window); j++) {
      sum += env[j]; cnt++;
    }
    const thr = (sum / cnt) * multiplier;
    if (env[i] > thr && env[i] >= env[i - 1] && env[i] > env[i + 1] && i - last >= minGap) {
      peaks.push(i);
      last = i;
    }
  }
  return peaks;
}

/** 온셋 엔벨로프 자기상관으로 BPM을 추정한다(min..max 범위). */
export function estimateBpm(env, hopSec, { min = 90, max = 160 } = {}) {
  const minLag = Math.max(1, Math.round(60 / max / hopSec));
  const maxLag = Math.round(60 / min / hopSec);
  let bestLag = minLag, best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  return 60 / (bestLag * hopSec);
}
