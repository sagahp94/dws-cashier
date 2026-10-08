import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  AssignmentRuleConfig,
  FixedCounterRule,
  ShiftCounterPriorityRule,
  Counter,
  Employee,
  Shift,
} from '../../types';
import {
  storageService,
  DEFAULT_ASSIGNMENT_RULES,
  DEFAULT_SHIFT_COUNTER_RULES,
} from '../../services/storageService';
import {
  Sliders,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Layers,
  ArrowUpDown,
  UserCheck,
  Info,
  ToggleLeft,
  ToggleRight,
  Sun,
  Moon,
  Store,
  Calendar,
  Clock,
  Edit2,
  X,
} from 'lucide-react';
import { useToast } from '../common/ToastContainer';

interface AssignmentRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  counters: Counter[];
  employees: Employee[];
  shifts?: Shift[];
  onRulesUpdated?: (rules: AssignmentRuleConfig) => void;
}

export const AssignmentRulesModal: React.FC<AssignmentRulesModalProps> = ({
  isOpen,
  onClose,
  counters,
  employees,
  shifts = [],
  onRulesUpdated,
}) => {
  const { success, warning } = useToast();
  const [activeTab, setActiveTab] = useState<'shift_rules' | 'fixed_rules' | 'strategy' | 'counter_priority'>('shift_rules');

  const [rules, setRules] = useState<AssignmentRuleConfig>(() => storageService.getAssignmentRules());

  // Form states for Shift Rules
  const [newShiftCodes, setNewShiftCodes] = useState('V815');
  const [newShiftDayType, setNewShiftDayType] = useState<'weekday' | 'weekend' | 'all'>('weekday');
  const [newShiftCounters, setNewShiftCounters] = useState('21, 23, SSC, 104, 106, 110, 114, 111');
  const [newShiftNotes, setNewShiftNotes] = useState('');

  // Form states for Fixed Rules
  const [newRuleEmp, setNewRuleEmp] = useState('');
  const [newRuleCounter, setNewRuleCounter] = useState(counters[0]?.id || '1');
  const [newRuleSlot, setNewRuleSlot] = useState<'both' | 'morning' | 'afternoon'>('both');
  const [newRuleDay, setNewRuleDay] = useState<number>(0); // 0 = all days
  const [newRuleNotes, setNewRuleNotes] = useState('');

  const shiftRulesList = rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES;

  // Reload rules when modal opens
  useEffect(() => {
    if (isOpen) {
      const current = storageService.getAssignmentRules();
      setRules(current);
      if (counters.length > 0 && !newRuleCounter) {
        setNewRuleCounter(counters[0].id);
      }
    }
  }, [isOpen, counters]);

  const handleSaveAll = (updated: AssignmentRuleConfig) => {
    setRules(updated);
    storageService.saveAssignmentRules(updated);
    onRulesUpdated?.(updated);
  };

  // --- SHIFT COUNTER PRIORITY RULES HANDLERS ---
  const handleToggleShiftRule = (id: string) => {
    const shiftRules = rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES;
    const updated: AssignmentRuleConfig = {
      ...rules,
      shiftCounterRules: shiftRules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    };
    handleSaveAll(updated);
  };

  const handleDeleteShiftRule = (id: string) => {
    const shiftRules = rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES;
    const updated: AssignmentRuleConfig = {
      ...rules,
      shiftCounterRules: shiftRules.filter((r) => r.id !== id),
    };
    handleSaveAll(updated);
    success('Đã xóa quy tắc ưu tiên ca.');
  };

  const handleAddShiftRule = (e: React.FormEvent) => {
    e.preventDefault();
    const codes = newShiftCodes
      .split(/[,;\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (codes.length === 0) {
      warning('Vui lòng nhập ít nhất một mã ca (ví dụ: V815, V818).');
      return;
    }

    const priorityCounters = newShiftCounters
      .split(/[,;]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    if (priorityCounters.length === 0) {
      warning('Vui lòng nhập danh sách quầy ưu tiên (ví dụ: 21, 23, SSC, 104).');
      return;
    }

    const newRule: ShiftCounterPriorityRule = {
      id: `shift_rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shiftCodes: codes,
      dayType: newShiftDayType,
      priorityCounters,
      notes: newShiftNotes.trim() || undefined,
      active: true,
    };

    const currentShiftRules = rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES;
    const updated: AssignmentRuleConfig = {
      ...rules,
      shiftCounterRules: [newRule, ...currentShiftRules],
    };

    handleSaveAll(updated);
    setNewShiftNotes('');
    success(`Đã thêm quy tắc ưu tiên cho ca ${codes.join(', ')}.`);
  };

  const handleResetShiftRulesPreset = () => {
    const updated: AssignmentRuleConfig = {
      ...rules,
      shiftCounterRules: DEFAULT_SHIFT_COUNTER_RULES,
    };
    handleSaveAll(updated);
    success('Đã khôi phục 3 quy tắc quầy ưu tiên ca sáng (V815, V818, V820).');
  };

  const handleAddCounterToRule = (ruleId: string, counterName: string) => {
    const currentShiftRules = rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES;
    const updated: AssignmentRuleConfig = {
      ...rules,
      shiftCounterRules: currentShiftRules.map((r) => {
        if (r.id !== ruleId) return r;
        if (r.priorityCounters.includes(counterName)) return r;
        return { ...r, priorityCounters: [...r.priorityCounters, counterName] };
      }),
    };
    handleSaveAll(updated);
  };

  const handleRemoveCounterFromRule = (ruleId: string, counterIndex: number) => {
    const currentShiftRules = rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES;
    const updated: AssignmentRuleConfig = {
      ...rules,
      shiftCounterRules: currentShiftRules.map((r) => {
        if (r.id !== ruleId) return r;
        const newCounters = [...r.priorityCounters];
        newCounters.splice(counterIndex, 1);
        return { ...r, priorityCounters: newCounters };
      }),
    };
    handleSaveAll(updated);
  };

  // --- FIXED RULES HANDLERS ---
  const handleToggleFixedRule = (id: string) => {
    const updated: AssignmentRuleConfig = {
      ...rules,
      fixedRules: rules.fixedRules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    };
    handleSaveAll(updated);
  };

  const handleDeleteFixedRule = (id: string) => {
    const updated: AssignmentRuleConfig = {
      ...rules,
      fixedRules: rules.fixedRules.filter((r) => r.id !== id),
    };
    handleSaveAll(updated);
    success('Đã xóa quy tắc gán cố định.');
  };

  const handleAddFixedRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleEmp.trim()) {
      warning('Vui lòng chọn hoặc nhập tên nhân viên.');
      return;
    }

    const matchedEmployee = employees.find(
      (emp) =>
        emp.fullName.toLowerCase().trim() === newRuleEmp.toLowerCase().trim() ||
        emp.id.toLowerCase() === newRuleEmp.toLowerCase().trim()
    );

    const newRule: FixedCounterRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      employeeName: matchedEmployee ? matchedEmployee.fullName : newRuleEmp.trim(),
      employeeId: matchedEmployee ? matchedEmployee.id : undefined,
      counterId: newRuleCounter,
      slot: newRuleSlot,
      dayOfWeek: newRuleDay,
      active: true,
      notes: newRuleNotes.trim() || undefined,
    };

    const updated: AssignmentRuleConfig = {
      ...rules,
      fixedRules: [newRule, ...rules.fixedRules],
    };

    handleSaveAll(updated);
    setNewRuleEmp('');
    setNewRuleNotes('');
    success(`Đã thêm quy tắc gán cố định cho "${newRule.employeeName}".`);
  };

  const handleToggleOption = (
    key: keyof Omit<AssignmentRuleConfig, 'fixedRules' | 'counterPriorityOrder' | 'shiftCounterRules'>
  ) => {
    const updated: AssignmentRuleConfig = {
      ...rules,
      [key]: !rules[key],
    };
    handleSaveAll(updated);
  };

  const handleResetDefaults = () => {
    handleSaveAll({
      ...DEFAULT_ASSIGNMENT_RULES,
      fixedRules: rules.fixedRules,
      shiftCounterRules: rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES,
    });
    success('Đã khôi phục các tùy chọn thuật toán về mặc định.');
  };

  const getDayName = (dayOfWeek?: number) => {
    switch (dayOfWeek) {
      case 1:
        return 'Thứ 2';
      case 2:
        return 'Thứ 3';
      case 3:
        return 'Thứ 4';
      case 4:
        return 'Thứ 5';
      case 5:
        return 'Thứ 6';
      case 6:
        return 'Thứ 7';
      case 7:
        return 'Chủ Nhật';
      default:
        return 'Cả tuần';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-teal-700" />
          <span>Cấu hình Rule Phân Quầy</span>
        </div>
      }
      description="Tùy chỉnh quầy ưu tiên theo ca (V815, V818, V820, V822), gán nhân sự cố định và chiến lược xếp quầy."
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('shift_rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'shift_rules'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Quầy ưu tiên theo Ca ({shiftRulesList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fixed_rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'fixed_rules'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Quầy cố định ({rules.fixedRules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('strategy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'strategy'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Chiến lược phân bổ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('counter_priority')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'counter_priority'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>Thứ tự mở quầy ({counters.length})</span>
          </button>
        </div>

        {/* TAB 1: SHIFT-SPECIFIC COUNTER PRIORITY RULES */}
        {activeTab === 'shift_rules' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong>Quy tắc ưu tiên theo Ca:</strong> Khi bấm "Tự động phân", hệ thống sẽ ghép nhân viên ca tương ứng vào các quầy ưu tiên được liệt kê trước theo thứ tự từ trái sang phải.
              </div>
              <button
                type="button"
                onClick={handleResetShiftRulesPreset}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục 6 Rule chuẩn
              </button>
            </div>

            {/* Add Shift Rule Form */}
            <form
              onSubmit={handleAddShiftRule}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
            >
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-700" />
                <span>Thêm quy tắc quầy ưu tiên cho ca làm việc</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Shift code */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Mã ca (VD: V815 hoặc V820, V822):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: V815, V818, V820..."
                    value={newShiftCodes}
                    onChange={(e) => setNewShiftCodes(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono uppercase focus:outline-hidden focus:border-teal-700"
                  />
                </div>

                {/* Day type */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Thời gian áp dụng:
                  </label>
                  <select
                    value={newShiftDayType}
                    onChange={(e) => setNewShiftDayType(e.target.value as any)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                  >
                    <option value="weekday">Ngày thường (Thứ 2 - Thứ 6)</option>
                    <option value="weekend">Cuối tuần (Thứ 7, Chủ Nhật)</option>
                    <option value="all">Tất cả các ngày trong tuần</option>
                  </select>
                </div>

                {/* Priority counters */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Quầy ưu tiên (phân cách bằng dấu phẩy):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 21, 23, SSC, 104, 106..."
                    value={newShiftCounters}
                    onChange={(e) => setNewShiftCounters(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <input
                  type="text"
                  placeholder="Ghi chú chi tiết quy tắc..."
                  value={newShiftNotes}
                  onChange={(e) => setNewShiftNotes(e.target.value)}
                  className="flex-1 text-xs p-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                />

                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm Rule Ca
                </button>
              </div>
            </form>

            {/* List of Shift Rules */}
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {shiftRulesList.map((rule) => {
                return (
                  <div
                    key={rule.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      rule.active
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleShiftRule(rule.id)}
                          className="text-slate-400 hover:text-teal-700 cursor-pointer shrink-0 mt-0.5"
                          title={rule.active ? 'Tắt quy tắc' : 'Bật quy tắc'}
                        >
                          {rule.active ? (
                            <ToggleRight className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-300" />
                          )}
                        </button>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {rule.shiftCodes.map((code) => (
                              <span
                                key={code}
                                className="px-2 py-0.5 rounded text-xs font-bold bg-teal-700 text-white font-mono"
                              >
                                {code}
                              </span>
                            ))}

                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                rule.dayType === 'weekday'
                                  ? 'bg-blue-100 text-blue-800'
                                  : rule.dayType === 'weekend'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {rule.dayType === 'weekday'
                                ? 'Ngày thường (T2 - T6)'
                                : rule.dayType === 'weekend'
                                ? 'Cuối tuần (T7, CN)'
                                : 'Tất cả các ngày'}
                            </span>
                          </div>

                          {/* Priority Counters list */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500 mr-1">
                              Quầy ưu tiên:
                            </span>
                            {rule.priorityCounters.map((cnt, idx) => (
                              <span
                                key={`${cnt}_${idx}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800"
                              >
                                {cnt}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCounterFromRule(rule.id, idx)}
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title={`Xóa quầy ${cnt}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            ))}
                          </div>

                          {rule.notes && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">{rule.notes}</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteShiftRule(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Xóa quy tắc này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: FIXED RULES (NHÂN VIÊN CỐ ĐỊNH) */}
        {activeTab === 'fixed_rules' && (
          <div className="space-y-4">
            {/* Add Rule Form */}
            <form
              onSubmit={handleAddFixedRule}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
            >
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-700" />
                <span>Thêm quy tắc gán nhân viên vào quầy cố định</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Employee select / input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nhân viên áp dụng:
                  </label>
                  {employees.length > 0 ? (
                    <select
                      value={newRuleEmp}
                      onChange={(e) => setNewRuleEmp(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                    >
                      <option value="">-- Chọn nhân viên --</option>
                      {employees.map((emp, idx) => (
                        <option key={`modal_emp_${emp.id || ''}_${emp.fullName}_${idx}`} value={emp.fullName}>
                          {emp.fullName} ({emp.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nhập tên nhân viên..."
                      value={newRuleEmp}
                      onChange={(e) => setNewRuleEmp(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                    />
                  )}
                </div>

                {/* Counter select */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Quầy chỉ định:
                  </label>
                  <select
                    value={newRuleCounter}
                    onChange={(e) => setNewRuleCounter(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                  >
                    {counters.map((c, idx) => (
                      <option key={`modal_counter_${c.id}_${idx}`} value={c.id}>
                        Quầy {c.counterNumber} ({c.area})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slot */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Ca áp dụng:
                  </label>
                  <select
                    value={newRuleSlot}
                    onChange={(e) => setNewRuleSlot(e.target.value as any)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                  >
                    <option value="both">Cả 2 ca (Đi ca nào gán ca đó)</option>
                    <option value="morning">Chỉ Ca Sáng</option>
                    <option value="afternoon">Chỉ Ca Chiều</option>
                  </select>
                </div>

                {/* Day of week */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Ngày trong tuần:
                  </label>
                  <select
                    value={newRuleDay}
                    onChange={(e) => setNewRuleDay(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                  >
                    <option value={0}>Tất cả các ngày trong tuần</option>
                    <option value={1}>Thứ 2</option>
                    <option value={2}>Thứ 3</option>
                    <option value={3}>Thứ 4</option>
                    <option value={4}>Thứ 5</option>
                    <option value={5}>Thứ 6</option>
                    <option value={6}>Thứ 7</option>
                    <option value={7}>Chủ Nhật</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <input
                  type="text"
                  placeholder="Ghi chú (ví dụ: Quản lý quầy SSC, Trưởng ca...)"
                  value={newRuleNotes}
                  onChange={(e) => setNewRuleNotes(e.target.value)}
                  className="flex-1 text-xs p-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-teal-700"
                />

                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm Rule
                </button>
              </div>
            </form>

            {/* List of active fixed rules */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {rules.fixedRules.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
                  Chưa có quy tắc gán cố định nào. Tạo quy tắc bên trên để tự động gán các nhân viên đặc thù
                  (như Thu ngân trưởng, Quầy SSC, Quầy Dịch vụ).
                </div>
              ) : (
                rules.fixedRules.map((rule) => {
                  const targetCounter = counters.find((c) => c.id === rule.counterId);
                  return (
                    <div
                      key={rule.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        rule.active
                          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleFixedRule(rule.id)}
                          className="text-slate-400 hover:text-teal-700 cursor-pointer shrink-0"
                          title={rule.active ? 'Tắt quy tắc' : 'Bật quy tắc'}
                        >
                          {rule.active ? (
                            <ToggleRight className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-300" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {rule.employeeName}
                            </span>
                            {rule.employeeId && (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
                                {rule.employeeId}
                              </span>
                            )}
                            <span className="text-slate-400 text-xs">$\to$</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              Quầy {targetCounter?.counterNumber || rule.counterId}{' '}
                              {targetCounter?.area ? `(${targetCounter.area})` : ''}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              {rule.slot === 'morning' ? (
                                <Sun className="w-3 h-3 text-amber-600" />
                              ) : rule.slot === 'afternoon' ? (
                                <Moon className="w-3 h-3 text-indigo-600" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-teal-600" />
                              )}
                              {rule.slot === 'morning'
                                ? 'Ca Sáng'
                                : rule.slot === 'afternoon'
                                ? 'Ca Chiều'
                                : 'Cả 2 Ca'}
                            </span>
                            <span>•</span>
                            <span>{getDayName(rule.dayOfWeek)}</span>
                            {rule.notes && (
                              <>
                                <span>•</span>
                                <span className="italic text-slate-400">{rule.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteFixedRule(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Xóa quy tắc"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STRATEGY & GLOBAL OPTIONS */}
        {activeTab === 'strategy' && (
          <div className="space-y-3.5">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800">Quy tắc ghép nối ca & quầy:</div>

              {/* Option 1: autoMatchShiftCategory */}
              <div className="flex items-start justify-between gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">
                    Bắt buộc khớp Ca Sáng / Ca Chiều
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Nhân viên có lịch ca Sáng chỉ xếp vào slot Sáng, ca Chiều chỉ xếp vào slot Chiều. Không
                    ghép chéo ca.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.autoMatchShiftCategory}
                  onChange={() => handleToggleOption('autoMatchShiftCategory')}
                  className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer shrink-0 mt-1"
                />
              </div>

              {/* Option 2: prioritizeSscCounters */}
              <div className="flex items-start justify-between gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">
                    Ưu tiên lấp đầy Quầy SSC / Tự phục vụ trước
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Hệ thống sẽ ưu tiên phân bổ nhân sự vào các quầy Self-Service Checkout (SSC) trọng điểm
                    trước khi mở các quầy thu ngân thông thường.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.prioritizeSscCounters}
                  onChange={() => handleToggleOption('prioritizeSscCounters')}
                  className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer shrink-0 mt-1"
                />
              </div>

              {/* Option 3: balanceAreas */}
              <div className="flex items-start justify-between gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">
                    Cân bằng nhân lực theo từng Khu vực (Area Balancing)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Phân bổ đều thu ngân giữa các khu vực (Khu Thực phẩm, Bách hóa, Tự chọn...) để tránh tình
                    trạng khu vực không có quầy nào hoạt động.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.balanceAreas}
                  onChange={() => handleToggleOption('balanceAreas')}
                  className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer shrink-0 mt-1"
                />
              </div>

              {/* Option 4: prioritizeV6OverV8Afternoon */}
              <div className="flex items-start justify-between gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">
                    Ca Chiều ưu tiên ca V6* trước ca V8*
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Khi phân bổ quầy ca chiều, hệ thống sẽ ưu tiên gán nhân viên đi ca V6* vào quầy trước, sau đó mới đến ca V8*.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.prioritizeV6OverV8Afternoon ?? true}
                  onChange={() => handleToggleOption('prioritizeV6OverV8Afternoon')}
                  className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer shrink-0 mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium py-1 px-2 hover:bg-slate-100 rounded cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục tùy chọn mặc định
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: COUNTER PRIORITY ORDER */}
        {activeTab === 'counter_priority' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Danh sách quầy thu ngân theo thứ tự ưu tiên mở quầy chung. Khi không khớp rule ca cụ thể, các quầy nằm trên cùng sẽ được ưu tiên nhận nhân sự trước.
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
              {counters.map((c, index) => (
                <div
                  key={c.id}
                  className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px]">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">Quầy {c.counterNumber}</span>
                      <span className="text-slate-400 ml-2">({c.area})</span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                    Thứ tự {c.order || index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="text-[11px] text-slate-400">
            * Các quy tắc được tự động áp dụng khi bấm "Tự động phân"
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Hoàn tất & Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
