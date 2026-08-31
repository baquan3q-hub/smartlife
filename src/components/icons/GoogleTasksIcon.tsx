import React from 'react';

interface GoogleTasksIconProps {
  className?: string;
  size?: number;
}

export const GoogleTasksIcon: React.FC<GoogleTasksIconProps> = ({ className = '', size = 16 }) => {
  return (
    <img
      src="/Google_Tasks_Logo_05.2026.svg.webp"
      alt="Google Tasks"
      width={size}
      height={size}
      className={`shrink-0 select-none object-contain block ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }}
      onError={(e) => {
        // Fallback to alternative path if needed
        const target = e.currentTarget;
        if (target.src.endsWith('.svg.webp')) {
          target.src = '/Google_Tasks_Logo_05.2026.webp';
        }
      }}
    />
  );
};
