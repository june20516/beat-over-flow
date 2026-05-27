import { useState } from "react";
import { formatKeyCode } from "../domain/formatKeyCode";

interface KeyCapProps {
  code: string | null;
  onCapture: (code: string) => void;
}

export function KeyCap({ code, onCapture }: KeyCapProps) {
  const [capturing, setCapturing] = useState(false);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onCapture(e.code);
    setCapturing(false);
  }

  return (
    <button
      type="button"
      className={capturing ? "keycap keycap--capturing" : "keycap"}
      onKeyDown={capturing ? handleKeyDown : undefined}
      onClick={(e) => {
        e.stopPropagation();
        setCapturing(true);
      }}
      onBlur={() => setCapturing(false)}
      title="클릭 후 키를 누르세요"
    >
      {capturing ? "…" : formatKeyCode(code)}
    </button>
  );
}
