import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Clock,
  Calendar,
  Phone,
  Store,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  History,
} from 'lucide-react';
import {
  getEmployee3DaysCounterHistory,
  Employee3DaysHistoryResult,
} from '../../services/employeeHistoryService';
import { Counter } from '../../types';

interface EmployeeHoverCardProps {
  employeeName: string;
  employeeId?: string;
  currentDate: string;
  currentShiftCodeFallback?: string;
  allCounters?: Counter[];
  children: React.ReactNode;
  className?: string;
}

export const EmployeeHoverCard: React.FC<EmployeeHoverCardProps> = ({
  employeeName,
  employeeId,
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
  const [data, setData] = useState<Employee3DaysHistoryResult | null>(null);

  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    hoverTimeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const cardWidth = 330;
      const cardHeight = 360;

      // Tính vị trí hiển thị tối ưu
      let left = rect.left + rect.width / 2 - cardWidth / 2;
      // Tránh tràn viền trái/phải màn hình
      if (left < 12) left = 12;
      if (left + cardWidth > window.innerWidth - 12) {
        left = window.innerWidth - cardWidth - 12;
      }

      // Kiểm tra đặt phía trên hay phía dưới
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < cardHeight && rect.top > cardHeight;
      const top = placeAbove ? rect.top - 8 : rect.bottom + 8;

      setCoords({ top, left, placeAbove });
      const result = getEmployee3DaysCounterHistory(
        employeeName,
        employeeId,
        currentDate,
        allCounters
      );
      setData(result);
      setIsOpen(true);
    }, 180);
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

  const cardContent = isOpen && data && (
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
        width: '330px',
        zIndex: 99999,
      }}
      className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden text-slate-800 text-xs animate-fadeIn font-sans"
    >
      {/* Header Profile */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-teal-100 font-black text-sm shrink-0 border border-white/20 shadow-inner">
              {data.employeeName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-extrabold text-sm text-white truncate">{data.employeeName}</h4>
                {data.profile.isSup && (
                  <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-purple-400 text-purple-950 border border-purple-300 shadow-xs">
                    SUP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10.5px] text-teal-200/90 font-mono mt-0.5">
                {data.employeeId && (
                  <span>Mã NV: <strong className="text-white">{data.employeeId}</strong></span>
                )}
                {data.profile.department && data.profile.department !== 'Thu ngân' && (
                  <span>Bộ phận: {data.profile.department}</span>
                )}
                {data.profile.phone && (
                  <span className="flex items-center gap-0.5">
                    <Phone className="w-2.5 h-2.5" />
                    {data.profile.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quầy có thể đứng - chỉ hiển thị khi có kỹ năng đặc thù */}
        {(data.profile.isSup || data.profile.canBanhMy || data.profile.canDelica) && (
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] flex-wrap">
            <span className="text-teal-200/80">Khu vực:</span>
            {data.profile.isSup && (
              <span className="px-1.5 py-0.2 rounded font-bold bg-purple-500/30 text-purple-200 border border-purple-400/40">
                SUP / Toàn bộ
              </span>
            )}
            {data.profile.canBanhMy && (
              <span className="px-1.5 py-0.2 rounded font-bold bg-amber-500/30 text-amber-200 border border-amber-400/40">
                Bánh mỳ
              </span>
            )}
            {data.profile.canDelica && (
              <span className="px-1.5 py-0.2 rounded font-bold bg-orange-500/30 text-orange-200 border border-orange-400/40">
                Delica
              </span>
            )}
          </div>
        )}
      </div>

      {/* Thông tin Ca làm việc ngày hôm nay */}
      <div className="p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-teal-700" />
            <span>Ca làm việc ngày:</span>
          </span>
          {data.shiftToday.hasChanged ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
              <Sparkles className="w-3 h-3 text-amber-600" />
              ĐÃ ĐIỀU CHỈNH CA
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">Nguyên bản file tuần</span>
          )}
        </div>

        {data.shiftToday.hasChanged ? (
          <div className="mt-1.5 p-2 rounded-xl bg-amber-50/90 border border-amber-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold">
              <div className="flex items-center gap-1 text-slate-600">
                <span className="text-[11px] font-semibold text-slate-500">Ca cũ:</span>
                <span className="line-through px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                  {data.shiftToday.originalShiftCode || 'Chưa có'}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-teal-900">Ca mới:</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-black">
                  {data.shiftToday.currentShiftCode}
                </span>
              </div>
            </div>
            {data.shiftToday.modificationNote && (
              <p className="text-[10.5px] text-amber-900 italic">
                Lý do: &ldquo;{data.shiftToday.modificationNote}&rdquo;
              </p>
            )}
            {data.shiftToday.modifiedAt && (
              <div className="text-[10px] text-slate-400 pt-0.5 border-t border-amber-100 flex items-center justify-between">
                <span>
                  Sửa: {new Date(data.shiftToday.modifiedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })},{' '}
                  {new Date(data.shiftToday.modifiedAt).toLocaleDateString('vi-VN')}
                </span>
                {data.shiftToday.isHardRosterSynced ? (
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                    ✓ Đã sync lịch cứng
                  </span>
                ) : (
                  <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                    Chưa sync lịch cứng
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between">
            <span className="font-bold text-slate-900 text-xs">
              Mã ca: <span className="font-mono text-teal-800 font-black bg-teal-100/60 px-1.5 py-0.5 rounded border border-teal-200">{data.shiftToday.currentShiftCode}</span>
            </span>
            <span className="text-[10.5px] text-slate-500">
              {data.currentDate}
            </span>
          </div>
        )}
      </div>

      {/* Lịch sử đứng quầy 3 ngày qua (không tính ngày có ca nghỉ) */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-extrabold text-[11px] text-slate-900">
              Lịch sử đứng quầy 3 ngày qua
            </span>
          </div>
          <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
            Không tính ca nghỉ
          </span>
        </div>

        {data.history.length === 0 ? (
          <div className="py-3 px-2 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <p className="text-xs font-semibold text-slate-600">Chưa có lịch sử đứng quầy</p>
            <p className="text-[10px] text-slate-400">Không tìm thấy phân quầy của 3 ngày làm việc trước đó.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.history.map((h, idx) => (
              <div
                key={`${h.date}_${idx}`}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{h.dateLabel}</span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <span className="font-mono font-semibold text-slate-700 bg-white px-1 py-0.2 rounded border border-slate-200 text-[9.5px]">
                      {h.shiftCode}
                    </span>
                    {h.slotLabel && <span>• {h.slotLabel}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {h.wasAssigned ? (
                    <div>
                      <div className="font-black text-indigo-950 text-xs bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg inline-block">
                        Quầy {h.counterNumber}
                      </div>
                      {h.counterArea && (
                        <div className="text-[9.5px] font-medium text-slate-500 mt-0.5">
                          {h.counterArea}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      Chưa xếp quầy
                    </span>
                  )}
                </div>
              </div>
            ))}

            {data.skippedOffDaysCount > 0 && (
              <p className="text-[10px] text-slate-400 italic pt-1">
                * Đã tự động bỏ qua {data.skippedOffDaysCount} ngày có ca nghỉ (OFF, AL, RO...)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center cursor-help ${className}`}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && cardContent && createPortal(cardContent, document.body)}
    </>
  );
};
