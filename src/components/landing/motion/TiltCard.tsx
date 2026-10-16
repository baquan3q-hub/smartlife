import React, { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

interface TiltCardProps {
    children: React.ReactNode;
    className?: string;
    max?: number;
}

const spring = { stiffness: 220, damping: 22, mass: 0.6 };

// Tilts slightly toward the cursor and feeds --x/--y to a `.l-spotlight` child.
export const TiltCard: React.FC<TiltCardProps> = ({ children, className, max = 6 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const rx = useSpring(useMotionValue(0), spring);
    const ry = useSpring(useMotionValue(0), spring);

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el || e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--x', `${px * 100}%`);
        el.style.setProperty('--y', `${py * 100}%`);
        if (reduce) return;
        ry.set((px - 0.5) * 2 * max);
        rx.set(-(py - 0.5) * 2 * max);
    };

    const onPointerLeave = () => {
        rx.set(0);
        ry.set(0);
    };

    return (
        <motion.div
            ref={ref}
            className={className}
            style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
        >
            {children}
        </motion.div>
    );
};
