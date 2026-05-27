export const PALETTE = ["#22d3ee", "#f472b6", "#4ade80", "#fbbf24", "#a855f7", "#fb923c"] as const;

export function pickColor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
