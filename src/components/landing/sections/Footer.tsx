import React from 'react';
import { ArrowUp, Facebook, Globe, Mail, User } from 'lucide-react';
import { LandingCopy, MarqueeKey } from '../i18n';
import { marquee } from '../data';

interface FooterProps {
    c: LandingCopy;
    scrollTo: (target: string | number) => void;
    goTo: (target: string | number) => void;
    onNavigate: (page: string) => void;
}

const CORE: MarqueeKey[] = ['google', 'kanban', 'ai', 'career', 'cv', 'finance', 'journal'];
const UTILS: MarqueeKey[] = ['focus', 'habit', 'gpa', 'spotify', 'storage'];

const contacts = (c: LandingCopy) => [
    { icon: User, label: c.footer.dev, value: 'Bùi Anh Quân (baquan3q)' },
    { icon: Facebook, label: 'Facebook', value: 'facebook.com/buianhquan06', href: 'https://facebook.com/buianhquan06' },
    { icon: Mail, label: c.footer.email, value: 'baquan3q@gmail.com', href: 'mailto:baquan3q@gmail.com' },
    { icon: Globe, label: c.footer.profile, value: 'beacons.ai/baquan3q', href: 'https://beacons.ai/baquan3q' }
];

export const Footer: React.FC<FooterProps> = ({ c, scrollTo, goTo, onNavigate }) => {
    const LinkList = ({ title, keys }: { title: string; keys: MarqueeKey[] }) => (
        <div>
            <h4 className="mb-4 text-[13px] font-medium text-zinc-950">{title}</h4>
            <ul className="space-y-2.5">
                {keys.map((key) => {
                    const target = marquee.find((m) => m.key === key)!.target;
                    return (
                        <li key={key}>
                            <button
                                type="button"
                                onClick={() => goTo(target)}
                                className="text-left text-sm text-zinc-600 transition-colors duration-200 hover:text-zinc-950"
                            >
                                {c.marquee[key]}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    return (
        <footer id="site-footer" className="border-t border-zinc-900/[0.07] bg-white">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
                <div className="grid grid-cols-2 gap-10 md:grid-cols-12">
                    <div className="col-span-2 md:col-span-4">
                        <div className="flex items-center gap-2.5">
                            <img src="/pwa-192x192.png" alt="" className="h-8 w-8 rounded-[10px] border border-zinc-900/5" />
                            <span className="text-[15px] font-semibold tracking-tight text-zinc-950">SmartLife</span>
                        </div>
                        <p className="mt-4 max-w-xs text-sm leading-6 text-zinc-600">{c.footer.tagline}</p>
                    </div>
                    <div className="md:col-span-2">
                        <LinkList title={c.footer.col1} keys={CORE} />
                    </div>
                    <div className="md:col-span-2">
                        <LinkList title={c.footer.col2} keys={UTILS} />
                    </div>
                    <div className="col-span-2 md:col-span-4">
                        <h4 className="mb-4 text-[13px] font-medium text-zinc-950">{c.footer.col3}</h4>
                        <ul className="space-y-3">
                            {contacts(c).map(({ icon: Icon, label, value, href }) => (
                                <li key={label} className="flex items-start gap-3">
                                    <Icon size={15} className="mt-0.5 shrink-0 text-zinc-400" />
                                    <div className="min-w-0">
                                        <div className="text-xs text-zinc-500">{label}</div>
                                        {href ? (
                                            <a
                                                href={href}
                                                target={href.startsWith('http') ? '_blank' : undefined}
                                                rel="noreferrer"
                                                className="break-all text-sm text-zinc-700 transition-colors hover:text-zinc-950"
                                            >
                                                {value}
                                            </a>
                                        ) : (
                                            <div className="text-sm text-zinc-700">{value}</div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-zinc-900/[0.07] pt-8 sm:flex-row sm:items-center">
                    <p className="text-sm text-zinc-500">© 2026 SmartLife · {c.footer.built}</p>
                    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto sm:mr-6" aria-label="Pages">
                        {(['features', 'pricing', 'contact'] as const).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onNavigate(key)}
                                className="text-sm text-zinc-600 transition-colors hover:text-zinc-950"
                            >
                                {c.nav[key]}
                            </button>
                        ))}
                    </nav>
                    <button
                        type="button"
                        onClick={() => scrollTo(0)}
                        className="group flex h-10 items-center gap-2 rounded-full border border-zinc-900/10 px-4 text-sm text-zinc-600 transition-colors hover:border-zinc-900/20 hover:text-zinc-950"
                    >
                        {c.footer.backToTop}
                        <ArrowUp size={15} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
                    </button>
                </div>
            </div>
        </footer>
    );
};
