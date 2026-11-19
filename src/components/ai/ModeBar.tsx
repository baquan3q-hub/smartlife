// File: src/components/ai/ModeBar.tsx
// Thanh trạng thái dưới ô soạn tin: hai nút gọn (chuyên gia, tốc độ) — bấm mới mở popup ngay tại nút để chọn

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Gauge } from 'lucide-react';
import { GlassIcon } from '../icons/GlassIcon';
import { EXPERT_LIST, type ExpertId } from '../../services/ai/experts';
import { SPEED_OPTIONS, type SpeedChoice } from './tiers';

interface ModeBarProps {
    speed: SpeedChoice;
    onSpeedChange: (speed: SpeedChoice) => void;
    expert: ExpertId;
    onExpertChange: (expert: ExpertId) => void;
    disabled?: boolean;
}

type MenuId = 'expert' | 'speed';

interface PickerItem {
    id: string;
    label: string;
    hint: string;
    icon?: React.ReactNode;
    badge?: string;
}

interface PickerProps {
    menu: MenuId;
    open: boolean;
    onToggle: (menu: MenuId) => void;
    onClose: () => void;
    title: string;
    ariaLabel: string;
    items: PickerItem[];
    value: string;
    onSelect: (id: string) => void;
    trigger: React.ReactNode;
    menuWidth: number;
    disabled?: boolean;
}

/** Nút + popup mở lên trên ngay tại nút; tự dịch sang trái nếu tràn màn hình */
const Picker: React.FC<PickerProps> = ({ menu, open, onToggle, onClose, title, ariaLabel, items, value, onSelect, trigger, menuWidth, disabled }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [offsetX, setOffsetX] = useState(0);

    // Đo trước khi vẽ: dịch popup để luôn nằm trọn trong màn hình (điện thoại)
    useLayoutEffect(() => {
        if (!open || !buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        // clientWidth thay vì innerWidth: popup vừa vẽ có thể làm trang tràn ngang, innerWidth sẽ bị nới theo
        const viewport = document.documentElement.clientWidth;
        const margin = 8;
        const width = Math.min(menuWidth, viewport - margin * 2);
        const overflowRight = rect.left + width - (viewport - margin);
        setOffsetX(overflowRight > 0 ? -Math.min(overflowRight, rect.left - margin) : 0);
    }, [open, menuWidth]);

    // Mở ra thì đưa focus vào mục đang chọn
    useEffect(() => {
        if (!open) return;
        const idx = Math.max(0, items.findIndex(i => i.id === value));
        itemRefs.current[idx]?.focus();
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Bấm ra ngoài thì đóng
    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [open, onClose]);

    const closeAndFocus = () => {
        onClose();
        buttonRef.current?.focus();
    };

    const onMenuKeyDown = (e: React.KeyboardEvent) => {
        const current = itemRefs.current.findIndex(el => el === document.activeElement);
        if (e.key === 'Escape') {
            e.preventDefault();
            closeAndFocus();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            const next = (current + step + items.length) % items.length;
            itemRefs.current[next]?.focus();
        } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            itemRefs.current[e.key === 'Home' ? 0 : items.length - 1]?.focus();
        } else if (e.key === 'Tab') {
            onClose();
        }
    };

    return (
        <div ref={wrapRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={ariaLabel}
                onClick={() => onToggle(menu)}
                onKeyDown={e => {
                    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !open) {
                        e.preventDefault();
                        onToggle(menu);
                    }
                }}
                className={`flex items-center gap-1.5 h-7 pl-1.5 pr-2 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors disabled:opacity-50 ${open
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-400/40 dark:text-indigo-200'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500'
                    }`}
            >
                {trigger}
                <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={title}
                    onKeyDown={onMenuKeyDown}
                    style={{ width: menuWidth, left: offsetX }}
                    className={`absolute bottom-full mb-2 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-gray-150 p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 dark:bg-slate-800 dark:border-slate-700`}
                >
                    <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</div>
                    {items.map((item, i) => {
                        const active = item.id === value;
                        return (
                            <button
                                key={item.id}
                                ref={el => { itemRefs.current[i] = el; }}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                onClick={() => { onSelect(item.id); closeAndFocus(); }}
                                className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${active
                                    ? 'bg-indigo-50 dark:bg-indigo-500/15'
                                    : 'hover:bg-gray-50 focus:bg-gray-50 dark:hover:bg-slate-700/60 dark:focus:bg-slate-700/60'
                                    }`}
                            >
                                {item.icon && <span className="shrink-0 mt-0.5">{item.icon}</span>}
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-1.5">
                                        <span className={`text-xs font-semibold ${active ? 'text-indigo-700 dark:text-indigo-200' : 'text-gray-800 dark:text-slate-100'}`}>{item.label}</span>
                                        {item.badge && (
                                            <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300">
                                                {item.badge}
                                            </span>
                                        )}
                                    </span>
                                    <span className="block text-[11px] leading-snug text-gray-500 dark:text-slate-400 mt-0.5">{item.hint}</span>
                                </span>
                                {active && <Check size={14} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-300" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ModeBar: React.FC<ModeBarProps> = ({ speed, onSpeedChange, expert, onExpertChange, disabled }) => {
    const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
    const current = EXPERT_LIST.find(e => e.id === expert) || EXPERT_LIST[0];
    const currentSpeed = SPEED_OPTIONS.find(s => s.id === speed) || SPEED_OPTIONS[0];

    const toggle = useCallback((menu: MenuId) => setOpenMenu(m => (m === menu ? null : menu)), []);
    const close = useCallback(() => setOpenMenu(null), []);

    // Đang gửi thì đóng popup
    useEffect(() => { if (disabled) setOpenMenu(null); }, [disabled]);

    return (
        <div className="mt-2 flex items-center gap-1.5">
            <Picker
                menu="expert"
                open={openMenu === 'expert'}
                onToggle={toggle}
                onClose={close}
                title="Chế độ chuyên gia"
                ariaLabel={`Chế độ chuyên gia: ${current.name}`}
                items={EXPERT_LIST.map(e => ({
                    id: e.id,
                    label: e.name,
                    hint: e.tagline,
                    icon: <GlassIcon name={e.icon} size={22} muted={e.id !== expert} />,
                }))}
                value={expert}
                onSelect={id => onExpertChange(id as ExpertId)}
                trigger={<><GlassIcon name={current.icon} size={18} />{current.name}</>}
                menuWidth={288}
                disabled={disabled}
            />
            <Picker
                menu="speed"
                open={openMenu === 'speed'}
                onToggle={toggle}
                onClose={close}
                title="Tốc độ trả lời · số lượt tính"
                ariaLabel={`Tốc độ trả lời: ${currentSpeed.label}, tốn ${currentSpeed.cost} lượt`}
                items={SPEED_OPTIONS.map(s => ({
                    id: s.id,
                    label: s.label,
                    hint: s.hint,
                    badge: `${s.cost} lượt`,
                }))}
                value={speed}
                onSelect={id => onSpeedChange(id as SpeedChoice)}
                trigger={<>
                    <Gauge size={14} className="text-blue-500 dark:text-blue-300 ml-0.5" />
                    {currentSpeed.label}
                    <span className="text-gray-400 dark:text-slate-500 font-medium">·{currentSpeed.cost}</span>
                </>}
                menuWidth={272}
                disabled={disabled}
            />
            <p className="ml-auto text-[9px] text-gray-400 dark:text-slate-500 text-right truncate hidden sm:block">
                Tệp tối đa 30MB/file
            </p>
        </div>
    );
};

export default ModeBar;
