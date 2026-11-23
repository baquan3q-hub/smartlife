import React from 'react';
import { FolderLock, Languages, LockKeyhole, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { Reveal } from '../motion/Reveal';
import { ResponsiveImage } from '../motion/Media';
import { PhoneFrame } from '../motion/PhoneFrame';
import { images } from '../media.gen';

interface PlatformsPrivacyProps {
    c: LandingCopy;
}

const platformIcons = [Smartphone, Monitor, Languages];
const privacyIcons = [LockKeyhole, FolderLock, ShieldCheck];

// A quiet beat before pricing: where SmartLife runs, and how it keeps private things private.
export const PlatformsPrivacy: React.FC<PlatformsPrivacyProps> = ({ c }) => {
    const k = c.platforms;
    return (
        <section id="platforms" className="bg-[var(--l-dusk)] py-24 sm:py-32">
            <div className="mx-auto grid max-w-[1240px] gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
                <Reveal className="lg:col-span-7">
                    <p className="l-mono mb-5 text-zinc-500">{k.eyebrow}</p>
                    <h2 className="l-h2 max-w-xl text-zinc-950">{k.title}</h2>
                    <p className="mt-6 max-w-lg text-[17px] leading-7 text-zinc-600">{k.desc}</p>

                    <div className="mt-12 flex items-end gap-8">
                        <ul className="flex-1 divide-y divide-zinc-900/10 border-y border-zinc-900/10">
                            {k.items.map((item, i) => {
                                const Icon = platformIcons[i] ?? Monitor;
                                return (
                                    <li key={item.title} className="flex items-start gap-4 py-4">
                                        <Icon size={20} className="mt-0.5 shrink-0 text-[var(--l-accent)]" />
                                        <div>
                                            <p className="text-[15px] font-medium text-zinc-950">{item.title}</p>
                                            <p className="mt-0.5 text-[14px] leading-6 text-zinc-600">{item.desc}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <PhoneFrame className="hidden w-[150px] shrink-0 sm:block">
                            <ResponsiveImage img={images['hero-phone']} alt="" sizes="150px" />
                        </PhoneFrame>
                    </div>
                </Reveal>

                <Reveal delay={0.1} className="self-start rounded-[28px] bg-[var(--l-night)] p-7 text-white sm:p-9 lg:col-span-5 lg:mt-24">
                    <p className="l-mono mb-6 text-[var(--l-warm)]">{k.privacyTitle}</p>
                    <ul className="space-y-7">
                        {k.privacy.map((item, i) => {
                            const Icon = privacyIcons[i] ?? ShieldCheck;
                            return (
                                <li key={item.title} className="flex items-start gap-4">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                                        <Icon size={18} className="text-zinc-200" />
                                    </span>
                                    <div>
                                        <p className="text-[16px] font-medium">{item.title}</p>
                                        <p className="mt-1 text-[14px] leading-6 text-zinc-400">{item.desc}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Reveal>
            </div>
        </section>
    );
};
