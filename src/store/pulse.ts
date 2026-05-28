import { create } from "zustand";

/** 펄스를 일으킨 주체. 사용자 키 입력과 자동 재생(스케줄러)을 색상으로 구분한다. */
export type PulseSource = "key" | "auto";

export interface PulseEvent {
  /** 매 펄스마다 증가하는 단조 카운터(애니메이션 재시작 키로 사용). */
  nonce: number;
  source: PulseSource;
}

interface PulseState {
  events: Record<string, PulseEvent>;
  pulse: (trackId: string, source: PulseSource) => void;
}

/**
 * 트랙 시각 피드백용 휘발성 신호.
 * 같은 트랙을 연타해도 nonce가 매번 증가하므로, 구독 측에서 nonce를 key로 사용하면
 * 호출 횟수만큼 애니메이션을 재시작할 수 있다.
 */
export const usePulse = create<PulseState>((set) => ({
  events: {},
  pulse: (trackId, source) =>
    set((s) => {
      const prev = s.events[trackId];
      return {
        events: {
          ...s.events,
          [trackId]: { nonce: (prev?.nonce ?? 0) + 1, source },
        },
      };
    }),
}));
