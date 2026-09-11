import React from 'react';
import {
  Utensils, Coffee, Pizza, Wine, Beer, Apple, CupSoda, Cake, Soup, Sandwich,
  Car, Plane, Fuel, Bus, Bike, Train, Ship, MapPin, Compass,
  Home, Zap, Droplets, Wifi, Phone, Tv, Flame, ShieldCheck, Key,
  ShoppingBag, ShoppingCart, Shirt, Watch, Tag, Package, Glasses,
  Gamepad2, Film, Music, Camera, Headphones, Heart, Sparkles, PartyPopper, Palette,
  HeartPulse, Activity, Dumbbell, Pill, Stethoscope, Smile, Footprints,
  GraduationCap, BookOpen, Briefcase, Laptop, PenTool, FileText, Award, Building,
  Wallet, CreditCard, Coins, DollarSign, TrendingUp, TrendingDown, Landmark, PiggyBank, HandCoins, Receipt, Gift,
  MoreHorizontal, Bookmark, Star, Boxes, LucideIcon
} from 'lucide-react';

export interface CategoryIconItem {
  id: string;
  name: string;
  group: 'food' | 'transport' | 'living' | 'shopping' | 'entertainment' | 'health' | 'education' | 'finance' | 'other';
  groupLabel: string;
  icon: LucideIcon;
  keywords: string[];
}

export const CATEGORY_ICON_GROUPS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'food', label: 'Ẩm thực' },
  { id: 'transport', label: 'Di chuyển' },
  { id: 'living', label: 'Sinh hoạt' },
  { id: 'shopping', label: 'Mua sắm' },
  { id: 'entertainment', label: 'Giải trí' },
  { id: 'health', label: 'Sức khỏe' },
  { id: 'education', label: 'Công việc/Học' },
  { id: 'finance', label: 'Tài chính' },
  { id: 'other', label: 'Khác' }
] as const;

