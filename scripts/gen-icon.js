/**
 * gen-icon.js — 构建时生成托盘图标
 *
 * 使用 Node.js 内置模块（zlib）生成一个 16x16 的 PNG 图标（无外部依赖）。
 * 生成文件：assets/icon-b64.js  → 导出 Base64 字符串供 systray2 使用。
 */
'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 16, H = 16;

// ── 绘制 16×16 RGBA 图像（深绿底 + 白色 "N" 字）─────────────────────────
function makePixels() {
  const px = Buffer.alloc(W * H * 4, 0); // RGBA, 全透明

  const bg   = [28, 121, 168, 255]; // 蓝色背景
  const fg   = [255, 255, 255, 255]; // 白色前景
  const edge = [20, 90, 130, 255];   // 深蓝边框

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      // 圆角矩形背景
      const cx = x - 7.5, cy = y - 7.5;
      if (cx * cx + cy * cy <= 7.5 * 7.5) {
        px[i]   = bg[0]; px[i+1] = bg[1]; px[i+2] = bg[2]; px[i+3] = bg[3];
      }
    }
  }

  // 画白色 "N"（点阵，4×7 像素居中）
  const N_MASK = [
    [1,0,0,1],
    [1,0,0,1],
    [1,1,0,1],
    [1,0,1,1],
    [1,0,0,1],
    [1,0,0,1],
    [1,0,0,1],
  ];
  const ox = 6, oy = 5; // 起始偏移
  N_MASK.forEach((row, dy) => {
    row.forEach((on, dx) => {
      if (!on) return;
      const x = ox + dx, y = oy + dy;
      const i = (y * W + x) * 4;
      px[i] = fg[0]; px[i+1] = fg[1]; px[i+2] = fg[2]; px[i+3] = fg[3];
    });
  });

  return px;
}

// ── 编码为 PNG ─────────────────────────────────────────────────────────────
function encodePNG(pixels) {
  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii');
    const len   = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
    const crcBuf= Buffer.concat([typeB, data]);
    const crc   = crc32(crcBuf);
    const crcB  = Buffer.allocUnsafe(4); crcB.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeB, data, crcB]);
  }

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // 图像数据：每行前加 filter byte 0
  const rows = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    rows[y * (1 + W * 4)] = 0;
    pixels.copy(rows, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const compressed = zlib.deflateSync(rows, { level: 9 });

  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// ── CRC32 ─────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── 输出 ──────────────────────────────────────────────────────────────────
const pngBuf = encodePNG(makePixels());
const b64    = pngBuf.toString('base64');
const outDir = path.join(__dirname, '..', 'assets');
const outFile= path.join(outDir, 'icon-b64.js');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `module.exports = "${b64}";\n`, 'utf8');

console.log(`[gen-icon] 图标已生成 → ${outFile} (${pngBuf.length} bytes PNG)`);
