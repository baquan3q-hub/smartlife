// File: src/components/ai/MarkdownMessage.tsx
// Hiển thị Markdown của AI (bảng, danh sách, link Google Maps thành nút) — dùng chung cho bong bóng chat và báo cáo

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Variant = 'chat' | 'doc';

const MapsLink = ({ href, children, ...props }: any) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all no-underline not-prose"
        {...props}
    >
        <span>🗺️</span>
        <span>{children || 'Mở Google Maps chỉ đường'}</span>
        <span className="text-[10px]">↗</span>
    </a>
);

const isMapsUrl = (href?: string) =>
    !!href && (href.includes('google.com/maps') || href.includes('maps.google.com') || href.includes('maps.app.goo.gl'));

function buildComponents(variant: Variant): Components {
    const gap = variant === 'doc' ? 'mb-4' : 'mb-3.5';
    return {
        p: ({ node, ...props }) => <p className={`${gap} leading-relaxed text-gray-700 last:mb-0`} {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-base font-bold text-blue-800 dark:text-sky-300 mt-4 mb-2" {...props} />,
        ul: ({ node, ...props }) => <ul className={`list-disc pl-5 ${gap} space-y-1.5`} {...props} />,
        ol: ({ node, ...props }) => <ol className={`list-decimal pl-5 ${gap} space-y-1.5`} {...props} />,
        li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-bold text-blue-950 dark:text-sky-200" {...props} />,
        table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4"><table className="w-full border-collapse border border-blue-200 text-sm" {...props} /></div>
        ),
        thead: ({ node, ...props }) => <thead className="bg-blue-50" {...props} />,
        th: ({ node, ...props }) => <th className="border border-blue-200 px-4 py-2 text-left font-semibold text-blue-900" {...props} />,
        td: ({ node, ...props }) => <td className="border border-blue-100 px-4 py-2 text-gray-700" {...props} />,
        tr: ({ node, ...props }) => <tr className="even:bg-gray-50/50" {...props} />,
        a: ({ node, href, children, ...props }: any) => {
            if (isMapsUrl(href)) return <MapsLink href={href} {...props}>{children}</MapsLink>;
            return (
                <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5" {...props}>
                    {children}
                </a>
            );
        },
    };
}

const COMPONENTS: Record<Variant, Components> = {
    chat: buildComponents('chat'),
    doc: buildComponents('doc'),
};

interface MarkdownMessageProps {
    content: string;
    variant?: Variant;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, variant = 'chat' }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS[variant]}>
        {content}
    </ReactMarkdown>
);

export default React.memo(MarkdownMessage);
