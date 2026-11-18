// File: src/components/ai/Composer.tsx
// Ô soạn tin: đính kèm tệp, nhập bằng giọng nói, chọn tốc độ trả lời (Nhanh / Nghĩ vừa / Nghĩ sâu), Gửi / Dừng

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Plus, Send, Square, X } from 'lucide-react';
import type { Lang } from '../../i18n/i18n';
import type { AITier } from '../../services/geminiService';
import { TIER_OPTIONS } from './tiers';

export const MAX_FILE_SIZE = 30 * 1024 * 1024;

interface ComposerProps {
    lang: Lang;
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    attachedFiles: File[];
    setAttachedFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isLoading: boolean;
    tier: AITier;
    onTierChange: (tier: AITier) => void;
    onSend: () => void;
    onStop: () => void;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

const Composer: React.FC<ComposerProps> = ({
    lang, input, setInput, attachedFiles, setAttachedFiles,
    isLoading, tier, onTierChange, onSend, onStop, inputRef,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadMenuRef = useRef<HTMLDivElement>(null);
    const [showUploadMenu, setShowUploadMenu] = useState(false);

    // ── Nhập bằng giọng nói ──
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = lang === 'vi' ? 'vi-VN' : lang === 'ko' ? 'ko-KR' : 'en-US';
        rec.onresult = (event: any) => {
            let text = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) text += event.results[i][0].transcript;
            }
            if (text) setInput(prev => prev + (prev ? ' ' : '') + text);
        };
        rec.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') setIsRecording(false);
        };
        rec.onend = () => setIsRecording(false);
        recognitionRef.current = rec;
        return () => { try { rec.abort(); } catch { /* đã dừng */ } };
    }, [lang, setInput]);

    const toggleRecording = () => {
        const rec = recognitionRef.current;
        if (!rec) {
            alert(lang === 'vi' ? 'Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.' : 'Your browser does not support Speech Recognition.');
            return;
        }
        if (isRecording) {
            rec.stop();
            setIsRecording(false);
            return;
        }
        try {
            rec.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error starting recognition:', err);
            setIsRecording(false);
        }
    };

    // ── Tệp đính kèm ──
    useEffect(() => {
        if (!showUploadMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) setShowUploadMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUploadMenu]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const valid: File[] = [];
        const oversized: File[] = [];
        for (const file of Array.from(files)) (file.size <= MAX_FILE_SIZE ? valid : oversized).push(file);
        if (oversized.length) {
            alert(`Các tệp sau vượt quá giới hạn 30MB và không được đính kèm:\n- ${oversized.map(f => f.name).join('\n- ')}`);
        }
        setAttachedFiles(prev => [...prev, ...valid]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileSelect = (type: 'image' | 'document' | 'audio') => {
        const el = fileInputRef.current;
        if (!el) return;
        el.accept = type === 'image'
            ? 'image/*'
            : type === 'document'
                ? 'application/pdf,text/plain,text/csv,.csv,.xlsx,.xls,.json,.md'
                : 'audio/*';
        el.click();
        setShowUploadMenu(false);
    };

    const canSend = !!input.trim() || attachedFiles.length > 0;

    return (
        <div className="p-3 md:p-4 bg-white border-t border-gray-100 shrink-0">
            {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-100 max-h-32 overflow-y-auto custom-scrollbar">
                    {attachedFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs shadow-sm max-w-[200px] animate-fade-in">
                            <span className="truncate font-medium text-gray-700" title={file.name}>{file.name}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">({(file.size / 1024).toFixed(0)}KB)</span>
                            <button
                                type="button"
                                onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                                className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                aria-label={`Bỏ tệp ${file.name}`}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="relative flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                {showUploadMenu && (
                    <div
                        ref={uploadMenuRef}
                        className="absolute bottom-14 left-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-150 p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col gap-0.5"
                    >
                        <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tải lên tệp tin</div>
                        {([
                            ['image', '🖼️', 'Hình ảnh (Ảnh chụp, TKB...)'],
                            ['document', '📄', 'Tài liệu (PDF, Excel, TXT...)'],
                            ['audio', '🎙️', 'Âm thanh (Audio, Ghi âm...)'],
                        ] as const).map(([type, icon, label]) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => triggerFileSelect(type)}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left"
                            >
                                <span className="text-base">{icon}</span> {label}
                            </button>
                        ))}
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept="image/*,audio/*,application/pdf,text/plain,text/csv,.csv,.xlsx,.xls,.json,.md"
                />
                <button
                    type="button"
                    onClick={() => setShowUploadMenu(v => !v)}
                    disabled={isLoading}
                    className={`m-1 p-2 rounded-xl transition-all shrink-0 ${showUploadMenu ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'}`}
                    title="Đính kèm tài liệu, ảnh hoặc âm thanh"
                >
                    <Plus size={20} className={`transition-transform duration-200 ${showUploadMenu ? 'rotate-45' : ''}`} />
                </button>

                <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isLoading}
                    className={`m-1 p-2 rounded-xl transition-all shrink-0 ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'}`}
                    title={lang === 'vi' ? 'Nhận diện giọng nói' : 'Voice Typing'}
                >
                    <Mic size={20} />
                </button>

                {isRecording && (
                    <div className="absolute inset-y-0.5 left-0.5 right-0.5 bg-white/95 backdrop-blur-sm flex items-center justify-between px-4 z-10 animate-fade-in rounded-[10px] border border-red-100">
                        <div className="flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <span className="text-xs font-bold text-gray-600 animate-pulse">
                                {lang === 'vi' ? 'Đang lắng nghe giọng nói...' : lang === 'ko' ? '음성을 듣고 있습니다...' : 'Listening to your voice...'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={toggleRecording}
                            className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                        >
                            {lang === 'vi' ? 'Hoàn thành' : lang === 'ko' ? '완료' : 'Done'}
                        </button>
                    </div>
                )}

                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!isLoading) onSend();
                        }
                    }}
                    placeholder="Nhập đi bạn ơi, hoặc đính kèm ảnh, âm thanh, tài liệu...."
                    className="flex-1 bg-transparent px-1 py-2.5 text-sm outline-none resize-none max-h-28 min-h-[44px] placeholder:text-gray-400"
                    rows={1}
                />
                <button
                    type="button"
                    onClick={isLoading ? onStop : onSend}
                    disabled={!isLoading && !canSend}
                    className={`m-1 p-2 rounded-xl transition-all shrink-0 ${isLoading
                        ? 'bg-red-500 hover:bg-red-600 text-white hover:shadow-lg hover:shadow-red-200'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-200 disabled:opacity-40 disabled:hover:shadow-none'
                        }`}
                    title={isLoading ? 'Dừng (giữ phần đã trả lời)' : 'Gửi tin nhắn'}
                >
                    {isLoading ? <Square size={16} className="fill-white text-white" /> : <Send size={16} />}
                </button>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Tốc độ trả lời">
                    {TIER_OPTIONS.map(option => {
                        const active = option.id === tier;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => onTierChange(option.id)}
                                title={`${option.hint} · tốn ${option.weight} lượt`}
                                className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                                    active
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-white border-gray-150 text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {option.label}
                                <span className={`ml-1 ${active ? 'text-blue-400' : 'text-gray-300'}`}>·{option.weight}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[9px] text-gray-400 text-right hidden sm:block">
                    Số sau tên chế độ là số lượt tính · Tệp tối đa 30MB/file
                </p>
            </div>
        </div>
    );
};

export default Composer;
