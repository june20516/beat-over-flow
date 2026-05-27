import type { ComponentType } from "react";
import { Headphones, GameController, Record, type IconProps } from "@phosphor-icons/react";
import { useStore } from "../store/useStore";
import type { GlobalMode } from "../types";

const MODES: { mode: GlobalMode; label: string; Icon: ComponentType<IconProps> }[] = [
  { mode: "listening", label: "리스닝", Icon: Headphones },
  { mode: "play", label: "플레이", Icon: GameController },
  { mode: "record", label: "레코드", Icon: Record },
];

export function ModeSwitcher() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div className="seg">
      {MODES.map(({ mode: m, label, Icon }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={active ? "seg__btn seg__btn--active" : "seg__btn"}
          >
            <Icon size={16} weight={active ? "fill" : "regular"} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
