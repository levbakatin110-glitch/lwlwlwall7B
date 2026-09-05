import { deflateSync, crc32 } from "zlib";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SIZE = 512;
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(pixels) {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function coverDisk(x, y, cx, cy, r) {
  const d = Math.hypot(x - cx, y - cy);
  if (d <= r - 0.7) return 1;
  if (d >= r + 0.7) return 0;
  return (r + 0.7 - d) / 1.4;
}

function coverRing(x, y, cx, cy, r, w) {
  const d = Math.abs(Math.hypot(x - cx, y - cy) - r);
  if (d <= w - 0.7) return 1;
  if (d >= w + 0.7) return 0;
  return (w + 0.7 - d) / 1.4;
}

function coverCapsule(x, y, x0, y0, x1, y1, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((x - x0) * dx + (y - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return coverDisk(x, y, x0 + dx * t, y0 + dy * t, r);
}

function stamp(px, x, y, rgb, a) {
  if (a <= 0) return;
  const i = (y * SIZE + x) * 4;
  const k = Math.max(0, Math.min(1, a));
  px[i] = px[i] * (1 - k) + rgb[0] * k;
  px[i + 1] = px[i + 1] * (1 - k) + rgb[1] * k;
  px[i + 2] = px[i + 2] * (1 - k) + rgb[2] * k;
}

function fillBg(px, top, bottom, glow) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const gy = y / (SIZE - 1);
      const gx = x / (SIZE - 1);
      let c = mix(top, bottom, gy * 0.85 + gx * 0.15);
      if (glow) {
        const d = Math.hypot(x - glow.x, y - glow.y) / glow.r;
        c = mix(c, glow.color, Math.max(0, 1 - d) * glow.a);
      }
      const vig = 1 - Math.max(0, Math.hypot(x - 256, y - 270) / 420 - 0.55) * 0.35;
      c = [c[0] * vig, c[1] * vig, c[2] * vig];
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
}

function star(px, cx, cy, r, rgb) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const a = coverDisk(x, y, cx, cy, r);
      stamp(px, x, y, rgb, a);
    }
  }
}

function paintSleep() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  fillBg(px, [42, 22, 58], [186, 72, 122], {
    x: 210,
    y: 200,
    r: 220,
    color: [255, 176, 140],
    a: 0.38,
  });
  const cream = [255, 244, 232];
  const stars = [
    [90, 80, 2.2],
    [140, 130, 1.6],
    [400, 90, 2],
    [430, 160, 1.4],
    [70, 200, 1.3],
    [380, 380, 1.8],
    [120, 400, 1.5],
    [450, 300, 1.2],
  ];
  for (const [sx, sy, sr] of stars) star(px, sx, sy, sr, cream);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const moon = coverDisk(x, y, 236, 250, 118);
      const cut = coverDisk(x, y, 292, 208, 102);
      const a = Math.max(0, moon * (1 - cut * 0.98));
      stamp(px, x, y, cream, a);
      const gloss = coverDisk(x, y, 200, 214, 28) * 0.22 * a;
      stamp(px, x, y, [255, 255, 255], gloss);
    }
  }
  return encodePng(px);
}

function paintFeeding() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  fillBg(px, [255, 168, 176], [214, 72, 118], {
    x: 256,
    y: 180,
    r: 240,
    color: [255, 220, 210],
    a: 0.3,
  });
  const cream = [255, 246, 248];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const body = coverCapsule(x, y, 256, 188, 256, 372, 46);
      const neck = coverCapsule(x, y, 256, 150, 256, 188, 28);
      const nipple = coverDisk(x, y, 256, 128, 22);
      const ring = coverCapsule(x, y, 210, 176, 302, 176, 12);
      const milk = coverCapsule(x, y, 256, 250, 256, 360, 32) * 0.28;
      const a = Math.max(body, neck, nipple, ring);
      stamp(px, x, y, cream, a);
      stamp(px, x, y, [255, 214, 196], milk);
      stamp(px, x, y, [255, 255, 255], coverCapsule(x, y, 232, 220, 232, 320, 6) * 0.35);
    }
  }
  return encodePng(px);
}

