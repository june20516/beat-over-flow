import { create } from "zustand";

interface PulseState {
  nonce: Record<string, number>;
  pulse: (trackId: string) => void;
}

/** 트랙 시각 피드백용 휘발성 신호. 키 트리거 시 nonce 증가 → 구독 컴포넌트가 짧게 하이라이트. */
export const usePulse = create<PulseState>((set) => ({
  nonce: {},
  pulse: (trackId) =>
    set((s) => ({ nonce: { ...s.nonce, [trackId]: (s.nonce[trackId] ?? 0) + 1 } })),
}));
