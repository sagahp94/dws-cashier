import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Counter, UnassignedEmployee, SlotAssignment, Shift, WeeklyScheduleEntry } from '../../types';
import {
  Search,
  Sun,
  Moon,
  Check,
  UserPlus,
  Filter,
  Info,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Store,
  Zap,
  TrendingUp,
  Award,
  ArrowRight,
} from 'lucide-react';
import { getCounterZone, getZoneBadgeConfig, getEmployeeRecentZoneSummary } from '../../services/zoneTrackingService';
import { checkConsecutiveTwoDayWarning } from '../../services/consecutiveWarningService';
import {
  shiftDemandService,
  getCounterMorningRequiredShift,
  isShiftMatchingMorningGroup,
} from '../../services/shiftDemandService';
import { autoSuggestService, EmployeeSuggestion } from '../../services/autoSuggestService';

interface AssignEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCounterId: string;
  targetSlot: 'morning' | 'afternoon';
  counters: Counter[];
  unassignedEmployees: UnassignedEmployee[];
  preselectedEmployee?: UnassignedEmployee | null;
  selectedDate?: string;
  shifts?: Shift[];
  weeklySchedule?: WeeklyScheduleEntry[];
  onConfirm: (counterId: string, slot: 'morning' | 'afternoon', emp: UnassignedEmployee) => void;
}

interface EmployeeMetadataItem {
  evaluation: EmployeeSuggestion;
  recentSummary: ReturnType<typeof getEmployeeRecentZoneSummary>;
  twoDayWarning: ReturnType<typeof checkConsecutiveTwoDayWarning>;
  willCause3DaysWarning: boolean;
  isCapableForTarget: boolean;
  stoodAtTargetCounterRecent: boolean;
}

