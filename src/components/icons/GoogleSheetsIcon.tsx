import React from 'react';

interface GoogleSheetsIconProps {
  className?: string;
  size?: number;
}

export const GoogleSheetsIcon: React.FC<GoogleSheetsIconProps> = ({ className = '', size = 20 }) => {
  return (
    <img
      src="/Google_Sheets_icon_(2026).svg.webp"
      alt="Google Sheets"
      width={size}
      height={size}
      className={`shrink-0 select-none object-contain block ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }}
      onError={(e) => {
        const target = e.currentTarget;
        if (target.src.endsWith('.svg.webp')) {
          target.src = '/Google_Sheets_icon_(2026).webp';
        }
      }}
    />
  );
};
