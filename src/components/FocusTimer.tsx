import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Brain, Clock, Maximize2, Minimize2, Quote, Music, Timer as TimerIcon, Activity } from 'lucide-react';
import { useFocusTimer, TimerStatus, TimerMode, Preset, PRESETS } from '../hooks/useFocusTimer';

interface FocusTimerProps {
    timer: ReturnType<typeof useFocusTimer>;
    onOpenMusic?: () => void;
}

const QUOTES = [
    "Không có áp lực, không có kim cương. 💎",
    "Tương lai được mua bằng hiện tại. Tập trung nào! 🚀",
    "Học tập là việc cả đời. Đừng bỏ cuộc! 💪",
    "Mỗi phút lười biếng là một bước lùi. Đi tiếp đi! 🏃",
    "Thành công không đến từ những gì bạn biết, mà từ những gì bạn làm. 🔥",
    "Deep Work: Tắt điện thoại và thay đổi cuộc đời. 📵",
    "Chỉ 25 phút nữa thôi, cố lên! ⏳",
    "Bạn của ngày mai sẽ cảm ơn bạn của hôm nay. ✨"
];

const FocusTimer: React.FC<FocusTimerProps> = ({ timer, onOpenMusic }) => {
    const {
        status, mode, timeLeft, totalTime, currentPreset, engineMode,
        toggleTimer, resetTimer, selectPreset, startCustom, switchEngineMode
    } = timer;

    const [customMinutes, setCustomMinutes] = useState(30);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const containerClasses = isFullScreen
        ? "fixed inset-0 z-[100] bg-gray-900 text-white flex flex-col items-center justify-center p-8 transition-all duration-300 pointer-events-auto"
        : "bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6 relative overflow-hidden transition-all duration-300";

    return (
        <div className={containerClasses}>
            {!isFullScreen && (
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 transition-colors
          ${engineMode === 'STOPWATCH' ? 'bg-orange-500' : (mode === 'WORK' ? (status === 'RUNNING' ? 'bg-indigo-500' : 'bg-gray-200') : 'bg-emerald-500')}
        `}></div>
            )}

            <div className={`flex justify-between items-center w-full mb-4 ${isFullScreen ? 'absolute top-6 px-8' : ''}`}>
                <h3 className={`text-xl font-extrabold flex items-center gap-2 relative z-10 ${isFullScreen ? 'text-white' : 'text-gray-800'}`}>
                    <Clock size={24} className={isFullScreen ? 'text-indigo-400' : 'text-indigo-600'} />
                    {isFullScreen ? 'SmartLife Focus' : 'Tập trung'}
                </h3>
                <div className="flex gap-2 z-20">
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all text-gray-500">
                        {isFullScreen ? <Minimize2 size={24} className="text-white" /> : <Maximize2 size={20} />}
                    </button>
                </div>
            </div>

            {/* Mode Switcher in Dashboard */}
            <div className={`flex bg-gray-50 rounded-xl p-1 mb-6 relative z-10 w-full max-w-xs transition-opacity ${isFullScreen ? 'scale-125 mb-12 bg-white/5 border border-white/10' : ''}`}>
                <button
                    onClick={() => switchEngineMode('TIMER')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${engineMode === 'TIMER' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <TimerIcon size={14} />
                    Hẹn giờ
                </button>
                <button
                    onClick={() => switchEngineMode('STOPWATCH')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${engineMode === 'STOPWATCH' ? 'bg-white shadow text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <Activity size={14} />
                    Bấm giờ học
                </button>
            </div>

            <div className="flex flex-col items-center mb-6 relative z-10 w-full max-w-md">
                <div className={`font-mono font-black tracking-tighter mb-2 transition-all duration-300 flex items-center justify-center
          ${isFullScreen ? 'text-[12rem] leading-none mb-8' : 'text-7xl text-indigo-600'}
          ${engineMode === 'STOPWATCH' ? 'text-orange-600' : (mode === 'BREAK' && !isFullScreen ? 'text-emerald-600' : '')}
        `}>
                    {formatTime(timeLeft)}
                </div>

                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4">
                    <span className={isFullScreen ? 'text-xl text-white/50' : 'text-gray-400'}>
                        {engineMode === 'STOPWATCH' ? 'Đã học được' : (mode === 'WORK' ? 'Đang học' : 'Đang nghỉ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-white font-bold ${status === 'RUNNING' ? 'bg-green-500' : 'bg-gray-400'} ${isFullScreen ? 'scale-150 ml-6' : ''}`}>
                        {status === 'IDLE' ? 'SẴN SÀNG' : status === 'RUNNING' ? 'CHẠY' : 'DỪNG'}
                    </span>
                </div>

                {isFullScreen && mode === 'WORK' && engineMode === 'TIMER' && (
                    <div className="text-center animate-fade-in mt-8 p-8 bg-white/5 rounded-3xl border border-white/10 max-w-2xl">
                        <Quote size={40} className="text-indigo-400 mb-4 mx-auto opacity-30" />
                        <p className="text-3xl font-bold text-indigo-100 italic">"{quote}"</p>
                    </div>
                )}

                {engineMode === 'TIMER' && !isFullScreen && (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-4 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${mode === 'WORK' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                            style={{ width: `${100 - (timeLeft / totalTime) * 100}%` }}
                        ></div>
                    </div>
                )}
            </div>

            <div className={`flex justify-center gap-6 mb-8 relative z-10 ${isFullScreen ? 'scale-150 mt-12' : ''}`}>
                <button onClick={toggleTimer} className={`w-14 h-14 rounded-2xl text-white shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center
          ${status === 'RUNNING' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}
        `}>
                    {status === 'RUNNING' ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={resetTimer} className="w-14 h-14 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center shadow-md">
                    <RotateCcw size={24} />
                </button>
                {onOpenMusic && (
                    <button
                        onClick={onOpenMusic}
                        className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all flex items-center justify-center group shadow-md"
                        title="Mở không gian nhạc chill"
                    >
                        <Music className="group-hover:scale-110 transition-transform" />
                    </button>
                )}
            </div>

            {engineMode === 'TIMER' && !isFullScreen && (
                <div className="grid grid-cols-2 gap-2 relative z-10 w-full mb-4">
                    {PRESETS.map(p => {
                        const isActive = currentPreset.id === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => selectPreset(p)}
                                className={`flex flex-col items-center p-2 rounded-xl border transition-all
                        ${isActive ? p.color + ' ring-2 ring-offset-1 ring-indigo-50' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}
                    `}
                            >
                                <span className="text-[10px] font-black mb-0.5 uppercase tracking-tighter">{p.name}</span>
                                <span className="text-[9px] font-medium opacity-60">{p.work}p / {p.break}p</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {engineMode === 'TIMER' && !isFullScreen && (
                <div className="pt-4 border-t border-gray-100 flex gap-2 items-center relative z-10 w-full">
                    <input
                        type="number"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(Number(e.target.value))}
                        className="w-16 p-2 rounded-xl bg-gray-50 border border-gray-200 text-center text-sm font-black outline-none focus:ring-2 focus:ring-indigo-200"
                        min="1" max="180"
                    />
                    <span className="text-[10px] text-gray-400 font-black uppercase">PHÚT</span>
                    <button
                        onClick={() => startCustom(customMinutes)}
                        className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black transition-colors shadow-lg"
                    >
                        Bắt đầu nhanh
                    </button>
                </div>
            )}
        </div>
    );
};

export default FocusTimer;
