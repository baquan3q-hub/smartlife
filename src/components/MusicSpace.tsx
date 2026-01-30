import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Volume2, VolumeX, Music, Play, Pause, Sparkles, RotateCcw, Image as ImageIcon, Video as VideoIcon, Timer as TimerIcon, Activity, ChevronRight } from 'lucide-react';
import { useFocusTimer } from '../hooks/useFocusTimer';

interface MusicSpaceProps {
    onBack: () => void;
    timer: ReturnType<typeof useFocusTimer>;
    formatTime: (seconds: number) => string;
}

const BG_IMAGES = [
    'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=2000', // Forest
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=2000', // Mountain
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2000', // Sunshine Forest
    'https://images.unsplash.com/photo-1518173946687-a4c8a9ba332f?auto=format&fit=crop&q=80&w=2000', // Rain Forest
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=2000', // Cozy Lake
];

const LOCAL_BG_IMAGES = [
    '/music/bg-1.jpg',
    '/music/bg-2.jpg',
    '/music/bg-3.jpg',
    '/music/bg-4.jpg',
    '/music/bg-5.jpg',
];

const MusicSpace: React.FC<MusicSpaceProps> = ({ onBack, timer, formatTime }) => {
    const { timeLeft, status, mode, toggleTimer, resetTimer, totalTime, engineMode, switchEngineMode } = timer;
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [bgType, setBgType] = useState<'video' | 'image'>('video');
    const [imageIndex, setImageIndex] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const audio = new Audio();
        audio.loop = true;
        audio.volume = 0.5;

        // Ưu tiên file local, nếu lỗi (do file nặng ko up lên github được) thì dùng link online
        const LOCAL_SRC = '/music/chill-music.mp3';
        const ONLINE_SRC = 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3'; // Lofi Study (Free)

        const playAudio = () => {
            if (isPlaying) {
                audio.play().catch(e => {
                    console.log("Autoplay blocked", e);
                    setIsPlaying(false);
                });
            }
        };

        // Xử lý khi file local lỗi (404)
        audio.onerror = () => {
            console.warn("Local music failed, switching to Online Backup...");
            if (audio.src.includes(LOCAL_SRC)) {
                audio.src = ONLINE_SRC;
                playAudio();
            }
        };

        audio.src = LOCAL_SRC;

        audio.addEventListener('canplaythrough', () => {
            playAudio();
        });

        audioRef.current = audio;

        return () => {
            audio.pause();
            audio.src = "";
        };
    }, []);

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleMusicPlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const nextImage = () => setImageIndex((prev) => (prev + 1) % 5);
    const prevImage = () => setImageIndex((prev) => (prev - 1 + 5) % 5);

    return (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center overflow-hidden font-sans">
            {/* Background Layer */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {bgType === 'video' && (
                    <div className="absolute inset-0 transition-opacity duration-700">
                        <video ref={videoRef} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-60">
                            <source src="/music/background-video.mp4" type="video/mp4" />
                        </video>
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
                    </div>
                )}

                {bgType === 'image' && (
                    <div className="absolute inset-0 transition-all duration-1000 ease-in-out">
                        <img
                            key={imageIndex}
                            src={LOCAL_BG_IMAGES[imageIndex]}
                            onError={(e) => {
                                // Fallback to Unsplash if local file is missing
                                (e.target as HTMLImageElement).src = BG_IMAGES[imageIndex];
                            }}
                            alt="Background"
                            className="w-full h-full object-cover opacity-60 animate-slow-zoom"
                        />
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
                    </div>
                )}
            </div>

            {/* Header Content - Responsive padding and sizing */}
            <div className="absolute top-4 md:top-8 left-4 md:left-8 right-4 md:right-8 flex justify-between items-center z-[110]">
                <button
                    onClick={onBack}
                    className="p-2 md:p-3 px-3 md:px-5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-black/60 transition-all flex items-center gap-1 md:gap-2 group pointer-events-auto shadow-2xl"
                >
                    <ChevronLeft size={20} className="md:w-6 md:h-6 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold text-sm md:text-base pr-1">Thoát</span>
                </button>

                <div className="flex bg-black/40 backdrop-blur-xl rounded-full p-1 border border-white/10 pointer-events-auto items-center gap-1 shadow-2xl">
                    <button
                        onClick={() => setBgType('video')}
                        className={`p-2 px-3 md:p-2.5 md:px-4 rounded-full transition-all flex items-center gap-1.5 md:gap-2 ${bgType === 'video' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-white/10 text-white/60'}`}
                    >
                        <VideoIcon size={16} className="md:w-5 md:h-5" />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider hidden sm:inline">Video</span>
                    </button>
                    <div className={`flex items-center rounded-full px-1 transition-all ${bgType === 'image' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-white/10 text-white/60'}`}>
                        <button
                            onClick={() => setBgType('image')}
                            className={`p-2 px-3 md:p-2.5 md:px-4 rounded-full flex items-center gap-1.5 md:gap-2`}
                        >
                            <ImageIcon size={16} className="md:w-5 md:h-5" />
                            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider hidden sm:inline">Ảnh</span>
                        </button>
                        {bgType === 'image' && (
                            <div className="flex items-center gap-1 md:gap-2 pr-2 md:pr-3 animate-fade-in border-l border-white/20 ml-1 pl-1 md:pl-2">
                                <button onClick={prevImage} className="p-1 hover:bg-white/20 rounded-full transition-colors"><ChevronLeft size={14} className="md:w-4 md:h-4" /></button>
                                <span className="text-[10px] md:text-[11px] font-black w-3 text-center">{imageIndex + 1}</span>
                                <button onClick={nextImage} className="p-1 hover:bg-white/20 rounded-full transition-colors"><ChevronRight size={14} className="md:w-4 md:h-4" /></button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Interactive Content */}
            <div className="relative z-[110] flex flex-col items-center text-center w-full h-full justify-center px-4 md:px-6 pointer-events-none">

                {/* Mode Switcher - Compact for Mobile */}
                <div className="mb-6 md:mb-12 flex bg-black/40 backdrop-blur-2xl border border-white/20 rounded-xl md:rounded-2xl p-1 md:p-1.5 shadow-2xl pointer-events-auto scale-90 md:scale-100">
                    <button
                        onClick={() => switchEngineMode('TIMER')}
                        className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-10 py-2.5 md:py-3.5 rounded-lg md:rounded-xl transition-all font-black text-xs md:text-sm select-none ${engineMode === 'TIMER' ? 'bg-white text-indigo-900 shadow-2xl' : 'text-white/40 hover:text-white'}`}
                    >
                        <TimerIcon size={14} className="md:w-[18px] md:h-[18px]" />
                        ĐẾM NGƯỢC
                    </button>
                    <button
                        onClick={() => switchEngineMode('STOPWATCH')}
                        className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-10 py-2.5 md:py-3.5 rounded-lg md:rounded-xl transition-all font-black text-xs md:text-sm select-none ${engineMode === 'STOPWATCH' ? 'bg-white text-indigo-900 shadow-2xl' : 'text-white/40 hover:text-white'}`}
                    >
                        <Activity size={14} className="md:w-[18px] md:h-[18px]" />
                        BẤM GIỜ
                    </button>
                </div>

                {/* UI Frame for better visibility */}
                <div className="bg-black/20 backdrop-blur-[8px] border border-white/5 rounded-[2rem] md:rounded-[4rem] p-6 md:p-12 w-full max-w-[340px] md:max-w-4xl shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-all flex flex-col items-center">
                    <div className="mb-2 md:mb-4 flex items-center gap-3 md:gap-4 justify-center animate-float pointer-events-none">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-indigo-500/30 flex items-center justify-center backdrop-blur-md border border-indigo-400/30 shadow-lg">
                            <Music size={20} className="md:w-7 md:h-7 text-indigo-300" />
                        </div>
                        <h2 className="text-lg md:text-3xl font-black tracking-[0.2em] uppercase text-white/70 drop-shadow-lg">
                            {engineMode === 'STOPWATCH' ? 'Study Tracker' : (mode === 'WORK' ? 'Deep Work' : 'Chill Break')}
                        </h2>
                    </div>

                    {/* Big Time Display - Responsive Font Size */}
                    <div className="mb-6 md:mb-10 relative pointer-events-none w-full">
                        <div className="text-[5rem] sm:text-[8rem] md:text-[220px] font-mono font-black tracking-tighter leading-none text-white drop-shadow-[0_0_80px_rgba(0,0,0,0.8)] select-none transition-all duration-300">
                            {formatTime(timeLeft)}
                        </div>
                        {engineMode === 'TIMER' && (
                            <div className="absolute -bottom-3 md:-bottom-6 left-0 right-0 h-1.5 md:h-2 bg-white/5 rounded-full overflow-hidden mx-auto w-2/3 md:w-1/2">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_30px_rgba(99,102,241,0.8)]"
                                    style={{ width: `${100 - (timeLeft / totalTime) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Control Card */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-10 shadow-inner group pointer-events-auto w-full md:w-auto">
                        {/* Timer Controls */}
                        <div className="flex items-center gap-6 md:gap-8 relative z-10 w-full md:w-auto justify-center md:justify-start border-b md:border-b-0 md:border-r border-white/10 pb-6 md:pb-0 md:pr-10">
                            <button
                                onClick={resetTimer}
                                className="p-4 md:p-5 rounded-full bg-white/5 hover:bg-white/15 transition-all text-white/40 hover:text-white hover:scale-110 active:rotate-12"
                                title="Đặt lại"
                            >
                                <RotateCcw size={24} className="md:w-8 md:h-8" />
                            </button>
                            <button
                                onClick={toggleTimer}
                                className={`w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center transition-all shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:scale-110 active:scale-95 ${status === 'RUNNING' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                            >
                                {status === 'RUNNING' ? <Pause size={36} className="md:w-[48px] md:h-[48px]" fill="currentColor" /> : <Play size={36} className="md:w-[48px] md:h-[48px] ml-1" fill="currentColor" />}
                            </button>
                        </div>

                        {/* Music Controls */}
                        <div className="flex items-center gap-6 md:gap-10 relative z-10 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                            <div className="flex flex-col items-start text-left">
                                <div className="flex items-center gap-1.5 md:gap-2 text-indigo-400 font-black uppercase tracking-widest text-[10px] md:text-[12px] mb-1 md:mb-2"><Sparkles size={12} className="md:w-4 md:h-4" /><span>Ambience</span></div>
                                <div className="text-white font-black text-base md:text-xl tracking-tight leading-tight">Chill Lo-Fi<br className="md:hidden" /> Beats</div>
                            </div>
                            <div className="flex items-center gap-3 md:gap-5">
                                <button onClick={toggleMute} className="p-3 md:p-4 rounded-full bg-white/5 hover:bg-white/15 transition-colors text-white/60">{isMuted ? <VolumeX size={20} className="md:w-7 md:h-7" /> : <Volume2 size={20} className="md:w-7 md:h-7" />}</button>
                                <button onClick={toggleMusicPlay} className="p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white border border-white/20 shadow-lg">{isPlaying ? <Pause size={20} className="md:w-7 md:h-7" fill="currentColor" /> : <Play size={20} className="md:w-7 md:h-7 ml-1" fill="currentColor" />}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .animate-float { animation: float 10s infinite ease-in-out; }
                .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes slow-zoom { from { transform: scale(1); } to { transform: scale(1.1); } }
                .animate-slow-zoom { animation: slow-zoom 30s infinite alternate ease-in-out; }
            `}</style>
        </div>
    );
};

export default MusicSpace;
