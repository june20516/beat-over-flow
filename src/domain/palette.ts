export const PALETTE = ["#6cc4ff", "#ffd86b", "#7bdc9a", "#ff7b7b", "#c08bff", "#ff9f5b"] as const;

export function pickColor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
