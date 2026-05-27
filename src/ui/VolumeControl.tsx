import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SpeakerHigh } from "@phosphor-icons/react";

interface VolumeControlProps {
  value: number;
  onChange: (v: number) => void;
}

export function VolumeControl({ value, onChange }: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="volume-control" ref={rootRef}>
      <button
        type="button"
        className="btn--icon volume-control__trigger"
        title={`볼륨 ${Math.round(value * 100)}%`}
        aria-label="볼륨"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <SpeakerHigh size={16} />
      </button>
      {open && (
        <div className="volume-control__popover" onClick={(e) => e.stopPropagation()}>
          <input
            className="range-fill volume-control__range"
            style={{ "--pct": `${value * 100}%` } as CSSProperties}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}
