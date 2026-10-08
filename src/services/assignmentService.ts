import {
  Shift,
  Counter,
  Employee,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  UnassignedEmployee,
  ValidationIssue,
  CounterDayAssignment,
  SlotAssignment,
  AssignmentRuleConfig,
  AutoAssignOptions,
  FixedCounterRule,
  ShiftCounterPriorityRule,
  MissingScheduleEmployee,
} from '../types';
import { DEFAULT_ASSIGNMENT_RULES, storageService } from './storageService';
import { isOffShift } from './excelService';
import {
  getCounterZone,
  isEmployeeCapableForZone,
  getEmployeeRecentCounters,
  checkZoneStreakWarning,
  findEmployeeRecord,
} from './zoneTrackingService';
import {
  checkConsecutiveTwoDayWarning,
  validateConsecutiveTwoDayRulesForDay,
} from './consecutiveWarningService';

// Helper: Match a string specification (e.g. "21", "SSC", "104") to a Counter
export function findMatchingCounters(counters: Counter[], spec: string): Counter[] {
  const cleanSpec = String(spec || '').trim().toLowerCase();
  if (!cleanSpec) return [];

  // 1. If looking for SSC
  if (cleanSpec === 'ssc' || cleanSpec.includes('ssc')) {
    const sscList = counters.filter(
      (c) =>
        c.counterNumber.toLowerCase().includes('ssc') ||
        c.area.toLowerCase().includes('ssc') ||
        c.id.toLowerCase().includes('ssc') ||
        c.counterNumber.toLowerCase().includes('tự phục vụ')
    );
    if (sscList.length > 0) return sscList;
  }

  // 2. Exact match on id or counterNumber
  const exact = counters.filter(
    (c) =>
      c.id.toLowerCase() === cleanSpec ||
      c.counterNumber.toLowerCase() === cleanSpec ||
      c.counterNumber.toLowerCase() === `quầy ${cleanSpec}`
  );
  if (exact.length > 0) return exact;

  // 3. Numeric / alphanumeric match (e.g. "21" matching "Quầy 21" or "21A")
  const normSpec = cleanSpec.replace(/[^a-z0-9]/g, '');
  const partial = counters.filter((c) => {
    const normNum = c.counterNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normId = c.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normNum === normSpec || normId === normSpec || normNum.startsWith(normSpec);
  });
  if (partial.length > 0) return partial;

  // 4. Substring inclusion
  return counters.filter(
    (c) =>
      c.counterNumber.toLowerCase().includes(cleanSpec) ||
      c.area.toLowerCase().includes(cleanSpec)
  );
}

export const V815_MORNING_COUNTERS = ['SSC', '17', '21', '23', '104', '105', '106', '110', '111', '114'];
export const V818_MORNING_COUNTERS = ['13', '15', '20', '22', '24', '25', '102'];
export const V820_MORNING_COUNTERS = ['11', '26', '27', '103', '112', '108', '109'];

export function isCounterMatchingSpec(counterNumberOrId: string, spec: string): boolean {
  const c = String(counterNumberOrId || '').toLowerCase().trim();
  const s = String(spec || '').toLowerCase().trim();
  if (s === 'ssc') {
    return c.includes('ssc');
  }
  if (c === s || c === `quầy ${s}` || c === `q.${s}` || c === `q${s}`) return true;
  
  const digitsOnly = c.replace(/\D/g, '');
  const specDigits = s.replace(/\D/g, '');
  if (digitsOnly && specDigits && digitsOnly === specDigits) return true;
  
  return false;
}

export function getCounterMorningRequiredShift(counter: Counter | string): 'V815' | 'V818' | 'V820' | null {
  const cNum = typeof counter === 'string' ? counter : (counter.counterNumber || counter.id || '');
  const cId = typeof counter === 'string' ? counter : (counter.id || '');

  if (V815_MORNING_COUNTERS.some((spec) => isCounterMatchingSpec(cNum, spec) || isCounterMatchingSpec(cId, spec))) {
    return 'V815';
  }
  if (V818_MORNING_COUNTERS.some((spec) => isCounterMatchingSpec(cNum, spec) || isCounterMatchingSpec(cId, spec))) {
    return 'V818';
  }
  if (V820_MORNING_COUNTERS.some((spec) => isCounterMatchingSpec(cNum, spec) || isCounterMatchingSpec(cId, spec))) {
    return 'V820';
  }
  return null;
}

export function isShiftMatchingMorningGroup(shiftCode: string, requiredGroup: 'V815' | 'V818' | 'V820'): boolean {
  const code = (shiftCode || '').toUpperCase().trim();
  if (requiredGroup === 'V815') {
    return (
      code.startsWith('V815') ||
      code === '815' ||
      code === 'S1' ||
      code === 'S815' ||
      code.startsWith('V814') ||
      code.startsWith('V615') ||
      code === '615'
    );
  }
  if (requiredGroup === 'V818') {
    return (
      code.startsWith('V818') ||
      code === '818' ||
      code === 'G818' ||
      code.startsWith('V618') ||
      code === '618'
    );
  }
  if (requiredGroup === 'V820') {
    return (
      code.startsWith('V820') ||
      code === '820' ||
      code.startsWith('V822') ||
      code === '822' ||
      code.startsWith('C820') ||
      code.startsWith('C822') ||
      code.startsWith('V1322') ||
      code.startsWith('V1422')
    );
  }
  return false;
}

