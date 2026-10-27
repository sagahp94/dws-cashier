import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import {
  firebaseService,
  SyncComparisonResult,
  SyncHistoryEntry,
  formatSyncDateTime,
} from '../../services/firebaseService';
import { useToast } from './ToastContainer';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Clock,
  Laptop,
  Check,
  AlertTriangle,
  History,
  Database,
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

interface SyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
  onTriggerFullSync?: () => void;
}

export const SyncHistoryModal: React.FC<SyncHistoryModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
  onTriggerFullSync,
}) => {
  const { success, error: showError, info } = useToast();
  const [isComparing, setIsComparing] = useState(false);
  const [comparison, setComparison] = useState<SyncComparisonResult | null>(null);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionStep, setActionStep] = useState<string>('');

  const status = firebaseService.getStatus();
  const user = status.user;

  // Run comparison and fetch history
  const runComparison = useCallback(async () => {
    setIsComparing(true);
    try {
      const result = await firebaseService.compareLocalWithCloud();
      setComparison(result);
      setHistory(firebaseService.getSyncHistory());
    } catch (err: any) {
      console.error('Failed to run sync comparison:', err);
      showError('Không thể đối chiếu dữ liệu: ' + (err?.message || 'Lỗi mạng'));
    } finally {
      setIsComparing(false);
    }
  }, [showError]);

  useEffect(() => {
    if (isOpen) {
      runComparison();
    }
  }, [isOpen, runComparison]);

  // Re-run comparison automatically when background/full sync completes
  useEffect(() => {
    if (!isOpen) return;
    const unsub = firebaseService.subscribe((s) => {
      if (!s.isSyncing) {
        runComparison();
      }
    });
    return () => unsub();
  }, [isOpen, runComparison]);

  // Handle manual sync to cloud
  const handleSyncToCloud = async () => {
    if (onTriggerFullSync) {
      onTriggerFullSync();
      return;
    }

    setIsActionLoading(true);
    setActionStep('Đang đẩy dữ liệu lên Google Firestore...');
    try {
      const res = await firebaseService.syncToCloud(true, (_percent, stepText) => {
        setActionStep(stepText);
      });
      if (res.success) {
        success('Đã đồng bộ toàn bộ dữ liệu lên Đám mây thành công!');
        await runComparison();
        onDataChanged?.();
      } else {
        showError(res.error || 'Đồng bộ thất bại.');
      }
    } catch (err: any) {
      showError('Lỗi đồng bộ: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsActionLoading(false);
      setActionStep('');
    }
  };

  // Handle manual pull from cloud
  const handlePullFromCloud = async () => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn tải bản lưu từ Đám mây về ghi đè dữ liệu trên máy tính này không?'
      )
    ) {
      return;
    }

    setIsActionLoading(true);
    setActionStep('Đang tải bản lưu từ Google Firestore...');
    try {
      const res = await firebaseService.pullFromCloud((_percent, stepText) => {
        setActionStep(stepText);
      });
      if (res.success) {
        success('Tải dữ liệu từ Đám mây về máy thành công!');
        await runComparison();
        onDataChanged?.();
      } else {
        showError(res.error || 'Tải dữ liệu thất bại.');
      }
    } catch (err: any) {
      showError('Lỗi tải dữ liệu: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsActionLoading(false);
      setActionStep('');
    }
  };

  const handleClearHistory = (onlyFailed: boolean) => {
    if (onlyFailed) {
      firebaseService.clearFailedSyncHistory();
      setHistory(firebaseService.getSyncHistory());
      info('Đã dọn dẹp các bản ghi đồng bộ thất bại');
    } else {
      if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đồng bộ trên thiết bị này không?')) {
        firebaseService.clearSyncHistory();
        setHistory([]);
        info('Đã xóa toàn bộ lịch sử đồng bộ');
      }
    }
  };

  const failedCount = history.filter((h) => h.status === 'error').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 shadow-xs">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Lịch sử & Đối chiếu đồng bộ
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              Kiểm tra tính trùng khớp giữa dữ liệu trên máy tính và Google Cloud Firestore
            </p>
          </div>
        </div>
      }
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Quota Exceeded Alert Banner */}
        {status.isQuotaExceeded && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <div className="font-bold text-amber-950">
                Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn (20.000 lượt ghi/ngày)
              </div>
              <p className="mt-1 text-amber-800">
                Dữ liệu trên máy tính của bạn vẫn được lưu giữ an toàn tuyệt đối 100%. Tính năng đẩy dữ liệu lên đám mây tạm thời chuyển sang chế độ ngoại tuyến và sẽ tự động được làm mới vào ngày mai.
              </p>
            </div>
          </div>
        )}

        {/* === 1. TOP STATUS NOTIFICATION BANNER === */}
        {isComparing ? (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-5 h-5 text-teal-600 animate-spin shrink-0" />
            <div className="text-xs text-slate-600 font-medium">
              Đang kết nối và so sánh dữ liệu hiện tại với bản lưu trên Đám mây...
            </div>
          </div>
        ) : comparison ? (
          comparison.isMatch ? (
            /* Match state: Đầy đủ và trùng khớp thông tin */
            <div className="p-4 sm:p-5 rounded-xl border-2 border-emerald-300 bg-emerald-50/80 shadow-xs space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Đầy đủ và trùng khớp thông tin
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-950 mt-0.5">
                    Đã đồng bộ đầy đủ thông tin
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Dữ liệu danh mục ca, quầy thu ngân, nhân sự và lịch phân quầy trên máy tính hoàn
                    toàn trùng khớp với bản lưu trữ đám mây an toàn.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-emerald-200/60 text-xs text-emerald-900 font-medium">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    Thời gian đồng bộ cuối: <strong>{comparison.lastSyncedFormatted}</strong>
                  </span>
                </span>
                {comparison.cloudDeviceName && (
                  <span className="flex items-center gap-1.5 text-emerald-800/80">
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Thiết bị: {comparison.cloudDeviceName}</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Mismatch state: Bản lưu trên đám mây chưa có thông tin trên máy */
            <div className="p-4 sm:p-5 rounded-xl border-2 border-amber-400 bg-amber-50/90 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Bản lưu trên đám mây chưa có thông tin trên máy
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-950 mt-0.5 leading-snug">
                    Thông tin trên máy chưa được đồng bộ lên đám mây. Thời gian đồng bộ cuối{' '}
                    <span className="underline decoration-amber-500 underline-offset-2">
                      {comparison.lastSyncedFormatted}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 mt-1.5 leading-relaxed">
                    Máy tính của bạn đang có thông tin mới hơn hoặc chưa được cập nhật lên đám mây.
                    {status.isQuotaExceeded
                      ? ' Hạn mức ghi Cloud Firestore miễn phí hôm nay đã đầy, dữ liệu máy an toàn và quota sẽ tự động reset ngày mai.'
                      : ' Vui lòng bấm nút bên dưới để đẩy thông tin lên đám mây ngay.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-amber-200/80">
                <span className="text-xs text-amber-900 font-medium">
                  Thời gian đồng bộ cuối: <strong>{comparison.lastSyncedFormatted}</strong>
                </span>

                <button
                  type="button"
                  onClick={handleSyncToCloud}
                  disabled={isActionLoading || status.isQuotaExceeded}
                  title={
                    status.isQuotaExceeded
                      ? 'Hạn mức ghi Cloud Firestore hôm nay đã đạt giới hạn - Quota tự động reset vào ngày mai'
                      : undefined
                  }
                  className="neu-button-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer bg-teal-700 text-white hover:bg-teal-800 shadow-xs transition-colors disabled:opacity-50"
                >
                  <UploadCloud
                    className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-bounce' : ''}`}
                  />
                  <span>
                    {isActionLoading
                      ? actionStep || 'Đang đồng bộ...'
                      : status.isQuotaExceeded
                      ? 'Hạn mức đám mây tạm đầy'
                      : 'Đồng bộ lên Đám mây ngay'}
                  </span>
                </button>
              </div>
            </div>
          )
        ) : null}

        {/* === 2. DETAILED DATA COMPARISON TABLE === */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>Đối chiếu chi tiết dữ liệu hiện tại</span>
            </h3>
            <button
              type="button"
              onClick={runComparison}
              disabled={isComparing || isActionLoading}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isComparing ? 'animate-spin' : ''}`} />
              <span>Đối chiếu lại</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">Hạng mục dữ liệu</th>
                  <th className="py-2.5 px-3 text-center">Trên máy tính</th>
                  <th className="py-2.5 px-3 text-center">Trên đám mây</th>
                  <th className="py-2.5 px-3 text-right">Trạng thái đối chiếu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {/* Shifts */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3.5 text-slate-800">
                    <div className="font-semibold">Danh mục ca làm việc (Shifts)</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      Mã ca, giờ bắt đầu/kết thúc
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900 tabular-nums">
                    {comparison?.localSummary.shifts ?? 0} ca
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                    {comparison?.cloudSummary ? `${comparison.cloudSummary.shifts} ca` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {comparison?.differences.shifts.match ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>Trùng khớp</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Chưa đồng bộ</span>
                      </span>
                    )}
                  </td>
                </tr>

                {/* Counters */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3.5 text-slate-800">
                    <div className="font-semibold">Danh mục quầy thu ngân (Counters)</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      Cấu hình quầy, khu vực, nhóm ưu tiên
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900 tabular-nums">
                    {comparison?.localSummary.counters ?? 0} quầy
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                    {comparison?.cloudSummary ? `${comparison.cloudSummary.counters} quầy` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {comparison?.differences.counters.match ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>Trùng khớp</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Chưa đồng bộ</span>
                      </span>
                    )}
                  </td>
                </tr>

                {/* Employees */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3.5 text-slate-800">
                    <div className="font-semibold">Danh sách nhân viên (Employees)</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      Họ tên, mã NV, phân loại kỹ năng
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900 tabular-nums">
                    {comparison?.localSummary.employees ?? 0} người
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                    {comparison?.cloudSummary ? `${comparison.cloudSummary.employees} người` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {comparison?.differences.employees.match ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>Trùng khớp</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Chưa đồng bộ</span>
                      </span>
                    )}
                  </td>
                </tr>

                {/* Schedules */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3.5 text-slate-800">
                    <div className="font-semibold">Lịch phân công tuần (Schedules)</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      Các tuần làm việc đã nạp vào hệ thống
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900 tabular-nums">
                    {comparison?.localSummary.schedules ?? 0} tuần
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                    {comparison?.cloudSummary ? `${comparison.cloudSummary.schedules} tuần` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {comparison?.differences.schedules.match ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>Trùng khớp</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Chưa đồng bộ</span>
                      </span>
                    )}
                  </td>
                </tr>

                {/* Assignments */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3.5 text-slate-800">
                    <div className="font-semibold">Bảng phân quầy DWS (Assignments)</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      Dữ liệu sắp xếp quầy theo ngày
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900 tabular-nums">
                    {comparison?.localSummary.assignments ?? 0} ngày
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                    {comparison?.cloudSummary ? `${comparison.cloudSummary.assignments} ngày` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {comparison?.differences.assignments.match ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>Trùng khớp</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Chưa đồng bộ</span>
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* === 3. RECENT SYNC HISTORY LIST === */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Lịch sử đồng bộ gần nhất</span>
            </h3>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <span className="text-[11px] text-slate-400 font-mono">
                  {history.length} lần ghi nhận
                </span>
              )}
              {failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleClearHistory(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md cursor-pointer transition-colors border border-rose-200"
                  title="Dọn dẹp các bản ghi bị báo lỗi thất bại"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa {failedCount} mục lỗi</span>
                </button>
              )}
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleClearHistory(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:underline"
                  title="Xóa toàn bộ nhật ký đồng bộ trên máy"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-56 overflow-y-auto divide-y divide-slate-100 shadow-xs">
            {history.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-500">
                Chưa có lịch sử đồng bộ nào được ghi nhận trên thiết bị này.
              </div>
            ) : (
              history.map((item) => {
                const isUpload = item.type === 'upload';
                const isSuccess = item.status === 'success';

                return (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                          isSuccess
                            ? isUpload
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isSuccess ? (
                          isUpload ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                          <span>
                            {isUpload ? 'Đẩy lên đám mây (Tải lên)' : 'Tải về máy (Tải xuống)'}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-normal ${
                              item.trigger === 'auto'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-teal-50 text-teal-700 font-medium'
                            }`}
                          >
                            {item.trigger === 'auto' ? 'Tự động' : 'Thủ công'}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isSuccess ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                            }`}
                          >
                            {isSuccess ? 'Thành công' : 'Thất bại'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                          <span>{item.formattedTime}</span>
                          <span>·</span>
                          <span className="truncate">{item.deviceName}</span>
                          {item.summary && (
                            <>
                              <span>·</span>
                              <span className="text-slate-400">
                                {item.summary.shifts} ca, {item.summary.counters} quầy,{' '}
                                {item.summary.employees} NV
                              </span>
                            </>
                          )}
                        </div>
                        {item.message && !isSuccess && (
                          <div className="text-[11px] text-rose-600 font-normal mt-1 bg-rose-50/70 px-2 py-1 rounded border border-rose-100 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{item.message}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono shrink-0 hidden sm:block">
                      {isSuccess ? '✓ Hoàn tất' : '✕ Gặp lỗi'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* === 4. ACTION BUTTONS === */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncToCloud}
              disabled={isActionLoading || isComparing}
              className="neu-button-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs disabled:opacity-50"
            >
              <UploadCloud
                className={`w-3.5 h-3.5 ${isActionLoading && actionStep.includes('đẩy') ? 'animate-bounce' : ''}`}
              />
              <span>Đồng bộ lên Đám mây</span>
            </button>

            <button
              type="button"
              onClick={handlePullFromCloud}
              disabled={isActionLoading || isComparing}
              className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 shadow-xs disabled:opacity-50"
              title="Tải bản lưu mới nhất từ Firestore về máy"
            >
              <DownloadCloud
                className={`w-3.5 h-3.5 ${isActionLoading && actionStep.includes('tải') ? 'animate-bounce' : ''}`}
              />
              <span>Tải từ Đám mây về</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="neu-button-secondary px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
