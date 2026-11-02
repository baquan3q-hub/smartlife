// File: src/components/sticky/StickyMarkdownView.tsx
// Hiển thị (chỉ đọc) nội dung note dạng Markdown — dùng cho Lịch sử phiên bản và kết quả AI.
// Không bật HTML thô (không rehype-raw); link chỉ http/https/mailto; ảnh chỉ nguồn hợp lệ.

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImageOff } from 'lucide-react';
import { isAllowedImageSrc, sanitizeHref, stickyImageId } from '../../utils/stickyMarkdown';
import './stickyContent.css';

const components: Components = {
  a: ({ href, children }) => {
    const safe = sanitizeHref(href);
    return safe
      ? <a href={safe} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
      : <span>{children}</span>;
  },
  img: ({ src, alt }) => {
    const value = typeof src === 'string' ? src : '';
    if (!isAllowedImageSrc(value) || stickyImageId(value)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs opacity-60 italic">
          <ImageOff size={12} /> {alt || 'Ảnh'}
        </span>
      );
    }
    return <img src={value} alt={alt || ''} loading="lazy" />;
  },
  input: ({ checked, type }) => (type === 'checkbox' ? <input type="checkbox" checked={!!checked} readOnly disabled /> : null),
};

// Giữ nguyên URL để components tự lọc (mặc định react-markdown xoá scheme lạ như sticky-img://)
const keepUrl = (url: string) => url;

export const StickyMarkdownView: React.FC<{ markdown: string; className?: string }> = ({ markdown, className = '' }) => (
  <div className={`sticky-md ${className}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={keepUrl}>
      {markdown}
    </ReactMarkdown>
  </div>
);
