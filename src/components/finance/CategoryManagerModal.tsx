import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Pin, Check, Smile } from 'lucide-react';
import { Lang } from '../../i18n/i18n';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../constants';
import { getCategoryIconInfo, getIconItemById, setCustomCategoryIcon } from '../../utils/categoryIcons';
import CategoryIconPickerModal from './CategoryIconPickerModal';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseCategories: string[];
  incomeCategories: string[];
  pinnedCategories: string[];
  onTogglePin: (categoryName: string) => void;
  onAddCategory: (type: 'expense' | 'income', name: string) => void;
  onEditCategory?: (type: 'expense' | 'income', oldName: string, newName: string) => Promise<void> | void;
  onDeleteCategory: (type: 'expense' | 'income', name: string) => void;
  lang: Lang;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  expenseCategories,
  incomeCategories,
  pinnedCategories,
  onTogglePin,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  lang
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [newCatName, setNewCatName] = useState('');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Icon Picker State
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [pickerTargetCategory, setPickerTargetCategory] = useState<string>('');
  const [selectedNewIconId, setSelectedNewIconId] = useState<string>('');
  const [, setIconUpdateTick] = useState(0);

  useEffect(() => {
    const handleIconsUpdate = () => setIconUpdateTick(t => t + 1);
    window.addEventListener('category_icons_updated', handleIconsUpdate);
    return () => window.removeEventListener('category_icons_updated', handleIconsUpdate);
  }, []);

  if (!isOpen) return null;

  const currentCategories = activeTab === 'expense' ? expenseCategories : incomeCategories;
  const defaultCategories = activeTab === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const filteredCategories = currentCategories.filter(c =>
    c.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const pinnedList = filteredCategories.filter(c => pinnedCategories.includes(c));
  const unpinnedList = filteredCategories.filter(c => !pinnedCategories.includes(c));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (currentCategories.includes(trimmed)) {
      alert('Danh mục này đã tồn tại!');
      return;
    }
    onAddCategory(activeTab, trimmed);
    if (selectedNewIconId) {
      setCustomCategoryIcon(trimmed, selectedNewIconId);
    }
    setNewCatName('');
    setSelectedNewIconId('');
  };

  const startEditing = (cat: string) => {
    setEditingCatName(cat);
    setEditedValue(cat);
  };

  const cancelEditing = () => {
    setEditingCatName(null);
    setEditedValue('');
  };

  const saveEditing = async (oldName: string) => {
    const trimmed = editedValue.trim();
    if (!trimmed || trimmed === oldName) {
      cancelEditing();
      return;
    }
    if (currentCategories.includes(trimmed)) {
      alert('Tên danh mục này đã tồn tại!');
      return;
    }
    if (onEditCategory) {
      await onEditCategory(activeTab, oldName, trimmed);
    }
    cancelEditing();
  };

  const isCustomCategory = (cat: string) => !defaultCategories.includes(cat);

  const handleOpenIconPicker = (catName: string) => {
    setPickerTargetCategory(catName);
    setIsIconPickerOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-3 md:p-6 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col border border-gray-200">
          
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Quản lý danh mục</h2>
              <p className="text-[11px] text-gray-400">Tùy chỉnh tên, ghim và icon cho từng mục</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab Switcher: Chi tiêu / Thu nhập */}
          <div className="p-3 bg-gray-50/60 border-b border-gray-100">
            <div className="bg-gray-200/60 p-0.5 rounded-lg flex text-xs">
              <button
                type="button"
                onClick={() => { setActiveTab('expense'); cancelEditing(); }}
                className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'expense'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Chi tiêu ({expenseCategories.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('income'); cancelEditing(); }}
                className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'income'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Thu nhập ({incomeCategories.length})
              </button>
            </div>
          </div>

          {/* Add New Category Form with Icon Picker trigger */}
          <form onSubmit={handleCreate} className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenIconPicker(newCatName.trim() || 'Mục mới')}
              className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-sky-50 border border-gray-200 hover:border-sky-300 flex items-center justify-center transition-all shrink-0 text-gray-600 hover:text-sky-600"
              title="Chọn icon cho mục mới"
            >
              {selectedNewIconId ? (
                (() => {
                  const item = getIconItemById(selectedNewIconId);
                  const IconComp = item ? item.icon : Plus;
                  return <IconComp size={16} className="text-sky-600" />;
                })()
              ) : (
                <Smile size={16} className="text-gray-400" />
              )}
            </button>
            <input
              type="text"
              placeholder={`Thêm mục ${activeTab === 'expense' ? 'chi tiêu' : 'thu nhập'}...`}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-sky-300"
            />
            <button
              type="submit"
              disabled={!newCatName.trim()}
              className="px-3.5 py-1.5 bg-gray-800 text-white text-xs font-semibold rounded-lg hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              Thêm
            </button>
          </form>

          {/* Search input if categories > 6 */}
          {currentCategories.length > 6 && (
            <div className="px-4 pt-2 pb-1">
              <input
                type="text"
                placeholder="Tìm kiếm danh mục..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 outline-none focus:bg-white"
              />
            </div>
          )}

          {/* Categories List Body */}
          <div className="overflow-y-auto px-4 py-2 flex-1 space-y-3 custom-scrollbar text-xs">

            {/* Section 1: Pinned Categories */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Đã ghim ({pinnedList.length})
                </span>
              </div>

              {pinnedList.length === 0 ? (
                <div className="p-2.5 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                  Chưa có danh mục nào được ghim.
                </div>
              ) : (
                <div className="space-y-1">
                  {pinnedList.map((cat) => renderCategoryRow(cat, true))}
                </div>
              )}
            </div>

            {/* Section 2: Other Categories */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Khác ({unpinnedList.length})
                </span>
              </div>

              {unpinnedList.length === 0 && pinnedList.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">
                  Không tìm thấy danh mục nào.
                </div>
              ) : (
                <div className="space-y-1">
                  {unpinnedList.map((cat) => renderCategoryRow(cat, false))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-800 text-white font-semibold text-xs rounded-lg hover:bg-black transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Kho Icon Picker Modal */}
      <CategoryIconPickerModal
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        categoryName={pickerTargetCategory}
        currentIconId={getCategoryIconInfo(pickerTargetCategory).iconId}
        onIconSelected={(iconId) => {
          if (pickerTargetCategory === (newCatName.trim() || 'Mục mới')) {
            setSelectedNewIconId(iconId);
          }
        }}
      />
    </>
  );

  function renderCategoryRow(cat: string, isPinned: boolean) {
    const isCustom = isCustomCategory(cat);
    const isEditing = editingCatName === cat;
    const { icon: CatIcon, colorClass, bgClass } = getCategoryIconInfo(cat);

    if (isEditing) {
      return (
        <div
          key={cat}
          className="p-1.5 rounded-lg bg-sky-50 border border-sky-200 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            className="flex-1 px-2.5 py-1 bg-white border border-sky-300 rounded-md text-xs font-medium text-gray-800 outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={() => saveEditing(cat)}
            className="p-1 bg-sky-600 text-white rounded hover:bg-sky-700 transition-colors"
            title="Lưu"
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
            title="Hủy"
          >
            <X size={13} />
          </button>
        </div>
      );
    }

    return (
      <div
        key={cat}
        className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
          isPinned
            ? 'bg-amber-50/30 border-amber-200/60'
            : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onTogglePin(cat)}
            className={`p-1 rounded transition-colors ${
              isPinned
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-gray-300 hover:text-gray-500'
            }`}
            title={isPinned ? 'Bỏ ghim' : 'Ghim'}
          >
            <Pin size={13} className={isPinned ? 'fill-amber-500' : ''} />
          </button>

          {/* Interactive Category Icon Button */}
          <button
            type="button"
            onClick={() => handleOpenIconPicker(cat)}
            className={`w-7 h-7 rounded-lg ${bgClass} hover:ring-2 hover:ring-sky-200 flex items-center justify-center transition-all group shrink-0`}
            title="Bấm để đổi icon từ Kho Icon"
          >
            <CatIcon size={14} className={`${colorClass} group-hover:scale-110 transition-transform`} />
          </button>

          <span className="text-xs font-semibold text-gray-700 truncate">{cat}</span>

          {isCustom && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 font-semibold shrink-0">
              Tùy chỉnh
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Change Icon Action Button */}
          <button
            type="button"
            onClick={() => handleOpenIconPicker(cat)}
            className="p-1 text-gray-400 hover:text-sky-600 rounded transition-colors"
            title="Đổi icon"
          >
            <Smile size={13} />
          </button>

          {isCustom ? (
            <>
              <button
                type="button"
                onClick={() => startEditing(cat)}
                className="p-1 text-gray-400 hover:text-sky-600 rounded transition-colors"
                title="Đổi tên"
              >
                <Edit2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => onDeleteCategory(activeTab, cat)}
                className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors"
                title="Xóa"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <span className="text-[10px] text-gray-300 px-1">Mặc định</span>
          )}
        </div>
      </div>
    );
  }
};

export default CategoryManagerModal;
