import React from 'react';

interface PhoneFrameProps {
    children: React.ReactNode;
    className?: string;
}

// Minimal device bezel with a dynamic island; the screen keeps its child's aspect ratio.
export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children, className }) => (
    <div
        className={`relative rounded-[2.6rem] bg-zinc-950 p-[7px] shadow-[0_40px_80px_-24px_rgba(9,9,11,0.55),inset_0_0_0_1px_rgba(255,255,255,0.08)] ${className ?? ''}`}
    >
        <div className="relative overflow-hidden rounded-[2.2rem] bg-white [&>*]:block [&>*]:h-auto [&>*]:w-full">
            {children}
        </div>
        <span className="pointer-events-none absolute left-1/2 top-[13px] h-[18px] w-[30%] -translate-x-1/2 rounded-full bg-zinc-950" aria-hidden />
    </div>
);
