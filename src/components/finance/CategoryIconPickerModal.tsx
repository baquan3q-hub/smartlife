import React, { useState, useMemo } from 'react';
import { X, Search, RotateCcw, Check } from 'lucide-react';
import {
  CATEGORY_ICON_LIBRARY,
  CATEGORY_ICON_GROUPS,
  removeCustomCategoryIcon,
  setCustomCategoryIcon
} from '../../utils/categoryIcons';

interface CategoryIconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  currentIconId?: string;
  onIconSelected?: (iconId: string) => void;
}

export const CategoryIconPickerModal: React.FC<CategoryIconPickerModalProps> = ({
  isOpen,
  onClose,
  categoryName,
  currentIconId,
  onIconSelected
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredIcons = useMemo(() => {
    let list = CATEGORY_ICON_LIBRARY;

    if (selectedGroup !== 'all') {
      list = list.filter(item => item.group === selectedGroup);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.keywords.some(k => k.toLowerCase().includes(q))
      );
    }

    return list;
  }, [selectedGroup, searchQuery]);

  if (!isOpen) return null;

  const handlePickIcon = (iconId: string) => {
    setCustomCategoryIcon(categoryName, iconId);
    if (onIconSelected) {
      onIconSelected(iconId);
    }
    onClose();
  };

  const handleResetDefault = () => {
    removeCustomCategoryIcon(categoryName);
    if (onIconSelected) {
      onIconSelected('');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-3 md:p-6 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-sm md:text-base font-bold text-gray-800 flex items-center gap-2">
              <span>Kho Icon Danh Mục</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-200">
                Miễn phí & Tùy chỉnh
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Chọn icon đại diện cho mục: <span className="font-bold text-sky-700">"{categoryName}"</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Reset Bar */}
        <div className="p-3 bg-gray-50/70 border-b border-gray-100 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm icon (VD: cafe, ăn uống, xe, tiền, shopee, gym...)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-50 transition-all placeholder:text-gray-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600 text-xs"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetDefault}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-[11px] font-semibold text-gray-600 hover:text-rose-600 flex items-center gap-1 transition-colors shrink-0"
              title="Đặt lại icon mặc định theo hệ thống"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Mặc định</span>
            </button>
          </div>

          {/* Group Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
            {CATEGORY_ICON_GROUPS.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroup(g.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors shrink-0 ${
                  selectedGroup === g.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/80'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Icons Grid Content */}
        <div className="overflow-y-auto p-4 flex-1 custom-scrollbar">
          {filteredIcons.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs text-gray-400 font-medium">Không tìm thấy icon nào phù hợp với từ khóa.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedGroup('all'); }}
                className="mt-2 text-xs text-sky-600 hover:underline font-semibold"
              >
                Xem tất cả icon
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
              {filteredIcons.map(item => {
                const IconComponent = item.icon;
                const isSelected = currentIconId === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePickIcon(item.id)}
                    className={`group relative p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90 ${
                      isSelected
                        ? 'bg-sky-50 border-sky-400 text-sky-700 shadow-sm ring-2 ring-sky-100'
                        : 'bg-white border-gray-100 hover:border-sky-200 hover:bg-sky-50/40 text-gray-700 hover:text-sky-600 hover:shadow-xs'
                    }`}
                    title={`${item.name} (${item.groupLabel})`}
                  >
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-sky-600 text-white flex items-center justify-center">
                        <Check size={9} className="stroke-[3]" />
                      </div>
                    )}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110">
                      <IconComponent size={20} />
                    </div>
                    <span className="text-[10px] font-semibold text-center truncate w-full group-hover:text-sky-600">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-gray-400">
            Hiển thị {filteredIcons.length} icons miễn phí
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryIconPickerModal;
