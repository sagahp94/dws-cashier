import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Calendar,
  User,
  ArrowRight,
  Check,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Info,
} from 'lucide-react';
import { Shift, WeeklyScheduleEntry } from '../../types';
import { storageService } from '../../services/storageService';
import { isOffShift } from '../../services/excelService';
import { parseYMDToLocalDate, formatDateToYMD } from '../../utils/dateUtils';

interface EditWeeklyShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: WeeklyScheduleEntry | null;
  shifts: Shift[];
  weekId: string;
  weeklySchedule?: WeeklyScheduleEntry[];
  onSaved: (updatedEntry: WeeklyScheduleEntry) => void;
}

export function isLateClosingShiftCode(code: string): boolean {
  const c = (code || '').trim().toUpperCase();
  return (
    c === 'V829' ||
    c === 'V830' ||
    c.startsWith('V829') ||
    c.startsWith('V830') ||
    c === '829' ||
    c === '830'
  );
}

export function isEarlyMorningShiftCode(code: string): boolean {
  const c = (code || '').trim().toUpperCase();
  return (
    c === 'V815' ||
    c === 'V814' ||
    c.startsWith('V815') ||
    c.startsWith('V814') ||
    c === '815' ||
    c === '814'
  );
}

export const EditWeeklyShiftModal: React.FC<EditWeeklyShiftModalProps> = ({
  isOpen,
  onClose,
  entry,
  shifts,
  weekId,
  weeklySchedule = [],
  onSaved,
}) => {
  const [newShiftCode, setNewShiftCode] = useState('');
  const [note, setNote] = useState('');
  const [isHardRosterSynced, setIsHardRosterSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTurnaroundConfirm, setShowTurnaroundConfirm] = useState(false);

  useEffect(() => {
    if (entry) {
      setNewShiftCode(entry.shiftCode || '');
      setNote(entry.modificationNote || '');
      setIsHardRosterSynced(!!entry.isHardRosterSynced);
      setError(null);
      setShowTurnaroundConfirm(false);
    }
  }, [entry, isOpen]);

  // Compute previous day's shift for this employee
  const prevDateInfo = useMemo(() => {
    if (!entry || !entry.date) return { prevDateStr: '', prevShiftCode: '' };

    try {
      const dt = parseYMDToLocalDate(entry.date);
      dt.setDate(dt.getDate() - 1);
      const prevDateStr = formatDateToYMD(dt);

      const cleanName = (entry.employeeName || '').trim().toLowerCase();
      const cleanId = (entry.employeeId || '').trim().toLowerCase();

      // Search in current weekly schedule first
      let found = weeklySchedule.find((e) => {
        if (e.date !== prevDateStr) return false;
        const eName = (e.employeeName || '').trim().toLowerCase();
        const eId = (e.employeeId || '').trim().toLowerCase();
        return (cleanId && eId && cleanId === eId) || (cleanName && eName === cleanName);
      });

      // If not found in current weekly schedule, search in all stored schedules
      if (!found) {
        const all = storageService.getAllWeeklySchedules();
        for (const entries of Object.values(all)) {
          if (!Array.isArray(entries)) continue;
          const match = entries.find((e) => {
            if (e.date !== prevDateStr) return false;
            const eName = (e.employeeName || '').trim().toLowerCase();
            const eId = (e.employeeId || '').trim().toLowerCase();
            return (cleanId && eId && cleanId === eId) || (cleanName && eName === cleanName);
          });
          if (match) {
            found = match;
            break;
          }
        }
      }

      return {
        prevDateStr,
        prevShiftCode: (found?.shiftCode || '').trim().toUpperCase(),
      };
    } catch {
      return { prevDateStr: '', prevShiftCode: '' };
    }
  }, [entry, weeklySchedule]);

  if (!isOpen || !entry) return null;

  const currentShift = entry.shiftCode;
  const originalShift = entry.originalShiftCode || entry.shiftCode;
  const hasPreviouslyChanged = !!entry.originalShiftCode && entry.originalShiftCode !== entry.shiftCode;

  // Filter distinct shift codes from catalog
  const availableShifts = Array.from(new Set(shifts.map((s) => s.shiftCode.trim().toUpperCase()))).filter(Boolean);

  // Common quick picks
  const quickPicks = ['V814', 'V815', 'V818', 'V820', 'V822', 'V829', 'V830', 'OFF', 'AL'];

  // Check turnaround conflict: Prev Day is V829/V830 and Target is V815/V814
  const isPrevClosingLate = isLateClosingShiftCode(prevDateInfo.prevShiftCode);
  const isNewEarlyMorning = isEarlyMorningShiftCode(newShiftCode);
  const hasTurnaroundConflict = isPrevClosingLate && isNewEarlyMorning;

  const executeSave = () => {
    const trimmed = newShiftCode.trim().toUpperCase();
    if (!trimmed) {
      setError('Vui lòng chọn hoặc nhập mã ca làm việc mới');
      return;
    }

    try {
      const result = storageService.updateWeeklyScheduleShift({
        weekId: entry.weekId || weekId,
        date: entry.date,
        employeeName: entry.employeeName,
        employeeId: entry.employeeId,
        newShiftCode: trimmed,
        note: note.trim(),
        isHardRosterSynced,
      });

      if (result.success && result.entry) {
        onSaved(result.entry);
        onClose();
      } else {
        setError('Không thể cập nhật ca làm việc. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi lưu ca làm việc.');
    }
  };

  const handleSave = () => {
    const trimmed = newShiftCode.trim().toUpperCase();
    if (!trimmed) {
      setError('Vui lòng chọn hoặc nhập mã ca làm việc mới');
      return;
    }

    // If turnaround conflict: require explicit confirmation!
    if (hasTurnaroundConflict) {
      setShowTurnaroundConfirm(true);
      return;
    }

    executeSave();
  };

  const isOff = isOffShift(newShiftCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <Clock className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Điều chỉnh Ca làm việc</h3>
              <p className="text-xs text-teal-200/90 mt-0.5">
                Sửa trực tiếp ca nhân viên mà không cần tải lại file Excel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Employee & Date Info Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-teal-700" />
                <span className="font-extrabold text-slate-900 text-sm">{entry.employeeName}</span>
              </div>
              {entry.employeeId && (
                <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  {entry.employeeId}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Ngày: <strong className="text-slate-800">{entry.date}</strong> (Thứ {entry.dayOfWeek === 1 ? '2' : entry.dayOfWeek === 7 ? 'CN' : entry.dayOfWeek})</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Ca hiện tại:</span>
                <span className="font-mono font-black text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded border border-teal-200">
                  {entry.shiftCode}
                </span>
              </div>
            </div>

            {/* Previous day's shift info */}
            {prevDateInfo.prevDateStr && prevDateInfo.prevShiftCode && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/40">
                <span>Ca ngày trước đó ({prevDateInfo.prevDateStr}):</span>
                <span className={`font-mono font-bold px-1.5 py-0.2 rounded border ${
                  isPrevClosingLate
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {prevDateInfo.prevShiftCode}
                  {isPrevClosingLate ? ' (Đóng cửa muộn)' : ''}
                </span>
              </div>
            )}

            {hasPreviouslyChanged && (
              <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Ca ban đầu (file gốc): <strong className="underline">{originalShift}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Real-time Turnaround Warning Banner */}
          {hasTurnaroundConflict && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2 animate-fadeIn shadow-2xs">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>CẢNH BÁO NGHỈ GIỮA 2 CA (ĐÓNG CỬA ➔ SÁNG SỚM)</span>
              </div>
              <div className="text-[11.5px] text-slate-700 leading-relaxed space-y-1">
                <p>
                  • Ngày trước đó (<strong>{prevDateInfo.prevDateStr}</strong>): Làm ca{' '}
                  <span className="font-mono font-black text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                    {prevDateInfo.prevShiftCode}
                  </span>{' '}
                  (kết thúc lúc 22:00 - 22:30).
                </p>
                <p>
                  • Ngày này (<strong>{entry.date}</strong>): Bạn đang đổi sang ca{' '}
                  <span className="font-mono font-black text-rose-900 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-300">
                    {newShiftCode.trim().toUpperCase()}
                  </span>{' '}
                  (bắt đầu lúc 08:00 sáng).
                </p>
              </div>
              <div className="text-[11px] text-amber-950 font-bold bg-white/90 p-2 rounded-xl border border-amber-200/90 leading-tight">
                ⚠️ Khoảng cách nghỉ giữa 2 ca dưới 10 tiếng. Cần có sự đồng ý của nhân viên trước khi áp dụng thay đổi!
              </div>
            </div>
          )}

          {/* New Shift Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-800">
              Chọn hoặc nhập Mã ca mới <span className="text-rose-500">*</span>
            </label>

            {/* Quick Pick Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Gợi ý nhanh:</span>
              {quickPicks.map((code) => {
                const isSelected = newShiftCode === code;
                const isOffCode = isOffShift(code);
                const isTurnaroundPick = isPrevClosingLate && isEarlyMorningShiftCode(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setNewShiftCode(code)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer relative ${
                      isSelected
                        ? isOffCode
                          ? 'bg-rose-600 text-white shadow-xs'
                          : isTurnaroundPick
                          ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400'
                          : 'bg-teal-700 text-white shadow-xs'
                        : isOffCode
                        ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                        : isTurnaroundPick
                        ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {code}
                    {isTurnaroundPick && !isSelected && (
                      <span className="ml-1 text-[9px] text-amber-600 font-black">⚠️</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Input & Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Chọn từ danh mục ca ({availableShifts.length} ca):
                </label>
                <select
                  value={availableShifts.includes(newShiftCode) ? newShiftCode : ''}
                  onChange={(e) => {
                    if (e.target.value) setNewShiftCode(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
                >
                  <option value="">-- Chọn mã ca --</option>
                  {availableShifts.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Hoặc tự nhập mã ca:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: V815, V814, V820, OFF..."
                  value={newShiftCode}
                  onChange={(e) => setNewShiftCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
                />
              </div>
            </div>

            {isOff && (
              <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Lưu ý ca nghỉ:</strong> Bạn đang chọn ca nghỉ (
                  <span className="font-mono font-bold">{newShiftCode}</span>). Khi xếp quầy hoặc tính lịch sử, hệ thống sẽ tự động nhận diện đây là ngày nghỉ và không phân quầy.
                </div>
              </div>
            )}
          </div>

          {/* Reason / Note */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-800">
              Lý do điều chỉnh ca (Tùy chọn)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Đổi ca theo nguyện vọng nhân viên, Tăng cường ca sáng..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
            />
          </div>

          {/* Preview Shift Change */}
          {newShiftCode && newShiftCode !== currentShift && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-emerald-950">Xác nhận thay đổi:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 line-through bg-white px-2 py-0.5 rounded border border-slate-200">
                  {currentShift}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                <span className={`font-mono font-black px-2 py-0.5 rounded border ${
                  hasTurnaroundConflict
                    ? 'text-amber-900 bg-amber-100 border-amber-300'
                    : 'text-emerald-900 bg-emerald-100 border-emerald-300'
                }`}>
                  {newShiftCode}
                </span>
              </div>
            </div>
          )}

          {/* Sync Hard Roster & Notify Employee checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-teal-50/40 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isHardRosterSynced}
              onChange={(e) => setIsHardRosterSynced(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-teal-700 focus:ring-teal-600 cursor-pointer accent-teal-700"
            />
            <div className="text-xs">
              <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                Đã sync file lịch cứng & thông báo cho nhân viên
                {isHardRosterSynced && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-850 border border-emerald-300">
                    ✓ Đã hoàn tất
                  </span>
                )}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Đánh dấu để xác nhận ca làm việc này đã được sửa trên file Excel lịch cứng và đã thông báo tới nhân viên
              </p>
            </div>
          </label>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-800 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-all"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`px-5 py-2 text-xs font-extrabold text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all ${
              hasTurnaroundConflict
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-teal-800 hover:bg-teal-900'
            }`}
          >
            {hasTurnaroundConflict ? (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-200" />
                <span>Xác nhận & Lưu ca</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Lưu ca làm việc</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Turnaround Conflict Confirmation Dialog */}
      {showTurnaroundConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-200 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900">
                Xác nhận đổi ca đóng cửa ➔ ca sáng sớm
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nhân viên <strong className="text-slate-900">{entry.employeeName}</strong> có ca làm việc ngày liền kề trước đó kết thúc muộn:
              </p>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs space-y-2.5 text-slate-700">
              <div className="flex items-center justify-between bg-white/70 p-2 rounded-xl border border-amber-200/50">
                <span className="text-slate-500">Ngày hôm trước ({prevDateInfo.prevDateStr}):</span>
                <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  {prevDateInfo.prevShiftCode} (22:00 - 22:30)
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/70 p-2 rounded-xl border border-amber-200/50">
                <span className="text-slate-500">Ngày hôm nay ({entry.date}):</span>
                <span className="font-mono font-black text-rose-900 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                  {newShiftCode.trim().toUpperCase()} (08:00)
                </span>
              </div>
              <div className="pt-2 border-t border-amber-200 text-[11.5px] text-amber-950 leading-relaxed font-medium">
                ⚠️ Thời gian nghỉ ngơi giữa 2 ca này <strong>dưới 10 tiếng</strong> (không đảm bảo thời gian nghỉ hồi phục khuyến nghị). Bạn có chắc chắn nhân viên <strong>đã đồng ý</strong> đổi ca không?
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTurnaroundConfirm(false)}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Hủy bỏ / Xem lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTurnaroundConfirm(false);
                  executeSave();
                }}
                className="flex-1 py-2.5 px-4 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Tôi đồng ý & Đổi ca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
