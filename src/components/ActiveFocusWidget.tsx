import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, X, Minimize2, Clock, Sparkles, ExternalLink, Move, Brain, Coffee, Activity, Music } from 'lucide-react';
import { useFocusTimer } from '../hooks/useFocusTimer';

interface ActiveFocusWidgetProps {
    timer: ReturnType<typeof useFocusTimer>;
    activeTab: string;
}

export const ActiveFocusWidget: React.FC<ActiveFocusWidgetProps> = ({ timer, activeTab }) => {
    const {
        status, mode, timeLeft, totalTime, currentPreset, engineMode,
        toggleTimer, resetTimer
    } = timer;

    const [isMinimized, setIsMinimized] = useState(false);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);
    const [isPipMinimized, setIsPipMinimized] = useState(false);

    // Draggable position state
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        const saved = localStorage.getItem('active_focus_widget_pos');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {}
        }
        const defaultX = window.innerWidth - (window.innerWidth < 640 ? 300 : 340);
        // Default Y position is offset from ActiveTaskWidget (which is at -240)
        const defaultY = window.innerHeight - 360;
        return { x: defaultX, y: defaultY };
    });

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const isPiPSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

    // Trigger opening PiP via window Custom Event
    useEffect(() => {
        const handleTriggerPip = () => {
            enterPiP();
        };
        window.addEventListener('trigger-focus-pip', handleTriggerPip);
        return () => window.removeEventListener('trigger-focus-pip', handleTriggerPip);
    }, [status, mode, timeLeft, totalTime, engineMode]);

    // Handle mouse drag start
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Only left click
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
        e.preventDefault();
    };

    // Handle touch drag start for mobile
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        });
    };

    // Drag move and end effects
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            let newX = e.clientX - dragStart.x;
            let newY = e.clientY - dragStart.y;
            
            const widgetWidth = isMinimized ? 150 : 320;
            const widgetHeight = isMinimized ? 50 : 210;
            newX = Math.max(10, Math.min(newX, window.innerWidth - widgetWidth - 10));
            newY = Math.max(10, Math.min(newY, window.innerHeight - widgetHeight - 10));
            
            const newPos = { x: newX, y: newY };
            setPosition(newPos);
            localStorage.setItem('active_focus_widget_pos', JSON.stringify(newPos));
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            let newX = touch.clientX - dragStart.x;
            let newY = touch.clientY - dragStart.y;
            
            const widgetWidth = isMinimized ? 150 : 320;
            const widgetHeight = isMinimized ? 50 : 210;
            newX = Math.max(10, Math.min(newX, window.innerWidth - widgetWidth - 10));
            newY = Math.max(10, Math.min(newY, window.innerHeight - widgetHeight - 10));
            
            const newPos = { x: newX, y: newY };
            setPosition(newPos);
            localStorage.setItem('active_focus_widget_pos', JSON.stringify(newPos));
        };

        const handleDragEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleDragEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, dragStart, isMinimized]);

    // Keep within bounds when resizing window
    useEffect(() => {
        const handleResize = () => {
            setPosition(prev => {
                const widgetWidth = isMinimized ? 150 : 320;
                const widgetHeight = isMinimized ? 50 : 210;
                const newX = Math.max(10, Math.min(prev.x, window.innerWidth - widgetWidth - 10));
                const newY = Math.max(10, Math.min(prev.y, window.innerHeight - widgetHeight - 10));
                return { x: newX, y: newY };
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMinimized]);

    // Auto minimize after 10s if running to prevent screen blocking
    useEffect(() => {
        if (status === 'RUNNING' && !isMinimized && !pipWindow) {
            const autoMinTimer = setTimeout(() => {
                setIsMinimized(true);
            }, 10000);
            return () => clearTimeout(autoMinTimer);
        }
    }, [status, isMinimized, pipWindow]);

    // Cleanup PiP window on unmount or timer stop
    useEffect(() => {
        return () => {
            if (pipWindow) {
                pipWindow.close();
            }
        };
    }, [pipWindow]);

    const isTimerActive = status === 'RUNNING' || status === 'PAUSED';

    useEffect(() => {
        if (!isTimerActive && pipWindow) {
            pipWindow.close();
            setPipWindow(null);
        }
    }, [isTimerActive, pipWindow]);

    if (!isTimerActive) return null;

    const formatTime = (totalSeconds: number) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Open Picture-in-Picture window
    const enterPiP = async () => {
        if (!isPiPSupported) return;

        try {
            // Close existing
            if (pipWindow) {
                pipWindow.close();
            }

            const w = await (window as any).documentPictureInPicture.requestWindow({
                width: 350,
                height: 220,
            });

            // Copy style sheets
            try {
                Array.from(document.styleSheets).forEach((styleSheet) => {
                    try {
                        if (styleSheet.cssRules) {
                            const newStyleEl = w.document.createElement('style');
                            Array.from(styleSheet.cssRules).forEach((rule) => {
                                newStyleEl.appendChild(w.document.createTextNode(rule.cssText));
                            });
                            w.document.head.appendChild(newStyleEl);
                        }
                    } catch (e) {}
                });
            } catch (e) {}

            // Copy external links
            try {
                Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach((linkEl: any) => {
                    const newLink = w.document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = linkEl.href;
                    w.document.head.appendChild(newLink);
                });
            } catch (e) {}

            // Setup document body
            w.document.title = "SmartLife - Tập trung nổi";
            w.document.body.className = "bg-slate-900 text-white overflow-hidden m-0 p-0 font-sans select-none";

            // Add listener for PiP close
            w.addEventListener('pagehide', () => {
                setPipWindow(null);
                setIsPipMinimized(false);
            });

            setPipWindow(w);
        } catch (err) {
            console.error('Error starting Document PiP for Focus:', err);
        }
    };

    // Open music space callback
    const openMusicSpace = () => {
        window.dispatchEvent(new CustomEvent('open-music-space'));
    };

    // Dynamic colors & labels config based on state
    const isStopwatch = engineMode === 'STOPWATCH';
    const isBreak = mode === 'BREAK';

    let themeColorClass = 'text-indigo-600';
    let progressBgClass = 'bg-indigo-500';
    let borderThemeClass = 'border-indigo-100';
    let bgGradientClass = 'from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700';
    let labelText = 'Đang tập trung';
    let subtitleText = engineMode === 'TIMER' ? `Pomodoro: ${currentPreset.name}` : 'Bấm giờ tự do';
    let IconHeader = Brain;

    if (isStopwatch) {
        themeColorClass = 'text-orange-600';
        progressBgClass = 'bg-orange-500';
        borderThemeClass = 'border-orange-100';
        bgGradientClass = 'from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600';
        labelText = 'Bấm giờ học';
        subtitleText = 'Đang ghi nhận thời gian';
        IconHeader = Activity;
    } else if (isBreak) {
        themeColorClass = 'text-emerald-600';
        progressBgClass = 'bg-emerald-500';
        borderThemeClass = 'border-emerald-100';
        bgGradientClass = 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700';
        labelText = 'Đang nghỉ ngơi';
        subtitleText = `Nghỉ ngắn: ${currentPreset.break} phút`;
        IconHeader = Coffee;
    }

    // PiP layout and elements
    if (pipWindow) {
        // 1. Compact PiP Layout (Thanh nhỏ gọn)
        const compactPipContent = (
            <div className="flex items-center justify-between h-screen w-screen bg-slate-950 px-3 py-2 font-sans text-white border border-white/10 box-border select-none">
                {/* Status Dot & Time */}
                <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            status === 'RUNNING' ? (isStopwatch ? 'bg-orange-400' : (isBreak ? 'bg-emerald-400' : 'bg-indigo-400')) : 'hidden'
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                            status === 'RUNNING' 
                                ? (isStopwatch ? 'bg-orange-500' : (isBreak ? 'bg-emerald-500' : 'bg-indigo-500')) 
                                : 'bg-yellow-500'
                        }`}></span>
                    </div>
                    <span className={`font-mono text-xs font-black tabular-nums leading-none ${
                        isStopwatch ? 'text-orange-400' : (isBreak ? 'text-emerald-400' : 'text-indigo-400')
                    }`}>
                        {formatTime(timeLeft)}
                    </span>
                </div>

                {/* Compact Controls */}
                <div className="flex items-center gap-1.5">
                    {status === 'RUNNING' ? (
                        <button
                            onClick={toggleTimer}
                            className="flex items-center justify-center p-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 transition-colors cursor-pointer"
                            title="Tạm dừng"
                        >
                            <Pause size={10} />
                        </button>
                    ) : (
                        <button
                            onClick={toggleTimer}
                            className="flex items-center justify-center p-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 transition-colors cursor-pointer"
                            title="Tiếp tục"
                        >
                            <Play size={10} />
                        </button>
                    )}
                    
                    <button
                        onClick={() => {
                            setIsPipMinimized(false);
                            try {
                                pipWindow.resizeTo(350, 220);
                            } catch (e) {}
                        }}
                        className="text-[9px] text-gray-400 hover:text-white px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-0"
                        title="Mở rộng chi tiết"
                    >
                        Chi tiết
                    </button>
                </div>
            </div>
        );

        // 2. Full Expanded PiP Layout
        const expandedPipContent = (
            <div className="flex flex-col justify-between h-screen w-screen bg-slate-950 p-4 font-sans border border-white/10 box-border text-white select-none">
                {/* Header */}
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <div className={`flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider ${
                        isStopwatch ? 'text-orange-400' : (isBreak ? 'text-emerald-400' : 'text-indigo-400')
                    }`}>
                        <IconHeader size={12} className="animate-pulse" />
                        <span>{labelText}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={() => {
                                setIsPipMinimized(true);
                                try {
                                    pipWindow.resizeTo(180, 55);
                                } catch (e) {}
                            }}
                            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors border-0 cursor-pointer"
                            title="Thu nhỏ thanh nổi"
                        >
                            <Minimize2 size={12} />
                        </button>
                        <button 
                            onClick={() => {
                                pipWindow.close();
                                setPipWindow(null);
                            }}
                            className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-0"
                            title="Thu hồi về Tab"
                        >
                            Thu hồi
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="my-2 flex-grow overflow-y-auto flex flex-col justify-center gap-1 pr-1">
                    <p className="text-sm font-semibold text-white/95 leading-snug m-0">
                        {subtitleText}
                    </p>
                    <p className="text-[10px] text-gray-400 m-0">
                        {status === 'RUNNING' ? 'Thời gian đang chạy...' : 'Đã tạm dừng'}
                    </p>
                </div>

                {/* Time & Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1 ${
                        isStopwatch 
                            ? 'bg-orange-950/80 border-orange-900/50' 
                            : (isBreak ? 'bg-emerald-950/80 border-emerald-900/50' : 'bg-indigo-950/80 border-indigo-900/50')
                    }`}>
                        <Clock size={13} className={`animate-pulse ${
                            isStopwatch ? 'text-orange-400' : (isBreak ? 'text-emerald-400' : 'text-indigo-400')
                        }`} />
                        <span className={`font-mono text-xs font-black tabular-nums ${
                            isStopwatch ? 'text-orange-300' : (isBreak ? 'text-emerald-300' : 'text-indigo-300')
                        }`}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {status === 'RUNNING' ? (
                            <button
                                onClick={toggleTimer}
                                className="flex items-center justify-center p-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 transition-colors cursor-pointer"
                                title="Tạm dừng"
                            >
                                <Pause size={13} />
                            </button>
                        ) : (
                            <button
                                onClick={toggleTimer}
                                className="flex items-center justify-center p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 transition-colors cursor-pointer"
                                title="Tiếp tục"
                            >
                                <Play size={13} />
                            </button>
                        )}
                        <button
                            onClick={resetTimer}
                            className="flex items-center justify-center p-1.5 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border border-gray-500/30 transition-colors cursor-pointer"
                            title="Làm mới"
                        >
                            <RotateCcw size={13} />
                        </button>
                    </div>
                </div>
            </div>
        );

        return (
            <>
                {createPortal(isPipMinimized ? compactPipContent : expandedPipContent, pipWindow.document.body)}
                
                {/* Main app placeholder */}
                <div 
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        bottom: 'auto',
                        right: 'auto',
                        position: 'fixed',
                        cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    className={`z-50 w-72 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl shadow-2xl p-4 text-center select-none border ${
                        isStopwatch ? 'border-orange-500/30' : (isBreak ? 'border-emerald-500/30' : 'border-indigo-500/30')
                    }`}
                >
                    <div className="flex items-center justify-end mb-1">
                        <button 
                            onClick={resetTimer}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="Hủy bỏ/Reset"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                isStopwatch ? 'bg-orange-400' : (isBreak ? 'bg-emerald-400' : 'bg-indigo-400')
                            }`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${
                                isStopwatch ? 'bg-orange-500' : (isBreak ? 'bg-emerald-500' : 'bg-indigo-500')
                            }`}></span>
                        </div>
                        <p className={`text-[10px] font-black uppercase tracking-wider m-0 ${
                            isStopwatch ? 'text-orange-400' : (isBreak ? 'text-emerald-400' : 'text-indigo-400')
                        }`}>Đang ghim bộ đếm tập trung</p>
                        <p className="text-xs text-gray-400 italic m-0">"{labelText}"</p>
                        <button 
                            onClick={() => {
                                pipWindow.close();
                                setPipWindow(null);
                            }}
                            className={`mt-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                isStopwatch 
                                    ? 'bg-orange-600/30 border-orange-500/30 hover:bg-orange-600/50 text-orange-300' 
                                    : (isBreak ? 'bg-emerald-600/30 border-emerald-500/30 hover:bg-emerald-600/50 text-emerald-300' : 'bg-indigo-600/30 border-indigo-500/30 hover:bg-indigo-600/50 text-indigo-300')
                            } hover:text-white`}
                        >
                            Thu hồi về ứng dụng
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Logic to only show on-page floating widget when not on the Lịch trình (schedule) tab
    const showOnPageWidget = activeTab !== 'schedule';
    if (!showOnPageWidget) return null;

    // Minimized widget on page
    if (isMinimized) {
        return (
            <div 
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    bottom: 'auto',
                    right: 'auto',
                    position: 'fixed',
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={() => setIsMinimized(false)}
                className={`z-50 flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r text-white rounded-full shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-105 select-none border border-white/20 ${bgGradientClass}`}
                title={`Bấm giờ: ${labelText}. Click để mở rộng.`}
            >
                <div className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 ${status === 'RUNNING' ? '' : 'hidden'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status === 'RUNNING' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                </div>
                <IconHeader size={15} className={status === 'RUNNING' ? 'animate-pulse' : ''} />
                <span className="font-mono text-xs font-black tracking-wide leading-none">{formatTime(timeLeft)}</span>
            </div>
        );
    }

    // Expanded widget on page
    return (
        <div 
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                bottom: 'auto',
                right: 'auto',
                position: 'fixed',
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`z-50 w-72 md:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border p-4 transition-all duration-300 select-none ${borderThemeClass}`}
        >
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-gray-100">
                <div className={`flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider ${themeColorClass}`}>
                    <Move size={12} className="text-gray-400 animate-pulse" />
                    <IconHeader size={14} className="animate-bounce" />
                    <span>{labelText}</span>
                </div>
                <div className="flex items-center gap-1">
                    {isPiPSupported && (
                        <button
                            onClick={enterPiP}
                            className={`p-1 text-gray-400 hover:${themeColorClass} hover:bg-gray-100 rounded transition-colors border-0 cursor-pointer`}
                            title="Ghim ngoài màn hình (Luôn nổi)"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
                    <button
                        onClick={openMusicSpace}
                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors border-0 cursor-pointer"
                        title="Mở không gian nhạc"
                    >
                        <Music size={14} />
                    </button>
                    <button 
                        onClick={() => setIsMinimized(true)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors border-0 cursor-pointer"
                        title="Thu nhỏ"
                    >
                        <Minimize2 size={14} />
                    </button>
                    <button 
                        onClick={resetTimer}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors border-0 cursor-pointer"
                        title="Reset/Dừng"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="mb-2">
                <p className="text-sm font-semibold text-gray-800 line-clamp-1 leading-relaxed m-0">
                    {subtitleText}
                </p>
            </div>

            {/* Progress bar if TIMER */}
            {engineMode === 'TIMER' && (
                <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ${progressBgClass}`}
                        style={{ width: `${100 - (timeLeft / totalTime) * 100}%` }}
                    ></div>
                </div>
            )}

            {/* Time & Controls */}
            <div className="flex items-center justify-between">
                {/* Timer Display */}
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 ${
                    isStopwatch ? 'bg-orange-50/70 border-orange-100/50' : (isBreak ? 'bg-emerald-50/70 border-emerald-100/50' : 'bg-indigo-50/70 border-indigo-100/50')
                }`}>
                    <Clock size={16} className={`animate-pulse ${
                        isStopwatch ? 'text-orange-600' : (isBreak ? 'text-emerald-600' : 'text-indigo-600')
                    }`} />
                    <span className={`font-mono text-base font-black tabular-nums ${
                        isStopwatch ? 'text-orange-700' : (isBreak ? 'text-emerald-700' : 'text-indigo-700')
                    }`}>
                        {formatTime(timeLeft)}
                    </span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-1.5">
                    {status === 'RUNNING' ? (
                        <button
                            onClick={toggleTimer}
                            className="flex items-center justify-center p-2 rounded-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-colors border-0 cursor-pointer"
                            title="Tạm dừng"
                        >
                            <Pause size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={toggleTimer}
                            className="flex items-center justify-center p-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors border-0 cursor-pointer"
                            title="Tiếp tục"
                        >
                            <Play size={16} />
                        </button>
                    )}
                    <button
                        onClick={resetTimer}
                        className="flex items-center justify-center p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors border-0 cursor-pointer"
                        title="Làm mới"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
