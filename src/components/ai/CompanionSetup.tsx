// File: src/components/ai/CompanionSetup.tsx
// Trình thiết lập "Bạn đồng hành": 3 bước (nhân vật → cách nói chuyện → thêm chút riêng tư), có xem trước câu chào.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Loader2, ShieldCheck, X } from 'lucide-react';
import CompanionAvatar from './CompanionAvatar';
import {
    AVATARS, DEFAULT_COMPANION, EMOJI_LEVELS, GENDERS, MAX_TRAITS, NAME_MAX, RELATIONSHIPS, REPLY_LENGTHS,
    PRONOUN_LABEL, SELF_PRONOUNS, TEXT_MAX, TRAITS, USER_PRONOUNS,
    canUseTaoMay, defaultPronouns, hasBlockedContent, previewGreeting, sanitizeCompanion,
    type CompanionProfile, type TraitId,
} from '../../services/ai/companion/types';

interface Props {
    initial: CompanionProfile | null;
    /** Tuổi trong hồ sơ (nếu có) — dưới 18 thì khoá kiểu "Người thương" */
    profileAge?: number | null;
    onSave: (profile: CompanionProfile) => Promise<void> | void;
    onClose: () => void;
}

const MIN_TRAITS_UI = 2;
const STEPS = ['Nhân vật', 'Cách nói chuyện', 'Thêm chút riêng'];

const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active
        ? 'bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500'
        : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400'}`;

const Label: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{children}</span>
        {hint && <span className="text-[10px] text-gray-400 dark:text-slate-500">{hint}</span>}
    </div>
);

