import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import {
  CloudUpload,
  Database,
  CheckCircle2,
  Clock,
  Layers,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface MigrationSummary {
  shifts: number;
  counters: number;
  employees: number;
  schedules: number;
  assignments: number;
}

interface MigrateLocalStorageModalProps {
  isOpen: boolean;
  userDisplayName: string | null;
  userEmail: string | null;
  summary: MigrationSummary;
  onConfirm: () => Promise<void>;
  onSkip: () => void;
}

export const MigrateLocalStorageModal: React.FC<MigrateLocalStorageModalProps> = ({
  isOpen,
  userDisplayName,
  userEmail,
  summary,
  onConfirm,
  onSkip,
}) => {
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      await onConfirm();
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isMigrating) onSkip();
      }}
      title="Đồng bộ dữ liệu lên tài khoản Google"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 via-emerald-50 to-teal-50 border border-teal-200/80 space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CloudUpload className="w-6 h-6 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                Bạn có muốn đồng bộ dữ liệu hiện tại lên tài khoản Google không?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Hệ thống phát hiện có dữ liệu danh mục ca, quầy và lịch làm việc đã lưu trên trình duyệt này. Đồng bộ lên tài khoản <strong>{userEmail || userDisplayName || 'Google'}</strong> để sử dụng trên mọi thiết bị.
              </p>
            </div>
          </div>

          {/* Local Data Stats */}
          <div className="pt-3 border-t border-teal-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white/90 border border-teal-100 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-teal-600" />
                <span>Ca làm việc</span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{summary.shifts}</div>
            </div>

            <div className="p-2 rounded-xl bg-white/90 border border-teal-100 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Layers className="w-3 h-3 text-teal-600" />
                <span>Quầy thu ngân</span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{summary.counters}</div>
            </div>

            <div className="p-2 rounded-xl bg-white/90 border border-teal-100 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Users className="w-3 h-3 text-teal-600" />
                <span>Nhân viên</span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{summary.employees}</div>
            </div>

            <div className="p-2 rounded-xl bg-white/90 border border-teal-100 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3 text-teal-600" />
                <span>Ngày phân quầy</span>
              </div>
              <div className="text-sm font-black text-emerald-700 mt-0.5">{summary.assignments}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            id="btn-confirm-migrate"
            onClick={handleMigrate}
            disabled={isMigrating}
            className="w-full sm:flex-1 py-3 px-4 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isMigrating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang đồng bộ lên Google...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                <span>Đồng bộ dữ liệu ngay</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-skip-migrate"
            onClick={onSkip}
            disabled={isMigrating}
            className="w-full sm:w-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer disabled:opacity-60"
          >
            Bắt đầu mới / Để sau
          </button>
        </div>
      </div>
    </Modal>
  );
};
