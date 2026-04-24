-- =============================================
-- MY SPOTIFY — Database Schema
-- SmartLifeApp — Personal Music Library
-- =============================================

-- 1. Bảng Playlist
CREATE TABLE my_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_color TEXT DEFAULT '#6366f1',
    is_favorite BOOLEAN DEFAULT false,
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,  -- tổng thời lượng (giây)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng Track (bài hát)
CREATE TABLE my_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    playlist_id UUID NOT NULL REFERENCES my_playlists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT DEFAULT 'Unknown',
    duration INTEGER DEFAULT 0,       -- thời lượng (giây)
    file_url TEXT NOT NULL,
    file_path TEXT,                    -- path trong Supabase Storage
    file_name TEXT,
    file_size INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_my_playlists_user ON my_playlists(user_id);
CREATE INDEX idx_my_tracks_user ON my_tracks(user_id);
CREATE INDEX idx_my_tracks_playlist ON my_tracks(playlist_id);
CREATE INDEX idx_my_tracks_sort ON my_tracks(playlist_id, sort_order);

-- 4. RLS (Row Level Security)
ALTER TABLE my_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_tracks ENABLE ROW LEVEL SECURITY;

-- Playlist policies
CREATE POLICY "Users can view their own playlists"
    ON my_playlists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own playlists"
    ON my_playlists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playlists"
    ON my_playlists FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playlists"
    ON my_playlists FOR DELETE
    USING (auth.uid() = user_id);

-- Track policies
CREATE POLICY "Users can view their own tracks"
    ON my_tracks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tracks"
    ON my_tracks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracks"
    ON my_tracks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracks"
    ON my_tracks FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Function: Auto-update track_count & total_duration khi thêm/xóa track
CREATE OR REPLACE FUNCTION update_playlist_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE my_playlists SET
            track_count = (SELECT COUNT(*) FROM my_tracks WHERE playlist_id = OLD.playlist_id),
            total_duration = COALESCE((SELECT SUM(duration) FROM my_tracks WHERE playlist_id = OLD.playlist_id), 0),
            updated_at = now()
        WHERE id = OLD.playlist_id;
        RETURN OLD;
    ELSE
        UPDATE my_playlists SET
            track_count = (SELECT COUNT(*) FROM my_tracks WHERE playlist_id = NEW.playlist_id),
            total_duration = COALESCE((SELECT SUM(duration) FROM my_tracks WHERE playlist_id = NEW.playlist_id), 0),
            updated_at = now()
        WHERE id = NEW.playlist_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_playlist_stats
AFTER INSERT OR DELETE ON my_tracks
FOR EACH ROW EXECUTE FUNCTION update_playlist_stats();
