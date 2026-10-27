import {
  Shift,
  Counter,
  Employee,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  CounterDayAssignment,
  HistoryRecord,
  CatalogMetadata,
  AssignmentRuleConfig,
  FixedCounterRule,
  ShiftCounterPriorityRule,
  ShiftSwapRequest,
} from '../types';
import { isOffShift } from './excelService';
import { getMondayOfWeek } from '../utils/dateUtils';

const STORAGE_KEYS = {
  SHIFTS: 'dws_settings_shifts',
  SHIFTS_META: 'dws_settings_shifts_meta',
  COUNTERS: 'dws_settings_counters',
  COUNTERS_META: 'dws_settings_counters_meta',
  EMPLOYEES: 'dws_settings_employees',
  EMPLOYEES_META: 'dws_settings_employees_meta',
  WEEKLY_SCHEDULES: 'dws_weekly_schedules',
  ASSIGNMENTS_PREFIX: 'dws_assignment_',
  HISTORY: 'dws_history',
  ASSIGNMENT_RULES: 'dws_assignment_rules',
  EXCLUDED_EMPLOYEES: 'dws_excluded_assignment_employees',
  SWAP_REQUESTS: 'dws_shift_swap_requests',
};

export const DEFAULT_COUNTERS: Counter[] = [
  { id: '1 ssc', counterNumber: '1\nssc', area: 'Khu Tự chọn T1', order: 1 },
  { id: '2 ssc', counterNumber: '2\nssc', area: 'Khu Tự chọn T1', order: 2 },
  { id: '3 ssc', counterNumber: '3\nssc', area: 'Khu Tự chọn T1', order: 3 },
  { id: '4 ssc', counterNumber: '4\nssc', area: 'Khu Tự chọn T1', order: 4 },
  { id: '6', counterNumber: '6', area: 'Khu Thực phẩm', order: 5 },
  { id: '7', counterNumber: '7', area: 'Khu Thực phẩm', order: 6 },
  { id: '8', counterNumber: '8', area: 'Khu Thực phẩm', order: 7 },
  { id: '9', counterNumber: '9', area: 'Khu Thực phẩm', order: 8 },
  { id: '10', counterNumber: '10', area: 'Khu Thực phẩm', order: 9 },
  { id: '11', counterNumber: '11', area: 'Khu Bách hóa', order: 10 },
  { id: '12', counterNumber: '12', area: 'Khu Bách hóa', order: 11 },
  { id: '13', counterNumber: '13', area: 'Khu Bách hóa', order: 12 },
  { id: '14', counterNumber: '14', area: 'Khu Bách hóa', order: 13 },
  { id: '15', counterNumber: '15', area: 'Khu Bách hóa', order: 14 },
  { id: '16', counterNumber: '16', area: 'Khu Bách hóa', order: 15 },
  { id: '17', counterNumber: '17', area: 'Khu Bách hóa', order: 16 },
  { id: 'KGFL1', counterNumber: 'KGFL1', area: 'Khu Gian hàng', order: 17 },
  { id: '18', counterNumber: '18', area: 'Khu Gia dụng', order: 18 },
  { id: '19', counterNumber: '19', area: 'Khu Gia dụng', order: 19 },
  { id: '20', counterNumber: '20', area: 'Khu Thời trang', order: 20 },
  { id: '21', counterNumber: '21', area: 'Khu Thời trang', order: 21 },
  { id: '22', counterNumber: '22', area: 'Khu Thời trang', order: 22 },
  { id: '23', counterNumber: '23', area: 'Khu Thời trang', order: 23 },
  { id: '24', counterNumber: '24', area: 'Khu Thời trang', order: 24 },
  { id: '25', counterNumber: '25', area: 'Tầng 2', order: 25 },
  { id: '26', counterNumber: '26', area: 'Tầng 2', order: 26 },
  { id: '27', counterNumber: '27', area: 'Tầng 2', order: 27 },
  { id: '101', counterNumber: '101', area: 'Khu Đồ uống', order: 28 },
  { id: '102', counterNumber: '102', area: 'Khu Đồ uống', order: 29 },
  { id: '103', counterNumber: '103', area: 'Khu Bánh kẹo', order: 30 },
  { id: '104', counterNumber: '104', area: 'Khu Bánh kẹo', order: 31 },
  { id: '105', counterNumber: '105', area: 'Khu Sữa chua', order: 32 },
  { id: '306', counterNumber: '306', area: 'Khu Dịch vụ', order: 33 },
  { id: '106', counterNumber: '106', area: 'Khu Trái cây', order: 34 },
  { id: '109', counterNumber: '109', area: 'Khu Trái cây', order: 35 },
  { id: '110', counterNumber: '110', area: 'Khu Mỹ phẩm', order: 36 },
  { id: '111', counterNumber: '111', area: 'Khu Mỹ phẩm', order: 37 },
  { id: '112', counterNumber: '112', area: 'Khu Dược phẩm', order: 38 },
  { id: '114', counterNumber: '114', area: 'Khu Dược phẩm', order: 39 },
  { id: '115', counterNumber: '115', area: 'Khu Hàng trẻ em', order: 40 },
  { id: '117', counterNumber: '117', area: 'Khu Hàng trẻ em', order: 41 },
  { id: '305', counterNumber: '305', area: 'Khu CSKH', order: 42 },
  { id: '307', counterNumber: '307', area: 'Khu CSKH', order: 43 },
  { id: '311', counterNumber: '311', area: 'Khu CSKH', order: 44 },
  { id: '312', counterNumber: '312', area: 'Khu CSKH', order: 45 },
  { id: 'QL1', counterNumber: 'QL', area: 'Quản lý', order: 46 },
  { id: 'QL2', counterNumber: 'QL', area: 'Quản lý', order: 47 },
];

export const DEFAULT_SHIFTS: Shift[] = [
  { shiftCode: 'V814', startTime: '08:00', endTime: '14:00', shiftType: 'Ca Sáng (5S Kho)', category: 'morning', isOff: false },
  { shiftCode: 'V815', startTime: '08:00', endTime: '15:30', shiftType: 'Ca Sáng (V815)', category: 'morning', isOff: false },
  { shiftCode: 'V615', startTime: '06:00', endTime: '15:00', shiftType: 'Ca Sáng Sớm (V615)', category: 'morning', isOff: false },
  { shiftCode: 'V818', startTime: '08:00', endTime: '18:00', shiftType: 'Ca Gãy / Giữa (V818)', category: 'morning', isOff: false },
  { shiftCode: 'V618', startTime: '06:00', endTime: '18:00', shiftType: 'Ca Gãy Sớm (V618)', category: 'morning', isOff: false },
  { shiftCode: 'V820', startTime: '13:00', endTime: '20:00', shiftType: 'Ca Chiều (V820)', category: 'afternoon', isOff: false },
  { shiftCode: 'V620', startTime: '06:00', endTime: '20:00', shiftType: 'Ca Sớm / Chiều (V620)', category: 'afternoon', isOff: false },
  { shiftCode: 'V822', startTime: '14:00', endTime: '22:00', shiftType: 'Ca Chiều / Tối (V822)', category: 'afternoon', isOff: false },
  { shiftCode: 'V829', startTime: '13:30', endTime: '22:00', shiftType: 'Ca Chiều / Đóng Cửa (V829)', category: 'afternoon', isOff: false },
  { shiftCode: 'V830', startTime: '14:30', endTime: '22:30', shiftType: 'Ca Tối Đóng Cửa (V830)', category: 'afternoon', isOff: false },
  { shiftCode: 'V633', startTime: '15:30', endTime: '22:00', shiftType: 'Ca Chiều Muộn (V633)', category: 'afternoon', isOff: false },
  { shiftCode: 'OFF', startTime: '00:00', endTime: '00:00', shiftType: 'Nghỉ Tuần (OFF)', category: 'off', isOff: true },
  { shiftCode: 'AL', startTime: '00:00', endTime: '00:00', shiftType: 'Nghỉ Phép Năm (AL)', category: 'off', isOff: true },
  { shiftCode: 'RO', startTime: '00:00', endTime: '00:00', shiftType: 'Nghỉ Roster (RO)', category: 'off', isOff: true },
  { shiftCode: 'DO', startTime: '00:00', endTime: '00:00', shiftType: 'Nghỉ Day Off (DO)', category: 'off', isOff: true },
];

export const DEFAULT_EMPLOYEES: Employee[] = [
  { employeeId: 'NV001', fullName: 'Vũ Thị Vân Anh', isSup: true, canSieuThi: true, canBanhMy: true, canDelica: true, phone: '0901234501', department: 'Thu ngân T1' },
  { employeeId: 'NV002', fullName: 'Phạm Thị Hằng', isSup: false, canSieuThi: true, canBanhMy: true, canDelica: false, phone: '0901234502', department: 'Thu ngân T1' },
  { employeeId: 'NV003', fullName: 'Vũ Thị Ngọc Anh', isSup: false, canSieuThi: true, canBanhMy: false, canDelica: true, phone: '0901234503', department: 'Thu ngân T1' },
  { employeeId: 'NV004', fullName: 'Nguyễn Thị Ngọc Anh', isSup: false, canSieuThi: true, canBanhMy: false, canDelica: false, phone: '0901234504', department: 'Thu ngân T1' },
  { employeeId: 'NV005', fullName: 'Hoàng Thúy Liễu', isSup: true, canSieuThi: true, canBanhMy: true, canDelica: false, phone: '0901234505', department: 'Thu ngân T2' },
  { employeeId: 'NV006', fullName: 'Trần Gia Tuyển', isSup: false, canSieuThi: true, canBanhMy: false, canDelica: true, phone: '0901234506', department: 'Thu ngân T2' },
  { employeeId: 'NV007', fullName: 'Vũ Thị Quỳnh Anh', isSup: false, canSieuThi: true, canBanhMy: false, canDelica: false, phone: '0901234507', department: 'Thu ngân T1' },
  { employeeId: 'NV008', fullName: 'Nguyễn Thị Lan', isSup: false, canSieuThi: true, canBanhMy: true, canDelica: false, phone: '0901234508', department: 'Thu ngân T1' },
  { employeeId: 'NV009', fullName: 'Trần Ngọc Mai', isSup: false, canSieuThi: true, canBanhMy: false, canDelica: false, phone: '0901234509', department: 'Thu ngân T2' },
  { employeeId: 'NV010', fullName: 'Vũ Bảo Đức Duy', isSup: false, canSieuThi: true, canBanhMy: false, canDelica: true, phone: '0901234510', department: 'Thu ngân T2' },
];

