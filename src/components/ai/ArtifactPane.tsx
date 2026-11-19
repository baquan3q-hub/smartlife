// File: src/components/ai/ArtifactPane.tsx
// Khung báo cáo (artifact) AI lập: cột bên phải trên desktop, ngăn kéo toàn màn hình trên mobile

import React, { useState } from 'react';
import { Check, Copy, Download, FileText, X } from 'lucide-react';
import type { ChartData } from '../../services/aiEngine';
import InlineChatChart from '../InlineChatChart';
import MarkdownMessage from './MarkdownMessage';

export interface Artifact {
    title: string;
    content: string;
}

// Báo cáo có thể là JSON biểu đồ thay vì Markdown
export function parseChartArtifact(text: string): ChartData | null {
    try {
        const clean = text.trim();
        if (!clean.startsWith('{') || !clean.endsWith('}')) return null;
        const parsed = JSON.parse(clean);
        if (parsed && (parsed.chartType || parsed.chart_type) && parsed.title && Array.isArray(parsed.data)) {
            return { chart_type: parsed.chartType || parsed.chart_type || 'bar', title: parsed.title, data: parsed.data };
        }
    } catch { /* không phải JSON */ }
    return null;
}

const ArtifactBody: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
    const chart = parseChartArtifact(artifact.content);
    if (chart) {
        return (
            <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm max-w-full overflow-hidden">
                <InlineChatChart chart={chart} />
            </div>
        );
    }
    return <MarkdownMessage content={artifact.content} variant="doc" />;
};

interface ArtifactPaneProps {
    artifact: Artifact;
    isDesktop: boolean;
    onClose: () => void;
}

const ArtifactPane: React.FC<ArtifactPaneProps> = ({ artifact, isDesktop, onClose }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(artifact.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([artifact.content], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${artifact.title.replace(/\s+/g, '_')}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const header = (large: boolean) => (
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={14} className="bg-transparent text-blue-700" />
                </div>
                <h2 className="font-bold text-gray-800 text-sm truncate" title={artifact.title}>{artifact.title}</h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button onClick={handleCopy} className={`${large ? 'p-2' : 'p-1.5'} hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors`} title="Sao chép báo cáo">
                    {copied ? <Check size={large ? 16 : 14} className="text-emerald-500" /> : <Copy size={large ? 16 : 14} />}
                </button>
                <button onClick={handleDownload} className={`${large ? 'p-2' : 'p-1.5'} hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors`} title="Tải xuống Markdown">
                    <Download size={large ? 16 : 14} />
                </button>
                <button onClick={onClose} className={`${large ? 'p-2' : 'p-1.5 ml-1'} hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors`} title="Đóng báo cáo">
                    <X size={large ? 18 : 14} />
                </button>
            </div>
        </div>
    );

    return (
        <>
            {isDesktop && (
                <div className="hidden lg:flex flex-col w-[45%] lg:max-w-2xl shrink-0 bg-white border border-gray-100 rounded-t-2xl shadow-sm overflow-hidden animate-fade-in-left">
                    {header(false)}
                    <div className="flex-1 overflow-y-auto p-6 prose prose-sm md:prose-base custom-scrollbar">
                        <ArtifactBody artifact={artifact} />
                    </div>
                </div>
            )}

            <div className="lg:hidden fixed inset-0 z-[100] flex flex-col bg-white animate-fade-in-up">
                {header(true)}
                <div className="flex-1 overflow-y-auto p-5 prose prose-sm md:prose-base custom-scrollbar pb-10">
                    <ArtifactBody artifact={artifact} />
                </div>
            </div>
        </>
    );
};

export default ArtifactPane;
