import React, { useState } from 'react';
import {
    ChevronLeft, Play, Pause, RotateCcw, Sparkles, ExternalLink, GraduationCap
} from 'lucide-react';
import { useFocusTimer, PRESETS, Preset } from '../hooks/useFocusTimer';

// --- PROPS (unchanged for backward compatibility) ---
interface MusicSpaceProps {
    onBack: () => void;
    timer: ReturnType<typeof useFocusTimer>;
    formatTime: (seconds: number) => string;
}

// --- COMPONENT ---
const MusicSpace: React.FC<MusicSpaceProps> = ({ onBack, timer, formatTime }) => {

    // --- RENDER ---
    return (
        <div className="fixed inset-0 z-[9999] bg-black text-white font-sans overflow-hidden flex flex-col h-[100dvh]">

            {/* === ANIMATED GRADIENT BACKGROUND === */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#1a1140] to-[#302b63] z-0" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(120,80,220,0.15),transparent_60%)] z-0" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(60,120,220,0.1),transparent_50%)] z-0" />

            {/* === TOP BAR === */}
            <div className="relative z-20 flex justify-between items-center px-4 md:px-6 py-3 shrink-0 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all border border-white/5 cursor-pointer active:scale-95">
                    <ChevronLeft size={16} />
                    <span className="font-bold text-sm">Thoát</span>
                </button>

                <div className="flex items-center gap-2 text-white/60">
                    <Sparkles size={16} className="text-indigo-400" />
                    <span className="text-sm font-bold">Không gian học tập</span>
                </div>

                {/* Placeholder for symmetry */}
                <div className="w-[88px]" />
            </div>

            {/* === MAIN CONTENT: Timer Only === */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 relative z-10">

                {/* Mode Switcher */}
                <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-full mb-8 relative z-10">
                    <button
                        onClick={() => timer.switchEngineMode('TIMER')}
                        className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${timer.engineMode === 'TIMER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                    >
                        Hẹn giờ
                    </button>
                    <button
                        onClick={() => timer.switchEngineMode('STOPWATCH')}
                        className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${timer.engineMode === 'STOPWATCH' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                    >
                        Bấm giờ học
                    </button>
                </div>

                {/* Timer Display */}
                <div className="relative group p-4 z-10">
                    <div className="text-[80px] md:text-[140px] font-black tabular-nums tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 select-none transition-transform group-hover:scale-[1.02] duration-500 drop-shadow-2xl">
                        {formatTime(timer.timeLeft || 0)}
                    </div>

                    {timer.status === 'RUNNING' && (
                        <div className="mt-4 text-center animate-fade-in">
                            <span className="inline-block px-5 py-2 rounded-full text-sm font-bold tracking-widest uppercase backdrop-blur-md border border-white/10 bg-indigo-500/20 text-indigo-300 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                {timer.engineMode === 'STOPWATCH' ? "Đang học..." : "Đang tập trung"}
                            </span>
                        </div>
                    )}
                </div>

                {/* Timer Controls */}
                <div className="flex items-center gap-5 mt-8 z-10">
                    {timer.status === 'IDLE' && timer.timeLeft === 0 && timer.engineMode === 'TIMER' ? (
                        <div className="flex gap-3 flex-wrap justify-center">
                            {PRESETS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => timer.selectPreset(p)}
                                    className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border ${p.color} bg-opacity-10 hover:bg-opacity-20 hover:scale-105 active:scale-95 backdrop-blur-md`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={timer.toggleTimer}
                                className={`px-8 py-4 rounded-full font-bold text-lg transition-all active:scale-95 shadow-xl flex items-center gap-3 ${timer.status === 'RUNNING'
                                    ? 'bg-white text-black hover:bg-gray-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:ring-4 hover:ring-indigo-500/30'
                                    }`}
                            >
                                {timer.status === 'RUNNING' ? (
                                    <><Pause size={20} fill="currentColor" /> Tạm dừng</>
                                ) : (
                                    <><Play size={20} fill="currentColor" /> Bắt đầu {timer.engineMode === 'STOPWATCH' ? 'học' : 'Focus'}</>
                                )}
                            </button>
                            <button
                                onClick={timer.resetTimer}
                                className="p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md active:scale-95 hover:rotate-180 duration-500"
                                title="Làm mới"
                            >
                                <RotateCcw size={24} />
                            </button>
                        </>
                    )}
                </div>

                {/* Presets (Quick Switch) */}
                {timer.status === 'IDLE' && timer.timeLeft !== 0 && timer.engineMode === 'TIMER' && (
                    <div className="flex gap-3 mt-8 z-10 flex-wrap justify-center">
                        {PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => timer.selectPreset(p)}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border bg-opacity-10 hover:bg-opacity-20 hover:scale-105 backdrop-blur-md ${timer.currentPreset.id === p.id ? p.color : 'border-white/10 text-white/50 hover:text-white'}`}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* === CTA SECTION === */}
                <div className="mt-20 z-10 animate-fade-in flex flex-col items-center max-w-lg text-center bg-white/5 px-8 pb-8 pt-10 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 absolute -top-8">
                        <GraduationCap size={32} className="text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-bold mb-2 text-white">Cần không gian chuyên nghiệp hơn?</h3>
                    <p className="text-white/60 mb-8 text-sm leading-relaxed">
                        Trải nghiệm nền tảng học tập với đầy đủ công cụ hỗ trợ tối đa sự tập trung, được thiết kế đặc biệt từ FPT Education.
                    </p>
                    
                    <a
                        href="https://tramhoc.fpt.edu.vn"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 px-8 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:bg-indigo-50 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                    >
                        Vào Trạm Học FPT
                        <ExternalLink size={20} className="text-indigo-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default MusicSpace;
