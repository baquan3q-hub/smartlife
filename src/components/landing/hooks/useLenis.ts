import { useCallback, useEffect, useRef } from 'react';
import Lenis from 'lenis';

export const HEADER_OFFSET = 88;

// Inertial smooth scroll scoped to the landing page; skipped when the user prefers reduced motion.
export const useLenis = () => {
    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, autoRaf: true });
        lenisRef.current = lenis;
        return () => {
            lenis.destroy();
            lenisRef.current = null;
        };
    }, []);

    return useCallback((target: string | number) => {
        const lenis = lenisRef.current;
        if (typeof target === 'number') {
            if (lenis) lenis.scrollTo(target);
            else window.scrollTo({ top: target, behavior: 'smooth' });
            return;
        }
        const el = document.getElementById(target);
        if (!el) return;
        if (lenis) {
            lenis.scrollTo(el, { offset: -HEADER_OFFSET });
        } else {
            const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    }, []);
};
