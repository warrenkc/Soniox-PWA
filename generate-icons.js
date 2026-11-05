const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 1. Create SVG Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <linearGradient id="micGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e0e7ff" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

  <!-- Inner subtle glow circle -->
  <circle cx="256" cy="256" r="180" fill="white" opacity="0.08" />
  <circle cx="256" cy="256" r="130" fill="white" opacity="0.06" />

  <!-- Waveform Soundbars in Background -->
  <g fill="white" opacity="0.35">
    <rect x="90" y="210" width="16" height="92" rx="8" />
    <rect x="120" y="160" width="16" height="192" rx="8" />
    <rect x="376" y="160" width="16" height="192" rx="8" />
    <rect x="406" y="210" width="16" height="92" rx="8" />
  </g>

  <!-- Central Microphone Graphic -->
  <g filter="url(#shadow)">
    <!-- Mic Body -->
    <rect x="216" y="120" width="80" height="150" rx="40" fill="url(#micGrad)" />

    <!-- Mic Mesh Line Details -->
    <path d="M228 175 H284 M228 200 H284 M228 225 H284" stroke="#6366f1" stroke-width="4" stroke-linecap="round" opacity="0.5" />

    <!-- Mic Cradle/Arc -->
    <path d="M180 220 C180 300 332 300 332 220" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" />

    <!-- Stand Stem -->
    <line x1="256" y1="305" x2="256" y2="365" stroke="#ffffff" stroke-width="20" stroke-linecap="round" />

    <!-- Stand Base -->
    <line x1="200" y1="365" x2="312" y2="365" stroke="#ffffff" stroke-width="22" stroke-linecap="round" />
  </g>
</svg>`;

fs.writeFileSync(path.join(__dirname, 'icons', 'icon.svg'), svgContent);
console.log('Created icons/icon.svg');

// 2. Pure Node PNG Generator
function createPng(width, height, drawPixel) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    return (crc ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Icon Drawer with clean anti-aliased rounded card and microphone silhouette
function drawAppIcon(x, y, w, h, isMaskable = false) {
  const nx = x / w;
  const ny = y / h;

  // Maskable icons use full bleed, standard icons have rounded corners
  const radius = isMaskable ? 0 : 0.22;
  let inBounds = true;
  if (!isMaskable) {
    const cornerR = radius;
    const cx = nx < cornerR ? cornerR : (nx > 1 - cornerR ? 1 - cornerR : nx);
    const cy = ny < cornerR ? cornerR : (ny > 1 - cornerR ? 1 - cornerR : ny);
    const distSq = (nx - cx) ** 2 + (ny - cy) ** 2;
    if (distSq > cornerR ** 2) {
      inBounds = false;
    }
  }

  if (!inBounds) {
    return [0, 0, 0, 0];
  }

  // Gradient background: indigo (79, 70, 229) to violet (124, 58, 237) to cyan (6, 182, 212)
  const t = (nx + ny) / 2;
  let bgR, bgG, bgB;
  if (t < 0.5) {
    const k = t / 0.5;
    bgR = Math.round(79 + (124 - 79) * k);
    bgG = Math.round(70 + (58 - 70) * k);
    bgB = Math.round(229 + (237 - 229) * k);
  } else {
    const k = (t - 0.5) / 0.5;
    bgR = Math.round(124 + (6 - 124) * k);
    bgG = Math.round(58 + (182 - 58) * k);
    bgB = Math.round(237 + (212 - 237) * k);
  }

  // Draw Microphone & Elements
  const dx = nx - 0.5;
  const dy = ny - 0.5;

  // Soundwave bars
  const barY = ny;
  const isLeftBar1 = (nx >= 0.17 && nx <= 0.21 && ny >= 0.40 && ny <= 0.60);
  const isLeftBar2 = (nx >= 0.23 && nx <= 0.27 && ny >= 0.30 && ny <= 0.70);
  const isRightBar1 = (nx >= 0.73 && nx <= 0.77 && ny >= 0.30 && ny <= 0.70);
  const isRightBar2 = (nx >= 0.79 && nx <= 0.83 && ny >= 0.40 && ny <= 0.60);

  if (isLeftBar1 || isLeftBar2 || isRightBar1 || isRightBar2) {
    return [
      Math.round(bgR * 0.5 + 255 * 0.5),
      Math.round(bgG * 0.5 + 255 * 0.5),
      Math.round(bgB * 0.5 + 255 * 0.5),
      255
    ];
  }

  // Microphone Pill Body (centered at x=0.5, y between 0.23 and 0.52, width 0.16)
  const micW = 0.08;
  const micTop = 0.23 + micW;
  const micBottom = 0.52 - micW;

  let inMicBody = false;
  if (Math.abs(dx) <= micW && ny >= micTop && ny <= micBottom) {
    inMicBody = true;
  } else if (ny < micTop && (dx * dx + (ny - micTop) * (ny - micTop)) <= micW * micW) {
    inMicBody = true;
  } else if (ny > micBottom && (dx * dx + (ny - micBottom) * (ny - micBottom)) <= micW * micW) {
    inMicBody = true;
  }

  if (inMicBody) {
    return [255, 255, 255, 255];
  }

  // Microphone Arc (Cradle)
  const cradleDist = Math.sqrt(dx * dx + (ny - 0.43) * (ny - 0.43));
  if (cradleDist >= 0.135 && cradleDist <= 0.165 && ny >= 0.43 && ny <= 0.60) {
    return [255, 255, 255, 255];
  }

  // Microphone Stem
  if (Math.abs(dx) <= 0.02 && ny >= 0.59 && ny <= 0.72) {
    return [255, 255, 255, 255];
  }

  // Microphone Base
  if (Math.abs(dx) <= 0.12 && ny >= 0.71 && ny <= 0.75) {
    return [255, 255, 255, 255];
  }

  // Background pixel
  return [bgR, bgG, bgB, 255];
}

const icons = [
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'favicon.png', size: 32, maskable: false },
];

for (const icon of icons) {
  const buf = createPng(icon.size, icon.size, (x, y, w, h) => drawAppIcon(x, y, w, h, icon.maskable));
  fs.writeFileSync(path.join(__dirname, 'icons', icon.name), buf);
  console.log(`Created icons/${icon.name} (${icon.size}x${icon.size})`);
}
