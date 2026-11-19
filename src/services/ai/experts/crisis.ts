// File: src/services/ai/experts/crisis.ts
// Đường dây hỗ trợ tại Việt Nam dùng trong giao thức khủng hoảng.
// CHỈ ghi số đã xác minh từ nguồn chính thức. Khi sửa, kiểm tra lại nguồn và cập nhật verifiedAt.

export interface CrisisResource {
    name: string;
    phone: string;
    hours: string;
    note: string;
    source: string;
    verifiedAt: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
    {
        name: 'Cấp cứu y tế',
        phone: '115',
        hours: '24/7, toàn quốc',
        note: 'Gọi ngay khi có nguy hiểm tính mạng trước mắt (đã/đang tự gây thương tích, uống thuốc quá liều…).',
        source: 'Thông tư 22/2014/TT-BTTTT, Điều 13 (số dịch vụ khẩn cấp)',
        verifiedAt: '2026-11-19',
    },
    {
        name: 'Đường dây nóng Ngày Mai (hỗ trợ tâm lý cho người trầm cảm và người thân)',
        phone: '096 306 1414',
        hours: '13h00–20h30, Thứ 4 đến Chủ nhật (giờ có thể thay đổi — xem duongdaynongngaymai.vn)',
        note: 'Dự án cộng đồng phi lợi nhuận, miễn phí, lắng nghe không phán xét.',
        source: 'duongdaynongngaymai.vn',
        verifiedAt: '2026-11-19',
    },
    {
        name: 'Tổng đài Quốc gia Bảo vệ Trẻ em',
        phone: '111',
        hours: '24/7, miễn phí',
        note: 'Cho trẻ em, người dưới 18 tuổi và gia đình: bạo lực, xâm hại, khủng hoảng tâm lý.',
        source: 'tongdai111.vn (Cục Bà mẹ và Trẻ em — Bộ Y tế)',
        verifiedAt: '2026-11-19',
    },
];

// Khối chữ chèn vào prompt — AI chỉ được dùng đúng các số này, không tự thêm số khác
export function crisisResourcesText(): string {
    return CRISIS_RESOURCES
        .map(r => `- **${r.name}: ${r.phone}** — ${r.hours}. ${r.note}`)
        .join('\n');
}
