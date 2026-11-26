import React, { useState, useMemo } from 'react';
import { Counter, CounterDayAssignment, SlotAssignment, UnassignedEmployee } from '../../types';
import { CounterCard } from './CounterCard';
import {
  Search,
  Sliders,
  Sparkles,
  RotateCcw,
  LayoutGrid,
  Grid,
  Filter,
  CheckCircle2,
  Clock,
  CircleDashed,
  X,
} from 'lucide-react';

interface CounterGridProps {
  counters: Counter[];
  assignments: Record<string, CounterDayAssignment>;
  selectedDate?: string;
  onAssignSlot: (counterId: string, slot: 'morning' | 'afternoon', emp: UnassignedEmployee | SlotAssignment) => void;
  onUnassignSlot: (counterId: string, slot: 'morning' | 'afternoon') => void;
  onMoveEmployee: (fromCounterId: string, fromSlot: 'morning' | 'afternoon', toCounterId: string, toSlot: 'morning' | 'afternoon') => void;
  onUpdateMetadata?: (counterId: string, updates: Partial<CounterDayAssignment>) => void;
  onOpenAssignModal?: (counterId: string, slot: 'morning' | 'afternoon') => void;
  onClearAllDay?: () => void;
  onAutoAssignClick?: () => void;
  onAutoSuggestClick?: () => void;
  onOpenRulesClick?: () => void;
  onOpenSwapModal?: (counterId: string, slot: 'morning' | 'afternoon', emp: SlotAssignment) => void;
}

export const CounterGrid: React.FC<CounterGridProps> = ({
  counters,
  assignments,
  selectedDate,
  onAssignSlot,
  onUnassignSlot,
  onMoveEmployee,
  onUpdateMetadata,
  onOpenAssignModal,
  onClearAllDay,
  onAutoAssignClick,
  onAutoSuggestClick,
  onOpenRulesClick,
  onOpenSwapModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'full' | 'partial' | 'empty'>('all');
  const [gridDensity, setGridDensity] = useState<'compact' | 'dense' | 'normal'>('compact');

  // Extract unique areas
  const areas = useMemo(() => {
    return Array.from(new Set(counters.map((c) => c.area).filter(Boolean)));
  }, [counters]);

  // Calculate status counts
  const { fullCount, partialCount, emptyCount } = useMemo(() => {
    let full = 0;
    let partial = 0;
    let empty = 0;

    counters.forEach((c) => {
      const ca = assignments[c.id];
      const hasM = !!(ca?.morning?.employeeName || ca?.morning?.employeeId);
      const hasA = !!(ca?.afternoon?.employeeName || ca?.afternoon?.employeeId);

      if (hasM && hasA) full++;
      else if (hasM || hasA) partial++;
      else empty++;
    });

    return { fullCount: full, partialCount: partial, emptyCount: empty };
  }, [counters, assignments]);

  // Filter counters
  const filteredCounters = useMemo(() => {
    return counters.filter((c) => {
      const matchesSearch =
        c.counterNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (assignments[c.id]?.morning?.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (assignments[c.id]?.afternoon?.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesArea = areaFilter === 'all' || c.area === areaFilter;

      const ca = assignments[c.id];
      const hasM = !!(ca?.morning?.employeeName || ca?.morning?.employeeId);
      const hasA = !!(ca?.afternoon?.employeeName || ca?.afternoon?.employeeId);
      const isFull = hasM && hasA;
      const isPartial = (hasM && !hasA) || (!hasM && hasA);
      const isEmpty = !hasM && !hasA;

      let matchesStatus = true;
      if (statusFilter === 'full') matchesStatus = !!isFull;
      else if (statusFilter === 'partial') matchesStatus = !!isPartial;
      else if (statusFilter === 'empty') matchesStatus = !!isEmpty;

      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [counters, assignments, searchTerm, areaFilter, statusFilter]);

  return (
    <div id="counter-grid-container" className="space-y-3">
      {/* Search & Filter Toolbar */}
      <div className="neu-panel p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm số quầy (1-27, Delica...), tên NV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs neu-inset rounded-lg focus:outline-hidden"
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

            {/* Quick Status Filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer tabular-nums ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({counters.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('empty')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer tabular-nums ${
                  statusFilter === 'empty'
                    ? 'bg-white text-amber-800 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CircleDashed className="w-3.5 h-3.5 text-amber-500" />
                <span>Còn trống ({emptyCount + partialCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('full')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer tabular-nums ${
                  statusFilter === 'full'
                    ? 'bg-white text-emerald-800 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đủ 2 ca ({fullCount})</span>
              </button>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2">
            {onClearAllDay && Object.keys(assignments).length > 0 && (
              <button
                type="button"
                onClick={onClearAllDay}
                className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 rounded-lg cursor-pointer transition-colors hover:bg-rose-50"
                title="Làm trống toàn bộ quầy ngày này để phân bổ lại"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm trống ngày</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Area Filter Chips */}
        {areas.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 text-xs border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-1">
              Khu vực:
            </span>
            <button
              type="button"
              onClick={() => setAreaFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer tabular-nums ${
                areaFilter === 'all'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả ({counters.length})
            </button>
            {areas.map((a) => {
              const countInArea = counters.filter((c) => c.area === a).length;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAreaFilter(a)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer tabular-nums ${
                    areaFilter === a
                      ? 'bg-teal-50 text-teal-800 border border-teal-200 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {a} ({countInArea})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of Counters with Density Classes */}
      {filteredCounters.length === 0 ? (
        <div className="neu-panel p-10 text-center text-slate-500 text-xs font-medium border-dashed border border-slate-300">
          Không tìm thấy quầy thu ngân nào phù hợp điều kiện tìm kiếm/lọc.
        </div>
      ) : (
        <div
          className={`grid transition-all ${
            gridDensity === 'dense'
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2'
              : gridDensity === 'compact'
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3'
          }`}
        >
          {filteredCounters.map((counter) => (
            <CounterCard
              key={counter.id}
              counter={counter}
              compact={gridDensity !== 'normal'}
              density={gridDensity}
              assignment={assignments[counter.id]}
              currentDate={selectedDate}
              allCounters={counters}
              onAssignSlot={onAssignSlot}
              onUnassignSlot={onUnassignSlot}
              onMoveEmployee={onMoveEmployee}
              onUpdateMetadata={onUpdateMetadata}
              onOpenAssignModal={onOpenAssignModal}
              onOpenSwapModal={onOpenSwapModal}
            />
          ))}
        </div>
      )}
    </div>
  );
};

