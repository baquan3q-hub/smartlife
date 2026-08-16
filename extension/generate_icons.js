// File: extension/generate_icons.js
const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Generate valid 1x1 or minimal PNG buffer if canvas isn't available, or simple RGBA PNG
function createSimplePng(size, r, g, b) {
  // Minimal PNG generator in pure Node.js
  const zlib = require('zlib');
  
  const width = size;
  const height = size;
  
  // Uncompressed raw scanlines: each row starts with filter byte 0
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Gradient / rounded box effect
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isInside = dist < size * 0.45;
      
      if (isInside) {
        rawData[pxOffset] = r;     // R
        rawData[pxOffset + 1] = g; // G
        rawData[pxOffset + 2] = b; // B
        rawData[pxOffset + 3] = 255; // Alpha
      } else {
        rawData[pxOffset] = 79;
        rawData[pxOffset + 1] = 70;
        rawData[pxOffset + 2] = 229;
        rawData[pxOffset + 3] = 220;
      }
    }
  }
  
  const compressed = zlib.deflateSync(rawData);
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  
  function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
  
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(iconDir, 'icon16.png'), createSimplePng(16, 99, 102, 241));
fs.writeFileSync(path.join(iconDir, 'icon48.png'), createSimplePng(48, 79, 70, 229));
fs.writeFileSync(path.join(iconDir, 'icon128.png'), createSimplePng(128, 67, 56, 202));

console.log('✅ Generated Chrome Extension PNG icons (16px, 48px, 128px) successfully!');
