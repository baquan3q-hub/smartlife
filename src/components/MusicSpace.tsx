import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, Volume2, VolumeX, Music, Play, Pause, Sparkles,
    RotateCcw, Image as ImageIcon, Video as VideoIcon, Timer as TimerIcon,
    Activity, ChevronRight, List, X, Maximize2, Minimize2,
    Mic2, CloudRain, Film, Headphones, ExternalLink, Upload
} from 'lucide-react';
import { useFocusTimer, PRESETS, Preset } from '../hooks/useFocusTimer';
import ReactPlayer from 'react-player';

import { supabase } from '../services/supabase';




// --- CONFIGURATION ---

const CATEGORIES = [
    { id: 'Chill Study', name: 'Chill Lofi', icon: <Sparkles size={16} /> },
    { id: 'Podcast', name: 'Podcast', icon: <Mic2 size={16} /> },
    { id: 'Nature', name: 'Nature Sound', icon: <CloudRain size={16} /> },
] as const;

type CategoryType = typeof CATEGORIES[number]['id'];

const PLAYLISTS_DATA: Record<CategoryType, { title: string; src: string; type: 'youtube' | 'local' }[]> = {
    'Chill Study': [
        // --- HƯỚNG DẪN THÊM NHẠC TỪ MÁY TÍNH (M4A, MP3) ---
        // 1. Copy file nhạc vào thư mục: public/music (nếu chưa có thì tạo thư mục 'music' trong 'public')
        // 2. Sửa đường dẫn 'src' thành: "/music/ten-bai-hat.m4a"
        // 3. Đổi 'type' thành: "local"
        // Ví dụ: { title: "Bài hát của tôi", src: "/music/my-song.m4a", type: "local" },

        { title: "Lofi Study Beats", src: "https://www.youtube.com/watch?v=sUwD3GRPJos", type: "youtube" },
        { title: "Brain Wave Alpha Music", src: "https://www.youtube.com/watch?v=ihZYtrWTbkY", type: "youtube" },
        { title: "Coffee Shop Ambience", src: "https://www.youtube.com/watch?v=lE6RYpe9IT0", type: "youtube" },
    ],
    'Podcast': [
        { title: "Những bài học không có trên trường học", src: "https://www.youtube.com/watch?v=Yg_qsDPOIqo", type: "youtube" },
        { title: "Chữa lành là trở về với chính mình", src: "https://www.youtube.com/watch?v=HBqsm_e3pqI", type: "youtube" },
        { title: "3 điều cần tìm để biết mình là ai", src: "https://www.youtube.com/watch?v=jL4c_4zco_4", type: "youtube" },
    ],
    'Nature': [
        { title: "Tiếng mưa rơi cửa sổ (Không sấm sét)", src: "https://www.youtube.com/watch?v=J4d-a7dVtiQ", type: "youtube" },
        { title: "Mưa rơi trên mái tôn (Hoài niệm)", src: "https://www.youtube.com/watch?v=jCvDvd6rDhU", type: "youtube" },
    ],
}

const BG_IMAGES = [
    '/music/bg-1.jpg',
    '/music/bg-2.jpg',
    '/music/bg-3.jpg',
    '/music/bg-4.jpg',
    '/music/bg-5.jpg',
];

// --- COMPONENTS ---

interface MusicSpaceProps {
    onBack?: () => void;
    timer?: ReturnType<typeof useFocusTimer>;
    formatTime?: (seconds: number) => string;
    embedded?: boolean;
    showTimer?: boolean;
}

