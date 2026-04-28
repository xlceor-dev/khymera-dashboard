import { useEffect, useRef } from "react";


type TelemetryPoint = { t: number; value: number };
const MAX_HISTORY = 60;   

export default function SparklineChart({
  data,
  color,
  label,
  unit,
  height = 80,
}: {
  data: TelemetryPoint[];
  color: string;
  label: string;
  unit: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const values = data.map((d) => d.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;

    const toX = (i: number) => (i / (data.length - 1)) * W;
    const toY = (v: number) => H - ((v - minV) / range) * (H - 10) - 5;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + "55");
    grad.addColorStop(1, color + "00");

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) ctx.lineTo(toX(i), toY(values[i]));
    ctx.lineTo(toX(values.length - 1), H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) ctx.lineTo(toX(i), toY(values[i]));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const lastX = toX(values.length - 1);
    const lastY = toY(values[values.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [data, color]);

  const lastVal = data.length > 0 ? data[data.length - 1].value : null;
  const prevVal = data.length > 1 ? data[data.length - 2].value : null;
  const delta = lastVal !== null && prevVal !== null ? lastVal - prevVal : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-3.5 flex flex-col gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-gray-500 dark:text-slate-500 tracking-[0.08em] uppercase font-mono">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span
            className="text-xl font-bold font-mono"
            style={{ color }}
          >
            {lastVal !== null ? lastVal.toFixed(1) : "—"}
          </span>
          <span className="text-xs text-gray-500 dark:text-slate-500">{unit}</span>
          {delta !== null && (
            <span
              className="text-[11px] ml-1"
              style={{ color: delta >= 0 ? "#f59e0b" : "#38bdf8" }}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        className="w-full rounded-md"
        style={{ height }}
      />
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-700">
        <span>since {MAX_HISTORY}s</span>
        <span>{data.length} pts</span>
        <span>now</span>
      </div>
    </div>
  );
}