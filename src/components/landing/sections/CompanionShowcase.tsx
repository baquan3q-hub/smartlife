import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { LandingCopy, LandingRelationship } from '../i18n';
import { Reveal } from '../motion/Reveal';
import { MagneticButton } from '../motion/MagneticButton';
import CompanionAvatar from '../../ai/CompanionAvatar';
import { AVATARS, type AvatarId } from '../../../services/ai/companion/types';

interface CompanionShowcaseProps {
    c: LandingCopy;
    onLogin: () => void;
}

const RELATIONS: LandingRelationship[] = ['friend', 'study_buddy', 'senior', 'mentor'];
const snappy = { type: 'spring', stiffness: 350, damping: 28 } as const;

// Peak #2, on the night ground: pick a character and a relationship, and a short sample chat plays out.
export const CompanionShowcase: React.FC<CompanionShowcaseProps> = ({ c, onLogin }) => {
    const [avatar, setAvatar] = useState<AvatarId>('sun');
    const [rel, setRel] = useState<LandingRelationship>('friend');
    const k = c.companion;

    return (
        <section id="companion" className="relative bg-[var(--l-night)] py-24 text-white sm:py-32">
            <div className="mx-auto grid max-w-[1240px] gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
                <Reveal className="lg:col-span-5">
                    <p className="l-mono mb-5 text-zinc-400">{k.eyebrow}</p>
                    <h2 className="l-h2">{k.title}</h2>
                    <p className="mt-6 max-w-md text-[17px] leading-7 text-zinc-400">{k.desc}</p>
                    <ol className="mt-10 border-t border-white/10">
                        {k.caps.map((cap, i) => (
                            <li key={cap} className="flex items-baseline gap-5 border-b border-white/10 py-3.5 text-[15px] text-zinc-200">
                                <span className="l-mono w-6 text-[var(--l-warm)]">{String(i + 1).padStart(2, '0')}</span>
                                {cap}
                            </li>
                        ))}
                    </ol>
                    <MagneticButton
                        onClick={onLogin}
                        className="group mt-10 flex h-12 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
                    >
                        {k.cta}
                        <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </MagneticButton>
                </Reveal>

                <div className="lg:col-span-7">
                    <p className="l-mono mb-3 text-zinc-500">{k.pickAvatar}</p>
                    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={k.pickAvatar}>
                        {AVATARS.map((a, i) => (
                            <button
                                key={a.id}
                                type="button"
                                role="radio"
                                aria-checked={avatar === a.id}
                                aria-label={`${k.pickAvatar} ${i + 1}`}
                                onClick={() => setAvatar(a.id)}
                                className={`rounded-full p-1 transition-all duration-300 ${
                                    avatar === a.id ? 'bg-white/15 ring-2 ring-[var(--l-warm)]' : 'opacity-60 hover:opacity-100'
                                }`}
                            >
                                <CompanionAvatar avatar={a.id} size={44} />
                            </button>
                        ))}
                    </div>

                    <p className="l-mono mb-3 mt-8 text-zinc-500">{k.pickRelation}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label={k.pickRelation}>
                        {RELATIONS.map((r) => (
                            <button
                                key={r}
                                type="button"
                                role="tab"
                                aria-selected={rel === r}
                                onClick={() => setRel(r)}
                                className={`rounded-2xl border px-3.5 py-3 text-left transition-colors duration-300 ${
                                    rel === r ? 'border-white/30 bg-white/10' : 'border-white/10 hover:border-white/20'
                                }`}
                            >
                                <span className="block text-[14px] font-medium text-white">{k.relationships[r].label}</span>
                                <span className="mt-0.5 block text-[12px] leading-4 text-zinc-500">{k.relationships[r].hint}</span>
                            </button>
                        ))}
                    </div>

                    <ChatPreview key={`${avatar}-${rel}`} c={c} avatar={avatar} rel={rel} />
                </div>
            </div>
        </section>
    );
};

interface ChatPreviewProps {
    c: LandingCopy;
    avatar: AvatarId;
    rel: LandingRelationship;
}

// Messages appear one by one once the panel is on screen; the companion "types" before each reply.
const ChatPreview: React.FC<ChatPreviewProps> = ({ c, avatar, rel }) => {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
    const reduced = useReducedMotion();
    const items = useMemo(
        () => c.companion.relationships[rel].chat.flatMap((m) => [
            { from: 'user' as const, text: m.user },
            { from: 'ai' as const, text: m.ai }
        ]),
        [c, rel]
    );
    const [shown, setShown] = useState(reduced ? items.length : 0);

    useEffect(() => {
        if (!inView || shown >= items.length) return;
        const delay = items[shown].from === 'user' ? (shown === 0 ? 300 : 700) : 1200;
        const id = window.setTimeout(() => setShown((n) => n + 1), delay);
        return () => window.clearTimeout(id);
    }, [inView, shown, items]);

    const typing = inView && shown < items.length && items[shown].from === 'ai';

    return (
        <div ref={ref} className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <CompanionAvatar avatar={avatar} size={40} online />
                <div>
                    <p className="text-[15px] font-medium text-white">{c.heroBubbleName}</p>
                    <p className="text-[12px] text-emerald-400">{typing ? `${c.heroBubbleName} ${c.companion.typing}` : c.companion.online}</p>
                </div>
                <span className="l-mono ml-auto text-[var(--l-warm)]">22:00</span>
            </div>
            <div className="flex min-h-[260px] flex-col justify-end gap-2.5 pt-5" aria-live="polite">
                <AnimatePresence initial={false}>
                    {items.slice(0, shown).map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={snappy}
                            className={`max-w-[80%] rounded-[18px] px-4 py-2.5 text-[15px] leading-6 ${
                                m.from === 'user'
                                    ? 'self-end rounded-br-md bg-[var(--l-accent)] text-white'
                                    : 'self-start rounded-bl-md bg-white/10 text-zinc-100'
                            }`}
                        >
                            {m.text}
                        </motion.div>
                    ))}
                    {typing && (
                        <motion.div
                            key="typing"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={snappy}
                            className="flex gap-1 self-start rounded-[18px] rounded-bl-md bg-white/10 px-4 py-3.5"
                            aria-hidden
                        >
                            {[0, 1, 2].map((d) => (
                                <motion.span
                                    key={d}
                                    className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