const MusicSpace: React.FC<MusicSpaceProps> = ({ onBack, timer, formatTime, embedded = false, showTimer = false }) => {
    // const { timeLeft... } removed


    // --- STATE ---
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bgType, setBgType] = useState<'video' | 'image'>('video');
    const [imageIndex, setImageIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);

    // Playlist State
    const [activeCategory, setActiveCategory] = useState<CategoryType>('Chill Study');
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [playlist, setPlaylist] = useState(PLAYLISTS_DATA['Chill Study']);

    // Custom Link State
    const [customLink, setCustomLink] = useState('');

    // UI Mode State
    const [showPlaylist, setShowPlaylist] = useState(false);
    // const [viewMode, setViewMode] = useState<'TIMER' | 'CINEMA'>('TIMER'); // Removed


    // Player Ref
    const playerRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ReactPlayerComponent = ReactPlayer as any;

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- HANDLERS ---

    const handleAddCustomLink = () => {
        if (!customLink.trim()) return;
        const newTrack = { title: "Custom Track", src: customLink.trim(), type: "youtube" as const };
        setPlaylist(prev => [newTrack, ...prev]);
        setCurrentTrackIndex(0);
        setIsPlaying(true);
        setCustomLink('');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            const newTrack = {
                title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                src: objectUrl,
                type: 'local' as const
            };
            setPlaylist(prev => [newTrack, ...prev]);
            setCurrentTrackIndex(0);
            setIsPlaying(true);

            // Clear input so same file can be selected again if needed
            e.target.value = '';
        }
    };

    const selectCategory = async (cat: CategoryType) => {
        setActiveCategory(cat);
        setPlaylist(PLAYLISTS_DATA[cat]);
        setCurrentTrackIndex(0);
        setIsPlaying(true);
        setPlayerError(null);
    };

    const playTrack = (index: number) => {
        setCurrentTrackIndex(index);
        setIsPlaying(true);
        setPlayerError(null);
    };

    const handleNext = () => {
        setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
        setIsPlaying(true);
        setPlayerError(null);
    };

    const handlePrev = () => {
        setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
        setIsPlaying(true);
        setPlayerError(null);
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        setCurrentTime(time);
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
            try {
                playerRef.current.seekTo(time);
            } catch (err) {
                console.warn("Seek failed:", err);
            }
        }
    };

    const formatTimeAudio = (t: number) => {
        if (!t || isNaN(t)) return "00:00";
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const currentTrack = playlist[currentTrackIndex] || { title: "No Track Selected", src: "", type: "local" };
    const hasTrack = playlist.length > 0 && currentTrack.src;

    return (
        <div className={`${embedded ? 'relative w-full h-[600px] rounded-3xl shadow-xl border border-gray-800 my-6 z-0' : 'fixed inset-0 z-[9999] h-[100dvh]'} bg-black text-white font-sans overflow-hidden flex flex-col transition-all duration-300`}> {/* Use dvh for mobile address bar */}

            {/* --- 1. THE PLAYER (CONSOLIDATED) --- */}
            {/* --- 1. KEY COMPONENT: THE PLAYER --- */}
            {/* Always visible in the center */}
            {/* Always visible in the center (UNLESS ShowTimer is on, then it's hidden but playing) */}
            <div className={`relative z-50 flex-1 flex flex-col items-center justify-center p-4 ${showTimer ? 'hidden' : 'flex'}`}>

                {hasTrack ? (
                    <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative group">

                        {/* Loading / Error States */}
                        {isLoading && !playerError && (
                            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
                                <Activity className="animate-spin text-indigo-500" size={32} />
                            </div>
                        )}

                        {playerError && (
                            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 text-center p-6">
                                <p className="text-red-400 mb-2 font-bold">Không thể phát video này</p>
                                <p className="text-white/40 text-sm mb-4">{playerError}</p>
                                <div className="flex gap-3">
                                    <button onClick={() => window.open(currentTrack.src, '_blank')} className="px-4 py-2 bg-white/10 rounded-full text-sm hover:bg-white/20 transition-colors">
                                        Mở External Link
                                    </button>
                                    <button onClick={handleNext} className="px-4 py-2 bg-indigo-600 rounded-full text-sm hover:bg-indigo-500 transition-colors">
                                        Bài kế tiếp
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="absolute inset-0 z-10 pointer-events-auto">
                            <ReactPlayerComponent
                                key={currentTrack.src}
                                ref={playerRef}
                                url={currentTrack.src}
                                playing={isPlaying}
                                volume={isMuted ? 0 : 0.8}
                                muted={isMuted}
                                width="100%"
                                height="100%"
                                controls={true}
                                onStart={() => setIsLoading(false)}
                                onBuffer={() => setIsLoading(true)}
                                onBufferEnd={() => setIsLoading(false)}
                                onReady={() => {
                                    setIsLoading(false);
                                    setIsPlaying(true);
                                }}
                                onProgress={(state: any) => {
                                    setCurrentTime(state.playedSeconds);
                                    if (isLoading) setIsLoading(false);
                                }}
                                onDuration={(d: any) => setDuration(d)}
                                onEnded={handleNext}
                                onError={(e: any) => {
                                    console.error("Player Error:", e);
                                    setIsLoading(false);
                                    setPlayerError("Video bị hạn chế hoặc lỗi kết nối.");
                                }}
                                config={{
                                    file: {
                                        attributes: {
                                            controlsList: 'nodownload'
                                        }
                                    },
                                    youtube: {
                                        playerVars: {
                                            playsinline: 1,
                                            autoplay: 1,
                                            rel: 0,
                                            origin: window.location.origin
                                        }
                                    }
                                }}
                            />
                        </div>

                    </div>
                ) : (
                    <div className="text-white/40 italic">Chọn một bài nhạc từ danh sách...</div>
                )}

            </div>

            {/* --- 2. BACKGROUND LAYER --- */}
            <div className="absolute inset-0 z-0 pointer-events-none select-none">
                {bgType === 'video' ? (
                    <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-50">
                        <source src="/music/background-video.mp4" type="video/mp4" />
                    </video>
                ) : (
                    <img
                        src={BG_IMAGES[imageIndex]}
                        className="w-full h-full object-cover opacity-50 transition-all duration-1000"
                        alt="bg"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/60" />
            </div>

            {/* --- 3. TOP NAVIGATION --- */}
            <div className="relative z-20 flex justify-between items-center p-4 md:p-6 shrink-0">
                {!embedded && onBack && (
                    <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all border border-white/5 cursor-pointer active:scale-95">
                        <ChevronLeft size={16} />
                        <span className="font-bold text-xs md:text-sm">Thoát</span>
                    </button>
                )}

                <div className="flex bg-black/40 backdrop-blur-xl rounded-full p-1 border border-white/10">
                    <button onClick={() => setBgType('video')} className={`p-2 rounded-full transition-all active:scale-90 ${bgType === 'video' ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white'}`}>
                        <VideoIcon size={14} />
                    </button>
                    <button onClick={() => setBgType('image')} className={`p-2 rounded-full transition-all active:scale-90 ${bgType === 'image' ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white'}`}>
                        <ImageIcon size={14} />
                    </button>
                    {bgType === 'image' && (
                        <button onClick={() => setImageIndex((i) => (i + 1) % BG_IMAGES.length)} className="px-3 border-l border-white/10 text-[10px] md:text-xs font-bold text-white/60 hover:text-white active:text-indigo-400">
                            Đổi Ảnh
                        </button>
                    )}
                </div>
            </div>

            {/* --- 4. MAIN CONTENT AREA --- */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-4 min-h-0 overflow-y-auto hide-scrollbar">

                {/* --- TIMER OVERLAY (FULL SCREEN FOCUS MODE) --- */}
                {showTimer && timer && (
                    <div className="flex flex-col items-center justify-center animate-fade-in w-full max-w-none px-4 mx-auto z-20">
                        {/* Mode Switcher (Timer vs Stopwatch) */}
                        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-full mb-8">
                            <button
                                onClick={() => timer.switchEngineMode('TIMER')}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${timer.engineMode === 'TIMER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                            >
                                Hẹn giờ
                            </button>
                            <button
                                onClick={() => timer.switchEngineMode('STOPWATCH')}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${timer.engineMode === 'STOPWATCH' ? 'text-white bg-indigo-600 shadow-lg' : 'text-white/60 hover:text-white'}`}
                            >
                                Bấm giờ học
                            </button>
                        </div>

                        {/* Timer Display */}
                        <div className="relative group p-4">
                            <div className="text-[100px] md:text-[160px] font-black tabular-nums tracking-tighter leading-snug text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl select-none transition-transform group-hover:scale-105 duration-500 py-2">
                                {formatTime ? formatTime(timer.timeLeft || 0) : "00:00"}
                            </div>

                            {timer.status === 'RUNNING' && (
                                <div className="mt-8 text-center animate-fade-in-up">
                                    <span className="inline-block px-5 py-2 rounded-full text-sm font-bold tracking-widest uppercase backdrop-blur-md border border-white/10 transition-colors bg-indigo-500/20 text-indigo-300 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                        {timer.engineMode === 'STOPWATCH' ? "Đang học..." : "Đang tập trung"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-6 mt-10">
                            {timer.status === 'IDLE' && timer.timeLeft === 0 && timer.engineMode === 'TIMER' ? (
                                <div className="flex gap-3">
                                    {PRESETS.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => timer.selectPreset(p)}
                                            className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all border ${p.color} bg-opacity-10 hover:bg-opacity-20 hover:scale-105 active:scale-95`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={timer.toggleTimer}
                                        className={`px-8 py-4 rounded-full font-bold text-xl transition-all active:scale-95 shadow-xl hover:shadow-2xl flex items-center gap-3 ${timer.status === 'RUNNING' ? 'bg-white text-black hover:bg-gray-200' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:ring-4 hover:ring-indigo-500/30'}`}
                                    >
                                        {timer.status === 'RUNNING' ? (
                                            <><Minimize2 className="fill-current w-5 h-5" /> Tạm dừng</>
                                        ) : (
                                            <><Play className="fill-current w-5 h-5" /> Bắt đầu {timer.engineMode === 'STOPWATCH' ? 'học' : 'Focus'}</>
                                        )}
                                    </button>
                                    <button
                                        onClick={timer.resetTimer}
                                        className="p-5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md active:scale-95 hover:rotate-180 duration-500"
                                        title="Làm mới"
                                    >
                                        <RotateCcw size={28} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* --- UNIFIED MUSIC CONTROLS (COMPACT & NO SEEK) --- */}
                        <div className="w-full max-w-md mt-6 p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-3 animate-fade-in-up delay-100 shadow-2xl">
                            {/* Top: Info & Secondary Actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                                        <Music size={20} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase leading-none mb-1">{activeCategory}</span>
                                        <h4 className="font-bold text-white text-sm truncate">{currentTrack.title}</h4>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowPlaylist(!showPlaylist)} className={`p-2 rounded-full transition-all active:scale-95 ${showPlaylist ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`} title="Danh sách phát">
                                        <List size={18} />
                                    </button>
                                    <button onClick={toggleMute} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white/60 hover:text-white active:scale-95" title="Âm lượng">
                                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* REMOVED SEEK BAR HERE */}

                            {/* Bottom: Main Controls (Compact) */}
                            <div className="flex items-center justify-center gap-6 pt-2">
                                <button onClick={handlePrev} className="text-white/40 hover:text-white transition-colors p-2 hover:scale-110 active:scale-95"><ChevronLeft size={24} /></button>
                                <button onClick={() => setIsPlaying(!isPlaying)} className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center active:scale-95 transition-all shadow-lg hover:bg-indigo-500 hover:scale-105 hover:shadow-indigo-500/40">
                                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                                </button>
                                <button onClick={handleNext} className="text-white/40 hover:text-white transition-colors p-2 hover:scale-110 active:scale-95"><ChevronRight size={24} /></button>
                            </div>
                        </div>

                        {/* Presets (Quick Switch) - Only show in TIMER mode */}
                        {timer.status === 'IDLE' && timer.timeLeft !== 0 && timer.engineMode === 'TIMER' && (
                            <div className="flex gap-3 mt-8 animate-fade-in">
                                {PRESETS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => timer.selectPreset(p)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border bg-opacity-10 hover:bg-opacity-20 hover:scale-105 ${timer.currentPreset.id === p.id ? p.color : 'border-white/10 text-white/50 hover:text-white'}`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* --- FULLSCREEN PLAYLIST (When showTimer is TRUE) --- */}
                {showTimer && (
                    <div className="w-full max-w-7xl mt-8 animate-fade-in-up z-20 pb-32">
                        {/* Categories Pills */}
                        <div className="flex items-center justify-center flex-wrap gap-3 mb-6">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => selectCategory(cat.id)}
                                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all border shadow-lg backdrop-blur-md active:scale-95 ${activeCategory === cat.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-500/30' : 'bg-black/20 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Playlist Container - Glass & Clean */}
                        <div className="bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 p-2 md:p-4 max-h-[35vh] overflow-y-auto custom-scrollbar shadow-2xl">
                            {/* Custom Link Input INSIDE Playlist Header */}
                            <div className="flex gap-2 mb-4 px-2">
                                <input
                                    type="text"
                                    value={customLink}
                                    onChange={(e) => setCustomLink(e.target.value)}
                                    placeholder="Dán link YouTube (hoặc upload file 👉)"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-colors"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddCustomLink();
                                        }
                                    }}
                                />

                                <input
                                    type="file"
                                    accept="audio/*,.m4a"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-xl transition-colors"
                                    title="Tải file M4A/MP3 từ máy"
                                >
                                    <Upload size={18} />
                                </button>

                                <button onClick={handleAddCustomLink} className="px-4 py-2 bg-white/10 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-colors">
                                    Thêm
                                </button>
                            </div>

                            {playlist.length === 0 ? (
                                <div className="text-center py-12 text-white/30">
                                    <CloudRain size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>Không có bài hát nào trong danh mục này.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {playlist.map((track, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => playTrack(idx)}
                                            className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all group border ${currentTrackIndex === idx ? 'bg-indigo-600/20 border-indigo-500/30 shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/5'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-transform group-hover:scale-110 ${currentTrackIndex === idx ? 'bg-indigo-500 text-white shadow-indigo-500/50 shadow-inner' : 'bg-black/30 text-white/30'}`}>
                                                {currentTrackIndex === idx ? <Activity size={16} className="animate-pulse" /> : idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-bold truncate ${currentTrackIndex === idx ? 'text-indigo-200' : 'text-white/80 group-hover:text-white'}`}>{track.title}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] uppercase tracking-wider text-white/30 bg-white/5 px-1.5 rounded-md">{track.type}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(track.src, '_blank');
                                                }}
                                                className="p-2.5 bg-black/20 hover:bg-red-500 hover:text-white rounded-xl transition-all text-white/20"
                                                title="Open in YouTube"
                                            >
                                                <ExternalLink size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {/* --- EMBEDDED PLAYLIST VIEW (BELOW PLAYER) --- */}
                {embedded && (
                    <div className="w-full max-w-4xl mt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><List size={18} className="text-indigo-400" /> Danh sách phát</h3>
                            <div className="flex gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => selectCategory(cat.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeCategory === cat.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-transparent text-white/40 hover:text-white'}`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                            {playlist.map((track, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => playTrack(idx)}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all group ${currentTrackIndex === idx ? 'bg-white/10 border-indigo-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${currentTrackIndex === idx ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/30'}`}>
                                        {currentTrackIndex === idx ? <Activity size={14} className="animate-pulse" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-bold truncate ${currentTrackIndex === idx ? 'text-indigo-300' : 'text-white/80 group-hover:text-white'}`}>{track.title}</h4>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(track.src, '_blank');
                                        }}
                                        className="p-2 text-white/20 hover:text-red-500 transition-colors"
                                        title="Xem trên YouTube"
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


            </div>



            {/* --- 6. MUSIC DRAWER (MOBILE FRIENDLY) --- */}
            <div className={`
                fixed inset-y-0 right-0 w-full xs:w-[85%] md:w-[400px] bg-[#111] border-l border-white/10 z-[200] transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col h-full
                ${showPlaylist ? 'translate-x-0' : 'translate-x-full'}
            `}>
                <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-[#111] shrink-0">
                    <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Headphones size={20} className="text-indigo-500" /> Music Space</h2>
                    <button onClick={() => setShowPlaylist(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer active:scale-95"><X size={20} /></button>
                </div>

                {/* Categories Tab */}
                <div className="p-3 md:p-4 grid grid-cols-2 gap-2 bg-[#0a0a0a] shrink-0">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => selectCategory(cat.id)}
                            className={`flex items-center gap-2 p-2 md:p-3 rounded-xl text-[10px] md:text-xs font-bold transition-all border cursor-pointer ${activeCategory === cat.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10 hover:text-white'}`}
                        >
                            {cat.icon}
                            {cat.name}
                        </button>
                    ))}
                </div>



                {/* Playlist Scroll */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 pb-20 md:pb-4">
                    <h3 className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-3 px-2">Now Playing</h3>

                    {playlist.length === 0 ? (
                        <div className="text-center py-10 px-6">
                            <Music size={32} className="mx-auto text-white/5 mb-3" />
                            <p className="text-xs text-white/20">Chưa có bài nhạc nào trong mục này.</p>
                        </div>
                    ) : (
                        playlist.map((track: any, idx) => (
                            <div
                                key={idx}
                                onClick={() => playTrack(idx)}
                                className={`flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl cursor-pointer transition-all group border border-transparent active:scale-[0.98] ${currentTrackIndex === idx ? 'bg-white/10 border-white/5' : 'hover:bg-white/5'}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentTrackIndex === idx ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/30'}`}>
                                    {currentTrackIndex === idx ? <Activity size={12} className="animate-pulse" /> : idx + 1}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className={`text-xs md:text-sm font-bold truncate ${currentTrackIndex === idx ? 'text-indigo-400' : 'text-white/80 group-hover:text-white'}`}>{track.title}</p>
                                    <p className="text-[9px] md:text-[10px] text-white/30 uppercase tracking-wider">{track.type}</p>
                                </div>

                                {currentTrackIndex === idx && <div className="text-indigo-500 shrink-0"><Volume2 size={14} /></div>}

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(track.src, '_blank');
                                    }}
                                    className="p-2 opacity-0 group-hover:opacity-100 text-white/40 hover:text-white transition-all"
                                    title="Mở trên YouTube"
                                >
                                    <ExternalLink size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Backdrop for Drawer */}
            {showPlaylist && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]" onClick={() => setShowPlaylist(false)} />}
        </div >
    );
};

export default MusicSpace;
