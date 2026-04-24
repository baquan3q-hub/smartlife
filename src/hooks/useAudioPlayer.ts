// File: src/hooks/useAudioPlayer.ts
// Core audio playback engine for My Spotify

import { useState, useRef, useCallback, useEffect } from 'react';
import { MyTrack } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

export interface AudioPlayerState {
    currentTrack: MyTrack | null;
    playlist: MyTrack[];
    currentIndex: number;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    repeatMode: RepeatMode;
    isShuffled: boolean;
    isLoading: boolean;
}

export function useAudioPlayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [currentTrack, setCurrentTrack] = useState<MyTrack | null>(null);
    const [playlist, setPlaylist] = useState<MyTrack[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
    const [isShuffled, setIsShuffled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Shuffled order
    const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

    // Initialize audio element once
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.preload = 'metadata';
        }

        const audio = audioRef.current;

        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onDurationChange = () => setDuration(audio.duration || 0);
        const onLoadStart = () => setIsLoading(true);
        const onCanPlay = () => setIsLoading(false);
        const onEnded = () => handleTrackEnd();
        const onError = (e: Event) => {
            console.error('Audio error:', e);
            setIsLoading(false);
            setIsPlaying(false);
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('loadstart', onLoadStart);
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('loadstart', onLoadStart);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.pause();
        };
    }, []);

    // Update volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // Generate shuffled indices
    const generateShuffleOrder = useCallback((length: number, currentIdx: number) => {
        const indices = Array.from({ length }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        // Move current track to front
        if (currentIdx >= 0) {
            const pos = indices.indexOf(currentIdx);
            if (pos > 0) {
                [indices[0], indices[pos]] = [indices[pos], indices[0]];
            }
        }
        return indices;
    }, []);

    // Get the actual index considering shuffle
    const getActualIndex = useCallback((logicalIndex: number): number => {
        if (isShuffled && shuffledIndices.length > 0) {
            return shuffledIndices[logicalIndex] ?? logicalIndex;
        }
        return logicalIndex;
    }, [isShuffled, shuffledIndices]);

    // Find logical index from actual index
    const getLogicalIndex = useCallback((actualIndex: number): number => {
        if (isShuffled && shuffledIndices.length > 0) {
            const idx = shuffledIndices.indexOf(actualIndex);
            return idx >= 0 ? idx : actualIndex;
        }
        return actualIndex;
    }, [isShuffled, shuffledIndices]);

    // Handle track end
    const handleTrackEnd = useCallback(() => {
        if (repeatMode === 'one') {
            // Replay same track
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
            }
            return;
        }

        const logicalIdx = getLogicalIndex(currentIndex);
        const nextLogical = logicalIdx + 1;

        if (nextLogical < playlist.length) {
            // Play next
            const nextActual = getActualIndex(nextLogical);
            playAtIndex(nextActual);
        } else if (repeatMode === 'all') {
            // Loop back to first
            const firstActual = getActualIndex(0);
            playAtIndex(firstActual);
        } else {
            // End of playlist
            setIsPlaying(false);
        }
    }, [repeatMode, currentIndex, playlist.length, isShuffled, shuffledIndices]);

    // Re-attach ended handler when dependencies change
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onEnded = () => handleTrackEnd();
        audio.addEventListener('ended', onEnded);
        return () => audio.removeEventListener('ended', onEnded);
    }, [handleTrackEnd]);

    // Play a specific track at playlist index
    const playAtIndex = useCallback((index: number) => {
        if (index < 0 || index >= playlist.length) return;

        const track = playlist[index];
        setCurrentTrack(track);
        setCurrentIndex(index);
        setCurrentTime(0);
        setDuration(0);

        if (audioRef.current) {
            audioRef.current.src = track.file_url;
            audioRef.current.load();
            audioRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch((err) => {
                console.warn('Autoplay blocked:', err);
                setIsPlaying(false);
            });
        }
    }, [playlist]);

    // Load & play a full playlist
    const loadPlaylist = useCallback((tracks: MyTrack[], startIndex: number = 0) => {
        setPlaylist(tracks);
        if (isShuffled) {
            const newShuffle = generateShuffleOrder(tracks.length, startIndex);
            setShuffledIndices(newShuffle);
        }
        if (tracks.length > 0) {
            const idx = Math.min(startIndex, tracks.length - 1);
            setCurrentTrack(tracks[idx]);
            setCurrentIndex(idx);
            setCurrentTime(0);

            if (audioRef.current) {
                audioRef.current.src = tracks[idx].file_url;
                audioRef.current.load();
                audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
        }
    }, [isShuffled, generateShuffleOrder]);

    // Play / Pause toggle
    const togglePlay = useCallback(() => {
        if (!audioRef.current || !currentTrack) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
    }, [isPlaying, currentTrack]);

    // Play specific track
    const playTrack = useCallback((track: MyTrack) => {
        const idx = playlist.findIndex(t => t.id === track.id);
        if (idx >= 0) {
            playAtIndex(idx);
        } else {
            // Track not in current playlist — play solo
            setPlaylist([track]);
            setCurrentTrack(track);
            setCurrentIndex(0);
            setCurrentTime(0);

            if (audioRef.current) {
                audioRef.current.src = track.file_url;
                audioRef.current.load();
                audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
        }
    }, [playlist, playAtIndex]);

    // Next track
    const nextTrack = useCallback(() => {
        if (playlist.length === 0) return;

        const logicalIdx = getLogicalIndex(currentIndex);
        let nextLogical = logicalIdx + 1;

        if (nextLogical >= playlist.length) {
            if (repeatMode === 'all') nextLogical = 0;
            else return;
        }

        const nextActual = getActualIndex(nextLogical);
        playAtIndex(nextActual);
    }, [playlist, currentIndex, repeatMode, getLogicalIndex, getActualIndex, playAtIndex]);

    // Previous track
    const prevTrack = useCallback(() => {
        if (playlist.length === 0) return;

        // If more than 3 seconds played, restart current track
        if (currentTime > 3) {
            seek(0);
            return;
        }

        const logicalIdx = getLogicalIndex(currentIndex);
        let prevLogical = logicalIdx - 1;

        if (prevLogical < 0) {
            if (repeatMode === 'all') prevLogical = playlist.length - 1;
            else { seek(0); return; }
        }

        const prevActual = getActualIndex(prevLogical);
        playAtIndex(prevActual);
    }, [playlist, currentIndex, currentTime, repeatMode, getLogicalIndex, getActualIndex, playAtIndex]);

    // Seek
    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }, []);

    // Volume
    const changeVolume = useCallback((v: number) => {
        setVolume(Math.max(0, Math.min(1, v)));
    }, []);

    // Toggle repeat
    const toggleRepeat = useCallback(() => {
        setRepeatMode(prev => {
            if (prev === 'off') return 'all';
            if (prev === 'all') return 'one';
            return 'off';
        });
    }, []);

    // Toggle shuffle
    const toggleShuffle = useCallback(() => {
        setIsShuffled(prev => {
            if (!prev) {
                // Turning ON shuffle
                const newShuffle = generateShuffleOrder(playlist.length, currentIndex);
                setShuffledIndices(newShuffle);
            } else {
                setShuffledIndices([]);
            }
            return !prev;
        });
    }, [playlist.length, currentIndex, generateShuffleOrder]);

    // Format time helper
    const formatTime = useCallback((seconds: number): string => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, []);

    return {
        // State
        currentTrack,
        playlist,
        currentIndex,
        isPlaying,
        currentTime,
        duration,
        volume,
        repeatMode,
        isShuffled,
        isLoading,

        // Actions
        loadPlaylist,
        playTrack,
        playAtIndex,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        changeVolume,
        toggleRepeat,
        toggleShuffle,
        formatTime,
    };
}
