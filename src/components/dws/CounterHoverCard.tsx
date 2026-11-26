import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Store,
  Sun,
  Moon,
  Clock,
  Calendar,
  History,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Counter, CounterDayAssignment } from '../../types';
import { getCounterMonitoredCluster } from '../../services/consecutiveWarningService';
import {
  getEmployee3DaysCounterHistory,
  Employee3DaysHistoryResult,
} from '../../services/employeeHistoryService';

interface CounterHoverCardProps {
  counter: Counter;
  assignment?: CounterDayAssignment;
  currentDate: string;
  allCounters?: Counter[];
  children: React.ReactNode;
  className?: string;
}

export const CounterHoverCard: React.FC<CounterHoverCardProps> = ({
  counter,
  assignment,
  currentDate,
  allCounters,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: false,
  });

  const [morningHistory, setMorningHistory] = useState<Employee3DaysHistoryResult | null>(null);
  const [afternoonHistory, setAfternoonHistory] = useState<Employee3DaysHistoryResult | null>(null);

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cluster = getCounterMonitoredCluster(counter);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    hoverTimeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const cardWidth = 360;
      const cardHeight = 400;

      let left = rect.left + rect.width / 2 - cardWidth / 2;
      if (left < 12) left = 12;
      if (left + cardWidth > window.innerWidth - 12) {
        left = window.innerWidth - cardWidth - 12;
      }

      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < cardHeight && rect.top > cardHeight;
      const top = placeAbove ? rect.top - 8 : rect.bottom + 8;

      setCoords({ top, left, placeAbove });

      if (assignment?.morning?.employeeName) {
        setMorningHistory(
          getEmployee3DaysCounterHistory(
            assignment.morning.employeeName,
            assignment.morning.employeeId,
            currentDate,
            allCounters
          )
        );
      } else {
        setMorningHistory(null);
      }

      if (assignment?.afternoon?.employeeName) {
        setAfternoonHistory(
          getEmployee3DaysCounterHistory(
            assignment.afternoon.employeeName,
            assignment.afternoon.employeeId,
            currentDate,
            allCounters
          )
        );
      } else {
        setAfternoonHistory(null);
      }

      setIsOpen(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const cardContent = isOpen && (
    <div
      onMouseEnter={() => {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
      }}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        top: coords.placeAbove ? 'auto' : `${coords.top}px`,
        bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
        left: `${coords.left}px`,
        width: '360px',
        zIndex: 99999,
      }}
      className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden text-slate-800 text-xs animate-fadeIn font-sans"
    >
      {/* Header Quầy */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-400/30 text-teal-200">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-black text-sm text-white">Quầy {counter.counterNumber}</h4>
                <span className="text-[10px] font-bold text-teal-200 uppercase bg-white/10 px-1.5 py-0.2 rounded">
                  {counter.area || 'Siêu thị'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Mã định danh: <span className="font-mono text-slate-300">{counter.id}</span>
              </p>
            </div>
          </div>

          {cluster && (
            <span
              className={`text-[9px] font-black uppercase rounded-md border px-1.5 py-0.5 ${cluster.bgBadge} ${cluster.textBadge} ${cluster.borderBadge}`}
            >
              {cluster.shortLabel}
            </span>
          )}
        </div>
      </div>

      {/* Danh sách nhân viên và Lịch sử 3 ngày qua */}
      <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
        {/* Ca Sáng */}
        <div className="p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              <span>Ca Sáng (Ô 1)</span>
            </span>
            {assignment?.morning?.shiftCode && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                {assignment.morning.shiftCode}
              </span>
            )}
          </div>

          {assignment?.morning?.employeeName ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">{assignment.morning.employeeName}</span>
                {assignment.morning.employeeId && (
                  <span className="text-[10.5px] font-mono text-slate-500">{assignment.morning.employeeId}</span>
                )}
              </div>

              {/* Ca đã đổi? */}
              {morningHistory?.shiftToday.hasChanged && (
                <div className="mt-1 text-[10.5px] p-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 flex items-center gap-1.5 font-bold">
                  <span className="text-[9.5px] text-amber-800">⚡ Đã đổi ca:</span>
                  <span className="line-through text-rose-700">{morningHistory.shiftToday.originalShiftCode}</span>
                  <ArrowRight className="w-3 h-3 text-amber-600" />
                  <span className="text-emerald-800">{morningHistory.shiftToday.currentShiftCode}</span>
                </div>
              )}

              {/* Lịch sử 3 ngày qua */}
              <div className="mt-2 pt-1.5 border-t border-amber-200/60">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3 text-amber-600" />
                    <span>3 ngày qua (không tính ngày nghỉ):</span>
                  </span>
                </div>
                {morningHistory?.history && morningHistory.history.length > 0 ? (
                  <div className="space-y-1">
                    {morningHistory.history.map((h, i) => (
                      <div
                        key={`m_${h.date}_${i}`}
                        className="text-[10.5px] flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-amber-100 text-slate-700"
                      >
                        <span>{h.dateLabel}</span>
                        {h.wasAssigned ? (
                          <span className="font-extrabold text-indigo-900">Quầy {h.counterNumber} ({h.slotLabel || h.shiftCode})</span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa xếp quầy</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">Chưa có lịch sử đứng quầy trước đó.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic py-1">Chưa phân nhân viên ca sáng.</p>
          )}
        </div>

        {/* Ca Chiều */}
        <div className="p-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-indigo-900 flex items-center gap-1">
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ca Chiều (Ô 2)</span>
            </span>
            {assignment?.afternoon?.shiftCode && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-900 border border-indigo-300">
                {assignment.afternoon.shiftCode}
              </span>
            )}
          </div>

          {assignment?.afternoon?.employeeName ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">{assignment.afternoon.employeeName}</span>
                {assignment.afternoon.employeeId && (
                  <span className="text-[10.5px] font-mono text-slate-500">{assignment.afternoon.employeeId}</span>
                )}
              </div>

              {/* Ca đã đổi? */}
              {afternoonHistory?.shiftToday.hasChanged && (
                <div className="mt-1 text-[10.5px] p-1.5 rounded-lg bg-indigo-100/80 border border-indigo-300 text-indigo-950 flex items-center gap-1.5 font-bold">
                  <span className="text-[9.5px] text-indigo-800">⚡ Đã đổi ca:</span>
                  <span className="line-through text-rose-700">{afternoonHistory.shiftToday.originalShiftCode}</span>
                  <ArrowRight className="w-3 h-3 text-indigo-600" />
                  <span className="text-emerald-800">{afternoonHistory.shiftToday.currentShiftCode}</span>
                </div>
              )}

              {/* Lịch sử 3 ngày qua */}
              <div className="mt-2 pt-1.5 border-t border-indigo-200/60">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3 text-indigo-600" />
                    <span>3 ngày qua (không tính ngày nghỉ):</span>
                  </span>
                </div>
                {afternoonHistory?.history && afternoonHistory.history.length > 0 ? (
                  <div className="space-y-1">
                    {afternoonHistory.history.map((h, i) => (
                      <div
                        key={`a_${h.date}_${i}`}
                        className="text-[10.5px] flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-indigo-100 text-slate-700"
                      >
                        <span>{h.dateLabel}</span>
                        {h.wasAssigned ? (
                          <span className="font-extrabold text-indigo-900">Quầy {h.counterNumber} ({h.slotLabel || h.shiftCode})</span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa xếp quầy</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">Chưa có lịch sử đứng quầy trước đó.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic py-1">Chưa phân nhân viên ca chiều.</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`cursor-help ${className}`}
      >
        {children}
      </div>
      {typeof document !== 'undefined' && cardContent && createPortal(cardContent, document.body)}
    </>
  );
};
