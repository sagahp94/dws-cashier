import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import {
  Counter,
  Shift,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  UnassignedEmployee,
  SlotAssignment,
} from '../../types';
import {
  autoSuggestService,
  CounterSlotSuggestion,
  EmployeeSuggestion,
} from '../../services/autoSuggestService';
import { getCounterZone, getZoneBadgeConfig } from '../../services/zoneTrackingService';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Store,
  Sun,
  Moon,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Filter,
  Check,
} from 'lucide-react';
import { useToast } from '../common/ToastContainer';

interface AutoSuggestModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  counters: Counter[];
  shifts: Shift[];
  weeklySchedule: WeeklyScheduleEntry[];
  unassignedEmployees: UnassignedEmployee[];
  currentAssignment: DayDwsAssignment;
  onApplyAssignments: (
    assignments: { counterId: string; slot: 'morning' | 'afternoon'; employee: UnassignedEmployee }[]
  ) => void;
}

export const AutoSuggestModal: React.FC<AutoSuggestModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  counters,
  shifts,
  weeklySchedule,
  unassignedEmployees,
  currentAssignment,
  onApplyAssignments,
}) => {
  const { success, warning, info } = useToast();
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('all');
  const [chosenMap, setChosenMap] = useState<Record<string, string>>({}); // key = `${counterId}_${slot}`, value = employeeName

  // Compute all unassigned slot suggestions
  const slotSuggestions: CounterSlotSuggestion[] = useMemo(() => {
    if (!isOpen) return [];
    return autoSuggestService.getAllUnassignedSlotSuggestions({
      selectedDate,
      counters,
      shifts,
      weeklySchedule,
      unassignedEmployees,
      currentAssignment,
    });
  }, [
    isOpen,
    selectedDate,
    counters,
    shifts,
    weeklySchedule,
    unassignedEmployees,
    currentAssignment,
  ]);

  // Extract unique zones for filter
  const zones = useMemo(() => {
    const set = new Set<string>();
    counters.forEach((c) => {
      set.add(getCounterZone(c));
    });
    return Array.from(set);
  }, [counters]);

  // Filtered slot suggestions
  const filteredSlots = useMemo(() => {
    return slotSuggestions.filter((slotItem) => {
      if (selectedSlotFilter !== 'all' && slotItem.slot !== selectedSlotFilter) return false;
      if (selectedZoneFilter !== 'all') {
        const counter = counters.find((c) => c.id === slotItem.counterId);
        const z = counter ? getCounterZone(counter) : '';
        if (z !== selectedZoneFilter) return false;
      }
      return true;
    });
  }, [slotSuggestions, selectedSlotFilter, selectedZoneFilter, counters]);

  // Handle choosing a specific candidate for a slot
  const handleSelectCandidate = (slotKey: string, empName: string) => {
    setChosenMap((prev) => ({
      ...prev,
      [slotKey]: empName,
    }));
  };

  // 1-Click apply single slot
  const handleApplySingle = (slotItem: CounterSlotSuggestion) => {
    const slotKey = `${slotItem.counterId}_${slotItem.slot}`;
    const chosenName = chosenMap[slotKey] || slotItem.topSuggestion?.employee.fullName;

    if (!chosenName) {
      warning('Chưa có nhân viên phù hợp', 'Không có gợi ý nhân viên khả dụng cho ô này.');
      return;
    }

    const candidate = slotItem.allSuggestions.find((s) => s.employee.fullName === chosenName);
    if (!candidate) return;

    onApplyAssignments([
      {
        counterId: slotItem.counterId,
        slot: slotItem.slot,
        employee: candidate.employee,
      },
    ]);

    success(
      'Đã gán ca thành công',
      `Đã phân ${candidate.employee.fullName} vào ${slotItem.counterNumber} (${slotItem.slotLabel}).`
    );
  };

  // 1-Click apply all high-confidence suggestions with conflict resolution
  const handleApplyAll = () => {
    const assignedEmps = new Set<string>();
    const plan: {
      counterId: string;
      slot: 'morning' | 'afternoon';
      employee: UnassignedEmployee;
    }[] = [];

    filteredSlots.forEach((slotItem) => {
      const slotKey = `${slotItem.counterId}_${slotItem.slot}`;
      const chosenName = chosenMap[slotKey] || slotItem.topSuggestion?.employee.fullName;

      if (!chosenName) return;

      // Find candidate
      let candidate = slotItem.allSuggestions.find(
        (s) => s.employee.fullName === chosenName && !assignedEmps.has(s.employee.fullName)
      );

      // If user-chosen was already assigned elsewhere, pick next best available candidate
      if (!candidate) {
        candidate = slotItem.allSuggestions.find(
          (s) => !assignedEmps.has(s.employee.fullName) && s.matchScore >= 45
        );
      }

      if (candidate) {
        assignedEmps.add(candidate.employee.fullName);
        plan.push({
          counterId: slotItem.counterId,
          slot: slotItem.slot,
          employee: candidate.employee,
        });
      }
    });

    if (plan.length === 0) {
      warning('Không có ca nào để gán', 'Không tìm thấy nhân viên khả dụng chưa được phân bổ.');
      return;
    }

    onApplyAssignments(plan);
    success(
      'Áp dụng gợi ý thành công!',
      `Đã tự động gán ${plan.length} ca trực vào các quầy còn trống với độ khớp tối ưu.`
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Zap className="w-4 h-4 fill-amber-100" />
          </div>
          <div>
            <span className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
              Gợi ý thông minh (Auto-Suggest AI/Heuristics)
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {slotSuggestions.length} ô trống
              </span>
            </span>
            <p className="text-xs font-normal text-slate-500">
              Tự động phân tích ca làm việc, độ tương thích khu vực, kỹ năng và lịch sử hiệu suất
            </p>
          </div>
        </div>
      }
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Filters & Quick Actions Bar */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-teal-700" /> Lọc:
            </span>

            {/* Slot Filter */}
            <div className="inline-flex rounded-xl bg-white p-0.5 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSlotFilter('all')}
                className={`px-2.5 py-1 font-bold rounded-lg cursor-pointer transition-all ${
                  selectedSlotFilter === 'all'
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ca
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlotFilter('morning')}
                className={`px-2.5 py-1 font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all ${
                  selectedSlotFilter === 'morning'
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun className="w-3 h-3" />
                Ca Sáng
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlotFilter('afternoon')}
                className={`px-2.5 py-1 font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all ${
                  selectedSlotFilter === 'afternoon'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3 h-3" />
                Ca Chiều
              </button>
            </div>

            {/* Zone Filter */}
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-600 cursor-pointer"
            >
              <option value="all">Tất cả khu vực</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  Khu vực: {z}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Apply All Button */}
          <button
            type="button"
            onClick={handleApplyAll}
            disabled={filteredSlots.length === 0}
            className="px-3.5 py-1.5 text-xs font-black text-white bg-gradient-to-r from-amber-500 to-teal-700 hover:from-amber-600 hover:to-teal-800 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Áp dụng tất cả ({filteredSlots.length} ô)</span>
          </button>
        </div>

        {/* Suggestion Cards Grid / List */}
        {filteredSlots.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Không có ô trống nào cần phân quầy!</h4>
            <p className="text-xs text-slate-500">
              Tất cả các quầy phù hợp theo bộ lọc đã được phân công đầy đủ nhân sự.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[56vh] overflow-y-auto pr-1">
            {filteredSlots.map((slotItem) => {
              const counter = counters.find((c) => c.id === slotItem.counterId);
              const zone = counter ? getCounterZone(counter) : 'Siêu thị';
              const zoneBadge = getZoneBadgeConfig(zone);
              const slotKey = `${slotItem.counterId}_${slotItem.slot}`;
              const chosenName = chosenMap[slotKey] || slotItem.topSuggestion?.employee.fullName || '';
              const chosenCandidate =
                slotItem.allSuggestions.find((s) => s.employee.fullName === chosenName) ||
                slotItem.topSuggestion;

              return (
                <div
                  key={slotKey}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-teal-400 transition-all space-y-2.5"
                >
                  {/* Slot Target Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-800 font-mono font-black text-xs flex items-center justify-center border border-slate-200">
                        {slotItem.counterNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">
                            Quầy {slotItem.counterNumber}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${zoneBadge.bg} ${zoneBadge.text} ${zoneBadge.border}`}
                          >
                            {zone}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          {slotItem.slot === 'morning' ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                              <Sun className="w-3 h-3" /> Ca Sáng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
                              <Moon className="w-3 h-3" /> Ca Chiều
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Match Score Badge */}
                    {chosenCandidate && (
                      <div
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black border flex items-center gap-1 ${chosenCandidate.tierColor}`}
                        title="Độ phù hợp dựa trên thuật toán Heuristics"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{chosenCandidate.matchScore}%</span>
                        <span className="text-[10px] font-sans font-bold ml-0.5 hidden sm:inline">
                          ({chosenCandidate.tierLabel})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Candidate Selection Selector if multiple */}
                  {chosenCandidate ? (
                    <div className="space-y-2">
                      {/* Candidate Card */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900">
                              {chosenCandidate.employee.fullName}
                            </span>
                            {chosenCandidate.employee.isSup && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-black text-[9px] border border-amber-300">
                                SUP
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {chosenCandidate.employee.shiftCode} ({chosenCandidate.employee.startTime || '08:00'} - {chosenCandidate.employee.endTime || '17:00'})
                          </span>
                        </div>

                        {/* Top Heuristic Reasons */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {chosenCandidate.reasons.slice(0, 3).map((r, rIdx) => (
                            <span
                              key={rIdx}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                                r.type === 'positive'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : r.type === 'warning'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <span>{r.icon || '•'}</span>
                              <span className="truncate max-w-[220px]" title={r.label}>
                                {r.label}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Alternate candidates dropdown + 1-click apply */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {slotItem.allSuggestions.length > 1 ? (
                          <select
                            value={chosenName}
                            onChange={(e) => handleSelectCandidate(slotKey, e.target.value)}
                            className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-teal-600 max-w-[190px] cursor-pointer"
                          >
                            {slotItem.allSuggestions.map((s, sIdx) => (
                              <option key={s.employee.fullName} value={s.employee.fullName}>
                                #{sIdx + 1} {s.employee.fullName} ({s.matchScore}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[10px] text-slate-400">1 ứng viên duy nhất</span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleApplySingle(slotItem)}
                          className="px-3 py-1 text-xs font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 border border-teal-300 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Check className="w-3 h-3 text-teal-700" />
                          <span>Gán ca này</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center bg-slate-50 rounded-xl text-xs text-slate-400">
                      Không có nhân viên khả dụng cho ca này
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleApplyAll}
            disabled={filteredSlots.length === 0}
            className="px-4 py-2 text-xs font-extrabold text-white bg-teal-800 hover:bg-teal-900 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-40"
          >
            <Zap className="w-4 h-4 fill-teal-200 text-teal-800" />
            <span>Áp dụng gợi ý ({filteredSlots.length} ô)</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
