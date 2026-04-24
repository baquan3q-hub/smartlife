// File: src/components/MySpotify.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { MyPlaylist, MyTrack } from '../types';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX,
  Music, Plus, Trash2, X, ChevronLeft, Upload, Loader2, Edit2, Check
} from 'lucide-react';

interface MySpotifyProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const MySpotify: React.FC<MySpotifyProps> = ({ isOpen, onClose, userId }) => {
  const [playlists, setPlaylists] = useState<MyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<MyPlaylist | null>(null);
  const [tracks, setTracks] = useState<MyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // UI States
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [showUploadTrack, setShowUploadTrack] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New States for Edit & Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'playlist' | 'track', id: string, name: string, data?: any } | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTrackTitle, setEditTrackTitle] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');

  const player = useAudioPlayer();

  useEffect(() => {
    if (isOpen && userId) {
      fetchPlaylists();
    }
  }, [isOpen, userId]);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('my_playlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlaylists(data || []);
    } catch (err: any) {
      console.error('Error fetching playlists:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTracks = async (playlistId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('my_tracks')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTracks(data || []);
      // Load playlist into player but don't auto-play yet
      player.loadPlaylist(data || []);
    } catch (err: any) {
      console.error('Error fetching tracks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlaylist = (playlist: MyPlaylist) => {
    setSelectedPlaylist(playlist);
    fetchTracks(playlist.id);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const { data, error } = await supabase.from('my_playlists').insert([{
        user_id: userId,
        name: newPlaylistName.trim(),
        cover_color: '#6366f1'
      }]).select().single();

      if (error) throw error;
      if (data) {
        setPlaylists([data, ...playlists]);
        setNewPlaylistName('');
        setShowCreatePlaylist(false);
      }
    } catch (err: any) {
      console.error('Error creating playlist:', err);
      alert('Error creating playlist: ' + err.message);
    }
  };

  const handleDeletePlaylistClick = (playlist: MyPlaylist, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'playlist', id: playlist.id, name: playlist.name });
  };

  const handleDeleteTrackClick = (track: MyTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'track', id: track.id, name: track.title, data: track });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'playlist') {
        const { error } = await supabase.from('my_playlists').delete().eq('id', deleteTarget.id);
        if (error) throw error;
        setPlaylists(playlists.filter(p => p.id !== deleteTarget.id));
        if (selectedPlaylist?.id === deleteTarget.id) {
          setSelectedPlaylist(null);
          setTracks([]);
        }
      } else if (deleteTarget.type === 'track') {
        const track = deleteTarget.data as MyTrack;
        if (track.file_path) {
          await supabase.storage.from('my-spotify').remove([track.file_path]);
        }
        const { error } = await supabase.from('my_tracks').delete().eq('id', track.id);
        if (error) throw error;

        const newTracks = tracks.filter(t => t.id !== track.id);
        setTracks(newTracks);
      }
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Lỗi xóa: ${err.message}`);
    }
  };

  const startEditTrack = (track: MyTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrackId(track.id);
    setEditTrackTitle(track.title);
  };

  const startEditPlaylist = (playlist: MyPlaylist, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlaylistId(playlist.id);
    setEditPlaylistName(playlist.name);
  };

  const saveEditPlaylist = async (playlist: MyPlaylist) => {
    if (!editPlaylistName.trim() || editPlaylistName === playlist.name) {
      setEditingPlaylistId(null);
      return;
    }

    try {
      const { error } = await supabase.from('my_playlists').update({ name: editPlaylistName }).eq('id', playlist.id);
      if (error) throw error;

      const newPlaylists = playlists.map(p => p.id === playlist.id ? { ...p, name: editPlaylistName } : p);
      setPlaylists(newPlaylists);
      if (selectedPlaylist?.id === playlist.id) {
        setSelectedPlaylist({ ...selectedPlaylist, name: editPlaylistName });
      }
    } catch (err: any) {
      alert(`Lỗi cập nhật tên playlist: ${err.message}`);
    } finally {
      setEditingPlaylistId(null);
    }
  };

  const saveEditTrack = async (track: MyTrack) => {
    if (!editTrackTitle.trim() || editTrackTitle === track.title) {
      setEditingTrackId(null);
      return;
    }

    try {
      const { error } = await supabase.from('my_tracks').update({ title: editTrackTitle }).eq('id', track.id);
      if (error) throw error;

      const newTracks = tracks.map(t => t.id === track.id ? { ...t, title: editTrackTitle } : t);
      setTracks(newTracks);
      if (player.currentTrack?.id === track.id) {
        player.loadPlaylist(newTracks);
      }
    } catch (err: any) {
      alert(`Lỗi cập nhật tên: ${err.message}`);
    } finally {
      setEditingTrackId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedPlaylist) return;

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${userId}/${selectedPlaylist.id}/${Date.now()}_${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('my-spotify')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = await supabase.storage
          .from('my-spotify')
          .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365);

        if (!urlData?.signedUrl) throw new Error('Could not get signed URL');

        const title = file.name.replace(/\.[^/.]+$/, "");

        const { error: insertError } = await supabase.from('my_tracks').insert([{
          user_id: userId,
          playlist_id: selectedPlaylist.id,
          title: title,
          file_url: urlData.signedUrl,
          file_path: uploadData.path,
          file_name: safeName,
          file_size: file.size
        }]);

        if (insertError) throw insertError;
      } catch (err: any) {
        console.error('Error uploading track:', err);
        alert(`Error uploading ${file.name}: ${err.message}`);
      }
    }

    setIsUploading(false);
    setShowUploadTrack(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchTracks(selectedPlaylist.id);
  };

  const handleDeleteTrack = async (track: MyTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Xóa bài hát "${track.title}"?`)) return;
    try {
      if (track.file_path) {
        await supabase.storage.from('my-spotify').remove([track.file_path]);
      }
      const { error } = await supabase.from('my_tracks').delete().eq('id', track.id);
      if (error) throw error;

      const newTracks = tracks.filter(t => t.id !== track.id);
      setTracks(newTracks);
      player.loadPlaylist(newTracks); // Update player playlist
    } catch (err: any) {
      console.error('Error deleting track:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full h-[100dvh] md:h-[95vh] md:w-[95%] md:max-w-6xl bg-[#121212] text-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden h-[calc(100%-90px)]">

          {/* Sidebar - Playlists */}
          <div className="w-64 bg-black/95 backdrop-blur-xl flex flex-col hidden md:flex border-r border-white/10 shrink-0 relative z-20">
            <div className="p-6">
              <h1 className="text-2xl font-black flex items-center gap-2 mb-8 tracking-tight">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Music size={16} className="text-white" />
                </div>
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">My Spotify</span>
              </h1>

              <div className="flex items-center justify-between text-gray-400 hover:text-white mb-4 cursor-pointer group transition-colors" onClick={() => setShowCreatePlaylist(true)}>
                <span className="font-bold text-sm tracking-widest uppercase">Thư viện của bạn</span>
                <div className="p-1 rounded-full group-hover:bg-white/10 transition-colors">
                  <Plus size={18} className="group-hover:scale-110 transition-transform text-indigo-400" />
                </div>
              </div>

              {showCreatePlaylist && (
                <div className="mb-4 bg-[#242424] p-3 rounded-xl border border-white/10">
                  <input
                    autoFocus
                    type="text"
                    value={newPlaylistName}
                    onChange={e => setNewPlaylistName(e.target.value)}
                    placeholder="Tên playlist..."
                    className="w-full bg-transparent border-b border-white/20 text-sm text-white px-1 py-1 outline-none focus:border-indigo-500 mb-3"
                    onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowCreatePlaylist(false)} className="text-xs text-gray-400 hover:text-white">Hủy</button>
                    <button onClick={handleCreatePlaylist} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full font-bold">Tạo</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {playlists.map((playlist, index) => {
                const gradients = [
                  'from-indigo-500 to-purple-600',
                  'from-rose-500 to-orange-500',
                  'from-emerald-500 to-teal-600',
                  'from-blue-500 to-cyan-500',
                  'from-fuchsia-500 to-pink-600'
                ];
                const bgGradient = gradients[index % gradients.length];
                const isSelected = selectedPlaylist?.id === playlist.id;

                return (
                  <div
                    key={playlist.id}
                    onClick={() => handleSelectPlaylist(playlist)}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-12 h-12 bg-gradient-to-br ${bgGradient} rounded-xl flex flex-shrink-0 items-center justify-center shadow-inner relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-black/10"></div>
                        <Music size={20} className="text-white relative z-10 drop-shadow-md" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        {editingPlaylistId === playlist.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editPlaylistName}
                              onChange={e => setEditPlaylistName(e.target.value)}
                              onBlur={() => saveEditPlaylist(playlist)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEditPlaylist(playlist);
                                if (e.key === 'Escape') setEditingPlaylistId(null);
                              }}
                              className="w-full bg-black/50 text-white px-2 py-1 rounded text-xs outline-none border border-indigo-500/50 focus:border-indigo-500 font-bold shadow-inner"
                              onClick={e => e.stopPropagation()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); saveEditPlaylist(playlist); }} className="p-1 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded transition-colors">
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className={`font-bold truncate text-sm ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white transition-colors'}`}>{playlist.name}</span>
                            <span className="text-xs text-gray-500 font-medium">{playlist.track_count || 0} bài</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => startEditPlaylist(playlist, e)} className="text-gray-500 hover:text-indigo-400 p-1.5 hover:bg-indigo-400/10 rounded-full transition-all">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={(e) => handleDeletePlaylistClick(playlist, e)} className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-full transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Panel - Tracks */}
          <div className="flex-1 flex flex-col bg-[#121212] overflow-hidden relative">
            {/* Ambient Background Glow for Mobile */}
            <div className="md:hidden absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-900/30 via-purple-900/10 to-transparent pointer-events-none z-0"></div>

            {/* Header for mobile */}
            <div className="md:hidden flex items-center justify-between p-4 pt-6 bg-transparent z-10 sticky top-0 backdrop-blur-md border-b border-white/5">
              {selectedPlaylist ? (
                <button onClick={() => setSelectedPlaylist(null)} className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-colors border border-white/10">
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <h1 className="font-black text-lg flex items-center gap-2 tracking-tight">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Music size={16} className="text-white" />
                  </div>
                  My Spotify
                </h1>
              )}
              <button onClick={onClose} className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-colors border border-white/10">
                <X size={20} />
              </button>
            </div>

            {/* Desktop close button - only show when no playlist is selected */}
            {!selectedPlaylist && (
              <button onClick={onClose} className="hidden md:flex absolute top-6 right-6 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full text-gray-300 hover:text-white transition-all backdrop-blur-md border border-white/10">
                <X size={20} />
              </button>
            )}

            {!selectedPlaylist && (
              <div className="flex-1 flex flex-col items-center justify-start p-4 md:hidden relative z-10 pt-4">
              <div className="w-full space-y-3 overflow-y-auto max-h-[65vh] pb-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {playlists.map((playlist, index) => {
                  const gradients = [
                    'from-indigo-500 to-purple-600',
                    'from-rose-500 to-orange-500',
                    'from-emerald-500 to-teal-600',
                    'from-blue-500 to-cyan-500',
                    'from-fuchsia-500 to-pink-600'
                  ];
                  const bgGradient = gradients[index % gradients.length];

                  return (
                    <div key={playlist.id} onClick={() => handleSelectPlaylist(playlist)} className="group flex items-center gap-4 p-3 pr-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/20 rounded-2xl transition-all cursor-pointer shadow-lg">
                      <div className={`w-14 h-14 bg-gradient-to-br ${bgGradient} rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-black/10"></div>
                        <Music size={24} className="text-white relative z-10 drop-shadow-md" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        {editingPlaylistId === playlist.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editPlaylistName}
                              onChange={e => setEditPlaylistName(e.target.value)}
                              onBlur={() => saveEditPlaylist(playlist)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEditPlaylist(playlist);
                                if (e.key === 'Escape') setEditingPlaylistId(null);
                              }}
                              className="w-full bg-black/50 text-white px-2 py-1.5 rounded-lg text-sm outline-none border border-indigo-500/50 focus:border-indigo-500 font-bold shadow-inner"
                              onClick={e => e.stopPropagation()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); saveEditPlaylist(playlist); }} className="p-1.5 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition-colors">
                              <Check size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="font-bold text-base text-gray-100 truncate">{playlist.name}</p>
                            <p className="text-xs text-gray-400 font-medium">{playlist.track_count || 0} bài hát</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => startEditPlaylist(playlist, e)} className="text-gray-500 hover:text-indigo-400 p-2 bg-black/20 hover:bg-indigo-500/20 rounded-full transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={(e) => handleDeletePlaylistClick(playlist, e)} className="text-gray-500 hover:text-red-400 p-2 bg-black/20 hover:bg-red-500/20 rounded-full transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button onClick={() => setShowCreatePlaylist(true)} className="w-full mt-4 relative group block">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-500"></div>
                  <div className="relative p-4 bg-[#1a1a1a] border border-white/10 hover:border-white/30 rounded-2xl text-white font-bold flex items-center justify-center gap-3 transition-colors shadow-xl">
                    <div className="p-1 bg-white/10 rounded-full">
                      <Plus size={20} className="text-pink-400" />
                    </div>
                    Tạo playlist mới
                  </div>
                </button>
              </div>
            </div>
            )}

            {selectedPlaylist && (
              <div className="flex-1 overflow-y-auto relative z-0 bg-[#121212] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                {/* Ultra-Compact Sticky Header & Controls */}
                <div className="sticky top-0 z-20 px-4 md:px-8 py-2 md:py-3 flex items-center justify-between bg-[#121212]/95 backdrop-blur-xl border-b border-white/5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-500 to-pink-500 rounded flex items-center justify-center shrink-0">
                      <Music size={16} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                      <h1 className="text-base md:text-lg font-bold text-white truncate max-w-[150px] md:max-w-xs">{selectedPlaylist.name}</h1>
                      <p className="text-[10px] md:text-xs text-gray-400">
                        {tracks.length} bài hát
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:gap-3">
                    <button
                      onClick={() => tracks.length > 0 && player.playAtIndex(0)}
                      disabled={tracks.length === 0}
                      className="w-8 h-8 md:w-10 md:h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-md"
                    >
                      <Play size={16} fill="currentColor" className="ml-0.5 md:ml-1" />
                    </button>

                    <button onClick={() => setShowUploadTrack(!showUploadTrack)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-gray-300 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/10 hover:text-white hover:border-white/20 shadow-sm" title="Thêm bài hát">
                      <Plus size={18} />
                    </button>

                    {/* Desktop Close button integrated into header */}
                    <div className="hidden md:flex items-center justify-center border-l border-white/10 pl-3 ml-1 h-6">
                      <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/20 shadow-sm" title="Đóng">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Upload Section */}
                {showUploadTrack && (
                  <div className="px-4 md:px-10 mt-6 animate-fade-in">
                    <div className="p-6 bg-[#242424] rounded-xl border border-white/10 shadow-lg">
                      <h3 className="font-bold mb-4">Tải bài hát lên</h3>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" multiple className="hidden" />
                      <div
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        className={`w-full p-8 border-2 border-dashed ${isUploading ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-600 hover:border-indigo-400 hover:bg-white/5'} rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all`}
                      >
                        {isUploading ? (
                          <><Loader2 size={32} className="animate-spin text-indigo-500 mb-3" /><p className="text-indigo-400 font-bold">Đang tải lên...</p></>
                        ) : (
                          <><Upload size={32} className="text-gray-400 mb-3" /><p className="font-bold mb-1">Bấm để chọn file nhạc</p><p className="text-sm text-gray-500">Hỗ trợ MP3, M4A, WAV (Giới hạn 50MB)</p></>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Track List */}
                <div className="px-4 md:px-10 pb-20 pt-6">
                  {tracks.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                      <Music size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg">Chưa có bài hát nào</p>
                      <p className="text-sm">Bấm dấu + phía trên để thêm nhạc từ máy của bạn.</p>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto] gap-3 md:gap-4 px-2 md:px-4 py-2 text-xs md:text-sm text-gray-400 font-medium uppercase tracking-wider border-b border-white/10 mb-2 md:mb-4">
                        <div className="w-6 md:w-8 text-center">#</div>
                        <div>Tiêu đề</div>
                        <div className="w-24 text-right pr-4 hidden md:block">Kích thước</div>
                        <div className="w-8 md:w-10"></div>
                      </div>

                      {tracks.map((track, index) => {
                        const isCurrentTrack = player.currentTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => player.playTrack(track)}
                            className={`group grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto] gap-3 md:gap-4 px-2 md:px-4 py-3 items-center rounded-xl cursor-pointer transition-all border border-transparent ${isCurrentTrack ? 'bg-white/10 border-white/5 shadow-md' : 'hover:bg-white/[0.05] hover:border-white/[0.02]'}`}
                          >
                            <div className="w-6 md:w-8 text-center flex items-center justify-center">
                              {isCurrentTrack && player.isPlaying ? (
                                <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" alt="playing" className="w-4 h-4 opacity-80" />
                              ) : (
                                <span className={`text-sm md:text-base font-medium ${isCurrentTrack ? 'text-indigo-400' : 'text-gray-500 group-hover:text-white transition-colors'}`}>{index + 1}</span>
                              )}
                            </div>

                            <div className="flex flex-col min-w-0 pr-2 md:pr-4 relative">
                              {editingTrackId === track.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    autoFocus
                                    value={editTrackTitle}
                                    onChange={e => setEditTrackTitle(e.target.value)}
                                    onBlur={() => saveEditTrack(track)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveEditTrack(track);
                                      if (e.key === 'Escape') setEditingTrackId(null);
                                    }}
                                    className="w-full bg-black/50 text-white px-3 py-1.5 rounded-lg text-sm md:text-base outline-none border border-indigo-500/50 focus:border-indigo-500 font-bold shadow-inner"
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <button onClick={(e) => { e.stopPropagation(); saveEditTrack(track); }} className="p-1.5 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition-colors">
                                    <Check size={16} />
                                  </button>
                                </div>
                              ) : (
                                <span className={`font-bold truncate text-sm md:text-base ${isCurrentTrack ? 'text-indigo-400 drop-shadow-sm' : 'text-gray-200 group-hover:text-white transition-colors'}`}>{track.title}</span>
                              )}
                              <span className="text-xs md:text-sm text-gray-500 truncate group-hover:text-gray-400 transition-colors">{track.artist || 'Unknown Artist'}</span>
                            </div>

                            <div className="w-24 text-right text-xs md:text-sm text-gray-500 pr-4 hidden md:block">
                              {track.file_size ? `${(track.file_size / (1024 * 1024)).toFixed(1)} MB` : ''}
                            </div>

                            <div className="w-16 md:w-20 flex items-center justify-end gap-1">
                              <button onClick={(e) => startEditTrack(track, e)} className="md:opacity-0 md:group-hover:opacity-100 text-gray-500 hover:text-indigo-400 p-2 hover:bg-indigo-400/10 rounded-full transition-all">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={(e) => handleDeleteTrackClick(track, e)} className="md:opacity-0 md:group-hover:opacity-100 text-gray-500 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-full transition-all">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Player Bar */}
        <div className="bg-[#181818] border-t border-white/10 shrink-0 z-50 flex flex-col pb-safe">

          {/* Mobile Player Layout */}
          <div className="md:hidden flex flex-col w-full p-4 gap-3">
            {/* Track Info */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-800 rounded-md flex-shrink-0 flex items-center justify-center shadow-md">
                <Music className="text-white opacity-50" size={20} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-white truncate">{player.currentTrack?.title || 'Chưa chọn bài hát'}</span>
                <span className="text-xs text-gray-400 truncate">{player.currentTrack?.artist || 'Unknown Artist'}</span>
              </div>
            </div>

            {/* Mobile Progress Bar */}
            <div className="w-full flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400 font-mono w-10 text-right">{player.formatTime(player.currentTime)}</span>
              <div className="flex-1 h-1.5 bg-gray-600 rounded-full relative cursor-pointer">
                <input
                  type="range" min={0} max={player.duration || 100} value={player.currentTime || 0}
                  onChange={(e) => player.seek(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="h-full bg-indigo-500 rounded-full relative" style={{ width: `${player.duration ? (player.currentTime / player.duration) * 100 : 0}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow transform translate-x-1/2"></div>
                </div>
              </div>
              <span className="text-xs text-gray-400 font-mono w-10 text-left">{player.formatTime(player.duration)}</span>
            </div>

            {/* Mobile Controls */}
            <div className="flex items-center justify-between px-2 mt-1">
              <button onClick={player.toggleShuffle} className={`p-2 rounded-full transition-colors ${player.isShuffled ? 'text-indigo-500' : 'text-gray-400 hover:text-white'}`}>
                <Shuffle size={20} />
              </button>

              <button onClick={player.prevTrack} className="p-2 text-white hover:text-indigo-400 transition-colors">
                <SkipBack size={24} fill="currentColor" />
              </button>

              <button
                onClick={player.togglePlay} disabled={!player.currentTrack}
                className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform disabled:opacity-50"
              >
                {player.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </button>

              <button onClick={player.nextTrack} className="p-2 text-white hover:text-indigo-400 transition-colors">
                <SkipForward size={24} fill="currentColor" />
              </button>

              <button onClick={player.toggleRepeat} className={`p-2 relative rounded-full transition-colors ${player.repeatMode !== 'off' ? 'text-indigo-500' : 'text-gray-400 hover:text-white'}`}>
                <Repeat size={20} />
                {player.repeatMode === 'one' && <span className="absolute top-0 right-0 text-[9px] font-bold bg-indigo-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center">1</span>}
              </button>
            </div>
          </div>

          {/* Desktop Player Layout */}
          <div className="hidden md:flex flex-row items-center justify-between px-4 h-[90px] w-full">
            {/* Now Playing Info */}
            <div className="w-[30%] min-w-[180px] flex items-center gap-4 overflow-hidden pr-4">
              {player.currentTrack ? (
                <>
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-800 rounded-md flex-shrink-0 flex items-center justify-center shadow-md">
                    <Music className="text-white opacity-50" size={24} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-white truncate">{player.currentTrack.title}</span>
                    <span className="text-xs text-gray-400 truncate">{player.currentTrack.artist || 'Unknown Artist'}</span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Controls & Progress */}
            <div className="flex-1 max-w-2xl flex flex-col items-center justify-center px-4">
              <div className="flex items-center gap-6 mb-2">
                <button onClick={player.toggleShuffle} className={`p-2 rounded-full hover:bg-white/10 transition-colors ${player.isShuffled ? 'text-indigo-500' : 'text-gray-400 hover:text-white'}`}>
                  <Shuffle size={18} />
                </button>

                <button onClick={player.prevTrack} className="text-gray-400 hover:text-white transition-colors">
                  <SkipBack size={20} fill="currentColor" />
                </button>

                <button
                  onClick={player.togglePlay} disabled={!player.currentTrack}
                  className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {player.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                </button>

                <button onClick={player.nextTrack} className="text-gray-400 hover:text-white transition-colors">
                  <SkipForward size={20} fill="currentColor" />
                </button>

                <button onClick={player.toggleRepeat} className={`p-2 relative rounded-full hover:bg-white/10 transition-colors ${player.repeatMode !== 'off' ? 'text-indigo-500' : 'text-gray-400 hover:text-white'}`}>
                  <Repeat size={18} />
                  {player.repeatMode === 'one' && <span className="absolute top-0 right-0 text-[8px] font-bold bg-indigo-500 text-white w-3 h-3 rounded-full flex items-center justify-center">1</span>}
                </button>
              </div>

              {/* Desktop Progress Bar */}
              <div className="w-full flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400 w-10 text-right font-mono">{player.formatTime(player.currentTime)}</span>
                <div className="flex-1 h-1.5 bg-gray-600 rounded-full cursor-pointer relative group flex items-center">
                  <input type="range" min={0} max={player.duration || 100} value={player.currentTime || 0} onChange={(e) => player.seek(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="h-full bg-white group-hover:bg-indigo-500 rounded-full transition-colors relative" style={{ width: `${player.duration ? (player.currentTime / player.duration) * 100 : 0}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transform translate-x-1/2"></div>
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 text-left font-mono">{player.formatTime(player.duration)}</span>
              </div>
            </div>

            {/* Volume */}
            <div className="w-[30%] min-w-[120px] flex items-center justify-end gap-2">
              <button className="text-gray-400 hover:text-white">
                {player.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <div className="w-24 h-1.5 bg-gray-600 rounded-full relative group flex items-center">
                <input type="range" min={0} max={1} step={0.01} value={player.volume} onChange={(e) => player.changeVolume(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="h-full bg-white group-hover:bg-indigo-500 rounded-full transition-colors" style={{ width: `${player.volume * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2">Bạn chắc chưa?</h3>
              <p className="text-gray-400 text-sm mb-6">
                Hành động này không thể hoàn tác. Bạn có chắc muốn xóa {deleteTarget.type === 'playlist' ? 'playlist' : 'bài hát'} <span className="text-white font-bold">"{deleteTarget.name}"</span>?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-gray-300 hover:bg-white/10 font-bold transition-colors">Hủy bỏ</button>
                <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-bold transition-colors flex items-center gap-2">
                  <Trash2 size={16} />
                  Xóa ngay
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MySpotify;
