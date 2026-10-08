import React, { useState, useMemo } from 'react';
import {
  Shift,
  Counter,
  Employee,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  UnassignedEmployee,
  ShiftSwapRequest,
  CounterDayAssignment,
} from '../types';
import { assignmentService } from '../services/assignmentService';
import { storageService } from '../services/storageService';
import { autoSuggestService } from '../services/autoSuggestService';
import { getCounterZone, getZoneBadgeConfig } from '../services/zoneTrackingService';
import { DAYS_OF_WEEK } from '../components/dws/DaySelector';
import { getDaysInWeek, formatDisplayDate } from '../utils/dateUtils';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/ToastContainer';
import {
  Search,
  Clock,
  Sun,
  Moon,
  ArrowRight,
  UserCheck,
  Filter,
  Calendar,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Sparkles,
  Check,
  X,
  Store,
  User,
  TrendingUp,
} from 'lucide-react';

interface UnassignedPageProps {
  currentMonday: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  shifts: Shift[];
  counters: Counter[];
  employees: Employee[];
  weeklySchedule: WeeklyScheduleEntry[];
  assignmentsMap: Record<string, DayDwsAssignment>;
  onNavigateToDws: () => void;
  onDataChanged: () => void;
}

export const UnassignedPage: React.FC<UnassignedPageProps> = ({
  currentMonday,
  selectedDate,
  onSelectDate,
  shifts,
  counters,
  employees,
  weeklySchedule,
  assignmentsMap,
  onNavigateToDws,
  onDataChanged,
}) => {
  const { success, warning, info } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'single_day' | 'full_week' | 'swap_requests'>('single_day');
  const [swapStatusFilter, setSwapStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  // Single Day unassigned
  const singleDayAssignment = assignmentsMap[selectedDate] || null;
  const singleDayUnassigned = assignmentService.getUnassignedEmployees(
    selectedDate,
    weeklySchedule,
    shifts,
    singleDayAssignment
  );
  const singleDayExcluded = assignmentService.getExcludedEmployeesForDay(
    selectedDate,
    weeklySchedule,
    shifts
  );

  // Full week unassigned matrix
  const weekDays = getDaysInWeek(currentMonday).map((d) => {
    const dateStr = d.dateStr;
    const assignment = assignmentsMap[dateStr] || null;
    const unassigned = assignmentService.getUnassignedEmployees(dateStr, weeklySchedule, shifts, assignment);
    return {
      dayName: d.dayName,
      date: dateStr,
      unassigned,
    };
  });

  const totalWeekUnassigned = weekDays.reduce((acc, curr) => acc + curr.unassigned.length, 0);

  // Swap Requests data
  const allSwapRequests = useMemo(() => {
    return storageService.getSwapRequests(currentMonday);
  }, [currentMonday, assignmentsMap]);

  const pendingSwapRequests = useMemo(() => {
    return allSwapRequests.filter((r) => r.status === 'pending');
  }, [allSwapRequests]);

  const filteredSwapRequests = useMemo(() => {
    return allSwapRequests.filter((r) => {
      if (swapStatusFilter === 'pending') return r.status === 'pending';
      if (swapStatusFilter === 'resolved') return r.status !== 'pending';
      return true;
    });
  }, [allSwapRequests, swapStatusFilter]);

  // Handler: Approve Swap Request & remove from counter (makes slot open and employee unassigned)
  const handleApproveToUnassigned = (req: ShiftSwapRequest) => {
    const targetAssignment = assignmentsMap[req.date];
    if (targetAssignment) {
      const newAssignments: Record<string, CounterDayAssignment> = {
        ...targetAssignment.assignments,
      };
      if (newAssignments[req.counterId]) {
        newAssignments[req.counterId] = {
          ...newAssignments[req.counterId],
          [req.slot]: null,
        };
      }
      const updated: DayDwsAssignment = {
        ...targetAssignment,
        assignments: newAssignments,
        updatedAt: new Date().toISOString(),
      };
      storageService.saveAssignment(updated);
    }

    storageService.updateSwapRequestStatus(req.id, 'approved', {
      resolvedBy: 'Quản lý Thu ngân',
      resolvedNote: 'Đã duyệt hủy ca trực và đưa nhân viên về danh sách chưa phân quầy',
    });

    success(
      'Đã duyệt yêu cầu đổi ca',
      `Đã giải phóng quầy ${req.counterNumber} (${req.slot === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}) cho ${req.employeeName}.`
    );
    onDataChanged();
  };

  // Handler: Assign a specific replacement candidate into the swap requested slot
  const handleAssignReplacement = (req: ShiftSwapRequest, replacementEmp: UnassignedEmployee) => {
    const targetAssignment = assignmentsMap[req.date];
    if (targetAssignment) {
      const newAssignments: Record<string, CounterDayAssignment> = {
        ...targetAssignment.assignments,
      };
      if (!newAssignments[req.counterId]) {
        newAssignments[req.counterId] = { counterId: req.counterId };
      }
      newAssignments[req.counterId] = {
        ...newAssignments[req.counterId],
        [req.slot]: {
          employeeId: replacementEmp.employeeId,
          employeeName: replacementEmp.fullName,
          shiftCode: replacementEmp.shiftCode,
          startTime: replacementEmp.startTime,
          endTime: replacementEmp.endTime,
          assignedAt: new Date().toISOString(),
          swapRequested: false,
        },
      };
      const updated: DayDwsAssignment = {
        ...targetAssignment,
        assignments: newAssignments,
        updatedAt: new Date().toISOString(),
      };
      storageService.saveAssignment(updated);
    }

    storageService.updateSwapRequestStatus(req.id, 'approved', {
      resolvedBy: 'Quản lý Thu ngân',
      swappedWithEmployeeName: replacementEmp.fullName,
      swappedWithEmployeeId: replacementEmp.employeeId,
      resolvedNote: `Đã phân ${replacementEmp.fullName} thay thế vị trí của ${req.employeeName}`,
    });

    success(
      'Đã phân người thay thế thành công!',
      `Đã xếp ${replacementEmp.fullName} vào Quầy ${req.counterNumber} thay thế cho ${req.employeeName}.`
    );
    onDataChanged();
  };

  // Handler: Reject / Dismiss Swap Request
  const handleRejectSwapRequest = (req: ShiftSwapRequest) => {
    const targetAssignment = assignmentsMap[req.date];
    if (targetAssignment?.assignments?.[req.counterId]?.[req.slot]) {
      const newAssignments: Record<string, CounterDayAssignment> = {
        ...targetAssignment.assignments,
      };
      newAssignments[req.counterId] = {
        ...newAssignments[req.counterId],
        [req.slot]: {
          ...newAssignments[req.counterId][req.slot]!,
          swapRequested: false,
          swapRequestId: undefined,
          swapReason: undefined,
        },
      };
      const updated: DayDwsAssignment = {
        ...targetAssignment,
        assignments: newAssignments,
        updatedAt: new Date().toISOString(),
      };
      storageService.saveAssignment(updated);
    }

    storageService.updateSwapRequestStatus(req.id, 'rejected', {
      resolvedBy: 'Quản lý Thu ngân',
      resolvedNote: 'Yêu cầu không được phê duyệt',
    });

    info('Đã từ chối yêu cầu', `Đã giữ nguyên ca trực của ${req.employeeName}.`);
    onDataChanged();
  };

  const sortStaff = (list: typeof singleDayUnassigned) => {
    return [...list].sort((a, b) => {
      const isAAfternoon = a.category === 'afternoon' || (a.category === 'other' && (!a.startTime || a.startTime >= '12:30'));
      const isBAfternoon = b.category === 'afternoon' || (b.category === 'other' && (!b.startTime || b.startTime >= '12:30'));
      if (isAAfternoon && isBAfternoon) {
        const aCode = (a.shiftCode || '').toUpperCase().trim();
        const bCode = (b.shiftCode || '').toUpperCase().trim();
        const aIsV6 = aCode.startsWith('V6') || aCode.startsWith('6');
        const bIsV6 = bCode.startsWith('V6') || bCode.startsWith('6');
        if (aIsV6 && !bIsV6) return -1;
        if (!aIsV6 && bIsV6) return 1;
      }
      const timeA = a.startTime || '99:99';
      const timeB = b.startTime || '99:99';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      if (a.shiftCode !== b.shiftCode) return a.shiftCode.localeCompare(b.shiftCode);
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
  };

  const filteredSingleDay = sortStaff(
    singleDayUnassigned.filter(
      (emp) =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        emp.shiftCode.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div id="unassigned-page" className="space-y-4 max-w-7xl mx-auto pb-16 px-1 sm:px-3">
      {/* Top Banner */}
      <div className="neu-panel p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Đổi ca & nhân viên chờ xếp
                {pendingSwapRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    {pendingSwapRequests.length} đổi ca
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý nhân viên chờ xếp quầy và duyệt yêu cầu đổi ca trực giữa các thu ngân
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80 text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewMode('single_day')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'single_day'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chờ xếp hôm nay
          </button>
          <button
            type="button"
            onClick={() => setViewMode('full_week')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer tabular-nums ${
              viewMode === 'full_week'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chờ xếp cả tuần ({totalWeekUnassigned})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('swap_requests')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 tabular-nums ${
              viewMode === 'swap_requests'
                ? 'bg-white text-amber-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
            <span>Yêu cầu đổi ca ({pendingSwapRequests.length})</span>
          </button>
        </div>
      </div>

      {/* Pending Swap Requests Notification Banner (shown if not already on swap tab) */}
      {viewMode !== 'swap_requests' && pendingSwapRequests.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
              <ArrowLeftRight className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold block">
                Có {pendingSwapRequests.length} nhân viên đang đề nghị đổi ca (Swap Requested)
              </span>
              <p className="text-[11px] text-amber-800">
                {pendingSwapRequests.slice(0, 3).map((r) => `${r.employeeName} (Q.${r.counterNumber})`).join(', ')}
                {pendingSwapRequests.length > 3 ? ` và ${pendingSwapRequests.length - 3} người khác...` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('swap_requests')}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1 cursor-pointer transition-all"
          >
            <span>Xem & duyệt ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {weeklySchedule.length === 0 ? (
        <EmptyState
          title="Chưa có dữ liệu ca làm việc tuần"
          description="Vui lòng nạp file Excel Ca làm việc tuần để hệ thống nhận diện nhân viên đi làm và ca nghỉ."
          actionText="Chuyển đến trang DWS Tuần"
          onAction={onNavigateToDws}
        />
      ) : viewMode === 'swap_requests' ? (
        /* === SWAP REQUESTS MANAGEMENT TAB === */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-teal-700" /> Trạng thái:
              </span>
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSwapStatusFilter('all')}
                  className={`px-3 py-1 font-bold rounded-lg cursor-pointer transition-all ${
                    swapStatusFilter === 'all'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({allSwapRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSwapStatusFilter('pending')}
                  className={`px-3 py-1 font-bold rounded-lg cursor-pointer transition-all ${
                    swapStatusFilter === 'pending'
                      ? 'bg-amber-500 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chờ duyệt ({pendingSwapRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSwapStatusFilter('resolved')}
                  className={`px-3 py-1 font-bold rounded-lg cursor-pointer transition-all ${
                    swapStatusFilter === 'resolved'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã xử lý ({allSwapRequests.length - pendingSwapRequests.length})
                </button>
              </div>
            </div>

            <span className="text-xs text-slate-500">
              Tuần làm việc: <strong className="text-slate-800 font-mono">{currentMonday}</strong>
            </span>
          </div>

          {filteredSwapRequests.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">
                {swapStatusFilter === 'pending'
                  ? '🎉 Không có yêu cầu đổi ca nào đang chờ duyệt!'
                  : 'Không có bản ghi yêu cầu đổi ca nào.'}
              </h4>
              <p className="text-xs text-slate-500">
                Nhân viên có thể trực tiếp gửi yêu cầu đổi ca (Swap Requested) từ giao diện DWS Tuần.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSwapRequests.map((req) => {
                const targetCounter = counters.find((c) => c.id === req.counterId);
                const zone = targetCounter ? getCounterZone(targetCounter) : 'Siêu thị';
                const zoneBadge = getZoneBadgeConfig(zone);
                const isPending = req.status === 'pending';

                // Find candidate replacement cashiers from the unassigned list on that date
                const dayAssignment = assignmentsMap[req.date] || null;
                const dayUnassigned = assignmentService.getUnassignedEmployees(
                  req.date,
                  weeklySchedule,
                  shifts,
                  dayAssignment
                );

                // Score candidates using autoSuggestService
                const candidateSuggestions = targetCounter
                  ? autoSuggestService
                      .getSuggestionsForSlot({
                        targetCounterId: req.counterId,
                        targetSlot: req.slot,
                        selectedDate: req.date,
                        unassignedEmployees: dayUnassigned,
                        counters,
                        shifts,
                        weeklySchedule,
                        currentAssignment: dayAssignment,
                      })
                      .filter((s) => s.isEligible && s.matchScore >= 50)
                      .slice(0, 3)
                  : [];

                return (
                  <div
                    key={req.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isPending
                        ? 'bg-white border-amber-300 shadow-sm ring-1 ring-amber-200/50'
                        : 'bg-slate-50/80 border-slate-200 opacity-80'
                    }`}
                  >
                    {/* Header: Employee + Shift + Counter Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 font-mono font-black text-xs flex items-center justify-center border border-amber-200 shrink-0">
                          {req.counterNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900">
                              {req.employeeName}
                            </span>
                            {req.employeeId && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{req.employeeId}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>Ngày: <strong className="font-mono text-slate-700">{req.date}</strong></span>
                            <span>•</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-bold border ${zoneBadge.bg} ${zoneBadge.text} ${zoneBadge.border}`}
                            >
                              {zone}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black border inline-flex items-center gap-1 ${
                            req.slot === 'morning'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                          }`}
                        >
                          {req.slot === 'morning' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                          <span>Ca {req.shiftCode} ({req.slot === 'morning' ? 'Sáng' : 'Chiều'})</span>
                        </span>

                        <div className="mt-1">
                          {req.status === 'pending' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-2xs">
                              Chờ duyệt
                            </span>
                          ) : req.status === 'approved' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Đã duyệt
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                              Đã từ chối / Hủy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reason & Details */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold text-[11px]">Lý do:</span>
                        {req.urgent && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" /> Cần gấp
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-800">{req.reason}</div>
                      {req.customNote && (
                        <p className="text-[11px] text-slate-600 italic">"{req.customNote}"</p>
                      )}
                      <div className="text-[10px] text-teal-800 font-semibold pt-0.5">
                        Nguyện vọng: {req.preferredTarget || 'Bất kỳ ca nào'}
                      </div>
                    </div>

                    {/* Smart Replacement Suggestions (If Pending) */}
                    {isPending && candidateSuggestions.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-teal-900 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-teal-700" />
                            Gợi ý người thay thế phù hợp ({candidateSuggestions.length} NV):
                          </span>
                        </div>
                        <div className="space-y-1">
                          {candidateSuggestions.map((cand) => (
                            <div
                              key={cand.employee.fullName}
                              className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-teal-200/80 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{cand.employee.fullName}</span>
                                <span className="font-mono text-[10px] text-teal-800">
                                  [{cand.employee.shiftCode}]
                                </span>
                                <span className="text-[10px] font-mono font-bold text-emerald-700">
                                  {cand.matchScore}%
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAssignReplacement(req, cand.employee)}
                                className="px-2 py-0.5 text-[10px] font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-md flex items-center gap-0.5 cursor-pointer shadow-3xs transition-all"
                              >
                                <Zap className="w-2.5 h-2.5 fill-teal-200 text-teal-800" />
                                <span>Phân thay thế</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolved Info if already processed */}
                    {!isPending && req.resolvedNote && (
                      <div className="text-[11px] text-slate-500 italic p-2 rounded-lg bg-white border border-slate-200">
                        {req.resolvedNote}
                      </div>
                    )}

                    {/* Pending Action Buttons */}
                    {isPending && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleRejectSwapRequest(req)}
                          className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveToUnassigned(req)}
                          className="px-3 py-1 text-xs font-extrabold text-white bg-teal-800 hover:bg-teal-900 rounded-xl flex items-center gap-1 cursor-pointer shadow-2xs transition-all"
                        >
                          <Check className="w-3 h-3 text-teal-200" />
                          <span>Duyệt & Đưa về Chưa phân</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === 'single_day' ? (
        <div className="space-y-4">
          {/* Day selection tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {weekDays.map((wd) => (
              <button
                key={wd.date}
                type="button"
                onClick={() => onSelectDate(wd.date)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-2 backdrop-blur-md ${
                  selectedDate === wd.date
                    ? 'bg-teal-700 text-white border-transparent shadow-xs font-bold'
                    : 'glass-card text-slate-700 border-white/70 hover:bg-white/90'
                }`}
              >
                <span>
                  {wd.dayName} ({wd.date.slice(5)})
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedDate === wd.date ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {wd.unassigned.length}
                </span>
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã NV, mã ca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs glass-input rounded-xl focus:outline-hidden"
            />
          </div>

          {/* Table */}
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 py-3.5 border-b border-white/60 bg-white/40 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                {singleDayUnassigned.length} nhân viên chưa phân quầy trong ngày ({selectedDate})
              </span>

              <button
                type="button"
                onClick={onNavigateToDws}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:underline cursor-pointer"
              >
                Vào phân quầy ngay <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {filteredSingleDay.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm font-medium">
                {singleDayUnassigned.length === 0
                  ? '🎉 Tất cả nhân viên đi làm hôm nay đã được phân quầy đầy đủ!'
                  : 'Không tìm thấy nhân viên phù hợp tìm kiếm.'}
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full border-collapse">
                  <thead className="bg-white/50 text-slate-700 font-bold border-b border-white/60">
                    <tr>
                      <th className="py-3 px-4 text-left w-14">STT</th>
                      <th className="py-3 px-4 text-left">Họ và tên</th>
                      <th className="py-3 px-4 text-left">Mã nhân viên</th>
                      <th className="py-3 px-4 text-left">Mã ca</th>
                      <th className="py-3 px-4 text-left">Khung giờ</th>
                      <th className="py-3 px-4 text-left">Phân loại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/60">
                    {filteredSingleDay.map((emp, idx) => (
                      <tr key={idx} className="hover:bg-white/60 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono font-medium">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{emp.fullName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600 font-medium">{emp.employeeId || '-'}</td>
                        <td className="py-3 px-4 font-black font-mono text-teal-800">{emp.shiftCode}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono font-medium">
                          {emp.startTime && emp.endTime ? `${emp.startTime} - ${emp.endTime}` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              emp.category === 'morning'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                            }`}
                          >
                            {emp.category === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Excluded / Resigned Employees Section ("Không phân quầy") */}
          {singleDayExcluded.length > 0 && (
            <div className="neu-panel overflow-hidden border border-rose-200/80">
              <div className="px-4 py-3 border-b border-rose-100 bg-rose-50/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-rose-950">
                    Danh sách Không phân quầy trong ngày ({singleDayExcluded.length} nhân viên)
                  </span>
                </div>
                <span className="text-[11px] text-rose-700 font-medium">
                  Mặc định loại trừ khỏi xếp quầy tự động &amp; thủ công
                </span>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-left w-14">STT</th>
                      <th className="py-2.5 px-4 text-left">Họ và tên</th>
                      <th className="py-2.5 px-4 text-left">Mã nhân viên</th>
                      <th className="py-2.5 px-4 text-left">Mã ca</th>
                      <th className="py-2.5 px-4 text-left">Khung giờ</th>
                      <th className="py-2.5 px-4 text-left">Trạng thái / Ghi chú (Note)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {singleDayExcluded.map((emp, idx) => (
                      <tr key={idx} className="bg-rose-50/15 hover:bg-rose-50/30 transition-colors">
                        <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">{emp.fullName}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{emp.employeeId || '-'}</td>
                        <td className="py-2.5 px-4 font-bold font-mono text-slate-700">{emp.shiftCode}</td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono">
                          {emp.startTime && emp.endTime ? `${emp.startTime} - ${emp.endTime}` : '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Không phân quầy
                            </span>
                            {emp.exclusionNote && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                                Note: {emp.exclusionNote}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Full Week Matrix Overview */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weekDays.map((wd) => (
            <div key={wd.date} className="glass-panel p-4 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-slate-900">
                    {wd.dayName} ({formatDisplayDate(wd.date)})
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    wd.unassigned.length > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {wd.unassigned.length} chưa phân
                </span>
              </div>

              {wd.unassigned.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs italic">
                  Đã phân đủ 100% nhân viên
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                  {sortStaff(wd.unassigned).map((emp, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-xl bg-white/60 border border-white/80 flex items-center justify-between text-[11.5px]"
                    >
                      <div className="font-bold text-slate-900 truncate mr-2">{emp.fullName}</div>
                      <span className="font-mono font-bold text-teal-800 shrink-0">
                        {emp.shiftCode}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onSelectDate(wd.date);
                  onNavigateToDws();
                }}
                className="w-full py-2 text-xs font-bold text-teal-800 hover:text-teal-900 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <span>Phân quầy ngày này</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