export const DEFAULT_SHIFT_COUNTER_RULES: ShiftCounterPriorityRule[] = [
  {
    id: 'rule_v815',
    shiftCodes: ['V815', '815', 'S815', 'V814', 'V615'],
    dayType: 'all',
    priorityCounters: ['SSC', '17', '21', '23', '104', '105', '106', '110', '111', '114'],
    notes: 'Ca sáng ưu tiên ca V815: SSC, 17, 21, 23, 104, 105, 106, 110, 111, 114',
    active: true,
  },
  {
    id: 'rule_v818',
    shiftCodes: ['V818', '818', 'G818', 'V618', '618'],
    dayType: 'all',
    priorityCounters: ['13', '15', '20', '22', '24', '25', '102'],
    notes: 'Ca sáng ưu tiên ca V818 / V618: 13, 15, 20, 22, 24, 25, 102',
    active: true,
  },
  {
    id: 'rule_v820',
    shiftCodes: ['V820', '820', 'V620', '620', 'V822', '822', 'C820', 'C822'],
    dayType: 'all',
    priorityCounters: ['11', '26', '27', '103', '112', '108', '109'],
    notes: 'Ca chiều ưu tiên ca V820 / V620 / V822: 11, 26, 27, 103, 112, 108, 109',
    active: true,
  },
];

export const DEFAULT_ASSIGNMENT_RULES: AssignmentRuleConfig = {
  autoMatchShiftCategory: true,
  prioritizeSscCounters: true,
  balanceAreas: true,
  counterPriorityOrder: [],
  avoidConsecutiveDaysSameCounter: false,
  fixedRules: [],
  shiftCounterRules: DEFAULT_SHIFT_COUNTER_RULES,
  prioritizeV6OverV8Afternoon: true,
};

export type AssignmentConflictStrategy =
  | 'smart_combine' // Gộp thông minh: giữ các quầy đã xếp, điền thêm các quầy trống từ tệp sao lưu
  | 'prefer_more_complete' // Tự động chọn bản đầy đủ hơn (nhiều người xếp hơn) cho mỗi ngày trùng
  | 'prefer_backup' // Ghi đè ngày trùng bằng dữ liệu trong tệp sao lưu
  | 'prefer_current'; // Giữ nguyên ngày trùng trên máy, chỉ thêm các ngày mới chưa có

export interface MergeBackupOptions {
  mode: 'overwrite' | 'merge';
  assignmentStrategy?: AssignmentConflictStrategy;
}

export interface BackupMergeResult {
  success: boolean;
  mode: 'overwrite' | 'merge';
  addedDates: string[];
  mergedDates: string[];
  updatedDates: string[];
  skippedDates: string[];
  shiftsAdded: number;
  countersAdded: number;
  employeesAdded: number;
  weeksAdded: number;
  totalAssignmentsCount: number;
  error?: string;
}

export interface BackupFileSummary {
  version?: string;
  exportedAt?: string;
  fileName?: string;
  shiftsCount: number;
  countersCount: number;
  employeesCount: number;
  schedulesCount: number;
  assignmentsDates: string[];
  totalAssignedSlots: number;
}

// Helper: Count assigned cashier slots for a day
export function countAssignedSlots(day: DayDwsAssignment): number {
  if (!day || !day.assignments) return 0;
  let count = 0;
  for (const c of Object.values(day.assignments)) {
    if (c.morning && (c.morning.employeeId || c.morning.employeeName)) count++;
    if (c.morning2 && (c.morning2.employeeId || c.morning2.employeeName)) count++;
    if (c.afternoon && (c.afternoon.employeeId || c.afternoon.employeeName)) count++;
    if (c.afternoon2 && (c.afternoon2.employeeId || c.afternoon2.employeeName)) count++;
  }
  return count;
}

// Helper: Smart combine two versions of the same date
export function smartCombineDay(
  currentDay: DayDwsAssignment,
  backupDay: DayDwsAssignment,
  priority: 'smart' | 'current_priority' | 'backup_priority' = 'smart'
): DayDwsAssignment {
  const mergedAssignments: Record<string, CounterDayAssignment> = {};

  const allCounterIds = new Set<string>([
    ...Object.keys(currentDay.assignments || {}),
    ...Object.keys(backupDay.assignments || {}),
  ]);

  for (const counterId of allCounterIds) {
    const cCounter = currentDay.assignments?.[counterId];
    const bCounter = backupDay.assignments?.[counterId];

    if (!cCounter && bCounter) {
      mergedAssignments[counterId] = JSON.parse(JSON.stringify(bCounter));
      continue;
    }
    if (cCounter && !bCounter) {
      mergedAssignments[counterId] = JSON.parse(JSON.stringify(cCounter));
      continue;
    }

    if (cCounter && bCounter) {
      const mergedCounter: CounterDayAssignment = {
        ...cCounter,
        counterId,
      };

      const slots: Array<'morning' | 'morning2' | 'afternoon' | 'afternoon2'> = [
        'morning',
        'morning2',
        'afternoon',
        'afternoon2',
      ];

      for (const slot of slots) {
        const cSlot = cCounter[slot];
        const bSlot = bCounter[slot];

        const cHas = Boolean(cSlot && (cSlot.employeeId || cSlot.employeeName));
        const bHas = Boolean(bSlot && (bSlot.employeeId || bSlot.employeeName));

        if (!cHas && bHas) {
          mergedCounter[slot] = bSlot;
        } else if (cHas && !bHas) {
          mergedCounter[slot] = cSlot;
        } else if (cHas && bHas) {
          if (priority === 'backup_priority') {
            mergedCounter[slot] = bSlot;
          } else {
            mergedCounter[slot] = cSlot;
          }
        }
      }

      if (!mergedCounter.note && bCounter.note) {
        mergedCounter.note = bCounter.note;
      }
      if (!mergedCounter.excess && bCounter.excess) {
        mergedCounter.excess = bCounter.excess;
      }

      mergedAssignments[counterId] = mergedCounter;
    }
  }

  return {
    ...currentDay,
    weekId: currentDay.weekId || backupDay.weekId,
    dayOfWeek: currentDay.dayOfWeek ?? backupDay.dayOfWeek,
    assignments: mergedAssignments,
    updatedAt: new Date().toISOString(),
  };
}

// Helper for safe JSON parse
function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from storage:`, error);
    return defaultValue;
  }
}

function setToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to storage:`, error);
  }
}

