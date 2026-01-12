import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Bell, Timer as TimerIcon, Coffee, Brain, Zap, Clock, Maximize2, Minimize2, Quote } from 'lucide-react';

type TimerMode = 'WORK' | 'BREAK';
type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED';

interface Preset {
    id: string;
    name: string;
    work: number;
    break: number;
    icon: any;
    color: string;
}

const PRESETS: Preset[] = [
    { id: 'POMO_SHORT', name: 'Pomo Ngắn', work: 25, break: 5, icon: TimerIcon, color: 'text-red-500 bg-red-50 border-red-200' },
    { id: 'POMO_LONG', name: 'Pomo Dài', work: 50, break: 10, icon: TimerIcon, color: 'text-orange-500 bg-orange-50 border-orange-200' },
    { id: 'DEEP_WORK', name: 'Deep Work', work: 90, break: 20, icon: Brain, color: 'text-indigo-500 bg-indigo-50 border-indigo-200' },
    { id: 'ACTIVE_PASSIVE', name: 'Active-Mix', work: 40, break: 10, icon: Zap, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
];

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

const FocusTimer: React.FC = () => {
    // State Initialization from LocalStorage
    const [status, setStatus] = useState<TimerStatus>(() => {
        const saved = localStorage.getItem('focus_timer_status');
        return (saved as TimerStatus) || 'IDLE';
    });
    const [mode, setMode] = useState<TimerMode>(() => {
        const saved = localStorage.getItem('focus_timer_mode');
        return (saved as TimerMode) || 'WORK';
    });

    // Time Logic: Store 'targetTime' for Running, 'remainingTime' for Paused
    const [timeLeft, setTimeLeft] = useState(() => {
        const savedTarget = localStorage.getItem('focus_timer_target');
        const savedRemaining = localStorage.getItem('focus_timer_remaining');

        if (localStorage.getItem('focus_timer_status') === 'RUNNING' && savedTarget) {
            const diff = Math.ceil((parseInt(savedTarget) - Date.now()) / 1000);
            return diff > 0 ? diff : 0;
        }
        return savedRemaining ? parseInt(savedRemaining) : 25 * 60;
    });

    const [totalTime, setTotalTime] = useState(() => {
        const saved = localStorage.getItem('focus_timer_total');
        return saved ? parseInt(saved) : 25 * 60;
    });

    const [currentPreset, setCurrentPreset] = useState<Preset>(() => {
        const saved = localStorage.getItem('focus_timer_preset');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Re-attach icon (hacky but simple since icon is component)
            const found = PRESETS.find(p => p.id === parsed.id);
            return found || PRESETS[0];
        }
        return PRESETS[0];
    });

    const [customMinutes, setCustomMinutes] = useState(30);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [quote, setQuote] = useState(QUOTES[0]);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize Audio & Notify Permission
    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/219/219-preview.mp3');
        audio.volume = 1.0;
        audioRef.current = audio;
    }, []);

    // Persistence Effect (Save on Change)
    useEffect(() => {
        localStorage.setItem('focus_timer_status', status);
        localStorage.setItem('focus_timer_mode', mode);
        localStorage.setItem('focus_timer_total', totalTime.toString());
        localStorage.setItem('focus_timer_preset', JSON.stringify({ ...currentPreset, icon: undefined })); // Don't save icon component

        // Target/Remaining handled in specific actions or tick
        if (status === 'PAUSED' || status === 'IDLE') {
            localStorage.setItem('focus_timer_remaining', timeLeft.toString());
            localStorage.removeItem('focus_timer_target');
        }
    }, [status, mode, totalTime, currentPreset, timeLeft]);

    // Timer Tick Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (status === 'RUNNING') {
            // First run adjustment or recover
            const savedTarget = localStorage.getItem('focus_timer_target');
            if (!savedTarget) {
                // If just switched to RUNNING, set target
                const target = Date.now() + timeLeft * 1000;
                localStorage.setItem('focus_timer_target', target.toString());
            }

            interval = setInterval(() => {
                const target = parseInt(localStorage.getItem('focus_timer_target') || '0');
                if (target) {
                    const diff = Math.ceil((target - Date.now()) / 1000);
                    if (diff <= 0) {
                        handleTimerComplete();
                    } else {
                        setTimeLeft(diff);
                    }
                }
            }, 500); // Check more frequently for smoothness
        }

        return () => clearInterval(interval);
    }, [status]); // Only re-run if status changes

    // Rotate Quote
    useEffect(() => {
        if (isFullScreen && status === 'RUNNING') {
            const interval = setInterval(() => {
                setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [isFullScreen, status]);

    const handleTimerComplete = () => {
        setStatus('IDLE');
        localStorage.removeItem('focus_timer_target');
        localStorage.setItem('focus_timer_remaining', '0');

        if (audioRef.current) audioRef.current.play().catch(e => console.log('Audio blocked', e));

        const saved = localStorage.getItem('smartlife_noti_settings');
        const enabled = saved ? JSON.parse(saved).focus_timer : true;

        if (enabled && Notification.permission === 'granted') {
            new Notification(mode === 'WORK' ? '🎉 Hoàn thành phiên làm việc!' : '⏰ Hết giờ nghỉ!', {
                body: mode === 'WORK' ? `Bạn đã tập trung ${currentPreset.work} phút. Hãy nghỉ ngơi chút nhé!` : 'Quay lại làm việc thôi nào!',
                icon: '/pwa-192x192.png'
            });
        }

        // Auto Switch Mode
        if (mode === 'WORK') {
            setMode('BREAK');
            const breakSec = currentPreset.break * 60;
            setTimeLeft(breakSec);
            setTotalTime(breakSec);
        } else {
            setMode('WORK');
            const workSec = currentPreset.work * 60;
            setTimeLeft(workSec);
            setTotalTime(workSec);
        }
    };

    const selectPreset = (preset: Preset) => {
        setCurrentPreset(preset);
        setMode('WORK');
        setStatus('IDLE');
        const sec = preset.work * 60;
        setTimeLeft(sec);
        setTotalTime(sec);
        // Clear storage
        localStorage.removeItem('focus_timer_target');
        localStorage.setItem('focus_timer_remaining', sec.toString());
    };

    const handleCustomStart = () => {
        const sec = customMinutes * 60;
        setTotalTime(sec);
        setTimeLeft(sec);
        setMode('WORK');
        setStatus('RUNNING');
        // Set Target immediately
        const target = Date.now() + sec * 1000;
        localStorage.setItem('focus_timer_target', target.toString());
    };

    const toggleTimer = () => {
        if (status === 'RUNNING') {
            setStatus('PAUSED');
            localStorage.removeItem('focus_timer_target');
            localStorage.setItem('focus_timer_remaining', timeLeft.toString());
        } else {
            setStatus('RUNNING');
            const target = Date.now() + timeLeft * 1000;
            localStorage.setItem('focus_timer_target', target.toString());
        }
    };

    const resetTimer = () => {
        setStatus('IDLE');
        setMode('WORK');
        const sec = currentPreset.work * 60;
        setTimeLeft(sec);
        setTotalTime(sec);
        localStorage.removeItem('focus_timer_target');
        localStorage.setItem('focus_timer_remaining', sec.toString());
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Full Screen Classes
    const containerClasses = isFullScreen
        ? "fixed inset-0 z-50 bg-gray-900 text-white flex flex-col items-center justify-center p-8 transition-all duration-300"
        : "bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6 relative overflow-hidden transition-all duration-300";

    return (
        <div className={containerClasses}>
            {/* Background Decor (Only in Normal Mode) */}
            {!isFullScreen && (
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 transition-colors
          ${mode === 'WORK' ? (status === 'RUNNING' ? 'bg-indigo-500' : 'bg-gray-200') : 'bg-emerald-500'}
        `}></div>
            )}

            {/* Header & Controls */}
            <div className={`flex justify-between items-center w-full mb-4 ${isFullScreen ? 'absolute top-6 px-8' : ''}`}>
                <h3 className={`text-xl font-bold flex items-center gap-2 relative z-10 ${isFullScreen ? 'text-white' : 'text-gray-800'}`}>
                    <Clock size={24} className={isFullScreen ? 'text-indigo-400' : 'text-indigo-600'} />
                    {isFullScreen ? 'SmartLife Focus' : 'Bấm giờ tập trung'}
                </h3>
                <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 rounded-lg bg-gray-100/10 hover:bg-gray-100/20 transition-all z-20">
                    {isFullScreen ? <Minimize2 size={24} /> : <Maximize2 size={20} className="text-gray-500" />}
                </button>
            </div>

            {/* Main Display */}
            <div className="flex flex-col items-center mb-6 relative z-10 w-full max-w-md">
                <div className={`font-mono font-bold tracking-tighter mb-2 transition-all duration-300 flex items-center justify-center
          ${isFullScreen ? 'text-[12rem] leading-none mb-8' : 'text-6xl text-indigo-600'}
          ${mode === 'BREAK' && !isFullScreen ? 'text-emerald-600' : ''}
        `}>
                    {formatTime(timeLeft)}
                </div>

                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide mb-4">
                    {mode === 'WORK' ? <Brain size={isFullScreen ? 24 : 16} /> : <Coffee size={isFullScreen ? 24 : 16} />}
                    <span className={isFullScreen ? 'text-xl' : 'text-gray-500'}>{mode === 'WORK' ? 'Thời gian học' : 'Thời gian nghỉ'}</span>
                    <span className={`px-2 py-0.5 rounded text-white text-xs ${status === 'RUNNING' ? 'bg-green-500' : 'bg-gray-400'} ${isFullScreen ? 'scale-125 ml-2' : ''}`}>
                        {status === 'IDLE' ? 'Sẵn sàng' : status === 'RUNNING' ? 'Đang chạy' : 'Tạm dừng'}
                    </span>
                </div>

                {/* Quote in Full Screen */}
                {isFullScreen && mode === 'WORK' && (
                    <div className="text-center animate-fade-in mt-8 p-6 bg-white/5 rounded-2xl border border-white/10 max-w-2xl">
                        <Quote size={32} className="text-indigo-400 mb-2 mx-auto opacity-50" />
                        <p className="text-2xl font-medium text-indigo-100 italic">"{quote}"</p>
                    </div>
                )}

                {/* Progress Bar (Hidden in FS if huge timer is enough, or keep small) */}
                {!isFullScreen && (
                    <div className="w-full h-2 bg-gray-100 rounded-full mt-4 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${mode === 'WORK' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                            style={{ width: `${100 - (timeLeft / totalTime) * 100}%` }}
                        ></div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className={`flex justify-center gap-4 mb-6 relative z-10 ${isFullScreen ? 'scale-125' : ''}`}>
                <button onClick={toggleTimer} className={`p-4 rounded-xl text-white shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2
          ${status === 'RUNNING' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}
        `}>
                    {status === 'RUNNING' ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                    {isFullScreen && <span className="font-bold">{status === 'RUNNING' ? 'Tạm dừng' : 'Bắt đầu'}</span>}
                </button>
                <button onClick={resetTimer} className="p-4 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all">
                    <RotateCcw />
                </button>
            </div>

            {/* Presets (Hidden in Full Screen to reduce clutter, or show minimal) */}
            {!isFullScreen && (
                <div className="grid grid-cols-2 gap-2 relative z-10 w-full">
                    {PRESETS.map(p => {
                        const Icon = p.icon;
                        const isActive = currentPreset.id === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => selectPreset(p)}
                                className={`flex flex-col items-center p-2 rounded-xl border transition-all
                        ${isActive ? p.color + ' ring-2 ring-offset-1 ring-indigo-100' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}
                    `}
                            >
                                <div className="flex items-center gap-1 mb-1">
                                    <Icon size={14} />
                                    <span className="text-xs font-bold">{p.name}</span>
                                </div>
                                <span className="text-[10px] font-medium">{p.work}p / {p.break}p</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Custom Input (Hidden in Full Screen) */}
            {!isFullScreen && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 items-center relative z-10 w-full">
                    <input
                        type="number"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(Number(e.target.value))}
                        className="w-16 p-2 rounded-lg bg-gray-50 border border-gray-200 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                        min="1" max="180"
                    />
                    <span className="text-xs text-gray-400 font-bold">phút</span>
                    <button
                        onClick={handleCustomStart}
                        className="flex-1 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
                    >
                        Tự đặt giờ
                    </button>
                </div>
            )}
        </div>
    );
};

export default FocusTimer;
