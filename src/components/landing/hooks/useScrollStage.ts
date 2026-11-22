import { RefObject, useEffect, useState } from 'react';
import { useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';

interface ScrollStageOptions {
    target: RefObject<HTMLElement | null>;
    offset?: ['start start', 'end end'] | ['start end', 'end start'] | ['start end', 'center center'];
    dwell?: number; // 0 to 0.6: remap time so progress settles around 0.5 and accelerates at edges
    spring?: boolean;
    stiffness?: number;
    damping?: number;
}

/**
 * Custom scroll progress hook tailored for scroll-craft stages.
 * Provides normalized progress p (0..1), with optional dwell time mapping and spring lerp.
 */
export function useScrollStage({
    target,
    offset = ['start start', 'end end'],
    dwell = 0,
    spring = true,
    stiffness = 120,
    damping = 30
}: ScrollStageOptions): {
    rawProgress: MotionValue<number>;
    progress: MotionValue<number>;
    isReducedMotion: boolean;
} {
    const [isReducedMotion, setIsReducedMotion] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setIsReducedMotion(media.matches);
        const listener = () => setIsReducedMotion(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    const { scrollYProgress: rawProgress } = useScroll({
        target,
        offset
    });

    // Optional dwell mapping: cubic S-curve remap around center
    const dwellProgress = useTransform(rawProgress, (v) => {
        if (dwell <= 0) return v;
        // Dwell curve: smoothstep flattening around v = 0.5
        const d = Math.min(Math.max(dwell, 0), 0.6);
        // Remap: linear interpolation with soft cubic ease in the middle
        const centered = (v - 0.5) * 2; // -1 to 1
        const curved = Math.sign(centered) * Math.pow(Math.abs(centered), 1 + d * 1.5);
        return (curved / 2) + 0.5;
    });

    const springProgress = useSpring(dwellProgress, {
        stiffness,
        damping,
        mass: 0.35
    });

    return {
        rawProgress,
        progress: spring && !isReducedMotion ? springProgress : dwellProgress,
        isReducedMotion
    };
}
