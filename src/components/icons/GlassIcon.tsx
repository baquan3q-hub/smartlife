import React from 'react';
import { glassIconSrc, type GlassIconName } from './glassIcons';

interface GlassIconProps {
    name: GlassIconName;
    size?: number;
    className?: string;
    /** Dimmed look for inactive nav items (glass icons can't take a text colour). */
    muted?: boolean;
    /** Accessible label. Leave empty when the icon sits next to visible text. */
    alt?: string;
    /** Load immediately; use for navigation that is on screen at first paint. */
    eager?: boolean;
}

export const GlassIcon: React.FC<GlassIconProps> = ({ name, size = 24, className = '', muted = false, alt = '', eager = false }) => (
    <img
        src={glassIconSrc(name, size)}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        width={size}
        height={size}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={`block shrink-0 select-none object-contain transition-[opacity,filter] duration-200 ${muted ? 'opacity-60 grayscale-[35%]' : ''} ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
    />
);

export type { GlassIconName };
