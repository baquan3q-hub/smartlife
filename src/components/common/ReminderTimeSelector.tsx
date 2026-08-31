import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ReminderTimeSelectorProps {
  value: number; // Thời gian nhắc trước tính bằng phút
  onChange: (minutes: number) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

// 5 Mốc phổ biến (Không icon, chữ to rõ ràng)
const QUICK_PRESETS = [
  { value: 0, label: 'Đúng giờ' },
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '1 giờ' },
  { value: 1440, label: '1 ngày' },
];

// Các mốc mở rộng
const EXTENDED_PRESETS = [
  { value: 5, label: '5 phút' },
  { value: 10, label: '10 phút' },
  { value: 45, label: '45 phút' },
  { value: 120, label: '2 giờ' },
  { value: 180, label: '3 giờ' },
  { value: 360, label: '6 giờ' },
  { value: 720, label: '12 giờ' },
  { value: 2880, label: '2 ngày' },
  { value: 4320, label: '3 ngày' },
  { value: 10080, label: '7 ngày' },
];

export const ReminderTimeSelector: React.FC<ReminderTimeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  label = 'Thời gian thông báo',
}) => {
  const isQuick = QUICK_PRESETS.some((p) => p.value === value);
  const isExtended = EXTENDED_PRESETS.some((p) => p.value === value);
  const isPreset = isQuick || isExtended;

  const [isExpanded, setIsExpanded] = useState<boolean>(!isQuick && (isExtended || value > 0));

  // Tùy chỉnh (Custom)
  const calculateInitialCustom = (mins: number) => {
    if (mins >= 1440 && mins % 1440 === 0) {
      return { amount: mins / 1440, unit: 'days' as const };
    }
    if (mins >= 60 && mins % 60 === 0) {
      return { amount: mins / 60, unit: 'hours' as const };
    }
    return { amount: mins > 0 ? mins : 15, unit: 'minutes' as const };
  };

  const initialCustom = calculateInitialCustom(value);
  const [customAmount, setCustomAmount] = useState<number>(initialCustom.amount);
  const [customUnit, setCustomUnit] = useState<'minutes' | 'hours' | 'days'>(initialCustom.unit);

  useEffect(() => {
    if (!isPreset && value !== undefined) {
      const custom = calculateInitialCustom(value);
      setCustomAmount(custom.amount);
      setCustomUnit(custom.unit);
    }
  }, [value, isPreset]);

  // Format nhãn tóm tắt gọn gàng
  const getSummaryLabel = (mins: number) => {
    if (mins <= 0) return 'Đúng giờ';
    if (mins < 60) return `Trước ${mins} phút`;
    if (mins < 1440) {
      const hrs = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `Trước ${hrs}h ${m}p` : `Trước ${hrs} giờ`;
    }
    const days = Math.floor(mins / 1440);
    const hrs = Math.floor((mins % 1440) / 60);
    return hrs > 0 ? `Trước ${days} ngày ${hrs}h` : `Trước ${days} ngày`;
  };

  const handleCustomApply = (amt: number, unit: 'minutes' | 'hours' | 'days') => {
    const validAmt = Math.max(1, amt);
    setCustomAmount(validAmt);
    let multiplier = 1;
    if (unit === 'hours') multiplier = 60;
    if (unit === 'days') multiplier = 1440;
    onChange(validAmt * multiplier);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header Label + Status */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            {label}
          </label>
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
            {getSummaryLabel(value)}
          </span>
        </div>
      )}

      {/* ── Quick Chips Bar (Không icon, thoáng đãng và rõ ràng) ── */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PRESETS.map((item) => {
          const isSelected = value === item.value && !(!isQuick && isExpanded);
          return (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-xs'
                  : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          );
        })}

        {/* Nút mở rộng Khác */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
            isExpanded || (!isQuick && isPreset) || !isPreset
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
              : 'bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
          }`}
        >
          <span>Khác</span>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* ── Bảng mở rộng (Mốc khác & Tùy chỉnh sạch sẽ) ── */}
      {isExpanded && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-150">
          {/* Nhóm mốc mở rộng */}
          <div>
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
              Chọn mốc khác:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXTENDED_PRESETS.map((ext) => {
                const isSelected = value === ext.value;
                return (
                  <button
                    key={ext.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(ext.value)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {ext.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tùy chỉnh số lượng & Đơn vị */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
              Tùy chỉnh:
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, customAmount - 1);
                    handleCustomApply(next, customUnit);
                  }}
                  className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    handleCustomApply(val, customUnit);
                  }}
                  className="w-12 text-center text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = customAmount + 1;
                    handleCustomApply(next, customUnit);
                  }}
                  className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Segmented Unit Pill Switcher */}
              <div className="flex-1 flex p-0.5 bg-slate-200/80 dark:bg-slate-700/80 rounded-lg">
                {(
                  [
                    { id: 'minutes', label: 'Phút' },
                    { id: 'hours', label: 'Giờ' },
                    { id: 'days', label: 'Ngày' },
                  ] as const
                ).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setCustomUnit(u.id);
                      handleCustomApply(customAmount, u.id);
                    }}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer select-none text-center ${
                      customUnit === u.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
