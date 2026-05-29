const ARROWS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

/** OS별 Meta 키 라벨. e.code의 "MetaLeft"/"MetaRight"는 OS-무관이지만 사용자가 인지하는 키는 다르다. */
function metaSymbol(mac: boolean, side: "L" | "R"): string {
  if (mac) return `${side}⌘`;
  return `${side}Win`;
}

/** punctuation (Quote/Semicolon 등) → 실제 글자. */
const PUNCT: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  IntlBackslash: "\\",
};

/** 편집 키 — 짧은 심볼 또는 라벨. */
const EDIT: Record<string, string> = {
  Backspace: "⌫",
  Delete: "⌦",
  Tab: "Tab",
  Enter: "↩",
  NumpadEnter: "↩",
  Home: "Home",
  End: "End",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Insert: "Ins",
};

export interface FormatOpts {
  /** Meta 키 라벨링용. 기본은 런타임 감지(SSR/테스트에선 false). */
  mac?: boolean;
}

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  // userAgentData 우선, 없으면 platform/userAgent 폴백 (모두 deprecated 진행 중이라 다층 방어).
  type UADataLike = { platform?: string };
  const uad = (navigator as { userAgentData?: UADataLike }).userAgentData;
  if (uad?.platform) return /mac/i.test(uad.platform);
  if (typeof navigator.platform === "string") return /Mac/i.test(navigator.platform);
  return /Mac/i.test(navigator.userAgent);
}

/**
 * 키보드 e.code를 사람이 읽을 짧은 표시 문자열로 변환한다 (순수함수, mac 옵션 제외).
 *
 * - KeyA→"A", Digit1/Numpad1→"1"
 * - 화살표 → ←→↑↓
 * - 좌/우 modifier → LCtrl/RCtrl, LShift/RShift, LAlt/RAlt, L⌘/R⌘(mac) | LWin/RWin
 * - punctuation(Backquote 등) → 실제 글자
 * - 편집 키 → 짧은 심볼/라벨 (Backspace→⌫ 등)
 * - 그 외 처리되지 않는 코드는 원본 그대로 (UI 측에서 ellipsis로 점진 손상).
 * - null → "Key"
 */
export function formatKeyCode(code: string | null, opts?: FormatOpts): string {
  if (!code) return "Key";
  if (/^Key[A-Z]$/.test(code)) return code.slice(-1);
  if (/^Digit[0-9]$/.test(code)) return code.slice(-1);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(-1);
  if (code === "Space") return "Space";
  if (code in ARROWS) return ARROWS[code];
  if (code === "Escape") return "Esc";
  if (code in PUNCT) return PUNCT[code];
  if (code in EDIT) return EDIT[code];
  if (code === "CapsLock") return "Caps";
  // Modifier 좌/우
  if (code === "ControlLeft") return "LCtrl";
  if (code === "ControlRight") return "RCtrl";
  if (code === "ShiftLeft") return "LShift";
  if (code === "ShiftRight") return "RShift";
  if (code === "AltLeft") return "LAlt";
  if (code === "AltRight") return "RAlt";
  const mac = opts?.mac ?? detectMac();
  if (code === "MetaLeft") return metaSymbol(mac, "L");
  if (code === "MetaRight") return metaSymbol(mac, "R");
  return code;
}