export const storageService = {
  // === SHIFTS ===
  getShifts(): Shift[] {
    const rawItem = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    let source: Shift[];
    if (rawItem === null) {
      // First launch: initialize default AEON shifts
      source = DEFAULT_SHIFTS;
      setToStorage(STORAGE_KEYS.SHIFTS, DEFAULT_SHIFTS);
      setToStorage(STORAGE_KEYS.SHIFTS_META, {
        updatedAt: null,
        fileName: 'Mặc định hệ thống AEON',
        count: DEFAULT_SHIFTS.length,
      });
    } else {
      try {
        source = JSON.parse(rawItem) || [];
      } catch {
        source = [];
      }
    }

    return source.map((s) => {
      const isOff = s.isOff || s.category === 'off' || isOffShift(s.shiftCode, s.shiftType, s.startTime, s.endTime);
      return {
        ...s,
        isOff,
        category: isOff ? 'off' : s.category || (s.startTime && s.startTime < '13:00' ? 'morning' : 'afternoon'),
        shiftType: s.shiftType || (isOff ? 'Ca Nghỉ' : 'Ca thường'),
      };
    });
  },
  getShiftsMeta(): CatalogMetadata {
    const meta = getFromStorage<CatalogMetadata | null>(STORAGE_KEYS.SHIFTS_META, null);
    if (meta) {
      return meta;
    }
    const rawItem = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    if (rawItem === null) {
      return {
        updatedAt: null,
        fileName: 'Mặc định hệ thống AEON',
        count: DEFAULT_SHIFTS.length,
      };
    }
    return {
      updatedAt: null,
      fileName: null,
      count: 0,
    };
  },
  saveShifts(shifts: Shift[], fileName?: string): void {
    const normalized = shifts.map((s) => {
      const isOff = s.isOff || s.category === 'off' || isOffShift(s.shiftCode, s.shiftType, s.startTime, s.endTime);
      return {
        ...s,
        isOff,
        category: isOff ? 'off' : s.category || (s.startTime && s.startTime < '13:00' ? 'morning' : 'afternoon'),
        shiftType: s.shiftType || (isOff ? 'Ca Nghỉ' : 'Ca thường'),
      };
    });
    setToStorage(STORAGE_KEYS.SHIFTS, normalized);
    setToStorage(STORAGE_KEYS.SHIFTS_META, {
      updatedAt: new Date().toISOString(),
      fileName: fileName || null,
      count: normalized.length,
    });
    this.notifyChange('shifts');
  },
  clearShifts(): void {
    // Explicitly set to empty array so getShifts() knows it was intentionally cleared
    setToStorage(STORAGE_KEYS.SHIFTS, []);
    setToStorage(STORAGE_KEYS.SHIFTS_META, {
      updatedAt: new Date().toISOString(),
      fileName: null,
      count: 0,
    });
    this.notifyChange('shifts');
  },

  // === COUNTERS ===
  getCounters(): Counter[] {
    const rawItem = localStorage.getItem(STORAGE_KEYS.COUNTERS);
    if (rawItem === null) {
      // First launch: initialize default AEON counters
      setToStorage(STORAGE_KEYS.COUNTERS, DEFAULT_COUNTERS);
      setToStorage(STORAGE_KEYS.COUNTERS_META, {
        updatedAt: null,
        fileName: 'Mặc định hệ thống AEON',
        count: DEFAULT_COUNTERS.length,
      });
      return DEFAULT_COUNTERS;
    }
    try {
      return JSON.parse(rawItem) || [];
    } catch {
      return [];
    }
  },
  getCountersMeta(): CatalogMetadata {
    const meta = getFromStorage<CatalogMetadata | null>(STORAGE_KEYS.COUNTERS_META, null);
    if (meta) {
      return meta;
    }
    const rawItem = localStorage.getItem(STORAGE_KEYS.COUNTERS);
    if (rawItem === null) {
      return {
        updatedAt: null,
        fileName: 'Mặc định hệ thống AEON',
        count: DEFAULT_COUNTERS.length,
      };
    }
    return {
      updatedAt: null,
      fileName: null,
      count: 0,
    };
  },
  saveCounters(counters: Counter[], fileName?: string): void {
    setToStorage(STORAGE_KEYS.COUNTERS, counters);
    setToStorage(STORAGE_KEYS.COUNTERS_META, {
      updatedAt: new Date().toISOString(),
      fileName: fileName || null,
      count: counters.length,
    });
    this.notifyChange('counters');
  },
  clearCounters(): void {
    // Explicitly set to empty array so getCounters() knows it was intentionally cleared
    setToStorage(STORAGE_KEYS.COUNTERS, []);
    setToStorage(STORAGE_KEYS.COUNTERS_META, {
      updatedAt: new Date().toISOString(),
      fileName: null,
      count: 0,
    });
    this.notifyChange('counters');
  },

  // === EMPLOYEES ===
  getEmployees(): Employee[] {
    const rawItem = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    if (rawItem === null) {
      setToStorage(STORAGE_KEYS.EMPLOYEES, DEFAULT_EMPLOYEES);
      setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
        updatedAt: null,
        fileName: 'Mặc định hệ thống AEON',
        count: DEFAULT_EMPLOYEES.length,
      });
      return DEFAULT_EMPLOYEES;
    }
    try {
      return JSON.parse(rawItem) || [];
    } catch {
      return [];
    }
  },
  getEmployeesMeta(): CatalogMetadata {
    return getFromStorage<CatalogMetadata>(STORAGE_KEYS.EMPLOYEES_META, {
      updatedAt: null,
      fileName: null,
      count: 0,
    });
  },
  saveEmployees(employees: Employee[], fileName?: string): void {
    setToStorage(STORAGE_KEYS.EMPLOYEES, employees);
    setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
      updatedAt: new Date().toISOString(),
      fileName: fileName || null,
      count: employees.length,
    });
    this.notifyChange('employees');
  },
  updateEmployee(employeeId: string, updates: Partial<Employee>): Employee | null {
    const current = this.getEmployees();
    const idx = current.findIndex((e) => e.employeeId.toLowerCase() === employeeId.toLowerCase());
    if (idx === -1) return null;
    const updatedEmp: Employee = {
      ...current[idx],
      ...updates,
    };
    const updatedList = [...current];
    updatedList[idx] = updatedEmp;
    const meta = this.getEmployeesMeta();
    setToStorage(STORAGE_KEYS.EMPLOYEES, updatedList);
    setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
      ...meta,
      updatedAt: new Date().toISOString(),
      count: updatedList.length,
    });
    this.notifyChange('employees');
    return updatedEmp;
  },
  setEmployeeResigned(employeeId: string, isResigned: boolean, weekMonday?: string): { employee: Employee | null; removedCount: number } {
    const current = this.getEmployees();
    const idx = current.findIndex((e) => e.employeeId.toLowerCase() === employeeId.toLowerCase());
    if (idx === -1) return { employee: null, removedCount: 0 };

    const target = current[idx];
    const updatedEmp: Employee = {
      ...target,
      isResigned,
      resignedAt: isResigned ? new Date().toISOString() : undefined,
      notes: isResigned
        ? (target.notes && !target.notes.includes('Nghỉ việc') ? `${target.notes} • Nghỉ việc` : 'Nghỉ việc')
        : (target.notes === 'Nghỉ việc' ? '' : target.notes),
    };

    const updatedList = [...current];
    updatedList[idx] = updatedEmp;
    const meta = this.getEmployeesMeta();
    setToStorage(STORAGE_KEYS.EMPLOYEES, updatedList);
    setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
      ...meta,
      updatedAt: new Date().toISOString(),
      count: updatedList.length,
    });

    // If marked as resigned, automatically exclude from counter assignments & remove from any assigned counters
    let removedCount = 0;
    if (isResigned) {
      this.setEmployeeExcluded(updatedEmp.fullName, updatedEmp.employeeId, true);
      removedCount = this.removeEmployeeFromAssignments(updatedEmp.fullName, updatedEmp.employeeId, weekMonday);
    } else {
      this.setEmployeeExcluded(updatedEmp.fullName, updatedEmp.employeeId, false);
    }

    this.notifyChange('employees');
    return { employee: updatedEmp, removedCount };
  },
  deleteEmployee(employeeId: string): void {
    const current = this.getEmployees();
    const updated = current.filter((e) => e.employeeId.toLowerCase() !== employeeId.toLowerCase());
    const meta = this.getEmployeesMeta();
    setToStorage(STORAGE_KEYS.EMPLOYEES, updated);
    setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
      ...meta,
      updatedAt: new Date().toISOString(),
      count: updated.length,
    });
    this.notifyChange('employees');
  },
  deleteEmployees(employeeIds: string[]): void {
    const idSet = new Set(employeeIds.map((id) => id.toLowerCase()));
    const current = this.getEmployees();
    const updated = current.filter((e) => !idSet.has(e.employeeId.toLowerCase()));
    const meta = this.getEmployeesMeta();
    setToStorage(STORAGE_KEYS.EMPLOYEES, updated);
    setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
      ...meta,
      updatedAt: new Date().toISOString(),
      count: updated.length,
    });
    this.notifyChange('employees');
  },
  clearEmployees(): void {
    setToStorage(STORAGE_KEYS.EMPLOYEES, []);
    setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
      updatedAt: new Date().toISOString(),
      fileName: null,
      count: 0,
    });
    this.notifyChange('employees');
  },

  // === EXCLUDED EMPLOYEES (KHÔNG PHÂN QUẦY) ===
  getExcludedEmployees(): string[] {
    return getFromStorage<string[]>(STORAGE_KEYS.EXCLUDED_EMPLOYEES, []);
  },
  isEmployeeResigned(employeeName: string, employeeId?: string): boolean {
    const employees = this.getEmployees();
    const keyName = (employeeName || '').toLowerCase().trim();
    const keyId = (employeeId || '').toLowerCase().trim();
    const emp = employees.find(
      (e) =>
        (keyId && (e.employeeId || '').toLowerCase().trim() === keyId) ||
        (keyName && (e.fullName || '').toLowerCase().trim() === keyName)
    );
    return !!emp?.isResigned;
  },
  getEmployeeExclusionNote(employeeName: string, employeeId?: string): string | undefined {
    const employees = this.getEmployees();
    const keyName = (employeeName || '').toLowerCase().trim();
    const keyId = (employeeId || '').toLowerCase().trim();
    const emp = employees.find(
      (e) =>
        (keyId && (e.employeeId || '').toLowerCase().trim() === keyId) ||
        (keyName && (e.fullName || '').toLowerCase().trim() === keyName)
    );
    if (emp?.isResigned) {
      return 'Nghỉ việc';
    }
    return undefined;
  },
  isEmployeeExcluded(employeeName: string, employeeId?: string): boolean {
    if (this.isEmployeeResigned(employeeName, employeeId)) {
      return true;
    }
    const list = this.getExcludedEmployees();
    const set = new Set(list.map((k) => k.toLowerCase().trim()));
    const keyName = (employeeName || '').toLowerCase().trim();
    const keyId = (employeeId || '').toLowerCase().trim();
    return set.has(keyName) || (!!keyId && set.has(keyId));
  },
  setEmployeeExcluded(employeeName: string, employeeId?: string, excluded: boolean = true): void {
    const list = this.getExcludedEmployees();
    const keyName = (employeeName || '').toLowerCase().trim();
    const keyId = (employeeId || '').toLowerCase().trim();
    const updated = list.filter((k) => k !== keyName && (!keyId || k !== keyId));
    if (excluded) {
      if (keyId) updated.push(keyId);
      if (keyName && keyName !== keyId) updated.push(keyName);
    }
    setToStorage(STORAGE_KEYS.EXCLUDED_EMPLOYEES, Array.from(new Set(updated)));
    this.notifyChange('employees');
  },
  batchSetEmployeesExcluded(items: { employeeName: string; employeeId?: string }[], excluded: boolean = true): void {
    const list = this.getExcludedEmployees();
    const keysToAlter = new Set<string>();
    items.forEach((item) => {
      const kName = (item.employeeName || '').toLowerCase().trim();
      const kId = (item.employeeId || '').toLowerCase().trim();
      if (kName) keysToAlter.add(kName);
      if (kId) keysToAlter.add(kId);
    });
    const updated = list.filter((k) => !keysToAlter.has(k));
    if (excluded) {
      keysToAlter.forEach((k) => updated.push(k));
    }
    setToStorage(STORAGE_KEYS.EXCLUDED_EMPLOYEES, Array.from(new Set(updated)));
    this.notifyChange('employees');
  },
  addEmployeeFromSchedule(employeeName: string, employeeId?: string): Employee {
    const existing = this.getEmployees();
    const trimmedName = employeeName.trim();
    const found = existing.find(
      (e) => (employeeId && e.employeeId.toLowerCase() === employeeId.toLowerCase()) ||
             e.fullName.toLowerCase().trim() === trimmedName.toLowerCase()
    );
    if (found) {
      this.setEmployeeExcluded(found.fullName, found.employeeId, false);
      return found;
    }

    let newId = employeeId ? employeeId.trim() : '';
    if (!newId) {
      const maxNum = existing.reduce((max, e) => {
        const m = e.employeeId.match(/\d+/);
        if (m) {
          const n = parseInt(m[0], 10);
          return Math.max(max, isNaN(n) ? 0 : n);
        }
        return max;
      }, 0);
      newId = `NV${String(maxNum + 1).padStart(3, '0')}`;
    }

    const newEmp: Employee = {
      employeeId: newId,
      fullName: trimmedName,
      isSup: false,
      canSieuThi: true,
      canBanhMy: false,
      canDelica: false,
      department: 'Thu ngân',
    };

    const updated = [...existing, newEmp];
    this.saveEmployees(updated);
    this.setEmployeeExcluded(newEmp.fullName, newEmp.employeeId, false);
    return newEmp;
  },
  batchAddEmployeesFromSchedule(items: { employeeName: string; employeeId?: string }[]): Employee[] {
    const added: Employee[] = [];
    items.forEach((item) => {
      const emp = this.addEmployeeFromSchedule(item.employeeName, item.employeeId);
      added.push(emp);
    });
    return added;
  },
  removeEmployeeFromAssignments(employeeName: string, employeeId?: string, weekMonday?: string, date?: string): number {
    const keyName = (employeeName || '').toLowerCase().trim();
    const keyId = (employeeId || '').toLowerCase().trim();
    let removedCount = 0;

    const cleanDayAssignment = (assignment: DayDwsAssignment): boolean => {
      let changed = false;
      if (!assignment || !assignment.assignments) return false;
      Object.values(assignment.assignments).forEach((ca) => {
        if (ca.morning) {
          const k = (ca.morning.employeeId || ca.morning.employeeName || '').toLowerCase().trim();
          if (k === keyName || (keyId && k === keyId)) {
            ca.morning = null;
            changed = true;
            removedCount++;
          }
        }
        if (ca.morning2) {
          const k = (ca.morning2.employeeId || ca.morning2.employeeName || '').toLowerCase().trim();
          if (k === keyName || (keyId && k === keyId)) {
            ca.morning2 = null;
            changed = true;
            removedCount++;
          }
        }
        if (ca.afternoon) {
          const k = (ca.afternoon.employeeId || ca.afternoon.employeeName || '').toLowerCase().trim();
          if (k === keyName || (keyId && k === keyId)) {
            ca.afternoon = null;
            changed = true;
            removedCount++;
          }
        }
        if (ca.afternoon2) {
          const k = (ca.afternoon2.employeeId || ca.afternoon2.employeeName || '').toLowerCase().trim();
          if (k === keyName || (keyId && k === keyId)) {
            ca.afternoon2 = null;
            changed = true;
            removedCount++;
          }
        }
      });
      return changed;
    };

    if (date) {
      const asg = this.getAssignment(date);
      if (asg && cleanDayAssignment(asg)) {
        this.saveAssignment(asg);
      }
    } else if (weekMonday) {
      const mon = new Date(weekMonday);
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        const asg = this.getAssignment(dStr);
        if (asg && cleanDayAssignment(asg)) {
          this.saveAssignment(asg);
        }
      }
    }
    return removedCount;
  },

  // === WEEKLY SCHEDULES ===
  // Keyed by weekId (e.g. "2026-W34" or "2026-08-17")
  getAllWeeklySchedules(): Record<string, WeeklyScheduleEntry[]> {
    return getFromStorage<Record<string, WeeklyScheduleEntry[]>>(STORAGE_KEYS.WEEKLY_SCHEDULES, {});
  },
  getWeeklySchedule(weekId?: string): WeeklyScheduleEntry[] {
    const all = this.getAllWeeklySchedules();
    if (!weekId) {
      return Object.values(all).flat() as WeeklyScheduleEntry[];
    }
    if (all[weekId] && all[weekId].length > 0) {
      return all[weekId];
    }
    // Fallback: check if any entries match the weekId
    const allEntries = Object.values(all).flat() as WeeklyScheduleEntry[];
    const matching = allEntries.filter((e) => e.weekId === weekId || e.date?.startsWith(weekId));
    if (matching.length > 0) return matching;
    return [];
  },
  saveWeeklySchedule(weekId: string, entries: WeeklyScheduleEntry[]): void {
    const all = this.getAllWeeklySchedules();
    all[weekId] = entries;
    setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, all);
    this.notifyChange('weeklySchedule');
  },
  appendWeeklySchedule(weekId: string, newEntries: WeeklyScheduleEntry[]): void {
    const existing = this.getWeeklySchedule(weekId);
    // Safely merge newEntries into existing without losing old employees or colliding on generic STT indices
    const resultEntries: WeeklyScheduleEntry[] = [...existing];

    newEntries.forEach((newE) => {
      if (!newE.date) return;
      const newName = (newE.employeeName || '').toLowerCase().trim();
      const newId = (newE.employeeId || '').toUpperCase().trim();
      const isNewIdGenericStt = /^\d{1,3}$/.test(newId);

      const foundIdx = resultEntries.findIndex((e) => {
        if (e.date !== newE.date) return false;
        const eName = (e.employeeName || '').toLowerCase().trim();
        const eId = (e.employeeId || '').toUpperCase().trim();
        const isEIdGenericStt = /^\d{1,3}$/.test(eId);

        // Match by identical name
        if (newName && eName && newName === eName) return true;
        // Or match by genuine employee ID (not generic numbers like "1", "2")
        if (newId && eId && newId === eId && !isNewIdGenericStt && !isEIdGenericStt) return true;
        return false;
      });

      if (foundIdx >= 0) {
        // Update existing entry with new entry's shift, keeping valid existing employee ID
        const existingEntry = resultEntries[foundIdx];
        resultEntries[foundIdx] = {
          ...existingEntry,
          ...newE,
          employeeId: (!isNewIdGenericStt && newE.employeeId) || existingEntry.employeeId,
          employeeName: newE.employeeName || existingEntry.employeeName,
        };
      } else {
        resultEntries.push(newE);
      }
    });

    this.saveWeeklySchedule(weekId, resultEntries);
  },
  repairDataIntegrity(weekMonday?: string): {
    repairedEmployeesCount: number;
    repairedScheduleCount: number;
    repairedMismatchCount: number;
  } {
    let repairedEmployeesCount = 0;
    let repairedScheduleCount = 0;
    let repairedMismatchCount = 0;

    const existingEmployees = this.getEmployees();
    const existingShifts = this.getShifts();
    const empNameMap = new Map<string, Employee>();
    const empIdMap = new Map<string, Employee>();
    existingEmployees.forEach((e) => {
      if (e.fullName) empNameMap.set(e.fullName.toLowerCase().trim(), e);
      if (e.employeeId) empIdMap.set(e.employeeId.toUpperCase().trim(), e);
    });

    // Helper to look up existing employee in catalog (do NOT auto-create employees)
    const findExistingEmployee = (name?: string, id?: string): Employee | undefined => {
      const cleanName = (name || '').trim();
      const cleanId = (id || '').trim();
      const lookupName = cleanName.toLowerCase();
      const lookupId = cleanId.toUpperCase();

      return (lookupId && empIdMap.get(lookupId)) || (lookupName && empNameMap.get(lookupName));
    };

    // Helper to determine shift category
    const getShiftCat = (shiftCode: string): 'morning' | 'afternoon' | 'off' | 'other' => {
      const code = (shiftCode || '').toUpperCase().trim();
      if (!code || isOffShift(code, '')) return 'off';
      const found = existingShifts.find((s) => s.shiftCode.toUpperCase().trim() === code);
      if (found) {
        if (found.isOff || found.category === 'off') return 'off';
        if (found.category === 'morning') return 'morning';
        if (found.category === 'afternoon') return 'afternoon';
        if (found.startTime) {
          const [h] = found.startTime.split(':').map((x) => parseInt(x, 10));
          if (!isNaN(h)) return h < 13 ? 'morning' : 'afternoon';
        }
      }
      if (
        code.startsWith('V820') ||
        code === '820' ||
        code.startsWith('V620') ||
        code === '620' ||
        code.startsWith('V822') ||
        code === '822' ||
        code.startsWith('V829') ||
        code === '829' ||
        code.startsWith('V830') ||
        code === '830' ||
        code.startsWith('V633') ||
        code === '633' ||
        code.startsWith('C') ||
        code.startsWith('T')
      ) {
        return 'afternoon';
      }
      if (
        code.startsWith('V814') ||
        code === '814' ||
        code.startsWith('V815') ||
        code === '815' ||
        code.startsWith('V615') ||
        code === '615' ||
        code.startsWith('V818') ||
        code === '818' ||
        code.startsWith('V618') ||
        code === '618' ||
        code.startsWith('S')
      ) {
        return 'morning';
      }
      return 'other';
    };

    // 1. Scan all daily assignments to ensure assigned employees that exist in catalog have a schedule entry
    // AND resolve any afternoon-in-morning, morning-in-afternoon, or duplicate slot conflicts
    const allAssignments: Record<string, DayDwsAssignment> = this.getAllAssignments();
    const allWeekly = this.getAllWeeklySchedules();
    let assignmentsUpdated = false;

    (Object.entries(allAssignments) as [string, DayDwsAssignment][]).forEach(([date, dayAsg]) => {
      if (!dayAsg || !dayAsg.assignments) return;

      const targetMonday = getMondayOfWeek(new Date(date));
      let weekEntries = allWeekly[targetMonday] ? [...allWeekly[targetMonday]] : [];
      let weekUpdated = false;

      // Track usage to deduplicate double assignments
      const morningAssignedEmp = new Set<string>();
      const afternoonAssignedEmp = new Set<string>();

      Object.values(dayAsg.assignments).forEach((ca: any) => {
        if (!ca) return;

        // Morning slot check
        if (ca.morning && (ca.morning.employeeName || ca.morning.employeeId)) {
          const emp = findExistingEmployee(ca.morning.employeeName, ca.morning.employeeId);
          const empKey = (ca.morning.employeeId || ca.morning.employeeName).toLowerCase().trim();

          // Deduplicate
          if (morningAssignedEmp.has(empKey)) {
            ca.morning = null;
            repairedMismatchCount++;
            assignmentsUpdated = true;
          } else {
            morningAssignedEmp.add(empKey);

            if (emp) {
              // Check if employee has a schedule entry on this date
              const scheduleEntry = weekEntries.find((we) => {
                if (we.date !== date) return false;
                const weName = (we.employeeName || '').toLowerCase().trim();
                const weId = (we.employeeId || '').toUpperCase().trim();
                return (
                  (weName && weName === emp.fullName.toLowerCase().trim()) ||
                  (weId && weId === emp.employeeId.toUpperCase().trim())
                );
              });

              if (!scheduleEntry) {
                const dateObj = new Date(date);
                const jsDay = dateObj.getDay();
                const dayOfWeek = jsDay === 0 ? 7 : jsDay;
                const newEntry: WeeklyScheduleEntry = {
                  id: `${emp.employeeId || emp.fullName}_${date}`,
                  weekId: targetMonday,
                  date,
                  dayOfWeek,
                  employeeId: emp.employeeId,
                  employeeName: emp.fullName,
                  shiftCode: ca.morning.shiftCode || 'V815',
                };
                weekEntries.push(newEntry);
                weekUpdated = true;
                repairedScheduleCount++;
              } else {
                // Rule check: Mã ca có phân loại là ca chiều thì không thể xếp vào ca sáng của quầy!
                const cat = getShiftCat(scheduleEntry.shiftCode);
                if (cat === 'afternoon' || cat === 'off') {
                  ca.morning = null;
                  repairedMismatchCount++;
                  assignmentsUpdated = true;
                }
              }
            }
          }
        }

        // Afternoon slot check
        if (ca.afternoon && (ca.afternoon.employeeName || ca.afternoon.employeeId)) {
          const emp = findExistingEmployee(ca.afternoon.employeeName, ca.afternoon.employeeId);
          const empKey = (ca.afternoon.employeeId || ca.afternoon.employeeName).toLowerCase().trim();

          // Deduplicate
          if (afternoonAssignedEmp.has(empKey)) {
            ca.afternoon = null;
            repairedMismatchCount++;
            assignmentsUpdated = true;
          } else {
            afternoonAssignedEmp.add(empKey);

            if (emp) {
              const scheduleEntry = weekEntries.find((we) => {
                if (we.date !== date) return false;
                const weName = (we.employeeName || '').toLowerCase().trim();
                const weId = (we.employeeId || '').toUpperCase().trim();
                return (
                  (weName && weName === emp.fullName.toLowerCase().trim()) ||
                  (weId && weId === emp.employeeId.toUpperCase().trim())
                );
              });

              if (!scheduleEntry) {
                const dateObj = new Date(date);
                const jsDay = dateObj.getDay();
                const dayOfWeek = jsDay === 0 ? 7 : jsDay;
                const newEntry: WeeklyScheduleEntry = {
                  id: `${emp.employeeId || emp.fullName}_${date}`,
                  weekId: targetMonday,
                  date,
                  dayOfWeek,
                  employeeId: emp.employeeId,
                  employeeName: emp.fullName,
                  shiftCode: ca.afternoon.shiftCode || 'V820',
                };
                weekEntries.push(newEntry);
                weekUpdated = true;
                repairedScheduleCount++;
              } else {
                // Rule check: Mã ca có phân loại là ca sáng (Ví dụ V815) thì không xếp vào ca chiều của quầy!
                const cat = getShiftCat(scheduleEntry.shiftCode);
                if (cat === 'morning' || cat === 'off') {
                  ca.afternoon = null;
                  repairedMismatchCount++;
                  assignmentsUpdated = true;
                }
              }
            }
          }
        }
      });

      if (weekUpdated) {
        allWeekly[targetMonday] = weekEntries;
      }
    });

    if (repairedScheduleCount > 0) {
      setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, allWeekly);
      this.notifyChange('weeklySchedule');
    }

    if (assignmentsUpdated) {
      Object.values(allAssignments).forEach((dayAsg) => {
        this.saveAssignment(dayAsg);
      });
      this.notifyChange('assignment');
    }

    return { repairedEmployeesCount, repairedScheduleCount, repairedMismatchCount };
  },
  clearWeeklySchedule(weekId?: string): void {
    if (weekId) {
      const all = this.getAllWeeklySchedules();
      delete all[weekId];
      setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, all);
    } else {
      setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, {});
    }
    this.notifyChange('weeklySchedule');
  },

  /**
   * Cập nhật ca làm việc của một nhân viên trong tuần mà không cần upload lại file
   * Tự động lưu lại thông tin ca cũ và ca mới
   */
  updateWeeklyScheduleShift(params: {
    weekId: string;
    date: string;
    employeeName: string;
    employeeId?: string;
    newShiftCode: string;
    note?: string;
    isHardRosterSynced?: boolean;
  }): { success: boolean; entry: WeeklyScheduleEntry | null; oldShiftCode: string; newShiftCode: string } {
    const { weekId, date, employeeName, employeeId, newShiftCode, note, isHardRosterSynced } = params;
    const cleanName = (employeeName || '').trim().toLowerCase();
    const cleanId = (employeeId || '').trim().toLowerCase();
    const cleanShift = (newShiftCode || '').trim().toUpperCase();

    // Tìm trong weekId trước, nếu không thấy thì quét toàn bộ các tuần
    const all = this.getAllWeeklySchedules();
    let targetWeekKey = weekId;
    if (!all[targetWeekKey] || all[targetWeekKey].length === 0) {
      for (const [wKey, entries] of Object.entries(all) as [string, WeeklyScheduleEntry[]][]) {
        if (Array.isArray(entries) && entries.some((e) => e.date === date)) {
          targetWeekKey = wKey;
          break;
        }
      }
    }

    const currentEntries: WeeklyScheduleEntry[] = all[targetWeekKey] ? [...all[targetWeekKey]] : [];
    const foundIdx = currentEntries.findIndex((e) => {
      if (e.date !== date) return false;
      const eName = (e.employeeName || '').trim().toLowerCase();
      const eId = (e.employeeId || '').trim().toLowerCase();
      if (cleanId && eId && cleanId === eId) return true;
      return cleanName && eName === cleanName;
    });

    let oldShift = '';
    let updatedEntry: WeeklyScheduleEntry;
    const isOff = isOffShift(cleanShift);

    if (foundIdx >= 0) {
      const existing = currentEntries[foundIdx];
      oldShift = existing.shiftCode;
      const isShiftChanged = oldShift !== cleanShift;
      const finalHardRosterSynced = isHardRosterSynced !== undefined 
        ? isHardRosterSynced 
        : (isShiftChanged ? false : existing.isHardRosterSynced);
      updatedEntry = {
        ...existing,
        originalShiftCode: existing.originalShiftCode || existing.shiftCode,
        previousShiftCode: existing.shiftCode,
        shiftCode: cleanShift,
        isOff,
        modifiedAt: new Date().toISOString(),
        modificationNote: note !== undefined ? note.trim() : existing.modificationNote,
        isHardRosterSynced: finalHardRosterSynced,
        syncedAt: finalHardRosterSynced ? (existing.syncedAt || new Date().toISOString()) : undefined,
      };
      currentEntries[foundIdx] = updatedEntry;
    } else {
      const d = new Date(date);
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
      updatedEntry = {
        id: `${employeeId || employeeName}_${date}_${Date.now()}`,
        weekId: targetWeekKey || weekId,
        date,
        dayOfWeek,
        employeeId,
        employeeName,
        shiftCode: cleanShift,
        isOff,
        originalShiftCode: 'Chưa xếp ca',
        previousShiftCode: 'Chưa xếp ca',
        modifiedAt: new Date().toISOString(),
        modificationNote: note ? note.trim() : 'Bổ sung ca làm việc',
        isHardRosterSynced: isHardRosterSynced !== undefined ? isHardRosterSynced : false,
        syncedAt: isHardRosterSynced ? new Date().toISOString() : undefined,
      };
      currentEntries.push(updatedEntry);
    }

    all[targetWeekKey] = currentEntries;
    setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, all);
    this.notifyChange('weeklySchedule');

    // Đồng bộ vào bản phân quầy ngày nếu nhân viên đang được gán tại quầy
    const dayAsg = this.getAssignment(date);
    if (dayAsg && dayAsg.assignments) {
      let asgModified = false;
      for (const counterAsg of Object.values(dayAsg.assignments)) {
        const slotKeys: Array<'morning' | 'morning2' | 'afternoon' | 'afternoon2'> = [
          'morning',
          'morning2',
          'afternoon',
          'afternoon2',
        ];
        slotKeys.forEach((slotKey) => {
          const slot = counterAsg[slotKey];
          if (slot) {
            const sName = (slot.employeeName || '').trim().toLowerCase();
            const sId = (slot.employeeId || '').trim().toLowerCase();
            if ((cleanId && sId && cleanId === sId) || (cleanName && sName === cleanName)) {
              slot.shiftCode = cleanShift;
              asgModified = true;
            }
          }
        });
      }
      if (asgModified) {
        this.saveAssignment(dayAsg);
      }
    }

    return {
      success: true,
      entry: updatedEntry,
      oldShiftCode: oldShift,
      newShiftCode: cleanShift,
    };
  },

  /**
   * Đánh dấu / Bỏ đánh dấu ca làm việc đã được cập nhật vào file lịch cứng (Hard Roster) và thông báo cho nhân viên
   */
  toggleWeeklyScheduleHardRosterSync(params: {
    weekId?: string;
    date: string;
    employeeName: string;
    employeeId?: string;
    isSynced?: boolean;
  }): { success: boolean; entry: WeeklyScheduleEntry | null; isHardRosterSynced: boolean } {
    const { weekId, date, employeeName, employeeId, isSynced } = params;
    const cleanName = (employeeName || '').trim().toLowerCase();
    const cleanId = (employeeId || '').trim().toLowerCase();

    const all = this.getAllWeeklySchedules();
    let targetWeekKey = weekId || '';
    if (!targetWeekKey || !all[targetWeekKey] || all[targetWeekKey].length === 0) {
      for (const [wKey, entries] of Object.entries(all) as [string, WeeklyScheduleEntry[]][]) {
        if (Array.isArray(entries) && entries.some((e) => e.date === date)) {
          targetWeekKey = wKey;
          break;
        }
      }
    }

    const currentEntries: WeeklyScheduleEntry[] = all[targetWeekKey] ? [...all[targetWeekKey]] : [];
    const foundIdx = currentEntries.findIndex((e) => {
      if (e.date !== date) return false;
      const eName = (e.employeeName || '').trim().toLowerCase();
      const eId = (e.employeeId || '').trim().toLowerCase();
      if (cleanId && eId && cleanId === eId) return true;
      return cleanName && eName === cleanName;
    });

    if (foundIdx < 0) {
      return { success: false, entry: null, isHardRosterSynced: false };
    }

    const existing = currentEntries[foundIdx];
    const newSyncedState = isSynced !== undefined ? isSynced : !existing.isHardRosterSynced;
    const updatedEntry: WeeklyScheduleEntry = {
      ...existing,
      isHardRosterSynced: newSyncedState,
      syncedAt: newSyncedState ? (existing.syncedAt || new Date().toISOString()) : undefined,
    };

    currentEntries[foundIdx] = updatedEntry;
    all[targetWeekKey] = currentEntries;
    setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, all);
    this.notifyChange('weeklySchedule');

    return {
      success: true,
      entry: updatedEntry,
      isHardRosterSynced: newSyncedState,
    };
  },

  /**
   * Đánh dấu hàng loạt các ca làm việc đã chỉnh sửa là đã sync vào file lịch cứng
   */
  batchSetWeeklyScheduleHardRosterSync(
    entriesToUpdate: Array<{ date: string; employeeId?: string; employeeName: string }>,
    isSynced: boolean = true
  ): number {
    const all = this.getAllWeeklySchedules();
    let updatedCount = 0;
    const nowStr = new Date().toISOString();

    for (const [wKey, entries] of Object.entries(all) as [string, WeeklyScheduleEntry[]][]) {
      if (!Array.isArray(entries)) continue;
      let hasChangeInWeek = false;

      entries.forEach((e) => {
        const matches = entriesToUpdate.some((u) => {
          if (u.date !== e.date) return false;
          const uId = (u.employeeId || '').trim().toLowerCase();
          const eId = (e.employeeId || '').trim().toLowerCase();
          if (uId && eId && uId === eId) return true;
          return (u.employeeName || '').trim().toLowerCase() === (e.employeeName || '').trim().toLowerCase();
        });

        if (matches) {
          e.isHardRosterSynced = isSynced;
          e.syncedAt = isSynced ? (e.syncedAt || nowStr) : undefined;
          hasChangeInWeek = true;
          updatedCount++;
        }
      });

      if (hasChangeInWeek) {
        all[wKey] = [...entries];
      }
    }

    if (updatedCount > 0) {
      setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, all);
      this.notifyChange('weeklySchedule');
    }

    return updatedCount;
  },

  // === ASSIGNMENTS (DAILY DWS) ===
  getAssignment(date: string): DayDwsAssignment | null {
    const key = `${STORAGE_KEYS.ASSIGNMENTS_PREFIX}${date}`;
    return getFromStorage<DayDwsAssignment | null>(key, null);
  },
  getAllAssignmentsForWeek(weekMonday: string): Record<string, DayDwsAssignment> {
    const result: Record<string, DayDwsAssignment> = {};
    const mon = new Date(weekMonday);
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const assignment = this.getAssignment(dateStr);
      if (assignment) {
        result[dateStr] = assignment;
      }
    }
    return result;
  },
  saveAssignment(assignment: DayDwsAssignment): void {
    const key = `${STORAGE_KEYS.ASSIGNMENTS_PREFIX}${assignment.date}`;
    setToStorage(key, {
      ...assignment,
      updatedAt: new Date().toISOString(),
    });
    this.notifyChange(`assignment_${assignment.date}`);
  },
  clearAssignment(date: string): void {
    const key = `${STORAGE_KEYS.ASSIGNMENTS_PREFIX}${date}`;
    localStorage.removeItem(key);
    this.notifyChange(`assignment_${date}`);
  },

  // === HISTORY ===
  getHistory(): HistoryRecord[] {
    return getFromStorage<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
  },
  addHistoryRecord(record: HistoryRecord): void {
    const history = this.getHistory();
    // Keep last 100 entries
    const updated = [record, ...history.filter(h => h.id !== record.id)].slice(0, 100);
    setToStorage(STORAGE_KEYS.HISTORY, updated);
    this.notifyChange('history');
  },
  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    this.notifyChange('history');
  },

  // === ASSIGNMENT RULES ===
  getAssignmentRules(): AssignmentRuleConfig {
    const rules = getFromStorage<AssignmentRuleConfig>(STORAGE_KEYS.ASSIGNMENT_RULES, DEFAULT_ASSIGNMENT_RULES);
    
    // Check if stored rules are using legacy format or old preset rules
    const hasOldRules = rules.shiftCounterRules?.some((r) => 
      r.id.includes('weekday') || r.id.includes('weekend') || r.id.includes('v829') || r.id.includes('v830')
    );

    let shiftRules = (!rules.shiftCounterRules || rules.shiftCounterRules.length === 0 || hasOldRules)
      ? DEFAULT_SHIFT_COUNTER_RULES
      : rules.shiftCounterRules;

    // Ensure V818 rule includes V618 and V820 rule includes V620
    let updatedRules = false;
    shiftRules = shiftRules.map((r) => {
      const isV818Rule = r.shiftCodes.some((c) => c.toUpperCase().includes('818'));
      const isV820Rule = r.shiftCodes.some((c) => c.toUpperCase().includes('820'));

      let codes = [...r.shiftCodes];
      if (isV818Rule) {
        if (!codes.some((c) => c.toUpperCase() === 'V618')) {
          codes.push('V618');
          updatedRules = true;
        }
        if (!codes.some((c) => c.toUpperCase() === '618')) {
          codes.push('618');
          updatedRules = true;
        }
      }
      let note = r.notes;
      if (isV820Rule) {
        if (!codes.some((c) => c.toUpperCase() === 'V620')) {
          codes.push('V620');
          updatedRules = true;
        }
        if (!codes.some((c) => c.toUpperCase() === '620')) {
          codes.push('620');
          updatedRules = true;
        }
        if (note && note.includes('Ca sáng')) {
          note = 'Ca chiều ưu tiên ca V820 / V620 / V822: 11, 26, 27, 103, 112, 108, 109';
          updatedRules = true;
        }
      }
      return { ...r, shiftCodes: codes, notes: note };
    });

    const merged: AssignmentRuleConfig = {
      ...DEFAULT_ASSIGNMENT_RULES,
      ...rules,
      fixedRules: rules.fixedRules || [],
      counterPriorityOrder: rules.counterPriorityOrder || [],
      shiftCounterRules: shiftRules,
      prioritizeV6OverV8Afternoon: rules.prioritizeV6OverV8Afternoon ?? true,
    };

    if (hasOldRules || updatedRules) {
      setToStorage(STORAGE_KEYS.ASSIGNMENT_RULES, merged);
    }

    return merged;
  },
  saveAssignmentRules(rules: AssignmentRuleConfig): void {
    setToStorage(STORAGE_KEYS.ASSIGNMENT_RULES, rules);
    this.notifyChange('rules');
  },
  addFixedRule(rule: Omit<FixedCounterRule, 'id'>): FixedCounterRule {
    const rules = this.getAssignmentRules();
    const newRule: FixedCounterRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    rules.fixedRules.push(newRule);
    this.saveAssignmentRules(rules);
    return newRule;
  },
  updateFixedRule(id: string, updates: Partial<FixedCounterRule>): void {
    const rules = this.getAssignmentRules();
    const idx = rules.fixedRules.findIndex((r) => r.id === id);
    if (idx !== -1) {
      rules.fixedRules[idx] = { ...rules.fixedRules[idx], ...updates };
      this.saveAssignmentRules(rules);
    }
  },
  deleteFixedRule(id: string): void {
    const rules = this.getAssignmentRules();
    rules.fixedRules = rules.fixedRules.filter((r) => r.id !== id);
    this.saveAssignmentRules(rules);
  },

  // === EXPORT / BACKUP ===
  exportAllData(): string {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shifts: this.getShifts(),
      shiftsMeta: this.getShiftsMeta(),
      counters: this.getCounters(),
      countersMeta: this.getCountersMeta(),
      employees: this.getEmployees(),
      employeesMeta: this.getEmployeesMeta(),
      weeklySchedules: this.getAllWeeklySchedules(),
      history: this.getHistory(),
      assignments: this.getAllAssignments(),
      assignmentRules: this.getAssignmentRules(),
    };
    return JSON.stringify(data, null, 2);
  },
  getAllAssignments(): Record<string, DayDwsAssignment> {
    const result: Record<string, DayDwsAssignment> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.ASSIGNMENTS_PREFIX)) {
        const date = key.replace(STORAGE_KEYS.ASSIGNMENTS_PREFIX, '');
        const assignment = this.getAssignment(date);
        if (assignment) {
          result[date] = assignment;
        }
      }
    }
    return result;
  },
  importAllData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.shifts) setToStorage(STORAGE_KEYS.SHIFTS, data.shifts);
      if (data.shiftsMeta) setToStorage(STORAGE_KEYS.SHIFTS_META, data.shiftsMeta);
      if (data.counters) setToStorage(STORAGE_KEYS.COUNTERS, data.counters);
      if (data.countersMeta) setToStorage(STORAGE_KEYS.COUNTERS_META, data.countersMeta);
      if (data.employees) setToStorage(STORAGE_KEYS.EMPLOYEES, data.employees);
      if (data.employeesMeta) setToStorage(STORAGE_KEYS.EMPLOYEES_META, data.employeesMeta);
      if (data.weeklySchedules) setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, data.weeklySchedules);
      if (data.history) setToStorage(STORAGE_KEYS.HISTORY, data.history);
      if (data.assignmentRules) setToStorage(STORAGE_KEYS.ASSIGNMENT_RULES, data.assignmentRules);
      if (data.assignments) {
        Object.entries(data.assignments).forEach(([date, assignment]) => {
          const key = `${STORAGE_KEYS.ASSIGNMENTS_PREFIX}${date}`;
          setToStorage(key, assignment);
        });
      }
      this.notifyChange('all');
      return true;
    } catch (e) {
      console.error('Failed to import backup data:', e);
      return false;
    }
  },
  inspectBackupData(data: any): BackupFileSummary {
    const shiftsCount = Array.isArray(data?.shifts) ? data.shifts.length : 0;
    const countersCount = Array.isArray(data?.counters) ? data.counters.length : 0;
    const employeesCount = Array.isArray(data?.employees) ? data.employees.length : 0;
    const schedulesCount = data?.weeklySchedules ? Object.keys(data.weeklySchedules).length : 0;
    const assignments = data?.assignments || {};
    const assignmentsDates = Object.keys(assignments).sort();

    let totalAssignedSlots = 0;
    for (const day of Object.values(assignments) as DayDwsAssignment[]) {
      totalAssignedSlots += countAssignedSlots(day);
    }

    return {
      version: data?.version,
      exportedAt: data?.exportedAt,
      shiftsCount,
      countersCount,
      employeesCount,
      schedulesCount,
      assignmentsDates,
      totalAssignedSlots,
    };
  },
  mergeBackupData(backupData: any, options: MergeBackupOptions = { mode: 'merge' }): BackupMergeResult {
    try {
      if (!backupData || typeof backupData !== 'object') {
        return {
          success: false,
          mode: options.mode,
          addedDates: [],
          mergedDates: [],
          updatedDates: [],
          skippedDates: [],
          shiftsAdded: 0,
          countersAdded: 0,
          employeesAdded: 0,
          weeksAdded: 0,
          totalAssignmentsCount: 0,
          error: 'Dữ liệu tệp sao lưu không hợp lệ.',
        };
      }

      if (options.mode === 'overwrite') {
        const ok = this.importAllData(JSON.stringify(backupData));
        const allAssignments = this.getAllAssignments();
        return {
          success: ok,
          mode: 'overwrite',
          addedDates: Object.keys(backupData.assignments || {}),
          mergedDates: [],
          updatedDates: [],
          skippedDates: [],
          shiftsAdded: Array.isArray(backupData.shifts) ? backupData.shifts.length : 0,
          countersAdded: Array.isArray(backupData.counters) ? backupData.counters.length : 0,
          employeesAdded: Array.isArray(backupData.employees) ? backupData.employees.length : 0,
          weeksAdded: backupData.weeklySchedules ? Object.keys(backupData.weeklySchedules).length : 0,
          totalAssignmentsCount: Object.keys(allAssignments).length,
        };
      }

      // MODE: MERGE (Bổ sung dữ liệu)
      const strategy = options.assignmentStrategy || 'smart_combine';
      let shiftsAdded = 0;
      let countersAdded = 0;
      let employeesAdded = 0;
      let weeksAdded = 0;

      // 1. Merge Shifts
      if (Array.isArray(backupData.shifts)) {
        const currentShifts = this.getShifts() || [];
        const shiftKeys = new Set(currentShifts.map((s) => s.id || s.code));
        const newShifts = [...currentShifts];
        for (const s of backupData.shifts) {
          const key = s.id || s.code;
          if (key && !shiftKeys.has(key)) {
            newShifts.push(s);
            shiftKeys.add(key);
            shiftsAdded++;
          }
        }
        if (shiftsAdded > 0) {
          setToStorage(STORAGE_KEYS.SHIFTS, newShifts);
        }
      }

      // 2. Merge Counters
      if (Array.isArray(backupData.counters)) {
        const currentCounters = this.getCounters() || [];
        const counterKeys = new Set(currentCounters.map((c) => c.id || c.counterNumber));
        const newCounters = [...currentCounters];
        for (const c of backupData.counters) {
          const key = c.id || c.counterNumber;
          if (key && !counterKeys.has(key)) {
            newCounters.push(c);
            counterKeys.add(key);
            countersAdded++;
          }
        }
        if (countersAdded > 0) {
          setToStorage(STORAGE_KEYS.COUNTERS, newCounters);
        }
      }

      // 3. Merge Employees
      if (Array.isArray(backupData.employees)) {
        const currentEmployees = this.getEmployees() || [];
        const empKeys = new Set(currentEmployees.map((e) => e.id || e.code || e.fullName));
        const newEmployees = [...currentEmployees];
        for (const e of backupData.employees) {
          const key = e.id || e.code || e.fullName;
          if (key && !empKeys.has(key)) {
            newEmployees.push(e);
            empKeys.add(key);
            employeesAdded++;
          }
        }
        if (employeesAdded > 0) {
          setToStorage(STORAGE_KEYS.EMPLOYEES, newEmployees);
        }
      }

      // 4. Merge Weekly Schedules
      if (backupData.weeklySchedules && typeof backupData.weeklySchedules === 'object') {
        const currentSchedules = this.getAllWeeklySchedules() || {};
        const mergedSchedules = { ...currentSchedules };
        for (const [weekMonday, entries] of Object.entries(backupData.weeklySchedules)) {
          if (!mergedSchedules[weekMonday]) {
            mergedSchedules[weekMonday] = entries as WeeklyScheduleEntry[];
            weeksAdded++;
          } else if (Array.isArray(entries)) {
            const existing = mergedSchedules[weekMonday] || [];
            const keyMap = new Map<string, WeeklyScheduleEntry>();
            existing.forEach((entry) => {
              const k = `${entry.employeeId || entry.employeeName}_${entry.dayOfWeek}`;
              keyMap.set(k, entry);
            });
            entries.forEach((entry) => {
              const k = `${entry.employeeId || entry.employeeName}_${entry.dayOfWeek}`;
              if (!keyMap.has(k)) {
                keyMap.set(k, entry);
              }
            });
            mergedSchedules[weekMonday] = Array.from(keyMap.values());
          }
        }
        setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, mergedSchedules);
      }

      // 5. Merge Assignments
      const addedDates: string[] = [];
      const mergedDates: string[] = [];
      const updatedDates: string[] = [];
      const skippedDates: string[] = [];

      if (backupData.assignments && typeof backupData.assignments === 'object') {
        for (const [date, backupDay] of Object.entries(backupData.assignments)) {
          if (!backupDay || typeof backupDay !== 'object') continue;

          const currentDay = this.getAssignment(date);
          const key = `${STORAGE_KEYS.ASSIGNMENTS_PREFIX}${date}`;

          if (!currentDay) {
            setToStorage(key, backupDay);
            addedDates.push(date);
          } else {
            if (strategy === 'prefer_current') {
              skippedDates.push(date);
            } else if (strategy === 'prefer_backup') {
              setToStorage(key, backupDay);
              updatedDates.push(date);
            } else if (strategy === 'prefer_more_complete') {
              const cCount = countAssignedSlots(currentDay);
              const bCount = countAssignedSlots(backupDay as DayDwsAssignment);
              if (bCount > cCount) {
                const combined = smartCombineDay(currentDay, backupDay as DayDwsAssignment, 'backup_priority');
                setToStorage(key, combined);
                mergedDates.push(date);
              } else {
                const combined = smartCombineDay(currentDay, backupDay as DayDwsAssignment, 'current_priority');
                setToStorage(key, combined);
                mergedDates.push(date);
              }
            } else {
              // 'smart_combine' (Default)
              const combined = smartCombineDay(currentDay, backupDay as DayDwsAssignment, 'smart');
              setToStorage(key, combined);
              mergedDates.push(date);
            }
          }
        }
      }

      // 6. Merge History
      if (Array.isArray(backupData.history) && backupData.history.length > 0) {
        const currentHistory = this.getHistory() || [];
        const histIds = new Set(currentHistory.map((h) => h.id || `${h.date}_${h.timestamp}`));
        const newHistory = [...currentHistory];
        for (const h of backupData.history) {
          const k = h.id || `${h.date}_${h.timestamp}`;
          if (!histIds.has(k)) {
            newHistory.push(h);
            histIds.add(k);
          }
        }
        setToStorage(STORAGE_KEYS.HISTORY, newHistory.slice(0, 100));
      }

      this.notifyChange('all');

      const allAssignmentsNow = this.getAllAssignments();
      return {
        success: true,
        mode: 'merge',
        addedDates,
        mergedDates,
        updatedDates,
        skippedDates,
        shiftsAdded,
        countersAdded,
        employeesAdded,
        weeksAdded,
        totalAssignmentsCount: Object.keys(allAssignmentsNow).length,
      };
    } catch (err: any) {
      console.error('Error merging backup data:', err);
      return {
        success: false,
        mode: options.mode,
        addedDates: [],
        mergedDates: [],
        updatedDates: [],
        skippedDates: [],
        shiftsAdded: 0,
        countersAdded: 0,
        employeesAdded: 0,
        weeksAdded: 0,
        totalAssignmentsCount: 0,
        error: err?.message || 'Lỗi khi bổ sung dữ liệu sao lưu.',
      };
    }
  },
  mergeMultipleBackupData(filesData: any[], options: MergeBackupOptions = { mode: 'merge' }): BackupMergeResult {
    let combinedResult: BackupMergeResult = {
      success: true,
      mode: options.mode,
      addedDates: [],
      mergedDates: [],
      updatedDates: [],
      skippedDates: [],
      shiftsAdded: 0,
      countersAdded: 0,
      employeesAdded: 0,
      weeksAdded: 0,
      totalAssignmentsCount: 0,
    };

    for (let i = 0; i < filesData.length; i++) {
      const data = filesData[i];
      const currentMode = i === 0 ? options.mode : 'merge';
      const res = this.mergeBackupData(data, { ...options, mode: currentMode });
      if (!res.success) {
        return res;
      }
      combinedResult.addedDates.push(...res.addedDates);
      combinedResult.mergedDates.push(...res.mergedDates);
      combinedResult.updatedDates.push(...res.updatedDates);
      combinedResult.skippedDates.push(...res.skippedDates);
      combinedResult.shiftsAdded += res.shiftsAdded;
      combinedResult.countersAdded += res.countersAdded;
      combinedResult.employeesAdded += res.employeesAdded;
      combinedResult.weeksAdded += res.weeksAdded;
      combinedResult.totalAssignmentsCount = res.totalAssignmentsCount;
    }

    combinedResult.addedDates = Array.from(new Set(combinedResult.addedDates));
    combinedResult.mergedDates = Array.from(new Set(combinedResult.mergedDates));
    combinedResult.updatedDates = Array.from(new Set(combinedResult.updatedDates));
    combinedResult.skippedDates = Array.from(new Set(combinedResult.skippedDates));

    return combinedResult;
  },
  resetAll(): void {
    localStorage.clear();
    // Explicitly record empty catalogs so getShifts() & getCounters() do not resurrect default items
    setToStorage(STORAGE_KEYS.SHIFTS, []);
    setToStorage(STORAGE_KEYS.SHIFTS_META, {
      updatedAt: new Date().toISOString(),
      fileName: null,
      count: 0,
    });
    setToStorage(STORAGE_KEYS.COUNTERS, []);
    setToStorage(STORAGE_KEYS.COUNTERS_META, {
      updatedAt: new Date().toISOString(),
      fileName: null,
      count: 0,
    });
    setToStorage(STORAGE_KEYS.EMPLOYEES, []);
    setToStorage(STORAGE_KEYS.EMPLOYEES_META, {
      updatedAt: new Date().toISOString(),
      fileName: null,
      count: 0,
    });
    setToStorage(STORAGE_KEYS.WEEKLY_SCHEDULES, {});
    setToStorage(STORAGE_KEYS.HISTORY, []);
    this.notifyChange('all');
  },
  restoreDefaultSampleData(): void {
    this.saveShifts(DEFAULT_SHIFTS, 'Mẫu mặc định AEON');
    this.saveCounters(DEFAULT_COUNTERS, 'Mẫu mặc định AEON');
    this.notifyChange('all');
  },

  // === SHIFT SWAP REQUESTS (ĐỔI CA / ĐỀ NGHỊ NHƯỢNG CA) ===
  getSwapRequests(weekId?: string): ShiftSwapRequest[] {
    const all = getFromStorage<ShiftSwapRequest[]>(STORAGE_KEYS.SWAP_REQUESTS, []);
    if (!weekId) return all;
    return all.filter((r) => r.weekId === weekId || r.date.startsWith(weekId.slice(0, 7)));
  },

  getPendingSwapRequests(weekId?: string): ShiftSwapRequest[] {
    const all = this.getSwapRequests(weekId);
    return all.filter((r) => r.status === 'pending');
  },

  getSwapRequestById(id: string): ShiftSwapRequest | null {
    const all = this.getSwapRequests();
    return all.find((r) => r.id === id) || null;
  },

  saveSwapRequest(req: ShiftSwapRequest): void {
    const all = this.getSwapRequests();
    const existingIndex = all.findIndex((r) => r.id === req.id);
    if (existingIndex >= 0) {
      all[existingIndex] = req;
    } else {
      all.unshift(req);
    }
    setToStorage(STORAGE_KEYS.SWAP_REQUESTS, all);
    this.notifyChange('swap_requests');
  },

  updateSwapRequestStatus(
    id: string,
    status: ShiftSwapRequest['status'],
    details?: Partial<ShiftSwapRequest>
  ): void {
    const all = this.getSwapRequests();
    const target = all.find((r) => r.id === id);
    if (target) {
      target.status = status;
      target.resolvedAt = new Date().toISOString();
      if (details) {
        Object.assign(target, details);
      }
      setToStorage(STORAGE_KEYS.SWAP_REQUESTS, all);
      this.notifyChange('swap_requests');
    }
  },

  deleteSwapRequest(id: string): void {
    const all = this.getSwapRequests().filter((r) => r.id !== id);
    setToStorage(STORAGE_KEYS.SWAP_REQUESTS, all);
    this.notifyChange('swap_requests');
  },

  cancelSwapRequestForSlot(date: string, counterId: string, slot: 'morning' | 'afternoon'): void {
    const all = this.getSwapRequests();
    let changed = false;
    all.forEach((r) => {
      if (r.date === date && r.counterId === counterId && r.slot === slot && r.status === 'pending') {
        r.status = 'cancelled';
        r.resolvedAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) {
      setToStorage(STORAGE_KEYS.SWAP_REQUESTS, all);
      this.notifyChange('swap_requests');
    }
  },

  isSlotSwapRequested(
    date: string,
    counterId: string,
    slot: 'morning' | 'afternoon'
  ): ShiftSwapRequest | null {
    const all = this.getSwapRequests();
    return (
      all.find(
        (r) =>
          r.date === date &&
          r.counterId === counterId &&
          r.slot === slot &&
          r.status === 'pending'
      ) || null
    );
  },

  // Event listener for reactivity
  listeners: new Set<(topic: string) => void>(),
  subscribe(callback: (topic: string) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  notifyChange(topic: string) {
    if (topic !== 'cloud_sync') {
      try {
        localStorage.setItem('aeon_dws_local_data_updated_at', new Date().toISOString());
      } catch {
        // ignore
      }
    }
    this.listeners.forEach((cb) => {
      try {
        cb(topic);
      } catch (e) {
        console.error('Error notifying storage listener:', e);
      }
    });
  },
  getLocalDataUpdatedAt(): string | null {
    return localStorage.getItem('aeon_dws_local_data_updated_at');
  },
  setLocalDataUpdatedAt(iso: string): void {
    localStorage.setItem('aeon_dws_local_data_updated_at', iso);
  },
};
