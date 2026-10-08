import React from 'react';
import { MissingScheduleEmployee } from '../../types';
import { AlertTriangle, UserPlus, UserX, ChevronRight, Users } from 'lucide-react';

interface MissingEmployeesAlertBannerProps {
  missingEmployees: MissingScheduleEmployee[];
  onOpenModal: () => void;
  onAddAll: () => void;
  onExcludeAll: () => void;
}

export const MissingEmployeesAlertBanner: React.FC<MissingEmployeesAlertBannerProps> = ({
  missingEmployees,
  onOpenModal,
  onAddAll,
  onExcludeAll,
}) => {
  const unresolved = missingEmployees.filter((e) => !e.isExcluded);

  if (unresolved.length === 0) {
    return null;
  }

  const namesPreview = unresolved
    .slice(0, 3)
    .map((e) => e.employeeName)
    .join(', ');
  const remainingCount = unresolved.length - 3;

  return (
    <div
      id="missing-employees-alert-banner"
      className="mb-4 px-4 py-3 bg-amber-50/60 border border-amber-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-800"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-amber-950">
              Phát hiện {unresolved.length} nhân viên trong ca tuần chưa có trong Danh sách nhân viên
            </span>
          </div>
          <div className="text-xs text-amber-900/80 truncate">
            Nhân viên: <span className="font-semibold text-amber-950">{namesPreview}</span>
            {remainingCount > 0 && <span> và {remainingCount} người khác</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
        <button
          type="button"
          onClick={onAddAll}
          className="neu-button-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
          title="Bổ sung tất cả nhân viên này vào Danh sách nhân viên"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Thêm nhân viên</span>
        </button>

        <button
          type="button"
          onClick={onExcludeAll}
          className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 rounded-lg cursor-pointer hover:bg-rose-50"
          title="Không cho vào danh sách phân quầy"
        >
          <UserX className="w-3.5 h-3.5 text-rose-600" />
          <span>Không phân quầy</span>
        </button>

        <button
          type="button"
          onClick={onOpenModal}
          className="neu-button-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 rounded-lg cursor-pointer"
          title="Xem chi tiết từng nhân viên"
        >
          <span>Tùy chọn riêng</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>
    </div>
  );
};
