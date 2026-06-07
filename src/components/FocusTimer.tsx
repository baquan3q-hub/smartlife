import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Brain, Clock, Maximize2, Minimize2, Quote, Music, Timer as TimerIcon, Activity, ExternalLink } from 'lucide-react';
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
    const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const containerClasses = "bg-white rounded-3xl shadow-lg border border-gray-100 p-4 xs:p-5 sm:p-6 mb-6 relative overflow-hidden transition-all duration-300 flex flex-col items-center";

    return (
        <div className={containerClasses}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 transition-colors
      ${engineMode === 'STOPWATCH' ? 'bg-orange-500' : (mode === 'WORK' ? (status === 'RUNNING' ? 'bg-indigo-500' : 'bg-gray-200') : 'bg-emerald-500')}
    `}></div>

            <div className="flex justify-between items-center w-full mb-3 sm:mb-4">
                <h3 className="text-base sm:text-xl font-extrabold flex items-center gap-1.5 sm:gap-2 relative z-10 text-gray-800">
                    <Clock size={20} className="sm:w-6 sm:h-6 text-indigo-600" />
                    Tập trung
                </h3>
                <div className="flex gap-2 z-20">
                    {typeof window !== 'undefined' && 'documentPictureInPicture' in window && (
                        <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('trigger-focus-pip'))}
                            className="p-2 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-500"
                            title="Ghim ngoài màn hình (Luôn nổi)"
                        >
                            <ExternalLink size={20} />
                        </button>
                    )}
                    {onOpenMusic && (
                        <button 
                            onClick={onOpenMusic}
                            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all text-gray-500"
                            title="Mở rộng không gian học tập"
                        >
                            <Maximize2 size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Mode Switcher in Dashboard */}
            <div className="flex bg-gray-50 rounded-xl p-1 mb-4 sm:mb-6 relative z-10 w-full max-w-xs transition-opacity">
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

            <div className="flex flex-col items-center mb-4 sm:mb-6 relative z-10 w-full max-w-md">
                <div className={`font-mono font-black tracking-tighter mb-2 transition-all duration-300 flex items-center justify-center text-5xl xs:text-6xl sm:text-7xl text-indigo-600
          ${engineMode === 'STOPWATCH' ? 'text-orange-600' : (mode === 'BREAK' ? 'text-emerald-600' : '')}
        `}>
                    {formatTime(timeLeft)}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] xs:text-[10px] font-black uppercase tracking-widest mb-3 sm:mb-4">
                    <span className="text-gray-400">
                        {engineMode === 'STOPWATCH' ? 'Đã học được' : (mode === 'WORK' ? 'Đang học' : 'Đang nghỉ')}
                    </span>
                    <span className={`px-1.5 sm:px-2 py-0.5 rounded text-white text-[8px] xs:text-[10px] font-bold ${status === 'RUNNING' ? 'bg-green-500' : 'bg-gray-400'}`}>
                        {status === 'IDLE' ? 'SẴN SÀNG' : status === 'RUNNING' ? 'CHẠY' : 'DỪNG'}
                    </span>
                </div>

                {engineMode === 'TIMER' && (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-4 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${mode === 'WORK' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                            style={{ width: `${100 - (timeLeft / totalTime) * 100}%` }}
                        ></div>
                    </div>
                )}
            </div>

            <div className="flex justify-center gap-4 sm:gap-6 mb-6 sm:mb-8 relative z-10">
                <button onClick={toggleTimer} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl text-white shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center
          ${status === 'RUNNING' ? 'bg-amber-50 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}
        `}>
                    {status === 'RUNNING' ? <Pause size={24} fill="currentColor" className="sm:w-7 sm:h-7" /> : <Play size={24} fill="currentColor" className="ml-1 sm:w-7 sm:h-7" />}
                </button>
                <button onClick={resetTimer} className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center shadow-md">
                    <RotateCcw size={20} className="sm:w-6 sm:h-6" />
                </button>
            </div>

            {engineMode === 'TIMER' && (
                <div className="grid grid-cols-2 gap-1.5 xs:gap-2 relative z-10 w-full mb-3 sm:mb-4">
                    {PRESETS.map(p => {
                        const isActive = currentPreset.id === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => selectPreset(p)}
                                className={`flex flex-col items-center p-1.5 xs:p-2 sm:p-2.5 rounded-lg xs:rounded-xl border transition-all
                        ${isActive ? p.color + ' ring-2 ring-offset-1 ring-indigo-50' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}
                    `}
                            >
                                <span className="text-[9px] xs:text-[10px] font-black mb-0.5 uppercase tracking-tighter">{p.name}</span>
                                <span className="text-[8px] xs:text-[9px] font-medium opacity-60">{p.work}p / {p.break}p</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {engineMode === 'TIMER' && (
                <div className="pt-3 sm:pt-4 border-t border-gray-100 flex flex-wrap xs:flex-nowrap gap-2 items-center relative z-10 w-full">
                    <div className="flex items-center gap-2 shrink-0">
                        <input
                            type="number"
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(Number(e.target.value))}
                            className="w-14 xs:w-16 p-1.5 xs:p-2 rounded-lg xs:rounded-xl bg-gray-50 border border-gray-200 text-center text-xs xs:text-sm font-black outline-none focus:ring-2 focus:ring-indigo-200"
                            min="1" max="180"
                        />
                        <span className="text-[9px] xs:text-[10px] text-gray-400 font-black uppercase">PHÚT</span>
                    </div>
                    <button
                        onClick={() => startCustom(customMinutes)}
                        className="w-full xs:flex-1 py-2 xs:py-2.5 bg-gray-900 text-white rounded-lg xs:rounded-xl text-[10px] xs:text-xs font-black uppercase tracking-wider hover:bg-black transition-colors shadow-lg"
                    >
                        Bắt đầu nhanh
                    </button>
                </div>
            )}
        </div>
    );
};

export default FocusTimer;
