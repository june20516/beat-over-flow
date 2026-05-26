import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";

interface Props {
  peaks: Float32Array | null;
  durationMs: number;
  onSeek: (ms: number) => void;
}

const LANE_HEIGHT = 80;

export function TimelineCanvas({ peaks, durationMs, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadMs = useStore((s) => s.playheadMs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 베이스 레인 배경
    ctx.fillStyle = "#10131a";
    ctx.fillRect(0, 0, w, LANE_HEIGHT);

    // 파형
    if (peaks && peaks.length > 0) {
      ctx.fillStyle = "#6cc4ff";
      const mid = LANE_HEIGHT / 2;
      const barW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const bh = peaks[i] * (LANE_HEIGHT - 8);
        ctx.fillRect(i * barW, mid - bh / 2, Math.max(1, barW - 1), bh);
      }
    }

    // 플레이헤드
    if (durationMs > 0) {
      const x = (playheadMs / durationMs) * w;
      ctx.fillStyle = "#ff7b7b";
      ctx.fillRect(x - 1, 0, 2, h);
    }
  }, [peaks, durationMs, playheadMs]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || durationMs <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * durationMs);
  }

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={LANE_HEIGHT}
      onClick={handleClick}
      style={{ width: "100%", height: LANE_HEIGHT, cursor: "pointer", display: "block" }}
    />
  );
}
