import React, { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

interface MagneticButtonProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    strength?: number;
}

const spring = { stiffness: 260, damping: 18, mass: 0.5 };

// Button that drifts a few pixels toward the cursor, then springs back.
export const MagneticButton: React.FC<MagneticButtonProps> = ({ children, className, onClick, strength = 8 }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const reduce = useReducedMotion();
    const x = useSpring(useMotionValue(0), spring);
    const y = useSpring(useMotionValue(0), spring);

    const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        const el = ref.current;
        if (!el || reduce || e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        x.set(dx * strength);
        y.set(dy * strength * 0.6);
    };

    const reset = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.button
            ref={ref}
            type="button"
            onClick={onClick}
            onPointerMove={onPointerMove}
            onPointerLeave={reset}
            whileTap={{ scale: 0.97 }}
            style={{ x, y }}
            className={className}
        >
            {children}
        </motion.button>
    );
};
