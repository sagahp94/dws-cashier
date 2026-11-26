import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  addDaysToDateStr,
  formatDisplayDate,
  getMondayOfWeek,
  formatDateToYMD,
} from '../../utils/dateUtils';

interface WeekSelectorProps {
  currentMonday: string; // YYYY-MM-DD
  onWeekChange: (mondayDate: string) => void;
}

export function getMonday(d: Date | string): string {
  return getMondayOfWeek(d);
}

export function formatDateRange(mondayStr: string): string {
  if (!mondayStr) return '';
  const sunStr = addDaysToDateStr(mondayStr, 6);
  return `${formatDisplayDate(mondayStr)} – ${formatDisplayDate(sunStr)}`;
}

export const WeekSelector: React.FC<WeekSelectorProps> = ({ currentMonday, onWeekChange }) => {
  const handlePrevWeek = () => {
    onWeekChange(addDaysToDateStr(currentMonday, -7));
  };

  const handleNextWeek = () => {
    onWeekChange(addDaysToDateStr(currentMonday, 7));
  };

  const handleCurrentWeek = () => {
    const today = new Date();
    onWeekChange(getMondayOfWeek(today));
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      onWeekChange(getMondayOfWeek(val));
    }
  };

  return (
    <div className="neu-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center">
          <CalendarIcon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-slate-500">Tuần làm việc</div>
          <div className="text-sm font-bold text-slate-900 tracking-tight tabular-nums">
            {formatDateRange(currentMonday)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          id="btn-prev-week"
          onClick={handlePrevWeek}
          title="Tuần trước"
          className="neu-button-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer text-slate-700 whitespace-nowrap"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tuần trước</span>
        </button>

        <button
          type="button"
          id="btn-current-week"
          onClick={handleCurrentWeek}
          title="Về tuần hiện tại"
          className="neu-button-secondary px-3 py-1.5 text-xs font-semibold text-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
        >
          Tuần hiện tại
        </button>

        <button
          type="button"
          id="btn-next-week"
          onClick={handleNextWeek}
          title="Tuần sau"
          className="neu-button-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer text-slate-700 whitespace-nowrap"
        >
          <span className="hidden sm:inline">Tuần sau</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="relative ml-0.5">
          <input
            type="date"
            onChange={handleDatePick}
            title="Chọn ngày bất kỳ để nhảy đến tuần đó"
            className="w-8 h-8 opacity-0 absolute inset-0 cursor-pointer z-10"
          />
          <div className="w-8 h-8 rounded-lg neu-button-secondary flex items-center justify-center text-slate-600 hover:text-teal-700 transition-colors pointer-events-none">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
