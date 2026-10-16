import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import type { images } from '../media.gen';

export type Img = (typeof images)[keyof typeof images];

interface ResponsiveImageProps {
    img: Img;
    alt: string;
    sizes: string;
    className?: string;
    priority?: boolean;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({ img, alt, sizes, className, priority }) => (
    <img
        src={img.src}
        srcSet={img.srcSet}
        sizes={sizes}
        alt={alt}
        width={img.w}
        height={img.h}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={className}
    />
);

interface LoopVideoProps {
    mp4: string;
    webm: string;
    poster: string;
    w: number;
    h: number;
    label: string;
    className?: string;
}

// Muted loop that only downloads and plays while on screen; reduced motion keeps the poster.
export const LoopVideo: React.FC<LoopVideoProps> = ({ mp4, webm, poster, w, h, label, className }) => {
    const ref = useRef<HTMLVideoElement>(null);
    const reduce = useReducedMotion();

    useEffect(() => {
        const video = ref.current;
        if (!video || reduce) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    video.play().catch(() => undefined);
                } else {
                    video.pause();
                }
            },
            { threshold: 0.25 }
        );
        observer.observe(video);
        return () => observer.disconnect();
    }, [reduce]);

    return (
        <video
            ref={ref}
            className={className}
            width={w}
            height={h}
            poster={poster}
            muted
            loop
            playsInline
            preload="none"
            aria-label={label}
        >
            <source src={webm} type="video/webm" />
            <source src={mp4} type="video/mp4" />
        </video>
    );
};
