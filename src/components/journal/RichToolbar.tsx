import React, { useState } from 'react';
import {
    AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Heading1, Heading2, Highlighter, Italic, List, ListOrdered,
    Palette, Strikethrough, Underline,
} from 'lucide-react';

export interface FormatState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikeThrough: boolean;
    list: boolean;
    listOrdered: boolean;
    h1: boolean;
    h2: boolean;
}

export const EMPTY_FORMAT: FormatState = {
    bold: false, italic: false, underline: false, strikeThrough: false, list: false, listOrdered: false, h1: false, h2: false,
};

// Mid-tone colours so the text stays readable in light and dark mode. "Xóa định dạng" resets colour.
const TEXT_COLORS = [
    { color: '#ef4444', label: 'Đỏ' },
    { color: '#f97316', label: 'Cam' },
    { color: '#10b981', label: 'Xanh lá' },
    { color: '#0ea5e9', label: 'Xanh dương' },
    { color: '#8b5cf6', label: 'Tím' },
];

const HIGHLIGHTS = [
    { color: '#fef08a', label: 'Vàng' },
    { color: '#bbf7d0', label: 'Xanh lá' },
    { color: '#bfdbfe', label: 'Xanh dương' },
    { color: '#fbcfe8', label: 'Hồng' },
    { color: 'transparent', label: 'Bỏ tô nền' },
];

interface RichToolbarProps {
    active: FormatState;
    exec: (command: string, value?: string) => void;
}

// Formatting bar for the journal editor. Scrolls sideways on narrow screens; the colour swatches open as a
// second row instead of a popover so they are never clipped by the scroll container.
export const RichToolbar: React.FC<RichToolbarProps> = ({ active, exec }) => {
    const [panel, setPanel] = useState<'color' | 'highlight' | null>(null);
    const toggleBlock = (tag: 'h1' | 'h2') => exec('formatBlock', active[tag] ? '<p>' : `<${tag}>`);

    return (
        <div className="border-y border-zinc-900/[0.06]">
            <div role="toolbar" aria-label="Định dạng" className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] sm:px-3">
                <Tool label="Tiêu đề lớn" on={active.h1} onClick={() => toggleBlock('h1')}><Heading1 size={17} /></Tool>
                <Tool label="Tiêu đề nhỏ" on={active.h2} onClick={() => toggleBlock('h2')}><Heading2 size={17} /></Tool>
                <Divider />
                <Tool label="Đậm (Ctrl+B)" on={active.bold} onClick={() => exec('bold')}><Bold size={16} /></Tool>
                <Tool label="Nghiêng (Ctrl+I)" on={active.italic} onClick={() => exec('italic')}><Italic size={16} /></Tool>
                <Tool label="Gạch chân (Ctrl+U)" on={active.underline} onClick={() => exec('underline')}><Underline size={16} /></Tool>
                <Tool label="Gạch ngang" on={active.strikeThrough} onClick={() => exec('strikeThrough')}><Strikethrough size={16} /></Tool>
                <Divider />
                <Tool label="Danh sách" on={active.list} onClick={() => exec('insertUnorderedList')}><List size={16} /></Tool>
                <Tool label="Danh sách số" on={active.listOrdered} onClick={() => exec('insertOrderedList')}><ListOrdered size={16} /></Tool>
                <Divider />
                <Tool label="Căn trái" onClick={() => exec('justifyLeft')}><AlignLeft size={16} /></Tool>
                <Tool label="Căn giữa" onClick={() => exec('justifyCenter')}><AlignCenter size={16} /></Tool>
                <Tool label="Căn phải" onClick={() => exec('justifyRight')}><AlignRight size={16} /></Tool>
                <Divider />
                <Tool label="Màu chữ" on={panel === 'color'} onClick={() => setPanel(p => (p === 'color' ? null : 'color'))}><Palette size={16} /></Tool>
                <Tool label="Tô nền" on={panel === 'highlight'} onClick={() => setPanel(p => (p === 'highlight' ? null : 'highlight'))}><Highlighter size={16} /></Tool>
                <Tool label="Xóa định dạng" onClick={() => exec('removeFormat')}><Eraser size={16} /></Tool>
            </div>

            {panel && (
                <div className="flex items-center gap-2 border-t border-zinc-900/[0.06] px-3 py-2 sm:px-4">
                    <span className="text-[12px] text-zinc-500">{panel === 'color' ? 'Màu chữ' : 'Tô nền'}</span>
                    {(panel === 'color' ? TEXT_COLORS : HIGHLIGHTS).map(item => (
                        <button
                            key={item.color}
                            type="button"
                            aria-label={item.label}
                            title={item.label}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                                exec(panel === 'color' ? 'foreColor' : 'backColor', item.color);
                                setPanel(null);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100"
                        >
                            <span
                                className={`h-5 w-5 rounded-full ${item.color === 'transparent' ? 'border border-dashed border-zinc-400' : ''}`}
                                style={{ backgroundColor: item.color }}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const Tool: React.FC<{ label: string; on?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, on, onClick, children }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={on}
        // Keep the editor selection when a toolbar button is pressed.
        onMouseDown={e => e.preventDefault()}
        onClick={onClick}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${on ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
    >
        {children}
    </button>
);

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-zinc-200" aria-hidden />;
