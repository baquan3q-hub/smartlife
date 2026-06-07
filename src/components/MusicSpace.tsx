import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, Play, Pause, RotateCcw, Sparkles, ExternalLink, GraduationCap,
    Volume2, VolumeX, CloudRain, Flame, Wind, TreePine, Waves, Music,
    CheckCircle2, Circle, RefreshCw, Plus, Quote, Coffee, Compass, CheckSquare, Sun, Moon,
    ChevronsRight, HelpCircle, Share2
} from 'lucide-react';
import { useFocusTimer, PRESETS, Preset } from '../hooks/useFocusTimer';
import { Todo, TaskPriority } from '../types';
import { supabase } from '../services/supabase';

// --- PROPS ---
interface MusicSpaceProps {
    onBack: () => void;
    timer: ReturnType<typeof useFocusTimer>;
    formatTime: (seconds: number) => string;
    todos?: Todo[];
    activeTaskId?: string | null;
    onUpdateTodo?: (t: any) => void;
    onStartTracking?: (todo: Todo) => void;
    onAddTodo?: (content: string, priority: TaskPriority, deadline?: string) => void;
    isStandalone?: boolean;
    onLoginRedirect?: () => void;
}

// --- CONSTANTS ---
const LOFI_PLAYLIST = [
    { name: "Tiếng Ồn Nâu (Deep Brown Noise)", url: "https://cdn.jsdelivr.net/gh/danielrosehill/HA-White-Noise-Component/audio/brown_noise.mp3" },
    { name: "Sóng Não Alpha (Alpha Focus)", url: "https://raw.githack.com/neelkamath/binaural-beats-dataset/master/tracks/Alpha_12_Hz.mp3" },
    { name: "Sóng Não Beta (Active Study)", url: "https://raw.githack.com/neelkamath/binaural-beats-dataset/master/tracks/Beta_20_Hz.mp3" },
    { name: "Tiếng Ồn Trắng (White Noise)", url: "https://cdn.jsdelivr.net/gh/danielrosehill/HA-White-Noise-Component/audio/white_noise.mp3" },
    { name: "Chill Lo-Fi Study", url: "https://cdn.jsdelivr.net/gh/btahir/open-lofi/tracks/activities/coffee-ring-notebook.mp3" },
    { name: "Focus Lo-Fi Session", url: "https://cdn.jsdelivr.net/gh/btahir/open-lofi/tracks/activities/2-am-debug-loop.mp3" }
];

const AMBIENT_SOUNDS = [
    { id: 'rain', name: 'Mưa rơi', icon: CloudRain, url: 'https://cdn.jsdelivr.net/gh/karthiknvd/noctune/sounds/rain.mp3' },
    { id: 'thunder', name: 'Sấm sét', icon: Sparkles, url: 'https://cdn.jsdelivr.net/gh/karthiknvd/noctune/sounds/thunder.mp3' },
    { id: 'wind', name: 'Gió thổi', icon: Wind, url: 'https://cdn.jsdelivr.net/gh/karthiknvd/noctune/sounds/wind.mp3' },
    { id: 'campfire', name: 'Lửa trại', icon: Flame, url: 'https://cdn.jsdelivr.net/gh/karthiknvd/noctune/sounds/campfire.mp3' },
    { id: 'forest', name: 'Rừng chim', icon: TreePine, url: 'https://cdn.jsdelivr.net/gh/karthiknvd/noctune/sounds/forest.mp3' },
    { id: 'waves', name: 'Sóng biển', icon: Waves, url: 'https://cdn.jsdelivr.net/gh/karthiknvd/noctune/sounds/river.mp3' }
];

const STUDY_QUOTES = [
    "Hành trình vạn dặm khởi đầu từ một bước chân. 👣",
    "Sự tập trung là nền tảng của mọi thành tựu vĩ đại. 🎯",
    "Đừng để xao nhãng nhất thời làm mờ đi mục tiêu dài hạn. 🚀",
    "Hãy học như thể bạn sẽ sống mãi mãi. 📚",
    "Thành công là kết quả nỗ lực nhỏ bé tích lũy mỗi ngày. ✨",
    "Kỷ luật là chiếc cầu nối giữa mục tiêu và thành tựu. 💪",
    "Làm việc sâu (Deep Work) thay đổi chất lượng học tập. 📵",
    "Mỗi phút tập trung hôm nay dựng xây tương lai ngày mai. 🌟",
    "Đừng đợi nguồn cảm hứng, hãy bắt đầu hành động. 🔥",
    "Bạn của ngày mai sẽ biết ơn nỗ lực hôm nay của bạn. 💖"
];