const CompanionSetup: React.FC<Props> = ({ initial, profileAge, onSave, onClose }) => {
    const [p, setP] = useState<CompanionProfile>(() => initial || DEFAULT_COMPANION);
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    // Người dùng tự sửa xưng hô thì không tự đổi theo giới tính / quan hệ nữa
    const [pronounTouched, setPronounTouched] = useState(!!initial);
    const [adultChecked, setAdultChecked] = useState(!!initial?.adultConfirmedAt);
    const dialogRef = useRef<HTMLDivElement>(null);

    const minor = typeof profileAge === 'number' && profileAge > 0 && profileAge < 18;
    const set = (patch: Partial<CompanionProfile>) => setP(prev => ({ ...prev, ...patch }));

    useEffect(() => {
        if (pronounTouched) return;
        setP(prev => ({ ...prev, ...defaultPronouns(prev.gender, prev.relationship) }));
    }, [p.gender, p.relationship, pronounTouched]);

    // t–m chỉ hợp Bạn thân / Bạn cùng học — đổi sang vai khác thì trả về xưng hô gợi ý
    const taoMay = p.selfPronoun === 't' && p.userPronoun === 'm';
    const tmAllowed = canUseTaoMay(p.relationship);
    useEffect(() => {
        if (taoMay && !tmAllowed) setP(prev => ({ ...prev, ...defaultPronouns(prev.gender, prev.relationship) }));
    }, [taoMay, tmAllowed]);

    /** Chọn xưng hô: t đi kèm m; bỏ một vế t–m thì vế kia về gợi ý */
    const setPronoun = (key: 'selfPronoun' | 'userPronoun', value: string) => {
        setPronounTouched(true);
        setP(prev => {
            const def = defaultPronouns(prev.gender, prev.relationship);
            if (value === 't' || value === 'm') return { ...prev, selfPronoun: 't', userPronoun: 'm' };
            const next = { ...prev, [key]: value };
            if (key === 'selfPronoun' && prev.userPronoun === 'm') next.userPronoun = def.userPronoun === 'm' ? 'bạn' : def.userPronoun;
            if (key === 'userPronoun' && prev.selfPronoun === 't') next.selfPronoun = def.selfPronoun === 't' ? 'mình' : def.selfPronoun;
            return next;
        });
    };
    const toggleTaoMay = () => {
        if (taoMay) {
            setPronounTouched(true);
            setP(prev => ({ ...prev, ...defaultPronouns(prev.gender, prev.relationship) }));
        } else setPronoun('selfPronoun', 't');
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
        document.addEventListener('keydown', onKey);
        dialogRef.current?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, saving]);

    const nameBlocked = hasBlockedContent(p.name);
    const textBlocked = hasBlockedContent(p.interests) || hasBlockedContent(p.backstory);
    const needAdult = p.relationship === 'sweetheart' && !adultChecked;
    const stepError = step === 0
        ? (!p.name.trim() ? 'Đặt tên cho bạn AI nhé' : nameBlocked ? 'Tên này không phù hợp, chọn tên khác nhé' : needAdult ? 'Cần xác nhận đủ 18 tuổi để chọn "Người thương"' : '')
        : step === 1
            ? (p.traits.length < MIN_TRAITS_UI ? `Chọn ít nhất ${MIN_TRAITS_UI} tính cách` : '')
            : (textBlocked ? 'Sở thích / tiểu sử có từ ngữ không phù hợp' : '');

    const preview = useMemo(() => previewGreeting({ ...p, name: p.name.trim() || DEFAULT_COMPANION.name }), [p]);

    const toggleTrait = (id: TraitId) => {
        setP(prev => {
            if (prev.traits.includes(id)) return { ...prev, traits: prev.traits.filter(t => t !== id) };
            if (prev.traits.length >= MAX_TRAITS) return prev;
            return { ...prev, traits: [...prev.traits, id] };
        });
    };

    const submit = async () => {
        if (stepError) return;
        setSaving(true);
        try {
            const adultConfirmedAt = adultChecked && !minor ? (p.adultConfirmedAt || new Date().toISOString()) : null;
            await onSave(sanitizeCompanion({ ...p, adultConfirmedAt }, { profileAge }));
        } finally {
            setSaving(false);
        }
    };

    const input = 'w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:focus:ring-indigo-500/20';

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => !saving && onClose()} />
            <div
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Thiết lập bạn đồng hành"
                className="relative w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 outline-none animate-in fade-in slide-in-from-bottom-4 duration-200"
            >
                {/* Đầu: tiêu đề + bước */}
                <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-slate-800">
                    {step > 0 ? (
                        <button type="button" onClick={() => setStep(s => s - 1)} aria-label="Quay lại" className="p-1 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800">
                            <ChevronLeft size={18} />
                        </button>
                    ) : null}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-black text-gray-800 dark:text-white">{initial ? 'Chỉnh bạn đồng hành' : 'Tạo bạn đồng hành'}</h2>
                        <div className="mt-1 flex items-center gap-1.5">
                            {STEPS.map((label, i) => (
                                <span key={label} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-indigo-500' : i < step ? 'w-3 bg-indigo-300 dark:bg-indigo-400/60' : 'w-3 bg-gray-200 dark:bg-slate-700'}`} />
                            ))}
                            <span className="ml-1 text-[10px] font-semibold text-gray-400 dark:text-slate-500">{step + 1}/{STEPS.length} · {STEPS[step]}</span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                        <X size={18} />
                    </button>
                </div>

                {/* Xem trước câu chào */}
                <div className="px-5 pt-4">
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100 dark:from-indigo-500/10 dark:to-sky-500/10 dark:border-indigo-400/20">
                        <CompanionAvatar avatar={p.avatar} size={36} online />
                        <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{p.name.trim() || DEFAULT_COMPANION.name}</p>
                            {preview.split('\n\n').map((line, i) => (
                                <p key={i} className="inline-block mr-1 px-3 py-1.5 rounded-2xl rounded-tl-md bg-white text-[13px] text-gray-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">{line}</p>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Nội dung từng bước */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {step === 0 && (
                        <>
                            <div>
                                <Label hint={`${p.name.length}/${NAME_MAX}`}>Tên</Label>
                                <input
                                    value={p.name}
                                    maxLength={NAME_MAX}
                                    onChange={e => set({ name: e.target.value })}
                                    placeholder="VD: Mây, Bơ, Sóc…"
                                    className={input}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <Label>Ảnh đại diện</Label>
                                <div className="flex flex-wrap gap-2">
                                    {AVATARS.map(a => (
                                        <button
                                            key={a.id}
                                            type="button"
                                            aria-label={`Ảnh ${a.emoji}`}
                                            aria-pressed={p.avatar === a.id}
                                            onClick={() => set({ avatar: a.id })}
                                            className={`rounded-full p-0.5 transition-all ${p.avatar === a.id ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'}`}
                                        >
                                            <CompanionAvatar avatar={a.id} size={36} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label>Giới tính</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {GENDERS.map(g => (
                                        <button key={g.id} type="button" aria-pressed={p.gender === g.id} onClick={() => set({ gender: g.id })} className={chip(p.gender === g.id)}>{g.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label>Bạn AI là gì của bạn?</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {RELATIONSHIPS.map(r => {
                                        const locked = r.adultOnly && minor;
                                        const active = p.relationship === r.id;
                                        return (
                                            <button
                                                key={r.id}
                                                type="button"
                                                disabled={locked}
                                                aria-pressed={active}
                                                onClick={() => set({ relationship: r.id })}
                                                className={`text-left px-3 py-2 rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active
                                                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 dark:border-indigo-400/60'
                                                    : 'border-gray-200 hover:border-indigo-200 dark:border-slate-700 dark:hover:border-slate-500'}`}
                                            >
                                                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-slate-100">
                                                    {r.label}
                                                    {r.adultOnly && <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">18+</span>}
                                                    {active && <Check size={12} className="ml-auto text-indigo-600 dark:text-indigo-300" />}
                                                </span>
                                                <span className="block mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-slate-400">{locked ? 'Chỉ dành cho người từ 18 tuổi' : r.hint}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {p.relationship === 'sweetheart' && (
                                    <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-400/20">
                                        <label className="flex items-start gap-2 text-xs text-rose-900 dark:text-rose-200 cursor-pointer">
                                            <input type="checkbox" checked={adultChecked} onChange={e => setAdultChecked(e.target.checked)} className="mt-0.5 accent-rose-500" />
                                            <span><strong>Mình xác nhận đã đủ 18 tuổi.</strong></span>
                                        </label>
                                        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-rose-700/80 dark:text-rose-300/80">
                                            <ShieldCheck size={12} className="shrink-0 mt-px" />
                                            Người thương sẽ ấm áp, quan tâm — nhưng không bao giờ có nội dung tình dục, và luôn nói thật mình là AI.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>{p.name || 'Bạn AI'} xưng</Label>
                                    <select value={p.selfPronoun} onChange={e => setPronoun('selfPronoun', e.target.value)} className={input}>
                                        {SELF_PRONOUNS.map(x => <option key={x} value={x} disabled={x === 't' && !tmAllowed}>{PRONOUN_LABEL[x] || x}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label>Gọi bạn là</Label>
                                    <select value={p.userPronoun} onChange={e => setPronoun('userPronoun', e.target.value)} className={input}>
                                        {USER_PRONOUNS.map(x => <option key={x} value={x} disabled={x === 'm' && !tmAllowed}>{PRONOUN_LABEL[x] || x}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="-mt-1 flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    aria-pressed={taoMay}
                                    disabled={!tmAllowed}
                                    onClick={toggleTaoMay}
                                    className={`${chip(taoMay)} disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    {taoMay && <Check size={12} className="inline -mt-px mr-1" />}Xưng t–m
                                </button>
                                <span className="text-[11px] leading-snug text-gray-500 dark:text-slate-400">
                                    {tmAllowed ? 'Thân kiểu bạn chí cốt. Đổi được ngay trong lúc chat.' : 'Chỉ dùng với Bạn thân hoặc Bạn cùng học.'}
                                </span>
                            </div>
                            <div>
                                <Label hint={`${p.traits.length}/${MAX_TRAITS} · chọn ${MIN_TRAITS_UI}–${MAX_TRAITS}`}>Tính cách</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {TRAITS.map(t => {
                                        const on = p.traits.includes(t.id);
                                        const full = !on && p.traits.length >= MAX_TRAITS;
                                        return (
                                            <button key={t.id} type="button" title={t.howTo} aria-pressed={on} disabled={full} onClick={() => toggleTrait(t.id)} className={`${chip(on)} disabled:opacity-40`}>
                                                {t.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <Label>Độ dài tin nhắn</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {REPLY_LENGTHS.map(l => (
                                        <button key={l.id} type="button" aria-pressed={p.length === l.id} onClick={() => set({ length: l.id })} className={chip(p.length === l.id)}>
                                            {l.label} <span className="font-normal opacity-70">· {l.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label>Emoji</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {EMOJI_LEVELS.map(e => (
                                        <button key={e.id} type="button" aria-pressed={p.emoji === e.id} onClick={() => set({ emoji: e.id })} className={chip(p.emoji === e.id)}>{e.label}</button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div>
                                <Label hint={`${p.interests.length}/${TEXT_MAX} · không bắt buộc`}>Sở thích của {p.name || 'bạn AI'}</Label>
                                <input value={p.interests} maxLength={TEXT_MAX} onChange={e => set({ interests: e.target.value })} placeholder="VD: nghe lo-fi, mê mèo, thích trà sữa" className={input} />
                            </div>
                            <div>
                                <Label hint={`${p.backstory.length}/${TEXT_MAX} · không bắt buộc`}>Tiểu sử ngắn</Label>
                                <textarea value={p.backstory} maxLength={TEXT_MAX} rows={3} onChange={e => set({ backstory: e.target.value })} placeholder="VD: sinh viên năm 3 ngành thiết kế, hay thức khuya vẽ vời" className={`${input} resize-none`} />
                            </div>
                            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer">
                                <input type="checkbox" checked={p.greetingEnabled} onChange={e => set({ greetingEnabled: e.target.checked })} className="mt-0.5 accent-indigo-600" />
                                <span>
                                    <span className="block text-xs font-bold text-gray-800 dark:text-slate-100">Cho {p.name || 'bạn AI'} nhắn trước</span>
                                    <span className="block text-[11px] leading-snug text-gray-500 dark:text-slate-400 mt-0.5">Mỗi ngày một lời hỏi thăm khi bạn mở trang AI (không gửi thông báo hay email, không tốn lượt).</span>
                                </span>
                            </label>
                            <p className="text-[11px] leading-snug text-gray-400 dark:text-slate-500 flex items-start gap-1.5">
                                <ShieldCheck size={12} className="shrink-0 mt-px" />
                                Bạn AI luôn nói thật mình là AI, không có nội dung tình dục, và khi bạn gặp chuyện khó sẽ gợi ý tìm tới người thân hoặc đường dây hỗ trợ.
                            </p>
                        </>
                    )}
                </div>

                {/* Chân: lỗi + nút */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-3">
                    <p className="flex-1 min-w-0 text-[11px] text-rose-600 dark:text-rose-300 truncate" role="status">{stepError}</p>
                    {step < STEPS.length - 1 ? (
                        <button type="button" disabled={!!stepError} onClick={() => setStep(s => s + 1)} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                            Tiếp
                        </button>
                    ) : (
                        <button type="button" disabled={!!stepError || saving} onClick={submit} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5">
                            {saving && <Loader2 size={13} className="animate-spin" />}
                            {initial ? 'Lưu thay đổi' : `Bắt đầu trò chuyện với ${p.name.trim() || 'bạn AI'}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanionSetup;
