import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export const GlobalLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
            {/* Lottie Animation Wrapper */}
            <div className="w-64 h-64 md:w-80 md:h-80 drop-shadow-2xl">
                <DotLottieReact
                    src="/wallet-money.lottie"
                    loop
                    autoplay
                />
            </div>
            
            {/* Text Loading */}
            <div className="mt-2 flex flex-col items-center">
                <h2 className="text-xl font-black text-gray-800 tracking-tight">SmartLife</h2>
                <p className="mt-2 text-sm font-bold text-indigo-500 uppercase tracking-widest animate-pulse">
                    Đang thiết lập...
                </p>
            </div>
        </div>
    );
};
