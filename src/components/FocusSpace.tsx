import React from 'react';
import FocusTimer from './FocusTimer';
import { useFocusTimer } from '../hooks/useFocusTimer';

interface FocusSpaceProps {
    timer: ReturnType<typeof useFocusTimer>;
}

const FocusSpace: React.FC<FocusSpaceProps> = ({ timer }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center p-4 relative overflow-hidden rounded-3xl bg-white shadow-sm border border-gray-100">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-50 to-transparent z-0" />

            <div className="relative z-10 w-full max-w-2xl">
                <FocusTimer timer={timer} />

                {/* Optional: Add recent tasks or stats here if needed later */}
                <div className="mt-8 text-center">
                    <p className="text-gray-400 text-sm font-medium">✨ "Sự tập trung là chìa khóa của mọi thành công."</p>
                </div>
            </div>
        </div>
    );
};

export default FocusSpace;
