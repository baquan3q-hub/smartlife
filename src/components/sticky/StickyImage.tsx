// File: src/components/sticky/StickyImage.tsx
// Hiển thị ảnh trong note: ảnh local (sticky-img://) đọc từ IndexedDB; ảnh http(s) hiển thị trực tiếp;
// nguồn khác hoặc ảnh không có trên máy này → ô thay thế.

import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { isAllowedImageSrc, stickyImageId } from '../../utils/stickyMarkdown';
import { stickyImageStore } from '../../services/stickyImageStore';

type LocalState = { id: string; url: string | null; loading: boolean };

/** Object URL của ảnh local; url null + loading false = không có trên thiết bị này. */
export function useStickyImageUrl(id: string | null): { url: string | null; loading: boolean } {
  const [state, setState] = useState<LocalState | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setState({ id, url: null, loading: true });
    stickyImageStore.getUrl(id).then(url => { if (alive) setState({ id, url, loading: false }); });
    return () => { alive = false; };
  }, [id]);
  if (!id) return { url: null, loading: false };
  // Đổi id: tới khi effect chạy vẫn coi là đang tải (không hiện nhầm ảnh cũ)
  if (!state || state.id !== id) return { url: null, loading: true };
  return { url: state.url, loading: state.loading };
}

const Placeholder: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <span
    title={title}
    className="inline-flex items-center gap-1.5 my-1 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs opacity-70 italic select-none"
  >
    {children}
  </span>
);

export const StickyImage: React.FC<{ src: string | null | undefined; alt?: string | null; className?: string }> = ({ src, alt, className }) => {
  const id = stickyImageId(src);
  const { url, loading } = useStickyImageUrl(id);
  const label = alt?.trim();

  if (id) {
    if (url) return <img src={url} alt={label || ''} className={className} draggable={false} />;
    if (loading) return <Placeholder><Loader2 size={12} className="animate-spin" /> Đang tải ảnh…</Placeholder>;
    return (
      <Placeholder title="Ảnh được lưu trên thiết bị đã chèn, không đồng bộ lên máy chủ">
        <ImageOff size={12} /> {label ? `${label} — ` : ''}Ảnh chỉ có trên thiết bị đã chèn
      </Placeholder>
    );
  }
  if (src && isAllowedImageSrc(src)) return <img src={src} alt={label || ''} className={className} loading="lazy" referrerPolicy="no-referrer" />;
  return <Placeholder><ImageOff size={12} /> {label || 'Ảnh'}</Placeholder>;
};
