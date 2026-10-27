import React, { useEffect, useState } from 'react';
import {
  DetailedSyncProgress,
  SyncStepDetail,
} from '../../services/firebaseService';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  Calendar,
  Users,
  Grid,
  Layers,
  ShieldCheck,
  X,
} from 'lucide-react';

interface CloudSyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: DetailedSyncProgress | null;
  onRetry?: () => void;
}

export const CloudSyncProgressModal: React.FC<CloudSyncProgressModalProps> = ({
  isOpen,
  onClose,
  progress,
  onRetry,
}) => {
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);

  // Auto-close countdown when sync completes successfully
  useEffect(() => {
    if (!isOpen || !progress) {
      setAutoCloseCountdown(null);
      return;
    }

    if (progress.overallStatus === 'completed') {
      setAutoCloseCountdown(2);

      const interval = setInterval(() => {
        setAutoCloseCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
      }, 1000);

      const timeout = setTimeout(() => {
        onClose();
      }, 2000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else {
      setAutoCloseCountdown(null);
    }
  }, [isOpen, progress?.overallStatus, onClose]);

  if (!isOpen) return null;

  const isCompleted = progress?.overallStatus === 'completed';
  const isError = progress?.overallStatus === 'error';
  const isSyncing = progress?.overallStatus === 'syncing' || !progress?.overallStatus;
  const percent = progress?.percent ?? 0;

  // Choose icon for each category
  const getStepIcon = (key: string) => {
    switch (key) {
      case 'auth':
        return <ShieldCheck className="w-4 h-4 text-teal-600" />;
      case 'shifts_counters':
        return <Grid className="w-4 h-4 text-blue-600" />;
      case 'employees':
        return <Users className="w-4 h-4 text-purple-600" />;
      case 'schedules':
        return <Calendar className="w-4 h-4 text-amber-600" />;
      case 'assignments':
        return <Layers className="w-4 h-4 text-emerald-600" />;
      case 'manifest':
      default:
        return <Cloud className="w-4 h-4 text-teal-600" />;
    }
  };

  const steps: SyncStepDetail[] = progress?.steps || [];
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const totalCount = steps.length || 6;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300">
        {/* Top Decorative Color Bar */}
        <div
          className={`h-1.5 w-full transition-all duration-500 ${
            isCompleted
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600'
              : isError
              ? 'bg-gradient-to-r from-rose-500 to-amber-500'
              : 'bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 animate-pulse'
          }`}
        />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors duration-300 ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50'
                    : isError
                    ? 'bg-rose-100 text-rose-700 ring-4 ring-rose-50'
                    : 'bg-teal-100 text-teal-700 ring-4 ring-teal-50'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 animate-in zoom-in duration-300" />
                ) : isError ? (
                  <AlertCircle className="w-7 h-7 text-rose-600" />
                ) : (
                  <Cloud className="w-7 h-7 text-teal-600 animate-pulse" />
                )}
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  {isCompleted
                    ? 'Đã đồng bộ đầy đủ thông tin'
                    : isError
                    ? 'Đồng bộ đám mây gặp sự cố'
                    : 'Đang đồng bộ lên Đám mây'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isCompleted
                    ? 'Bản lưu trên Google Cloud Firestore và máy tính đã trùng khớp 100%'
                    : isError
                    ? progress?.errorMessage || 'Có lỗi xảy ra trong quá trình ghi dữ liệu'
                    : progress?.currentStepLabel || 'Đang chuẩn bị gói dữ liệu Firestore...'}
                </p>
              </div>
            </div>

            {/* Close button if error or if user wants to close immediately */}
            {(isError || isCompleted) && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress Bar & Percentage */}
          <div className="mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">
                {isCompleted
                  ? `Đã hoàn tất ${totalCount}/${totalCount} mục dữ liệu`
                  : isError
                  ? 'Tiến trình tạm dừng'
                  : `Đang xử lý ${completedCount}/${totalCount} mục (${percent}%)`}
              </span>
              <span
                className={`font-mono text-sm ${
                  isCompleted
                    ? 'text-emerald-700 font-bold'
                    : isError
                    ? 'text-rose-600 font-bold'
                    : 'text-teal-700 font-bold'
                }`}
              >
                {percent}%
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isError
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-teal-500 to-cyan-500'
                }`}
                style={{ width: `${Math.max(5, percent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Detailed Item List */}
        <div className="px-5 sm:px-6 py-2 max-h-[340px] overflow-y-auto space-y-2">
          {steps.map((step) => {
            const isItemDone = step.status === 'completed';
            const isItemSyncing = step.status === 'syncing';
            const isItemError = step.status === 'error';
            const isItemPending = step.status === 'pending';

            return (
              <div
                key={step.key}
                className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                  isItemDone
                    ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs'
                    : isItemSyncing
                    ? 'bg-teal-50/80 border-teal-300 ring-2 ring-teal-100 shadow-xs'
                    : isItemError
                    ? 'bg-rose-50/80 border-rose-300'
                    : 'bg-slate-50/60 border-slate-200/70 opacity-75'
                }`}
              >
                {/* Left: Category Icon & Status Indicator */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isItemDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : isItemSyncing
                        ? 'bg-teal-100 text-teal-700'
                        : isItemError
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-white text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isItemDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-in zoom-in duration-200" />
                    ) : isItemSyncing ? (
                      <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                    ) : isItemError ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      getStepIcon(step.key)
                    )}
                  </div>

                  {/* Middle: Content Labels */}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 leading-snug flex items-center gap-1.5">
                      <span>{step.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {step.sublabel}
                    </div>
                    {step.errorMessage && (
                      <div className="text-[10px] text-rose-600 mt-0.5 line-clamp-1 font-medium">
                        {step.errorMessage}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: State Badge */}
                <div className="shrink-0">
                  {isItemDone && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-300 shadow-2xs animate-in zoom-in-50 duration-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Đã xong</span>
                    </span>
                  )}
                  {isItemSyncing && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-800 border border-teal-300 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping" />
                      <span>Đang đồng bộ...</span>
                    </span>
                  )}
                  {isItemPending && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Chờ</span>
                    </span>
                  )}
                  {isItemError && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      <span>Lỗi</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          {isCompleted ? (
            <div className="w-full flex items-center justify-between gap-3">
              <div className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Đồng bộ thành công! {autoCloseCountdown !== null ? `Tự đóng sau ${autoCloseCountdown}s...` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Đóng ngay
              </button>
            </div>
          ) : isError ? (
            <div className="w-full flex items-center justify-between gap-2">
              <span className="text-xs text-rose-700 font-medium truncate">
                Đồng bộ chưa hoàn tất
              </span>
              <div className="flex items-center gap-2">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Thử lại</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                <span>Vui lòng không tắt trình duyệt trong quá trình đồng bộ</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                Ẩn xuống nền
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
