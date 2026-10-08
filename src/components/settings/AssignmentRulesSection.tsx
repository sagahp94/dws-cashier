import React, { useState } from 'react';
import {
  AssignmentRuleConfig,
  FixedCounterRule,
  ShiftCounterPriorityRule,
  Counter,
  Employee,
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
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Sun,
  Moon,
  Info,
  ShieldCheck,
  Clock,
  X,
} from 'lucide-react';
import { useToast } from '../common/ToastContainer';

interface AssignmentRulesSectionProps {
  counters: Counter[];
  employees: Employee[];
  onRulesChanged?: () => void;
}

export const AssignmentRulesSection: React.FC<AssignmentRulesSectionProps> = ({
  counters,
  employees,
  onRulesChanged,
}) => {
  const { success, warning } = useToast();
  const [rules, setRules] = useState<AssignmentRuleConfig>(() => storageService.getAssignmentRules());

  // Shift rules form state
  const [newShiftCodes, setNewShiftCodes] = useState('V815');
  const [newShiftDayType, setNewShiftDayType] = useState<'weekday' | 'weekend' | 'all'>('weekday');
  const [newShiftCounters, setNewShiftCounters] = useState('21, 23, SSC, 104, 106, 110, 114, 111');
  const [newShiftNotes, setNewShiftNotes] = useState('');

  // New fixed rule form state
  const [newRuleEmp, setNewRuleEmp] = useState('');
  const [newRuleCounter, setNewRuleCounter] = useState(counters[0]?.id || '1');
  const [newRuleSlot, setNewRuleSlot] = useState<'both' | 'morning' | 'afternoon'>('both');
  const [newRuleDay, setNewRuleDay] = useState<number>(0);
  const [newRuleNotes, setNewRuleNotes] = useState('');

  const handleSaveAll = (updated: AssignmentRuleConfig) => {
    setRules(updated);
    storageService.saveAssignmentRules(updated);
    onRulesChanged?.();
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
        return 'Tất cả các ngày';
    }
  };

  const shiftRulesList = rules.shiftCounterRules || DEFAULT_SHIFT_COUNTER_RULES;

  return (
    <div id="assignment-rules-section" className="space-y-6">
      {/* Section Header */}
      <div className="neu-panel p-5 rounded-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl neu-inset text-teal-800 flex items-center justify-center font-bold border-teal-200">
              <Sliders className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Rule Phân Quầy Tự Động (Auto-Assign Rules)</h3>
              <p className="text-xs text-slate-500 font-medium">
                Tùy chỉnh quầy ưu tiên cho từng ca (V815, V818, V820, V822), gán nhân sự cố định và chiến lược xếp quầy.
              </p>
            </div>
          </div>
        </div>

        {/* 1. SHIFT COUNTER PRIORITY RULES */}
        <div className="space-y-3.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-700" />
              Quy tắc Quầy ưu tiên theo Ca làm việc ({shiftRulesList.length})
            </h4>

            <button
              type="button"
              onClick={handleResetShiftRulesPreset}
              className="neu-button-secondary inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-amber-900 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Khôi phục 3 Rule chuẩn (V815, V818, V820)
            </button>
          </div>

          {/* Add Shift Rule Form */}
          <form
            onSubmit={handleAddShiftRule}
            className="p-4 neu-card rounded-xl space-y-3"
          >
            <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-teal-700" />
              <span>Thêm quy tắc quầy ưu tiên cho ca làm việc</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Mã ca (VD: V815 hoặc V820, V822):
                </label>
                <input
                  type="text"
                  placeholder="VD: V815, V818..."
                  value={newShiftCodes}
                  onChange={(e) => setNewShiftCodes(e.target.value)}
                  className="w-full text-xs p-2 neu-inset rounded-xl font-mono uppercase focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Thời gian áp dụng:
                </label>
                <select
                  value={newShiftDayType}
                  onChange={(e) => setNewShiftDayType(e.target.value as any)}
                  className="w-full text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
                >
                  <option value="weekday">Ngày thường (Thứ 2 - Thứ 6)</option>
                  <option value="weekend">Cuối tuần (Thứ 7, Chủ Nhật)</option>
                  <option value="all">Tất cả các ngày trong tuần</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Quầy ưu tiên (phân cách dấu phẩy):
                </label>
                <input
                  type="text"
                  placeholder="VD: 21, 23, SSC, 104..."
                  value={newShiftCounters}
                  onChange={(e) => setNewShiftCounters(e.target.value)}
                  className="w-full text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <input
                type="text"
                placeholder="Ghi chú chi tiết quy tắc..."
                value={newShiftNotes}
                onChange={(e) => setNewShiftNotes(e.target.value)}
                className="flex-1 text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
              />

              <button
                type="submit"
                className="neu-button-primary px-4 py-2 text-xs font-bold rounded-xl shrink-0 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Rule Ca
              </button>
            </div>
          </form>

          {/* List of Shift Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shiftRulesList.map((rule) => (
              <div
                key={rule.id}
                className={`p-3.5 rounded-xl transition-all ${
                  rule.active
                    ? 'neu-card'
                    : 'neu-inset opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleShiftRule(rule.id)}
                      className="text-slate-400 hover:text-teal-700 cursor-pointer shrink-0 mt-0.5"
                    >
                      {rule.active ? (
                        <ToggleRight className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-400" />
                      )}
                    </button>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {rule.shiftCodes.map((code) => (
                          <span
                            key={code}
                            className="px-2 py-0.5 rounded-lg text-xs font-black bg-teal-700 text-white font-mono shadow-2xs"
                          >
                            {code}
                          </span>
                        ))}

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold neu-pill ${
                            rule.dayType === 'weekday'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : rule.dayType === 'weekend'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {rule.dayType === 'weekday'
                            ? 'Ngày thường (T2 - T6)'
                            : rule.dayType === 'weekend'
                            ? 'Cuối tuần (T7, CN)'
                            : 'Tất cả các ngày'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-bold text-slate-500 mr-1">
                          Quầy:
                        </span>
                        {rule.priorityCounters.map((cnt, idx) => (
                          <span
                            key={`${cnt}_${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg neu-inset text-xs font-bold text-slate-800"
                          >
                            {cnt}
                            <button
                              type="button"
                              onClick={() => handleRemoveCounterFromRule(rule.id, idx)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title={`Xóa quầy ${cnt}`}
                            >
                              <X className="w-3 h-3" />
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
            ))}
          </div>
        </div>

        {/* Global Strategy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl neu-card flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-black text-slate-900">Bắt buộc khớp Ca Sáng / Chiều</div>
              <div className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Ca sáng chỉ phân vào slot sáng, ca chiều chỉ phân vào slot chiều.
              </div>
            </div>
            <input
              type="checkbox"
              checked={rules.autoMatchShiftCategory}
              onChange={() => handleToggleOption('autoMatchShiftCategory')}
              className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer mt-0.5 accent-teal-700"
            />
          </div>

          <div className="p-3.5 rounded-xl neu-card flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-black text-slate-900">Ưu tiên lấp Quầy SSC trước</div>
              <div className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Tự động ưu tiên xếp nhân sự vào các quầy Self-Service Checkout (SSC).
              </div>
            </div>
            <input
              type="checkbox"
              checked={rules.prioritizeSscCounters}
              onChange={() => handleToggleOption('prioritizeSscCounters')}
              className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer mt-0.5 accent-teal-700"
            />
          </div>

          <div className="p-3.5 rounded-xl neu-card flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-black text-slate-900">Cân bằng phân bổ Khu vực</div>
              <div className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Phân bổ đều nhân sự giữa các khu vực siêu thị (Thực phẩm, Tự chọn...).
              </div>
            </div>
            <input
              type="checkbox"
              checked={rules.balanceAreas}
              onChange={() => handleToggleOption('balanceAreas')}
              className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer mt-0.5 accent-teal-700"
            />
          </div>

          <div className="p-3.5 rounded-xl neu-card flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-black text-slate-900">Ca Chiều ưu tiên ca V6* trước ca V8*</div>
              <div className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Khi phân bổ quầy ca chiều, hệ thống sẽ ưu tiên gán nhân viên ca V6* vào quầy trước ca V8*.
              </div>
            </div>
            <input
              type="checkbox"
              checked={rules.prioritizeV6OverV8Afternoon ?? true}
              onChange={() => handleToggleOption('prioritizeV6OverV8Afternoon')}
              className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer mt-0.5 accent-teal-700"
            />
          </div>
        </div>

        {/* Fixed Employee Rules Form */}
        <div className="pt-2">
          <form
            onSubmit={handleAddFixedRule}
            className="p-4 neu-card rounded-xl space-y-3"
          >
            <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-teal-700" />
              <span>Thêm Quy tắc gán nhân sự cố định vào quầy</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Employee */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nhân viên:
                </label>
                {employees.length > 0 ? (
                  <select
                    value={newRuleEmp}
                    onChange={(e) => setNewRuleEmp(e.target.value)}
                    className="w-full text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {employees.map((emp, idx) => (
                      <option key={`section_emp_${emp.id || ''}_${emp.fullName}_${idx}`} value={emp.fullName}>
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
                    className="w-full text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
                  />
                )}
              </div>

              {/* Counter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Quầy chỉ định:
                </label>
                <select
                  value={newRuleCounter}
                  onChange={(e) => setNewRuleCounter(e.target.value)}
                  className="w-full text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
                >
                  {counters.map((c, idx) => (
                    <option key={`section_counter_${c.id}_${idx}`} value={c.id}>
                      Quầy {c.counterNumber} ({c.area})
                    </option>
                  ))}
                </select>
              </div>

              {/* Slot */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Ca áp dụng:
                </label>
                <select
                  value={newRuleSlot}
                  onChange={(e) => setNewRuleSlot(e.target.value as any)}
                  className="w-full text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
                >
                  <option value="both">Cả 2 ca (Đi ca nào gán ca đó)</option>
                  <option value="morning">Chỉ Ca Sáng</option>
                  <option value="afternoon">Chỉ Ca Chiều</option>
                </select>
              </div>

              {/* Day of Week */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Ngày áp dụng:
                </label>
                <select
                  value={newRuleDay}
                  onChange={(e) => setNewRuleDay(Number(e.target.value))}
                  className="w-full text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
                >
                  <option value={0}>Tất cả các ngày</option>
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
                placeholder="Ghi chú (ví dụ: Thu ngân trưởng, Quản lý ca sáng...)"
                value={newRuleNotes}
                onChange={(e) => setNewRuleNotes(e.target.value)}
                className="flex-1 text-xs p-2 neu-inset rounded-xl focus:outline-hidden"
              />

              <button
                type="submit"
                className="neu-button-primary px-4 py-2 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Thêm Rule
              </button>
            </div>
          </form>
        </div>

        {/* Existing Fixed Rules List */}
        <div className="space-y-2">
          <div className="text-xs font-black text-slate-800">
            Danh sách Rule nhân viên cố định ({rules.fixedRules.length}):
          </div>

          {rules.fixedRules.length === 0 ? (
            <div className="p-6 text-center neu-inset rounded-xl text-xs text-slate-400 font-medium">
              Chưa có quy tắc nhân viên cố định nào được lưu.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rules.fixedRules.map((rule) => {
                const targetCounter = counters.find((c) => c.id === rule.counterId);
                return (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-xl flex items-center justify-between gap-3 transition-all ${
                      rule.active
                        ? 'neu-card'
                        : 'neu-inset opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleFixedRule(rule.id)}
                        className="text-slate-400 hover:text-teal-700 cursor-pointer shrink-0"
                      >
                        {rule.active ? (
                          <ToggleRight className="w-6 h-6 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {rule.employeeName}
                          </span>
                          <span className="text-slate-400 text-xs font-bold">&rarr;</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black neu-pill bg-purple-100 text-purple-800 border-purple-200">
                            Quầy {targetCounter?.counterNumber || rule.counterId}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 font-medium">
                          <span>
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
                              <span className="italic text-slate-400 truncate max-w-[120px]">
                                {rule.notes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFixedRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
