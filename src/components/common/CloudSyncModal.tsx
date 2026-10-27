import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import {
  storageService,
  BackupFileSummary,
  BackupMergeResult,
  AssignmentConflictStrategy,
} from '../../services/storageService';
import { useToast } from './ToastContainer';
import {
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Laptop,
  Check,
  Calendar,
  Users,
  Layers,
  FileJson,
  Sparkles,
  ArrowRight,
  GitMerge,
  RefreshCw,
  PlusCircle,
  FileCheck,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

interface ParsedBackupItem {
  fileName: string;
  fileSize: number;
  data: any;
  summary: BackupFileSummary;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const { success, error, info } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stats of current local data
  const [stats, setStats] = useState({
    shiftsCount: 0,
    countersCount: 0,
    employeesCount: 0,
    schedulesCount: 0,
    assignmentsCount: 0,
    assignmentDates: [] as string[],
  });

  const [lastExportTime, setLastExportTime] = useState<string | null>(() => {
    return localStorage.getItem('dws_last_json_export_time');
  });

  const [lastImportTime, setLastImportTime] = useState<string | null>(() => {
    return localStorage.getItem('dws_last_json_import_time');
  });

  // Staging for imported files (before confirmation)
  const [pendingFiles, setPendingFiles] = useState<ParsedBackupItem[] | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [conflictStrategy, setConflictStrategy] =
    useState<AssignmentConflictStrategy>('smart_combine');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergeResult, setMergeResult] = useState<BackupMergeResult | null>(null);

  // Load stats whenever modal opens or resets
  const refreshStats = () => {
    const shifts = storageService.getShifts() || [];
    const counters = storageService.getCounters() || [];
    const employees = storageService.getEmployees() || [];
    const schedules = storageService.getAllWeeklySchedules() || {};
    const assignments = storageService.getAllAssignments() || {};
    const assignmentDates = Object.keys(assignments).sort();

    setStats({
      shiftsCount: shifts.length,
      countersCount: counters.length,
      employeesCount: employees.length,
      schedulesCount: Object.keys(schedules).length,
      assignmentsCount: assignmentDates.length,
      assignmentDates,
    });
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
      setPendingFiles(null);
      setMergeResult(null);
    }
  }, [isOpen]);

  // Export local database to a JSON file
  const handleExportJson = () => {
    try {
      const jsonStr = storageService.exportAllData();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `Backup_DWS_AEON_${dateStr}_${timeStr}.json`;

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const nowIso = now.toISOString();
      localStorage.setItem('dws_last_json_export_time', nowIso);
      setLastExportTime(nowIso);

      success(`Đã xuất tệp sao lưu "${fileName}" về máy tính thành công!`);
    } catch (err: any) {
      console.error('Export error:', err);
      error('Không thể xuất tệp sao lưu: ' + (err?.message || 'Lỗi không xác định'));
    }
  };

  // Select 1 or multiple JSON files
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);

    const parsedList: ParsedBackupItem[] = [];
    let filesRead = 0;
    let hasError = false;

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          if (!content || !content.trim()) {
            throw new Error(`Tệp "${file.name}" trống nội dung.`);
          }
          const data = JSON.parse(content);
          const summary = storageService.inspectBackupData(data);
          parsedList.push({
            fileName: file.name,
            fileSize: file.size,
            data,
            summary,
          });
        } catch (err: any) {
          hasError = true;
          error(`Tệp "${file.name}" không hợp lệ: ` + (err?.message || 'Lỗi định dạng JSON'));
        } finally {
          filesRead++;
          if (filesRead === files.length) {
            if (parsedList.length > 0) {
              setPendingFiles(parsedList);
              setMergeResult(null);
              // Default to merge mode if multiple files or local has data
              setRestoreMode('merge');
              if (parsedList.length > 1) {
                info(
                  `Đã chọn ${parsedList.length} tệp sao lưu. Bạn có thể gộp tất cả thành 1 bản đầy đủ duy nhất!`
                );
              }
            }
          }
        }
      };
      reader.readAsText(file);
    });

    e.target.value = '';
  };

  // Perform Merge or Overwrite
  const handleExecuteRestore = () => {
    if (!pendingFiles || pendingFiles.length === 0) return;

    setIsProcessing(true);
    try {
      const datas = pendingFiles.map((p) => p.data);
      const res = storageService.mergeMultipleBackupData(datas, {
        mode: restoreMode,
        assignmentStrategy: conflictStrategy,
      });

      if (res.success) {
        const nowIso = new Date().toISOString();
        localStorage.setItem('dws_last_json_import_time', nowIso);
        setLastImportTime(nowIso);
        refreshStats();
        setMergeResult(res);

        if (restoreMode === 'merge') {
          const detailMsg = [];
          if (res.addedDates.length > 0) detailMsg.push(`+${res.addedDates.length} ngày mới`);
          if (res.mergedDates.length > 0) detailMsg.push(`gộp ${res.mergedDates.length} ngày trùng`);
          success(
            `Bổ sung dữ liệu thành công! (${detailMsg.join(', ') || 'Đã hợp nhất danh mục'})`
          );
        } else {
          success(
            `Khôi phục toàn bộ dữ liệu thành công! Tổng cộng ${res.totalAssignmentsCount} ngày phân quầy.`
          );
        }

        if (onDataRestored) {
          onDataRestored();
        }
      } else {
        error(res.error || 'Khôi phục dữ liệu không thành công.');
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      error('Lỗi khi khôi phục dữ liệu: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateDisplay = (isoString: string | null) => {
    if (!isoString) return 'Chưa thực hiện';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return isoString;
    }
  };

  // Format YYYY-MM-DD to DD/MM/YYYY
  const formatVietDate = (dStr: string) => {
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // Compute union of dates across all pending files
  const pendingDatesUnion: string[] = Array.from<string>(
    new Set((pendingFiles || []).flatMap((p) => p.summary.assignmentsDates))
  ).sort();

  // Dates that will be newly added (not currently in local database)
  const newlyAddedDates: string[] = pendingDatesUnion.filter(
    (d: string) => !stats.assignmentDates.includes(d)
  );

  // Dates that collide with local database
  const overlappingDates: string[] = pendingDatesUnion.filter((d: string) =>
    stats.assignmentDates.includes(d)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 shadow-2xs">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Sao lưu & Khôi phục Dữ liệu (Offline JSON)
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              Lưu trữ an toàn 100% trên máy tính · Hỗ trợ Bổ sung & Ghép nhiều tệp sao lưu
            </p>
          </div>
        </div>
      }
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* === CASE 1: PREVIEW & RESTORE STAGING (Khi người dùng đã chọn tệp) === */}
        {pendingFiles && pendingFiles.length > 0 ? (
          <div className="space-y-4">
            {/* Top alert banner for staging */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-teal-50 to-emerald-50 border border-teal-200 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <GitMerge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Đã chọn {pendingFiles.length} tệp sao lưu để khôi phục
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Bạn có thể chọn <strong>"Bổ sung & Ghép dữ liệu"</strong> để gộp các ngày từ cả hai tệp (ví dụ ngày 01/11 và 02/11) mà không làm mất thông tin đã phân quầy.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPendingFiles(null);
                    setMergeResult(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded-lg hover:bg-white/80 border border-transparent hover:border-slate-200 cursor-pointer transition-colors shrink-0"
                >
                  Chọn lại tệp khác
                </button>
              </div>

              {/* List of selected files preview */}
              <div className="mt-3 pt-3 border-t border-teal-200/70 space-y-2">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Chi tiết các tệp được chọn:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pendingFiles.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 truncate">
                        <FileJson className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate" title={p.fileName}>
                          {p.fileName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{p.summary.shiftsCount} ca</span>
                        <span>·</span>
                        <span>{p.summary.countersCount} quầy</span>
                        <span>·</span>
                        <span>{p.summary.employeesCount} NV</span>
                        <span>·</span>
                        <span className="font-semibold text-teal-800">
                          {p.summary.assignmentsDates.length} ngày phân quầy
                        </span>
                      </div>
                      {p.summary.assignmentsDates.length > 0 && (
                        <div className="pt-1 text-[11px] text-slate-600 flex flex-wrap gap-1">
                          <span className="text-slate-400">Các ngày:</span>
                          {p.summary.assignmentsDates.slice(0, 5).map((d) => (
                            <span
                              key={d}
                              className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                            >
                              {formatVietDate(d)}
                            </span>
                          ))}
                          {p.summary.assignmentsDates.length > 5 && (
                            <span className="text-[10px] text-slate-400">
                              +{p.summary.assignmentsDates.length - 5} ngày khác
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Impact Analysis Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-700 flex items-center justify-between">
                <span>Phân tích dữ liệu ngày phân quầy:</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Hiện trên máy có: <strong>{stats.assignmentsCount} ngày</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {newlyAddedDates.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Bổ sung thêm <strong>{newlyAddedDates.length} ngày mới</strong> chưa có trên máy (
                      {newlyAddedDates.map((d) => formatVietDate(d)).join(', ')})
                    </span>
                  </div>
                )}

                {overlappingDates.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                    <GitMerge className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Có <strong>{overlappingDates.length} ngày trùng</strong> với dữ liệu trên máy (
                      {overlappingDates.map((d) => formatVietDate(d)).join(', ')})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mode selection radio cards */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Lựa chọn phương thức khôi phục:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Bổ sung & Ghép dữ liệu */}
                <div
                  onClick={() => setRestoreMode('merge')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    restoreMode === 'merge'
                      ? 'border-teal-600 bg-teal-50/60 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            restoreMode === 'merge'
                              ? 'border-teal-600 bg-teal-600'
                              : 'border-slate-300'
                          }`}
                        >
                          {restoreMode === 'merge' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                          Bổ sung & Ghép dữ liệu (Merge)
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                        Khuyên dùng
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pl-6">
                      Giữ nguyên dữ liệu hiện có trên máy, bổ sung các ngày mới. Với ngày trùng (như 01/11), hệ thống sẽ gộp phân quầy thông minh mà không làm mất thông tin.
                    </p>
                  </div>

                  {restoreMode === 'merge' && overlappingDates.length > 0 && (
                    <div
                      className="mt-2 pt-2 border-t border-teal-200/80 space-y-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-[11px] font-bold text-teal-950 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-teal-600" />
                        <span>Cách xử lý khi ngày bị trùng:</span>
                      </label>
                      <select
                        value={conflictStrategy}
                        onChange={(e) =>
                          setConflictStrategy(e.target.value as AssignmentConflictStrategy)
                        }
                        className="w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border border-teal-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value="smart_combine">
                          Gộp thông minh: Giữ các quầy đã xếp, điền thêm quầy còn trống
                        </option>
                        <option value="prefer_more_complete">
                          Tự động chọn bản đầy đủ hơn (Bản có nhiều phân quầy hơn)
                        </option>
                        <option value="prefer_backup">
                          Ưu tiên bản trong tệp sao lưu mới (Ghi đè ngày trùng)
                        </option>
                        <option value="prefer_current">
                          Chỉ lấy ngày mới, giữ nguyên ngày trùng trên máy
                        </option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Option 2: Ghi đè toàn bộ */}
                <div
                  onClick={() => setRestoreMode('overwrite')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    restoreMode === 'overwrite'
                      ? 'border-rose-500 bg-rose-50/60 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            restoreMode === 'overwrite'
                              ? 'border-rose-600 bg-rose-600'
                              : 'border-slate-300'
                          }`}
                        >
                          {restoreMode === 'overwrite' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                          Ghi đè toàn bộ (Thay thế)
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Cẩn trọng
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pl-6">
                      Xóa và thay thế hoàn toàn dữ liệu trên máy tính bằng tệp sao lưu được chọn. Dữ liệu ngày khác trên máy không có trong tệp sẽ bị xóa.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Post-execution result notice if already restored */}
            {mergeResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Khôi phục thành công! Hiện tại có {mergeResult.totalAssignmentsCount} ngày phân quầy.
                  </span>
                </div>
                <div className="text-xs text-emerald-800 space-y-0.5 pl-6">
                  {mergeResult.addedDates.length > 0 && (
                    <p>
                      • Đã thêm mới các ngày:{' '}
                      <strong>{mergeResult.addedDates.map(formatVietDate).join(', ')}</strong>
                    </p>
                  )}
                  {mergeResult.mergedDates.length > 0 && (
                    <p>
                      • Đã gộp và điền thêm phân quầy cho các ngày:{' '}
                      <strong>{mergeResult.mergedDates.map(formatVietDate).join(', ')}</strong>
                    </p>
                  )}
                  {mergeResult.updatedDates.length > 0 && (
                    <p>
                      • Đã cập nhật lại các ngày:{' '}
                      <strong>{mergeResult.updatedDates.map(formatVietDate).join(', ')}</strong>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-700">
                    Bạn có thể tải ngay tệp sao lưu gộp hoàn chỉnh này về máy:
                  </span>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-2xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải tệp sao lưu đã gộp (.json)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPendingFiles(null);
                  setMergeResult(null);
                }}
                disabled={isProcessing}
                className="neu-button-secondary px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                Quay lại
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={isProcessing}
                  className={`neu-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg text-white shadow-xs cursor-pointer transition-colors disabled:opacity-50 ${
                    restoreMode === 'merge'
                      ? 'bg-teal-700 hover:bg-teal-800'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : restoreMode === 'merge' ? (
                    <GitMerge className="w-3.5 h-3.5" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isProcessing
                      ? 'Đang xử lý dữ liệu...'
                      : restoreMode === 'merge'
                      ? 'Thực hiện Bổ sung & Ghép dữ liệu'
                      : 'Thực hiện Ghi đè toàn bộ'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="neu-button-secondary px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* === CASE 2: DEFAULT OVERVIEW (Tải sao lưu & Chọn tệp khôi phục) === */
          <>
            {/* Header summary banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border border-teal-200/80">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Lưu trữ Ngoại tuyến An toàn (Offline Mode)
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Check className="w-3 h-3" /> An toàn 100%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Toàn bộ dữ liệu được lưu trữ an toàn ngay trên máy tính này. Bạn có thể xuất tệp sao lưu (.json) về máy để dự phòng, chuyển sang máy tính khác, hoặc <strong>chọn cùng lúc nhiều file backup</strong> để hệ thống tự động bổ sung và ghép thành 1 bản duy nhất hoàn chỉnh.
                  </p>
                </div>
              </div>

              {/* Current Local Database Summary */}
              <div className="mt-4 pt-3 border-t border-teal-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-white/80 border border-teal-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-teal-600" />
                    <span>Ca làm việc</span>
                  </div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {stats.shiftsCount}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white/80 border border-teal-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                    <Layers className="w-3 h-3 text-teal-600" />
                    <span>Quầy thu ngân</span>
                  </div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {stats.countersCount}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white/80 border border-teal-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                    <Users className="w-3 h-3 text-teal-600" />
                    <span>Nhân viên</span>
                  </div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {stats.employeesCount}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white/80 border border-teal-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3 text-teal-600" />
                    <span>Ngày phân quầy</span>
                  </div>
                  <div className="text-base font-black text-emerald-700 mt-0.5">
                    {stats.assignmentsCount}
                  </div>
                </div>
              </div>
            </div>

            {/* 2 Main Action Cards: Export & Import */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Export JSON */}
              <div className="p-5 rounded-2xl bg-white border-2 border-teal-200/90 shadow-sm flex flex-col justify-between gap-4 hover:border-teal-400 transition-all">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shadow-2xs">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    1. Tải tệp sao lưu về máy (.json)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Đóng gói toàn bộ ca, quầy, nhân viên, lịch tuần và mọi ngày phân bổ DWS thành 1 tệp tin JSON an toàn.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    id="btn-modal-export-json"
                    onClick={handleExportJson}
                    className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải tệp sao lưu (.json)</span>
                  </button>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Xuất lần cuối:</span>
                    <span className="font-semibold text-slate-600">
                      {formatDateDisplay(lastExportTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Import & Merge JSON */}
              <div className="p-5 rounded-2xl bg-white border-2 border-blue-200/90 shadow-sm flex flex-col justify-between gap-4 hover:border-blue-400 transition-all">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      2. Khôi phục & Bổ sung dữ liệu
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Có ghép file
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nạp 1 hoặc <strong>chọn nhiều file backup cùng lúc</strong>. Cho phép chọn chế độ <strong>"Bổ sung dữ liệu"</strong> để ghép đầy đủ các ngày từ cả 2 file.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    id="btn-modal-import-json"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Chọn tệp sao lưu (.json)</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Khôi phục lần cuối:</span>
                    <span className="font-semibold text-slate-600">
                      {formatDateDisplay(lastImportTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guide for Merging 2 Backup Files (Hướng dẫn ghép 2 file sao lưu) */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cách đơn giản nhất để lấy đầy đủ dữ liệu từ 2 file backup:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="p-3 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] flex items-center justify-center font-black">
                      1
                    </span>
                    <span>Chọn cả 2 file</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Bấm <strong>"Chọn tệp sao lưu (.json)"</strong>, giữ phím <code className="px-1 py-0.5 rounded bg-slate-100 font-mono font-bold">Ctrl</code> để chọn cùng lúc cả 2 tệp.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-teal-900">
                    <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[11px] flex items-center justify-center font-black">
                      2
                    </span>
                    <span>Chọn "Bổ sung dữ liệu"</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Chọn chế độ <strong>"Bổ sung & Ghép dữ liệu"</strong>, hệ thống sẽ tự động ghép ngày 01/11 và ngày 02/11 đầy đủ 100%.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[11px] flex items-center justify-center font-black">
                      3
                    </span>
                    <span>Xuất 1 file duy nhất</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Bấm nút <strong>"Tải tệp sao lưu (.json)"</strong> để lưu lại 1 tệp hoàn chỉnh duy nhất chứa trọn vẹn cả 2 ngày.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
