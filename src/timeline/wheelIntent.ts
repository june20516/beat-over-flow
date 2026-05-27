export interface WheelLike {
  deltaX: number;
  deltaY: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export type WheelIntent =
  | { kind: "zoom"; amount: number }
  | { kind: "pan"; amount: number }
  | { kind: "none"; amount: 0 };

/** 0이 아닌 dominant delta. 둘 다 0이면 0. */
function dominant(a: number, b: number): number {
  return a !== 0 ? a : b;
}

/**
 * 휠 의도 판정. modifier(Shift/Ctrl/Meta)면 줌, 아니면 가로 팬.
 * macOS는 Shift+휠을 deltaX에 싣으므로 줌도 dominant(deltaY, deltaX)를 쓴다.
 */
export function resolveWheelIntent(e: WheelLike): WheelIntent {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    const amount = dominant(e.deltaY, e.deltaX);
    return amount === 0 ? { kind: "none", amount: 0 } : { kind: "zoom", amount };
  }
  const amount = dominant(e.deltaX, e.deltaY);
  return amount === 0 ? { kind: "none", amount: 0 } : { kind: "pan", amount };
}