export const assignmentService = {
  // Extract working & off stats for a specific day
  getDayStats(
    date: string,
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[],
    currentAssignment: DayDwsAssignment | null
  ) {
    const shiftMap = new Map<string, Shift>();
    shifts.forEach((s) => shiftMap.set(s.shiftCode.toUpperCase(), s));

    const dayEntries = weeklySchedule.filter((e) => e.date === date);

    let workingCount = 0;
    let offCount = 0;
    const workingEmployees: { entry: WeeklyScheduleEntry; shift: Shift | null }[] = [];
    const offEmployees: { entry: WeeklyScheduleEntry; shift: Shift | null }[] = [];

    dayEntries.forEach((entry) => {
      const shift = shiftMap.get(entry.shiftCode.toUpperCase()) || null;
      const isOff = shift
        ? shift.isOff || shift.category === 'off' || isOffShift(shift.shiftCode, shift.shiftType, shift.startTime, shift.endTime)
        : isOffShift(entry.shiftCode, '');

      if (isOff) {
        offCount++;
        offEmployees.push({ entry, shift });
      } else {
        const isExcluded = storageService.isEmployeeExcluded(entry.employeeName, entry.employeeId);
        if (!isExcluded) {
          workingCount++;
          workingEmployees.push({ entry, shift });
        }
      }
    });

    // Count assigned vs unassigned
    let assignedCount = 0;
    const assignedEmployeeNames = new Set<string>();

    if (currentAssignment && currentAssignment.assignments) {
      Object.values(currentAssignment.assignments).forEach((ca) => {
        if (ca.morning) {
          assignedCount++;
          assignedEmployeeNames.add((ca.morning.employeeId || ca.morning.employeeName).toLowerCase());
        }
        if (ca.morning2) {
          assignedCount++;
          assignedEmployeeNames.add((ca.morning2.employeeId || ca.morning2.employeeName).toLowerCase());
        }
        if (ca.afternoon) {
          assignedCount++;
          assignedEmployeeNames.add((ca.afternoon.employeeId || ca.afternoon.employeeName).toLowerCase());
        }
        if (ca.afternoon2) {
          assignedCount++;
          assignedEmployeeNames.add((ca.afternoon2.employeeId || ca.afternoon2.employeeName).toLowerCase());
        }
      });
    }

    const unassignedCount = Math.max(0, workingCount - assignedCount);

    return {
      total: dayEntries.length,
      workingCount,
      offCount,
      assignedCount,
      unassignedCount,
      workingEmployees,
      offEmployees,
    };
  },

  // Get list of unassigned employees for a date - sorted from earliest shift to latest shift
  getUnassignedEmployees(
    date: string,
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[],
    currentAssignment: DayDwsAssignment | null,
    options?: { includeExcluded?: boolean }
  ): UnassignedEmployee[] {
    const shiftMap = new Map<string, Shift>();
    shifts.forEach((s) => shiftMap.set(s.shiftCode.toUpperCase(), s));

    const dayEntries = weeklySchedule.filter((e) => e.date === date);

    // Collect already assigned keys
    const assignedKeys = new Set<string>();
    if (currentAssignment && currentAssignment.assignments) {
      Object.values(currentAssignment.assignments).forEach((ca) => {
        if (ca.morning) {
          const key = (ca.morning.employeeId || ca.morning.employeeName).toLowerCase().trim();
          assignedKeys.add(key);
        }
        if (ca.morning2) {
          const key = (ca.morning2.employeeId || ca.morning2.employeeName).toLowerCase().trim();
          assignedKeys.add(key);
        }
        if (ca.afternoon) {
          const key = (ca.afternoon.employeeId || ca.afternoon.employeeName).toLowerCase().trim();
          assignedKeys.add(key);
        }
        if (ca.afternoon2) {
          const key = (ca.afternoon2.employeeId || ca.afternoon2.employeeName).toLowerCase().trim();
          assignedKeys.add(key);
        }
      });
    }

    const unassigned: UnassignedEmployee[] = [];

    dayEntries.forEach((entry) => {
      const shift = shiftMap.get(entry.shiftCode.toUpperCase()) || null;
      const isOff = shift
        ? shift.isOff || shift.category === 'off' || isOffShift(shift.shiftCode, shift.shiftType, shift.startTime, shift.endTime)
        : isOffShift(entry.shiftCode, '');

      // Strictly skip OFF shifts
      if (isOff) return;

      const key = (entry.employeeId || entry.employeeName).toLowerCase().trim();
      if (assignedKeys.has(key)) return;

      // Check if employee is excluded from counter assignments ("Không phân quầy")
      const isExcluded = storageService.isEmployeeExcluded(entry.employeeName, entry.employeeId);
      if (isExcluded && !options?.includeExcluded) {
        return; // Exclude from unassigned list
      }

      const category = shift
        ? shift.category || (shift.startTime && shift.startTime < '12:00' ? 'morning' : 'afternoon')
        : 'other';

      // Look up employee capabilities and SUP status
      const empRecord = findEmployeeRecord(entry.employeeName, entry.employeeId);
      const isMissingFromCatalog = !empRecord;
      const isResigned = !!empRecord?.isResigned;
      const exclusionNote = isResigned ? 'Nghỉ việc' : storageService.getEmployeeExclusionNote(entry.employeeName, entry.employeeId);

      unassigned.push({
        employeeId: entry.employeeId,
        fullName: entry.employeeName,
        shiftCode: entry.shiftCode,
        shiftType: shift?.shiftType || 'Ca thường',
        startTime: shift?.startTime || '',
        endTime: shift?.endTime || '',
        category,
        isSup: empRecord?.isSup,
        canSieuThi: empRecord?.canSieuThi ?? true,
        canBanhMy: empRecord?.canBanhMy ?? false,
        canDelica: empRecord?.canDelica ?? false,
        isResigned,
        exclusionNote,
        isMissingFromCatalog,
        isExcludedFromAssignment: isExcluded || isResigned,
      });
    });

    // Sort unassigned employees strictly by shift start time (earliest to latest), then shift code, then full name
    unassigned.sort((a, b) => {
      const timeA = a.startTime || '99:99';
      const timeB = b.startTime || '99:99';
      if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }
      if (a.shiftCode !== b.shiftCode) {
        return a.shiftCode.localeCompare(b.shiftCode);
      }
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

    return unassigned;
  },

  // Get employees who have shifts scheduled but are missing from the employee catalog
  getMissingEmployeesInSchedule(
    weeklySchedule: WeeklyScheduleEntry[],
    employees: Employee[],
    options?: { weekId?: string; date?: string }
  ): MissingScheduleEmployee[] {
    let entries = weeklySchedule;
    if (options?.date) {
      entries = entries.filter((e) => e.date === options.date);
    } else if (options?.weekId) {
      entries = entries.filter((e) => e.weekId === options.weekId || e.date?.startsWith(options.weekId));
    }

    const missingMap = new Map<string, MissingScheduleEmployee>();

    entries.forEach((e) => {
      if (isOffShift(e.shiftCode, '')) return;

      const empRecord = findEmployeeRecord(e.employeeName, e.employeeId, employees);
      if (!empRecord) {
        const key = (e.employeeId || e.employeeName).toLowerCase().trim();
        const existing = missingMap.get(key);
        const isExcluded = storageService.isEmployeeExcluded(e.employeeName, e.employeeId);
        if (existing) {
          if (e.date && !existing.dates.includes(e.date)) existing.dates.push(e.date);
          if (e.shiftCode && !existing.shiftCodes.includes(e.shiftCode)) existing.shiftCodes.push(e.shiftCode);
        } else {
          missingMap.set(key, {
            employeeName: e.employeeName,
            employeeId: e.employeeId,
            dates: e.date ? [e.date] : [],
            shiftCodes: e.shiftCode ? [e.shiftCode] : [],
            isExcluded,
          });
        }
      }
    });

    return Array.from(missingMap.values());
  },

  // Get list of employees scheduled for a date who are marked "Không phân quầy"
  getExcludedEmployeesForDay(
    date: string,
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[]
  ): UnassignedEmployee[] {
    const shiftMap = new Map<string, Shift>();
    shifts.forEach((s) => shiftMap.set(s.shiftCode.toUpperCase(), s));

    const dayEntries = weeklySchedule.filter((e) => e.date === date);
    const excludedList: UnassignedEmployee[] = [];

    dayEntries.forEach((entry) => {
      const isOff = isOffShift(entry.shiftCode, '');
      if (isOff) return;

      const isExcluded = storageService.isEmployeeExcluded(entry.employeeName, entry.employeeId);
      if (!isExcluded) return;

      const shift = shiftMap.get(entry.shiftCode.toUpperCase()) || null;
      const category = shift
        ? shift.category || (shift.startTime && shift.startTime < '12:00' ? 'morning' : 'afternoon')
        : 'other';

      const empRecord = findEmployeeRecord(entry.employeeName, entry.employeeId);
      const isResigned = !!empRecord?.isResigned;
      const exclusionNote = isResigned
        ? 'Nghỉ việc'
        : storageService.getEmployeeExclusionNote(entry.employeeName, entry.employeeId);

      excludedList.push({
        employeeId: entry.employeeId,
        fullName: entry.employeeName,
        shiftCode: entry.shiftCode,
        shiftType: shift?.shiftType || 'Ca thường',
        startTime: shift?.startTime || '',
        endTime: shift?.endTime || '',
        category,
        isSup: empRecord?.isSup,
        canSieuThi: empRecord?.canSieuThi ?? true,
        canBanhMy: empRecord?.canBanhMy ?? false,
        canDelica: empRecord?.canDelica ?? false,
        isResigned,
        exclusionNote,
        isMissingFromCatalog: !empRecord,
        isExcludedFromAssignment: true,
      });
    });

    return excludedList;
  },

  // Validate entire assignment for the day
  validateDayAssignment(
    date: string,
    assignment: DayDwsAssignment | null,
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[],
    counters: Counter[],
    employees: Employee[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!assignment || !assignment.assignments) return issues;

    const shiftMap = new Map<string, Shift>();
    shifts.forEach((s) => shiftMap.set(s.shiftCode.toUpperCase(), s));

    const counterMap = new Map<string, Counter>();
    counters.forEach((c) => counterMap.set(c.id, c));

    const employeeMap = new Map<string, Employee>();
    employees.forEach((e) => employeeMap.set(e.employeeId.toUpperCase(), e));

    const dayScheduleMap = new Map<string, WeeklyScheduleEntry>();
    weeklySchedule
      .filter((e) => e.date === date)
      .forEach((e) => {
        if (e.employeeId) dayScheduleMap.set(e.employeeId.toUpperCase(), e);
        dayScheduleMap.set(e.employeeName.toLowerCase().trim(), e);
      });

    // Track employee appearances to detect duplicates
    const employeeUsage = new Map<string, { counterId: string; slot: 'morning' | 'afternoon'; name: string }[]>();

    Object.entries(assignment.assignments).forEach(([counterId, ca]) => {
      // Check if counter exists
      if (counters.length > 0 && !counterMap.has(counterId)) {
        issues.push({
          type: 'warning',
          counterId,
          message: `Quầy "${counterId}" không tồn tại trong danh mục quầy hiện tại.`,
        });
      }

      // Check morning slot
      if (ca.morning) {
        const emp = ca.morning;
        const key = (emp.employeeId || emp.employeeName || '').toLowerCase().trim();
        const usageList = employeeUsage.get(key) || [];
        usageList.push({ counterId, slot: 'morning', name: emp.employeeName });
        employeeUsage.set(key, usageList);

        // Check if employee has schedule today
        const sched = (emp.employeeId && dayScheduleMap.get(emp.employeeId.toUpperCase())) || dayScheduleMap.get(emp.employeeName.toLowerCase().trim());
        if (!sched && weeklySchedule.length > 0) {
          issues.push({
            type: 'error',
            counterId,
            employeeName: emp.employeeName,
            message: `Nhân viên "${emp.employeeName}" (Ca Sáng, Quầy ${counterId}) không có lịch làm việc ngày ${date}.`,
          });
        } else if (sched) {
          const shift = shiftMap.get(sched.shiftCode.toUpperCase());
          if (shift && shift.isOff) {
            issues.push({
              type: 'error',
              counterId,
              employeeName: emp.employeeName,
              message: `Nhân viên "${emp.employeeName}" có lịch Nghỉ (${sched.shiftCode}) nhưng lại được phân vào Quầy ${counterId}.`,
            });
          }
        }
      }

      // Check afternoon slot
      if (ca.afternoon) {
        const emp = ca.afternoon;
        const key = (emp.employeeId || emp.employeeName).toLowerCase().trim();
        const usageList = employeeUsage.get(key) || [];
        usageList.push({ counterId, slot: 'afternoon', name: emp.employeeName });
        employeeUsage.set(key, usageList);

        // Check if employee has schedule today
        const sched = (emp.employeeId && dayScheduleMap.get(emp.employeeId.toUpperCase())) || dayScheduleMap.get(emp.employeeName.toLowerCase().trim());
        if (!sched && weeklySchedule.length > 0) {
          issues.push({
            type: 'error',
            counterId,
            employeeName: emp.employeeName,
            message: `Nhân viên "${emp.employeeName}" (Ca Chiều, Quầy ${counterId}) không có lịch làm việc ngày ${date}.`,
          });
        } else if (sched) {
          const shift = shiftMap.get(sched.shiftCode.toUpperCase());
          if (shift && shift.isOff) {
            issues.push({
              type: 'error',
              counterId,
              employeeName: emp.employeeName,
              message: `Nhân viên "${emp.employeeName}" có lịch Nghỉ (${sched.shiftCode}) nhưng lại được phân vào Quầy ${counterId}.`,
            });
          }
        }
      }
    });

    // Check duplicate employee assignment
    employeeUsage.forEach((usages, key) => {
      // If assigned more than once to morning slot OR more than once to afternoon slot
      const morningUsages = usages.filter((u) => u.slot === 'morning');
      const afternoonUsages = usages.filter((u) => u.slot === 'afternoon');

      if (morningUsages.length > 1) {
        issues.push({
          type: 'error',
          employeeName: morningUsages[0].name,
          message: `Nhân viên "${morningUsages[0].name}" bị phân trùng Ca Sáng ở nhiều quầy: ${morningUsages.map((u) => u.counterId).join(', ')}.`,
        });
      }
      if (afternoonUsages.length > 1) {
        issues.push({
          type: 'error',
          employeeName: afternoonUsages[0].name,
          message: `Nhân viên "${afternoonUsages[0].name}" bị phân trùng Ca Chiều ở nhiều quầy: ${afternoonUsages.map((u) => u.counterId).join(', ')}.`,
        });
      }
    });

    // Check 2-day consecutive counter and monitored cluster (SSC-17, 20-27, 101-106 & 306, 109-117)
    const consecutiveWarnings = validateConsecutiveTwoDayRulesForDay(date, assignment, counters);
    consecutiveWarnings.forEach((w) => {
      issues.push({
        type: 'warning',
        counterId: w.targetCounterId,
        employeeName: w.employeeName,
        employeeId: w.employeeId,
        message: w.message,
      });
    });

    return issues;
  },

  // Helper to sort counters based on rules (Priority, SSC preference, Area balancing)
  getSortedCountersWithRules(
    counters: Counter[],
    options?: Partial<AutoAssignOptions>,
    rules?: AssignmentRuleConfig
  ): Counter[] {
    const config = rules || DEFAULT_ASSIGNMENT_RULES;
    let list = [...counters];

    // 1. If counterPriorityOrder is given and active
    const applyPriority = options?.applyCounterPriority ?? true;
    if (applyPriority && config.counterPriorityOrder && config.counterPriorityOrder.length > 0) {
      const priorityMap = new Map<string, number>();
      config.counterPriorityOrder.forEach((id, idx) => priorityMap.set(id, idx));

      list.sort((a, b) => {
        const aPri = priorityMap.has(a.id) ? priorityMap.get(a.id)! : 9999;
        const bPri = priorityMap.has(b.id) ? priorityMap.get(b.id)! : 9999;
        if (aPri !== bPri) return aPri - bPri;
        return (a.order || 0) - (b.order || 0);
      });
    } else if (config.prioritizeSscCounters) {
      // Prioritize SSC counters first
      list.sort((a, b) => {
        const aIsSsc = (a.counterNumber + ' ' + a.area).toLowerCase().includes('ssc');
        const bIsSsc = (b.counterNumber + ' ' + b.area).toLowerCase().includes('ssc');
        if (aIsSsc && !bIsSsc) return -1;
        if (!aIsSsc && bIsSsc) return 1;
        return (a.order || 0) - (b.order || 0);
      });
    } else {
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // 2. Area balancing (Round-robin interleaving across areas)
    const applyAreaBalancing = options?.applyAreaBalancing ?? config.balanceAreas;
    if (applyAreaBalancing) {
      const areaGroups: Record<string, Counter[]> = {};
      list.forEach((c) => {
        const area = c.area || 'Mặc định';
        if (!areaGroups[area]) areaGroups[area] = [];
        areaGroups[area].push(c);
      });

      const areaKeys = Object.keys(areaGroups);
      const interleaved: Counter[] = [];
      let hasMore = true;
      let depth = 0;

      while (hasMore) {
        hasMore = false;
        for (const area of areaKeys) {
          if (depth < areaGroups[area].length) {
            interleaved.push(areaGroups[area][depth]);
            hasMore = true;
          }
        }
        depth++;
      }
      return interleaved;
    }

    return list;
  },

  // Auto assign unassigned employees to empty counter slots with Smart Rules
  autoAssign(
    counters: Counter[],
    unassigned: UnassignedEmployee[],
    currentAssignment: DayDwsAssignment,
    options?: Partial<AutoAssignOptions>,
    rules?: AssignmentRuleConfig
  ): {
    updatedAssignment: DayDwsAssignment;
    assignedCount: number;
    fixedRulesCount: number;
    morningAssigned: number;
    afternoonAssigned: number;
    unassignedRemaining: number;
  } {
    const config = rules || DEFAULT_ASSIGNMENT_RULES;
    const mode = options?.mode || 'fill_empty';
    const applyFixedRules = options?.applyFixedRules ?? true;

    // Start with clean or existing assignments
    const newAssignments: Record<string, CounterDayAssignment> =
      mode === 'overwrite_all'
        ? {}
        : JSON.parse(JSON.stringify(currentAssignment.assignments || {}));

    // Initialize all counters in map if not present
    counters.forEach((c) => {
      if (!newAssignments[c.id]) {
        newAssignments[c.id] = { counterId: c.id };
      }
    });

    // Create mutable pool of unassigned candidates (strictly excluding "Không phân quầy")
    let remainingPool = unassigned.filter(
      (e) => !e.isExcludedFromAssignment && !storageService.isEmployeeExcluded(e.fullName, e.employeeId)
    );
    let count = 0;
    let fixedRulesCount = 0;
    let morningAssigned = 0;
    let afternoonAssigned = 0;

    const dayOfWeek = currentAssignment.dayOfWeek || (new Date(currentAssignment.date).getDay() || 7);

    // === 1. APPLY FIXED RULES FIRST ===
    if (applyFixedRules && config.fixedRules && config.fixedRules.length > 0) {
      const activeFixedRules = config.fixedRules.filter(
        (r) => r.active && (r.dayOfWeek === 0 || r.dayOfWeek === dayOfWeek)
      );

      for (const rule of activeFixedRules) {
        // Find matching employee in candidate pool
        const empIdx = remainingPool.findIndex((emp) => {
          if (rule.employeeId && emp.employeeId) {
            return emp.employeeId.toLowerCase() === rule.employeeId.toLowerCase();
          }
          return emp.fullName.toLowerCase().trim() === rule.employeeName.toLowerCase().trim();
        });

        if (empIdx === -1) continue;

        const emp = remainingPool[empIdx];
        const counterTarget = counters.find((c) => c.id === rule.counterId);
        if (!counterTarget) continue;

        const ca = newAssignments[counterTarget.id];
        if (!ca) continue;

        const isMorningCandidate =
          emp.category === 'morning' || (emp.category === 'other' && (!emp.startTime || emp.startTime < '12:30'));
        const isAfternoonCandidate =
          emp.category === 'afternoon' || (emp.category === 'other' && emp.startTime >= '12:30');

        let assignedToSlot = false;

        // Try Morning slot if matching
        if (
          (rule.slot === 'morning' || rule.slot === 'both' || !rule.slot) &&
          isMorningCandidate &&
          (!ca.morning || mode === 'overwrite_all')
        ) {
          ca.morning = {
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            shiftCode: emp.shiftCode,
            startTime: emp.startTime,
            endTime: emp.endTime,
            assignedAt: new Date().toISOString(),
          };
          assignedToSlot = true;
          morningAssigned++;
        } else if (
          (rule.slot === 'afternoon' || rule.slot === 'both' || !rule.slot) &&
          isAfternoonCandidate &&
          (!ca.afternoon || mode === 'overwrite_all')
        ) {
          // Try Afternoon slot if matching
          ca.afternoon = {
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            shiftCode: emp.shiftCode,
            startTime: emp.startTime,
            endTime: emp.endTime,
            assignedAt: new Date().toISOString(),
          };
          assignedToSlot = true;
          afternoonAssigned++;
        }

        if (assignedToSlot) {
          remainingPool.splice(empIdx, 1);
          count++;
          fixedRulesCount++;
        }
      }
    }

    // === 2. SORT CANDIDATES (MORNING: EARLIEST FIRST; AFTERNOON: V6* BEFORE V8*) ===
    remainingPool.sort((a, b) => {
      const isAAfternoon = a.category === 'afternoon' || (a.category === 'other' && (!a.startTime || a.startTime >= '12:30'));
      const isBAfternoon = b.category === 'afternoon' || (b.category === 'other' && (!b.startTime || b.startTime >= '12:30'));
      
      // For afternoon shifts: V6* comes before V8*
      if (isAAfternoon && isBAfternoon) {
        const aCode = (a.shiftCode || '').toUpperCase().trim();
        const bCode = (b.shiftCode || '').toUpperCase().trim();
        const aIsV6 = aCode.startsWith('V6') || aCode.startsWith('6');
        const bIsV6 = bCode.startsWith('V6') || bCode.startsWith('6');
        if (aIsV6 && !bIsV6) return -1;
        if (!aIsV6 && bIsV6) return 1;
      }

      const timeA = a.startTime || '99:99';
      const timeB = b.startTime || '99:99';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      if (a.shiftCode !== b.shiftCode) return a.shiftCode.localeCompare(b.shiftCode);
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const activeShiftRules = (config.shiftCounterRules || []).filter((r) => {
      if (!r.active) return false;
      if (r.dayType === 'all') return true;
      if (r.dayType === 'weekday') return isWeekday;
      if (r.dayType === 'weekend') return isWeekend;
      if (r.dayType === 'specific_days') return r.specificDays?.includes(dayOfWeek);
      return true;
    });

    // === 3. APPLY SHIFT-SPECIFIC COUNTER PRIORITY RULES (V815, V818, V820...) ===
    const unplacedPool: UnassignedEmployee[] = [];

    for (const emp of remainingPool) {
      const isMorningCandidate =
        emp.category === 'morning' || (emp.category === 'other' && (!emp.startTime || emp.startTime < '12:30')) ||
        emp.shiftCode.toUpperCase().startsWith('V815') ||
        emp.shiftCode.toUpperCase().startsWith('V818') ||
        emp.shiftCode.toUpperCase().startsWith('V820');
      const isAfternoonCandidate =
        emp.category === 'afternoon' || (emp.category === 'other' && emp.startTime >= '12:30');

      // Find matching shift rule
      const matchingRule = activeShiftRules.find((r) =>
        r.shiftCodes.some((sc) => {
          const target = sc.trim().toUpperCase();
          const current = emp.shiftCode.trim().toUpperCase();
          return current === target || current.startsWith(target);
        })
      );

      let placed = false;

      if (matchingRule && matchingRule.priorityCounters && matchingRule.priorityCounters.length > 0) {
        for (const counterSpec of matchingRule.priorityCounters) {
          const matchedCounters = findMatchingCounters(counters, counterSpec);
          for (const c of matchedCounters) {
            const ca = newAssignments[c.id];
            if (!ca) continue;

            if (isMorningCandidate && !ca.morning) {
              ca.morning = {
                employeeId: emp.employeeId,
                employeeName: emp.fullName,
                shiftCode: emp.shiftCode,
                startTime: emp.startTime,
                endTime: emp.endTime,
                assignedAt: new Date().toISOString(),
              };
              placed = true;
              morningAssigned++;
              count++;
              break;
            } else if (isAfternoonCandidate && !ca.afternoon && !isMorningCandidate) {
              ca.afternoon = {
                employeeId: emp.employeeId,
                employeeName: emp.fullName,
                shiftCode: emp.shiftCode,
                startTime: emp.startTime,
                endTime: emp.endTime,
                assignedAt: new Date().toISOString(),
              };
              placed = true;
              afternoonAssigned++;
              count++;
              break;
            }
          }
          if (placed) break;
        }
      }

      if (!placed) {
        unplacedPool.push(emp);
      }
    }

    // === 4. SORT REMAINING COUNTERS BY GENERAL STRATEGY ===
    const sortedCounters = this.getSortedCountersWithRules(counters, options, config);

    // === 5. SEPARATE UNPLACED CANDIDATES BY SHIFT ===
    const morningPool = unplacedPool.filter(
      (u) => u.category === 'morning' || (u.category === 'other' && (!u.startTime || u.startTime < '12:30'))
    );
    const afternoonPool = unplacedPool.filter(
      (u) => u.category === 'afternoon' || (u.category === 'other' && u.startTime >= '12:30')
    );

    // Ensure afternoon pool strictly prioritizes V6* over V8*
    afternoonPool.sort((a, b) => {
      const aCode = (a.shiftCode || '').toUpperCase().trim();
      const bCode = (b.shiftCode || '').toUpperCase().trim();
      const aIsV6 = aCode.startsWith('V6') || aCode.startsWith('6');
      const bIsV6 = bCode.startsWith('V6') || bCode.startsWith('6');
      if (aIsV6 && !bIsV6) return -1;
      if (!aIsV6 && bIsV6) return 1;

      const timeA = a.startTime || '99:99';
      const timeB = b.startTime || '99:99';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      if (a.shiftCode !== b.shiftCode) return a.shiftCode.localeCompare(b.shiftCode);
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

    // Helper to evaluate candidate fitness for a specific counter slot
    const getCandidateFitness = (emp: UnassignedEmployee, counter: Counter, isAfternoonSlot = false): number => {
      let score = 0;
      const zone = getCounterZone(counter);

      // Afternoon priority: V6* takes precedence over V8*
      if (isAfternoonSlot) {
        const code = (emp.shiftCode || '').toUpperCase().trim();
        if (code.startsWith('V6') || code.startsWith('6')) {
          score += 200; // V6* takes top priority in afternoon
        } else if (code.startsWith('V8') || code.startsWith('8')) {
          score += 20;
        }
      }

      // 1. Zone capability match
      if (emp.isSup) {
        score += 50; // SUP is versatile and capable everywhere
      } else {
        if (zone === 'Bánh mì') {
          if (emp.canBanhMy) score += 80;
          else score -= 120; // Strongly deprioritize if lacks Bánh mỳ skill
        } else if (zone === 'Delica') {
          if (emp.canDelica) score += 80;
          else score -= 120; // Strongly deprioritize if lacks Delica skill
        } else if (zone === 'Siêu thị') {
          if (emp.canSieuThi !== false) score += 30;
          else score -= 80;
        }
      }

      // 2. Anti-repetition & warning checks: SUP bypasses all warnings and restrictions
      if (!emp.isSup) {
        const recent = getEmployeeRecentCounters(emp.fullName, emp.employeeId, currentAssignment.date, counters, 3);
        const targetId = counter.id.toLowerCase().trim();
        const targetNum = (counter.counterNumber || '').toLowerCase().trim();

        recent.forEach((rc, idx) => {
          const pastId = rc.counterId.toLowerCase().trim();
          const pastNum = rc.counterNumber.toLowerCase().trim();
          if (pastId === targetId || pastNum === targetNum) {
            if (idx === 0) score -= 200; // Worked at this counter yesterday (D-1)
            else if (idx === 1) score -= 100; // Worked at this counter D-2
            else score -= 50; // Worked at this counter D-3
          }
        });

        // 3. Zone Streak Warning check (SUP exempt from all warnings)
        const warning = checkZoneStreakWarning(emp.fullName, emp.employeeId, currentAssignment.date, counter, counters, emp.isSup);
        if (warning) {
          score -= 75;
        }

        // 4. Consecutive 2-Day Counter or Monitored Cluster check (SSC-17, 20-27, 101-106 & 306, 109-117)
        const twoDayWarn = checkConsecutiveTwoDayWarning(
          emp.fullName,
          emp.employeeId,
          currentAssignment.date,
          counter,
          counters,
          currentAssignment,
          emp.isSup
        );
        if (twoDayWarn) {
          if (twoDayWarn.warningType === 'same_counter' || twoDayWarn.warningType === 'both') {
            score -= 350;
          } else {
            score -= 300;
          }
        }
      }

      return score;
    };

    // Helper to pick best candidate from a pool for a counter
    const pickBestCandidate = (pool: UnassignedEmployee[], counter: Counter, isAfternoonSlot = false): number => {
      if (pool.length === 0) return -1;
      let bestIdx = 0;
      let bestScore = getCandidateFitness(pool[0], counter, isAfternoonSlot);

      for (let i = 1; i < pool.length; i++) {
        const score = getCandidateFitness(pool[i], counter, isAfternoonSlot);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    // === 6. ASSIGN REMAINING MORNING SLOTS ===
    for (const c of sortedCounters) {
      const ca = newAssignments[c.id];
      if (ca && !ca.morning) {
        const reqGroup = getCounterMorningRequiredShift(c);
        let bestIdx = -1;

        if (reqGroup) {
          // For designated morning counters, ONLY accept candidates matching the required shift group
          const matchingCandidates = morningPool
            .map((emp, idx) => ({ emp, idx }))
            .filter(({ emp }) => isShiftMatchingMorningGroup(emp.shiftCode, reqGroup));

          if (matchingCandidates.length > 0) {
            let bestScore = -Infinity;
            for (const { emp, idx } of matchingCandidates) {
              const score = getCandidateFitness(emp, c, false);
              if (score > bestScore) {
                bestScore = score;
                bestIdx = idx;
              }
            }
          }
        } else {
          bestIdx = pickBestCandidate(morningPool, c, false);
        }

        if (bestIdx !== -1) {
          const emp = morningPool.splice(bestIdx, 1)[0];
          ca.morning = {
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            shiftCode: emp.shiftCode,
            startTime: emp.startTime,
            endTime: emp.endTime,
            assignedAt: new Date().toISOString(),
          };
          count++;
          morningAssigned++;
        }
      }
    }

    // === 7. ASSIGN REMAINING AFTERNOON SLOTS ===
    for (const c of sortedCounters) {
      const ca = newAssignments[c.id];
      if (ca && !ca.afternoon) {
        const bestIdx = pickBestCandidate(afternoonPool, c, true);
        if (bestIdx !== -1) {
          const emp = afternoonPool.splice(bestIdx, 1)[0];
          ca.afternoon = {
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            shiftCode: emp.shiftCode,
            startTime: emp.startTime,
            endTime: emp.endTime,
            assignedAt: new Date().toISOString(),
          };
          count++;
          afternoonAssigned++;
        }
      }
    }

    const unassignedRemaining = morningPool.length + afternoonPool.length;

    const updatedAssignment: DayDwsAssignment = {
      ...currentAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    return {
      updatedAssignment,
      assignedCount: count,
      fixedRulesCount,
      morningAssigned,
      afternoonAssigned,
      unassignedRemaining,
    };
  },

  // Auto assign all 6 days of the week (Thứ 2 -> Thứ 7)
  autoAssignWeek(
    mondayDate: string,
    counters: Counter[],
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[],
    existingAssignments: Record<string, DayDwsAssignment>,
    options?: Partial<AutoAssignOptions>,
    rules?: AssignmentRuleConfig
  ): {
    updatedAssignmentsMap: Record<string, DayDwsAssignment>;
    totalAssignedCount: number;
    dayResults: Record<
      string,
      { assignedCount: number; fixedRulesCount: number; unassignedRemaining: number }
    >;
  } {
    const monday = new Date(mondayDate);
    const updatedAssignmentsMap: Record<string, DayDwsAssignment> = { ...existingAssignments };
    let totalAssignedCount = 0;
    const dayResults: Record<string, { assignedCount: number; fixedRulesCount: number; unassignedRemaining: number }> = {};

    for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + dayOffset);
      const dateStr = current.toISOString().split('T')[0];

      const currentDayAssignment =
        updatedAssignmentsMap[dateStr] || {
          date: dateStr,
          weekId: mondayDate,
          dayOfWeek: dayOffset + 1,
          assignments: {},
          updatedAt: new Date().toISOString(),
        };

      const unassignedForDay = this.getUnassignedEmployees(
        dateStr,
        weeklySchedule,
        shifts,
        options?.mode === 'overwrite_all' ? null : currentDayAssignment
      );

      const result = this.autoAssign(
        counters,
        unassignedForDay,
        currentDayAssignment,
        options,
        rules
      );

      updatedAssignmentsMap[dateStr] = result.updatedAssignment;
      totalAssignedCount += result.assignedCount;
      dayResults[dateStr] = {
        assignedCount: result.assignedCount,
        fixedRulesCount: result.fixedRulesCount,
        unassignedRemaining: result.unassignedRemaining,
      };
    }

    return {
      updatedAssignmentsMap,
      totalAssignedCount,
      dayResults,
    };
  },
};
