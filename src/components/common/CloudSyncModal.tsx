import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { storageService } from '../../services/storageService';
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
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stats of current local data
  const [stats, setStats] = useState({
    shiftsCount: 0,
    countersCount: 0,
    employeesCount: 0,
    schedulesCount: 0,
    assignmentsCount: 0,
  });

  const [lastExportTime, setLastExportTime] = useState<string | null>(() => {
    return localStorage.getItem('dws_last_json_export_time');
  });

  const [lastImportTime, setLastImportTime] = useState<string | null>(() => {
    return localStorage.getItem('dws_last_json_import_time');
  });

  // Load stats whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const shifts = storageService.getShifts() || [];
      const counters = storageService.getCounters() || [];
      const employees = storageService.getEmployees() || [];
      const schedules = storageService.getAllWeeklySchedules() || {};
      const assignments = storageService.getAllAssignments() || {};

      setStats({
        shiftsCount: shifts.length,
        countersCount: counters.length,
        employeesCount: employees.length,
        schedulesCount: Object.keys(schedules).length,
        assignmentsCount: Object.keys(assignments).length,
      });
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

  // Import JSON file into local database
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content || !content.trim()) {
          error('Tệp được chọn trống hoặc không có nội dung.');
          return;
        }

        const ok = storageService.importAllData(content);
        if (ok) {
          const nowIso = new Date().toISOString();
          localStorage.setItem('dws_last_json_import_time', nowIso);
          setLastImportTime(nowIso);

          // Refresh stats
          const shifts = storageService.getShifts() || [];
          const counters = storageService.getCounters() || [];
          const employees = storageService.getEmployees() || [];
          const schedules = storageService.getAllWeeklySchedules() || {};
          const assignments = storageService.getAllAssignments() || {};

          setStats({
            shiftsCount: shifts.length,
            countersCount: counters.length,
            employeesCount: employees.length,
            schedulesCount: Object.keys(schedules).length,
            assignmentsCount: Object.keys(assignments).length,
          });

          success(`Khôi phục dữ liệu từ "${fileName}" thành công! Đã cập nhật toàn bộ ca, quầy, nhân sự và lịch.`);
          if (onDataRestored) {
            onDataRestored();
          }
        } else {
          error('Tệp tin không đúng định dạng sao lưu Quản Lý Phân Quầy.');
        }
      } catch (err: any) {
        console.error('Import error:', err);
        error('Lỗi khi nạp tệp sao lưu: ' + (err?.message || 'Tệp bị lỗi định dạng JSON'));
      }
    };

    reader.readAsText(file);
    e.target.value = '';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sao lưu & Khôi phục Dữ liệu (Offline JSON)"
      maxWidth="2xl"
    >
      <div className="space-y-5">
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
                Toàn bộ dữ liệu của bạn được lưu trữ an toàn ngay trên máy tính này. Bạn có thể dễ dàng tải tệp sao lưu (.json) về máy để dự phòng hoặc chuyển dữ liệu sang máy tính khác trong vài giây mà không cần mạng Internet hay tài khoản Google.
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
              <div className="text-base font-black text-slate-900 mt-0.5">{stats.shiftsCount}</div>
            </div>

            <div className="p-2 rounded-xl bg-white/80 border border-teal-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Layers className="w-3 h-3 text-teal-600" />
                <span>Quầy thu ngân</span>
              </div>
              <div className="text-base font-black text-slate-900 mt-0.5">{stats.countersCount}</div>
            </div>

            <div className="p-2 rounded-xl bg-white/80 border border-teal-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Users className="w-3 h-3 text-teal-600" />
                <span>Nhân viên</span>
              </div>
              <div className="text-base font-black text-slate-900 mt-0.5">{stats.employeesCount}</div>
            </div>

            <div className="p-2 rounded-xl bg-white/80 border border-teal-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3 text-teal-600" />
                <span>Ngày phân quầy</span>
              </div>
              <div className="text-base font-black text-emerald-700 mt-0.5">{stats.assignmentsCount}</div>
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
                Đóng gói toàn bộ ca, quầy, danh sách nhân viên, lịch tuần và mọi ngày phân bổ DWS thành 1 tệp tin JSON gọn nhẹ.
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
                <span className="font-semibold text-slate-600">{formatDateDisplay(lastExportTime)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Import JSON */}
          <div className="p-5 rounded-2xl bg-white border-2 border-blue-200/90 shadow-sm flex flex-col justify-between gap-4 hover:border-blue-400 transition-all">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shadow-2xs">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900">
                2. Khôi phục dữ liệu từ tệp (.json)
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Nạp tệp sao lưu JSON từ máy tính khác hoặc bản lưu trước đó. Hệ thống sẽ tự động cập nhật ngay lập tức.
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
                accept=".json,application/json"
                onChange={handleImportJson}
                className="hidden"
              />

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Khôi phục lần cuối:</span>
                <span className="font-semibold text-slate-600">{formatDateDisplay(lastImportTime)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Guide for Multi-computer sharing (Máy A ↔ Máy B) */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
            <Laptop className="w-4 h-4 text-teal-700" />
            <span>Cách chuyển dữ liệu giữa các máy tính (Máy A sang Máy B):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-teal-900">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[11px] flex items-center justify-center font-black">1</span>
                <span>Trên Máy A</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">
                Bấm nút <strong>"Tải tệp sao lưu (.json)"</strong> ở trên để lưu file dữ liệu về máy.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[11px] flex items-center justify-center font-black">2</span>
                <span>Chuyển file</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">
                Gửi file <code className="font-mono text-slate-700 font-semibold bg-slate-100 px-1 py-0.5 rounded">.json</code> qua <strong>Zalo</strong>, <strong>Email</strong>, USB hoặc Google Drive sang Máy B.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] flex items-center justify-center font-black">3</span>
                <span>Trên Máy B</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">
                Mở ứng dụng, bấm <strong>"Chọn tệp sao lưu (.json)"</strong> để nạp toàn bộ dữ liệu vào trong 2 giây.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