export const CATEGORY_ICON_LIBRARY: CategoryIconItem[] = [
  // Ẩm thực & Đồ uống
  { id: 'utensils', name: 'Ăn uống', group: 'food', groupLabel: 'Ẩm thực', icon: Utensils, keywords: ['an uong', 'com', 'food', 'nha hang', 'mon an', 'am thuc'] },
  { id: 'coffee', name: 'Cà phê', group: 'food', groupLabel: 'Ẩm thực', icon: Coffee, keywords: ['ca phe', 'coffee', 'cafe', 'tra sua', 'uong'] },
  { id: 'pizza', name: 'Đồ ăn nhanh', group: 'food', groupLabel: 'Ẩm thực', icon: Pizza, keywords: ['pizza', 'fastfood', 'do an vat', 'snack'] },
  { id: 'soup', name: 'Bún phở', group: 'food', groupLabel: 'Ẩm thực', icon: Soup, keywords: ['pho', 'bun', 'soup', 'mi', 'canh'] },
  { id: 'sandwich', name: 'Bánh mì', group: 'food', groupLabel: 'Ẩm thực', icon: Sandwich, keywords: ['banh mi', 'sandwich', 'an sang'] },
  { id: 'cake', name: 'Bánh ngọt', group: 'food', groupLabel: 'Ẩm thực', icon: Cake, keywords: ['banh ngot', 'sinh nhat', 'cake', 'dessert'] },
  { id: 'cup-soda', name: 'Nước giải khát', group: 'food', groupLabel: 'Ẩm thực', icon: CupSoda, keywords: ['nuoc ngot', 'tra', 'soda', 'sinh to'] },
  { id: 'wine', name: 'Rượu vang', group: 'food', groupLabel: 'Ẩm thực', icon: Wine, keywords: ['ruou', 'wine', 'tiec', 'party'] },
  { id: 'beer', name: 'Bia & Nhậu', group: 'food', groupLabel: 'Ẩm thực', icon: Beer, keywords: ['bia', 'beer', 'nhau', 'quan'] },
  { id: 'apple', name: 'Trái cây', group: 'food', groupLabel: 'Ẩm thực', icon: Apple, keywords: ['trai cay', 'hoa qua', 'dinh duong', 'rau cu'] },

  // Di chuyển & Du lịch
  { id: 'car', name: 'Xe ô tô', group: 'transport', groupLabel: 'Di chuyển', icon: Car, keywords: ['di chuyen', 'oto', 'xe hoi', 'grab', 'taxi', 'xe co'] },
  { id: 'fuel', name: 'Xăng dầu', group: 'transport', groupLabel: 'Di chuyển', icon: Fuel, keywords: ['xang', 'dau', 'do xang', 'nhien lieu'] },
  { id: 'bike', name: 'Xe máy/Xe đạp', group: 'transport', groupLabel: 'Di chuyển', icon: Bike, keywords: ['xe may', 'xe dap', 'gui xe', 'xe'] },
  { id: 'bus', name: 'Xe buýt/Xe khách', group: 'transport', groupLabel: 'Di chuyển', icon: Bus, keywords: ['xe buyt', 'xe khach', 'bus'] },
  { id: 'train', name: 'Tàu hỏa', group: 'transport', groupLabel: 'Di chuyển', icon: Train, keywords: ['tau hoa', 'metro', 'tau dien'] },
  { id: 'plane', name: 'Máy bay/Du lịch', group: 'transport', groupLabel: 'Di chuyển', icon: Plane, keywords: ['du lich', 'may bay', 'travel', 'bay', 've'] },
  { id: 'ship', name: 'Tàu thủy', group: 'transport', groupLabel: 'Di chuyển', icon: Ship, keywords: ['tau', 'thuyen', 'dao'] },
  { id: 'map-pin', name: 'Địa điểm/Bản đồ', group: 'transport', groupLabel: 'Di chuyển', icon: MapPin, keywords: ['dia diem', 'khach san', 'checkin'] },
  { id: 'compass', name: 'Khám phá', group: 'transport', groupLabel: 'Di chuyển', icon: Compass, keywords: ['kham pha', 'phuot', 'du lich'] },

  // Sinh hoạt & Nhà cửa
  { id: 'home', name: 'Nhà cửa', group: 'living', groupLabel: 'Sinh hoạt', icon: Home, keywords: ['nha cua', 'tien nha', 'tien phong', 'thue nha', 'home'] },
  { id: 'droplets', name: 'Nước sinh hoạt', group: 'living', groupLabel: 'Sinh hoạt', icon: Droplets, keywords: ['dien nuoc', 'tien nuoc', 'nuoc'] },
  { id: 'zap', name: 'Điện lực', group: 'living', groupLabel: 'Sinh hoạt', icon: Zap, keywords: ['tien dien', 'dien', 'nang luong'] },
  { id: 'wifi', name: 'Tiền mạng', group: 'living', groupLabel: 'Sinh hoạt', icon: Wifi, keywords: ['tien mang', 'internet', 'wifi', '4g', 'viettel', 'fpt', 'vnpt'] },
  { id: 'phone', name: 'Điện thoại', group: 'living', groupLabel: 'Sinh hoạt', icon: Phone, keywords: ['dien thoai', 'nap the', 'cuoc phi'] },
  { id: 'flame', name: 'Gas / Đun nấu', group: 'living', groupLabel: 'Sinh hoạt', icon: Flame, keywords: ['gas', 'bep', 'nau an'] },
  { id: 'tv', name: 'Truyền hình', group: 'living', groupLabel: 'Sinh hoạt', icon: Tv, keywords: ['tivi', 'truyen hinh', 'cap'] },
  { id: 'shield-check', name: 'Bảo hiểm/An ninh', group: 'living', groupLabel: 'Sinh hoạt', icon: ShieldCheck, keywords: ['bao hiem', 'an ninh', 'bao tri'] },
  { id: 'key', name: 'Dịch vụ nhà', group: 'living', groupLabel: 'Sinh hoạt', icon: Key, keywords: ['khoa', 'phi dich vu', 'chung cu'] },

  // Mua sắm & Tiêu dùng
  { id: 'shopping-bag', name: 'Mua sắm', group: 'shopping', groupLabel: 'Mua sắm', icon: ShoppingBag, keywords: ['mua sam', 'shopping', 'shopee', 'lazada', 'tiki', 'tiktok shop'] },
  { id: 'shopping-cart', name: 'Siêu thị/Chợ', group: 'shopping', groupLabel: 'Mua sắm', icon: ShoppingCart, keywords: ['sieu thi', 'di cho', 'cart', 'tap hoa'] },
  { id: 'shirt', name: 'Quần áo', group: 'shopping', groupLabel: 'Mua sắm', icon: Shirt, keywords: ['quan ao', 'thoi trang', 'vay', 'ao', 'quan'] },
  { id: 'watch', name: 'Phụ kiện', group: 'shopping', groupLabel: 'Mua sắm', icon: Watch, keywords: ['dong ho', 'trang suc', 'phu kien'] },
  { id: 'glasses', name: 'Kính mắt/Mỹ phẩm', group: 'shopping', groupLabel: 'Mua sắm', icon: Glasses, keywords: ['kinh mat', 'my pham', 'son phan'] },
  { id: 'package', name: 'Giao hàng/Bưu kiện', group: 'shopping', groupLabel: 'Mua sắm', icon: Package, keywords: ['ship', 'hang hoa', 'dong goi'] },
  { id: 'tag', name: 'Săn sale/Giảm giá', group: 'shopping', groupLabel: 'Mua sắm', icon: Tag, keywords: ['giam gia', 'khuyen mai', 'sale'] },

  // Giải trí & Đời sống
  { id: 'gamepad', name: 'Giải trí & Game', group: 'entertainment', groupLabel: 'Giải trí', icon: Gamepad2, keywords: ['giai tri', 'game', 'tro choi', 'ps5'] },
  { id: 'film', name: 'Xem phim', group: 'entertainment', groupLabel: 'Giải trí', icon: Film, keywords: ['phim', 'rap', 'cinema', 'netflix'] },
  { id: 'music', name: 'Âm nhạc/Spotify', group: 'entertainment', groupLabel: 'Giải trí', icon: Music, keywords: ['am nhac', 'spotify', 'karaoke', 'nhac'] },
  { id: 'heart', name: 'Dating/Tình cảm', group: 'entertainment', groupLabel: 'Giải trí', icon: Heart, keywords: ['dating', 'hen ho', 'nguoi yeu', 'crush', 'tinh cam'] },
  { id: 'camera', name: 'Chụp ảnh', group: 'entertainment', groupLabel: 'Giải trí', icon: Camera, keywords: ['chup anh', 'song ao', 'may anh'] },
  { id: 'party-popper', name: 'Tiệc tùng', group: 'entertainment', groupLabel: 'Giải trí', icon: PartyPopper, keywords: ['tiec', 'party', 'su kien'] },
  { id: 'palette', name: 'Nghệ thuật', group: 'entertainment', groupLabel: 'Giải trí', icon: Palette, keywords: ['ve', 'nghe thuat', 'sang tao'] },

  // Sức khỏe & Thể thao
  { id: 'heart-pulse', name: 'Sức khỏe', group: 'health', groupLabel: 'Sức khỏe', icon: HeartPulse, keywords: ['suc khoe', 'y te', 'kham benh'] },
  { id: 'pill', name: 'Thuốc men', group: 'health', groupLabel: 'Sức khỏe', icon: Pill, keywords: ['thuoc', 'hieu thuoc', 'nha thuoc'] },
  { id: 'dumbbell', name: 'Gym & Thể thao', group: 'health', groupLabel: 'Sức khỏe', icon: Dumbbell, keywords: ['gym', 'the thao', 'the hinh', 'tap luyen'] },
  { id: 'activity', name: 'Vận động', group: 'health', groupLabel: 'Sức khỏe', icon: Activity, keywords: ['chay bo', 'the duc', 'the luc'] },
  { id: 'smile', name: 'Chăm sóc bản thân', group: 'health', groupLabel: 'Sức khỏe', icon: Smile, keywords: ['spa', 'lam dep', 'massage', 'toc', 'salon'] },
  { id: 'footprints', name: 'Đi bộ', group: 'health', groupLabel: 'Sức khỏe', icon: Footprints, keywords: ['di bo', 'leo nui'] },
  { id: 'stethoscope', name: 'Bác sĩ / Bệnh viện', group: 'health', groupLabel: 'Sức khỏe', icon: Stethoscope, keywords: ['bac si', 'benh vien', 'nha khoa'] },

  // Công việc & Học tập
  { id: 'graduation-cap', name: 'Giáo dục', group: 'education', groupLabel: 'Học tập', icon: GraduationCap, keywords: ['giao duc', 'hoc phi', 'dai hoc', 'truong hoc'] },
  { id: 'book-open', name: 'Sách & Khóa học', group: 'education', groupLabel: 'Học tập', icon: BookOpen, keywords: ['sach', 'khoa hoc', 'hoc', 'tai lieu'] },
  { id: 'briefcase', name: 'Lương & Công việc', group: 'education', groupLabel: 'Công việc', icon: Briefcase, keywords: ['luong', 'cong ty', 'salary', 'work', 'viec lam'] },
  { id: 'laptop', name: 'Thiết bị & Công nghệ', group: 'education', groupLabel: 'Công việc', icon: Laptop, keywords: ['laptop', 'phan mem', 'ai', 'may tinh'] },
  { id: 'pen-tool', name: 'Dụng cụ học tập', group: 'education', groupLabel: 'Học tập', icon: PenTool, keywords: ['but', 'van phong pham'] },
  { id: 'file-text', name: 'Giấy tờ / Hồ sơ', group: 'education', groupLabel: 'Công việc', icon: FileText, keywords: ['giay to', 'hop dong', 'ho so'] },
  { id: 'award', name: 'Khen thưởng', group: 'education', groupLabel: 'Công việc', icon: Award, keywords: ['khen thuong', 'chung chi', 'thanh tich'] },

  // Tài chính & Tiền tệ
  { id: 'wallet', name: 'Ví tiền', group: 'finance', groupLabel: 'Tài chính', icon: Wallet, keywords: ['vi', 'tien', 'thu nhap'] },
  { id: 'credit-card', name: 'Thẻ ngân hàng', group: 'finance', groupLabel: 'Tài chính', icon: CreditCard, keywords: ['the', 'tin dung', 'atm', 'visa', 'mastercard'] },
  { id: 'coins', name: 'Bán hàng/Tiền lẻ', group: 'finance', groupLabel: 'Tài chính', icon: Coins, keywords: ['ban hang', 'doanh thu', 'kinh doanh', 'tien le'] },
  { id: 'sparkles', name: 'Tiền thưởng', group: 'finance', groupLabel: 'Tài chính', icon: Sparkles, keywords: ['thuong', 'bonus', 'hoa hong'] },
  { id: 'trending-up', name: 'Đầu tư sinh lời', group: 'finance', groupLabel: 'Tài chính', icon: TrendingUp, keywords: ['dau tu', 'co phieu', 'crypto', 'vang', 'bat dong san'] },
  { id: 'landmark', name: 'Ngân hàng/Trả nợ', group: 'finance', groupLabel: 'Tài chính', icon: Landmark, keywords: ['tra no', 'ngan hang', 'bank', 'vay', 'lai suat'] },
  { id: 'hand-coins', name: 'Cho vay', group: 'finance', groupLabel: 'Tài chính', icon: HandCoins, keywords: ['cho vay', 'muon tien', 'doi no'] },
  { id: 'piggy-bank', name: 'Tiết kiệm', group: 'finance', groupLabel: 'Tài chính', icon: PiggyBank, keywords: ['tiet kiem', 'heo dat', 'tich luy'] },
  { id: 'gift', name: 'Hiếu hỉ / Quà biếu', group: 'finance', groupLabel: 'Tài chính', icon: Gift, keywords: ['hieu hi', 'cuoi', 'qua tang', 'duoc tang', 'mung', 'li xi'] },
  { id: 'receipt', name: 'Hóa đơn', group: 'finance', groupLabel: 'Tài chính', icon: Receipt, keywords: ['hoa don', 'thue', 'phi'] },

  // Khác
  { id: 'more-horizontal', name: 'Khác', group: 'other', groupLabel: 'Khác', icon: MoreHorizontal, keywords: ['khac', 'chung', 'linh tinh'] },
  { id: 'star', name: 'Đặc biệt', group: 'other', groupLabel: 'Khác', icon: Star, keywords: ['sao', 'uu tien', 'dac biet'] },
  { id: 'bookmark', name: 'Ghi nhớ', group: 'other', groupLabel: 'Khác', icon: Bookmark, keywords: ['danh dau', 'luu tru'] },
  { id: 'boxes', name: 'Tổng hợp', group: 'other', groupLabel: 'Khác', icon: Boxes, keywords: ['khoan chi', 'tong hop'] }
];

