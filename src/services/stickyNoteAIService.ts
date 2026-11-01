// File: src/services/stickyNoteAIService.ts
// AI cho Sticky Notes: tách task, gợi ý tổ chức (tiêu đề/nhãn/màu), tóm tắt / viết lại.
// Dùng chung proxy /api/gemini (có kiểm tra quota theo gói) — KHÔNG gọi Gemini trực tiếp.

import { callGeminiRaw, estimateGeminiCost } from './geminiService';
import { supabase } from './supabase';
import { StickyColor, StickyNote, STICKY_COLORS } from './stickyNoteService';

const MAX_NOTE_CHARS = 4000;

export type AITaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AISuggestedTask {
  content: string;
  priority: AITaskPriority;
  /** ISO 8601 hoặc null */
  deadline: string | null;
}

export interface AIOrganizeSuggestion {
  title: string;
  labels: string[];
  color: StickyColor;
}

export type AIRewriteMode = 'summarize' | 'cleanup';

function noteText(note: Pick<StickyNote, 'title' | 'content'>): string {
  const text = `${note.title ? `Tiêu đề: ${note.title}\n` : ''}${note.content}`.trim();
  return text.slice(0, MAX_NOTE_CHARS);
}

function nowContext(): string {
  const now = new Date();
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const tz = `${sign}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)}`;
  return `Bây giờ là ${days[now.getDay()]}, ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} (UTC${tz}).`;
}

async function logUsage(action: string, data: any) {
  const usage = data?.usageMetadata;
  if (!usage?.totalTokenCount) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('api_logs').insert([{
      user_id: user.id,
      action,
      tokens_used: usage.totalTokenCount,
      prompt_tokens: usage.promptTokenCount || 0,
      candidates_tokens: usage.candidatesTokenCount || 0,
      estimated_cost_vnd: estimateGeminiCost(usage.promptTokenCount || 0, usage.candidatesTokenCount || 0),
    }]);
  } catch { /* log không quan trọng */ }
}

async function callJSON<T>(action: string, system: string, user: string, schema: object): Promise<T> {
  const data = await callGeminiRaw({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });
  logUsage(action, data);
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new Error('AI không trả về kết quả. Vui lòng thử lại.');
  try {
    return JSON.parse(text) as T;
  } catch {
    // Đôi khi model bọc JSON trong ```json
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error('Không đọc được kết quả AI.');
  }
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const stickyNoteAIService = {
  /** C1 — Tách các việc cần làm trong note thành task cho Kanban. */
  async extractTasks(note: Pick<StickyNote, 'title' | 'content'>): Promise<AISuggestedTask[]> {
    const text = noteText(note);
    if (!text) return [];
    const result = await callJSON<{ tasks: any[] }>(
      'sticky_ai_extract_tasks',
      `Bạn là trợ lý năng suất của SmartLife. Đọc ghi chú và tách ra các VIỆC CẦN LÀM cụ thể, có thể hành động được.
- Mỗi task ngắn gọn (≤ 80 ký tự), bắt đầu bằng động từ, giữ ngôn ngữ của ghi chú.
- priority: urgent (gấp, hôm nay), high (quan trọng / sắp tới hạn), medium (mặc định), low (khi rảnh).
- deadline: nếu ghi chú nhắc thời điểm ("mai", "thứ 6", "20/11 9h") thì quy đổi sang ISO 8601 có múi giờ địa phương; không có thì null. Thiếu giờ → 23:59.
- Không bịa task không có trong ghi chú. Ghi chú không có việc cần làm → tasks rỗng.
${nowContext()}`,
      `Ghi chú:\n"""\n${text}\n"""`,
      {
        type: 'OBJECT',
        properties: {
          tasks: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                content: { type: 'STRING' },
                priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'] },
                deadline: { type: 'STRING', nullable: true },
              },
              required: ['content', 'priority'],
            },
          },
        },
        required: ['tasks'],
      },
    );
    const allowed: AITaskPriority[] = ['low', 'medium', 'high', 'urgent'];
    return (result.tasks || [])
      .filter(t => typeof t?.content === 'string' && t.content.trim())
      .slice(0, 20)
      .map(t => ({
        content: t.content.trim().slice(0, 200),
        priority: allowed.includes(t.priority) ? t.priority : 'medium',
        deadline: toIsoOrNull(t.deadline),
      }));
  },

  /** C2 — Gợi ý tiêu đề, nhãn và màu. */
  async organize(note: Pick<StickyNote, 'title' | 'content'>, existingLabels: string[] = []): Promise<AIOrganizeSuggestion> {
    const text = noteText(note);
    const result = await callJSON<any>(
      'sticky_ai_organize',
      `Bạn giúp sắp xếp ghi chú dán. Trả về:
- title: tiêu đề ngắn (≤ 40 ký tự), cùng ngôn ngữ với ghi chú.
- labels: 1–3 nhãn ngắn (1–2 từ). Ưu tiên dùng lại nhãn có sẵn nếu phù hợp: ${existingLabels.slice(0, 30).join(', ') || '(chưa có)'}.
- color theo chủ đề: yellow = chung/ý tưởng, green = học tập, blue = công việc, pink = cá nhân/sức khoẻ, purple = sáng tạo/mục tiêu, gray = tham khảo, charcoal = quan trọng/khẩn.`,
      `Ghi chú:\n"""\n${text}\n"""`,
      {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          labels: { type: 'ARRAY', items: { type: 'STRING' } },
          color: { type: 'STRING', enum: STICKY_COLORS },
        },
        required: ['title', 'labels', 'color'],
      },
    );
    return {
      title: String(result.title || '').trim().slice(0, 80),
      labels: Array.isArray(result.labels)
        ? Array.from(new Set<string>(result.labels.map((l: any) => String(l).trim()).filter(Boolean))).slice(0, 3)
        : [],
      color: STICKY_COLORS.includes(result.color) ? result.color : 'yellow',
    };
  },

  /** C3 — Tóm tắt hoặc viết lại gọn gàng. */
  async rewrite(note: Pick<StickyNote, 'title' | 'content'>, mode: AIRewriteMode): Promise<string> {
    const text = noteText(note);
    if (!text) return '';
    const instruction = mode === 'summarize'
      ? 'Tóm tắt ghi chú thành 3–5 gạch đầu dòng ngắn ("- "), giữ các con số, tên riêng, thời hạn.'
      : 'Viết lại ghi chú cho rõ ràng, sửa chính tả, sắp xếp thành gạch đầu dòng nếu hợp lý. KHÔNG thêm thông tin mới, KHÔNG bỏ ý.';
    const result = await callJSON<{ text: string }>(
      `sticky_ai_${mode}`,
      `${instruction} Trả lời bằng đúng ngôn ngữ của ghi chú, dạng văn bản thuần (không markdown đậm/tiêu đề).`,
      `Ghi chú:\n"""\n${text}\n"""`,
      { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] },
    );
    return String(result.text || '').trim();
  },
};
