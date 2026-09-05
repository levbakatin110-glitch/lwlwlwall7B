import { deflateSync, crc32 } from "zlib";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SIZE = 512;
const RAD = 96;
const BG = [232, 90, 140, 255];
const FG = [255, 246, 248, 255];
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
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inRoundRect(x, y) {
  const xx = Math.max(RAD, Math.min(x, SIZE - 1 - RAD));
  const yy = Math.max(RAD, Math.min(y, SIZE - 1 - RAD));
  return (x - xx) ** 2 + (y - yy) ** 2 <= RAD * RAD;
}

function circle(x, y, cx, cy, rad) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
}

function paint(draw) {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (!inRoundRect(x, y)) {
        px[i + 3] = 0;
        continue;
      }
      const [cr, cg, cb, ca] = draw(x, y) ? FG : BG;
      px[i] = cr;
      px[i + 1] = cg;
      px[i + 2] = cb;
      px[i + 3] = ca;
    }
  }
  return encodePng(px);
}

const icons = {
  "island-sleep.png": (x, y) =>
    circle(x, y, 250, 256, 150) && !circle(x, y, 310, 210, 128),
  "island-feeding.png": (x, y) => {
    const bottle = x > 210 && x < 302 && y > 150 && y < 400;
    const nipple = x > 228 && x < 284 && y > 110 && y < 160;
    const ring = y > 148 && y < 172 && x > 200 && x < 312;
    return bottle || nipple || ring;
  },
  "island-walk.png": (x, y) => {
    const head = circle(x, y, 256, 150, 42);
    const body = x > 236 && x < 276 && y > 190 && y < 320;
    const legL =
      x > 200 &&
      x < 248 &&
      y > 310 &&
      y < 420 &&
      Math.abs(x - 224 - (y - 310) * 0.15) < 16;
    const legR =
      x > 256 &&
      x < 320 &&
      y > 310 &&
      y < 420 &&
      Math.abs(x - 288 + (y - 310) * 0.2) < 16;
    return head || body || legL || legR;
  },
  "island-pulse.png": (x, y) => {
    const mid = Math.abs(y - 256) < 18;
    return (
      (x > 80 && x < 160 && mid) ||
      (x >= 160 && x < 200 && Math.abs(y - (256 - (x - 160))) < 18) ||
      (x >= 200 && x < 256 && Math.abs(y - (216 + (x - 200))) < 18) ||
      (x >= 256 && x < 312 && Math.abs(y - (256 - (x - 256) * 1.4)) < 20) ||
      (x >= 312 && x < 360 && Math.abs(y - (176 + (x - 312))) < 18) ||
      (x >= 360 && x < 440 && mid)
    );
  },
  "island-timer.png": (x, y) => {
    const ring = circle(x, y, 256, 268, 150) && !circle(x, y, 256, 268, 118);
    const hand = x > 248 && x < 264 && y > 160 && y < 280;
    const hand2 = x > 248 && x < 340 && y > 256 && y < 274;
    return ring || hand || hand2;
  },
};

for (const [name, draw] of Object.entries(icons)) {
  writeFileSync(join(DIR, name), paint(draw));
  console.log(name);
}
