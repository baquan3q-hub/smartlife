import React from 'react';

interface GoogleCalendarIconProps {
  className?: string;
  size?: number;
}

export const GoogleCalendarIcon: React.FC<GoogleCalendarIconProps> = ({ className = '', size = 20 }) => {
  return (
    <img
      src="/Google_Calendar_icon_(2026).svg.webp"
      alt="Google Calendar"
      width={size}
      height={size}
      className={`shrink-0 select-none object-contain block ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }}
      onError={(e) => {
        const target = e.currentTarget;
        if (target.src.endsWith('.svg.webp')) {
          target.src = '/Google_Calendar_icon_(2026).webp';
        }
      }}
    />
  );
};
