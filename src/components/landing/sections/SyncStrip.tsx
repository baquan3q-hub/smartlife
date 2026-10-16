import React from 'react';
import { GoogleCalendarIcon } from '../../icons/GoogleCalendarIcon';
import { GoogleTasksIcon } from '../../icons/GoogleTasksIcon';
import { GoogleSheetsIcon } from '../../icons/GoogleSheetsIcon';
import { LandingCopy } from '../i18n';
import { marquee } from '../data';
import { Reveal } from '../motion/Reveal';

interface SyncStripProps {
    c: LandingCopy;
    scrollTo: (target: string) => void;
}

const google = [
    { name: 'Google Tasks', Icon: GoogleTasksIcon },
    { name: 'Google Calendar', Icon: GoogleCalendarIcon },
    { name: 'Google Sheets', Icon: GoogleSheetsIcon }
];

export const SyncStrip: React.FC<SyncStripProps> = ({ c, scrollTo }) => (
    <section className="py-20 sm:py-24">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 sm:px-6">
            <p className="text-[13px] font-medium text-zinc-500">{c.syncWith}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                {google.map(({ name, Icon }) => (
                    <div key={name} className="flex items-center gap-2 text-[15px] font-medium text-zinc-700">
                        <Icon size={20} />
                        {name}
                    </div>
                ))}
            </div>
        </Reveal>

        <div className="l-mask-x mt-12 overflow-hidden">
            <div className="animate-marquee gap-2.5 py-1">
                {[...marquee, ...marquee].map((m, i) => (
                    <button
                        key={i}
                        type="button"
                        tabIndex={i >= marquee.length ? -1 : 0}
                        aria-hidden={i >= marquee.length}
                        onClick={() => scrollTo(m.target)}
                        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-zinc-900/[0.08] bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-900/20 hover:text-zinc-950 hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.2)]"
                    >
                        <m.icon size={15} className="text-zinc-400" />
                        {c.marquee[m.key]}
                    </button>
                ))}
            </div>
        </div>
    </section>
);
