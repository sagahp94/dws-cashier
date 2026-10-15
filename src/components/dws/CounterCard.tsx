import React, { useState } from 'react';
import { Counter, CounterDayAssignment, SlotAssignment, UnassignedEmployee } from '../../types';
import {
  Sun,
  Moon,
  X,
  Plus,
  Check,
  GripVertical,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';
import { findEmployeeRecord } from '../../services/zoneTrackingService';
import { getCounterMonitoredCluster } from '../../services/consecutiveWarningService';
import { EmployeeHoverCard } from './EmployeeHoverCard';
import { CounterHoverCard } from './CounterHoverCard';

interface CounterCardProps {
  counter: Counter;
  assignment?: CounterDayAssignment;
  compact?: boolean;
  density?: 'dense' | 'compact' | 'normal';
  currentDate?: string;
  allCounters?: Counter[];
  onAssignSlot: (counterId: string, slot: 'morning' | 'afternoon', emp: UnassignedEmployee | SlotAssignment) => void;
  onUnassignSlot: (counterId: string, slot: 'morning' | 'afternoon') => void;
  onMoveEmployee: (fromCounterId: string, fromSlot: 'morning' | 'afternoon', toCounterId: string, toSlot: 'morning' | 'afternoon') => void;
  onUpdateMetadata?: (counterId: string, updates: Partial<CounterDayAssignment>) => void;
  onOpenAssignModal?: (counterId: string, slot: 'morning' | 'afternoon') => void;
  onOpenSwapModal?: (counterId: string, slot: 'morning' | 'afternoon', emp: SlotAssignment) => void;
}

export const CounterCard: React.FC<CounterCardProps> = ({
  counter,
  assignment,
  compact = true,
  density = 'compact',
  currentDate = '',
  allCounters,
  onAssignSlot,
  onUnassignSlot,
  onMoveEmployee,
  onUpdateMetadata,
  onOpenAssignModal,
  onOpenSwapModal,
}) => {
  const [dragOverSlot, setDragOverSlot] = useState<'morning' | 'afternoon' | null>(null);

  const isDense = density === 'dense';

  const morning = assignment?.morning;
  const afternoon = assignment?.afternoon;

  const handleDragOver = (e: React.DragEvent, slot: 'morning' | 'afternoon') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlot !== slot) setDragOverSlot(slot);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent, slot: 'morning' | 'afternoon') => {
    e.preventDefault();
    setDragOverSlot(null);

    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;

    try {
      const payload = JSON.parse(rawData);
      if (payload.type === 'unassigned_employee') {
        const emp: UnassignedEmployee = payload.data;
        onAssignSlot(counter.id, slot, emp);
      } else if (payload.type === 'assigned_slot') {
        const { counterId: sourceCounterId, slot: sourceSlot } = payload;
        if (sourceCounterId === counter.id && sourceSlot === slot) return;
        onMoveEmployee(sourceCounterId, sourceSlot, counter.id, slot);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const handleSlotDragStart = (e: React.DragEvent, slot: 'morning' | 'afternoon', emp: SlotAssignment) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'assigned_slot',
        counterId: counter.id,
        slot,
        data: emp,
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  // Status indicators: check employeeName OR employeeId so employees without an ID still display properly
  const hasMorning = !!(morning?.employeeName || morning?.employeeId);
  const hasAfternoon = !!(afternoon?.employeeName || afternoon?.employeeId);

  const isFullyAssigned = hasMorning && hasAfternoon;
  const isPartiallyAssigned = (hasMorning && !hasAfternoon) || (!hasMorning && hasAfternoon);
  const isEmpty = !hasMorning && !hasAfternoon;

  return (
    <div
      id={`counter-card-${counter.id}`}
      className={`rounded-xl transition-all duration-150 bg-white border flex flex-col shadow-2xs ${
        isDense ? 'p-2' : 'p-2.5'
      } ${
        isFullyAssigned
          ? 'border-emerald-200/90'
          : isPartiallyAssigned
          ? 'border-slate-200'
          : 'border-slate-200/80'
      }`}
    >
      {/* Card Header: Counter number & Area */}
      <CounterHoverCard
        counter={counter}
        assignment={assignment}
        currentDate={currentDate || new Date().toISOString().slice(0, 10)}
        allCounters={allCounters}
      >
        <div
          className={`flex items-center justify-between border-b border-slate-100 w-full hover:opacity-90 transition-opacity ${
            isDense ? 'pb-1.5 mb-1.5' : 'pb-2 mb-2'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`font-bold text-slate-900 tracking-tight ${
                isDense ? 'text-xs' : 'text-xs sm:text-sm'
              }`}
            >
              Quầy {counter.counterNumber}
            </span>
            {isFullyAssigned ? (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700"
                title="Đã xếp đủ 2 ca"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>2/2</span>
              </span>
            ) : isPartiallyAssigned ? (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-700"
                title="Mới có 1 ca"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>1/2</span>
              </span>
            ) : (
              <span
                className="text-[10px] font-medium text-slate-400"
                title="Chưa xếp ca nào"
              >
                Trống
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {getCounterMonitoredCluster(counter) && (
              <span
                className={`font-semibold uppercase rounded px-1 py-0.2 text-[8.5px] border truncate ${
                  getCounterMonitoredCluster(counter)!.bgBadge
                } ${getCounterMonitoredCluster(counter)!.textBadge} ${
                  getCounterMonitoredCluster(counter)!.borderBadge
                }`}
                title={`Khu vực kiểm soát 2 ngày liên tiếp: ${getCounterMonitoredCluster(counter)!.displayRange}`}
              >
                {getCounterMonitoredCluster(counter)!.shortLabel.replace('Khu vực ', '')}
              </span>
            )}
            <span
              className="font-medium uppercase text-slate-400 text-[9px] truncate max-w-[75px]"
            >
              {counter.area || 'AEON'}
            </span>
          </div>
        </div>
      </CounterHoverCard>

      {/* Slots Container */}
      <div className={`flex flex-col flex-1 ${isDense ? 'gap-1' : 'gap-1.5'}`}>
        {/* === CA SÁNG SLOT === */}
        <div
          onDragOver={(e) => handleDragOver(e, 'morning')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'morning')}
          className={`rounded-lg transition-all relative ${
            dragOverSlot === 'morning'
              ? 'border-dashed border-2 border-teal-600 bg-teal-50/50 p-1.5 text-xs'
              : hasMorning
              ? `border border-amber-200/80 bg-amber-50/40 ${isDense ? 'p-1.5' : 'p-1.5 sm:p-2'} text-xs`
              : `border border-dashed border-slate-200 hover:border-amber-300 bg-slate-50/40 ${isDense ? 'p-1' : 'p-1.5'} text-xs`
          }`}
        >
          {hasMorning && morning ? (
            <div
              draggable
              onDragStart={(e) => handleSlotDragStart(e, 'morning', morning)}
              className="cursor-grab active:cursor-grabbing group/item"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                  <Sun className="w-3.5 h-3.5 mt-0.5 text-amber-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <EmployeeHoverCard
                        employeeName={morning.employeeName}
                        employeeId={morning.employeeId}
                        currentDate={currentDate || new Date().toISOString().slice(0, 10)}
                        currentShiftCodeFallback={morning.shiftCode}
                        allCounters={allCounters}
                      >
                        <span
                          className={`font-semibold text-slate-900 leading-tight whitespace-normal break-words select-none hover:text-teal-700 transition-colors ${
                            isDense
                              ? 'text-[11px]'
                              : density === 'compact'
                              ? 'text-[11.5px]'
                              : 'text-xs'
                          }`}
                        >
                          {morning.employeeName}
                        </span>
                      </EmployeeHoverCard>
                      {findEmployeeRecord(morning.employeeName, morning.employeeId)?.isSup && (
                        <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                          SUP
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-0.5">
                  <span
                    className={`font-mono font-bold rounded text-amber-900 bg-amber-100/80 border border-amber-200/80 ${
                      isDense ? 'text-[8.5px] px-1 py-0.2' : 'text-[9px] px-1.5 py-0.5'
                    }`}
                  >
                    {morning.shiftCode || 'SÁNG'}
                  </span>
                  {onOpenSwapModal && (
                    <button
                      type="button"
                      title={morning.swapRequested ? "Xem/Sửa yêu cầu đổi ca" : "Báo yêu cầu đổi ca (Swap Requested)"}
                      onClick={() => onOpenSwapModal(counter.id, 'morning', morning)}
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        morning.swapRequested
                          ? 'text-amber-800 bg-amber-200 hover:bg-amber-300'
                          : 'text-slate-400 hover:text-amber-700 hover:bg-white/60'
                      }`}
                    >
                      <ArrowLeftRight className={isDense ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Xóa khỏi quầy"
                    onClick={() => onUnassignSlot(counter.id, 'morning')}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-white/60 transition-colors cursor-pointer"
                  >
                    <X className={isDense ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                  </button>
                </div>
              </div>

              {/* Swap Requested Notification Badge */}
              {morning.swapRequested && (
                <div
                  onClick={() => onOpenSwapModal?.(counter.id, 'morning', morning)}
                  className="mt-1 flex items-center justify-between gap-1 text-[9.5px] font-semibold bg-amber-100/80 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer hover:bg-amber-200/80 transition-colors"
                  title="Nhấn để xem chi tiết hoặc duyệt đổi ca"
                >
                  <span className="flex items-center gap-1 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                    <span className="truncate">Đổi ca: {morning.swapReason || 'Chờ duyệt'}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAssignModal?.(counter.id, 'morning')}
              className={`w-full flex items-center justify-between cursor-pointer rounded-md text-slate-400 hover:text-amber-800 hover:bg-amber-50/60 transition-colors ${
                isDense ? 'py-1 px-1.5 text-[10.5px]' : 'py-1.5 px-2 text-xs'
              } font-medium`}
              title="Xếp nhân viên vào ca sáng hoặc xem gợi ý phù hợp"
            >
              <span className="flex items-center gap-1.5">
                <Sun className={`${isDense ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-400`} />
                <span>+ Ca sáng</span>
              </span>
              <span className="text-[9px] font-medium text-amber-700">
                ⚡ Gợi ý
              </span>
            </button>
          )}
        </div>

        {/* === CA CHIỀU / TỐI SLOT === */}
        <div
          onDragOver={(e) => handleDragOver(e, 'afternoon')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'afternoon')}
          className={`rounded-lg transition-all relative ${
            dragOverSlot === 'afternoon'
              ? 'border-dashed border-2 border-teal-600 bg-teal-50/50 p-1.5 text-xs'
              : hasAfternoon
              ? `border border-indigo-200/80 bg-indigo-50/40 ${isDense ? 'p-1.5' : 'p-1.5 sm:p-2'} text-xs`
              : `border border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/40 ${isDense ? 'p-1' : 'p-1.5'} text-xs`
          }`}
        >
          {hasAfternoon && afternoon ? (
            <div
              draggable
              onDragStart={(e) => handleSlotDragStart(e, 'afternoon', afternoon)}
              className="cursor-grab active:cursor-grabbing group/item"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                  <Moon className="w-3.5 h-3.5 mt-0.5 text-indigo-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <EmployeeHoverCard
                        employeeName={afternoon.employeeName}
                        employeeId={afternoon.employeeId}
                        currentDate={currentDate || new Date().toISOString().slice(0, 10)}
                        currentShiftCodeFallback={afternoon.shiftCode}
                        allCounters={allCounters}
                      >
                        <span
                          className={`font-semibold text-slate-900 leading-tight whitespace-normal break-words select-none hover:text-teal-700 transition-colors ${
                            isDense
                              ? 'text-[11px]'
                              : density === 'compact'
                              ? 'text-[11.5px]'
                              : 'text-xs'
                          }`}
                        >
                          {afternoon.employeeName}
                        </span>
                      </EmployeeHoverCard>
                      {findEmployeeRecord(afternoon.employeeName, afternoon.employeeId)?.isSup && (
                        <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                          SUP
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-0.5">
                  <span
                    className={`font-mono font-bold rounded text-indigo-900 bg-indigo-100/80 border border-indigo-200/80 ${
                      isDense ? 'text-[8.5px] px-1 py-0.2' : 'text-[9px] px-1.5 py-0.5'
                    }`}
                  >
                    {afternoon.shiftCode || 'TỐI'}
                  </span>
                  {onOpenSwapModal && (
                    <button
                      type="button"
                      title={afternoon.swapRequested ? "Xem/Sửa yêu cầu đổi ca" : "Báo yêu cầu đổi ca (Swap Requested)"}
                      onClick={() => onOpenSwapModal(counter.id, 'afternoon', afternoon)}
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        afternoon.swapRequested
                          ? 'text-amber-800 bg-amber-200 hover:bg-amber-300'
                          : 'text-slate-400 hover:text-indigo-700 hover:bg-white/60'
                      }`}
                    >
                      <ArrowLeftRight className={isDense ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Xóa khỏi quầy"
                    onClick={() => onUnassignSlot(counter.id, 'afternoon')}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-white/60 transition-colors cursor-pointer"
                  >
                    <X className={isDense ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                  </button>
                </div>
              </div>

              {/* Swap Requested Notification Badge */}
              {afternoon.swapRequested && (
                <div
                  onClick={() => onOpenSwapModal?.(counter.id, 'afternoon', afternoon)}
                  className="mt-1 flex items-center justify-between gap-1 text-[9.5px] font-semibold bg-indigo-100/80 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer hover:bg-indigo-200/80 transition-colors"
                  title="Nhấn để xem chi tiết hoặc duyệt đổi ca"
                >
                  <span className="flex items-center gap-1 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                    <span className="truncate">Đổi ca: {afternoon.swapReason || 'Chờ duyệt'}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAssignModal?.(counter.id, 'afternoon')}
              className={`w-full flex items-center justify-between cursor-pointer rounded-md text-slate-400 hover:text-indigo-800 hover:bg-indigo-50/60 transition-colors ${
                isDense ? 'py-1 px-1.5 text-[10.5px]' : 'py-1.5 px-2 text-xs'
              } font-medium`}
              title="Xếp nhân viên vào ca chiều hoặc xem gợi ý phù hợp"
            >
              <span className="flex items-center gap-1.5">
                <Moon className={`${isDense ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-indigo-400`} />
                <span>+ Ca chiều</span>
              </span>
              <span className="text-[9px] font-medium text-indigo-700">
                ⚡ Gợi ý
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

