import { useEffect, useRef } from 'react';
import { GpsPoint } from '../services/workoutTracker';

interface Props {
  positions: GpsPoint[];
  height?: number;
}

const BG = '#0D1B2A';
const ROUTE_COLOR = '#00FF87';
const START_COLOR = '#FFFFFF';
const CURRENT_COLOR = '#00FF87';

export default function WorkoutMap({ positions, height = 250 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Grid lines (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      if (positions.length === 0) {
        // No GPS yet — waiting indicator
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '12px DM Sans, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for GPS signal...', W / 2, H / 2);
        return;
      }

      // Project lat/lng → canvas coords
      const lats = positions.map(p => p.lat);
      const lngs = positions.map(p => p.lng);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

      const PAD = 32;
      const rangeW = W - PAD * 2;
      const rangeH = H - PAD * 2;

      const latSpan = maxLat - minLat || 0.0001;
      const lngSpan = maxLng - minLng || 0.0001;
      // Keep aspect: use the more constraining axis
      const scale = Math.min(rangeW / lngSpan, rangeH / latSpan);

      const toX = (lng: number) =>
        PAD + (rangeW - lngSpan * scale) / 2 + (lng - minLng) * scale;
      // lat increases north, canvas y increases down → flip
      const toY = (lat: number) =>
        PAD + (rangeH - latSpan * scale) / 2 + (maxLat - lat) * scale;

      // Route shadow
      if (positions.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(toX(positions[0].lng), toY(positions[0].lat));
        for (let i = 1; i < positions.length; i++) {
          ctx.lineTo(toX(positions[i].lng), toY(positions[i].lat));
        }
        ctx.strokeStyle = 'rgba(0,255,135,0.15)';
        ctx.lineWidth = 8;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Route line
        ctx.beginPath();
        ctx.moveTo(toX(positions[0].lng), toY(positions[0].lat));
        for (let i = 1; i < positions.length; i++) {
          ctx.lineTo(toX(positions[i].lng), toY(positions[i].lat));
        }
        ctx.strokeStyle = ROUTE_COLOR;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Start dot
      const sx = toX(positions[0].lng);
      const sy = toY(positions[0].lat);
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = START_COLOR;
      ctx.fill();
      ctx.font = 'bold 8px DM Sans, system-ui, sans-serif';
      ctx.fillStyle = BG;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', sx, sy);

      // Current position — pulsing
      const last = positions[positions.length - 1];
      const cx = toX(last.lng);
      const cy = toY(last.lat);
      const pulse = 0.5 + 0.5 * Math.sin(pulseRef.current);

      ctx.beginPath();
      ctx.arc(cx, cy, 14 * pulse + 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,135,${0.12 * pulse})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = CURRENT_COLOR;
      ctx.shadowColor = CURRENT_COLOR;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner white dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    };

    const loop = () => {
      pulseRef.current += 0.06;
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [positions, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, display: 'block', borderRadius: 16 }}
    />
  );
}
