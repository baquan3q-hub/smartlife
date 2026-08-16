// File: src/services/noteAISummaryService.ts
// Service tạo Tóm tắt Ghi chú Thông minh bằng AI (AI Sum)
// Tự động phân tích, phân nhóm và đồng bộ vào lịch sử "AI Your Own" (ai_conversations / ai_messages)

import { noteArchiveService } from './noteArchiveService';
import { chatHistoryService } from './chatHistoryService';
import { callGeminiRaw, estimateGeminiCost } from './geminiService';
import { supabase } from './supabase';
import { AISummaryRequest, NoteArchive } from '../types';

export interface AISummaryResult {
  success: boolean;
  summaryMarkdown: string;
  conversationId?: string;
  notesCount: number;
  errorMessage?: string;
}

export const noteAISummaryService = {
  // Helper định dạng ngày hiển thị (DD/MM/YYYY)
  _formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  },

  // 1. Thu thập và định dạng ngữ cảnh các ghi chú cho AI
  _buildNotesContext(notes: NoteArchive[]): string {
    return notes
      .slice(0, 50) // Tối đa 50 ghi chú phù hợp nhất để tối ưu token
      .map((note, index) => {
        const labelsStr = note.labels && note.labels.length > 0 ? note.labels.join(', ') : 'Ghi chú chung';
        const dateStr = this._formatDisplayDate(note.note_date);
        return `[GHI CHÚ #${index + 1}]
- Ngày ghi nhận: ${dateStr}
- Nhãn phân loại: ${labelsStr}
- Tiêu đề: ${note.title || 'Không có tiêu đề'}
- Nội dung:
${note.content.trim()}
----------------------------------------`;
      })
      .join('\n\n');
  },

  // 2. Thực hiện tạo tóm tắt AI và đồng bộ vào AI Your Own
  async generateSummary(userId: string, request: AISummaryRequest): Promise<AISummaryResult> {
    if (!userId) {
      return {
        success: false,
        summaryMarkdown: '',
        notesCount: 0,
        errorMessage: 'Người dùng chưa đăng nhập.'
      };
    }

    try {
      // B1: Lấy danh sách ghi chú theo bộ lọc
      const notes = await noteArchiveService.getArchivedNotes(userId, {
        label: request.label,
        startDate: request.startDate,
        endDate: request.endDate,
      });

      if (!notes || notes.length === 0) {
        const labelText = request.label === 'All' ? 'tất cả các nhãn' : `nhãn "${request.label}"`;
        const startFormatted = this._formatDisplayDate(request.startDate);
        const endFormatted = this._formatDisplayDate(request.endDate);
        return {
          success: false,
          summaryMarkdown: '',
          notesCount: 0,
          errorMessage: `Không tìm thấy ghi chú nào thuộc ${labelText} trong khoảng thời gian từ ${startFormatted} đến ${endFormatted}. Hãy lưu thêm ghi chú trước khi tóm tắt nhé!`
        };
      }

      // B2: Xây dựng Prompt tổng hợp tri thức
      const notesContext = this._buildNotesContext(notes);
      const labelDesc = request.label === 'All' ? 'Toàn bộ các nhãn' : `Nhãn chuyên biệt: ${request.label}`;
      const timeRangeStr = `${this._formatDisplayDate(request.startDate)} - ${this._formatDisplayDate(request.endDate)}`;

      const systemPrompt = `Bạn là Trợ lý Cố vấn Tri thức & Quản lý Năng suất Thông minh của SmartLife.
Nhiệm vụ của bạn là đọc kỹ toàn bộ danh sách các mẩu ghi chú, biên bản họp nhanh, ý tưởng, to-do list của người dùng trong một khoảng thời gian được cung cấp, sau đó TỔNG HỢP VÀ TỐM TẮT MỘT CÁCH CHUYÊN NGHIỆP, RÕ RÀNG VÀ CÓ TÍNH HÀNH ĐỘNG CAO.

YÊU CẦU ĐẦU RA (Định dạng Markdown đẹp mắt, trực quan):
1. 📌 **TỔNG QUAN & ĐIỂM NỔI BẬT NHẤT (Key Takeaways)**:
   - Tóm tắt 2-3 câu cốt lõi về những gì người dùng đã ghi chép, trọng tâm chính trong khoảng thời gian này.
2. 💼 **CUỘC HỌP & QUYẾT ĐỊNH QUAN TRỌNG (Meetings & Key Decisions)** (nếu có nội dung liên quan):
   - Các điểm thống nhất, kết luận từ các cuộc trao đổi/họp nhóm.
3. 📋 **DANH SÁCH VIỆC CẦN LÀM & ACTION ITEMS (Next Actions)**:
   - Trích xuất toàn bộ các đầu việc phát sinh, nhiệm vụ còn dang dở dưới dạng checklist (- [ ]) rõ ràng, kèm deadline nếu có.
4. 💡 **Ý TƯỞNG & BÀI HỌC ĐỌNG LẠI (Ideas & Key Learnings)** (nếu có):
   - Những góc nhìn sáng tạo, bài học giá trị hoặc giải pháp được ghi chép lại.
5. ⏰ **CẢNH BÁO / NHẮC NHỞ HẠN CHÓT (Deadlines & Reminders)**:
   - Những mốc thời gian cần lưu ý gấp.

LƯU Ý QUAN TRỌNG:
- Văn phong tự nhiên, súc tích, truyền cảm hứng, ngắn gọn, dùng bullet points rõ ràng.
- Sử dụng các biểu tượng emoji phù hợp.
- Tuyệt đối không bịa đặt thông tin ngoài các ghi chú được cấp.`;

      const userPrompt = `Dưới đây là ${notes.length} mẩu ghi chú của tôi trong giai đoạn [${timeRangeStr}] (Phân loại: ${labelDesc}).
Hãy giúp tôi tổng hợp và tạo bản báo cáo tóm tắt hoàn chỉnh theo cấu trúc chuyên nghiệp:

${notesContext}`;

      const requestBody = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 2048
        }
      };

      // B3: Gọi API Gemini
      const responseData = await callGeminiRaw(requestBody);
      const summaryText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!summaryText) {
        throw new Error('AI không trả về nội dung tóm tắt. Vui lòng thử lại.');
      }

      // Ghi log token tiêu thụ (nếu có)
      if (responseData?.usageMetadata?.totalTokenCount) {
        supabase.from('api_logs').insert([{
          user_id: userId,
          action: 'note_ai_summary',
          tokens_used: responseData.usageMetadata.totalTokenCount,
          prompt_tokens: responseData.usageMetadata.promptTokenCount || 0,
          candidates_tokens: responseData.usageMetadata.candidatesTokenCount || 0,
          estimated_cost_vnd: estimateGeminiCost(
            responseData.usageMetadata.promptTokenCount || 0,
            responseData.usageMetadata.candidatesTokenCount || 0
          ),
          model: 'gemini-2.5-flash'
        }]).then(() => {});
      }

      // B4: Đồng bộ tự động vào "AI Your Own" (ai_conversations & ai_messages)
      let conversationId: string | undefined;
      try {
        const convTitle = `📝 [AI Sum] Ghi chú ${request.label === 'All' ? 'Tổng quan' : request.label} (${timeRangeStr})`;
        const newConv = await chatHistoryService.createConversation(convTitle);
        
        if (newConv && newConv.id) {
          conversationId = newConv.id;
          
          // Thêm tin nhắn của User
          await supabase.from('ai_messages').insert([
            {
              conversation_id: newConv.id,
              role: 'user',
              content: `Tóm tắt ${notes.length} ghi chú thuộc ${labelDesc} trong khoảng thời gian ${timeRangeStr}.`,
              created_at: new Date().toISOString()
            },
            {
              conversation_id: newConv.id,
              role: 'assistant',
              content: summaryText,
              created_at: new Date().toISOString()
            }
          ]);
        }
      } catch (syncErr) {
        console.warn('Lỗi đồng bộ AI conversation history:', syncErr);
        // Không block luồng chính nếu sync AI history bị lỗi mạng
      }

      return {
        success: true,
        summaryMarkdown: summaryText,
        conversationId,
        notesCount: notes.length
      };

    } catch (err: any) {
      console.error('Lỗi khi chạy AI Summary:', err);
      return {
        success: false,
        summaryMarkdown: '',
        notesCount: 0,
        errorMessage: err.message || 'Đã có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại sau.'
      };
    }
  }
};
