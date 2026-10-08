import React from 'react';
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Eye,
  Sparkles,
  Store,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface HeadcountStatsBarProps {
  date: string;
  dayName: string;
  workingCount: number;
  offCount: number;
  totalEmployees: number;
  assignedCount: number;
  unassignedCount: number;
  openedCountersCount?: number;
  targetCountersCount?: number;
  onFilterUnassigned?: () => void;
  onExportExcel?: () => void;
  onExportWeeklyExcel?: () => void;
  onPreviewPdf?: () => void;
  onAutoAssign?: () => void;
  onAutoSuggest?: () => void;
}

export const HeadcountStatsBar: React.FC<HeadcountStatsBarProps> = ({
  date,
  dayName,
  workingCount,
  offCount,
  totalEmployees,
  assignedCount,
  unassignedCount,
  openedCountersCount = 0,
  targetCountersCount = 0,
  onFilterUnassigned,
  onExportExcel,
  onExportWeeklyExcel,
  onPreviewPdf,
  onAutoAssign,
  onAutoSuggest,
}) => {
  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

  const completionRate = workingCount > 0 ? Math.round((assignedCount / workingCount) * 100) : 0;
  const isFullyAssigned = workingCount > 0 && assignedCount >= workingCount;
  const counterRate = targetCountersCount > 0 ? Math.round((openedCountersCount / targetCountersCount) * 100) : 0;

  return (
    <div
      id="headcount-stats-bar"
      className="neu-panel p-4 sm:p-5 space-y-4"
    >
      {/* Top Header & Fast Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {dayName} · {formatDisplayDate(date)}
            </h2>
            <span className="text-slate-300" aria-hidden="true">|</span>
            {isFullyAssigned ? (
              <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã xếp đủ 100%</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Còn {unassignedCount} nhân viên chờ xếp</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Điều phối quầy thu ngân hàng ngày & đối chiếu định biên ca
          </p>
        </div>

        {/* Action Button Group */}
        <div className="flex flex-wrap items-center gap-2">
          {unassignedCount > 0 && (onAutoSuggest || onAutoAssign) && (
            <button
              type="button"
              id="stats-btn-auto-assign"
              onClick={onAutoSuggest || onAutoAssign}
              className="neu-button-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              title="Tự động tính toán và xếp nhân viên vào quầy phù hợp nhất"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-100" />
              <span>Tự động xếp quầy ({unassignedCount})</span>
            </button>
          )}

          {/* Unified Export & Print Group */}
          <div className="inline-flex items-center rounded-lg overflow-hidden border border-slate-200 bg-white">
            {onPreviewPdf && (
              <button
                type="button"
                id="stats-btn-preview-pdf"
                onClick={onPreviewPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors whitespace-nowrap"
                title="Xem trước & In bảng DWS chuẩn A4"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>In DWS</span>
              </button>
            )}
            {onExportExcel && (
              <button
                type="button"
                id="stats-btn-export-excel"
                onClick={onExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors border-l border-slate-200 whitespace-nowrap"
                title="Tải bảng phân công DWS ngày này ra file Excel (*.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel Ngày</span>
              </button>
            )}
            {onExportWeeklyExcel && (
              <button
                type="button"
                id="stats-btn-export-weekly-excel"
                onClick={onExportWeeklyExcel}
                className="px-3 py-1.5 text-teal-800 hover:bg-teal-50 text-xs font-semibold cursor-pointer transition-colors border-l border-slate-200 whitespace-nowrap"
                title="Tải Excel cả tuần (7 sheets MON..SUN + sheet FOLLOW)"
              >
                Excel Tuần
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Minimalist Progress Line */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 tabular-nums">
            <span>Tiến độ phân bổ:</span>
            <strong className="text-slate-900 font-bold">{completionRate}%</strong>
            <span className="text-slate-400">·</span>
            <span>{assignedCount}/{workingCount} nhân viên</span>
          </div>

          {targetCountersCount > 0 && (
            <div className="text-slate-500 text-xs hidden sm:block tabular-nums">
              Quầy mở mục tiêu: <strong className="text-slate-900 font-semibold">{openedCountersCount}/{targetCountersCount}</strong> ({counterRate}%)
            </div>
          )}
        </div>

        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isFullyAssigned
                ? 'bg-emerald-600'
                : completionRate > 50
                ? 'bg-teal-700'
                : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(100, completionRate)}%` }}
          />
        </div>
      </div>

      {/* Clean Divided KPI Strip (No nested rainbow cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-3 border-t border-slate-200/80 tabular-nums">
        {/* 1. Đi làm */}
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-slate-500">Đi làm hôm nay</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">{workingCount}</span>
            <span className="text-xs text-slate-500">nhân viên</span>
          </div>
        </div>

        {/* 2. Đã xếp quầy */}
        <div className="space-y-0.5 sm:border-l sm:border-slate-200/80 sm:pl-4">
          <p className="text-xs font-medium text-slate-500">Đã xếp quầy</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-teal-700">{assignedCount}</span>
            <span className="text-xs text-slate-400">/ {workingCount} ({completionRate}%)</span>
          </div>
        </div>

        {/* 3. Chờ xếp quầy */}
        <div
          onClick={onFilterUnassigned}
          className={`space-y-0.5 sm:border-l sm:border-slate-200/80 sm:pl-4 ${
            onFilterUnassigned ? 'cursor-pointer group' : ''
          }`}
        >
          <p className="text-xs font-medium text-slate-500 group-hover:text-slate-800 transition-colors">
            Chờ xếp quầy
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-xl font-bold ${
                unassignedCount > 0 ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              {unassignedCount}
            </span>
            <span className="text-xs text-slate-500">
              {unassignedCount > 0 ? 'cần phân bổ' : 'đã xếp hết'}
            </span>
          </div>
        </div>

        {/* 4. Quầy mở / Mục tiêu */}
        <div className="space-y-0.5 sm:border-l sm:border-slate-200/80 sm:pl-4">
          <p className="text-xs font-medium text-slate-500">Quầy hoạt động</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">{openedCountersCount}</span>
            {targetCountersCount > 0 ? (
              <span className="text-xs text-slate-500">/ {targetCountersCount} chỉ tiêu</span>
            ) : (
              <span className="text-xs text-slate-500">quầy mở</span>
            )}
          </div>
        </div>

        {/* 5. Nghỉ (OFF) */}
        <div className="space-y-0.5 sm:border-l sm:border-slate-200/80 sm:pl-4">
          <p className="text-xs font-medium text-slate-500">Nghỉ (OFF)</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-600">{offCount}</span>
            <span className="text-xs text-slate-400">/ {totalEmployees} tổng NV</span>
          </div>
        </div>
      </div>
    </div>
  );
};
