import { useState } from "react";
import { formatKeyCode } from "../domain/formatKeyCode";
import { cx } from "./cx";
import styles from "./KeyCap.module.css";

interface KeyCapProps {
  code: string | null;
  onCapture: (code: string) => void;
}

export function KeyCap({ code, onCapture }: KeyCapProps) {
  const [capturing, setCapturing] = useState(false);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    // Tab은 캡처에서 제외 — 사용자가 키보드로 포커스를 빼낼 수 있도록 native 동작 유지.
    // (Tab은 트랙 트리거로 부적절한 키이기도 함.)
    if (e.code === "Tab") {
      setCapturing(false);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    // Escape는 변경 없이 캡처 모드 종료(취소).
    if (e.code === "Escape") {
      setCapturing(false);
      return;
    }
    onCapture(e.code);
    setCapturing(false);
  }

  return (
    <button
      type="button"
      className={cx(styles.keycap, capturing && styles.capturing)}
      onKeyDown={capturing ? handleKeyDown : undefined}
      onClick={(e) => {
        e.stopPropagation();
        // 캡처 중에 다시 클릭하면 변경 없이 취소.
        setCapturing((c) => !c);
      }}
      onBlur={() => setCapturing(false)}
      title={
        capturing
          ? "키를 누르세요. 다시 클릭하거나 Esc로 취소."
          : code
            ? `키: ${code} (${formatKeyCode(code)})`
            : "클릭 후 키를 누르세요"
      }
    >
      {capturing ? "…" : formatKeyCode(code)}
    </button>
  );
}
