import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertTriangle, FileText, Key, CheckCircle, Mail, Lock, User as UserIcon, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';

interface LoginProps {
    onBack?: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, loading } = useAuth();

    const [isLoginMode, setIsLoginMode] = useState(true);
    const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fullName, setFullName] = useState('');

    // 1. Check for Configuration Issues first
    if (!isSupabaseConfigured) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-red-100 overflow-hidden">
                    <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
                        <div className="bg-red-100 p-2 rounded-lg">
                            <AlertTriangle className="text-red-600 w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-900">Kết nối Supabase chưa thành công</h2>
                            <p className="text-red-600 text-sm">Ứng dụng chưa tìm thấy thông tin cấu hình Database.</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div>
                            <h3 className="text-gray-900 font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Nguyên nhân:
                            </h3>
                            <p className="text-gray-600 ml-6">
                                File <code className="bg-gray-100 px-2 py-1 rounded text-sm text-pink-600 font-mono">.env.local</code> chưa được tạo hoặc thông tin bên trong chưa chính xác.
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-xl text-sm text-indigo-800 flex gap-3 items-start">
                            <Key className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p>Hãy tạo file .env.local và dán URL + Key lấy từ Supabase Dashboard vào đó.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        await signInWithGoogle();
        // Usually redirects
        setTimeout(() => setIsLoading(false), 5000);
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isForgotPasswordMode) {
                const { error } = await resetPassword(email);
                if (error) throw error;
                setSuccessMessage('Đã gửi liên kết đặt lại mật khẩu! Vui lòng kiểm tra hộp thư email của bạn.');
                setIsForgotPasswordMode(false);
            } else if (isLoginMode) {
                const { error } = await signInWithEmail(email, password);
                if (error) throw error;
            } else {
                const { data, error } = await signUpWithEmail(email, password, fullName);
                if (error) throw error;
                if (data?.user && !data?.session) {
                    setSuccessMessage('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản của bạn.');
                } else {
                    setSuccessMessage('Đăng ký thành công!');
                }
                setIsLoginMode(true);
                setPassword('');
            }
        } catch (err: any) {
            console.error(err);
            if (err.message.includes('already registered')) {
                setError('Email này đã được đăng ký. Vui lòng đăng nhập.');
            } else if (err.message.includes('Password should be at least')) {
                setError('Mật khẩu quá ngắn. Vui lòng nhập ít nhất 6 ký tự.');
            } else if (err.message.includes('invalid login credentials')) {
                setError('Email hoặc mật khẩu không chính xác.');
            } else {
                setError(err.message || 'Đã có lỗi xảy ra. Kiểm tra lại thông tin.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md transform transition-all">

                {/* Header */}
                <div className="text-center mb-8 relative">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="absolute left-0 top-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            title="Quay lại"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-xl shadow-indigo-100 border-2 border-white">
                        <img src="/pwa-192x192.png" alt="SmartLife Logo" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isForgotPasswordMode ? 'Khôi phục mật khẩu' : isLoginMode ? 'Start Your Smartlife' : 'Tạo tài khoản mới'}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {isForgotPasswordMode ? 'Nhập email của bạn để nhận liên kết đặt lại mật khẩu' : 'Quản lý tài chính & lịch trình thông minh'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    {!isLoginMode && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Họ và tên</label>
                            <div className="relative">
                                <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Nguyễn Văn A"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Email</label>
                        <div className="relative">
                            <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                            <input
                                type="email"
                                required
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                placeholder="email@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {!isForgotPasswordMode && (
                        <div>
                            <div className="flex justify-between items-center mb-1 ml-1 pr-1">
                                <label className="block text-xs font-semibold text-gray-700">Mật khẩu</label>
                                {isLoginMode && (
                                    <button
                                        type="button"
                                        onClick={() => { setIsForgotPasswordMode(true); setError(null); setSuccessMessage(null); }}
                                        className="text-xs text-indigo-600 font-medium hover:underline"
                                    >
                                        Quên mật khẩu?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full pl-10 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            {successMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <>
                                <span>{isForgotPasswordMode ? 'Gửi liên kết khôi phục' : isLoginMode ? 'Đăng nhập' : 'Đăng ký'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                {isForgotPasswordMode ? (
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => { setIsForgotPasswordMode(false); setIsLoginMode(true); setError(null); setSuccessMessage(null); }}
                            className="text-sm text-gray-500 hover:text-indigo-600 font-medium transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 inline-block mr-1 mb-0.5" />
                            Quay lại trang Đăng nhập
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="my-6 flex items-center gap-3">
                            <div className="h-px bg-gray-200 flex-1"></div>
                            <span className="text-xs text-gray-400 font-medium">HOẶC</span>
                            <div className="h-px bg-gray-200 flex-1"></div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-all duration-200"
                        >
                            <img
                                src="https://www.svgrepo.com/show/475656/google-color.svg"
                                alt="Google"
                                className="w-5 h-5"
                            />
                            <span>Google</span>
                        </button>

                        <p className="mt-8 text-center text-sm text-gray-600">
                            {isLoginMode ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                            <button
                                onClick={() => { setIsLoginMode(!isLoginMode); setIsForgotPasswordMode(false); setError(null); setSuccessMessage(null); }}
                                className="ml-1 text-indigo-600 font-semibold hover:underline focus:outline-none"
                            >
                                {isLoginMode ? 'Đăng ký ngay' : 'Đăng nhập'}
                            </button>
                        </p>
                    </>
                )}

            </div>
        </div>
    );
};

export default Login;
