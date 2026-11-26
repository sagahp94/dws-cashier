import React, { useMemo, useState } from 'react';
import {
  Shift,
  Counter,
  Employee,
  WeeklyScheduleEntry,
  DayDwsAssignment,
} from '../types';
import { assignmentService } from '../services/assignmentService';
import { shiftDemandService } from '../services/shiftDemandService';
import { DAYS_OF_WEEK } from '../components/dws/DaySelector';
import { getDaysInWeek, formatDisplayDate } from '../utils/dateUtils';
import { EmptyState } from '../components/common/EmptyState';
import { excelService } from '../services/excelService';
import {
  BarChart3,
  TrendingUp,
  UserCheck,
  UserX,
  LayoutGrid,
  Calendar,
  Download,
  Printer,
  CheckCircle2,
  Layers,
  Store,
  Check,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReportsPageProps {
  currentMonday: string;
  shifts: Shift[];
  counters: Counter[];
  employees: Employee[];
  weeklySchedule: WeeklyScheduleEntry[];
  assignmentsMap: Record<string, DayDwsAssignment>;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  currentMonday,
  shifts,
  counters,
  employees,
  weeklySchedule,
  assignmentsMap,
}) => {
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<
    'all' | 'V815' | 'V818' | 'V820_V822' | 'V829_V830'
  >('all');

  // Aggregate daily statistics for Monday through Sunday (7 days)
  const weekReport = useMemo(() => {
    let totalWeeklyWorking = 0;
    let totalWeeklyOff = 0;
    let totalWeeklyAssigned = 0;
    let totalWeeklyUnassigned = 0;

    const weekDays = getDaysInWeek(currentMonday);
    const daysData = weekDays.map((d) => {
      const dateStr = d.dateStr;
      const dayAssignment = assignmentsMap[dateStr] || null;

      const stats = assignmentService.getDayStats(dateStr, weeklySchedule, shifts, dayAssignment);
      const demandStats = shiftDemandService.getDailyShiftDemandStats(
        dateStr,
        weeklySchedule,
        shifts,
        counters,
        dayAssignment
      );

      totalWeeklyWorking += stats.workingCount;
      totalWeeklyOff += stats.offCount;
      totalWeeklyAssigned += stats.assignedCount;
      totalWeeklyUnassigned += stats.unassignedCount;

      const pct = stats.workingCount > 0 ? Math.round((stats.assignedCount / stats.workingCount) * 100) : 0;

      return {
        dayName: d.dayName,
        date: dateStr,
        ...stats,
        percentage: pct,
        demandStats,
      };
    });

    // Counter utilization across week
    const counterUsage: Record<string, { morning: number; afternoon: number; total: number }> = {};
    counters.forEach((c) => {
      counterUsage[c.id] = { morning: 0, afternoon: 0, total: 0 };
    });

    Object.values(assignmentsMap).forEach((dayAss: any) => {
      if (dayAss && dayAss.assignments) {
        Object.entries(dayAss.assignments).forEach(([cId, ca]: [string, any]) => {
          if (counterUsage[cId] && ca) {
            if (ca.morning) {
              counterUsage[cId].morning++;
              counterUsage[cId].total++;
            }
            if (ca.afternoon) {
              counterUsage[cId].afternoon++;
              counterUsage[cId].total++;
            }
          }
        });
      }
    });

    return {
      totalWeeklyWorking,
      totalWeeklyOff,
      totalWeeklyAssigned,
      totalWeeklyUnassigned,
      overallPercentage:
        totalWeeklyWorking > 0 ? Math.round((totalWeeklyAssigned / totalWeeklyWorking) * 100) : 0,
      daysData,
      counterUsage,
    };
  }, [currentMonday, weeklySchedule, shifts, assignmentsMap, counters]);

  const handleExportReportExcel = () => {
    const rows = weekReport.daysData.map((d, i) => {
      const v815 = d.demandStats.groups.find((g) => g.groupKey === 'V815');
      const v818 = d.demandStats.groups.find((g) => g.groupKey === 'V818');
      const v820 = d.demandStats.groups.find((g) => g.groupKey === 'V820_V822');

      return {
        STT: i + 1,
        'Thứ': d.dayName,
        'Ngày': d.date,
        'Tổng nhân sự': d.total,
        'Đi làm': d.workingCount,
        'Nghỉ (Off)': d.offCount,
        'Đã phân quầy': d.assignedCount,
        'Chưa phân quầy': d.unassignedCount,
        'Tỷ lệ hoàn tất': `${d.percentage}%`,
        'Ca V815 (Có / Cần)': `${v815?.totalStaff || 0} NV / ${v815?.targetCount || 0} Quầy`,
        'Ca V818 (Có / Cần)': `${v818?.totalStaff || 0} NV / ${v818?.targetCount || 0} Quầy`,
        'Ca V820_V822 (Có / Cần)': `${v820?.totalStaff || 0} NV / ${v820?.targetCount || 0} Quầy`,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCao_Tuan');
    XLSX.writeFile(wb, `BaoCao_DWS_Tuan_${currentMonday}.xlsx`);
  };

  const handleExportWeeklyDwsExcel = () => {
    excelService.exportWeeklyDwsToExcel({
      mondayDate: currentMonday,
      counters,
      assignmentsMap,
      shifts,
      weeklySchedule,
    });
  };

  if (weeklySchedule.length === 0) {
    return (
      <div className="max-w-7xl mx-auto pb-16">
        <EmptyState
          title="Chưa có dữ liệu báo cáo"
          description="Báo cáo yêu cầu dữ liệu ca làm việc tuần được tải lên hệ thống."
        />
      </div>
    );
  }

  return (
    <div id="reports-page" className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="neu-panel p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Báo cáo & thống kê phân bổ tuần</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tổng kết số lượng nhân sự, thống kê ca làm việc và nhu cầu quầy theo rule chuẩn
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportWeeklyDwsExcel}
            className="neu-button-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 rounded-lg cursor-pointer transition-colors"
            title="Tải bảng phân công DWS cả tuần (7 ngày) ra file Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Tải DWS tuần (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportReportExcel}
            className="neu-button-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất báo cáo Excel</span>
          </button>
        </div>
      </div>

      {/* Overview KPI Strip */}
      <div className="neu-panel p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 tabular-nums">
        <div className="pb-3 sm:pb-0 sm:pr-4">
          <div className="text-xs font-medium text-slate-500">Tổng lượt ca đi làm</div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{weekReport.totalWeeklyWorking}</div>
          <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
            <UserCheck className="w-3.5 h-3.5" /> Từ Thứ 2 đến Chủ Nhật
          </div>
        </div>

        <div className="pb-3 sm:pb-0 sm:px-4">
          <div className="text-xs font-medium text-slate-500">Tổng lượt ca nghỉ (OFF)</div>
          <div className="text-2xl font-bold text-slate-700 tracking-tight mt-1">{weekReport.totalWeeklyOff}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
            <UserX className="w-3.5 h-3.5" /> Không tham gia xếp quầy
          </div>
        </div>

        <div className="pt-3 sm:pt-0 sm:px-4">
          <div className="text-xs font-medium text-slate-500">Đã phân công quầy</div>
          <div className="text-2xl font-bold text-teal-800 tracking-tight mt-1">{weekReport.totalWeeklyAssigned}</div>
          <div className="text-[11px] text-teal-700 font-medium flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đạt {weekReport.overallPercentage}% toàn tuần
          </div>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4">
          <div className="text-xs font-medium text-slate-500">Chưa phân quầy</div>
          <div className="text-2xl font-bold text-amber-700 tracking-tight mt-1">{weekReport.totalWeeklyUnassigned}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">Cần tiếp tục phân bổ</div>
        </div>
      </div>

      {/* NEW: WEEKLY SHIFT DEMAND & COUNTER MATRIX TABLE */}
      <div className="neu-panel overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Ma trận thống kê ca làm việc & nhu cầu quầy theo tuần
              </h3>
              <p className="text-xs text-slate-500">
                Phân tích đối chiếu giữa nhân sự thực tế và quầy yêu cầu theo rule chuẩn cho từng ngày
              </p>
            </div>
          </div>

          {/* Shift Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSelectedShiftFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                selectedShiftFilter === 'all' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ca
            </button>
            <button
              type="button"
              onClick={() => setSelectedShiftFilter('V815')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                selectedShiftFilter === 'V815' ? 'bg-white text-amber-800 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              V815 (Sáng)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShiftFilter('V818')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                selectedShiftFilter === 'V818' ? 'bg-white text-emerald-800 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              V818 (Giữa)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShiftFilter('V820_V822')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                selectedShiftFilter === 'V820_V822' ? 'bg-white text-indigo-800 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              V820/V822 (Giữa)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShiftFilter('V829_V830')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                selectedShiftFilter === 'V829_V830' ? 'bg-white text-purple-800 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              V829/V830 (Tối)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50/70 text-slate-700 font-bold border-b border-slate-200/60 text-[11px]">
              <tr>
                <th className="py-3 px-4 text-left">Thứ & Ngày</th>
                <th className="py-3 px-3 text-center">Tổng ca đi làm</th>
                <th className="py-3 px-4 text-left">Ca V815 (Sáng)</th>
                <th className="py-3 px-4 text-left">Ca V818 / V618 (Gãy/Giữa)</th>
                <th className="py-3 px-4 text-left">Ca V820 / V822 (Ca Giữa)</th>
                <th className="py-3 px-4 text-left">Ca V829 / V830 (Ca Tối)</th>
                <th className="py-3 px-3 text-center">Đánh giá Cân đối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {weekReport.daysData.map((d) => {
                const v815 = d.demandStats.groups.find((g) => g.groupKey === 'V815');
                const v818 = d.demandStats.groups.find((g) => g.groupKey === 'V818');
                const v820 = d.demandStats.groups.find((g) => g.groupKey === 'V820_V822');
                const v829 = d.demandStats.groups.find((g) => g.groupKey === 'V829_V830');

                const renderGroupCell = (g: any, colorClass: string, bgClass: string) => {
                  if (!g) return <span className="text-slate-400">-</span>;
                  const isUnder = g.balance < 0;
                  const isOver = g.balance > 0;

                  return (
                    <div className={`p-2 rounded-xl ${bgClass} border border-slate-200/60 space-y-1`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800">
                          {g.totalStaff} NV <span className="text-slate-400 font-normal">/ {g.targetCount} quầy</span>
                        </span>
                        {isUnder ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                            Thiếu {Math.abs(g.balance)}
                          </span>
                        ) : isOver ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                            Dư +{g.balance}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                            Đủ
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate" title={g.targetCounters.map((c: any) => c.spec).join(', ')}>
                        Quầy cần mở: {g.targetCounters.map((c: any) => c.spec).join(', ')}
                      </div>
                    </div>
                  );
                };

                return (
                  <tr key={`matrix_${d.date}`} className="hover:bg-white/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-black text-slate-900">{d.dayName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{d.date}</div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="font-black text-sm text-slate-900">{d.workingCount}</span>
                      <div className="text-[10px] text-slate-500">nhân sự</div>
                    </td>

                    {/* V815 Column */}
                    <td className="py-3 px-4">
                      {selectedShiftFilter === 'all' || selectedShiftFilter === 'V815' ? (
                        renderGroupCell(v815, 'text-amber-700', 'bg-amber-50/50')
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* V818 Column */}
                    <td className="py-3 px-4">
                      {selectedShiftFilter === 'all' || selectedShiftFilter === 'V818' ? (
                        renderGroupCell(v818, 'text-emerald-700', 'bg-emerald-50/50')
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* V820_V822 Column */}
                    <td className="py-3 px-4">
                      {selectedShiftFilter === 'all' || selectedShiftFilter === 'V820_V822' ? (
                        renderGroupCell(v820, 'text-indigo-700', 'bg-indigo-50/50')
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* V829_V830 Column */}
                    <td className="py-3 px-4">
                      {selectedShiftFilter === 'all' || selectedShiftFilter === 'V829_V830' ? (
                        renderGroupCell(v829, 'text-purple-700', 'bg-purple-50/50')
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Overall Balance */}
                    <td className="py-3 px-3 text-center">
                      {d.demandStats.overallBalance === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" /> Cân đối
                        </span>
                      ) : d.demandStats.overallBalance > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Thừa +{d.demandStats.overallBalance}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Thiếu {Math.abs(d.demandStats.overallBalance)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Progress Table */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-white/60 bg-white/40 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Chi tiết Tiến độ Phân quầy theo từng ngày</h3>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50/60 text-slate-700 font-bold border-b border-slate-200/60">
              <tr>
                <th className="py-3 px-4 text-left">Thứ</th>
                <th className="py-3 px-4 text-left">Ngày</th>
                <th className="py-3 px-4 text-center">Tổng nhân sự</th>
                <th className="py-3 px-4 text-center">Đi làm</th>
                <th className="py-3 px-4 text-center">Nghỉ</th>
                <th className="py-3 px-4 text-center">Đã phân</th>
                <th className="py-3 px-4 text-center">Chưa phân</th>
                <th className="py-3 px-4 text-left">Tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {weekReport.daysData.map((d) => (
                <tr key={d.date} className="hover:bg-white/70 transition-colors">
                  <td className="py-3 px-4 font-black text-slate-900">{d.dayName}</td>
                  <td className="py-3 px-4 font-mono text-slate-600 font-semibold">{d.date}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-800">{d.total}</td>
                  <td className="py-3 px-4 text-center font-black text-emerald-700">{d.workingCount}</td>
                  <td className="py-3 px-4 text-center font-medium text-slate-500">{d.offCount}</td>
                  <td className="py-3 px-4 text-center font-black text-blue-700">{d.assignedCount}</td>
                  <td className="py-3 px-4 text-center font-black text-amber-700">{d.unassignedCount}</td>
                  <td className="py-3 px-4 w-48">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200/70 rounded-full h-2 overflow-hidden border border-slate-300/40">
                        <div
                          className="bg-teal-700 h-full rounded-full transition-all duration-500 shadow-2xs"
                          style={{ width: `${d.percentage}%` }}
                        />
                      </div>
                      <span className="font-black text-[11px] text-slate-800 w-9 text-right">{d.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Counter Utilization */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-teal-700" />
          Tần suất hoạt động của các Quầy Thu Ngân
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {counters.map((c) => {
            const usage = weekReport.counterUsage[c.id] || { morning: 0, afternoon: 0, total: 0 };
            return (
              <div key={c.id} className="p-3.5 glass-card rounded-2xl border-white/80 space-y-1.5 hover:bg-white/90 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900">Quầy {c.counterNumber}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    {usage.total} ca
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium truncate">{c.area}</div>
                <div className="text-[10px] text-slate-600 font-semibold flex justify-between pt-1.5 border-t border-slate-200/50">
                  <span className="text-amber-700">S: {usage.morning}</span>
                  <span className="text-indigo-700">C: {usage.afternoon}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
