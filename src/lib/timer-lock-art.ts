/** Крупный счётчик для заставки «сейчас играет» — iPhone берёт title и обложку. */

export function formatLockClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function paintTimerLockArt(opts: {
  clock: string;
  label: string;
  paused?: boolean;
}): string | null {
  if (typeof document === "undefined") return null;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#1c1218";
  ctx.fillRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(256, 220, 20, 256, 240, 280);
  glow.addColorStop(0, "rgba(232, 90, 140, 0.38)");
  glow.addColorStop(1, "rgba(232, 90, 140, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255, 246, 248, 0.12)";
  ctx.lineWidth = 3;
  roundRect(ctx, 28, 28, 456, 456, 48);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 246, 248, 0.55)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = opts.label.trim().slice(0, 28).toUpperCase();
  ctx.fillText(label, 256, 118);

  ctx.fillStyle = "#fff6f8";
  const clock = opts.clock;
  ctx.font =
    clock.length > 7
      ? "700 92px ui-monospace, SFMono-Regular, Menlo, monospace"
      : "700 108px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(clock, 256, 250);

  ctx.fillStyle = opts.paused
    ? "rgba(255, 196, 140, 0.9)"
    : "rgba(232, 90, 140, 0.95)";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText(opts.paused ? "пауза · Мая" : "идёт · Мая", 256, 380);

  return canvas.toDataURL("image/jpeg", 0.82);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
