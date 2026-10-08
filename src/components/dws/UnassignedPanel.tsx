import React, { useState } from 'react';
import { UnassignedEmployee, ShiftCategory, Counter } from '../../types';
import { Search, UserCheck, Clock, Sun, Moon, Sparkles, GripVertical, Plus, Sliders, AlertTriangle, X, UserPlus, UserX, RefreshCw } from 'lucide-react';
import { getEmployeeRecentZoneSummary } from '../../services/zoneTrackingService';
import { EmployeeHoverCard } from './EmployeeHoverCard';

interface UnassignedPanelProps {
  unassignedEmployees: UnassignedEmployee[];
  excludedEmployees?: UnassignedEmployee[];
  counters?: Counter[];
  selectedDate?: string;
  onSelectEmployee?: (emp: UnassignedEmployee) => void;
  onAutoAssignClick?: () => void;
  onAutoSuggestClick?: () => void;
  onOpenEmployeeSuggest?: (emp: UnassignedEmployee) => void;
  onOpenRulesClick?: () => void;
  onAddEmployee?: (emp: UnassignedEmployee) => void;
  onExcludeEmployee?: (emp: UnassignedEmployee) => void;
  onRestoreEmployee?: (emp: UnassignedEmployee) => void;
}

export const UnassignedPanel: React.FC<UnassignedPanelProps> = ({
  unassignedEmployees,
  excludedEmployees = [],
  counters = [],
  selectedDate = new Date().toISOString().split('T')[0],
  onSelectEmployee,
  onAutoAssignClick,
  onAutoSuggestClick,
  onOpenEmployeeSuggest,
  onOpenRulesClick,
  onAddEmployee,
  onExcludeEmployee,
  onRestoreEmployee,
}) => {
  const [activeTab, setActiveTab] = useState<'unassigned' | 'excluded'>('unassigned');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ShiftCategory>('all');

  const sourceList = activeTab === 'unassigned' ? unassignedEmployees : excludedEmployees;

  const recentSummaryMap = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof getEmployeeRecentZoneSummary>>();
    sourceList.forEach((emp) => {
      map.set(
        emp.fullName,
        getEmployeeRecentZoneSummary(emp.fullName, emp.employeeId, selectedDate, counters, emp.isSup)
      );
    });
    return map;
  }, [sourceList, selectedDate, counters]);

  const filtered = sourceList
    .filter((emp) => {
      const matchesSearch =
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        emp.shiftCode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || emp.category === categoryFilter;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      // Prioritize V6* before V8* for afternoon employees
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

  const morningCount = unassignedEmployees.filter((e) => e.category === 'morning').length;
  const afternoonCount = unassignedEmployees.filter((e) => e.category === 'afternoon').length;

  const handleDragStart = (e: React.DragEvent, emp: UnassignedEmployee) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'unassigned_employee', data: emp }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      id="unassigned-panel"
      className="neu-panel flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200/80 space-y-3 bg-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {activeTab === 'unassigned'
                ? 'Chờ xếp quầy'
                : 'Không phân quầy'}
            </h3>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md tabular-nums">
              {activeTab === 'unassigned' ? unassignedEmployees.length : excludedEmployees.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenRulesClick && activeTab === 'unassigned' && (
              <button
                type="button"
                id="btn-rules-config-trigger"
                onClick={onOpenRulesClick}
                className="neu-button-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer"
                title="Cấu hình quy tắc phân quầy (Rules)"
              >
                <Sliders className="w-3.5 h-3.5 text-teal-700" />
                <span>Quy tắc</span>
              </button>
            )}
          </div>
        </div>

        {/* View Mode Toggle: Chờ xếp vs Tạm miễn */}
        {excludedEmployees.length > 0 && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('unassigned')}
              className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer text-center ${
                activeTab === 'unassigned'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chờ xếp ({unassignedEmployees.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('excluded')}
              className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer text-center ${
                activeTab === 'excluded'
                  ? 'bg-white text-rose-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Không phân quầy ({excludedEmployees.length})
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã NV, ca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-8 py-1.5 text-xs neu-inset rounded-lg focus:outline-hidden"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/70 text-xs">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer text-xs font-medium tabular-nums ${
              categoryFilter === 'all'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({sourceList.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('morning')}
            className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer text-xs font-medium tabular-nums ${
              categoryFilter === 'morning'
                ? 'bg-white text-amber-800 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sun className="w-3 h-3 text-amber-500" />
            <span>Sáng ({sourceList.filter((e) => e.category === 'morning').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('afternoon')}
            className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer text-xs font-medium tabular-nums ${
              categoryFilter === 'afternoon'
                ? 'bg-white text-indigo-800 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Moon className="w-3 h-3 text-indigo-500" />
            <span>Chiều ({sourceList.filter((e) => e.category === 'afternoon').length})</span>
          </button>
        </div>
      </div>

      {/* Employee List */}
      <div className="p-3 flex-1 overflow-y-auto space-y-2 max-h-[640px] sm:max-h-[calc(100vh-280px)] bg-slate-50/40">
        {sourceList.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-2.5">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-slate-800">
              {activeTab === 'unassigned' ? 'Đã phân quầy hết' : 'Không có nhân viên nào bị loại trừ'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {activeTab === 'unassigned'
                ? 'Toàn bộ nhân viên đi làm hôm nay đã có vị trí quầy.'
                : 'Tất cả nhân viên đủ điều kiện đều tham gia phân quầy.'}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">Không tìm thấy nhân viên phù hợp bộ lọc.</div>
        ) : (
          filtered.map((emp, idx) => {
            const recent = recentSummaryMap.get(emp.fullName) || {
              recentCounters: [],
              streakCount: 0,
              streakZone: '',
              isExemptFromStreakWarning: false,
            };
            const isNearStreak = !recent.isExemptFromStreakWarning && recent.streakCount >= 2;
            const isMorning = emp.category === 'morning';

            return (
              <div
                key={`${emp.employeeId || emp.fullName}_${idx}`}
                draggable={activeTab === 'unassigned'}
                onDragStart={(e) => handleDragStart(e, emp)}
                className={`rounded-xl p-2.5 bg-white border transition-all ${
                  activeTab === 'unassigned' ? 'cursor-grab active:cursor-grabbing hover:border-slate-300 shadow-2xs' : ''
                } ${
                  emp.isExcludedFromAssignment
                    ? 'border-rose-200 bg-rose-50/20'
                    : isNearStreak
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-slate-200/90'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                    {activeTab === 'unassigned' && (
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <EmployeeHoverCard
                      employeeName={emp.fullName}
                      employeeId={emp.employeeId}
                      currentDate={selectedDate}
                      currentShiftCodeFallback={emp.shiftCode}
                      allCounters={counters}
                    >
                      <span className="text-xs font-bold text-slate-900 truncate hover:text-teal-700 transition-colors">
                        {emp.fullName}
                      </span>
                    </EmployeeHoverCard>

                    {/* SUP Badge */}
                    {emp.isSup ? (
                      <span className="rounded px-1.5 py-0.2 text-[9px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                        SUP
                      </span>
                    ) : null}

                    {emp.isExcludedFromAssignment && (
                      <span className="rounded px-1.5 py-0.2 text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Không phân quầy{emp.exclusionNote ? ` • ${emp.exclusionNote}` : ''}
                      </span>
                    )}
                  </div>
                  {emp.employeeId && (
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {emp.employeeId}
                    </span>
                  )}
                </div>

                {/* Capability Badges */}
                {(emp.canBanhMy || emp.canDelica) && (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
                    {emp.canBanhMy && (
                      <span className="font-medium text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80">
                        Bánh mỳ
                      </span>
                    )}
                    {emp.canDelica && (
                      <span className="font-medium text-orange-800 bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200/80">
                        Delica
                      </span>
                    )}
                  </div>
                )}

                {/* Missing from Catalog Notice Box */}
                {emp.isMissingFromCatalog && !emp.isExcludedFromAssignment && (
                  <div className="mt-2 p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-[10.5px] text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Chưa có trong DS nhân viên</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {onAddEmployee && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddEmployee(emp);
                          }}
                          className="neu-button-primary px-2 py-1 text-[10px] font-semibold rounded-md inline-flex items-center gap-1 cursor-pointer"
                          title="Bổ sung nhân viên này vào Danh mục nhân viên"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Thêm NV</span>
                        </button>
                      )}
                      {onExcludeEmployee && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onExcludeEmployee(emp);
                          }}
                          className="neu-button-secondary px-2 py-1 text-[10px] font-semibold text-rose-700 rounded-md inline-flex items-center gap-1 cursor-pointer hover:bg-rose-50"
                          title="Không cho vào danh sách phân quầy"
                        >
                          <UserX className="w-3 h-3 text-rose-600" />
                          <span>Miễn xếp</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* If Excluded: Show Restore or Add to list actions */}
                {emp.isExcludedFromAssignment && (
                  <div className="mt-2 p-2 bg-rose-50/60 border border-rose-200 rounded-lg text-[10.5px] text-rose-900 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 font-semibold">
                      <div className="flex items-center gap-1">
                        <UserX className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Không phân quầy</span>
                      </div>
                      {emp.exclusionNote && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[9.5px] font-bold">
                          Note: {emp.exclusionNote}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {onAddEmployee && emp.isMissingFromCatalog && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddEmployee(emp);
                          }}
                          className="neu-button-primary px-2 py-1 text-[10px] font-semibold rounded-md inline-flex items-center gap-1 cursor-pointer"
                          title="Bổ sung vào Danh sách nhân viên"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Thêm NV</span>
                        </button>
                      )}
                      {onRestoreEmployee && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestoreEmployee(emp);
                          }}
                          className="neu-button-secondary px-2 py-1 text-[10px] font-semibold text-slate-700 rounded-md inline-flex items-center gap-1 cursor-pointer hover:bg-slate-100"
                          title={emp.isResigned ? 'Bỏ tick Đã nghỉ việc và cho phép phân quầy lại' : 'Hủy trạng thái không phân quầy'}
                        >
                          <RefreshCw className="w-3 h-3 text-slate-600" />
                          <span>{emp.isResigned ? 'Đi làm lại / Xếp lại' : 'Xếp lại'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 3 Days Recent Counter History */}
                {recent.recentCounters.length > 0 && (
                  <div className="mt-1.5 text-[10px] text-slate-500 flex items-center gap-1 truncate">
                    <span className="font-medium text-slate-400">3 ngày qua:</span>
                    <span className="font-mono text-[9.5px] text-slate-600 truncate">
                      {recent.recentCounters.map((rc) => `${rc.dayNameShort.split(' ')[0]}: Q.${rc.counterNumber}`).join(' → ')}
                    </span>
                  </div>
                )}

                {isNearStreak && (
                  <div className="mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800">
                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      Đã đứng {recent.streakCount} ngày {recent.streakZone}
                    </span>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-mono border ${
                        isMorning
                          ? 'bg-amber-50 text-amber-900 border-amber-200/80'
                          : 'bg-indigo-50 text-indigo-900 border-indigo-200/80'
                      }`}
                    >
                      {emp.shiftCode}
                    </span>
                    {emp.startTime && emp.endTime && (
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        {emp.startTime}–{emp.endTime}
                      </span>
                    )}
                  </div>

                  {activeTab === 'unassigned' && (
                    <div className="flex items-center gap-1">
                      {onOpenEmployeeSuggest && (
                        <button
                          type="button"
                          onClick={() => onOpenEmployeeSuggest(emp)}
                          className="py-1 px-2 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors flex items-center gap-0.5 cursor-pointer"
                          title="Gợi ý các quầy phù hợp nhất cho nhân viên này"
                        >
                          ⚡ Gợi ý
                        </button>
                      )}
                      {onSelectEmployee && (
                        <button
                          type="button"
                          onClick={() => onSelectEmployee(emp)}
                          className="neu-button-secondary py-1 px-2 text-[10px] font-semibold text-teal-800 hover:text-teal-900 rounded-md transition-colors flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Chọn
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

