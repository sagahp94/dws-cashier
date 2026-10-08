import React, { useState, useMemo } from 'react';
import {
  DailyShiftDemandResult,
  Counter,
  WeeklyScheduleEntry,
  Shift,
  DayDwsAssignment,
} from '../../types';
import {
  shiftDemandService,
  STANDARD_WEEKLY_DEMAND_TABLE,
} from '../../services/shiftDemandService';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Store,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sun,
  Moon,
  Calendar,
  Table as TableIcon,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

interface DailyShiftDemandPanelProps {
  date: string;
  counters: Counter[];
  weeklySchedule: WeeklyScheduleEntry[];
  shifts: Shift[];
  currentAssignment?: DayDwsAssignment | null;
  onOpenRulesConfig?: () => void;
}

export const DailyShiftDemandPanel: React.FC<DailyShiftDemandPanelProps> = ({
  date,
  counters,
  weeklySchedule,
  shifts,
  currentAssignment = null,
  onOpenRulesConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'area_comparison' | 'weekly_matrix' | 'shift_groups'>('area_comparison');

  const demandStats: DailyShiftDemandResult = useMemo(() => {
    return shiftDemandService.getDailyShiftDemandStats(
      date,
      weeklySchedule,
      shifts,
      counters,
      currentAssignment
    );
  }, [date, weeklySchedule, shifts, counters, currentAssignment]);

  const areaComp = demandStats.areaComparison;
  const currentDayOfWeek = demandStats.dayOfWeek;

  const totalOpened = areaComp?.summary.grandTotalAssigned || 0;
  const totalTarget = areaComp?.summary.grandTotalTarget || 0;
  const overallCompletionRate = totalTarget > 0 ? Math.min(100, Math.round((totalOpened / totalTarget) * 100)) : 0;

  return (
    <div
      id="daily-shift-demand-panel"
      className="neu-panel overflow-hidden"
    >
      {/* Panel Header */}
      <div className="px-4 py-3.5 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Thống kê ca làm việc & đối chiếu mở quầy
              </h3>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-xs font-medium text-teal-800 tabular-nums">
                {demandStats.dayName} ({date.split('-').reverse().join('/')})
              </span>
              {areaComp && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className={`text-xs font-semibold tabular-nums ${
                    totalOpened >= totalTarget ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    Đã mở: {totalOpened}/{totalTarget} quầy ({overallCompletionRate}%)
                  </span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap tabular-nums">
              <span>
                Ca Sáng: <strong className="text-slate-700">{areaComp?.summary.totalMorningAssigned || 0}/{areaComp?.summary.totalMorningTarget || 0}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Ca Tối: <strong className="text-slate-700">{areaComp?.summary.totalNightAssigned || 0}/{areaComp?.summary.totalNightTarget || 0}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Siêu thị: <strong className="text-slate-700">{areaComp?.sieuThi.totalAssigned || 0}/{areaComp?.sieuThi.totalTarget || 0}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                FL2: <strong className="text-slate-700">{areaComp?.fl2.totalAssigned || 0}/{areaComp?.fl2.totalTarget || 0}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-tabs */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('area_comparison')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'area_comparison'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đối chiếu thực tế
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('weekly_matrix')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'weekly_matrix'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3 h-3" />
              Bảng chuẩn tuần
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shift_groups')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'shift_groups'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo nhóm mã ca
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg neu-button-secondary text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title={isExpanded ? 'Thu gọn bảng thống kê' : 'Mở rộng bảng thống kê'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 sm:p-4 space-y-3.5">
          {/* ========================================================================= */}
          {/* TAB 1: ĐỐI CHIẾU NHU CẦU THEO KHU VỰC (SIÊU THỊ & FL2) CHO NGÀY HIỆN TẠI */}
          {/* ========================================================================= */}
          {activeTab === 'area_comparison' && areaComp && (
            <div className="space-y-3.5">
              {/* Summary KPIs Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Tổng Ca Sáng */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/80 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sun className="w-4 h-4 text-amber-600" /> Ca Sáng (&lt;13h)
                    </span>
                    <span className="text-[10px] font-semibold text-amber-800">
                      Mục tiêu: {areaComp.summary.totalMorningTarget} quầy
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-black text-slate-900">
                        {areaComp.summary.totalMorningAssigned}
                      </span>
                      <span className="text-xs text-slate-500 font-medium"> / {areaComp.summary.totalMorningTarget} quầy</span>
                    </div>
                    <div>
                      {areaComp.summary.totalMorningAssignedBalance > 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          +{areaComp.summary.totalMorningAssignedBalance} quầy (Vượt)
                        </span>
                      ) : areaComp.summary.totalMorningAssignedBalance === 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          ✓ Đạt 100%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                          Thiếu {Math.abs(areaComp.summary.totalMorningAssignedBalance)} quầy
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-amber-200/60 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((areaComp.summary.totalMorningAssigned / (areaComp.summary.totalMorningTarget || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex justify-between">
                    <span>Nhân sự có ca sáng: <strong>{areaComp.summary.totalMorningStaff}</strong> NV</span>
                    <span>{Math.round((areaComp.summary.totalMorningAssigned / (areaComp.summary.totalMorningTarget || 1)) * 100)}%</span>
                  </div>
                </div>

                {/* 2. Tổng Ca Tối */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-200/80 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-indigo-900 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Moon className="w-4 h-4 text-indigo-600" /> Ca Tối (&ge;13h)
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-800">
                      Mục tiêu: {areaComp.summary.totalNightTarget} quầy
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-black text-slate-900">
                        {areaComp.summary.totalNightAssigned}
                      </span>
                      <span className="text-xs text-slate-500 font-medium"> / {areaComp.summary.totalNightTarget} quầy</span>
                    </div>
                    <div>
                      {areaComp.summary.totalNightAssignedBalance > 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          +{areaComp.summary.totalNightAssignedBalance} quầy (Vượt)
                        </span>
                      ) : areaComp.summary.totalNightAssignedBalance === 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          ✓ Đạt 100%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                          Thiếu {Math.abs(areaComp.summary.totalNightAssignedBalance)} quầy
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-indigo-200/60 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((areaComp.summary.totalNightAssigned / (areaComp.summary.totalNightTarget || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex justify-between">
                    <span>Nhân sự có ca tối: <strong>{areaComp.summary.totalNightStaff}</strong> NV</span>
                    <span>{Math.round((areaComp.summary.totalNightAssigned / (areaComp.summary.totalNightTarget || 1)) * 100)}%</span>
                  </div>
                </div>

                {/* 3. Nhu cầu Siêu Thị */}
                <div className="p-3 rounded-xl bg-white/90 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-teal-700" /> Siêu thị (SSC &rarr; 27)
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {areaComp.sieuThi.totalAssigned}/{areaComp.sieuThi.totalTarget} quầy
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-500" /> Sáng:
                      </span>
                      <span className="font-bold text-slate-800">
                        {areaComp.sieuThi.morningAssigned} / {areaComp.sieuThi.morningTarget} quầy
                        {areaComp.sieuThi.morningAssignedBalance < 0 && (
                          <span className="text-[10px] font-semibold text-rose-600 ml-1">
                            (-{Math.abs(areaComp.sieuThi.morningAssignedBalance)})
                          </span>
                        )}
                        {areaComp.sieuThi.morningAssignedBalance === 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600 ml-1">✓ Đủ</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Moon className="w-3 h-3 text-indigo-500" /> Tối:
                      </span>
                      <span className="font-bold text-slate-800">
                        {areaComp.sieuThi.nightAssigned} / {areaComp.sieuThi.nightTarget} quầy
                        {areaComp.sieuThi.nightAssignedBalance < 0 && (
                          <span className="text-[10px] font-semibold text-rose-600 ml-1">
                            (-{Math.abs(areaComp.sieuThi.nightAssignedBalance)})
                          </span>
                        )}
                        {areaComp.sieuThi.nightAssignedBalance === 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600 ml-1">✓ Đủ</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-teal-700 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((areaComp.sieuThi.totalAssigned / (areaComp.sieuThi.totalTarget || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* 4. Nhu cầu FL2 */}
                <div className="p-3 rounded-xl bg-white/90 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" /> FL2 (Delica & Bánh mì)
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {areaComp.fl2.totalAssigned}/{areaComp.fl2.totalTarget} quầy
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-500" /> Sáng:
                      </span>
                      <span className="font-bold text-slate-800">
                        {areaComp.fl2.morningAssigned} / {areaComp.fl2.morningTarget} quầy
                        {areaComp.fl2.morningAssignedBalance < 0 && (
                          <span className="text-[10px] font-semibold text-rose-600 ml-1">
                            (-{Math.abs(areaComp.fl2.morningAssignedBalance)})
                          </span>
                        )}
                        {areaComp.fl2.morningAssignedBalance === 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600 ml-1">✓ Đủ</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Moon className="w-3 h-3 text-indigo-500" /> Tối:
                      </span>
                      <span className="font-bold text-slate-800">
                        {areaComp.fl2.nightAssigned} / {areaComp.fl2.nightTarget} quầy
                        {areaComp.fl2.nightAssignedBalance < 0 && (
                          <span className="text-[10px] font-semibold text-rose-600 ml-1">
                            (-{Math.abs(areaComp.fl2.nightAssignedBalance)})
                          </span>
                        )}
                        {areaComp.fl2.nightAssignedBalance === 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600 ml-1">✓ Đủ</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((areaComp.fl2.totalAssigned / (areaComp.fl2.totalTarget || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Bảng Chi Tiết Đối Chiếu Theo Chuẩn Dữ Liệu */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Khu vực</th>
                      <th className="py-2.5 px-3">Ca mở quầy</th>
                      <th className="py-2.5 px-3 text-center bg-teal-50 text-teal-800">
                        Số lượng cần mở ({demandStats.dayName})
                      </th>
                      <th className="py-2.5 px-3 text-center bg-emerald-50/70 text-emerald-900 font-extrabold">
                        Thực tế đã mở (Đã fill)
                      </th>
                      <th className="py-2.5 px-3 text-center">Chênh lệch (Thực tế vs Cần mở)</th>
                      <th className="py-2.5 px-3 text-center">Tiến độ mở quầy</th>
                      <th className="py-2.5 px-3 text-center text-slate-500">NV có ca theo lịch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* HÀNG SIÊU THỊ - SÁNG */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td rowSpan={2} className="py-2.5 px-3 font-extrabold text-slate-900 align-middle bg-slate-50/50 border-r border-slate-200">
                        <div>SIÊU THỊ</div>
                        <div className="text-[10px] text-slate-400 font-normal">Quầy SSC01 &rarr; 27</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-amber-800 flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-600" /> Sáng (&lt; 13:00)
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-teal-800 bg-teal-50/50 text-sm">
                        {areaComp.sieuThi.morningTarget} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-emerald-700 bg-emerald-50/40 text-sm">
                        {areaComp.sieuThi.morningAssigned} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {areaComp.sieuThi.morningAssignedBalance > 0 ? (
                          <span className="text-blue-700 font-bold px-2 py-0.5 rounded bg-blue-50">
                            +{areaComp.sieuThi.morningAssignedBalance} quầy (Vượt)
                          </span>
                        ) : areaComp.sieuThi.morningAssignedBalance === 0 ? (
                          <span className="text-emerald-700 font-bold px-2 py-0.5 rounded bg-emerald-50">
                            ✓ Đã mở đủ 100%
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold px-2 py-0.5 rounded bg-rose-50">
                            Thiếu {Math.abs(areaComp.sieuThi.morningAssignedBalance)} quầy
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                areaComp.sieuThi.morningAssigned >= areaComp.sieuThi.morningTarget
                                    ? 'bg-emerald-600'
                                    : 'bg-amber-500'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((areaComp.sieuThi.morningAssigned / (areaComp.sieuThi.morningTarget || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                          <span className="font-bold text-[11px] text-slate-700">
                            {Math.round((areaComp.sieuThi.morningAssigned / (areaComp.sieuThi.morningTarget || 1)) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {areaComp.summary.totalMorningStaff} NV
                      </td>
                    </tr>

                    {/* HÀNG SIÊU THỊ - TỐI */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-indigo-800 flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-indigo-600" /> Tối (&ge; 13:00)
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-teal-800 bg-teal-50/50 text-sm">
                        {areaComp.sieuThi.nightTarget} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-emerald-700 bg-emerald-50/40 text-sm">
                        {areaComp.sieuThi.nightAssigned} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {areaComp.sieuThi.nightAssignedBalance > 0 ? (
                          <span className="text-blue-700 font-bold px-2 py-0.5 rounded bg-blue-50">
                            +{areaComp.sieuThi.nightAssignedBalance} quầy (Vượt)
                          </span>
                        ) : areaComp.sieuThi.nightAssignedBalance === 0 ? (
                          <span className="text-emerald-700 font-bold px-2 py-0.5 rounded bg-emerald-50">
                            ✓ Đã mở đủ 100%
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold px-2 py-0.5 rounded bg-rose-50">
                            Thiếu {Math.abs(areaComp.sieuThi.nightAssignedBalance)} quầy
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                areaComp.sieuThi.nightAssigned >= areaComp.sieuThi.nightTarget
                                  ? 'bg-emerald-600'
                                  : 'bg-indigo-500'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((areaComp.sieuThi.nightAssigned / (areaComp.sieuThi.nightTarget || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                          <span className="font-bold text-[11px] text-slate-700">
                            {Math.round((areaComp.sieuThi.nightAssigned / (areaComp.sieuThi.nightTarget || 1)) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {areaComp.summary.totalNightStaff} NV
                      </td>
                    </tr>

                    {/* HÀNG FL2 - SÁNG */}
                    <tr className="hover:bg-slate-50/70 transition-colors border-t-2 border-slate-200/60">
                      <td rowSpan={2} className="py-2.5 px-3 font-extrabold text-slate-900 align-middle bg-slate-50/50 border-r border-slate-200">
                        <div>FL2</div>
                        <div className="text-[10px] text-slate-400 font-normal">Delica, Bánh mì (101 &rarr; 117)</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-amber-800 flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-600" /> Sáng (&lt; 13:00)
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-teal-800 bg-teal-50/50 text-sm">
                        {areaComp.fl2.morningTarget} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-emerald-700 bg-emerald-50/40 text-sm">
                        {areaComp.fl2.morningAssigned} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {areaComp.fl2.morningAssignedBalance > 0 ? (
                          <span className="text-blue-700 font-bold px-2 py-0.5 rounded bg-blue-50">
                            +{areaComp.fl2.morningAssignedBalance} quầy (Vượt)
                          </span>
                        ) : areaComp.fl2.morningAssignedBalance === 0 ? (
                          <span className="text-emerald-700 font-bold px-2 py-0.5 rounded bg-emerald-50">
                            ✓ Đã mở đủ 100%
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold px-2 py-0.5 rounded bg-rose-50">
                            Thiếu {Math.abs(areaComp.fl2.morningAssignedBalance)} quầy
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                areaComp.fl2.morningAssigned >= areaComp.fl2.morningTarget
                                  ? 'bg-emerald-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((areaComp.fl2.morningAssigned / (areaComp.fl2.morningTarget || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                          <span className="font-bold text-[11px] text-slate-700">
                            {Math.round((areaComp.fl2.morningAssigned / (areaComp.fl2.morningTarget || 1)) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {areaComp.summary.totalMorningStaff} NV
                      </td>
                    </tr>

                    {/* HÀNG FL2 - TỐI */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-indigo-800 flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-indigo-600" /> Tối (&ge; 13:00)
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-teal-800 bg-teal-50/50 text-sm">
                        {areaComp.fl2.nightTarget} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-emerald-700 bg-emerald-50/40 text-sm">
                        {areaComp.fl2.nightAssigned} quầy
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {areaComp.fl2.nightAssignedBalance > 0 ? (
                          <span className="text-blue-700 font-bold px-2 py-0.5 rounded bg-blue-50">
                            +{areaComp.fl2.nightAssignedBalance} quầy (Vượt)
                          </span>
                        ) : areaComp.fl2.nightAssignedBalance === 0 ? (
                          <span className="text-emerald-700 font-bold px-2 py-0.5 rounded bg-emerald-50">
                            ✓ Đã mở đủ 100%
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold px-2 py-0.5 rounded bg-rose-50">
                            Thiếu {Math.abs(areaComp.fl2.nightAssignedBalance)} quầy
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                areaComp.fl2.nightAssigned >= areaComp.fl2.nightTarget
                                  ? 'bg-emerald-600'
                                  : 'bg-indigo-500'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((areaComp.fl2.nightAssigned / (areaComp.fl2.nightTarget || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                          <span className="font-bold text-[11px] text-slate-700">
                            {Math.round((areaComp.fl2.nightAssigned / (areaComp.fl2.nightTarget || 1)) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {areaComp.summary.totalNightStaff} NV
                      </td>
                    </tr>

                    {/* TỔNG CỘNG TOÀN BỘ */}
                    <tr className="bg-slate-100/95 font-extrabold text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={2} className="py-3 px-3">
                        TỔNG CỘNG CẢ NGÀY ({demandStats.dayName})
                      </td>
                      <td className="py-3 px-3 text-center text-teal-800 bg-teal-100/80 text-sm font-black">
                        {areaComp.summary.grandTotalTarget} quầy
                      </td>
                      <td className="py-3 px-3 text-center text-emerald-800 bg-emerald-100/80 text-sm font-black">
                        {areaComp.summary.grandTotalAssigned} quầy
                      </td>
                      <td className="py-3 px-3 text-center">
                        {areaComp.summary.grandTotalAssignedBalance > 0 ? (
                          <span className="text-blue-800 font-bold px-2 py-0.5 rounded bg-blue-100">
                            +{areaComp.summary.grandTotalAssignedBalance} quầy (Vượt)
                          </span>
                        ) : areaComp.summary.grandTotalAssignedBalance === 0 ? (
                          <span className="text-emerald-800 font-bold px-2 py-0.5 rounded bg-emerald-100">
                            ✓ Đã mở đủ 100%
                          </span>
                        ) : (
                          <span className="text-rose-700 font-bold px-2 py-0.5 rounded bg-rose-100">
                            Thiếu {Math.abs(areaComp.summary.grandTotalAssignedBalance)} quầy
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-24 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all ${
                                areaComp.summary.grandTotalAssigned >= areaComp.summary.grandTotalTarget
                                  ? 'bg-emerald-600'
                                  : 'bg-teal-700'
                              }`}
                              style={{
                                width: `${overallCompletionRate}%`,
                              }}
                            />
                          </div>
                          <span className="font-black text-xs text-slate-800">
                            {overallCompletionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 font-bold">
                        {areaComp.summary.grandTotalStaff} NV
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: BẢNG CHUẨN ĐỐI CHIẾU CẢ TUẦN (THỨ 2 -> CHỦ NHẬT) THEO HÌNH ẢNH MẪU */}
          {/* ========================================================================= */}
          {activeTab === 'weekly_matrix' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold flex items-center gap-1.5">
                  <TableIcon className="w-4 h-4 text-teal-700" /> Bảng Nhu Cầu Mở Quầy Dự Kiến Cả Tuần
                </span>
                <span className="text-[11px] text-slate-500 italic">
                  * Ô có viền nổi bật thể hiện ngày hiện tại đang xem ({demandStats.dayName})
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-black/80 shadow-xs">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-[#fbd3b6] text-black font-extrabold border-b border-black">
                      <th className="border-r border-black py-2 px-2 w-[16%]">Khu vực</th>
                      <th className="border-r border-black py-2 px-2 w-[14%]">Ca mở quầy</th>
                      <th className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 1 ? 'bg-amber-300' : ''}`}>
                        <div>THỨ 2</div>
                        <div className="text-[10px] font-normal">Dự kiến</div>
                      </th>
                      <th className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 2 ? 'bg-amber-300' : ''}`}>
                        <div>THỨ 3</div>
                        <div className="text-[10px] font-normal">Dự kiến</div>
                      </th>
                      <th className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 3 ? 'bg-amber-300' : ''}`}>
                        <div>THỨ 4</div>
                        <div className="text-[10px] font-normal">Dự kiến</div>
                      </th>
                      <th className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 4 ? 'bg-amber-300' : ''}`}>
                        <div>THỨ 5</div>
                        <div className="text-[10px] font-normal">Dự kiến</div>
                      </th>
                      <th className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 5 ? 'bg-amber-300' : ''}`}>
                        <div>THỨ 6</div>
                        <div className="text-[10px] font-normal">Dự kiến</div>
                      </th>
                      <th className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 6 ? 'bg-amber-300' : ''}`}>
                        <div>THỨ 7</div>
                        <div className="text-[10px] font-normal">Dự kiến</div>
                      </th>
                      <th className={`py-2 px-2 ${currentDayOfWeek === 7 ? 'bg-amber-300' : ''}`}>
                        <div>CN</div>
                        <div className="text-[10px] font-normal">Dự kiến</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white font-medium text-black">
                    {/* SIÊU THỊ - SÁNG */}
                    <tr className="border-b border-black">
                      <td rowSpan={2} className="border-r border-black py-2 px-2 font-black align-middle bg-slate-50">
                        SIÊU THỊ
                      </td>
                      <td className="border-r border-black py-2 px-2 text-left font-bold bg-amber-50/50">
                        Sáng
                      </td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 1 ? 'bg-amber-100 font-black' : ''}`}>15</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 2 ? 'bg-amber-100 font-black' : ''}`}>13</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 3 ? 'bg-amber-100 font-black' : ''}`}>15</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 4 ? 'bg-amber-100 font-black' : ''}`}>13</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 5 ? 'bg-amber-100 font-black' : ''}`}>15</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 6 ? 'bg-amber-100 font-black' : ''}`}>24</td>
                      <td className={`py-2 px-2 ${currentDayOfWeek === 7 ? 'bg-amber-100 font-black' : ''}`}>26</td>
                    </tr>

                    {/* SIÊU THỊ - TỐI */}
                    <tr className="border-b-2 border-black">
                      <td className="border-r border-black py-2 px-2 text-left font-bold bg-indigo-50/50">
                        Tối
                      </td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 1 ? 'bg-amber-100 font-black' : ''}`}>19</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 2 ? 'bg-amber-100 font-black' : ''}`}>17</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 3 ? 'bg-amber-100 font-black' : ''}`}>19</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 4 ? 'bg-amber-100 font-black' : ''}`}>17</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 5 ? 'bg-amber-100 font-black' : ''}`}>21</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 6 ? 'bg-amber-100 font-black' : ''}`}>26</td>
                      <td className={`py-2 px-2 ${currentDayOfWeek === 7 ? 'bg-amber-100 font-black' : ''}`}>26</td>
                    </tr>

                    {/* FL2 - SÁNG */}
                    <tr className="border-b border-black">
                      <td rowSpan={2} className="border-r border-black py-2 px-2 font-black align-middle bg-slate-50">
                        FL2
                      </td>
                      <td className="border-r border-black py-2 px-2 text-left font-bold bg-amber-50/50">
                        Sáng
                      </td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 1 ? 'bg-amber-100 font-black' : ''}`}>12</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 2 ? 'bg-amber-100 font-black' : ''}`}>11</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 3 ? 'bg-amber-100 font-black' : ''}`}>12</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 4 ? 'bg-amber-100 font-black' : ''}`}>11</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 5 ? 'bg-amber-100 font-black' : ''}`}>12</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 6 ? 'bg-amber-100 font-black' : ''}`}>18</td>
                      <td className={`py-2 px-2 ${currentDayOfWeek === 7 ? 'bg-amber-100 font-black' : ''}`}>19</td>
                    </tr>

                    {/* FL2 - TỐI */}
                    <tr className="border-b-2 border-black">
                      <td className="border-r border-black py-2 px-2 text-left font-bold bg-indigo-50/50">
                        Tối
                      </td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 1 ? 'bg-amber-100 font-black' : ''}`}>12</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 2 ? 'bg-amber-100 font-black' : ''}`}>11</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 3 ? 'bg-amber-100 font-black' : ''}`}>12</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 4 ? 'bg-amber-100 font-black' : ''}`}>12</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 5 ? 'bg-amber-100 font-black' : ''}`}>13</td>
                      <td className={`border-r border-black py-2 px-2 ${currentDayOfWeek === 6 ? 'bg-amber-100 font-black' : ''}`}>19</td>
                      <td className={`py-2 px-2 ${currentDayOfWeek === 7 ? 'bg-amber-100 font-black' : ''}`}>18</td>
                    </tr>

                    {/* TỔNG HỢP CẢ NGÀY */}
                    <tr className="bg-slate-100 font-bold border-b border-black">
                      <td colSpan={2} className="border-r border-black py-2 px-2 text-left">
                        Tổng Ca Sáng
                      </td>
                      <td className="border-r border-black py-2 px-2">27</td>
                      <td className="border-r border-black py-2 px-2">24</td>
                      <td className="border-r border-black py-2 px-2">27</td>
                      <td className="border-r border-black py-2 px-2">24</td>
                      <td className="border-r border-black py-2 px-2">27</td>
                      <td className="border-r border-black py-2 px-2">42</td>
                      <td className="py-2 px-2">45</td>
                    </tr>

                    <tr className="bg-slate-100 font-bold border-b border-black">
                      <td colSpan={2} className="border-r border-black py-2 px-2 text-left">
                        Tổng Ca Tối
                      </td>
                      <td className="border-r border-black py-2 px-2">31</td>
                      <td className="border-r border-black py-2 px-2">28</td>
                      <td className="border-r border-black py-2 px-2">31</td>
                      <td className="border-r border-black py-2 px-2">29</td>
                      <td className="border-r border-black py-2 px-2">34</td>
                      <td className="border-r border-black py-2 px-2">45</td>
                      <td className="py-2 px-2">44</td>
                    </tr>

                    <tr className="bg-[#fbd3b6] font-black">
                      <td colSpan={2} className="border-r border-black py-2 px-2 text-left">
                        TỔNG CỘNG NGÀY
                      </td>
                      <td className="border-r border-black py-2 px-2">58</td>
                      <td className="border-r border-black py-2 px-2">52</td>
                      <td className="border-r border-black py-2 px-2">58</td>
                      <td className="border-r border-black py-2 px-2">53</td>
                      <td className="border-r border-black py-2 px-2">61</td>
                      <td className="border-r border-black py-2 px-2">87</td>
                      <td className="py-2 px-2">89</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: THEO NHÓM MÃ CA CỤ THỂ (V815, V818, V820/V822, V829/V830) */}
          {/* ========================================================================= */}
          {activeTab === 'shift_groups' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {demandStats.groups
                  .filter((g) => g.groupKey !== 'OTHER')
                  .map((group) => {
                    const isOverStaffed = group.balance > 0;
                    const isUnderStaffed = group.balance < 0;

                    const colorThemes: Record<
                      string,
                      {
                        border: string;
                        badgeBg: string;
                        accentColor: string;
                      }
                    > = {
                      V815: {
                        border: 'border-amber-200/80 hover:border-amber-300',
                        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
                        accentColor: 'text-amber-700',
                      },
                      V818: {
                        border: 'border-emerald-200/80 hover:border-emerald-300',
                        badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                        accentColor: 'text-emerald-700',
                      },
                      V820_V822: {
                        border: 'border-indigo-200/80 hover:border-indigo-300',
                        badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
                        accentColor: 'text-indigo-700',
                      },
                      V829_V830: {
                        border: 'border-purple-200/80 hover:border-purple-300',
                        badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
                        accentColor: 'text-purple-700',
                      },
                    };

                    const theme = colorThemes[group.groupKey] || colorThemes.V815;
                    const badgeLabel =
                      group.groupKey === 'V820_V822'
                        ? 'V820 / V822'
                        : group.groupKey === 'V829_V830'
                        ? 'V829 / V830'
                        : group.groupKey;

                    return (
                      <div
                        key={group.groupKey}
                        className={`neu-card rounded-xl p-3.5 flex flex-col justify-between border transition-all ${theme.border}`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200/60">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md neu-inset bg-slate-900 text-white border-transparent">
                                  {badgeLabel}
                                </span>
                                <span className="text-xs font-bold text-slate-800">{group.groupLabel}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">{group.shiftTypeLabel}</p>
                            </div>

                            <div className="text-right shrink-0">
                              {isUnderStaffed ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold neu-pill bg-rose-100 text-rose-800 border-rose-200">
                                  Thiếu {Math.abs(group.balance)} NV
                                </span>
                              ) : isOverStaffed ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold neu-pill bg-blue-100 text-blue-800 border-blue-200">
                                  Dư +{group.balance} NV
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold neu-pill bg-emerald-100 text-emerald-800 border-emerald-200">
                                  Đủ 100%
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 my-2.5 text-center">
                            <div className="p-2 rounded-lg neu-inset">
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                NV có ca
                              </p>
                              <p className="text-sm font-black text-slate-900 leading-none mt-1">
                                {group.totalStaff}
                              </p>
                            </div>

                            <div className="p-2 rounded-lg neu-inset">
                              <p className="text-[9px] font-bold text-teal-800 uppercase tracking-wider">
                                Cần mở
                              </p>
                              <p className="text-sm font-black text-teal-700 leading-none mt-1">
                                {group.targetCount}
                              </p>
                            </div>

                            <div className="p-2 rounded-lg neu-inset">
                              <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                                Đã fill
                              </p>
                              <p className="text-sm font-black text-emerald-700 leading-none mt-1">
                                {group.assignedStaff}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-700">
                                Quầy ưu tiên theo rule ({group.targetCount} quầy):
                              </span>
                              <span className="text-slate-500 font-medium">
                                Đã mở: <strong className="text-emerald-700">{group.targetCounters.filter((t) => t.isAssigned).length}</strong>/{group.targetCount}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 p-1.5 neu-inset rounded-lg max-h-24 overflow-y-auto">
                              {group.targetCounters.map((tc, idx) => (
                                <span
                                  key={`${tc.spec}_${idx}`}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                    tc.isAssigned
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs'
                                      : 'neu-button-secondary text-slate-600'
                                  }`}
                                  title={
                                    tc.isAssigned
                                      ? `Quầy ${tc.spec}: Đã có nhân viên (${tc.assignedTo?.employeeName || 'Đã xếp'})`
                                      : `Quầy ${tc.spec}: Chưa xếp nhân viên`
                                  }
                                >
                                  {tc.isAssigned ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  )}
                                  {tc.spec}
                                </span>
                              ))}
                            </div>
                            <p className="text-[9px] text-slate-500 italic pt-0.5 leading-tight">
                              {group.ruleNotes}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {onOpenRulesConfig && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onOpenRulesConfig}
                    className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                  >
                    Xem & Chỉnh sửa cấu hình Rule phân quầy &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
