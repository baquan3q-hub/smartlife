-- Biển bảng lưu trữ cuộc hội thoại AI
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT DEFAULT 'Cuộc trò chuyện mới',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng lưu trữ tin nhắn chi tiết
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  charts JSONB DEFAULT NULL,
  actions JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng lưu trữ bộ nhớ dài hạn của AI (Sở thích, mục tiêu, facts...)
CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  memory_type TEXT CHECK (memory_type IN ('preference', 'fact', 'habit', 'goal_note')),
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes để query nhanh
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_id ON ai_memory(user_id);

-- Bật Row Level Security (RLS) để bảo mật dữ liệu
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

-- Policies (Chính sách): Người dùng chỉ được xem/sửa dữ liệu của chính họ
CREATE POLICY "Users own conversations" ON ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own messages" ON ai_messages FOR ALL USING (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users own memory" ON ai_memory FOR ALL USING (auth.uid() = user_id);
