import React from 'react';
import { InactiveTwoWeeksEmployee } from '../../types';
import { AlertTriangle, UserX, Eye, ChevronRight } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

interface InactiveTwoWeeksAlertBannerProps {
  inactiveEmployees: InactiveTwoWeeksEmployee[];
  onOpenModal: () => void;
  onMarkResigned: (emp: InactiveTwoWeeksEmployee) => void;
  onMarkAllResigned: () => void;
  onManualReview: (emp?: InactiveTwoWeeksEmployee) => void;
}

export const InactiveTwoWeeksAlertBanner: React.FC<InactiveTwoWeeksAlertBannerProps> = ({
  inactiveEmployees,
  onOpenModal,
  onMarkResigned,
  onMarkAllResigned,
  onManualReview,
}) => {
  if (!inactiveEmployees || inactiveEmployees.length === 0) {
    return null;
  }

  const isSingle = inactiveEmployees.length === 1;
  const firstEmp = inactiveEmployees[0];
  const namesPreview = inactiveEmployees
    .slice(0, 3)
    .map((e) => `${e.fullName} (${e.employeeId})`)
    .join(', ');
  const remainingCount = inactiveEmployees.length - 3;

  return (
    <div
      id="inactive-two-weeks-alert-banner"
      className="mb-4 px-4 py-3.5 bg-rose-50/70 border border-rose-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 text-slate-800 shadow-2xs"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-rose-950">
              {isSingle
                ? `Thông báo: Nhân viên ${firstEmp.fullName} (${firstEmp.employeeId}) đã 2 tuần liên tiếp không có ca làm việc trong ca làm việc tuần. Nhân viên có phải đã nghỉ việc không?`
                : `Thông báo: Phát hiện ${inactiveEmployees.length} nhân viên đi làm đã 2 tuần liên tiếp không có ca làm việc trong ca làm việc tuần. Nhân viên có phải đã nghỉ việc không?`}
            </span>
          </div>
          <div className="text-xs text-rose-900/80 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {!isSingle && (
              <span>
                Danh sách: <strong className="font-semibold text-rose-950">{namesPreview}</strong>
                {remainingCount > 0 && <span> và {remainingCount} nhân viên khác</span>}
              </span>
            )}
            <span className="text-[11px] text-rose-700/80">
              (Tuần {formatDisplayDate(firstEmp.previousWeekMonday)} &amp; Tuần {formatDisplayDate(firstEmp.currentWeekMonday)})
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap">
        <button
          type="button"
          onClick={() => (isSingle ? onMarkResigned(firstEmp) : onMarkAllResigned())}
          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          title="Cập nhật trạng thái nhân viên thành Nghỉ việc và đưa vào mục Không phân quầy"
        >
          <UserX className="w-3.5 h-3.5" />
          <span>{isSingle ? 'Đã nghỉ việc' : `Đã nghỉ việc (${inactiveEmployees.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => onManualReview(isSingle ? firstEmp : undefined)}
          className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-teal-800 rounded-lg cursor-pointer"
          title="Mở bảng Danh sách nhân viên để kiểm tra và tick Đã nghỉ việc thủ công"
        >
          <Eye className="w-3.5 h-3.5 text-teal-700" />
          <span>Xem xét thủ công</span>
        </button>

        {!isSingle && (
          <button
            type="button"
            onClick={onOpenModal}
            className="neu-button-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 rounded-lg cursor-pointer"
            title="Xem chi tiết từng nhân viên"
          >
            <span>Chi tiết</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
};