const STORAGE_KEY = 'smartlife_custom_category_icons';

/**
 * Lấy danh sách icon tùy chỉnh của người dùng từ localStorage
 */
export const getCustomCategoryIcons = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading custom category icons:', e);
    return {};
  }
};

/**
 * Lưu icon tùy chỉnh cho một danh mục
 */
export const setCustomCategoryIcon = (categoryName: string, iconId: string): void => {
  try {
    const current = getCustomCategoryIcons();
    current[categoryName.trim()] = iconId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('category_icons_updated'));
  } catch (e) {
    console.error('Error saving custom category icon:', e);
  }
};

/**
 * Xóa icon tùy chỉnh cho một danh mục (quay về mặc định)
 */
export const removeCustomCategoryIcon = (categoryName: string): void => {
  try {
    const current = getCustomCategoryIcons();
    delete current[categoryName.trim()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('category_icons_updated'));
  } catch (e) {
    console.error('Error deleting custom category icon:', e);
  }
};

/**
 * Tìm item icon theo ID
 */
export const getIconItemById = (iconId?: string): CategoryIconItem | undefined => {
  if (!iconId) return undefined;
  return CATEGORY_ICON_LIBRARY.find(i => i.id === iconId);
};

/**
 * Lấy icon thông minh cho một danh mục:
 * 1. Kiểm tra nếu người dùng đã tùy chỉnh trong localStorage.
 * 2. Tìm theo từ khóa mặc định.
 * 3. Fallback theo danh mục chung.
 */
