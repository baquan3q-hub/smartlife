// File: src/components/ai/CompanionAvatar.tsx
// Ảnh đại diện của bạn AI: nhân vật 3D trên nền gradient pastel (emoji dự phòng nếu ảnh lỗi)

import React, { useState } from 'react';
import { getAvatar, type AvatarId } from '../../services/ai/companion/types';

interface Props {
    avatar?: AvatarId | string;
    size?: number;
    className?: string;
    /** Chấm xanh "đang online" */
    online?: boolean;
}

const CompanionAvatar: React.FC<Props> = ({ avatar, size = 28, className = '', online }) => {
    const a = getAvatar(avatar);
    const [broken, setBroken] = useState(false);
    return (
        <span
            aria-hidden="true"
            className={`relative inline-flex items-center justify-center rounded-full shrink-0 shadow-sm ring-1 ring-white/70 dark:ring-slate-700 ${className}`}
            style={{ width: size, height: size, background: `linear-gradient(135deg, ${a.from}, ${a.to})`, fontSize: Math.round(size * 0.55), lineHeight: 1 }}
        >
            {broken ? a.emoji : (
                <img src={a.image} alt="" draggable={false} loading="lazy" onError={() => setBroken(true)} className="w-full h-full rounded-full object-cover" />
            )}
            {online && (
                <span
                    className="absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                    style={{ width: Math.max(6, size * 0.26), height: Math.max(6, size * 0.26) }}
                />
            )}
        </span>
    );
};

export default CompanionAvatar;
