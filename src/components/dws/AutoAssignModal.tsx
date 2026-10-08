import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Sliders,
  Calendar,
  Layers,
  ShieldCheck,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  Counter,
  UnassignedEmployee,
  DayDwsAssignment,
  AutoAssignOptions,
  AssignmentRuleConfig,
  Employee,
} from '../../types';
import { storageService } from '../../services/storageService';

interface AutoAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  dayName: string;
  counters: Counter[];
  unassignedEmployees: UnassignedEmployee[];
  currentAssignment: DayDwsAssignment;
  onExecute: (options: AutoAssignOptions, rules: AssignmentRuleConfig) => void;
  onOpenRulesConfig: () => void;
}

export const AutoAssignModal: React.FC<AutoAssignModalProps> = ({
  isOpen,
  onClose,
  date,
  dayName,
  counters,
  unassignedEmployees,
  currentAssignment,
  onExecute,
  onOpenRulesConfig,
}) => {
  const [scope, setScope] = useState<'current_day' | 'full_week'>('current_day');
  const [mode, setMode] = useState<'fill_empty' | 'overwrite_all'>('fill_empty');
  const [applyFixedRules, setApplyFixedRules] = useState(true);
  const [applyAreaBalancing, setApplyAreaBalancing] = useState(true);
  const [applyCounterPriority, setApplyCounterPriority] = useState(true);

  // Load current assignment rules
  const rules = storageService.getAssignmentRules();
  const activeFixedRulesCount = rules.fixedRules.filter((r) => r.active).length;

  const morningPool = unassignedEmployees.filter(
    (e) => e.category === 'morning' || (e.category === 'other' && (!e.startTime || e.startTime < '12:30'))
  );
  const afternoonPool = unassignedEmployees.filter(
    (e) => e.category === 'afternoon' || (e.category === 'other' && e.startTime >= '12:30')
  );

  let emptyMorningCount = 0;
  let emptyAfternoonCount = 0;

  counters.forEach((c) => {
    const ca = currentAssignment.assignments?.[c.id];
    if (mode === 'overwrite_all') {
      emptyMorningCount++;
      emptyAfternoonCount++;
    } else {
      if (!ca?.morning) emptyMorningCount++;
      if (!ca?.afternoon) emptyAfternoonCount++;
    }
  });

  const morningCanAssign = Math.min(emptyMorningCount, morningPool.length);
  const afternoonCanAssign = Math.min(emptyAfternoonCount, afternoonPool.length);
  const totalWillAssign = morningCanAssign + afternoonCanAssign;

  const handleConfirm = () => {
    const options: AutoAssignOptions = {
      scope,
      mode,
      applyFixedRules,
      applyAreaBalancing,
      applyCounterPriority,
    };
    onExecute(options, rules);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
            <Sparkles className="w-5 h-5 text-teal-700" />
          </div>
          <span className="font-bold text-slate-900">Tự động phân quầy thông minh (Auto-Assign)</span>
        </div>
      }
      description={`Tự động ghép nhân viên theo ca làm việc, quy tắc cố định và thứ tự ưu tiên quầy.`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Scope Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Phạm vi phân bổ:</label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setScope('current_day')}
              className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                scope === 'current_day'
                  ? 'bg-teal-700 text-white border-transparent shadow-xs font-bold'
                  : 'glass-card text-slate-700 border-slate-200 hover:bg-white'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs">Chỉ ngày đang chọn</div>
                <div className={`text-[10px] font-normal truncate ${scope === 'current_day' ? 'text-teal-100' : 'text-slate-500'}`}>
                  {dayName} ({date})
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScope('full_week')}
              className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                scope === 'full_week'
                  ? 'bg-teal-700 text-white border-transparent shadow-xs font-bold'
                  : 'glass-card text-slate-700 border-slate-200 hover:bg-white'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs">Cả tuần làm việc</div>
                <div className={`text-[10px] font-normal truncate ${scope === 'full_week' ? 'text-teal-100' : 'text-slate-500'}`}>
                  Thứ 2 $\to$ Thứ 7
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Chế độ phân bổ:</label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMode('fill_empty')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                mode === 'fill_empty'
                  ? 'bg-slate-900 text-white font-bold shadow-xs border-transparent'
                  : 'glass-card border-slate-200 text-slate-700 hover:bg-white'
              }`}
            >
              <div className="text-xs">Chỉ lấp quầy còn trống</div>
              <div className={`text-[10px] mt-0.5 ${mode === 'fill_empty' ? 'text-slate-300' : 'text-slate-500'}`}>
                Giữ nguyên các vị trí đã phân
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('overwrite_all')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                mode === 'overwrite_all'
                  ? 'bg-rose-700 text-white font-bold shadow-xs border-transparent'
                  : 'glass-card border-slate-200 text-slate-700 hover:bg-white'
              }`}
            >
              <div className="text-xs">Phân lại toàn bộ (Ghi đè)</div>
              <div className={`text-[10px] mt-0.5 ${mode === 'overwrite_all' ? 'text-rose-200' : 'text-slate-500'}`}>
                Xóa cũ và xếp lại từ đầu
              </div>
            </button>
          </div>
        </div>

        {/* Breakdown for current day */}
        {scope === 'current_day' && (
          <div className="p-3.5 glass-panel rounded-2xl space-y-2 text-xs text-slate-700 shadow-xs">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 text-amber-900">
                <Sun className="w-4 h-4 text-amber-600" /> Ca Sáng:
              </span>
              <span>
                {morningPool.length} nhân viên $\to$ {emptyMorningCount} slot trống ({morningCanAssign} ghép thành công)
              </span>
            </div>

            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 text-indigo-900">
                <Moon className="w-4 h-4 text-indigo-600" /> Ca Chiều:
              </span>
              <span>
                {afternoonPool.length} nhân viên $\to$ {emptyAfternoonCount} slot trống ({afternoonCanAssign} ghép thành công)
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-black text-teal-800">
              <span>Dự kiến phân bổ thành công ngày {dayName}:</span>
              <span>{totalWillAssign} vị trí</span>
            </div>
          </div>
        )}

        {/* Rule Toggles & Settings Preview */}
        <div className="p-3.5 glass-panel rounded-2xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Quy tắc phân quầy áp dụng:</span>
            <button
              type="button"
              onClick={onOpenRulesConfig}
              className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              Chỉnh sửa Rule
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyFixedRules}
                onChange={(e) => setApplyFixedRules(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-700 rounded border-slate-300 focus:ring-teal-700"
              />
              <span>
                Áp dụng quy tắc nhân sự cố định (
                <strong className="text-teal-800">{activeFixedRulesCount} quy tắc</strong> đang bật)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyAreaBalancing}
                onChange={(e) => setApplyAreaBalancing(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-700 rounded border-slate-300 focus:ring-teal-700"
              />
              <span>Cân bằng nhân lực đều giữa các Khu vực (Thực phẩm, Tự chọn, SSC...)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyCounterPriority}
                onChange={(e) => setApplyCounterPriority(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-700 rounded border-slate-300 focus:ring-teal-700"
              />
              <span>Ưu tiên lấp đầy quầy theo thứ tự và quầy SSC trước</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="glass-button-secondary px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            id="btn-confirm-auto-assign"
            onClick={handleConfirm}
            className="glass-button-primary px-4 py-2 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-pink-200" />
            {scope === 'full_week' ? 'Phân bổ tự động cả tuần' : 'Phân bổ tự động ngày này'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
