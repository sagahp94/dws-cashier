import React, { useState, useMemo } from 'react';
import {
  WeeklyScheduleEntry,
  Shift,
  Counter,
  Employee,
  DayDwsAssignment,
} from '../../types';
import {
  calculateDailyPlannedDemand,
  ShiftSlotComparison,
  AreaDemandOverview,
  StaffShiftDetail,
} from '../../services/plannedDemandCalculator';
import {
  Store,
  ShoppingBag,
  Users,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Eye,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

interface DailyPlannedDemandOverviewProps {
  date: string; // YYYY-MM-DD
  dayName: string;
  weeklySchedule: WeeklyScheduleEntry[];
  shifts: Shift[];
  counters: Counter[];
  employees: Employee[];
  currentAssignment: DayDwsAssignment | null;
  onNavigateToAssign?: () => void;
  onNavigateToScheduleAdjust?: () => void;
}

export const DailyPlannedDemandOverview: React.FC<DailyPlannedDemandOverviewProps> = ({
  date,
  dayName,
  weeklySchedule,
  shifts,
  counters,
  employees,
  currentAssignment,
  onNavigateToAssign,
  onNavigateToScheduleAdjust,
}) => {
  const [selectedSlotForDetail, setSelectedSlotForDetail] = useState<{
    areaTitle: string;
    slot: ShiftSlotComparison;
  } | null>(null);

  // Tính toán dữ liệu đối chiếu
  const summary = useMemo(() => {
    return calculateDailyPlannedDemand(
      date,
      weeklySchedule,
      shifts,
      counters,
      employees,
      currentAssignment
    );
  }, [date, weeklySchedule, shifts, counters, employees, currentAssignment]);

  const displayDate = useMemo(() => {
    return formatDisplayDate(date);
  }, [date]);

  // Handler cuộn xuống khu vực phân quầy
  const handleScrollToGrid = () => {
    if (onNavigateToAssign) {
      onNavigateToAssign();
      return;
    }
    const target = document.getElementById('counter-grid-container') || document.getElementById('unassigned-panel');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      id="planned-demand-overview-section"
      aria-label="Nhân sự và nhu cầu mở quầy theo kế hoạch"
      className="neu-panel p-4 sm:p-5 space-y-4"
    >
      {/* 1. Header Section: Tiêu đề & Ngày đang chọn */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Nhân sự & Nhu cầu mở quầy
            </h2>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-xs font-medium text-teal-800 tabular-nums">
              {dayName} ({displayDate})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Đối chiếu nhân sự thực tế với số quầy kế hoạch định biên (Siêu thị & FL2)
          </p>
        </div>

        {/* Action nhanh: Phân quầy ngay */}
        <div className="flex items-center gap-2">
          {onNavigateToScheduleAdjust && !summary.allSufficient && (
            <button
              type="button"
              onClick={onNavigateToScheduleAdjust}
              className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 rounded-lg cursor-pointer whitespace-nowrap"
              title="Mở danh sách ca làm việc tuần để điều chỉnh ca thiếu"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Xem lịch điều chỉnh</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleScrollToGrid}
            className="neu-button-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            title="Đi thẳng vào màn hình phân quầy của ngày này"
          >
            <span>Phân quầy hôm nay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Banner Cảnh báo tổng quan ngày */}
      <div
        className={`px-3.5 py-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          summary.allSufficient
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-start sm:items-center gap-2">
          <div className="shrink-0 mt-0.5 sm:mt-0">
            {summary.allSufficient ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold">
              {summary.alertBannerMessage}
            </p>
            {!summary.allSufficient && summary.missingSlotsSummary.length > 0 && (
              <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                {summary.missingSlotsSummary.join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Tóm tắt nhanh số liệu ngày */}
        <div className="flex items-center gap-2.5 text-xs shrink-0 self-end sm:self-center tabular-nums">
          <span>
            Đi làm: <strong className="text-slate-900 font-semibold">{summary.totalDayWorkingStaff} NV</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Mục tiêu: <strong className="text-teal-800 font-semibold">{summary.totalDayPlannedCounters} quầy</strong>
          </span>
        </div>
      </div>

      {/* 3. Khu Vực: SIÊU THỊ & FL2 (Separated cleanly) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
        {/* === CARD 1: SIÊU THỊ === */}
        <AreaDemandCard
          areaOverview={summary.sieuThi}
          icon={<Store className="w-4 h-4 text-teal-700" />}
          onViewStaffDetail={(slot) =>
            setSelectedSlotForDetail({ areaTitle: summary.sieuThi.areaTitle, slot })
          }
          onAssignClick={handleScrollToGrid}
        />

        {/* === CARD 2: FL2 (Delica & Bánh mì) === */}
        <AreaDemandCard
          areaOverview={summary.fl2}
          icon={<ShoppingBag className="w-4 h-4 text-indigo-700" />}
          onViewStaffDetail={(slot) =>
            setSelectedSlotForDetail({ areaTitle: summary.fl2.areaTitle, slot })
          }
          onAssignClick={handleScrollToGrid}
        />
      </div>

      {/* 4. Modal Chi tiết nhân sự theo ca khi bấm "Xem nhân sự" */}
      {selectedSlotForDetail && (
        <StaffDetailModal
          areaTitle={selectedSlotForDetail.areaTitle}
          slot={selectedSlotForDetail.slot}
          date={date}
          dayName={dayName}
          onClose={() => setSelectedSlotForDetail(null)}
          onGoToAssign={() => {
            setSelectedSlotForDetail(null);
            handleScrollToGrid();
          }}
        />
      )}
    </section>
  );
};

/* =========================================================================
   COMPONENTS CON: AREA DEMAND CARD & SLOT SECTION
   ========================================================================= */

interface AreaDemandCardProps {
  areaOverview: AreaDemandOverview;
  icon: React.ReactNode;
  onViewStaffDetail: (slot: ShiftSlotComparison) => void;
  onAssignClick: () => void;
}

const AreaDemandCard: React.FC<AreaDemandCardProps> = ({
  areaOverview,
  icon,
  onViewStaffDetail,
  onAssignClick,
}) => {
  return (
    <div className="rounded-xl p-4 border border-slate-200 bg-slate-50/40 space-y-3 flex flex-col justify-between">
      {/* Header khu vực */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {areaOverview.areaTitle}
            </h3>
            <p className="text-[11px] text-slate-500">
              {areaOverview.areaSubtitle}
            </p>
          </div>
        </div>

        <div className="text-right tabular-nums">
          <div className="text-[10px] font-medium text-slate-500">Tổng quầy dự kiến</div>
          <div className="text-xs font-bold text-slate-900">
            {areaOverview.totalActual} / {areaOverview.totalPlanned} quầy
          </div>
        </div>
      </div>

      {/* 2 Khối Ca: Sáng & Tối */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
        <ShiftSlotBox
          slot={areaOverview.morning}
          onViewStaff={() => onViewStaffDetail(areaOverview.morning)}
        />
        <ShiftSlotBox
          slot={areaOverview.night}
          onViewStaff={() => onViewStaffDetail(areaOverview.night)}
        />
      </div>

      {/* Footer card */}
      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Chênh lệch:{' '}
          <strong
            className={`font-semibold ${
              areaOverview.totalDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {areaOverview.totalDiff >= 0
              ? areaOverview.totalDiff === 0
                ? 'Đủ nhân sự'
                : `Dư ${areaOverview.totalDiff} người`
              : `Thiếu ${Math.abs(areaOverview.totalDiff)} người`}
          </strong>
        </span>

        <button
          type="button"
          onClick={onAssignClick}
          className="text-teal-700 hover:text-teal-900 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <span>Đến phân quầy</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface ShiftSlotBoxProps {
  slot: ShiftSlotComparison;
  onViewStaff: () => void;
}

const ShiftSlotBox: React.FC<ShiftSlotBoxProps> = ({ slot, onViewStaff }) => {
  const statusColor = useMemo(() => {
    switch (slot.status) {
      case 'exact':
      case 'surplus':
        return {
          text: 'text-emerald-700',
          dot: 'bg-emerald-500',
        };
      case 'warning':
        return {
          text: 'text-amber-700',
          dot: 'bg-amber-500',
        };
      case 'danger':
        return {
          text: 'text-rose-700',
          dot: 'bg-rose-500',
        };
    }
  }, [slot.status]);

  return (
    <div className="rounded-lg p-3 border border-slate-200 bg-white flex flex-col justify-between space-y-2.5">
      {/* Tiêu đề ca & trạng thái */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
          <h4 className="text-xs font-bold text-slate-800">
            {slot.timeSlotLabel}
          </h4>
        </div>

        <span className={`text-[11px] font-semibold ${statusColor.text}`}>
          {slot.statusLabel}
        </span>
      </div>

      {/* 3 Thông tin chính: NHÂN SỰ | QUẦY DỰ KIẾN | CHÊNH LỆCH */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center tabular-nums">
        <div>
          <div className="text-[10px] font-medium text-slate-500">Nhân sự</div>
          <div className="text-sm font-bold text-slate-900 mt-0.5">{slot.actualStaff}</div>
        </div>

        <div className="border-x border-slate-100">
          <div className="text-[10px] font-medium text-slate-500">Dự kiến</div>
          <div className="text-sm font-bold text-teal-800 mt-0.5">{slot.plannedCounters}</div>
        </div>

        <div>
          <div className="text-[10px] font-medium text-slate-500">Lệch</div>
          <div
            className={`text-sm font-bold mt-0.5 ${
              slot.diff > 0
                ? 'text-emerald-700'
                : slot.diff < 0
                ? 'text-rose-700'
                : 'text-slate-700'
            }`}
          >
            {slot.diff > 0 ? `+${slot.diff}` : slot.diff}
          </div>
        </div>
      </div>

      {/* Smart Note & Nút xem nhân sự */}
      <div className="flex items-center justify-between text-[11px] tabular-nums">
        <span className="text-slate-500">
          Đã xếp: <strong className="text-slate-800">{slot.assignedStaff}</strong> · Chờ: <strong className="text-amber-700">{slot.unassignedStaff}</strong>
        </span>

        <button
          type="button"
          onClick={onViewStaff}
          className="font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer hover:underline"
          title={`Xem danh sách ${slot.actualStaff} nhân viên ${slot.timeSlotLabel}`}
        >
          <Eye className="w-3 h-3" />
          <span>Chi tiết</span>
        </button>
      </div>
    </div>
  );
};

/* =========================================================================
   MODAL CHI TIẾT DANH SÁCH NHÂN SỰ THEO CA & KHU VỰC
   ========================================================================= */

interface StaffDetailModalProps {
  areaTitle: string;
  slot: ShiftSlotComparison;
  date: string;
  dayName: string;
  onClose: () => void;
  onGoToAssign: () => void;
}

const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  areaTitle,
  slot,
  date,
  dayName,
  onClose,
  onGoToAssign,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl border border-slate-200 flex flex-col max-h-[85vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                {areaTitle}
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Danh sách nhân sự — {slot.timeSlotLabel}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {dayName} · {formatDisplayDate(date)} ({slot.actualStaff} nhân viên khả dụng)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung danh sách nhân viên */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
          {slot.staffList.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-1">
              <UserX className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Không có nhân viên đi làm trong ca này</p>
              <p className="text-xs text-slate-400">Vui lòng kiểm tra lại lịch ca làm việc tuần.</p>
            </div>
          ) : (
            slot.staffList.map((emp, idx) => (
              <div
                key={`modal_staff_${emp.employeeId || emp.employeeName}_${idx}`}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-slate-400 w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {emp.employeeName}
                      </span>
                      {emp.employeeId && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {emp.employeeId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className="font-mono font-semibold text-[11px] text-slate-700">
                        {emp.shiftCode}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {emp.startTime}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trạng thái gán quầy */}
                <div className="text-right shrink-0">
                  {emp.isAssigned ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Quầy {emp.assignedCounterNumber}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Chưa phân quầy</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Modal: Thống kê cuối danh sách & Nút điều hướng */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <div>
              <span className="text-slate-500">Nhân sự: </span>
              <strong className="text-slate-900 font-semibold">{slot.actualStaff}</strong>
            </div>
            <span className="text-slate-300">·</span>
            <div>
              <span className="text-slate-500">Dự kiến: </span>
              <strong className="text-teal-800 font-semibold">{slot.plannedCounters} quầy</strong>
            </div>
            <span className="text-slate-300">·</span>
            <div>
              <span className="text-slate-500">Chênh lệch: </span>
              <strong
                className={`font-semibold ${
                  slot.diff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {slot.statusLabel}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="neu-button-secondary px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={onGoToAssign}
              className="neu-button-primary px-4 py-1.5 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Đến phân quầy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