export const AssignEmployeeModal: React.FC<AssignEmployeeModalProps> = ({
  isOpen,
  onClose,
  targetCounterId,
  targetSlot,
  counters,
  unassignedEmployees,
  preselectedEmployee = null,
  selectedDate = new Date().toISOString().split('T')[0],
  shifts = [],
  weeklySchedule = [],
  onConfirm,
}) => {
  const [selectedCounterId, setSelectedCounterId] = useState(targetCounterId);
  const [selectedSlot, setSelectedSlot] = useState<'morning' | 'afternoon'>(targetSlot);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<UnassignedEmployee | null>(preselectedEmployee);
  const [onlyMatchingShift, setOnlyMatchingShift] = useState(true);
  const [sortBy, setSortBy] = useState<'match' | 'time'>('match');

  // Sync state when props change
  useEffect(() => {
    setSelectedCounterId(targetCounterId);
    setSelectedSlot(targetSlot);
    setSelectedEmp(preselectedEmployee || null);
    setSearchTerm('');
    setOnlyMatchingShift(true);
    setSortBy('match');
  }, [targetCounterId, targetSlot, preselectedEmployee, isOpen]);

  const targetCounter = counters.find((c) => c.id === selectedCounterId) || {
    id: selectedCounterId,
    counterNumber: selectedCounterId,
    area: 'Siêu thị',
  };
  const targetCounterNum = targetCounter?.counterNumber || selectedCounterId;
  const targetZone = getCounterZone(targetCounter || selectedCounterId);
  const targetZoneBadge = getZoneBadgeConfig(targetZone);

  // Determine if target counter requires a specific morning shift (V815, V818, V820)
  const morningRequiredGroup = selectedSlot === 'morning'
    ? (targetCounter ? getCounterMorningRequiredShift(targetCounter) : getCounterMorningRequiredShift(selectedCounterId))
    : null;

  // Precompute Heuristic Suggestions & Streak / Warning metadata once for all candidates
  const employeeMetadataMap = useMemo(() => {
    const map = new Map<string, EmployeeMetadataItem>();

    unassignedEmployees.forEach((emp) => {
      const evaluation = autoSuggestService.evaluateCandidate({
        employee: emp,
        targetCounter,
        targetSlot: selectedSlot,
        selectedDate,
        counters,
        shifts,
        weeklySchedule,
      });

      const recent = getEmployeeRecentZoneSummary(
        emp.fullName,
        emp.employeeId,
        selectedDate,
        counters,
        emp.isSup
      );

      const willCause3DaysWarning =
        !recent.isExemptFromStreakWarning &&
        recent.streakZone === targetZone &&
        recent.streakCount >= 2;

      const twoDayWarning = selectedDate
        ? checkConsecutiveTwoDayWarning(
            emp.fullName,
            emp.employeeId,
            selectedDate,
            selectedCounterId,
            counters,
            undefined,
            emp.isSup
          )
        : null;

      const isCapableForTarget =
        emp.isSup ||
        (targetZone === 'Bánh mì'
          ? !!emp.canBanhMy
          : targetZone === 'Delica'
          ? !!emp.canDelica
          : emp.canSieuThi !== false);

      const targetCounterNumStr = (targetCounter?.counterNumber || '').toLowerCase();
      const selectedCounterIdStr = selectedCounterId.toLowerCase();
      const stoodAtTargetCounterRecent =
        !emp.isSup &&
        recent.recentCounters.some(
          (rc) =>
            rc.counterId.toLowerCase() === selectedCounterIdStr ||
            rc.counterNumber.toLowerCase() === targetCounterNumStr
        );

      map.set(emp.fullName, {
        evaluation,
        recentSummary: recent,
        twoDayWarning,
        willCause3DaysWarning,
        isCapableForTarget,
        stoodAtTargetCounterRecent,
      });
    });
    return map;
  }, [
    unassignedEmployees,
    targetCounter,
    selectedCounterId,
    selectedSlot,
    selectedDate,
    counters,
    shifts,
    weeklySchedule,
    targetZone,
  ]);

  // Top #1 suggested candidate
  const topSuggestedCandidate = useMemo(() => {
    const valid = (Array.from(employeeMetadataMap.values()) as EmployeeMetadataItem[])
      .map((item) => item.evaluation)
      .filter((s) => s.matchScore >= 60 && s.isEligible)
      .sort((a, b) => b.matchScore - a.matchScore);
    return valid[0] || null;
  }, [employeeMetadataMap]);

  // Recommendations for the currently selected employee or shift
  const shiftRecommendations = useMemo(() => {
    if (!selectedEmp) return null;
    return shiftDemandService.getRecommendedCountersForEmployee(
      selectedEmp.shiftCode,
      selectedDate,
      counters
    );
  }, [selectedEmp, selectedDate, counters]);

  // Check if employee is compatible with the selected slot and counter rules
  const isEmployeeMatchingSlot = (emp: UnassignedEmployee, slot: 'morning' | 'afternoon') => {
    if (slot === 'morning') {
      if (morningRequiredGroup) {
        return isShiftMatchingMorningGroup(emp.shiftCode, morningRequiredGroup);
      }
      return (
        emp.category === 'morning' ||
        (emp.category === 'other' && (!emp.startTime || emp.startTime < '12:30')) ||
        emp.shiftCode.toUpperCase().startsWith('V815') ||
        emp.shiftCode.toUpperCase().startsWith('V818') ||
        emp.shiftCode.toUpperCase().startsWith('V820')
      );
    } else {
      return (
        emp.category === 'afternoon' ||
        (emp.category === 'other' && emp.startTime >= '12:30')
      );
    }
  };

  // Filter & sort employees
  const filteredEmployees = unassignedEmployees
    .filter((emp) => {
      const matchesSearch =
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        emp.shiftCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.shiftType.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (onlyMatchingShift) {
        return isEmployeeMatchingSlot(emp, selectedSlot);
      }

      return true;
    })
    .sort((a, b) => {
      const metaA = employeeMetadataMap.get(a.fullName);
      const metaB = employeeMetadataMap.get(b.fullName);

      if (sortBy === 'match') {
        const scoreA = metaA?.evaluation?.matchScore ?? 0;
        const scoreB = metaB?.evaluation?.matchScore ?? 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
      }

      // For afternoon slot: prioritize V6* before V8*
      if (selectedSlot === 'afternoon') {
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

  const matchingCount = unassignedEmployees.filter((e) => isEmployeeMatchingSlot(e, selectedSlot)).length;
  const totalUnassigned = unassignedEmployees.length;

  const handleSlotChange = (newSlot: 'morning' | 'afternoon') => {
    setSelectedSlot(newSlot);
    if (selectedEmp && onlyMatchingShift && !isEmployeeMatchingSlot(selectedEmp, newSlot)) {
      setSelectedEmp(null);
    }
  };

  const handleDirectConfirm = (emp: UnassignedEmployee) => {
    onConfirm(selectedCounterId, selectedSlot, emp);
    onClose();
  };

  const handleSave = () => {
    if (!selectedEmp) return;
    handleDirectConfirm(selectedEmp);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
            <UserPlus className="w-5 h-5 text-teal-700" />
          </div>
          <span className="font-bold text-slate-900">Phân nhân viên vào quầy</span>
        </div>
      }
      description={`Chọn nhân viên cho Quầy ${targetCounter?.counterNumber || selectedCounterId} (${
        selectedSlot === 'morning' ? 'Ca Sáng' : 'Ca Chiều'
      }) • Khu vực: ${targetZone}`}
      maxWidth="6xl"
      bodyClassName="p-3 sm:p-4 max-h-[86vh] overflow-y-auto"
    >
      <div className="space-y-2.5">
        {/* Slot selector & Counter picker & Zone Info */}
        <div className="p-2.5 sm:p-3 glass-panel rounded-2xl space-y-2 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            <div className="sm:col-span-7">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">Chọn Quầy:</label>
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${targetZoneBadge.bg} ${targetZoneBadge.text} ${targetZoneBadge.border}`}>
                  {targetZone}
                </span>
              </div>
              <select
                value={selectedCounterId}
                onChange={(e) => setSelectedCounterId(e.target.value)}
                className="w-full text-xs font-semibold py-2 px-2.5 glass-input rounded-xl focus:ring-2 focus:ring-teal-700 focus:outline-hidden cursor-pointer"
              >
                {counters.map((c, idx) => {
                  const z = getCounterZone(c);
                  const isRec = shiftRecommendations?.priorityCounters.some((rc) => rc.id === c.id);
                  return (
                    <option key={`assign_modal_counter_${c.id}_${idx}`} value={c.id}>
                      {isRec ? '★ [Ưu tiên Ca] ' : ''}Quầy {c.counterNumber} ({c.area}) - [{z}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Ca làm việc cần phân:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSlotChange('morning')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedSlot === 'morning'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-[0_2px_8px_rgba(245,158,11,0.3)]'
                      : 'glass-card text-slate-700 hover:bg-white/90 border-white/80'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" /> Sáng
                </button>
                <button
                  type="button"
                  onClick={() => handleSlotChange('afternoon')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedSlot === 'afternoon'
                      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                      : 'glass-card text-slate-700 hover:bg-white/90 border-white/80'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" /> Chiều
                </button>
              </div>
            </div>
          </div>

          {/* Top #1 Heuristic Auto-Suggest Highlight Box */}
          {topSuggestedCandidate && (
            <div className="p-2.5 bg-gradient-to-r from-amber-50 via-teal-50 to-emerald-50 rounded-xl border border-teal-300/80 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 rounded-lg bg-amber-500 text-white shadow-2xs">
                    <Zap className="w-3 h-3 fill-white" />
                  </span>
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                    Gợi ý tối ưu (#1 Auto-Suggest):
                  </span>
                  <span className="text-xs font-black text-teal-900 font-sans">
                    {topSuggestedCandidate.employee.fullName}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-900 border border-teal-200">
                    Ca {topSuggestedCandidate.employee.shiftCode}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {topSuggestedCandidate.matchScore}% Phù hợp
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmp(topSuggestedCandidate.employee);
                      handleDirectConfirm(topSuggestedCandidate.employee);
                    }}
                    className="px-2.5 py-1 text-xs font-extrabold text-white bg-teal-800 hover:bg-teal-900 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <Check className="w-3 h-3 text-teal-200" />
                    <span>Gán ngay</span>
                  </button>
                </div>
              </div>

              {/* Top reasons preview */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                {topSuggestedCandidate.reasons.slice(0, 3).map((r, rIdx) => (
                  <span
                    key={rIdx}
                    className={`px-1.5 py-0.2 rounded flex items-center gap-1 ${
                      r.type === 'positive'
                        ? 'bg-white text-emerald-900 border border-emerald-200'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{r.icon || '•'}</span>
                    <span>{r.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Counter required shift priority notice banner */}
        {selectedSlot === 'morning' && morningRequiredGroup ? (
          <div className="px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 flex items-center justify-between gap-2 shadow-2xs text-xs">
            <div className="flex items-center gap-1.5 font-bold flex-wrap">
              <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Quầy {targetCounterNum} ca sáng yêu cầu:</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-mono font-black text-[10px] border border-amber-300">
                Ca {morningRequiredGroup}
              </span>
            </div>
            <span className="text-[10.5px] text-amber-800 hidden md:inline">
              {morningRequiredGroup === 'V815' && 'Quy tắc: Quầy SSC, 17, 21, 23, 104-106, 110, 111, 114'}
              {morningRequiredGroup === 'V818' && 'Quy tắc: Quầy 13, 15, 20, 22, 24, 25, 102'}
              {morningRequiredGroup === 'V820' && 'Quy tắc: Quầy 11, 26, 27, 103, 108, 109, 112'}
            </span>
          </div>
        ) : selectedSlot === 'afternoon' ? (
          <div className="px-3 py-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 flex items-center gap-2 shadow-2xs text-xs">
            <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-bold text-[11px]">Ca Chiều: Tự động ưu tiên nhân viên ca V6* trước ca V8*</span>
          </div>
        ) : null}

        {/* Employee Search & Filter Controls Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Tìm nhân viên ${selectedSlot === 'morning' ? 'Ca Sáng' : 'Ca Chiều'} theo tên, mã NV...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-2 text-xs glass-input rounded-xl focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            {/* Sort Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-[11px]">
              <button
                type="button"
                onClick={() => setSortBy('match')}
                className={`px-2 py-0.5 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 ${
                  sortBy === 'match'
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Độ khớp</span>
              </button>
              <button
                type="button"
                onClick={() => setSortBy('time')}
                className={`px-2 py-0.5 font-bold rounded-lg cursor-pointer transition-all ${
                  sortBy === 'time'
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Giờ làm
              </button>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10.5px] font-bold ${
                selectedSlot === 'morning'
                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                  : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
              }`}
            >
              {selectedSlot === 'morning' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
              <span>{morningRequiredGroup ? `Ca ${morningRequiredGroup}: ` : ''}{filteredEmployees.length}/{matchingCount} NV</span>
            </span>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 hover:text-slate-900 select-none font-semibold">
              <input
                type="checkbox"
                checked={onlyMatchingShift}
                onChange={(e) => setOnlyMatchingShift(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer accent-teal-700"
              />
              <span>{morningRequiredGroup ? `Chỉ ca ${morningRequiredGroup}` : 'Chỉ ca chuẩn'}</span>
            </label>
          </div>
        </div>

        {/* Employee Grid (2, 3 or 4 columns based on screen width) */}
        <div className="max-h-[60vh] overflow-y-auto glass-panel rounded-2xl p-2 sm:p-2.5">
          {filteredEmployees.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-white/80 text-slate-400 flex items-center justify-center mx-auto mb-2 shadow-xs">
                <Info className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-700">
                {morningRequiredGroup
                  ? `Không có nhân viên ca ${morningRequiredGroup} nào chưa phân quầy`
                  : `Không có nhân viên ${selectedSlot === 'morning' ? 'Ca Sáng' : 'Ca Chiều'} nào chưa phân quầy`}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {onlyMatchingShift ? (
                  <span>
                    Tổng cộng có {totalUnassigned} nhân viên chưa phân hôm nay.{' '}
                    <button
                      type="button"
                      onClick={() => setOnlyMatchingShift(false)}
                      className="text-teal-700 underline font-bold cursor-pointer"
                    >
                      Bỏ lọc ca
                    </button>{' '}
                    để xem toàn bộ.
                  </span>
                ) : (
                  'Thử tìm kiếm với từ khóa khác.'
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredEmployees.map((emp, idx) => {
                const isSelected = selectedEmp?.fullName === emp.fullName;
                const isMorning = emp.category === 'morning' || (!emp.startTime || emp.startTime < '12:30');
                const meta = employeeMetadataMap.get(emp.fullName);
                const recent = meta?.recentSummary || { recentCounters: [], streakCount: 0, streakZone: '', isExemptFromStreakWarning: false };
                const willCause3DaysWarning = meta?.willCause3DaysWarning ?? false;
                const twoDayWarning = meta?.twoDayWarning ?? null;
                const evaluation = meta?.evaluation;
                const matchScore = evaluation?.matchScore ?? 50;
                const isCapableForTarget = meta?.isCapableForTarget ?? true;
                const stoodAtTargetCounterRecent = meta?.stoodAtTargetCounterRecent ?? false;

                return (
                  <div
                    key={`${emp.employeeId || emp.fullName}_${idx}`}
                    onClick={() => setSelectedEmp(emp)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      handleDirectConfirm(emp);
                    }}
                    title={emp.isSup ? "Nhân viên SUP (bỏ qua mọi cảnh báo)" : twoDayWarning ? twoDayWarning.message : "Nhấp đúp để phân vào quầy ngay lập tức"}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-teal-50/95 border-teal-600 ring-2 ring-teal-500/30 shadow-xs'
                        : matchScore >= 85
                        ? 'bg-white border-emerald-200/90 hover:border-emerald-400 hover:shadow-xs'
                        : emp.isSup
                        ? 'glass-card border-purple-200/90 hover:border-purple-400 hover:bg-purple-50/50 hover:shadow-xs'
                        : twoDayWarning
                        ? 'bg-amber-50/80 border-amber-300 hover:border-amber-400 hover:bg-amber-50 hover:shadow-xs'
                        : willCause3DaysWarning
                        ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300 hover:bg-amber-50/90 hover:shadow-xs'
                        : stoodAtTargetCounterRecent
                        ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 hover:shadow-xs'
                        : 'glass-card border-white/80 hover:border-teal-300 hover:bg-white/95 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Row: Name + ID + Shift Code + Score Badge */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate" title={emp.fullName}>
                            {emp.fullName}
                          </span>
                          {emp.isSup && (
                            <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-300 shrink-0">
                              SUP
                            </span>
                          )}
                          {emp.employeeId && (
                            <span className="text-[9.5px] text-slate-400 font-mono shrink-0">
                              #{emp.employeeId}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Match Score Badge */}
                        {evaluation && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black border ${evaluation.tierColor}`}
                            title={evaluation.tierLabel}
                          >
                            {matchScore}%
                          </span>
                        )}

                        <span
                          className={`px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold whitespace-nowrap ${
                            isMorning
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                          }`}
                        >
                          Ca {emp.shiftCode}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Heuristic Reasons Highlights */}
                    {evaluation && evaluation.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 text-[9.5px]">
                        {evaluation.reasons.slice(0, 2).map((r, rIdx) => (
                          <span
                            key={rIdx}
                            className={`px-1 py-0.2 rounded flex items-center gap-0.5 truncate max-w-full ${
                              r.type === 'positive'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : r.type === 'warning'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                            title={r.label}
                          >
                            <span>{r.icon || '•'}</span>
                            <span className="truncate">{r.label}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Warnings & Capability Alerts (only displayed when there is an issue) */}
                    {(twoDayWarning || willCause3DaysWarning || stoodAtTargetCounterRecent || (!emp.isSup && !isCapableForTarget)) && (
                      <div className="flex flex-col gap-1 text-[9px] leading-tight">
                        {!emp.isSup && twoDayWarning && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-950 border border-amber-300 truncate"
                            title={twoDayWarning.message}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                            <span className="truncate">{twoDayWarning.shortDescription}</span>
                          </span>
                        )}

                        {!emp.isSup && willCause3DaysWarning && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300 truncate">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            <span>Đã {recent.streakCount} ngày {targetZone}</span>
                          </span>
                        )}

                        {!emp.isSup && stoodAtTargetCounterRecent && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-200 truncate">
                            ⚠️ Đã đứng Q.{targetCounter?.counterNumber || selectedCounterId} trong 3 ngày qua
                          </span>
                        )}

                        {!emp.isSup && !isCapableForTarget && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-600 border border-slate-300 truncate">
                            ⚠️ Chưa cấu hình đứng {targetZone}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Compact Bottom Info: Recent 3-day history + Work Hours */}
                    <div className="pt-1 border-t border-slate-100/90 flex items-center justify-between gap-1 text-[9.5px]">
                      {recent.recentCounters.length > 0 ? (
                        <div className="text-slate-500 font-mono truncate" title="Lịch sử quầy gần nhất">
                          <span className="text-slate-400 font-sans">Gần đây:</span>{' '}
                          {recent.recentCounters.slice(0, 3).map((rc) => `Q.${rc.counterNumber}`).join(' → ')}
                        </div>
                      ) : (
                        <div />
                      )}

                      {emp.startTime && emp.endTime && (
                        <span className="text-slate-400 font-mono shrink-0 ml-auto">
                          {emp.startTime}-{emp.endTime}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Employee summary note */}
        {selectedEmp && (
          <div className="p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between flex-wrap gap-2 shadow-xs">
            <div>
              <span className="font-bold">Đã chọn:</span> {selectedEmp.fullName} (Ca {selectedEmp.shiftCode})
            </div>
            <div className="text-[11px] font-semibold text-emerald-700">
              → Quầy {targetCounter?.counterNumber || selectedCounterId} [{targetZone}] ({selectedSlot === 'morning' ? 'Sáng' : 'Chiều'})
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="glass-button-secondary px-4 py-1.5 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedEmp}
            className="glass-button-primary px-4 py-1.5 text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
          >
            Xác nhận phân quầy
          </button>
        </div>
      </div>
    </Modal>
  );
};
