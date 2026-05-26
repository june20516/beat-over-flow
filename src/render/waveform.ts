/** 모노 채널 데이터를 buckets개의 버킷으로 나눠 각 버킷의 최대 절댓값(0..1)을 반환한다. */
export function computePeaks(channelData: Float32Array, buckets: number): Float32Array {
  const peaks = new Float32Array(buckets);
  if (channelData.length === 0) return peaks;
  const samplesPerBucket = channelData.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * samplesPerBucket);
    const end = Math.max(start + 1, Math.floor((b + 1) * samplesPerBucket));
    let max = 0;
    for (let i = start; i < end && i < channelData.length; i++) {
      const v = Math.abs(channelData[i]);
      if (v > max) max = v;
    }
    peaks[b] = Math.min(1, max);
  }
  return peaks;
}
