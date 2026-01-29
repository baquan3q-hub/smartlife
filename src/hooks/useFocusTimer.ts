import { useState, useEffect, useRef } from 'react';

export type TimerMode = 'WORK' | 'BREAK';
export type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED';
export type EngineMode = 'TIMER' | 'STOPWATCH';

export interface Preset {
    id: string;
    name: string;
    work: number;
    break: number;
    icon?: any;
    color: string;
}

export const PRESETS: Preset[] = [
    { id: 'POMO_SHORT', name: 'Pomo Ngắn', work: 25, break: 5, color: 'text-red-500 bg-red-50 border-red-200' },
    { id: 'POMO_LONG', name: 'Pomo Dài', work: 50, break: 10, color: 'text-orange-500 bg-orange-50 border-orange-200' },
    { id: 'DEEP_WORK', name: 'Deep Work', work: 90, break: 20, color: 'text-indigo-500 bg-indigo-50 border-indigo-200' },
    { id: 'ACTIVE_PASSIVE', name: 'Active-Mix', work: 40, break: 10, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
];

export const useFocusTimer = () => {
    const [engineMode, setEngineMode] = useState<EngineMode>(() => {
        const saved = localStorage.getItem('focus_timer_engine');
        return (saved as EngineMode) || 'TIMER';
    });

    const [status, setStatus] = useState<TimerStatus>(() => {
        const saved = localStorage.getItem('focus_timer_status');
        return (saved as TimerStatus) || 'IDLE';
    });

    const [mode, setMode] = useState<TimerMode>(() => {
        const saved = localStorage.getItem('focus_timer_mode');
        return (saved as TimerMode) || 'WORK';
    });

    const [timeLeft, setTimeLeft] = useState(() => {
        const savedTarget = localStorage.getItem('focus_timer_target');
        const savedRemaining = localStorage.getItem('focus_timer_remaining');
        const currentEngine = localStorage.getItem('focus_timer_engine') || 'TIMER';

        if (localStorage.getItem('focus_timer_status') === 'RUNNING' && savedTarget) {
            const target = parseInt(savedTarget);
            if (currentEngine === 'STOPWATCH') {
                const baseValue = parseInt(savedRemaining || '0');
                const elapsedSinceTarget = Math.floor((Date.now() - target) / 1000);
                return baseValue + elapsedSinceTarget;
            } else {
                const diff = Math.ceil((target - Date.now()) / 1000);
                return diff > 0 ? diff : 0;
            }
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
            const found = PRESETS.find(p => p.id === parsed.id);
            return found || PRESETS[0];
        }
        return PRESETS[0];
    });

    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/219/219-preview.mp3');
        audio.volume = 1.0;
        audioRef.current = audio;
    }, []);

    // Sync state to LocalStorage
    useEffect(() => {
        localStorage.setItem('focus_timer_engine', engineMode);
        localStorage.setItem('focus_timer_status', status);
        localStorage.setItem('focus_timer_mode', mode);
        localStorage.setItem('focus_timer_total', totalTime.toString());
        localStorage.setItem('focus_timer_preset', JSON.stringify(currentPreset));

        if (status !== 'RUNNING') {
            localStorage.setItem('focus_timer_remaining', timeLeft.toString());
            localStorage.removeItem('focus_timer_target');
        }
    }, [engineMode, status, mode, totalTime, currentPreset, timeLeft]);

    // Unified Tick Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (status === 'RUNNING') {
            interval = setInterval(() => {
                const savedTarget = parseInt(localStorage.getItem('focus_timer_target') || '0');
                const savedRemaining = parseInt(localStorage.getItem('focus_timer_remaining') || '0');

                if (engineMode === 'STOPWATCH') {
                    const elapsed = Math.floor((Date.now() - savedTarget) / 1000);
                    setTimeLeft(savedRemaining + elapsed);
                } else {
                    const diff = Math.ceil((savedTarget - Date.now()) / 1000);
                    if (diff <= 0) {
                        handleTimerComplete();
                    } else {
                        setTimeLeft(diff);
                    }
                }
            }, 500);
        }

        return () => clearInterval(interval);
    }, [status, engineMode]);

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

        if (engineMode === 'TIMER') {
            const nextMode = mode === 'WORK' ? 'BREAK' : 'WORK';
            setMode(nextMode);
            const nextSec = (nextMode === 'WORK' ? currentPreset.work : currentPreset.break) * 60;
            setTimeLeft(nextSec);
            setTotalTime(nextSec);
            localStorage.setItem('focus_timer_remaining', nextSec.toString());
        }
    };

    const toggleTimer = () => {
        if (status === 'RUNNING') {
            setStatus('PAUSED');
            localStorage.removeItem('focus_timer_target');
            localStorage.setItem('focus_timer_remaining', timeLeft.toString());
        } else {
            setStatus('RUNNING');
            localStorage.setItem('focus_timer_remaining', timeLeft.toString());
            if (engineMode === 'STOPWATCH') {
                localStorage.setItem('focus_timer_target', Date.now().toString());
            } else {
                localStorage.setItem('focus_timer_target', (Date.now() + timeLeft * 1000).toString());
            }
        }
    };

    const resetTimer = () => {
        setStatus('IDLE');
        localStorage.removeItem('focus_timer_target');
        if (engineMode === 'STOPWATCH') {
            setTimeLeft(0);
            localStorage.setItem('focus_timer_remaining', '0');
        } else {
            setMode('WORK');
            const sec = currentPreset.work * 60;
            setTimeLeft(sec);
            setTotalTime(sec);
            localStorage.setItem('focus_timer_remaining', sec.toString());
        }
    };

    const selectPreset = (preset: Preset) => {
        setEngineMode('TIMER');
        setCurrentPreset(preset);
        setMode('WORK');
        setStatus('IDLE');
        const sec = preset.work * 60;
        setTimeLeft(sec);
        setTotalTime(sec);
        localStorage.removeItem('focus_timer_target');
        localStorage.setItem('focus_timer_remaining', sec.toString());
    };

    const startCustom = (minutes: number) => {
        setEngineMode('TIMER');
        const sec = minutes * 60;
        setTotalTime(sec);
        setTimeLeft(sec);
        setMode('WORK');
        setStatus('RUNNING');
        localStorage.setItem('focus_timer_remaining', sec.toString());
        localStorage.setItem('focus_timer_target', (Date.now() + sec * 1000).toString());
    };

    const switchEngineMode = (newMode: EngineMode) => {
        if (newMode === engineMode) return;

        setStatus('IDLE');
        setEngineMode(newMode);
        localStorage.removeItem('focus_timer_target');

        if (newMode === 'STOPWATCH') {
            setTimeLeft(0);
            localStorage.setItem('focus_timer_remaining', '0');
        } else {
            const sec = currentPreset.work * 60;
            setTimeLeft(sec);
            setTotalTime(sec);
            localStorage.setItem('focus_timer_remaining', sec.toString());
        }
    };

    return {
        status, mode, timeLeft, totalTime, currentPreset, engineMode,
        toggleTimer, resetTimer, selectPreset, startCustom, switchEngineMode
    };
};
