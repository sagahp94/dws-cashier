import React, { useMemo } from 'react';
import { WeeklyScheduleEntry, DayDwsAssignment } from '../../types';
import { getDaysInWeek, formatDateToYMD } from '../../utils/dateUtils';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface DaySelectorProps {
  mondayDate: string; // YYYY-MM-DD
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  weeklySchedule: WeeklyScheduleEntry[];
  assignmentsMap?: Record<string, DayDwsAssignment>;
}

export const DAYS_OF_WEEK = [
  { index: 1, name: 'Thứ 2', shortName: 'T2' },
  { index: 2, name: 'Thứ 3', shortName: 'T3' },
  { index: 3, name: 'Thứ 4', shortName: 'T4' },
  { index: 4, name: 'Thứ 5', shortName: 'T5' },
  { index: 5, name: 'Thứ 6', shortName: 'T6' },
  { index: 6, name: 'Thứ 7', shortName: 'T7' },
  { index: 7, name: 'Chủ Nhật', shortName: 'CN' },
];

export const DaySelector: React.FC<DaySelectorProps> = ({
  mondayDate,
  selectedDate,
  onSelectDate,
  weeklySchedule,
  assignmentsMap = {},
}) => {
  const days = useMemo(() => getDaysInWeek(mondayDate), [mondayDate]);
  const todayStr = useMemo(() => formatDateToYMD(new Date()), []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {days.map((day) => {
        const dateStr = day.dateStr;
        const isSelected = selectedDate === dateStr;
        const isToday = todayStr === dateStr;

        // Calculate count of roster on this day (only working shifts)
        const dayRoster = weeklySchedule.filter((e) => e.date === dateStr && e.shiftCode && e.shiftCode !== 'OFF' && e.shiftCode !== 'AL');
        const dayAssignment = assignmentsMap[dateStr];

        let assignedCount = 0;
        if (dayAssignment && dayAssignment.assignments) {
          Object.values(dayAssignment.assignments).forEach((ca: any) => {
            if (ca && ca.morning) assignedCount++;
            if (ca && ca.afternoon) assignedCount++;
          });
        }

        const totalRoster = dayRoster.length;
        const isCompleted = totalRoster > 0 && assignedCount >= totalRoster;
        const isPartial = totalRoster > 0 && assignedCount > 0 && assignedCount < totalRoster;

        return (
          <button
            key={day.dayIndex}
            type="button"
            id={`day-tab-${day.dayIndex}`}
            onClick={() => onSelectDate(dateStr)}
            className={`p-3 rounded-xl text-left transition-all duration-150 cursor-pointer relative border ${
              isSelected
                ? 'bg-teal-50/70 border-teal-700 text-teal-950 shadow-2xs'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            {/* Header: Day name & Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${isSelected ? 'text-teal-900' : 'text-slate-700'}`}>
                  {day.dayName}
                </span>
                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600" title="Hôm nay" />
                )}
              </div>
              <span className={`text-xs font-semibold tabular-nums ${isSelected ? 'text-teal-800' : 'text-slate-500'}`}>
                {day.dayFormatted}
              </span>
            </div>

            {/* Sub-status: Clean unboxed metadata */}
            <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums">
              <span className={isSelected ? 'text-teal-800 font-medium' : 'text-slate-500'}>
                {totalRoster > 0 ? `${totalRoster} ca` : '0 ca'}
              </span>

              {totalRoster > 0 && (
                <div>
                  {isCompleted ? (
                    <span
                      className="inline-flex items-center gap-1 text-emerald-700 font-semibold"
                      title="Đã xếp đủ tất cả ca"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Đủ</span>
                    </span>
                  ) : isPartial ? (
                    <span className="text-amber-700 font-semibold">
                      {assignedCount}/{totalRoster}
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Chưa xếp
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

