import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Check, X, Minimize2, Clock, Sparkles, ExternalLink, Move, Calendar, AlertCircle, Zap, Coffee, Layers } from 'lucide-react';
import { Todo } from '../types';

interface ActiveTaskWidgetProps {
    activeTask: Todo | null;
    status: 'IDLE' | 'RUNNING' | 'PAUSED';
    elapsedTime: number;
    isTracking: boolean;
    pauseTracking: () => void;
    resumeTracking: () => void;
    completeTracking: () => void;
    cancelTracking: () => void;
}

const PRIORITY_LIGHT: Record<string, { label: string; className: string }> = {
    urgent: { label: 'Ưu tiên', className: 'bg-red-50 text-red-700 border-red-200' },
    high: { label: 'Ưu tiên', className: 'bg-red-50 text-red-700 border-red-200' },
    focus: { label: 'Tập trung', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    medium: { label: 'Tập trung', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    chill: { label: 'Chill', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    low: { label: 'Chill', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    temp: { label: 'Tạm thời', className: 'bg-gray-50 text-gray-700 border-gray-200' }
};

const PRIORITY_DARK: Record<string, { label: string; className: string }> = {
    urgent: { label: 'Ưu tiên', className: 'bg-red-950/40 text-red-400 border-red-500/20' },
    high: { label: 'Ưu tiên', className: 'bg-red-950/40 text-red-400 border-red-500/20' },
    focus: { label: 'Tập trung', className: 'bg-blue-950/40 text-blue-400 border-blue-500/20' },
    medium: { label: 'Tập trung', className: 'bg-blue-950/40 text-blue-400 border-blue-500/20' },
    chill: { label: 'Chill', className: 'bg-purple-950/40 text-purple-400 border-purple-500/20' },
    low: { label: 'Chill', className: 'bg-purple-950/40 text-purple-400 border-purple-500/20' },
    temp: { label: 'Tạm thời', className: 'bg-slate-900/60 text-slate-400 border-slate-500/20' }
};

const PriorityBadge: React.FC<{ priority: string; isDark?: boolean }> = ({ priority, isDark }) => {
    const config = isDark ? PRIORITY_DARK[priority] : PRIORITY_LIGHT[priority];
    if (!config) return null;
    
    let Icon = Zap;
    if (priority === 'urgent' || priority === 'high') Icon = AlertCircle;
    else if (priority === 'chill' || priority === 'low') Icon = Coffee;
    else if (priority === 'temp') Icon = Layers;

    return (
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border w-fit ${config.className}`}>
            <Icon size={10} />
            <span>{config.label}</span>
        </span>
    );
};

export const ActiveTaskWidget: React.FC<ActiveTaskWidgetProps> = ({
    activeTask,
    status,
    elapsedTime,
    pauseTracking,
    resumeTracking,
    completeTracking,
    cancelTracking
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);
    const [isPipMinimized, setIsPipMinimized] = useState(false);

    // Draggable position state
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        const saved = localStorage.getItem('active_task_widget_pos');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {}
        }
        const defaultX = window.innerWidth - (window.innerWidth < 640 ? 300 : 340);
        const defaultY = window.innerHeight - 240;
        return { x: defaultX, y: defaultY };
    });

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const isPiPSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

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
            localStorage.setItem('active_task_widget_pos', JSON.stringify(newPos));
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
            localStorage.setItem('active_task_widget_pos', JSON.stringify(newPos));
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
            const timer = setTimeout(() => {
                setIsMinimized(true);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [status, isMinimized, pipWindow]);

    // Cleanup PiP window on unmount or activeTask deletion
    useEffect(() => {
        return () => {
            if (pipWindow) {
                pipWindow.close();
            }
        };
    }, [pipWindow]);

    useEffect(() => {
        if (!activeTask && pipWindow) {
            pipWindow.close();
            setPipWindow(null);
        }
    }, [activeTask, pipWindow]);

    if (!activeTask) return null;

    const formatTime = (totalSeconds: number) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTotalTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) {
            const remainingMins = mins % 60;
            return `${hrs}h ${remainingMins}p`;
        }
        if (mins > 0) {
            return `${mins} phút`;
        }
        return `${seconds}s`;
    };

    const formatDeadline = (deadlineStr?: string) => {
        if (!deadlineStr) return '';
        try {
            const date = new Date(deadlineStr);
            return date.toLocaleString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit', 
                day: '2-digit', 
                month: '2-digit' 
            });
        } catch (e) {
            return deadlineStr;
        }
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
            w.document.title = "SmartLife - Cửa sổ đếm giờ";
            w.document.body.className = "bg-slate-900 text-white overflow-hidden m-0 p-0 font-sans select-none";

            // Add listener for PiP close
            w.addEventListener('pagehide', () => {
                setPipWindow(null);
                setIsPipMinimized(false);
            });

            setPipWindow(w);
        } catch (err) {
            console.error('Error starting Document PiP:', err);
        }
    };

    // Render PIP portal if active
    if (pipWindow) {
        // 1. Compact PiP Layout (Thanh nhỏ gọn)
        const compactPipContent = (
            <div className="flex items-center justify-between h-screen w-screen bg-slate-950 px-3 py-2 font-sans text-white border border-white/10 box-border select-none">
                {/* Status Dot & Time */}
                <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 ${status === 'RUNNING' ? '' : 'hidden'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'RUNNING' ? 'bg-blue-500' : 'bg-yellow-500'}`}></span>
                    </div>
                    <span className="font-mono text-xs font-black text-blue-300 tabular-nums leading-none">
                        {formatTime(elapsedTime)}
                    </span>
                </div>

                {/* Compact Controls */}
                <div className="flex items-center gap-1.5">
                    {status === 'RUNNING' ? (
                        <button
                            onClick={pauseTracking}
                            className="flex items-center justify-center p-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 transition-colors cursor-pointer"
                            title="Tạm dừng"
                        >
                            <Pause size={10} />
                        </button>
                    ) : (
                        <button
                            onClick={resumeTracking}
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
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
                        <Sparkles size={12} className="animate-pulse" />
                        <span>Đang thực hiện</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={() => {
                                setIsPipMinimized(true);
                                try {
                                    pipWindow.resizeTo(180, 55); // Resize to compact dimensions
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
                <div className="my-2 flex-grow overflow-y-auto flex flex-col justify-center gap-1.5 pr-1">
                    <p className="text-sm font-semibold text-white/95 leading-snug m-0">
                        {activeTask.content}
                    </p>
                    
                    {/* Metadata Badges in PiP */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <PriorityBadge priority={activeTask.priority} isDark={true} />
                        
                        {activeTask.deadline && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold border text-gray-300 border-white/10 bg-white/5 w-fit">
                                <Calendar size={9} className="text-gray-400" />
                                <span>{formatDeadline(activeTask.deadline)}</span>
                            </span>
                        )}
                        
                        {activeTask.time_spent !== undefined && activeTask.time_spent > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold border text-blue-300 border-blue-500/20 bg-blue-500/10 w-fit">
                                <span>Tích lũy: {formatTotalTime(activeTask.time_spent)}</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Time & Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-900/50 rounded-xl px-2.5 py-1">
                        <Clock size={13} className={`text-blue-400 ${status === 'RUNNING' ? 'animate-pulse' : ''}`} />
                        <span className="font-mono text-xs font-black text-blue-300 tabular-nums">
                            {formatTime(elapsedTime)}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {status === 'RUNNING' ? (
                            <button
                                onClick={pauseTracking}
                                className="flex items-center justify-center p-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 transition-colors cursor-pointer"
                                title="Tạm dừng"
                            >
                                <Pause size={13} />
                            </button>
                        ) : (
                            <button
                                onClick={resumeTracking}
                                className="flex items-center justify-center p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 transition-colors cursor-pointer"
                                title="Tiếp tục"
                            >
                                <Play size={13} />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                completeTracking();
                                pipWindow.close();
                                setPipWindow(null);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs border-0 cursor-pointer shadow-md shadow-blue-500/20"
                            title="Hoàn thành ✓"
                        >
                            <Check size={12} />
                            <span>Xong</span>
                        </button>
                    </div>
                </div>
            </div>
        );

        return (
            <>
                {/* Portal render to PiP window */}
                {createPortal(isPipMinimized ? compactPipContent : expandedPipContent, pipWindow.document.body)}

                {/* Placeholder widget in main app window */}
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
                    className="z-50 w-72 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl shadow-2xl border border-blue-500/30 p-4 text-center select-none"
                >
                    <div className="flex items-center justify-end mb-1">
                        <button 
                            onClick={cancelTracking}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="Hủy bỏ"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-400 m-0">Đang ghim ngoài màn hình</p>
                        <p className="text-xs text-gray-400 line-clamp-1 italic m-0">"{activeTask.content}"</p>
                        <button 
                            onClick={() => {
                                pipWindow.close();
                                setPipWindow(null);
                            }}
                            className="mt-2 px-4 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Thu hồi về ứng dụng
                        </button>
                    </div>
                </div>
            </>
        );
    }

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
                className="z-50 flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-105 select-none border border-white/20"
                title={`Đang làm: ${activeTask.content}. Click để mở rộng.`}
            >
                <div className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 ${status === 'RUNNING' ? '' : 'hidden'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status === 'RUNNING' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                </div>
                <Clock size={15} className={status === 'RUNNING' ? 'animate-pulse' : ''} />
                <span className="font-mono text-xs font-black tracking-wide leading-none">{formatTime(elapsedTime)}</span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        completeTracking();
                    }}
                    className="ml-1 p-1 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center border-0 cursor-pointer"
                    title="Hoàn thành nhiệm vụ"
                >
                    <Check size={13} className="text-white font-extrabold" />
                </button>
            </div>
        );
    }

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
            className="z-50 w-72 md:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-100 p-4 transition-all duration-300 select-none"
        >
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-gray-100">
                <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs uppercase tracking-wider">
                    <Move size={12} className="text-gray-400" />
                    <Sparkles size={14} className="animate-pulse text-blue-500" />
                    <span>Đang thực hiện</span>
                </div>
                <div className="flex items-center gap-1">
                    {isPiPSupported && (
                        <button
                            onClick={enterPiP}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors border-0 cursor-pointer"
                            title="Ghim ngoài màn hình (Luôn nổi)"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
                    <button 
                        onClick={() => setIsMinimized(true)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors border-0 cursor-pointer"
                        title="Thu nhỏ"
                    >
                        <Minimize2 size={14} />
                    </button>
                    <button 
                        onClick={cancelTracking}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors border-0 cursor-pointer"
                        title="Hủy bỏ"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="mb-2">
                <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-relaxed m-0">
                    {activeTask.content}
                </p>
            </div>

            {/* Metadata (Priority, Deadline, Total Time) */}
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <PriorityBadge priority={activeTask.priority} />
                
                {activeTask.deadline && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold border text-gray-500 border-gray-200 bg-gray-50 w-fit">
                        <Calendar size={10} className="text-gray-400" />
                        <span>{formatDeadline(activeTask.deadline)}</span>
                    </span>
                )}
                
                {activeTask.time_spent !== undefined && activeTask.time_spent > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold border text-blue-600 border-blue-100 bg-blue-50/50 w-fit" title="Tổng thời gian tích lũy trước đó">
                        <span>Tích lũy: {formatTotalTime(activeTask.time_spent)}</span>
                    </span>
                )}
            </div>

            {/* Time & Controls */}
            <div className="flex items-center justify-between">
                {/* Timer Display */}
                <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-100/50 rounded-xl px-3 py-1.5">
                    <Clock size={16} className={`text-blue-600 ${status === 'RUNNING' ? 'animate-pulse' : ''}`} />
                    <span className="font-mono text-base font-black text-blue-700 tabular-nums">
                        {formatTime(elapsedTime)}
                    </span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-1.5">
                    {status === 'RUNNING' ? (
                        <button
                            onClick={pauseTracking}
                            className="flex items-center justify-center p-2 rounded-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-colors border-0 cursor-pointer"
                            title="Tạm dừng"
                        >
                            <Pause size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={resumeTracking}
                            className="flex items-center justify-center p-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors border-0 cursor-pointer"
                            title="Tiếp tục"
                        >
                            <Play size={16} />
                        </button>
                    )}
                    <button
                        onClick={completeTracking}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-md shadow-blue-500/20 border-0 cursor-pointer"
                        title="Hoàn thành ✓"
                    >
                        <Check size={14} />
                        <span>Xong</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
