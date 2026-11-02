// File: src/utils/saveFile.ts
// Lưu file do app tạo ra:
// - Web + Windows (Tauri/WebView2): tải về qua <a download>
// - Android/iOS (Capacitor): ghi vào cache rồi mở bảng chia sẻ (lưu vào Files, Drive, gửi Zalo…)

import { Capacitor } from '@capacitor/core';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function isShareCancel(err: unknown): boolean {
  return /cancel/i.test(String((err as any)?.message || err));
}

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({ title: filename, files: [uri] });
    } catch (err) {
      if (!isShareCancel(err)) throw err;
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Trình duyệt cần URL còn sống tới khi bắt đầu tải
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
