import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { carbon, chalk } from "../src/lib/colours";

/* Generates the icon set from one mark so every size stays in step. Run with
   `npm run build:icons` after changing it; the outputs are committed, because
   they are assets rather than build products.

   The mark is two letters built out of bars on a grid of sixty four, in chalk
   on carbon. It is drawn from rectangles and not set in a typeface, for two
   reasons. An icon is shown by a browser's tab strip and a phone's home screen,
   neither of which can load a web font, so type in an SVG falls back to
   whatever the machine has and the mark is different on every one. And the
   previous version fetched its face from Google at generation time, which made
   the output depend on a request that this repository's own policy is built to
   avoid. Bars have no metrics to disagree about.

   The PNGs are encoded here rather than taken from a screenshot. Chromium
   drops the alpha channel when an image is fully opaque, which yields a
   colour-type-2 PNG, and Next refuses to build with one inside a .ico:
   "Format error decoding Ico: The PNG is not in RGBA format!". Pulling raw
   RGBA out of a canvas and encoding it here makes the format a certainty
   rather than something the browser decides. */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "src", "app");
const publicDir = join(root, "public");
mkdirSync(appDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

/* Chalk on carbon. The wall is a mid grey that sits badly in a tab strip, which
   is either lighter or darker than it, so the icon carries its own ground. */
const GROUND = carbon;
const MARK = chalk;

/* The F and the L, in sixty fourths of the icon: x, y, width, height. Every bar
   is eight wide, and the two letters are the same height, so the pair reads as
   one piece cut from a single sheet. */
const BARS: readonly (readonly [number, number, number, number])[] = [
  [12, 12, 8, 40],
  [12, 12, 18, 8],
  [12, 28, 14, 8],
  [36, 12, 8, 40],
  [36, 44, 18, 8],
];

/* Solid ground rather than a transparent one, so the mark holds its own
   against both a light and a dark browser tab instead of dissolving into
   whichever it was not designed for. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Finn Lakin">
  <rect width="64" height="64" fill="${GROUND}"/>
${BARS.map(([x, y, w, h]) => `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${MARK}"/>`).join("\n")}
</svg>`;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba: Uint8Array, size: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(6, 9); // colour type 6, truecolour with alpha
  header.writeUInt8(0, 10);
  header.writeUInt8(0, 11);
  header.writeUInt8(0, 12);

  /* One filter byte per scanline, filter 0 (none). */
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main() {
  const browser = await chromium.launch();
  const tab = await browser.newPage();
  await tab.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>`);

  async function render(size: number): Promise<Buffer> {
    const pixels = await tab.evaluate(
      ({ size, ground, mark, bars }) => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = mark;
        const unit = size / 64;
        for (const [x, y, w, h] of bars) ctx.fillRect(x * unit, y * unit, w * unit, h * unit);
        return Array.from(ctx.getImageData(0, 0, size, size).data);
      },
      { size, ground: GROUND, mark: MARK, bars: BARS.map((bar) => [...bar]) },
    );
    return encodePng(Uint8Array.from(pixels), size);
  }

  writeFileSync(join(appDir, "icon.svg"), `${svg}\n`);
  writeFileSync(join(appDir, "apple-icon.png"), await render(180));
  writeFileSync(join(publicDir, "icon-192.png"), await render(192));
  writeFileSync(join(publicDir, "icon-512.png"), await render(512));

  const sizes = [16, 32, 48];
  const pngs: Buffer[] = [];
  for (const size of sizes) pngs.push(await render(size));

  /* ICO container: a 6-byte header, then one 16-byte directory entry per
     image, then the PNG payloads. */
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((size, index) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngs[index].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += pngs[index].length;
    return entry;
  });

  writeFileSync(join(appDir, "favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));

  await browser.close();
  console.log(`Wrote favicon.ico (${sizes.join(", ")}), icon.svg, apple-icon.png, icon-192.png, icon-512.png`);
}

void main();
