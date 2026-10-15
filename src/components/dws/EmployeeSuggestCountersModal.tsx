import React, { useMemo } from 'react';
import { Modal } from '../common/Modal';
import {
  Counter,
  Shift,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  UnassignedEmployee,
} from '../../types';
import {
  autoSuggestService,
  EmployeeSlotRecommendation,
} from '../../services/autoSuggestService';
import { getCounterZone, getZoneBadgeConfig } from '../../services/zoneTrackingService';
import {
  Sparkles,
  Zap,
  Check,
  Sun,
  Moon,
  Store,
  User,
  ArrowRight,
} from 'lucide-react';

interface EmployeeSuggestCountersModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: UnassignedEmployee | null;
  selectedDate: string;
  counters: Counter[];
  shifts: Shift[];
  weeklySchedule: WeeklyScheduleEntry[];
  currentAssignment: DayDwsAssignment;
  onAssignToCounter: (counterId: string, slot: 'morning' | 'afternoon', emp: UnassignedEmployee) => void;
}

export const EmployeeSuggestCountersModal: React.FC<EmployeeSuggestCountersModalProps> = ({
  isOpen,
  onClose,
  employee,
  selectedDate,
  counters,
  shifts,
  weeklySchedule,
  currentAssignment,
  onAssignToCounter,
}) => {
  const recommendations: EmployeeSlotRecommendation[] = useMemo(() => {
    if (!isOpen || !employee) return [];
    return autoSuggestService.getBestCountersForEmployee({
      employee,
      selectedDate,
      counters,
      shifts,
      weeklySchedule,
      currentAssignment,
    });
  }, [isOpen, employee, selectedDate, counters, shifts, weeklySchedule, currentAssignment]);

  if (!isOpen || !employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-teal-200" />
          </div>
          <div>
            <span className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              Gợi ý quầy tối ưu cho nhân viên
              <span className="text-teal-800 font-bold font-mono">[{employee.shiftCode}]</span>
            </span>
            <p className="text-xs font-normal text-slate-500">
              Nhân viên: <strong className="text-slate-800">{employee.fullName}</strong>
              {employee.employeeId ? ` (${employee.employeeId})` : ''} • Giờ làm:{' '}
              {employee.startTime || '08:00'} - {employee.endTime || '17:00'}
            </p>
          </div>
        </div>
      }
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <Store className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Không tìm thấy quầy trống phù hợp!</h4>
            <p className="text-xs text-slate-500">
              Hiện tại các quầy khớp với ca làm việc ({employee.shiftCode}) đã được phân bổ hoặc không còn ô trống.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {recommendations.map((rec, idx) => {
              const counter = counters.find((c) => c.id === rec.counterId);
              const zone = counter ? getCounterZone(counter) : 'Siêu thị';
              const zoneBadge = getZoneBadgeConfig(zone);

              return (
                <div
                  key={`${rec.counterId}_${rec.slot}`}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    idx === 0
                      ? 'bg-gradient-to-r from-teal-50/70 to-emerald-50/50 border-teal-300 shadow-xs ring-1 ring-teal-300/40'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-white shadow-2xs">
                          ⭐ ĐỀ XUẤT #1
                        </span>
                      )}
                      <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-900 font-mono font-black text-xs flex items-center justify-center border border-slate-200">
                        {rec.counterNumber}
                      </div>
                      <span className="text-xs font-black text-slate-900">
                        Quầy {rec.counterNumber}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${zoneBadge.bg} ${zoneBadge.text} ${zoneBadge.border}`}
                      >
                        {zone}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        {rec.slot === 'morning' ? (
                          <span className="text-amber-700 flex items-center gap-0.5">
                            <Sun className="w-3 h-3" /> Ca Sáng
                          </span>
                        ) : (
                          <span className="text-indigo-700 flex items-center gap-0.5">
                            <Moon className="w-3 h-3" /> Ca Chiều
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Breakdown Reasons */}
                    <div className="flex flex-wrap gap-1">
                      {rec.reasons.slice(0, 3).map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            r.type === 'positive'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : r.type === 'warning'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span>{r.icon || '•'}</span>
                          <span>{r.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono font-black text-teal-800">
                        {rec.matchScore}%
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold">Độ khớp</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAssignToCounter(rec.counterId, rec.slot, employee);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 text-xs font-extrabold text-white bg-teal-800 hover:bg-teal-900 rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                    >
                      <Check className="w-3.5 h-3.5 text-teal-200" />
                      <span>Gán vào quầy</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
