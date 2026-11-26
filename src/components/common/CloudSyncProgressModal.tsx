import React, { useEffect, useState, useRef } from 'react';
import {
  DetailedSyncProgress,
  SyncStepDetail,
} from '../../services/firebaseService';
import { CloudDataFlowHero } from './CloudDataFlowHero';
import {
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
  Archive,
  X,
  Minimize2,
} from 'lucide-react';

interface CloudSyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  progress: DetailedSyncProgress | null;
  onRetry?: () => void;
}

export const CloudSyncProgressModal: React.FC<CloudSyncProgressModalProps> = ({
  isOpen,
  onClose,
  onMinimize,
  progress,
  onRetry,
}) => {
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef<boolean>(false);

  // Auto-scroll the active sync row into view smoothly
  useEffect(() => {
    if (!isOpen || isUserScrollingRef.current) return;

    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [isOpen, progress?.currentStepKey]);

  // Detect user manual scroll to avoid abruptly hijacking user inspection
  const handleScroll = () => {
    isUserScrollingRef.current = true;
    // Reset after 3 seconds of scroll inactivity
    const timeout = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 3000);
    return () => clearTimeout(timeout);
  };

  // Auto-close countdown when sync completes successfully (4s to allow celebration sequence)
  useEffect(() => {
    if (!isOpen || !progress) {
      setAutoCloseCountdown(null);
      return;
    }

    if (progress.overallStatus === 'completed') {
      setAutoCloseCountdown(4);

      const interval = setInterval(() => {
        setAutoCloseCountdown((prev) => {
          if (prev !== null && prev > 1) {
            return prev - 1;
          }
          return 0;
        });
      }, 1000);

      const timeout = setTimeout(() => {
        onClose();
      }, 4200);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else {
      setAutoCloseCountdown(null);
    }
  }, [isOpen, progress?.overallStatus, onClose]);

  // Handle ESC key to dismiss / minimize
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onMinimize) {
          onMinimize();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onMinimize]);

  if (!isOpen) return null;

  const isCompleted = progress?.overallStatus === 'completed';
  const isError = progress?.overallStatus === 'error';
  const isSyncing = progress?.overallStatus === 'syncing' || !progress?.overallStatus;
  const percent = Math.min(100, Math.max(0, progress?.percent ?? 0));

  // Category Icon Resolver
  const getStepIcon = (key: string) => {
    switch (key) {
      case 'shifts_counters':
        return <Grid className="w-4 h-4 text-sky-500" />;
      case 'employees':
        return <Users className="w-4 h-4 text-teal-500" />;
      case 'schedules':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'assignments':
        return <Layers className="w-4 h-4 text-cyan-600" />;
      case 'manifest':
        return <Archive className="w-4 h-4 text-emerald-500" />;
      case 'auth':
      default:
        return <ShieldCheck className="w-4 h-4 text-pink-500" />;
    }
  };

  const steps: SyncStepDetail[] = progress?.steps || [];
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const totalCount = steps.length || 6;

  const handleMinimizeAction = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-sync-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Liquid Glass Modal Container */}
      <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(2,132,199,0.3)] border border-white/80 overflow-hidden transform transition-all duration-300 max-h-[92vh] flex flex-col">
        
        {/* Top Rainbow/Progress Accent Bar */}
        <div
          className={`h-2 w-full transition-all duration-700 shrink-0 ${
            isCompleted
              ? 'bg-gradient-to-r from-[#00C9A7] via-emerald-400 to-[#398BFF]'
              : isError
              ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600'
              : 'bg-gradient-to-r from-pink-400 via-[#00C9A7] to-[#398BFF] bg-[length:200%_auto] animate-pulse'
          }`}
        />

        {/* Ambient Sheen Glows */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-gradient-to-br from-pink-400/10 to-[#398BFF]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-gradient-to-tr from-[#398BFF]/10 to-[#00C9A7]/10 blur-3xl pointer-events-none" />

        {/* Modal Header & Quick Controls */}
        <div className="relative p-5 sm:p-6 pb-2 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="cloud-sync-title"
                className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2"
              >
                <span>
                  {isCompleted
                    ? 'Đồng bộ hoàn tất!'
                    : isError
                    ? 'Đồng bộ gặp sự cố'
                    : 'Người vận chuyển dữ liệu lên Đám mây'}
                </span>
                {isCompleted && (
                  <Sparkles className="w-5 h-5 text-emerald-500 animate-spin-slow" />
                )}
              </h2>

              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isCompleted ? (
                  <span className="text-emerald-700 font-semibold">
                    Dữ liệu của bạn đã được lưu trữ an toàn trên Cloud Firestore.
                  </span>
                ) : isError ? (
                  <span className="text-rose-600 font-medium">
                    {progress?.errorMessage || 'Có lỗi xảy ra trong quá trình ghi dữ liệu lên Firestore'}
                  </span>
                ) : (
                  <span>Đang vận chuyển các kiện dữ liệu lên Google Cloud Firestore...</span>
                )}
              </p>
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isSyncing && (
                <button
                  type="button"
                  onClick={handleMinimizeAction}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs hover:scale-102"
                  title="Ẩn xuống góc màn hình để tiếp tục làm việc"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Ẩn trong nền</span>
                </button>
              )}
              {(isError || isCompleted) && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
                  title="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Hero Animation: Cloud Data Flow */}
          <div className="mt-3 mb-2">
            <CloudDataFlowHero
              progress={percent}
              status={progress?.overallStatus || 'syncing'}
              errorMessage={progress?.errorMessage}
            />
          </div>

          {/* Progress Percent & Master Progress Bar */}
          <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 flex items-center gap-1.5 truncate">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isError ? (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
                )}
                <span className="truncate">
                  {isCompleted
                    ? `Hoàn tất toàn bộ ${totalCount}/${totalCount} kiện dữ liệu`
                    : isError
                    ? 'Tiến trình tạm dừng ở mức an toàn'
                    : progress?.currentStepLabel || `Đang vận chuyển ${completedCount}/${totalCount} kiện dữ liệu...`}
                </span>
              </span>

              {/* Real Firestore percentage */}
              <span
                className={`font-mono text-sm sm:text-base font-black tracking-tight shrink-0 transition-colors duration-300 ${
                  isCompleted
                    ? 'text-emerald-600'
                    : isError
                    ? 'text-rose-600'
                    : 'text-sky-600'
                }`}
              >
                {percent}%
              </span>
            </div>

            {/* Overall Progress Bar */}
            <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5 border border-slate-300/40">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isCompleted
                    ? 'bg-gradient-to-r from-[#00C9A7] to-emerald-500 shadow-xs'
                    : isError
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                    : 'bg-gradient-to-r from-pink-400 via-[#00C9A7] to-[#398BFF] shadow-xs'
                }`}
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Sync Queue List Header */}
        <div className="px-5 sm:px-6 pt-1 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          <span>Danh sách kiện dữ liệu ({completedCount}/{totalCount})</span>
          <span>Trạng thái</span>
        </div>

        {/* Auto-scrolling Sync Queue List */}
        <div
          ref={listContainerRef}
          onScroll={handleScroll}
          className="px-5 sm:px-6 py-1 overflow-y-auto space-y-2 flex-1 scroll-smooth"
        >
          {steps.map((step) => {
            const isItemDone = step.status === 'completed';
            const isItemSyncing = step.status === 'syncing';
            const isItemError = step.status === 'error';
            const isItemPending = step.status === 'pending';

            return (
              <div
                key={step.key}
                ref={isItemSyncing ? activeItemRef : null}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                  isItemDone
                    ? 'bg-emerald-50/50 border-emerald-200/70 shadow-2xs'
                    : isItemSyncing
                    ? 'bg-sky-50/90 border-sky-400 ring-2 ring-sky-400/25 shadow-md translate-x-0.5'
                    : isItemError
                    ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-100'
                    : 'bg-slate-50/50 border-slate-200/60 opacity-75'
                }`}
              >
                {/* Left: Icon & Description */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isItemDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : isItemSyncing
                        ? 'bg-sky-100 text-sky-700'
                        : isItemError
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-white text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isItemDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-in zoom-in-75 duration-200" />
                    ) : isItemSyncing ? (
                      <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
                    ) : isItemError ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      getStepIcon(step.key)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 leading-snug truncate flex items-center gap-1.5">
                      <span>{step.label}</span>
                      {step.itemsCount !== undefined && step.itemsCount > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                          ({step.itemsCount})
                        </span>
                      )}
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

                {/* Right: Trạng thái từng nhóm */}
                <div className="shrink-0">
                  {isItemDone && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-2xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Đã giao xong</span>
                    </span>
                  )}
                  {isItemSyncing && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                      <span>Đang vận chuyển...</span>
                    </span>
                  )}
                  {isItemPending && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Chờ tới lượt</span>
                    </span>
                  )}
                  {isItemError && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      <span>Gặp sự cố</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Bottom Toolbar */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100/80 bg-slate-50/80 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          {isCompleted ? (
            <div className="w-full flex items-center justify-between gap-3">
              <div className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Đồng bộ thành công! {autoCloseCountdown !== null ? `Tự đóng sau ${autoCloseCountdown}s...` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                Đóng ngay
              </button>
            </div>
          ) : isError ? (
            <div className="w-full flex items-center justify-between gap-2">
              <span className="text-xs text-rose-700 font-medium truncate">
                Đồng bộ chưa hoàn tất
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold cursor-pointer transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Thử lại ngay</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-sky-500 animate-spin" />
                <span className="hidden sm:inline">Vui lòng không tắt trình duyệt khi đang đồng bộ</span>
                <span className="sm:hidden">Đang ghi Cloud Firestore...</span>
              </span>

              {/* Hide to background button */}
              <button
                type="button"
                onClick={handleMinimizeAction}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-bold bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs cursor-pointer transition-all active:scale-95"
              >
                <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Ẩn trong nền</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