export const getCategoryIconInfo = (categoryName: string): {
  icon: LucideIcon;
  iconId: string;
  colorClass: string;
  bgClass: string;
} => {
  const name = (categoryName || '').trim();
  const lower = name.toLowerCase();

  // 1. Kiểm tra tùy chỉnh từ người dùng
  const customMap = getCustomCategoryIcons();
  const customIconId = customMap[name] || customMap[lower];
  if (customIconId) {
    const found = getIconItemById(customIconId);
    if (found) {
      return {
        icon: found.icon,
        iconId: found.id,
        colorClass: getGroupColor(found.group),
        bgClass: getGroupBg(found.group)
      };
    }
  }

  // 2. Tự động tìm kiếm icon phù hợp nhất theo từ khóa
  if (lower.includes('cà phê') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('trà')) {
    return { icon: Coffee, iconId: 'coffee', colorClass: 'text-amber-700', bgClass: 'bg-amber-50' };
  }
  if (lower.includes('ăn') || lower.includes('food') || lower.includes('ẩm thực') || lower.includes('quán')) {
    return { icon: Utensils, iconId: 'utensils', colorClass: 'text-rose-600', bgClass: 'bg-rose-50' };
  }
  if (lower.includes('di chuyển') || lower.includes('xe') || lower.includes('grab') || lower.includes('taxi')) {
    return { icon: Car, iconId: 'car', colorClass: 'text-blue-600', bgClass: 'bg-blue-50' };
  }
  if (lower.includes('xăng')) {
    return { icon: Fuel, iconId: 'fuel', colorClass: 'text-amber-600', bgClass: 'bg-amber-50' };
  }
  if (lower.includes('du lịch') || lower.includes('máy bay') || lower.includes('travel')) {
    return { icon: Plane, iconId: 'plane', colorClass: 'text-sky-600', bgClass: 'bg-sky-50' };
  }
  if (lower.includes('nhà') || lower.includes('thuê')) {
    return { icon: Home, iconId: 'home', colorClass: 'text-orange-600', bgClass: 'bg-orange-50' };
  }
  if (lower.includes('mạng') || lower.includes('internet') || lower.includes('wifi')) {
    return { icon: Wifi, iconId: 'wifi', colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50' };
  }
  if (lower.includes('điện nước') || lower.includes('nước') || lower.includes('điện')) {
    return { icon: Droplets, iconId: 'droplets', colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50' };
  }
  if (lower.includes('mua sắm') || lower.includes('shopping') || lower.includes('shopee')) {
    return { icon: ShoppingBag, iconId: 'shopping-bag', colorClass: 'text-amber-600', bgClass: 'bg-amber-50' };
  }
  if (lower.includes('giải trí') || lower.includes('game') || lower.includes('chơi')) {
    return { icon: Gamepad2, iconId: 'gamepad', colorClass: 'text-violet-600', bgClass: 'bg-violet-50' };
  }
  if (lower.includes('sức khỏe') || lower.includes('thuốc') || lower.includes('bệnh') || lower.includes('gym')) {
    return { icon: HeartPulse, iconId: 'heart-pulse', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  }
  if (lower.includes('giáo dục') || lower.includes('học') || lower.includes('sách')) {
    return { icon: GraduationCap, iconId: 'graduation-cap', colorClass: 'text-teal-600', bgClass: 'bg-teal-50' };
  }
  if (lower.includes('đầu tư') || lower.includes('cổ phiếu') || lower.includes('crypto')) {
    return { icon: TrendingUp, iconId: 'trending-up', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50' };
  }
  if (lower.includes('trả nợ') || lower.includes('ngân hàng') || lower.includes('bank')) {
    return { icon: Landmark, iconId: 'landmark', colorClass: 'text-red-600', bgClass: 'bg-red-50' };
  }
  if (lower.includes('cho vay') || lower.includes('mượn')) {
    return { icon: HandCoins, iconId: 'hand-coins', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  }
  if (lower.includes('hiếu hỉ') || lower.includes('cưới') || lower.includes('quà') || lower.includes('tặng')) {
    return { icon: Gift, iconId: 'gift', colorClass: 'text-pink-600', bgClass: 'bg-pink-50' };
  }
  if (lower.includes('dating') || lower.includes('hẹn hò') || lower.includes('yêu')) {
    return { icon: Heart, iconId: 'heart', colorClass: 'text-rose-500', bgClass: 'bg-rose-50' };
  }
  if (lower.includes('lương') || lower.includes('salary') || lower.includes('công việc')) {
    return { icon: Briefcase, iconId: 'briefcase', colorClass: 'text-blue-600', bgClass: 'bg-blue-50' };
  }
  if (lower.includes('thưởng') || lower.includes('bonus')) {
    return { icon: Sparkles, iconId: 'sparkles', colorClass: 'text-amber-500', bgClass: 'bg-amber-50' };
  }
  if (lower.includes('bán hàng') || lower.includes('kinh doanh')) {
    return { icon: Coins, iconId: 'coins', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  }
  if (lower.includes('tiết kiệm') || lower.includes('heo đất')) {
    return { icon: PiggyBank, iconId: 'piggy-bank', colorClass: 'text-pink-600', bgClass: 'bg-pink-50' };
  }

  // 3. Fallback mặc định
  return { icon: MoreHorizontal, iconId: 'more-horizontal', colorClass: 'text-gray-500', bgClass: 'bg-gray-100' };
};

const getGroupColor = (group: string): string => {
  switch (group) {
    case 'food': return 'text-rose-600';
    case 'transport': return 'text-blue-600';
    case 'living': return 'text-amber-600';
    case 'shopping': return 'text-purple-600';
    case 'entertainment': return 'text-pink-600';
    case 'health': return 'text-emerald-600';
    case 'education': return 'text-teal-600';
    case 'finance': return 'text-indigo-600';
    default: return 'text-gray-600';
  }
};

const getGroupBg = (group: string): string => {
  switch (group) {
    case 'food': return 'bg-rose-50';
    case 'transport': return 'bg-blue-50';
    case 'living': return 'bg-amber-50';
    case 'shopping': return 'bg-purple-50';
    case 'entertainment': return 'bg-pink-50';
    case 'health': return 'bg-emerald-50';
    case 'education': return 'bg-teal-50';
    case 'finance': return 'bg-indigo-50';
    default: return 'bg-gray-100';
  }
};
