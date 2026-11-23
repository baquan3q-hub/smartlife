// File: src/utils/stickyImageCompress.ts
// Nén ảnh trước khi lưu local: cạnh dài ≤ 1600px, WebP (không hỗ trợ → JPEG nền trắng).
// Mã hoá lại cũng bỏ EXIF (vị trí GPS…) của ảnh chụp.

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 1600;
export const IMAGE_QUALITY = 0.82;
export const MAX_IMAGES_PER_NOTE = 20;

export class StickyImageError extends Error {}

/** Kích thước sau khi thu nhỏ (giữ tỉ lệ, không phóng to). */
export function fitSize(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Kiểm tra file trước khi giải mã. SVG bị chặn (có thể chứa script). */
export function validateImageFile(file: Blob): void {
  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/') || type.includes('svg')) {
    throw new StickyImageError('Chỉ chèn được ảnh PNG, JPEG, WebP hoặc GIF.');
  }
  if (file.size > MAX_INPUT_BYTES) throw new StickyImageError('Ảnh lớn hơn 10 MB — hãy chọn ảnh nhỏ hơn.');
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch { /* thử cách khác */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new StickyImageError('Không đọc được ảnh này trên thiết bị — ảnh HEIC (iPhone) hãy đổi sang JPEG rồi chèn lại.');
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  validateImageFile(file);
  const decoded = await decode(file);
  try {
    const { width, height } = fitSize(decoded.width, decoded.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new StickyImageError('Thiết bị không xử lý được ảnh.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, width, height);
    let blob = await toBlob(canvas, 'image/webp', IMAGE_QUALITY);
    if (!blob || blob.type !== 'image/webp') {
      // Safari cũ không xuất WebP: JPEG không có kênh trong suốt → tô nền trắng
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      blob = await toBlob(canvas, 'image/jpeg', IMAGE_QUALITY);
    }
    if (!blob) throw new StickyImageError('Không nén được ảnh.');
    return { blob, width, height };
  } finally {
    decoded.release();
  }
}
