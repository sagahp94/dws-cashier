import React from 'react';
import { ShiftChangeConflict } from '../../services/shiftChangeService';
import { AlertTriangle, UserPlus, ArrowRight, Store, Clock } from 'lucide-react';

interface ShiftChangeAlertBannerProps {
  conflicts: ShiftChangeConflict[];
  onOpenAssignForConflict: (conflict: ShiftChangeConflict) => void;
  onUnassignOnlyConflict?: (conflict: ShiftChangeConflict) => void;
  onDismissConflict?: (conflictId: string) => void;
}

export const ShiftChangeAlertBanner: React.FC<ShiftChangeAlertBannerProps> = ({
  conflicts,
  onOpenAssignForConflict,
  onUnassignOnlyConflict,
}) => {
  if (!conflicts || conflicts.length === 0) {
    return null;
  }

  return (
    <div
      id="shift-change-alert-banner-container"
      className="space-y-2.5 mb-4 animate-in fade-in duration-200"
    >
      {conflicts.map((conflict) => (
        <div
          key={conflict.id}
          className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-400/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-800"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                Nhân viên{' '}
                <span className="text-teal-800 font-extrabold underline decoration-teal-600 decoration-2">
                  {conflict.employeeName}
                </span>{' '}
                được phân vào quầy{' '}
                <span className="font-extrabold text-indigo-900">
                  {conflict.counterNumber}
                </span>{' '}
                đã bị đổi ca từ{' '}
                <span className="inline-block font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300 text-xs">
                  {conflict.oldShiftCode}
                </span>{' '}
                thành{' '}
                <span className="inline-block font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs">
                  {conflict.newShiftCode}
                </span>
                . Hiện tại quầy{' '}
                <span className="font-extrabold text-indigo-900">
                  {conflict.counterNumber}
                </span>{' '}
                đang thiếu ca{' '}
                <span className="inline-block font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300 text-xs">
                  {conflict.oldShiftCode}
                </span>
                .{' '}
                <span className="text-amber-900 font-extrabold">Bổ sung ngay?</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Store className="w-3 h-3 text-slate-400" />
                  Quầy {conflict.counterNumber} ({conflict.counterArea || 'Siêu thị'})
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Slot: {conflict.assignedSlot.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều'}
                </span>
                <span>•</span>
                <span className="text-slate-500 italic">
                  (Chọn &quot;Bổ sung ngay&quot; để mở danh sách chọn nhân viên thay thế, nhân viên bị đổi ca sẽ chuyển về chưa phân quầy)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            {onUnassignOnlyConflict && (
              <button
                type="button"
                onClick={() => onUnassignOnlyConflict(conflict)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white/95 hover:bg-white border border-slate-300 rounded-xl cursor-pointer transition-colors shadow-2xs"
                title="Gỡ nhân viên khỏi quầy và đưa về danh sách chưa phân quầy"
              >
                Gỡ khỏi quầy
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenAssignForConflict(conflict)}
              className="neu-button-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              title="Vào danh sách phân quầy để chọn nhân viên bổ sung vào quầy"
            >
              <UserPlus className="w-4 h-4" />
              <span>Bổ sung ngay</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
