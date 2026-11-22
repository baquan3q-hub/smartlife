import React, { useState } from 'react';
import { ArrowRight, Calculator, Lock, Play, Pause, Check, Sparkles, KeyRound } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { bento } from '../data';
import { GlassIcon } from '../../icons/GlassIcon';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { TiltCard } from '../motion/TiltCard';
import { ResponsiveImage } from '../motion/Media';

interface BentoGridProps {
    c: LandingCopy;
    onLogin: () => void;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ c, onLogin }) => {
    // Interactive state for Finance Math demo
    const [mathInput, setMathInput] = useState('50k + 1.5tr');
    const [mathResult, setMathResult] = useState('1.550.000 ₫');

    // Interactive state for Pomodoro mini demo
    const [isPomoRunning, setIsPomoRunning] = useState(false);
    const [pomoSecs, setPomoSecs] = useState(1500); // 25:00

    // Interactive state for Journal PIN lock
    const [pinCode, setPinCode] = useState(['•', '•', '', '']);
    const [isPinUnlocked, setIsPinUnlocked] = useState(false);

    const handleEvalMath = (expr: string) => {
        setMathInput(expr);
        if (expr.includes('50k + 1.5tr')) setMathResult('1.550.000 ₫');
        else if (expr.includes('2tr - 350k')) setMathResult('1.650.000 ₫');
        else if (expr.includes('100k * 4')) setMathResult('400.000 ₫');
        else setMathResult('2.450.000 ₫');
    };

    const handlePinDigit = (digit: string) => {
        const next = [...pinCode];
        const emptyIdx = next.findIndex((d) => d === '');
        if (emptyIdx !== -1) {
            next[emptyIdx] = digit;
            setPinCode(next);
            if (emptyIdx === 3) {
                setIsPinUnlocked(true);
            }
        } else {
            // Reset
            setPinCode([digit, '', '', '']);
            setIsPinUnlocked(false);
        }
    };

    return (
        <section id="features" className="py-20 sm:py-28 bg-white">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <Reveal className="mx-auto mb-14 max-w-2xl text-center">
                    <p className="l-eyebrow mb-3 flex items-center justify-center gap-2">
                        <Sparkles size={14} />
                        {c.bentoEyebrow}
                    </p>
                    <h2 className="l-h2 text-zinc-950">{c.bentoTitle}</h2>
                    <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">{c.bentoDesc}</p>
                </Reveal>

                <Stagger className="grid grid-cols-1 gap-5 md:grid-cols-6">
                    {bento.map((item) => {
                        const copy = c.bento[item.key];
                        const dark = item.dark;

                        return (
                            <StaggerItem key={item.key} id={item.id} className={item.span}>
                                <TiltCard
                                    max={3}
                                    className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-[26px] border p-6 transition-all duration-300 hover:shadow-[0_24px_50px_-20px_rgba(9,9,11,0.2)] ${
                                        dark
                                            ? 'border-white/10 bg-zinc-950 text-white'
                                            : 'border-zinc-900/[0.08] bg-white text-zinc-950'
                                    }`}
                                >
                                    <div className="l-spotlight pointer-events-none absolute inset-0" />

                                    <div>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <GlassIcon
                                                    name={item.icon}
                                                    size={44}
                                                    className="mb-4 -ml-1 transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <h3 className={`l-h3 ${dark ? 'text-white' : 'text-zinc-950'}`}>
                                                    {copy.title}
                                                </h3>
                                                <p
                                                    className={`mt-2 text-[14px] leading-relaxed ${
                                                        dark ? 'text-zinc-400' : 'text-zinc-600'
                                                    }`}
                                                >
                                                    {copy.desc}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Micro-Interaction 1: Math Calculator on Visual/Finance card */}
                                        {item.key === 'visual' && (
                                            <div className="mt-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 p-4">
                                                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                                                    <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                                                        <Calculator size={13} className="text-sky-600" />
                                                        Bàn phím toán học tích hợp
                                                    </span>
                                                    <span className="font-mono text-emerald-600 font-bold">{mathResult}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={mathInput}
                                                        onChange={(e) => handleEvalMath(e.target.value)}
                                                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-mono font-medium text-zinc-800 shadow-xs focus:border-sky-500 focus:outline-hidden"
                                                    />
                                                </div>
                                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                    {['50k + 1.5tr', '2tr - 350k', '100k * 4'].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => handleEvalMath(preset)}
                                                            className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[11px] font-mono text-zinc-600 hover:border-sky-400 hover:text-sky-600"
                                                        >
                                                            {preset}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Micro-Interaction 2: Journal PIN Lock */}
                                        {item.key === 'journal' && (
                                            <div className="mt-4 rounded-xl bg-pink-50/60 border border-pink-200/60 p-3.5">
                                                <div className="flex items-center justify-between text-xs text-pink-900 font-semibold mb-2">
                                                    <span className="flex items-center gap-1">
                                                        <Lock size={12} />
                                                        {isPinUnlocked ? 'Đã mở khóa nhật ký' : 'Mã PIN bảo mật'}
                                                    </span>
                                                    <span className="font-mono text-pink-700">PIN Guard</span>
                                                </div>
                                                <div className="flex justify-center gap-2 mb-2">
                                                    {[0, 1, 2, 3].map((idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`h-7 w-7 rounded-lg border flex items-center justify-center font-mono font-bold text-xs ${
                                                                pinCode[idx]
                                                                    ? 'bg-pink-600 text-white border-pink-600'
                                                                    : 'bg-white border-pink-200 text-pink-400'
                                                            }`}
                                                        >
                                                            {pinCode[idx] ? '●' : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-4 gap-1">
                                                    {['1', '2', '3', '4'].map((digit) => (
                                                        <button
                                                            key={digit}
                                                            type="button"
                                                            onClick={() => handlePinDigit(digit)}
                                                            className="rounded-md bg-white border border-pink-200 py-1 text-center font-mono text-xs font-semibold text-pink-800 hover:bg-pink-100"
                                                        >
                                                            {digit}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Micro-Interaction 3: Focus & Pomodoro */}
                                        {item.key === 'focus' && (
                                            <div className="mt-4 flex flex-col gap-3">
                                                <div className="rounded-xl bg-orange-50/70 border border-orange-200/70 p-3 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[11px] font-bold text-orange-800 uppercase tracking-wide block">Pomodoro Timer</span>
                                                        <span className="text-lg font-mono font-bold text-orange-950">25:00</span>
                                                    </div>
                                                    <a
                                                        href="#/focus"
                                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-white shadow-md hover:bg-orange-700"
                                                    >
                                                        <Play size={15} className="ml-0.5" />
                                                    </a>
                                                </div>
                                                <a
                                                    href="#/focus"
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
                                                >
                                                    {c.focusCta}
                                                    <ArrowRight size={13} />
                                                </a>
                                            </div>
                                        )}

                                        {item.key === 'storage' && (
                                            <button
                                                type="button"
                                                onClick={onLogin}
                                                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
                                            >
                                                {c.storageCta}
                                                <ArrowRight size={13} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Responsive Image Preview Bottom */}
                                    <div className="relative -mx-6 -mb-6 mt-6 flex flex-1 items-end pl-6">
                                        <ResponsiveImage
                                            img={item.img}
                                            alt={copy.title}
                                            sizes={
                                                item.span === 'md:col-span-4'
                                                    ? '(min-width: 768px) 720px, 100vw'
                                                    : '(min-width: 768px) 360px, 100vw'
                                            }
                                            className={`h-auto w-full translate-y-2 rounded-tl-xl border-l border-t object-cover object-left-top transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:scale-[1.02] ${
                                                dark ? 'border-white/10' : 'border-zinc-900/[0.08]'
                                            } ${item.span === 'md:col-span-4' ? 'max-h-[300px]' : 'aspect-[16/10]'}`}
                                        />
                                    </div>
                                </TiltCard>
                            </StaggerItem>
                        );
                    })}
                </Stagger>
            </div>
        </section>
    );
};
