import React from 'react';
import { Modal } from './Modal';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileJson,
  Database,
  Check,
} from 'lucide-react';

export interface BackupProgressState {
  isOpen: boolean;
  type: 'backup' | 'restore';
  percent: number;
  stepText: string;
  isComplete: boolean;
  error?: string | null;
  fileName?: string;
}

interface BackupProgressModalProps {
  state: BackupProgressState;
  onClose: () => void;
}

export const BackupProgressModal: React.FC<BackupProgressModalProps> = ({ state, onClose }) => {
  const isBackup = state.type === 'backup';

  return (
    <Modal
      isOpen={state.isOpen}
      onClose={onClose}
      title={isBackup ? 'Sao lưu dữ liệu về máy' : 'Khôi phục dữ liệu hệ thống'}
      maxWidth="md"
    >
      <div className="space-y-5 py-2">
        {/* Main Status Header */}
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              state.isComplete
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-xs'
                : state.error
                ? 'bg-rose-100 text-rose-700 border-rose-300 shadow-xs'
                : isBackup
                ? 'bg-teal-100 text-teal-700 border-teal-300 shadow-xs'
                : 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-xs'
            }`}
          >
            {state.isComplete ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : state.error ? (
              <AlertCircle className="w-6 h-6" />
            ) : isBackup ? (
              <Download className="w-6 h-6 animate-bounce" />
            ) : (
              <Upload className="w-6 h-6 animate-bounce" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                {state.isComplete
                  ? isBackup
                    ? 'Đã tải file sao lưu về máy!'
                    : 'Khôi phục hoàn tất!'
                  : state.error
                  ? 'Đã xảy ra lỗi'
                  : isBackup
                  ? 'Đang chuẩn bị bản sao lưu...'
                  : 'Đang giải nén & khôi phục...'}
              </h4>
              <span
                className={`text-base sm:text-xl font-mono font-black px-2.5 py-0.5 rounded-xl border ${
                  state.isComplete
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : state.error
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-teal-100 text-teal-800 border-teal-300'
                }`}
              >
                {state.percent}%
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5 line-clamp-2">
              {state.error || state.stepText}
            </p>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 border border-slate-200/80 rounded-full h-3.5 overflow-hidden p-0.5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                state.error
                  ? 'bg-rose-500'
                  : state.isComplete
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-500'
              }`}
              style={{ width: `${Math.max(4, state.percent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-0.5">
            <span>Tiến trình hoàn thành</span>
            <span className="font-mono">{state.percent}% / 100%</span>
          </div>
        </div>

        {/* Informational Checklist / Details */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
          <div className="font-bold text-slate-700 flex items-center gap-1.5 text-[11.5px]">
            <Database className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>
              {isBackup ? 'Dữ liệu được đóng gói vào tệp sao lưu:' : 'Dữ liệu đang được nạp vào máy:'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Danh mục Ca làm việc</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Danh mục Quầy thu ngân</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Danh sách Nhân viên</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Lịch làm việc tuần</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Phân quầy DWS các ngày</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Quy tắc xếp quầy & Lịch sử</span>
            </div>
          </div>

          {state.fileName && (
            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] text-slate-600">
              <FileJson className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-bold">Tên tệp:</span>
              <span className="font-mono truncate">{state.fileName}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1">
          {!state.isComplete && !state.error ? (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Hủy / Đóng cửa sổ này
            </button>
          ) : (
            <div />
          )}

          {state.isComplete || state.error ? (
            <button
              type="button"
              onClick={onClose}
              className="neu-button-primary px-5 py-2 text-xs font-bold rounded-xl cursor-pointer"
            >
              Đóng
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs text-slate-500 font-semibold py-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
              <span>Đang xử lý, vui lòng đợi...</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
