import { useEffect, useState } from 'react';

// True while the media query matches. Used to pick the sticky (desktop) or flowing (mobile) layout of a section.
export const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

    useEffect(() => {
        const mq = window.matchMedia(query);
        const update = () => setMatches(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, [query]);

    return matches;
};

export const LG_QUERY = '(min-width: 1024px)';
