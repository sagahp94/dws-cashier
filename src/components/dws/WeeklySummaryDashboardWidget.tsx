import React, { useMemo, useState } from 'react';
import {
  WeeklyScheduleEntry,
  DayDwsAssignment,
  Shift,
  Counter,
  Employee,
} from '../../types';
import { getDaysInWeek, formatDisplayDate, formatDateToYMD } from '../../utils/dateUtils';
import { isOffShift } from '../../services/excelService';
import {
  CalendarDays,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Store,
  Layers,
  BarChart2,
  ArrowRight,
  Sun,
  Moon,
  Users,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { ExportModifiedShiftsModal } from './ExportModifiedShiftsModal';

interface ShiftGroupStatItem {
  label: string;
  color: string;
  scheduled: number;
  assigned: number;
}

interface WeeklySummaryDashboardWidgetProps {
  currentMonday: string; // YYYY-MM-DD
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  weeklySchedule: WeeklyScheduleEntry[];
  assignmentsMap: Record<string, DayDwsAssignment>;
  shifts: Shift[];
  counters: Counter[];
  employees: Employee[];
  onAutoAssignWeek?: () => void;
  onPreviewDws?: () => void;
}

export const WeeklySummaryDashboardWidget: React.FC<WeeklySummaryDashboardWidgetProps> = ({
  currentMonday,
  selectedDate,
  onSelectDate,
  weeklySchedule,
  assignmentsMap,
  shifts,
  counters,
  employees,
  onAutoAssignWeek,
  onPreviewDws,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'shift_groups'>('overview');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Compute number of modified shifts
  const modifiedCount = useMemo(() => {
    return weeklySchedule.filter(
      (e) => e.originalShiftCode && e.originalShiftCode !== e.shiftCode
    ).length;
  }, [weeklySchedule]);

  const todayStr = useMemo(() => formatDateToYMD(new Date()), []);
  const daysInWeek = useMemo(() => getDaysInWeek(currentMonday), [currentMonday]);

  // Create fast lookup map for Shift objects
  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>();
    shifts.forEach((s) => map.set((s.shiftCode || '').toUpperCase().trim(), s));
    return map;
  }, [shifts]);

  // Aggregate weekly metrics across all 7 days
  const weeklyData = useMemo(() => {
    let totalScheduledWorkingShifts = 0;
    let totalOffShifts = 0;
    let totalAssignedShifts = 0;
    let totalMorningScheduled = 0;
    let totalMorningAssigned = 0;
    let totalAfternoonScheduled = 0;
    let totalAfternoonAssigned = 0;

    // Unique employees active this week
    const activeStaffSet = new Set<string>();
    const assignedStaffSet = new Set<string>();

    // Shift group breakdowns for the whole week
    const shiftGroupStats: Record<
      string,
      { label: string; color: string; scheduled: number; assigned: number }
    > = {
      V815: { label: 'V815 (Mở quầy 08:00)', color: 'text-amber-700 bg-amber-50 border-amber-200', scheduled: 0, assigned: 0 },
      V818: { label: 'V818 (Ca sáng 08:30)', color: 'text-blue-700 bg-blue-50 border-blue-200', scheduled: 0, assigned: 0 },
      V820_V822: { label: 'V820 / V822 (Ca trưa/gãy)', color: 'text-purple-700 bg-purple-50 border-purple-200', scheduled: 0, assigned: 0 },
      V829_V830: { label: 'V829 / V830 (Ca chiều tối)', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', scheduled: 0, assigned: 0 },
      OTHER: { label: 'Ca khác (V6*, Ca gãy, SUP...)', color: 'text-slate-700 bg-slate-50 border-slate-200', scheduled: 0, assigned: 0 },
    };

    const categorizeShift = (shiftCode: string): string => {
      const code = (shiftCode || '').toUpperCase().trim();
      if (code.startsWith('V815') || code === '815' || code === 'S1' || code.startsWith('V814')) return 'V815';
      if (code.startsWith('V818') || code === '818' || code === 'G818') return 'V818';
      if (code.startsWith('V820') || code === '820' || code.startsWith('V822') || code === '822' || code.startsWith('C820') || code.startsWith('C822')) return 'V820_V822';
      if (code.startsWith('V829') || code === '829' || code.startsWith('V830') || code === '830' || code.startsWith('C829') || code.startsWith('C830')) return 'V829_V830';
      return 'OTHER';
    };

    const daysStats = daysInWeek.map((day) => {
      const dateStr = day.dateStr;
      const dayEntries = weeklySchedule.filter((e) => e.date === dateStr);
      const dayAssignment = assignmentsMap[dateStr] || null;

      let dayWorkingCount = 0;
      let dayOffCount = 0;
      let dayMorningScheduled = 0;
      let dayAfternoonScheduled = 0;
      let dayAssignedCount = 0;
      let dayMorningAssigned = 0;
      let dayAfternoonAssigned = 0;

      // Count scheduled roster entries
      dayEntries.forEach((entry) => {
        const sObj = shiftMap.get((entry.shiftCode || '').toUpperCase().trim());
        const isOff = sObj
          ? sObj.isOff || sObj.category === 'off' || isOffShift(sObj.shiftCode, sObj.shiftType, sObj.startTime, sObj.endTime)
          : isOffShift(entry.shiftCode, '');

        if (isOff) {
          dayOffCount++;
          totalOffShifts++;
        } else {
          dayWorkingCount++;
          totalScheduledWorkingShifts++;
          activeStaffSet.add(entry.employeeName.trim().toLowerCase());

          // Check shift category
          const cat = sObj?.category || (
            entry.shiftCode.startsWith('V815') || entry.shiftCode.startsWith('V818') || entry.shiftCode.startsWith('V814') || entry.shiftCode.startsWith('S')
              ? 'morning'
              : entry.shiftCode.startsWith('V829') || entry.shiftCode.startsWith('V830') || entry.shiftCode.startsWith('C') || entry.shiftCode.startsWith('V6')
              ? 'afternoon'
              : 'other'
          );

          if (cat === 'morning') {
            dayMorningScheduled++;
            totalMorningScheduled++;
          } else {
            dayAfternoonScheduled++;
            totalAfternoonScheduled++;
          }

          // Tally group
          const grpKey = categorizeShift(entry.shiftCode);
          if (shiftGroupStats[grpKey]) {
            shiftGroupStats[grpKey].scheduled++;
          }
        }
      });

      // Count counter assignments for this day
      if (dayAssignment && dayAssignment.assignments) {
        Object.values(dayAssignment.assignments).forEach((ca: any) => {
          if (ca?.morning) {
            dayAssignedCount++;
            dayMorningAssigned++;
            totalAssignedShifts++;
            totalMorningAssigned++;
            assignedStaffSet.add(ca.morning.employeeName.trim().toLowerCase());

            const grp = categorizeShift(ca.morning.shiftCode);
            if (shiftGroupStats[grp]) shiftGroupStats[grp].assigned++;
          }
          if (ca?.morning2) {
            dayAssignedCount++;
            dayMorningAssigned++;
            totalAssignedShifts++;
            totalMorningAssigned++;
            assignedStaffSet.add(ca.morning2.employeeName.trim().toLowerCase());

            const grp = categorizeShift(ca.morning2.shiftCode);
            if (shiftGroupStats[grp]) shiftGroupStats[grp].assigned++;
          }
          if (ca?.afternoon) {
            dayAssignedCount++;
            dayAfternoonAssigned++;
            totalAssignedShifts++;
            totalAfternoonAssigned++;
            assignedStaffSet.add(ca.afternoon.employeeName.trim().toLowerCase());

            const grp = categorizeShift(ca.afternoon.shiftCode);
            if (shiftGroupStats[grp]) shiftGroupStats[grp].assigned++;
          }
          if (ca?.afternoon2) {
            dayAssignedCount++;
            dayAfternoonAssigned++;
            totalAssignedShifts++;
            totalAfternoonAssigned++;
            assignedStaffSet.add(ca.afternoon2.employeeName.trim().toLowerCase());

            const grp = categorizeShift(ca.afternoon2.shiftCode);
            if (shiftGroupStats[grp]) shiftGroupStats[grp].assigned++;
          }
        });
      }

      const dayUnassigned = Math.max(0, dayWorkingCount - dayAssignedCount);
      const dayCompletionPct = dayWorkingCount > 0 ? Math.min(100, Math.round((dayAssignedCount / dayWorkingCount) * 100)) : 0;
      const dayIsCompleted = dayWorkingCount > 0 && dayAssignedCount >= dayWorkingCount;

      return {
        ...day,
        workingCount: dayWorkingCount,
        offCount: dayOffCount,
        assignedCount: dayAssignedCount,
        unassignedCount: dayUnassigned,
        morningScheduled: dayMorningScheduled,
        morningAssigned: dayMorningAssigned,
        afternoonScheduled: dayAfternoonScheduled,
        afternoonAssigned: dayAfternoonAssigned,
        completionPct: dayCompletionPct,
        isCompleted: dayIsCompleted,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
      };
    });

    const totalUnassignedShifts = Math.max(0, totalScheduledWorkingShifts - totalAssignedShifts);
    const overallCompletionRate =
      totalScheduledWorkingShifts > 0
        ? Math.min(100, Math.round((totalAssignedShifts / totalScheduledWorkingShifts) * 100))
        : 0;

    const completedDaysCount = daysStats.filter((d) => d.workingCount > 0 && d.isCompleted).length;
    const totalWorkingDaysCount = daysStats.filter((d) => d.workingCount > 0).length;

    return {
      daysStats,
      totalScheduledWorkingShifts,
      totalOffShifts,
      totalAssignedShifts,
      totalUnassignedShifts,
      overallCompletionRate,
      totalMorningScheduled,
      totalMorningAssigned,
      totalAfternoonScheduled,
      totalAfternoonAssigned,
      activeStaffCount: activeStaffSet.size,
      assignedStaffCount: assignedStaffSet.size,
      completedDaysCount,
      totalWorkingDaysCount,
      shiftGroupStats,
    };
  }, [daysInWeek, weeklySchedule, assignmentsMap, shiftMap, selectedDate, todayStr]);

  // Overall status styling & message
  const statusConfig = useMemo(() => {
    if (weeklyData.totalScheduledWorkingShifts === 0) {
      return {
        badge: 'Chưa có lịch tuần',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
        ringColor: 'stroke-slate-300',
        textColor: 'text-slate-600',
      };
    }
    if (weeklyData.overallCompletionRate === 100) {
      return {
        badge: 'Đã xếp đủ 100% toàn tuần',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black',
        ringColor: 'stroke-emerald-500',
        textColor: 'text-emerald-700',
      };
    }
    if (weeklyData.overallCompletionRate >= 75) {
      return {
        badge: `Đang hoàn thiện (${weeklyData.overallCompletionRate}%)`,
        badgeClass: 'bg-teal-100 text-teal-900 border-teal-300 font-bold',
        ringColor: 'stroke-teal-600',
        textColor: 'text-teal-700',
      };
    }
    return {
      badge: `Còn ${weeklyData.totalUnassignedShifts} ca chưa phân`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
      ringColor: 'stroke-amber-500',
      textColor: 'text-amber-700',
    };
  }, [weeklyData]);

  // Week formatted label e.g., "21/09 - 27/09/2026"
  const weekDateRangeLabel = useMemo(() => {
    if (daysInWeek.length >= 7) {
      const first = formatDisplayDate(daysInWeek[0].dateStr);
      const last = formatDisplayDate(daysInWeek[6].dateStr);
      return `${first} – ${last}`;
    }
    return '';
  }, [daysInWeek]);

  return (
    <div
      id="weekly-summary-dashboard-widget"
      className="neu-panel p-4 sm:p-5 space-y-4"
    >
      {/* 1. Header Bar: Bird's-Eye Title, Completion Status & Expand/Collapse Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Tổng quan Lịch & Phân quầy tuần
            </h3>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className={`text-xs font-semibold inline-flex items-center gap-1 ${statusConfig.textColor}`}>
              {weeklyData.overallCompletionRate === 100 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : weeklyData.totalUnassignedShifts > 0 ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-teal-600" />
              )}
              <span>{statusConfig.badge}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 tabular-nums">
            <span>Tuần: <strong className="text-slate-700 font-medium">{weekDateRangeLabel}</strong></span>
            <span className="text-slate-300">·</span>
            <span>{weeklyData.completedDaysCount}/{weeklyData.totalWorkingDaysCount} ngày đã xếp đủ 100%</span>
          </p>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {weeklySchedule.length > 0 && (
            <button
              type="button"
              id="btn-widget-export-modified-shifts"
              onClick={() => setIsExportModalOpen(true)}
              className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-700 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
              title="Tải xuống file ca đã chỉnh sửa định dạng PDF hoặc Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Tải ca đã sửa ({modifiedCount})</span>
              <span className="sm:hidden">Tải ca ({modifiedCount})</span>
            </button>
          )}

          {onAutoAssignWeek && weeklyData.totalUnassignedShifts > 0 && (
            <button
              type="button"
              id="btn-widget-auto-assign-week"
              onClick={onAutoAssignWeek}
              className="neu-button-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              title="Tự động phân quầy cho toàn bộ các ngày trong tuần"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-100" />
              <span className="hidden sm:inline">Phân quầy cả tuần</span>
              <span className="sm:hidden">Tự động</span>
            </button>
          )}

          {onPreviewDws && (
            <button
              type="button"
              id="btn-widget-preview-dws"
              onClick={onPreviewDws}
              className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-700 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
              title="Xem trước bảng in DWS hoàn chỉnh"
            >
              <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Xem DWS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="neu-button-secondary px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer inline-flex items-center gap-1"
            title={isExpanded ? 'Thu gọn tổng quan' : 'Mở rộng tổng quan'}
          >
            <span className="hidden sm:inline">{isExpanded ? 'Thu gọn' : 'Chi tiết tuần'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Clean Divided Weekly KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-200/80 tabular-nums">
        {/* Metric 1: Tổng Ca Làm Việc Tuần */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Tổng ca làm việc tuần</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">
              {weeklyData.totalScheduledWorkingShifts}
            </span>
            <span className="text-xs text-slate-500">ca trực</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Sáng: <strong className="text-slate-700">{weeklyData.totalMorningScheduled}</strong></span>
            <span>·</span>
            <span>Chiều: <strong className="text-slate-700">{weeklyData.totalAfternoonScheduled}</strong></span>
            <span>·</span>
            <span>OFF: {weeklyData.totalOffShifts}</span>
          </div>
        </div>

        {/* Metric 2: Đã Phân Vào Quầy */}
        <div className="space-y-1 lg:border-l lg:border-slate-200/80 lg:pl-4">
          <p className="text-xs font-medium text-slate-500">Đã phân vào quầy</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-teal-700">
              {weeklyData.totalAssignedShifts}
            </span>
            <span className="text-xs text-slate-400">
              / {weeklyData.totalScheduledWorkingShifts} ca
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Slot đã xếp: <strong className="text-slate-700">{weeklyData.totalMorningAssigned} Sáng</strong> · <strong className="text-slate-700">{weeklyData.totalAfternoonAssigned} Chiều</strong>
          </div>
        </div>

        {/* Metric 3: Chưa Phân Quầy */}
        <div className="space-y-1 lg:border-l lg:border-slate-200/80 lg:pl-4">
          <p className="text-xs font-medium text-slate-500">Chưa phân quầy</p>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold ${
                weeklyData.totalUnassignedShifts > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {weeklyData.totalUnassignedShifts}
            </span>
            <span className="text-xs text-slate-500">
              {weeklyData.totalUnassignedShifts > 0 ? 'ca cần xếp' : 'hoàn tất'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            {weeklyData.totalUnassignedShifts > 0
              ? 'Nhân viên đang ở danh sách chờ'
              : 'Tất cả ca đã có vị trí quầy'}
          </div>
        </div>

        {/* Metric 4: Tỷ lệ Hoàn Thành Toàn Tuần */}
        <div className="space-y-1.5 lg:border-l lg:border-slate-200/80 lg:pl-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Tỷ lệ hoàn thành tuần</p>
            <span className="text-xs font-bold text-slate-900">{weeklyData.overallCompletionRate}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                weeklyData.overallCompletionRate === 100
                  ? 'bg-emerald-600'
                  : weeklyData.overallCompletionRate >= 70
                  ? 'bg-teal-700'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${weeklyData.overallCompletionRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <span>{weeklyData.activeStaffCount} nhân sự</span>
            <span>·</span>
            <span>{counters.length} quầy DWS</span>
          </div>
        </div>
      </div>

      {/* 3. Bird's-Eye 7-Day Matrix Grid (Monday -> Sunday) */}
      {isExpanded && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                Tiến độ chi tiết từng ngày trong tuần (Bấm để chọn ngày)
              </h4>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Đã xếp đủ
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-2" /> Còn trống
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {weeklyData.daysStats.map((day) => {
              const isSelected = day.isSelected;
              const isToday = day.isToday;

              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  id={`birdseye-day-${day.dayIndex}`}
                  onClick={() => onSelectDate(day.dateStr)}
                  className={`p-3 rounded-2xl text-left transition-all duration-150 cursor-pointer flex flex-col justify-between relative group ${
                    isSelected
                      ? 'neu-inset bg-[#f0f4f9] border-teal-600 ring-2 ring-teal-600/30 scale-[1.02] shadow-xs'
                      : 'neu-card-interactive bg-white hover:border-teal-300'
                  }`}
                >
                  {/* Day Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          isSelected ? 'text-teal-900' : 'text-slate-700'
                        }`}
                      >
                        {day.dayName}
                      </span>
                      {isToday && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                          HÔM NAY
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] font-bold mt-0.5 ${isSelected ? 'text-teal-700' : 'text-slate-400'}`}>
                      {day.dayFormatted}
                    </p>
                  </div>

                  {/* Mid: Scheduled vs Assigned Numbers */}
                  <div className="my-2 space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[11px] font-semibold text-slate-500">Đã xếp:</span>
                      <span className="font-black text-slate-900">
                        {day.assignedCount}
                        <span className="text-slate-400 font-normal ml-0.5">/{day.workingCount}</span>
                      </span>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          day.isCompleted
                            ? 'bg-emerald-500'
                            : day.completionPct >= 60
                            ? 'bg-teal-600'
                            : day.completionPct > 0
                            ? 'bg-amber-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${day.completionPct}%` }}
                      />
                    </div>

                    {/* Sáng / Chiều Breakdown Mini */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span title="Ca Sáng đã xếp / Tổng ca sáng">
                        S: <strong className={day.morningAssigned >= day.morningScheduled && day.morningScheduled > 0 ? 'text-emerald-700' : 'text-slate-700'}>{day.morningAssigned}/{day.morningScheduled}</strong>
                      </span>
                      <span title="Ca Chiều đã xếp / Tổng ca chiều">
                        C: <strong className={day.afternoonAssigned >= day.afternoonScheduled && day.afternoonScheduled > 0 ? 'text-emerald-700' : 'text-slate-700'}>{day.afternoonAssigned}/{day.afternoonScheduled}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                    {day.workingCount === 0 ? (
                      <span className="text-[10px] text-slate-400 font-medium">Không có ca</span>
                    ) : day.isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Đủ 100%
                      </span>
                    ) : day.assignedCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        Còn {day.unassignedCount} ca
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Chưa xếp</span>
                    )}

                    <span className="text-[10px] font-black text-slate-700">
                      {day.completionPct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 4. Shift Category Group Breakdown (Expandable Details) */}
          <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-600" />
                Tỷ lệ phân bổ theo nhóm ca làm việc toàn tuần
              </span>
              <span className="text-[11px] text-slate-500">
                Tổng cộng {weeklyData.totalScheduledWorkingShifts} ca làm việc
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {(Object.entries(weeklyData.shiftGroupStats) as [string, ShiftGroupStatItem][]).map(([key, grp]) => {
                const pct = grp.scheduled > 0 ? Math.round((grp.assigned / grp.scheduled) * 100) : 0;
                const isFullyDone = grp.scheduled > 0 && grp.assigned >= grp.scheduled;

                return (
                  <div
                    key={key}
                    className={`p-2.5 rounded-xl border bg-white shadow-2xs flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 truncate" title={grp.label}>
                          {grp.label.split(' ')[0]}
                        </span>
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                            isFullyDone
                              ? 'bg-emerald-100 text-emerald-800'
                              : grp.scheduled > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{grp.label}</p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">Đã gán quầy:</span>
                      <span className="font-bold text-slate-800">
                        {grp.assigned} <span className="text-slate-400 font-normal">/ {grp.scheduled}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Export Modified Shifts (PDF & Excel) Modal */}
      <ExportModifiedShiftsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        weekId={currentMonday}
        weeklySchedule={weeklySchedule}
        shifts={shifts}
        counters={counters}
        employees={employees}
        initialFilter="all_modified"
      />
    </div>
  );
};
