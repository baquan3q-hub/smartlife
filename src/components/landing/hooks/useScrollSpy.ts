import { useEffect, useState } from 'react';

// Returns the id of the section currently crossing the middle of the viewport,
// or '' once the user scrolls past every tracked section.
export const useScrollSpy = (ids: string[]) => {
    const [active, setActive] = useState(ids[0]);
    const key = ids.join('|');

    useEffect(() => {
        const visible = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                });
                // Nested sections (e.g. the preview inside #top): the later id wins.
                const current = [...ids].reverse().find((id) => visible.has(id));
                setActive(current ?? '');
            },
            { rootMargin: '-45% 0px -50% 0px' }
        );
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return active;
};
