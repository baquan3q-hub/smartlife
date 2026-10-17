import React from 'react';
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
