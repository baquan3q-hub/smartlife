import React from 'react';
import { motion, type Variants } from 'motion/react';

export const EASE = [0.22, 1, 0.36, 1] as const;

const item: Variants = {
    hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE } }
};

interface RevealProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    id?: string;
}

// Fades, lifts and un-blurs its content the first time it scrolls into view.
export const Reveal: React.FC<RevealProps> = ({ children, className, delay = 0, id }) => (
    <motion.div
        id={id}
        className={className}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '0px 0px -10% 0px' }}
        variants={item}
        transition={{ delay }}
    >
        {children}
    </motion.div>
);

// Parent that staggers its <StaggerItem> children.
export const Stagger: React.FC<RevealProps & { as?: 'div' | 'ul' }> = ({ children, className, as = 'div' }) => {
    const Comp = as === 'ul' ? motion.ul : motion.div;
    return (
        <Comp
            className={className}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        >
            {children}
        </Comp>
    );
};

export const StaggerItem: React.FC<RevealProps & { as?: 'div' | 'li' }> = ({ children, className, as = 'div', id }) => {
    const Comp = as === 'li' ? motion.li : motion.div;
    return (
        <Comp id={id} className={className} variants={item}>
            {children}
        </Comp>
    );
};
