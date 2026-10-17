import React from 'react';
import { motion } from 'motion/react';
import { EASE } from './Reveal';

export const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.8, ease: EASE, delay }
});

// One headline line that slides up from behind a mask on mount.
export const Line: React.FC<{ children: React.ReactNode; delay: number; className?: string }> = ({ children, delay, className }) => (
    <span className="block overflow-hidden pb-[0.08em]">
        <motion.span
            className={`block ${className ?? ''}`}
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 0.9, ease: EASE, delay }}
        >
            {children}
        </motion.span>
    </span>
);
