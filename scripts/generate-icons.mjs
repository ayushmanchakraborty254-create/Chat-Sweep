import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate an SVG icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="sparkle" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
  </defs>
  <!-- Background rounded squircle -->
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#grad)" />
  <!-- Chat bubble outline -->
  <path d="M34 38 C34 32.4 38.4 28 44 28 L84 28 C89.6 28 94 32.4 94 38 L94 72 C94 77.6 89.6 82 84 82 L52 82 L38 94 L40 82 L44 82 C38.4 82 34 77.6 34 72 Z" fill="#ffffff" opacity="0.95" />
  <!-- Broom sweep strokes / sparkles -->
  <path d="M50 48 L78 48" stroke="#059669" stroke-width="5" stroke-linecap="round" />
  <path d="M50 60 L72 60" stroke="#059669" stroke-width="5" stroke-linecap="round" />
  <path d="M50 72 L64 72" stroke="#059669" stroke-width="5" stroke-linecap="round" />
  <!-- Magic sparkle top-right -->
  <polygon points="96,24 99,32 107,35 99,38 96,46 93,38 85,35 93,32" fill="url(#sparkle)" />
</svg>`;

fs.writeFileSync(path.join(outDir, 'icon.svg'), svg, 'utf-8');

// Function to generate a simple uncompressed PNG buffer
function createPng(size) {
  // Simple PNG encoder
  const width = size;
  const height = size;
  
  // Create RGBA raw pixels
  // Background: emerald #10b981 (16, 185, 129, 255)
  // Inner shape: white chat bubble
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0; // Filter type 0: None
    
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      const nx = x / width;
      const ny = y / height;
      
      // Distance from center for rounded icon
      const dx = Math.abs(x - width / 2) / (width / 2);
      const dy = Math.abs(y - height / 2) / (height / 2);
      const cornerDist = Math.max(0, dx - 0.5) ** 2 + Math.max(0, dy - 0.5) ** 2;
      
      if (cornerDist > 0.22) {
        // Transparent outside rounded rect
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
        continue;
      }
      
      // Chat bubble box roughly in center
      const inBubble = (nx >= 0.26 && nx <= 0.74 && ny >= 0.26 && ny <= 0.68) ||
                       (nx >= 0.28 && nx <= 0.44 && ny >= 0.68 && ny <= 0.80);
      
      if (inBubble) {
        // White chat bubble with green lines
        const isLine1 = (ny >= 0.38 && ny <= 0.43 && nx >= 0.36 && nx <= 0.64);
        const isLine2 = (ny >= 0.48 && ny <= 0.53 && nx >= 0.36 && nx <= 0.58);
        const isLine3 = (ny >= 0.58 && ny <= 0.63 && nx >= 0.36 && nx <= 0.50);
        
        if (isLine1 || isLine2 || isLine3) {
          rawData[pixelOffset] = 16;
          rawData[pixelOffset + 1] = 185;
          rawData[pixelOffset + 2] = 129;
          rawData[pixelOffset + 3] = 255;
        } else {
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
          rawData[pixelOffset + 3] = 250;
        }
      } else {
        // Emerald background
        rawData[pixelOffset] = 16;
        rawData[pixelOffset + 1] = 185;
        rawData[pixelOffset + 2] = 129;
        rawData[pixelOffset + 3] = 255;
      }
    }
  }
  
  // Deflate raw pixel rows
  const compressedData = zlib.deflateSync(rawData);
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

[16, 32, 48, 128].forEach(size => {
  const pngBuf = createPng(size);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), pngBuf);
  console.log(`Generated icon${size}.png`);
});

console.log('Icons generated successfully.');