function paintWalk() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  fillBg(px, [88, 168, 168], [232, 110, 140], {
    x: 300,
    y: 140,
    r: 220,
    color: [255, 220, 170],
    a: 0.28,
  });
  const cream = [255, 246, 248];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const head = coverDisk(x, y, 250, 148, 36);
      const body = coverCapsule(x, y, 250, 188, 258, 278, 16);
      const arm = coverCapsule(x, y, 236, 210, 318, 168, 11);
      const strollerBar = coverCapsule(x, y, 300, 176, 360, 248, 10);
      const basket = coverCapsule(x, y, 338, 268, 400, 268, 34);
      const wheel1 = coverRing(x, y, 328, 338, 28, 8);
      const wheel2 = coverRing(x, y, 402, 338, 28, 8);
      const hub1 = coverDisk(x, y, 328, 338, 7);
      const hub2 = coverDisk(x, y, 402, 338, 7);
      const leg = coverCapsule(x, y, 248, 278, 228, 360, 12);
      const a = Math.max(
        head,
        body,
        arm,
        strollerBar,
        basket,
        wheel1,
        wheel2,
        hub1,
        hub2,
        leg,
      );
      stamp(px, x, y, cream, a);
    }
  }
  return encodePng(px);
}

function paintPulse() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  fillBg(px, [92, 28, 58], [214, 70, 118], {
    x: 256,
    y: 240,
    r: 260,
    color: [255, 140, 150],
    a: 0.32,
  });
  const cream = [255, 236, 238];
  const path = [
    [48, 268],
    [140, 268],
    [176, 268],
    [204, 150],
    [236, 350],
    [268, 210],
    [300, 268],
    [464, 268],
  ];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let a = 0;
      for (let i = 0; i < path.length - 1; i++) {
        a = Math.max(
          a,
          coverCapsule(x, y, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], 11),
        );
      }
      stamp(px, x, y, cream, a);
      stamp(px, x, y, [255, 180, 190], a * 0.15 * coverDisk(x, y, 236, 250, 90));
    }
  }
  return encodePng(px);
}

function paintTimer() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  fillBg(px, [54, 36, 78], [196, 78, 128], {
    x: 256,
    y: 200,
    r: 230,
    color: [255, 190, 150],
    a: 0.28,
  });
  const cream = [255, 244, 236];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const ring = coverRing(x, y, 256, 268, 132, 16);
      const face = coverDisk(x, y, 256, 268, 108) * 0.1;
      const h1 = coverCapsule(x, y, 256, 268, 256, 176, 9);
      const h2 = coverCapsule(x, y, 256, 268, 338, 268, 8);
      const hub = coverDisk(x, y, 256, 268, 14);
      let ticks = 0;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x0 = 256 + Math.cos(ang) * 100;
        const y0 = 268 + Math.sin(ang) * 100;
        const x1 = 256 + Math.cos(ang) * 118;
        const y1 = 268 + Math.sin(ang) * 118;
        ticks = Math.max(ticks, coverCapsule(x, y, x0, y0, x1, y1, 4));
      }
      stamp(px, x, y, cream, Math.max(ring, h1, h2, hub, ticks));
      stamp(px, x, y, [255, 220, 200], face);
    }
  }
  return encodePng(px);
}

const jobs = {
  "island-sleep.png": paintSleep,
  "island-feeding.png": paintFeeding,
  "island-walk.png": paintWalk,
  "island-pulse.png": paintPulse,
  "island-timer.png": paintTimer,
};

for (const [name, fn] of Object.entries(jobs)) {
  writeFileSync(join(DIR, name), fn());
  console.log(name);
}
