import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SpeakerHigh } from "@phosphor-icons/react";

interface VolumeControlProps {
  value: number;
  onChange: (v: number) => void;
}

export function VolumeControl({ value, onChange }: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function openPopover() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left + r.width / 2, top: r.top - 8 });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  return (
    <div className="volume-control">
      <button
        ref={triggerRef}
        type="button"
        className="btn--icon volume-control__trigger"
        title={`볼륨 ${Math.round(value * 100)}%`}
        aria-label="볼륨"
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else openPopover();
        }}
      >
        <SpeakerHigh size={16} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            className="volume-control__popover"
            style={
              {
                position: "fixed",
                left: pos.left,
                top: pos.top,
                transform: "translate(-50%, -100%)",
                zIndex: 50,
              } as CSSProperties
            }
            onClick={(e) => e.stopPropagation()}
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
