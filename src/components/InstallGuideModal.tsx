import React, { useState, useRef } from 'react';
import { X, Smartphone, Apple, PlayCircle, Share, PlusSquare, MoreVertical, MonitorDown, Maximize } from 'lucide-react';

interface InstallGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isOpen, onClose }) => {
    const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
    const videoRef = useRef<HTMLVideoElement>(null);

    const toggleFullscreen = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            } else if ((videoRef.current as any).webkitRequestFullscreen) { /* Safari */
                (videoRef.current as any).webkitRequestFullscreen();
            } else if ((videoRef.current as any).msRequestFullscreen) { /* IE11 */
                (videoRef.current as any).msRequestFullscreen();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <MonitorDown className="text-indigo-600" size={24} />
                        Cài đặt App
                    </h3>
                    <button onClick={onClose} className="p-2 bg-gray-100/50 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 bg-gray-50/50 gap-2 mx-4 mt-4 rounded-xl border border-gray-100">
                    <button
                        onClick={() => setPlatform('ios')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${platform === 'ios' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Apple size={18} className="mb-0.5" /> iPhone / iPad (iOS)
                    </button>
                    <button
                        onClick={() => setPlatform('android')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${platform === 'android' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Smartphone size={18} /> Android
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Video Placeholder */}
                    <div className="relative aspect-[9/16] w-2/3 mx-auto bg-gray-900 rounded-2xl overflow-hidden shadow-lg border-4 border-gray-100 group">
                        <video
                            ref={videoRef}
                            src={platform === 'ios' ? "/assets/install-guide-ios.mp4" : "/assets/install-guide-android.mp4"}
                            className="w-full h-full object-contain bg-black"
                            autoPlay
                            loop
                            muted
                            playsInline
                            onClick={toggleFullscreen}
                        />
                        <button
                            onClick={toggleFullscreen}
                            className="absolute top-3 right-3 p-2 bg-black/40 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
                            title="Xem toàn màn hình"
                        >
                            <Maximize size={20} />
                        </button>
                        {/* Overlay text if video fails (user hasn't uploaded yet) */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10">
                            {/* <PlayCircle size={48} className="text-white/50" /> */}
                        </div>
                        <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                            <p className="text-white/80 text-xs font-medium bg-black/40 inline-block px-3 py-1 rounded-full backdrop-blur-md">
                                Video hướng dẫn mẫu
                            </p>
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-50">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            {platform === 'ios' ? <Apple size={16} /> : <Smartphone size={16} />}
                            Các bước thực hiện:
                        </h4>
                        <ol className="space-y-4 text-sm text-gray-600">
                            {platform === 'ios' ? (
                                <>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold shadow-sm shrink-0">1</div>
                                        <div>Bấm vào nút <span className="font-bold text-indigo-700 mx-1 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-indigo-100"><Share size={12} /> Chia sẻ</span> trên thanh công cụ Safari.</div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold shadow-sm shrink-0">2</div>
                                        <div>Cuộn xuống và chọn <span className="font-bold text-gray-800 mx-1 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-gray-200"><PlusSquare size={12} /> Thêm vào MH chính</span>.</div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold shadow-sm shrink-0">3</div>
                                        <div>Bấm <b>"Thêm"</b> ở góc trên bên phải để hoàn tất.</div>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-green-600 font-bold shadow-sm shrink-0">1</div>
                                        <div>Bấm vào biểu tượng <span className="font-bold text-gray-800 mx-1 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-gray-200"><MoreVertical size={12} /> Menu</span> (3 chấm) trên Chrome.</div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-green-600 font-bold shadow-sm shrink-0">2</div>
                                        <div>Chọn <span className="font-bold text-gray-800 mx-1">Cài đặt ứng dụng</span> hoặc <span className="font-bold text-gray-800 mx-1">Thêm vào màn hình chính</span>.</div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-green-600 font-bold shadow-sm shrink-0">3</div>
                                        <div>Bấm <b>"Cài đặt"</b> để xác nhận.</div>
                                    </li>
                                </>
                            )}
                        </ol>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 text-center">
                    <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">
                        Đã hiểu, đóng lại
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallGuideModal;
