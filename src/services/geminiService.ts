import { GoogleGenerativeAI } from '@google/generative-ai';
import { Transaction, TransactionType } from '../types';

// Initialize Gemini API
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const analyzeFinancialData = async (
    currentMonthData: { income: number; expense: number; transactions: Transaction[] },
    lastMonthData?: { income: number; expense: number }
): Promise<string> => {
    if (!API_KEY) {
        return "⚠️ Cấu hình lỗi: Chưa có API Key. Vui lòng thêm VITE_GEMINI_API_KEY vào file .env.";
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

        const prompt = `
        Bạn là một trợ lý tài chính cá nhân thân thiện, thông minh và dí dỏm.
        Hãy phân tích dữ liệu tài chính tháng này của tôi và so sánh với tháng trước (nếu có).

        Dữ liệu tháng này:
        - Thu nhập: ${formatCurrency(currentMonthData.income)}
        - Chi tiêu: ${formatCurrency(currentMonthData.expense)}
        - Giao dịch đáng chú ý: ${JSON.stringify(currentMonthData.transactions
            .filter(t => t.type === TransactionType.EXPENSE && t.category !== 'Điều chỉnh số dư')
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
            .map(t => `${t.category}: ${formatCurrency(t.amount)}`))}

        ${lastMonthData ? `Dữ liệu tháng trước:
        - Thu nhập: ${formatCurrency(lastMonthData.income)}
        - Chi tiêu: ${formatCurrency(lastMonthData.expense)}` : ''}

        Yêu cầu:
        1. Nhận xét tổng quan về tình hình tài chính tháng này (ngắn gọn).
        2. So sánh với tháng trước (tăng/giảm chi tiêu thế nào?).
        3. Chỉ ra 1 điểm cần lưu ý hoặc cải thiện.
        4. Đưa ra 1 lời khuyên hoặc mẹo tiết kiệm cụ thể hài hước hoặc một câu châm ngôn tài chính.

        Hãy dùng emoji, định dạng markdown (bold, list) để dễ đọc. Giữ độ dài dưới 200 từ.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Xin lỗi, hiện tại tôi không thể kết nối với trí tuệ nhân tạo. Vui lòng thử lại sau.";
    }
};

export const analyzeSchedule = async (timetable: any[], todos: any[]) => {
    if (!API_KEY) return "Vui lòng cấu hình API Key để sử dụng tính năng này.";
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use regular gemini-pro or flash
        const prompt = `
        Bạn là một trợ lý quản lý thời gian cực kỳ thông minh và chu đáo (AI Secretary).
        
        Nhiệm vụ: Phân tích lịch trình và danh sách việc cần làm của tôi để sắp xếp tối ưu và tìm thời gian rảnh.

        Dữ liệu Lịch trình (Timetable) hiện tại của tôi:
        ${JSON.stringify(timetable)}

        Danh sách việc cần làm (Todos):
        ${JSON.stringify(todos)}

        Hãy thực hiện các việc sau:
        1. **Kiểm tra xung đột**: Xem có lịch nào bị trùng giờ không?
        2. **Đánh giá cân bằng**: Lịch trình có quá dày không? Có đủ thời gian nghỉ ngơi không?
        3. **Gợi ý tối ưu**: Đề xuất cách sắp xếp lại 1-2 việc nếu thấy chưa hợp lý.
        4. **Tìm thời gian rảnh**: Liệt kê 3 khoảng thời gian rảnh rỗi nhất trong ngày/tuần để tôi có thể dùng cho bản thân hoặc việc phát sinh (Cực kỳ quan trọng).

        Trả lời ngắn gọn, súc tích, dùng emoji vui vẻ. Định dạng Markdown đẹp.
        `;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Schedule Error:", error);
        return "Xin lỗi, trợ lý ảo đang bận. Vui lòng thử lại sau!";
    }
};
console.log("Gemini key:", import.meta.env.VITE_GEMINI_API_KEY?.slice(0,5));
