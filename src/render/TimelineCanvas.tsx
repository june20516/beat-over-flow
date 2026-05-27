import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import type { Track } from "../types";

interface Props {
  peaks: Float32Array | null;
  durationMs: number;
  tracks: Track[];
  region: { startMs: number; endMs: number } | null;
  stepCount: number;
  onSeek: (ms: number) => void;
  onLaneClick: (trackId: string, timeMs: number) => void;
}

const BASE_HEIGHT = 80;
const TRACK_HEIGHT = 40;

export function TimelineCanvas({ peaks, durationMs, tracks, region, stepCount, onSeek, onLaneClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadMs = useStore((s) => s.playheadMs);
  const height = BASE_HEIGHT + tracks.length * TRACK_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    ctx.clearRect(0, 0, w, canvas.height);

    // 베이스 레인
    ctx.fillStyle = "#100c24";
    ctx.fillRect(0, 0, w, BASE_HEIGHT);
    if (peaks && peaks.length > 0) {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#a855f7");
      grad.addColorStop(1, "#ec4899");
      ctx.fillStyle = grad;
      const mid = BASE_HEIGHT / 2;
      const barW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const bh = peaks[i] * (BASE_HEIGHT - 8);
        ctx.fillRect(i * barW, mid - bh / 2, Math.max(1, barW - 1), bh);
      }
    }

    // 트랙 레인 + 마커
    tracks.forEach((t, idx) => {
      const top = BASE_HEIGHT + idx * TRACK_HEIGHT;
      ctx.fillStyle = idx % 2 === 0 ? "#171041" : "#130d33";
      ctx.fillRect(0, top, w, TRACK_HEIGHT);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.strokeRect(0, top, w, TRACK_HEIGHT);
      if (durationMs > 0) {
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 8;
        const cy = top + TRACK_HEIGHT / 2;
        for (const m of t.markers) {
          const x = (m.timeMs / durationMs) * w;
          ctx.beginPath();
          ctx.arc(x, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
    });

    // 구간 + 그리드 오버레이
    if (region && durationMs > 0) {
      const x0 = (region.startMs / durationMs) * w;
      const x1 = (region.endMs / durationMs) * w;
      ctx.fillStyle = "rgba(168,85,247,0.12)";
      ctx.fillRect(x0, 0, x1 - x0, canvas.height);
      ctx.strokeStyle = "rgba(236,72,153,0.6)";
      ctx.beginPath();
      ctx.moveTo(x0, 0); ctx.lineTo(x0, canvas.height);
      ctx.moveTo(x1, 0); ctx.lineTo(x1, canvas.height);
      ctx.stroke();
      // 칸 경계
      ctx.strokeStyle = "rgba(168,85,247,0.28)";
      for (let i = 1; i < stepCount; i++) {
        const gx = x0 + ((x1 - x0) * i) / stepCount;
        ctx.beginPath();
        ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height);
        ctx.stroke();
      }
    }

    // 플레이헤드
    if (durationMs > 0) {
      const x = (playheadMs / durationMs) * w;
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 8;
      ctx.fillRect(x - 1, 0, 2, canvas.height);
      ctx.shadowBlur = 0;
    }
  }, [peaks, durationMs, tracks, playheadMs, height, region, stepCount]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || durationMs <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const timeMs = xRatio * durationMs;
    if (y < BASE_HEIGHT) {
      onSeek(timeMs);
    } else {
      const idx = Math.floor((y - BASE_HEIGHT) / TRACK_HEIGHT);
      const track = tracks[idx];
      if (track) onLaneClick(track.id, timeMs);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={height}
      onClick={handleClick}
      style={{ width: "100%", height, cursor: "pointer", display: "block" }}
    />
  );
}
