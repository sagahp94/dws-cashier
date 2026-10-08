import React, { useState } from 'react';
import { ShiftChangeConflict } from '../../services/shiftChangeService';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Store,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Zap,
  X,
} from 'lucide-react';

interface ShiftChangeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ShiftChangeConflict[];
  onConfirm: (decisions: Record<string, 'remove' | 'keep'>) => void;
}

export const ShiftChangeConfirmModal: React.FC<ShiftChangeConfirmModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  onConfirm,
}) => {
  if (!isOpen || !conflicts || conflicts.length === 0) return null;

  // Track decision for each conflict: 'remove' (CÓ) or 'keep' (KHÔNG). Default to 'remove'
  const [decisions, setDecisions] = useState<Record<string, 'remove' | 'keep'>>(() => {
    const initial: Record<string, 'remove' | 'keep'> = {};
    conflicts.forEach((c) => {
      initial[c.id] = 'remove';
    });
    return initial;
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  const activeConflict = conflicts[currentIndex] || conflicts[0];

  const handleDecision = (id: string, decision: 'remove' | 'keep') => {
    setDecisions((prev) => ({
      ...prev,
      [id]: decision,
    }));
    // Auto advance if there are more
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleSetAll = (decision: 'remove' | 'keep') => {
    const next: Record<string, 'remove' | 'keep'> = {};
    conflicts.forEach((c) => {
      next[c.id] = decision;
    });
    setDecisions(next);
  };

  const handleQuickConfirmAllRemove = () => {
    const next: Record<string, 'remove' | 'keep'> = {};
    conflicts.forEach((c) => {
      next[c.id] = 'remove';
    });
    onConfirm(next);
  };

  const handleFinish = () => {
    onConfirm(decisions);
  };

  const removeCount = Object.values(decisions).filter((d) => d === 'remove').length;
  const keepCount = Object.values(decisions).filter((d) => d === 'keep').length;

  return (
    <div
      id="shift-change-confirm-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="shift-change-confirm-modal-card"
        className="w-full max-w-2xl bg-[#e6e9ef] rounded-3xl p-4 sm:p-6 shadow-[12px_12px_24px_#c5c8cf,-12px_-12px_24px_#ffffff] border border-white/60 flex flex-col max-h-[90vh] sm:max-h-[85vh]"
      >
        {/* Header - Fixed */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-300/60 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shadow-[inset_2px_2px_4px_#c5c8cf,inset_-2px_-2px_4px_#ffffff] shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  Cập Nhật Phân Quầy Cho Nhân Viên Đổi Ca
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Phát hiện {conflicts.length} nhân sự đã xếp quầy bị đổi ca (Sáng ⇄ Chiều) trong file mới
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-amber-100/90 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-xl border border-amber-300">
              {currentIndex + 1} / {conflicts.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
          {/* Quick Action One-Click Bar */}
          <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs text-teal-900 font-semibold">
              <Zap className="w-4 h-4 text-teal-700 shrink-0" />
              <span>Xử lý nhanh: Xóa phân quầy cũ & chuyển về DS chờ để xếp lại</span>
            </div>
            <button
              type="button"
              onClick={handleQuickConfirmAllRemove}
              className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đồng ý tất cả ({conflicts.length}) & Tiếp tục</span>
            </button>
          </div>

          {/* Prompt Notification Box */}
          <div
            id="shift-change-primary-prompt-box"
            className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-amber-100/60 border-2 border-amber-400/80 shadow-[inset_3px_3px_6px_rgba(217,119,6,0.1),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm font-black text-slate-900 leading-relaxed">
                Nhân viên{' '}
                <span className="text-teal-800 font-extrabold underline decoration-teal-600 decoration-2">
                  {activeConflict.employeeName}
                </span>{' '}
                đã bị thay đổi ca làm việc từ{' '}
                <span className="inline-block font-mono font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 text-xs">
                  {activeConflict.oldShiftCode}
                </span>{' '}
                thành ca{' '}
                <span className="inline-block font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs">
                  {activeConflict.newShiftCode}
                </span>
                . Xóa phân quầy? -&gt; chọn{' '}
                <span className="inline-block font-black text-emerald-800 bg-emerald-200/80 px-1.5 py-0.5 rounded border border-emerald-400">
                  "CÓ"
                </span>{' '}
                để xóa khỏi quầy hiện tại và đưa vào danh sách chưa phân quầy
              </div>
            </div>

            {/* Conflict Meta Info Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-200/70 text-[11px] text-slate-700">
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-lg border border-amber-200/50">
                <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold truncate">{activeConflict.dayName}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-lg border border-amber-200/50">
                <Store className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold truncate">
                  Quầy {activeConflict.counterNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-lg border border-amber-200/50">
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold truncate">
                  {activeConflict.assignedSlot.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-lg border border-amber-200/50">
                <ArrowRight className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-bold text-teal-800 truncate">
                  {activeConflict.changeType === 'afternoon_to_morning'
                    ? 'Chiều ➔ Sáng'
                    : 'Sáng ➔ Chiều'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Choice for current employee */}
          <div className="p-3.5 rounded-2xl bg-[#e6e9ef] shadow-[inset_3px_3px_6px_#c5c8cf,inset_-3px_-3px_6px_#ffffff] border border-white/50 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Lựa chọn cho nhân viên: <strong className="text-slate-900">{activeConflict.employeeName}</strong>
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Trạng thái:{' '}
                {decisions[activeConflict.id] === 'remove' ? (
                  <span className="text-emerald-700 font-bold">Đồng ý xóa phân quầy</span>
                ) : (
                  <span className="text-slate-700 font-bold">Giữ lại quầy</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option YES (Remove) */}
              <button
                type="button"
                id="btn-shift-conflict-yes"
                onClick={() => handleDecision(activeConflict.id, 'remove')}
                className={`p-3 rounded-2xl flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                  decisions[activeConflict.id] === 'remove'
                    ? 'bg-emerald-600 text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] font-bold'
                    : 'bg-[#e6e9ef] text-slate-700 shadow-[4px_4px_8px_#c5c8cf,-4px_-4px_8px_#ffffff] hover:bg-emerald-50 hover:text-emerald-800 font-medium'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 ${
                    decisions[activeConflict.id] === 'remove'
                      ? 'bg-white text-emerald-700'
                      : 'border-2 border-slate-400 text-transparent'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black">
                    CÓ (Xóa khỏi quầy &amp; đưa vào DS chưa phân quầy)
                  </div>
                </div>
              </button>

              {/* Option NO (Keep) */}
              <button
                type="button"
                id="btn-shift-conflict-no"
                onClick={() => handleDecision(activeConflict.id, 'keep')}
                className={`p-3 rounded-2xl flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                  decisions[activeConflict.id] === 'keep'
                    ? 'bg-slate-700 text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] font-bold'
                    : 'bg-[#e6e9ef] text-slate-700 shadow-[4px_4px_8px_#c5c8cf,-4px_-4px_8px_#ffffff] hover:bg-slate-200/80 font-medium'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 ${
                    decisions[activeConflict.id] === 'keep'
                      ? 'bg-white text-slate-800'
                      : 'border-2 border-slate-400 text-transparent'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black">
                    KHÔNG (Giữ lại quầy hiện tại)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Navigation between conflicts & Quick All actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 inline" />
                </button>
                <span className="font-bold text-slate-700 px-1">
                  {currentIndex + 1} / {conflicts.length}
                </span>
                <button
                  type="button"
                  disabled={currentIndex === conflicts.length - 1}
                  onClick={() =>
                    setCurrentIndex((prev) => Math.min(conflicts.length - 1, prev + 1))
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 inline" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetAll('remove')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold border border-emerald-300 transition-colors cursor-pointer text-[11px]"
                >
                  Chọn "CÓ" tất cả ({conflicts.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAll('keep')}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold border border-slate-300 transition-colors cursor-pointer text-[11px]"
                >
                  Chọn "KHÔNG" tất cả
                </button>
              </div>
            </div>

            {/* List preview of all conflicts */}
            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-300/80 bg-white/50 divide-y divide-slate-200 text-xs">
              {conflicts.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                    idx === currentIndex
                      ? 'bg-amber-100/60 font-bold'
                      : 'hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 text-center text-slate-400 font-mono text-[11px] shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="font-semibold text-slate-900 truncate">{c.employeeName}</span>
                    <span className="text-slate-500 font-normal truncate">
                      ({c.dayName} - Quầy {c.counterNumber})
                    </span>
                    <span className="font-mono text-slate-600 font-bold shrink-0">
                      {c.oldShiftCode} ➔ {c.newShiftCode}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                      decisions[c.id] === 'remove'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-300 text-slate-800'
                    }`}
                  >
                    {decisions[c.id] === 'remove' ? 'CÓ (Xóa)' : 'KHÔNG (Giữ)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions - Fixed at Bottom, ALWAYS Visible */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-300/60 shrink-0 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Đóng &amp; Giữ nguyên
          </button>

          <button
            type="button"
            id="shift-conflict-confirm-submit-btn"
            onClick={handleFinish}
            className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-black text-white bg-teal-700 hover:bg-teal-800 active:scale-98 rounded-xl shadow-[4px_4px_8px_#c5c8cf,-4px_-4px_8px_#ffffff] transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Xác Nhận &amp; Tiếp Tục ({removeCount} Xóa quầy, {keepCount} Giữ quầy)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
