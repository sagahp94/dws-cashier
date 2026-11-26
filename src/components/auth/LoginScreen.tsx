import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Users,
  Calendar,
  Lock,
  ArrowRight,
  WifiOff,
} from 'lucide-react';
import { firebaseService, CloudSyncStatus } from '../../services/firebaseService';
import { MinimalAppIcon } from '../common/MinimalAppIcon';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
  syncStatus: CloudSyncStatus;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ syncStatus }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLocalError(null);

    try {
      const result = await firebaseService.signInWithGoogle();
      if (!result.success) {
        setLocalError(result.error || 'Đăng nhập không thành công.');
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Có lỗi xảy ra trong quá trình đăng nhập.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorMessage = localError || syncStatus.error;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 font-sans antialiased">
      {/* Main Login Card Container */}
      <div className="w-full max-w-md z-10 space-y-5">
        {/* Brand Card */}
        <div className="neu-panel p-6 sm:p-8 space-y-6 text-center">
          {/* Logo / Badge Header */}
          <div className="flex flex-col items-center space-y-3">
            <MinimalAppIcon size="lg" />

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 mb-1">
                AEON DWS Roster System
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Quản Lý Phân Quầy
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Quản lý ca làm việc, điều phối quầy thu ngân & đồng bộ dữ liệu đám mây
              </p>
            </div>
          </div>

          {/* Offline Warning Banner if disconnected */}
          {!syncStatus.isOnline && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left flex items-start gap-3 text-xs text-amber-800">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Mất kết nối Internet:</strong> Bạn cần kết nối mạng để xác thực tài khoản Google lần đầu.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-left flex items-start gap-3 text-xs text-rose-800 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <strong className="font-bold">Đăng nhập thất bại:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Google Sign In Action Area */}
          <div className="space-y-4 pt-1">
            <button
              type="button"
              id="btn-google-sign-in"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || syncStatus.isSyncing}
              className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold text-sm sm:text-base border-2 border-slate-200/90 shadow-sm hover:border-teal-500 hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isSubmitting || syncStatus.isSyncing ? (
                <>
                  <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-teal-800">Đang kết nối Google...</span>
                </>
              ) : (
                <>
                  {/* Official Google SVG Icon */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="group-hover:text-teal-900 transition-colors">
                    Đăng nhập bằng Google
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all ml-auto" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
              <Lock className="w-3.5 h-3.5 text-teal-600" />
              <span>Xác thực an toàn qua Firebase Google Auth & Firestore</span>
            </div>
          </div>

          {/* Key System Features Highlight */}
          <div className="pt-4 border-t border-slate-100 text-left space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Tính năng nổi bật
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Cloud className="w-3 h-3" />
                </div>
                <div>
                  <strong className="text-slate-800 font-semibold">Tự động đồng bộ Đám mây:</strong> Dữ liệu ca, quầy và lịch làm việc được lưu trữ tức thì và phân quyền riêng tư theo Google UID.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Laptop className="w-3 h-3" />
                </div>
                <div>
                  <strong className="text-slate-800 font-semibold">Làm việc đa thiết bị:</strong> Mở lịch phân quầy trên máy tính cơ quan, máy tính cá nhân hoặc máy tính bảng không lo mất file.
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                </div>
                <div>
                  <strong className="text-slate-800 font-semibold">Bảo mật Firebase Rules:</strong> Mỗi tài khoản chỉ có thể đọc và ghi dữ liệu của chính mình.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <p>© AEON Vietnam - Cashier Scheduling & DWS Daily Work Sheet</p>
        </div>
      </div>
    </div>
  );
};