type SceneryType = 'sunset' | 'rainy' | 'forest' | 'space' | 'zen';

// --- COMPONENT ---
const MusicSpace: React.FC<MusicSpaceProps> = ({
    onBack, timer, formatTime, todos = [], activeTaskId = null, onUpdateTodo, onStartTracking, onAddTodo,
    isStandalone = false, onLoginRedirect
}) => {
    const [localTodos, setLocalTodos] = useState<Todo[]>(() => {
        const saved = localStorage.getItem('smartlife_guest_todos');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        if (isStandalone) {
            localStorage.setItem('smartlife_guest_todos', JSON.stringify(localTodos));
        }
    }, [localTodos, isStandalone]);

    const localFileInputRef = useRef<HTMLInputElement>(null);

    const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileUrl = URL.createObjectURL(file);
        const newTrack = {
            name: `📁 ${file.name}`,
            url: fileUrl
        };

        setPlaylist(prev => {
            const nextPlaylist = [...prev, newTrack];
            const nextIndex = nextPlaylist.length - 1;
            
            setCurrentLofiIndex(nextIndex);

            let audio = audioRefs.current['lofi'];
            if (audio) {
                audio.src = fileUrl;
                if (isPlayingLofi) {
                    audio.play().catch(err => console.log(err));
                }
            } else if (isPlayingLofi) {
                playOrPauseAudio('lofi', true, fileUrl, true);
            }
            return nextPlaylist;
        });

        e.target.value = '';
    };

    // Dynamic playlist combining defaults and user's "My Spotify" tracks
    const [playlist, setPlaylist] = useState<{ name: string; url: string }[]>(LOFI_PLAYLIST);

    useEffect(() => {
        const loadUserTracks = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;

                const { data: tracks, error } = await supabase
                    .from('my_tracks')
                    .select('title, file_url')
                    .eq('user_id', session.user.id);

                if (error) throw error;
                if (tracks && tracks.length > 0) {
                    const formatted = tracks.map(t => ({
                        name: `🎵 ${t.title} (My Spotify)`,
                        url: t.file_url
                    }));
                    setPlaylist([...LOFI_PLAYLIST, ...formatted]);
                }
            } catch (err) {
                console.error('Failed to load user tracks:', err);
            }
        };
        loadUserTracks();
    }, []);

    // Ambient sound control states
    const [activeSounds, setActiveSounds] = useState<{ [key: string]: boolean }>({});
    const [soundVolumes, setSoundVolumes] = useState<{ [key: string]: number }>({
        rain: 0.4, thunder: 0.2, wind: 0.2, campfire: 0.3, forest: 0.2, waves: 0.3, lofi: 0.4
    });

    const [copiedShare, setCopiedShare] = useState(false);

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/#/focus`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopiedShare(true);
            setTimeout(() => setCopiedShare(false), 2000);
        }).catch(err => {
            console.error('Failed to copy share link:', err);
        });
    };

    // Lofi track states
    const [currentLofiIndex, setCurrentLofiIndex] = useState(0);
    const [isPlayingLofi, setIsPlayingLofi] = useState(false);

    // Scenery Background states
    const [scenery, setScenery] = useState<SceneryType>(() => {
        return (localStorage.getItem('study_space_scenery') as SceneryType) || 'sunset';
    });

    // Selected study task state
    const [selectedTodo, setSelectedTodo] = useState<Todo | null>(() => {
        const list = isStandalone ? (JSON.parse(localStorage.getItem('smartlife_guest_todos') || '[]') as Todo[]) : todos;
        if (activeTaskId && list.length > 0) {
            return list.find(t => t.id === activeTaskId) || null;
        }
        return null;
    });

    // Sidebar panels states (for mobile toggling/drawer)
    const [mobileTab, setMobileTab] = useState<'WORKSPACE' | 'TIMER' | 'SOUNDS'>('TIMER');

    // Quote state
    const [quote, setQuote] = useState(STUDY_QUOTES[0]);

    // Input state for adding a task quickly
    const [newTodoText, setNewTodoText] = useState('');

    // Audio elements storage
    const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

    // Mute state
    const [isMutedAll, setIsMutedAll] = useState(false);

    // Dynamic quote cycle
    useEffect(() => {
        setQuote(STUDY_QUOTES[Math.floor(Math.random() * STUDY_QUOTES.length)]);
    }, [timer.mode]);

    // Sync selected task from external props
    useEffect(() => {
        const list = isStandalone ? localTodos : todos;
        if (activeTaskId && list.length > 0) {
            const found = list.find(t => t.id === activeTaskId);
            if (found) setSelectedTodo(found);
        } else if (!activeTaskId) {
            setSelectedTodo(null);
        }
    }, [activeTaskId, todos, localTodos, isStandalone]);

    // Save scenery setting
    const handleSceneryChange = (newScenery: SceneryType) => {
        setScenery(newScenery);
        localStorage.setItem('study_space_scenery', newScenery);
    };

    // Clean up sounds on exit/unmount
    useEffect(() => {
        return () => {
            // Stop and destroy all sound elements
            Object.values(audioRefs.current).forEach(audio => {
                if (audio) {
                    audio.pause();
                    audio.src = '';
                }
            });
            audioRefs.current = {};
        };
    }, []);

    // Setup and trigger audio streams
    const playOrPauseAudio = (soundId: string, shouldPlay: boolean, url: string, isLofi = false) => {
        let audio = audioRefs.current[soundId];

        if (!audio) {
            audio = new Audio(url);
            audio.loop = !isLofi;
            if (isLofi) {
                audio.onended = () => {
                    handleNextLofiTrack();
                };
            }
            audioRefs.current[soundId] = audio;
        }

        // Apply volume
        const baseVol = soundVolumes[soundId] !== undefined ? soundVolumes[soundId] : 0.4;
        audio.volume = isMutedAll ? 0 : baseVol;

        if (shouldPlay) {
            audio.play().catch(err => {
                console.log(`Failed to play ${soundId}:`, err);
                if (isLofi) {
                    setIsPlayingLofi(false);
                } else {
                    setActiveSounds(prev => ({ ...prev, [soundId]: false }));
                }
            });
        } else {
            audio.pause();
        }
    };

    // Toggle ambient sounds
    const handleToggleAmbient = (soundId: string) => {
        const sound = AMBIENT_SOUNDS.find(s => s.id === soundId);
        if (!sound) return;

        const isCurrentlyPlaying = !!activeSounds[soundId];
        const nextState = !isCurrentlyPlaying;

        setActiveSounds(prev => ({ ...prev, [soundId]: nextState }));
        playOrPauseAudio(soundId, nextState, sound.url);
    };

    // Toggle Lofi Music
    const handleToggleLofi = () => {
        const nextState = !isPlayingLofi;
        setIsPlayingLofi(nextState);
        playOrPauseAudio('lofi', nextState, playlist[currentLofiIndex].url, true);
    };

    // Next Lofi track
    const handleNextLofiTrack = () => {
        const nextIndex = (currentLofiIndex + 1) % playlist.length;
        setCurrentLofiIndex(nextIndex);

        let audio = audioRefs.current['lofi'];
        if (audio) {
            audio.src = playlist[nextIndex].url;
            if (isPlayingLofi) {
                audio.play().catch(e => console.log(e));
            }
        } else {
            if (isPlayingLofi) {
                playOrPauseAudio('lofi', true, playlist[nextIndex].url, true);
            }
        }
    };

    // Adjust individual volume
    const handleVolumeChange = (soundId: string, value: number) => {
        setSoundVolumes(prev => ({ ...prev, [soundId]: value }));
        const audio = audioRefs.current[soundId];
        if (audio) {
            audio.volume = isMutedAll ? 0 : value;
        }
    };

    // Master Mute Toggle
    const handleToggleMuteAll = () => {
        const nextMuteState = !isMutedAll;
        setIsMutedAll(nextMuteState);

        Object.keys(audioRefs.current).forEach(key => {
            const audio = audioRefs.current[key];
            if (audio) {
                audio.volume = nextMuteState ? 0 : (soundVolumes[key] !== undefined ? soundVolumes[key] : 0.4);
            }
        });
    };

    // Next Quote
    const handleNextQuote = () => {
        let newQuote = quote;
        while (newQuote === quote) {
            newQuote = STUDY_QUOTES[Math.floor(Math.random() * STUDY_QUOTES.length)];
        }
        setQuote(newQuote);
    };

    // Handle Quick Task Adding
    const handleQuickAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        const content = newTodoText.trim();
        if (!content) return;
        if (isStandalone) {
            const newTodo: Todo = {
                id: crypto.randomUUID(),
                content,
                is_completed: false,
                priority: 'focus'
            };
            setLocalTodos(prev => [newTodo, ...prev]);
        } else if (onAddTodo) {
            onAddTodo(content, TaskPriority.FOCUS);
        }
        setNewTodoText('');
    };

    // Handle Task Selection
    const handleSelectTask = (todo: Todo) => {
        if (selectedTodo?.id === todo.id) {
            setSelectedTodo(null);
        } else {
            setSelectedTodo(todo);
            onStartTracking?.(todo);
        }
    };

    // Handle Task Completion
    const handleCompleteTask = (todo: Todo) => {
        if (isStandalone) {
            setLocalTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_completed: true } : t));
            if (selectedTodo?.id === todo.id) {
                setSelectedTodo(null);
            }
        } else if (onUpdateTodo) {
            onUpdateTodo({ ...todo, is_completed: true });
            if (selectedTodo?.id === todo.id) {
                setSelectedTodo(null);
            }
        }
    };

    // Exit and stop all sound effects
    const handleExit = () => {
        Object.values(audioRefs.current).forEach(audio => {
            if (audio) {
                audio.pause();
                audio.src = '';
            }
        });
        audioRefs.current = {};
        onBack();
    };

    const getSceneryStyles = (): { bgClass: string, overlayElement: React.ReactNode } => {
        switch (scenery) {
            case 'sunset':
                return {
                    bgClass: 'bg-gradient-to-br from-[#180933] via-[#3d164c] to-[#7f2d56]',
                    overlayElement: (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,113,133,0.12)_0%,transparent_70%)] animate-pulse pointer-events-none z-0" />
                    )
                };
            case 'rainy':
                return {
                    bgClass: 'bg-gradient-to-br from-[#060a14] via-[#0d1629] to-[#1a2842]',
                    overlayElement: (
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]" />
                            <div className="absolute inset-0 bg-black/10 opacity-70 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] animate-[marquee_20s_linear_infinite]" />
                        </div>
                    )
                };
            case 'forest':
                return {
                    bgClass: 'bg-gradient-to-br from-[#04140c] via-[#092417] to-[#143d27]',
                    overlayElement: (
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                            <div className="absolute bottom-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[80px] animate-pulse" />
                            <div className="absolute top-[20%] right-[10%] w-[250px] h-[250px] rounded-full bg-amber-500/3 blur-[60px]" />
                        </div>
                    )
                };
            case 'space':
                return {
                    bgClass: 'bg-black',
                    overlayElement: (
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                            <video
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover z-0 opacity-75 transition-opacity duration-1000"
                                src="/music/background-video.mp4"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 z-10" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.5)_80%)] z-10" />
                        </div>
                    )
                };
            case 'zen':
                return {
                    bgClass: 'bg-gradient-to-br from-[#121214] via-[#1f1f22] to-[#303036]',
                    overlayElement: <div className="absolute inset-0 bg-black/5 pointer-events-none z-0" />
                };
            default:
                return {
                    bgClass: 'bg-gradient-to-br from-[#0f0c29] via-[#1a1140] to-[#302b63]',
                    overlayElement: null
                };
        }
    };

    const { bgClass, overlayElement } = getSceneryStyles();

    // Adjusted circle sizes (Reduced by ~15% to fit shorter screen heights)
    const radius = 115;
    const stroke = 6;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = timer.totalTime > 0
        ? circumference - (timer.timeLeft / timer.totalTime) * circumference
        : circumference;

    const effectiveTodos = isStandalone ? localTodos : todos;
    const activeTodos = effectiveTodos.filter(t => !t.is_completed);

    return (
        <div className={`fixed inset-0 z-[9999] text-white font-sans overflow-hidden flex flex-col h-[100dvh] transition-all duration-1000 ${bgClass}`}>
            
            {/* Visual Overlays & Effects */}
            {overlayElement}
            
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.02),transparent_40%)] z-0 pointer-events-none" />

            {/* === HEADER (Compact py) === */}
            <header className="relative z-20 flex justify-between items-center px-4 md:px-6 py-2.5 shrink-0 border-b border-white/5 bg-black/30">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-all border border-white/5 cursor-pointer active:scale-95 text-xs font-bold"
                    >
                        <ChevronLeft size={14} />
                        <span>Thoát</span>
                    </button>
                    {isStandalone && onLoginRedirect && (
                        <button
                            onClick={onLoginRedirect}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-all border border-indigo-500/30 cursor-pointer active:scale-95 text-xs font-bold"
                        >
                            <span>Đăng nhập</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-yellow-400 animate-pulse" />
                    <span className="text-sm font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-pink-200 uppercase">
                        Không Gian Học Tập
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleShare}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border cursor-pointer active:scale-95 text-xs font-bold ${
                            copiedShare
                                ? 'bg-emerald-600 border-emerald-500/30 text-white'
                                : 'bg-white/5 border-white/5 hover:bg-white/10 text-white'
                        }`}
                        title="Chia sẻ link không gian"
                    >
                        <Share2 size={14} />
                        <span>{copiedShare ? "Đã sao chép!" : "Chia sẻ"}</span>
                    </button>

                    <button
                        onClick={handleToggleMuteAll}
                        className={`p-2 rounded-lg transition-all border cursor-pointer active:scale-95 ${
                            isMutedAll 
                                ? 'bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10 text-white'
                        }`}
                        title={isMutedAll ? "Bật âm" : "Tắt âm"}
                    >
                        {isMutedAll ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                </div>
            </header>

            {/* === MOBILE TAB BAR === */}
            <div className="lg:hidden relative z-20 flex bg-black/40 p-1 border-b border-white/5 shrink-0">
                <button
                    onClick={() => setMobileTab('WORKSPACE')}
                    className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg ${
                        mobileTab === 'WORKSPACE' ? 'bg-white/15 text-white' : 'text-white/50'
                    }`}
                >
                    📝 BÀI TẬP ({activeTodos.length})
                </button>
                <button
                    onClick={() => setMobileTab('TIMER')}
                    className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg ${
                        mobileTab === 'TIMER' ? 'bg-white/15 text-white' : 'text-white/50'
                    }`}
                >
                    ⏳ ĐẾM GIỜ
                </button>
                <button
                    onClick={() => setMobileTab('SOUNDS')}
                    className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg ${
                        mobileTab === 'SOUNDS' ? 'bg-white/15 text-white' : 'text-white/50'
                    }`}
                >
                    🎵 ÂM THANH
                </button>
            </div>

            {/* === MAIN CONTENT (Compact padding & gap) === */}
            <div className="flex-1 flex min-h-0 relative z-10 px-4 md:px-6 py-4 gap-4 md:gap-5 max-w-7xl mx-auto w-full overflow-hidden">
                
                {/* 1. LEFT COLUMN: Workspace / Todos (Compact) */}
                <section className={`flex-[3] flex flex-col min-h-0 bg-white/5 border border-white/5 rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
                    mobileTab === 'WORKSPACE' ? 'flex' : 'hidden lg:flex'
                }`}>
                    <div className="flex justify-between items-center mb-3 shrink-0">
                        <h3 className="font-extrabold text-xs flex items-center gap-1.5 text-indigo-200">
                            <CheckSquare size={14} />
                            <span>Việc Cần Học</span>
                        </h3>
                        <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-full font-bold opacity-60">
                            {activeTodos.length}
                        </span>
                    </div>

                    {/* Quick Add Form */}
                    {(onAddTodo || isStandalone) && (
                        <form onSubmit={handleQuickAddTask} className="flex gap-1.5 mb-3 shrink-0">
                            <input
                                type="text"
                                value={newTodoText}
                                onChange={e => setNewTodoText(e.target.value)}
                                placeholder="Thêm việc nhanh..."
                                className="flex-1 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-400 placeholder-white/30 text-white font-medium transition-colors"
                            />
                            <button
                                type="submit"
                                className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all active:scale-95 text-white shrink-0 cursor-pointer"
                            >
                                <Plus size={14} />
                            </button>
                        </form>
                    )}

                    {/* Todo List Container */}
                    <div className="flex-1 overflow-y-auto pr-0.5 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {activeTodos.map(todo => {
                            const isSelected = selectedTodo?.id === todo.id;
                            return (
                                <div
                                    key={todo.id}
                                    onClick={() => handleSelectTask(todo)}
                                    className={`group flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                        isSelected 
                                            ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border-indigo-400/30 shadow-md' 
                                            : 'bg-white/5 hover:bg-white/10 border-transparent'
                                    }`}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCompleteTask(todo);
                                        }}
                                        className="mt-0.5 text-white/30 hover:text-emerald-400 transition-colors shrink-0"
                                    >
                                        <Circle size={15} />
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold leading-snug truncate ${
                                            isSelected ? 'text-indigo-200' : 'text-white/80'
                                        }`}>
                                            {todo.content}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`text-[7px] px-1 rounded font-bold uppercase ${
                                                todo.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                                todo.priority === 'medium' ? 'bg-blue-500/20 text-blue-300' :
                                                'bg-purple-500/20 text-purple-300'
                                            }`}>
                                                {todo.priority === 'high' ? 'Ưu tiên' : todo.priority === 'medium' ? 'Tập trung' : 'Chill'}
                                            </span>
                                            {todo.time_spent !== undefined && todo.time_spent > 0 && (
                                                <span className="text-[8px] text-white/30">
                                                    ⏱ {Math.round(todo.time_spent / 60)}p
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <ChevronsRight size={12} className="text-indigo-400 animate-pulse self-center" />
                                    )}
                                </div>
                            );
                        })}

                        {activeTodos.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-40 px-2">
                                <Coffee size={24} className="mb-2 text-indigo-300" />
                                <p className="text-[10px] font-bold">Chưa có công việc nào!</p>
                            </div>
                        )}
                    </div>

                    {/* Selected Task Highlight at Bottom */}
                    {selectedTodo && (
                        <div className="mt-3 p-2 bg-indigo-500/10 border border-indigo-400/20 rounded-xl shrink-0 animate-fade-in flex justify-between items-center gap-2">
                            <div className="min-w-0">
                                <p className="text-[8px] font-black uppercase text-indigo-300 tracking-wider leading-none">🎯 Đang Học</p>
                                <p className="text-xs font-bold text-white truncate mt-1 leading-none">{selectedTodo.content}</p>
                            </div>
                            <button
                                onClick={() => handleCompleteTask(selectedTodo)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-md text-[9px] font-bold shrink-0 cursor-pointer"
                            >
                                Xong
                            </button>
                        </div>
                    )}
                </section>

                {/* 2. CENTER COLUMN: Focus Core / Timer (Optimized Height) */}
                <section className={`flex-[6] flex flex-col justify-start items-center gap-4 md:gap-5 min-h-0 bg-white/5 border border-white/5 rounded-2xl p-4 pt-6 shadow-2xl relative transition-all duration-300 ${
                    mobileTab === 'TIMER' ? 'flex' : 'hidden lg:flex'
                }`}>
                    
                    {/* Mode Switcher */}
                    <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-xl w-full max-w-[240px] shrink-0">
                        <button
                            onClick={() => timer.switchEngineMode('TIMER')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                                timer.engineMode === 'TIMER' 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-white/50 hover:text-white'
                            }`}
                        >
                            Hẹn Giờ
                        </button>
                        <button
                            onClick={() => timer.switchEngineMode('STOPWATCH')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                                timer.engineMode === 'STOPWATCH' 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-white/50 hover:text-white'
                            }`}
                        >
                            Bấm Giờ
                        </button>
                    </div>

                    {/* Circular Timer Display (Reduced size) */}
                    <div className="relative flex items-center justify-center py-2">
                        <svg height={radius * 2} width={radius * 2} className="relative z-10">
                            <defs>
                                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#818cf8" />
                                    <stop offset="50%" stopColor="#c084fc" />
                                    <stop offset="100%" stopColor="#f472b6" />
                                </linearGradient>
                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            <circle
                                stroke="rgba(255, 255, 255, 0.04)"
                                fill="transparent"
                                strokeWidth={stroke}
                                r={normalizedRadius}
                                cx={radius}
                                cy={radius}
                            />
                            <circle
                                stroke="url(#timerGradient)"
                                fill="transparent"
                                strokeWidth={stroke}
                                strokeDasharray={circumference + ' ' + circumference}
                                style={{
                                    strokeDashoffset,
                                    transform: 'rotate(-90deg)',
                                    transformOrigin: '50% 50%'
                                }}
                                strokeLinecap="round"
                                r={normalizedRadius}
                                cx={radius}
                                cy={radius}
                                filter="url(#glow)"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>

                        {/* Text Inside Ring */}
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                            <div className="text-[44px] md:text-[50px] font-black tracking-tight leading-none tabular-nums font-mono text-white select-none drop-shadow-md">
                                {formatTime(timer.timeLeft || 0)}
                            </div>

                            <span className="text-[8px] md:text-[9px] font-black tracking-widest uppercase text-white/40 mt-1">
                                {timer.engineMode === 'STOPWATCH' ? 'ĐÃ HỌC ĐƯỢC' : (timer.mode === 'WORK' ? 'ĐANG TẬP TRUNG' : 'ĐANG NGHỈ NGƠI')}
                            </span>
                    </div>
                </div>

                    {/* Compact Quote (Moved right under the timer circle) */}
                    <div className="w-full max-w-sm bg-white/5 border border-white/5 p-2 rounded-xl flex items-center justify-between gap-2 text-center shrink-0 animate-fade-in">
                        <div className="flex items-center gap-1 text-white/20">
                            <Quote size={12} className="shrink-0" />
                        </div>
                        <p className="text-[10px] font-medium text-white/60 italic flex-1 leading-normal truncate">
                            {quote}
                        </p>
                        <button
                            onClick={handleNextQuote}
                            className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors cursor-pointer"
                        >
                            <RefreshCw size={10} />
                        </button>
                    </div>

                    {/* Timer Controls */}
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={timer.toggleTimer}
                            className={`px-6 py-2.5 rounded-full font-bold text-xs transition-all active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer ${
                                timer.status === 'RUNNING'
                                    ? 'bg-white text-black hover:bg-gray-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            }`}
                        >
                            {timer.status === 'RUNNING' ? (
                                <><Pause size={14} fill="currentColor" /> Tạm Dừng</>
                            ) : (
                                <><Play size={14} fill="currentColor" /> Bắt Đầu</>
                            )}
                        </button>

                        <button
                            onClick={timer.resetTimer}
                            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/5 transition-all active:scale-95 cursor-pointer"
                            title="Đặt lại"
                        >
                            <RotateCcw size={14} />
                        </button>
                    </div>

                    {/* Presets */}
                    {timer.engineMode === 'TIMER' && (
                        <div className="flex gap-1.5 flex-wrap justify-center shrink-0 max-w-sm">
                            {PRESETS.map(p => {
                                const isActive = timer.currentPreset.id === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => timer.selectPreset(p)}
                                        className={`px-2.5 py-1 rounded-lg text-[8px] font-black border transition-all cursor-pointer ${
                                            isActive 
                                                ? 'bg-white/15 text-white border-white/30 shadow-sm' 
                                                : 'bg-white/5 border-white/5 text-white/50 hover:text-white'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}



                </section>

                {/* 3. RIGHT COLUMN: Chill Zone / Sounds & Scenery (Compact Single-Row Items) */}
                <section className={`flex-[3] flex flex-col min-h-0 bg-white/5 border border-white/5 rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
                    mobileTab === 'SOUNDS' ? 'flex' : 'hidden lg:flex'
                }`}>
                    
                    {/* Section: Background Scenery Selection */}
                    <div className="mb-4 shrink-0">
                        <h3 className="font-extrabold text-xs flex items-center gap-1.5 text-indigo-200 mb-2">
                            <Compass size={14} />
                            <span>Chủ Đề</span>
                        </h3>
                        <div className="grid grid-cols-5 gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
                            {(['sunset', 'rainy', 'forest', 'space', 'zen'] as SceneryType[]).map(t => {
                                const isActive = scenery === t;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => handleSceneryChange(t)}
                                        className={`py-1.5 text-[8px] font-black rounded-lg border capitalize transition-all cursor-pointer ${
                                            isActive 
                                                ? 'bg-white text-indigo-900 border-white' 
                                                : 'bg-transparent border-transparent text-white/50 hover:text-white'
                                        }`}
                                    >
                                        {t === 'sunset' ? 'Chiều' :
                                         t === 'rainy' ? 'Mưa' :
                                         t === 'forest' ? 'Rừng' :
                                         t === 'space' ? 'Vũ Trụ' : 'Zen'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section: Ambient Sound Mixer */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <h3 className="font-extrabold text-xs flex items-center gap-1.5 text-indigo-200 mb-2 shrink-0">
                            <Music size={14} />
                            <span>Âm Thanh Nền</span>
                        </h3>

                        {/* Sound list container */}
                        <div className="flex-1 overflow-y-auto pr-0.5 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            
                            {/* Compact Lo-Fi Radio Stream Player */}
                            <div className={`p-2.5 rounded-xl border transition-all ${
                                isPlayingLofi 
                                    ? 'bg-indigo-600/10 border-indigo-400/20' 
                                    : 'bg-white/5 border-white/5'
                            }`}>
                                <div className="flex justify-between items-center gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`p-1.5 rounded-lg shrink-0 ${
                                            isPlayingLofi ? 'bg-indigo-600 text-white animate-spin-slow' : 'bg-white/5 text-white/30'
                                        }`}>
                                            <Music size={12} />
                                        </div>
                                        <div className="min-w-0 flex flex-col">
                                            <p className="text-[7px] font-black uppercase text-indigo-300 leading-none mb-1">Focus Sounds</p>
                                            <select
                                                value={currentLofiIndex}
                                                onChange={(e) => {
                                                    if (e.target.value === "-999") {
                                                        localFileInputRef.current?.click();
                                                        return;
                                                    }
                                                    const nextIndex = parseInt(e.target.value);
                                                    setCurrentLofiIndex(nextIndex);
                                                    let audio = audioRefs.current['lofi'];
                                                    if (audio) {
                                                        audio.src = playlist[nextIndex].url;
                                                        if (isPlayingLofi) {
                                                            audio.play().catch(err => console.log(err));
                                                        }
                                                    } else if (isPlayingLofi) {
                                                        playOrPauseAudio('lofi', true, playlist[nextIndex].url, true);
                                                    }
                                                }}
                                                className="bg-black/30 border border-white/10 rounded-md text-[10px] font-bold text-white outline-none cursor-pointer w-[120px] xl:w-[145px] py-0.5 px-1 focus:border-indigo-400 transition-colors"
                                                style={{ colorScheme: 'dark' }}
                                            >
                                                {playlist.map((track, idx) => (
                                                    <option key={idx} value={idx} className="bg-[#121214] text-white">
                                                        {track.name}
                                                    </option>
                                                ))}
                                                <option value="-999" className="bg-[#121214] text-indigo-300 font-bold">
                                                    📁 Chọn nhạc từ máy...
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        {isPlayingLofi && (
                                            <button
                                                onClick={handleNextLofiTrack}
                                                className="p-1 bg-white/5 hover:bg-white/10 rounded-md text-white/70 transition-colors cursor-pointer"
                                            >
                                                <RefreshCw size={10} />
                                            </button>
                                        )}
                                        <button
                                            onClick={handleToggleLofi}
                                            className={`px-2 py-1 rounded-md text-[8px] font-bold transition-all cursor-pointer ${
                                                isPlayingLofi 
                                                    ? 'bg-indigo-600 text-white' 
                                                    : 'bg-white/10 text-white/80'
                                            }`}
                                        >
                                            {isPlayingLofi ? 'Dừng' : 'Bật'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Volume2 size={10} className="text-white/30 shrink-0" />
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={soundVolumes['lofi']}
                                        onChange={e => handleVolumeChange('lofi', parseFloat(e.target.value))}
                                        className="flex-1 h-0.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                                    />
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-white/5 my-2" />

                            {/* Nature sounds list (CONDENSED SINGLE ROW LAYOUT) */}
                            {AMBIENT_SOUNDS.map(sound => {
                                const isPlaying = !!activeSounds[sound.id];
                                const SoundIcon = sound.icon;
                                const volumeValue = soundVolumes[sound.id] !== undefined ? soundVolumes[sound.id] : 0.4;

                                return (
                                    <div
                                        key={sound.id}
                                        className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                                            isPlaying 
                                                ? 'bg-white/10 border-white/10' 
                                                : 'bg-white/5 border-transparent'
                                        }`}
                                    >
                                        {/* Play Toggle Circle Icon */}
                                        <button
                                            onClick={() => handleToggleAmbient(sound.id)}
                                            className={`p-1.5 rounded-lg shrink-0 transition-all ${
                                                isPlaying ? 'bg-white/10 text-indigo-300' : 'bg-transparent text-white/30'
                                            }`}
                                        >
                                            <SoundIcon size={12} />
                                        </button>

                                        {/* Name & Slider */}
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            <span className="text-[10px] font-bold text-white/80 w-11 shrink-0 truncate">
                                                {sound.name}
                                            </span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={volumeValue}
                                                onChange={e => handleVolumeChange(sound.id, parseFloat(e.target.value))}
                                                className="flex-1 h-0.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400 disabled:opacity-30"
                                                disabled={!isPlaying}
                                            />
                                        </div>

                                        {/* On/Off Text Action Button */}
                                        <button
                                            onClick={() => handleToggleAmbient(sound.id)}
                                            className={`w-9 py-1 rounded-md text-[8px] font-black transition-all cursor-pointer ${
                                                isPlaying 
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/10' 
                                                    : 'bg-white/5 text-white/40'
                                            }`}
                                        >
                                            {isPlaying ? 'Tắt' : 'Bật'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer link to Tram Hoc FPT (Minimalist layout) */}
                    <div className="mt-3 text-center shrink-0 border-t border-white/5 pt-2 hidden lg:block">
                        <a
                            href="https://tramhoc.fpt.edu.vn"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-white/40 hover:text-white transition-colors"
                        >
                            <GraduationCap size={11} className="text-orange-400" />
                            <span>Vào Trạm Học FPT</span>
                            <ExternalLink size={8} />
                        </a>
                    </div>
                </section>

            </div>
            <input
                type="file"
                ref={localFileInputRef}
                onChange={handleLocalFileSelect}
                accept="audio/*"
                className="hidden"
            />
        </div>
    );
};

export default MusicSpace;
