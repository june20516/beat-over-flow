const ARROWS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

/**
 * 키보드 e.code를 사람이 읽을 표시 문자열로 변환한다 (순수함수).
 * 규칙은 v2-contracts.md §7 참조.
 */
export function formatKeyCode(code: string | null): string {
  if (!code) return "Key";
  if (/^Key[A-Z]$/.test(code)) return code.slice(-1);
  if (/^Digit[0-9]$/.test(code)) return code.slice(-1);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(-1);
  if (code === "Space") return "Space";
  if (code in ARROWS) return ARROWS[code];
  if (code === "Escape") return "Esc";
  if (code === "Enter") return "Enter";
  return code;
}
