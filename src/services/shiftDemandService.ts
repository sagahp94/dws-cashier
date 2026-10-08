import {
  Shift,
  Counter,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  SlotAssignment,
  CounterDayAssignment,
  ShiftGroupDemandStat,
  DailyShiftDemandResult,
  TargetCounterDetail,
  AreaShiftDemandTarget,
  AreaShiftComparisonResult,
  AreaShiftActualStat,
} from '../types';
import { isOffShift } from './excelService';
import {
  findMatchingCounters,
  V815_MORNING_COUNTERS,
  V818_MORNING_COUNTERS,
  V820_MORNING_COUNTERS,
  isCounterMatchingSpec,
  getCounterMorningRequiredShift,
  isShiftMatchingMorningGroup,
} from './assignmentService';
import { getDayOfWeekIndex, getDayNameVietnamese } from '../utils/dateUtils';
import { PLANNED_WEEKLY_DEMAND_CONFIG } from '../config/plannedDemandConfig';

export {
  V815_MORNING_COUNTERS,
  V818_MORNING_COUNTERS,
  V820_MORNING_COUNTERS,
  isCounterMatchingSpec,
  getCounterMorningRequiredShift,
  isShiftMatchingMorningGroup,
};

/**
 * Standard Weekly Demand Table according to user specification:
 * - Ca Tối: Bắt đầu từ 13:00
 * - Ca Sáng: Bắt đầu trước 13:00
 * - Siêu thị: Các quầy từ SSC01 đến 27
 * - FL2: Các quầy thuộc Delica và Bánh mì (101 - 117)
 */
export const STANDARD_WEEKLY_DEMAND_TABLE: Record<number, AreaShiftDemandTarget> = PLANNED_WEEKLY_DEMAND_CONFIG as unknown as Record<number, AreaShiftDemandTarget>;

/**
 * Phân loại quầy:
 * - Siêu thị: Các quầy từ SSC01 đến 27
 * - FL2: Các quầy thuộc Delica, Bánh mì (hoặc quầy 101 - 117, 306)
 * - Khác: CSKH, Quản lý...
 */
export function classifyCounter(counter: Counter): 'SIEU_THI' | 'FL2' | 'OTHER' {
  const numStr = (counter.counterNumber || '').trim().toLowerCase();
  const idStr = (counter.id || '').trim().toLowerCase();
  const areaStr = (counter.area || '').trim().toLowerCase();

  // SSC counters
  if (numStr.includes('ssc') || idStr.includes('ssc') || areaStr.includes('tự chọn')) {
    return 'SIEU_THI';
  }

  // Check 1 - 27 & KGFL1
  if (idStr === 'kgfl1' || numStr === 'kgfl1') {
    return 'SIEU_THI';
  }

  const matchNum = numStr.match(/^(\d+)/);
  if (matchNum) {
    const n = parseInt(matchNum[1], 10);
    if (n >= 1 && n <= 27) {
      return 'SIEU_THI';
    }
    if ((n >= 101 && n <= 117) || n === 306) {
      return 'FL2';
    }
  }

  // FL2 areas
  if (
    areaStr.includes('delica') ||
    areaStr.includes('bánh mì') ||
    areaStr.includes('bakery') ||
    areaStr.includes('đồ uống') ||
    areaStr.includes('bánh kẹo') ||
    areaStr.includes('sữa chua') ||
    areaStr.includes('trái cây') ||
    areaStr.includes('mỹ phẩm') ||
    areaStr.includes('dược phẩm') ||
    areaStr.includes('hàng trẻ em') ||
    areaStr.includes('fl2') ||
    areaStr.includes('tầng 2')
  ) {
    return 'FL2';
  }

  return 'OTHER';
}

/**
 * Phân loại ca làm việc:
 * - Ca Tối: Bắt đầu từ 13:00 (startTime >= "13:00")
 * - Ca Sáng: Bắt đầu trước 13:00 (startTime < "13:00")
 */
export function classifyShiftTime(
  shiftCode: string,
  shiftList: Shift[] = []
): 'MORNING' | 'NIGHT' | 'OFF' {
  const code = (shiftCode || '').toUpperCase().trim();
  if (isOffShift(code, '')) return 'OFF';

  const matchedShift = shiftList.find((s) => s.shiftCode.toUpperCase().trim() === code);
  if (matchedShift) {
    if (matchedShift.isOff || matchedShift.category === 'off') return 'OFF';
    if (matchedShift.startTime) {
      const [h] = matchedShift.startTime.split(':').map((x) => parseInt(x, 10));
      if (!isNaN(h)) {
        return h >= 13 ? 'NIGHT' : 'MORNING';
      }
    }
  }

  // Fallback by shift code convention if no shift definition or missing startTime:
  // Ca Tối: bắt đầu từ 13:00 (V820: 13:00, V822: 14:00, V829: 13:30, V830: 14:30, V633: 15:30, C820, C822, C829, C830...)
  if (
    code.startsWith('V820') ||
    code === '820' ||
    code.startsWith('V822') ||
    code === '822' ||
    code.startsWith('V829') ||
    code === '829' ||
    code.startsWith('V830') ||
    code === '830' ||
    code.startsWith('V633') ||
    code === '633' ||
    code.startsWith('C8') ||
    code.startsWith('T')
  ) {
    return 'NIGHT';
  }

  // Ca Sáng: bắt đầu trước 13:00 (V814: 08:00, V815: 08:00, V615: 06:00, V818: 08:00, V618: 06:00, S1, S815...)
  return 'MORNING';
}

export interface RuleSpec {
  counters: string[];
  notes: string;
}

export function getRuleForDay(
  groupKey: 'V815' | 'V818' | 'V820_V822' | 'V829_V830',
  _dayOfWeek?: number
): RuleSpec {
  if (groupKey === 'V815') {
    return {
      counters: V815_MORNING_COUNTERS,
      notes: 'Ca sáng ưu tiên ca V815: SSC, 17, 21, 23, 104, 105, 106, 110, 111, 114',
    };
  }

  if (groupKey === 'V818') {
    return {
      counters: V818_MORNING_COUNTERS,
      notes: 'Ca sáng ưu tiên ca V818: 13, 15, 20, 22, 24, 25, 102',
    };
  }

  // V820, V822
  if (groupKey === 'V820_V822') {
    return {
      counters: V820_MORNING_COUNTERS,
      notes: 'Ca sáng ưu tiên ca V820: 11, 26, 27, 103, 112, 108, 109',
    };
  }

  // Ca Chiều / Tối
  return {
    counters: [],
    notes: 'Ca chiều các quầy ưu tiên hiện ca V6* trước ca V8*',
  };
}

export const shiftDemandService = {
  /**
   * Determine which group a shiftCode belongs to
   */
  classifyShift(shiftCode: string): 'V815' | 'V818' | 'V820_V822' | 'V829_V830' | 'OTHER' {
    const code = (shiftCode || '').toUpperCase().trim();
    if (
      code.startsWith('V815') ||
      code === '815' ||
      code === 'S1' ||
      code === 'S815' ||
      code.startsWith('V814') ||
      code.startsWith('V615')
    ) {
      return 'V815';
    }
    if (code.startsWith('V818') || code === '818' || code.startsWith('V618') || code === '618' || code === 'G818') {
      return 'V818';
    }
    if (
      code.startsWith('V820') ||
      code === '820' ||
      code.startsWith('V822') ||
      code === '822' ||
      code.startsWith('V1322') ||
      code.startsWith('V1422') ||
      code === 'C820' ||
      code === 'C822'
    ) {
      return 'V820_V822';
    }
    if (
      code.startsWith('V829') ||
      code === '829' ||
      code.startsWith('V830') ||
      code === '830' ||
      code === 'C829' ||
      code === 'C830' ||
      code.startsWith('V633') ||
      code === '633'
    ) {
      return 'V829_V830';
    }
    return 'OTHER';
  },

  /**
   * Calculate detailed Area-Shift comparison stats (SIÊU THỊ vs FL2, Ca Sáng vs Ca Tối)
   */
  getAreaShiftComparisonStats(
    date: string,
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[],
    counters: Counter[],
    currentAssignment: DayDwsAssignment | null
  ): AreaShiftComparisonResult {
    const dayOfWeek = getDayOfWeekIndex(date);
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;
    const dayName = getDayNameVietnamese(date);

    const shiftMap = new Map<string, Shift>();
    shifts.forEach((s) => shiftMap.set(s.shiftCode.toUpperCase().trim(), s));

    const counterMap = new Map<string, Counter>();
    counters.forEach((c) => counterMap.set(c.id, c));

    // Target benchmark from user table
    const targetBenchmark = STANDARD_WEEKLY_DEMAND_TABLE[dayOfWeek] || {
      dayOfWeek,
      dayName,
      sieuThi: { morning: 15, night: 19, total: 34 },
      fl2: { morning: 12, night: 12, total: 24 },
      totalMorning: 27,
      totalNight: 31,
      grandTotal: 58,
    };

    // Scheduled employees for this day
    const dayEntries = weeklySchedule.filter((e) => e.date === date);

    // Track staff assignments in current DWS
    const assignedStaffMap = new Map<
      string,
      {
        counterId: string;
        counterNumber: string;
        area: 'SIEU_THI' | 'FL2' | 'OTHER';
        slot: 'morning' | 'afternoon';
      }
    >();

    // Direct count of actual opened counters from current assignments
    let sieuThiMorningAssigned = 0;
    let sieuThiNightAssigned = 0;
    let fl2MorningAssigned = 0;
    let fl2NightAssigned = 0;

    if (currentAssignment && currentAssignment.assignments) {
      Object.entries(currentAssignment.assignments).forEach(([cId, ca]) => {
        const cObj = counterMap.get(cId);
        const cNum = cObj ? cObj.counterNumber : cId;
        const areaCat = cObj ? classifyCounter(cObj) : 'OTHER';

        if (areaCat === 'SIEU_THI') {
          if (ca.morning) sieuThiMorningAssigned++;
          if (ca.morning2) sieuThiMorningAssigned++;
          if (ca.afternoon) sieuThiNightAssigned++;
          if (ca.afternoon2) sieuThiNightAssigned++;
        } else if (areaCat === 'FL2') {
          if (ca.morning) fl2MorningAssigned++;
          if (ca.morning2) fl2MorningAssigned++;
          if (ca.afternoon) fl2NightAssigned++;
          if (ca.afternoon2) fl2NightAssigned++;
        }

        if (ca.morning) {
          const k = (ca.morning.employeeId || ca.morning.employeeName).toLowerCase().trim();
          assignedStaffMap.set(k, { counterId: cId, counterNumber: cNum, area: areaCat, slot: 'morning' });
        }
        if (ca.morning2) {
          const k = (ca.morning2.employeeId || ca.morning2.employeeName).toLowerCase().trim();
          assignedStaffMap.set(k, { counterId: cId, counterNumber: cNum, area: areaCat, slot: 'morning' });
        }
        if (ca.afternoon) {
          const k = (ca.afternoon.employeeId || ca.afternoon.employeeName).toLowerCase().trim();
          assignedStaffMap.set(k, { counterId: cId, counterNumber: cNum, area: areaCat, slot: 'afternoon' });
        }
        if (ca.afternoon2) {
          const k = (ca.afternoon2.employeeId || ca.afternoon2.employeeName).toLowerCase().trim();
          assignedStaffMap.set(k, { counterId: cId, counterNumber: cNum, area: areaCat, slot: 'afternoon' });
        }
      });
    }

    const morningStaffList: AreaShiftComparisonResult['morningStaffList'] = [];
    const nightStaffList: AreaShiftComparisonResult['nightStaffList'] = [];

    dayEntries.forEach((entry) => {
      const shift = shiftMap.get(entry.shiftCode.toUpperCase().trim()) || null;
      const isOff = shift
        ? shift.isOff || shift.category === 'off' || isOffShift(shift.shiftCode, shift.shiftType, shift.startTime, shift.endTime)
        : isOffShift(entry.shiftCode, '');

      if (isOff) return;

      const timeCat = classifyShiftTime(entry.shiftCode, shifts);
      if (timeCat === 'OFF') return;

      const key = (entry.employeeId || entry.employeeName).toLowerCase().trim();
      const assignInfo = assignedStaffMap.get(key);

      const record = {
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        shiftCode: entry.shiftCode,
        startTime: shift?.startTime || (timeCat === 'NIGHT' ? '13:00' : '08:00'),
        isAssigned: !!assignInfo,
        assignedCounterNumber: assignInfo?.counterNumber,
        assignedArea: assignInfo?.area === 'SIEU_THI' ? 'Siêu thị' : assignInfo?.area === 'FL2' ? 'FL2' : assignInfo ? 'Khác' : undefined,
      };

      if (timeCat === 'MORNING') {
        morningStaffList.push(record);
      } else {
        nightStaffList.push(record);
      }
    });

    const totalMorningStaff = morningStaffList.length;
    const totalNightStaff = nightStaffList.length;
    const grandTotalStaff = totalMorningStaff + totalNightStaff;

    // Build stats for Siêu Thị
    const sieuThiTotalAssigned = sieuThiMorningAssigned + sieuThiNightAssigned;
    const sieuThiStat: AreaShiftActualStat = {
      area: 'SIEU_THI',
      areaLabel: 'SIÊU THỊ (SSC01 - Quầy 27)',
      morningTarget: targetBenchmark.sieuThi.morning,
      morningStaff: totalMorningStaff, // Total morning personnel available for store
      morningAssigned: sieuThiMorningAssigned,
      morningAssignedBalance: sieuThiMorningAssigned - targetBenchmark.sieuThi.morning,
      morningStaffBalance: totalMorningStaff - targetBenchmark.sieuThi.morning,
      morningBalance: sieuThiMorningAssigned - targetBenchmark.sieuThi.morning,

      nightTarget: targetBenchmark.sieuThi.night,
      nightStaff: totalNightStaff,
      nightAssigned: sieuThiNightAssigned,
      nightAssignedBalance: sieuThiNightAssigned - targetBenchmark.sieuThi.night,
      nightStaffBalance: totalNightStaff - targetBenchmark.sieuThi.night,
      nightBalance: sieuThiNightAssigned - targetBenchmark.sieuThi.night,

      totalTarget: targetBenchmark.sieuThi.total,
      totalStaff: grandTotalStaff,
      totalAssigned: sieuThiTotalAssigned,
      totalAssignedBalance: sieuThiTotalAssigned - targetBenchmark.sieuThi.total,
      totalStaffBalance: grandTotalStaff - targetBenchmark.sieuThi.total,
      totalBalance: sieuThiTotalAssigned - targetBenchmark.sieuThi.total,
    };

    // Build stats for FL2
    const fl2TotalAssigned = fl2MorningAssigned + fl2NightAssigned;
    const fl2Stat: AreaShiftActualStat = {
      area: 'FL2',
      areaLabel: 'FL2 (Delica & Bánh mì / Quầy 101 - 117)',
      morningTarget: targetBenchmark.fl2.morning,
      morningStaff: totalMorningStaff,
      morningAssigned: fl2MorningAssigned,
      morningAssignedBalance: fl2MorningAssigned - targetBenchmark.fl2.morning,
      morningStaffBalance: totalMorningStaff - targetBenchmark.fl2.morning,
      morningBalance: fl2MorningAssigned - targetBenchmark.fl2.morning,

      nightTarget: targetBenchmark.fl2.night,
      nightStaff: totalNightStaff,
      nightAssigned: fl2NightAssigned,
      nightAssignedBalance: fl2NightAssigned - targetBenchmark.fl2.night,
      nightStaffBalance: totalNightStaff - targetBenchmark.fl2.night,
      nightBalance: fl2NightAssigned - targetBenchmark.fl2.night,

      totalTarget: targetBenchmark.fl2.total,
      totalStaff: grandTotalStaff,
      totalAssigned: fl2TotalAssigned,
      totalAssignedBalance: fl2TotalAssigned - targetBenchmark.fl2.total,
      totalStaffBalance: grandTotalStaff - targetBenchmark.fl2.total,
      totalBalance: fl2TotalAssigned - targetBenchmark.fl2.total,
    };

    const totalMorningAssigned = sieuThiMorningAssigned + fl2MorningAssigned;
    const totalNightAssigned = sieuThiNightAssigned + fl2NightAssigned;
    const grandTotalAssigned = totalMorningAssigned + totalNightAssigned;

    return {
      date,
      dayOfWeek,
      dayName,
      isWeekend,
      sieuThi: sieuThiStat,
      fl2: fl2Stat,
      summary: {
        totalMorningTarget: targetBenchmark.totalMorning,
        totalMorningStaff,
        totalMorningAssigned,
        totalMorningAssignedBalance: totalMorningAssigned - targetBenchmark.totalMorning,
        totalMorningStaffBalance: totalMorningStaff - targetBenchmark.totalMorning,
        totalMorningBalance: totalMorningAssigned - targetBenchmark.totalMorning,

        totalNightTarget: targetBenchmark.totalNight,
        totalNightStaff,
        totalNightAssigned,
        totalNightAssignedBalance: totalNightAssigned - targetBenchmark.totalNight,
        totalNightStaffBalance: totalNightStaff - targetBenchmark.totalNight,
        totalNightBalance: totalNightAssigned - targetBenchmark.totalNight,

        grandTotalTarget: targetBenchmark.grandTotal,
        grandTotalStaff,
        grandTotalAssigned,
        grandTotalAssignedBalance: grandTotalAssigned - targetBenchmark.grandTotal,
        grandTotalStaffBalance: grandTotalStaff - targetBenchmark.grandTotal,
        grandTotalBalance: grandTotalAssigned - targetBenchmark.grandTotal,
      },
      morningStaffList,
      nightStaffList,
      standardWeeklyTable: STANDARD_WEEKLY_DEMAND_TABLE,
    };
  },

  /**
   * Calculate detailed shift demand and staff supply statistics for a specific day
   */
  getDailyShiftDemandStats(
    date: string,
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[],
    counters: Counter[],
    currentAssignment: DayDwsAssignment | null
  ): DailyShiftDemandResult {
    const dayOfWeek = getDayOfWeekIndex(date);
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;
    const dayName = getDayNameVietnamese(date);

    const shiftMap = new Map<string, Shift>();
    shifts.forEach((s) => shiftMap.set(s.shiftCode.toUpperCase().trim(), s));

    // Scheduled employees for this day (excluding OFF)
    const dayEntries = weeklySchedule.filter((e) => e.date === date);

    // Build assignment maps for fast lookup
    const assignedByEmpKey = new Map<
      string,
      { counterId: string; counterNumber: string; slot: 'morning' | 'afternoon'; shiftCode: string; employeeName: string }
    >();
    const assignedSlots = new Map<string, { morning?: SlotAssignment; afternoon?: SlotAssignment }>();

    if (currentAssignment && currentAssignment.assignments) {
      Object.entries(currentAssignment.assignments).forEach(([cId, ca]) => {
        const counterObj = counters.find((c) => c.id === cId);
        const cNum = counterObj ? counterObj.counterNumber : cId;

        if (ca.morning) {
          const key = (ca.morning.employeeId || ca.morning.employeeName).toLowerCase().trim();
          assignedByEmpKey.set(key, {
            counterId: cId,
            counterNumber: cNum,
            slot: 'morning',
            shiftCode: ca.morning.shiftCode,
            employeeName: ca.morning.employeeName,
          });
        }
        if (ca.afternoon) {
          const key = (ca.afternoon.employeeId || ca.afternoon.employeeName).toLowerCase().trim();
          assignedByEmpKey.set(key, {
            counterId: cId,
            counterNumber: cNum,
            slot: 'afternoon',
            shiftCode: ca.afternoon.shiftCode,
            employeeName: ca.afternoon.employeeName,
          });
        }

        assignedSlots.set(cId, {
          morning: ca.morning || undefined,
          afternoon: ca.afternoon || undefined,
        });
      });
    }

    // Group staff by shift categories
    const staffByGroup: Record<
      'V815' | 'V818' | 'V820_V822' | 'V829_V830' | 'OTHER',
      {
        employeeId?: string;
        employeeName: string;
        shiftCode: string;
        isAssigned: boolean;
        assignedCounterId?: string;
        assignedSlot?: 'morning' | 'afternoon';
      }[]
    > = {
      V815: [],
      V818: [],
      V820_V822: [],
      V829_V830: [],
      OTHER: [],
    };

    let totalWorkingStaff = 0;

    dayEntries.forEach((entry) => {
      const shift = shiftMap.get(entry.shiftCode.toUpperCase().trim()) || null;
      const isOff = shift
        ? shift.isOff || shift.category === 'off' || isOffShift(shift.shiftCode, shift.shiftType, shift.startTime, shift.endTime)
        : isOffShift(entry.shiftCode, '');

      if (isOff) return; // Ignore off shifts

      totalWorkingStaff++;
      const group = this.classifyShift(entry.shiftCode);
      const key = (entry.employeeId || entry.employeeName).toLowerCase().trim();
      const assignmentInfo = assignedByEmpKey.get(key);

      staffByGroup[group].push({
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        shiftCode: entry.shiftCode,
        isAssigned: !!assignmentInfo,
        assignedCounterId: assignmentInfo?.counterId,
        assignedSlot: assignmentInfo?.slot,
      });
    });

    // Helper to evaluate target counters for a rule
    const buildTargetCounters = (
      counterSpecs: string[],
      groupKey: 'V815' | 'V818' | 'V820_V822' | 'V829_V830' | 'OTHER'
    ) => {
      return counterSpecs.map((spec) => {
        const matched = findMatchingCounters(counters, spec);
        let isAssigned = false;
        let assignedToInfo: TargetCounterDetail['assignedTo'] = undefined;

        for (const c of matched) {
          const slotData = assignedSlots.get(c.id);
          if (!slotData) continue;

          const slotCandidate =
            groupKey === 'V820_V822' || groupKey === 'V829_V830'
              ? slotData.afternoon || slotData.morning
              : slotData.morning || slotData.afternoon;

          if (slotCandidate) {
            isAssigned = true;
            assignedToInfo = {
              employeeName: slotCandidate.employeeName,
              shiftCode: slotCandidate.shiftCode,
              slot: slotData.morning === slotCandidate ? 'morning' : 'afternoon',
              counterId: c.id,
              counterNumber: c.counterNumber,
            };
            break;
          }
        }

        return {
          spec,
          matchedCounters: matched,
          isAssigned,
          assignedTo: assignedToInfo,
        };
      });
    };

    // Construct 5 Group stats
    const groupDefinitions: {
      key: 'V815' | 'V818' | 'V820_V822' | 'V829_V830' | 'OTHER';
      label: string;
      shiftCodes: string[];
      shiftTypeLabel: string;
      badgeColor: string;
    }[] = [
      {
        key: 'V815',
        label: 'Nhóm Ca V815',
        shiftCodes: ['V815', 'V814', 'V615'],
        shiftTypeLabel: 'Ca Sáng (08:00 - 15:30 / 16:30)',
        badgeColor: 'amber',
      },
      {
        key: 'V818',
        label: 'Nhóm Ca V818 / V618',
        shiftCodes: ['V818', 'V618'],
        shiftTypeLabel: 'Ca Gãy / Giữa (08:00 - 18:00 / 06:00 - 18:00)',
        badgeColor: 'emerald',
      },
      {
        key: 'V820_V822',
        label: 'Nhóm Ca V820 / V822',
        shiftCodes: ['V820', 'V822'],
        shiftTypeLabel: 'Ca Giữa (10:00 / 13:00 - 20:00 / 22:00)',
        badgeColor: 'indigo',
      },
      {
        key: 'V829_V830',
        label: 'Nhóm Ca V829 / V830',
        shiftCodes: ['V829', 'V830', 'V633'],
        shiftTypeLabel: 'Ca Tối / Đóng Cửa (13:30 / 14:30 - 22:00 / 22:30)',
        badgeColor: 'purple',
      },
      {
        key: 'OTHER',
        label: 'Các Ca Khác',
        shiftCodes: [],
        shiftTypeLabel: 'Hành chính / Ca linh hoạt khác',
        badgeColor: 'slate',
      },
    ];

    let totalTargetCounters = 0;

    const groups: ShiftGroupDemandStat[] = groupDefinitions.map((def) => {
      const staffList = staffByGroup[def.key];
      const totalStaff = staffList.length;
      const assignedStaff = staffList.filter((s) => s.isAssigned).length;
      const unassignedStaff = totalStaff - assignedStaff;

      let ruleCounters: string[] = [];
      let ruleNotes = '';

      if (def.key !== 'OTHER') {
        const rule = getRuleForDay(def.key, dayOfWeek);
        ruleCounters = rule.counters;
        ruleNotes = rule.notes;
      } else {
        ruleNotes = 'Các ca linh động hoặc hỗ trợ chuyên biệt.';
      }

      const targetCounters = buildTargetCounters(ruleCounters, def.key);
      const targetCount = targetCounters.length;
      totalTargetCounters += targetCount;

      const balance = totalStaff - targetCount;

      return {
        groupKey: def.key,
        groupLabel: def.label,
        shiftCodes: def.shiftCodes,
        shiftTypeLabel: def.shiftTypeLabel,
        badgeColor: def.badgeColor,
        totalStaff,
        assignedStaff,
        unassignedStaff,
        staffList,
        targetCounters,
        targetCount,
        balance,
        ruleNotes,
      };
    });

    const overallBalance = totalWorkingStaff - totalTargetCounters;

    // Calculate Area-Shift Comparison
    const areaComparison = this.getAreaShiftComparisonStats(
      date,
      weeklySchedule,
      shifts,
      counters,
      currentAssignment
    );

    return {
      date,
      dayOfWeek,
      dayName,
      isWeekend,
      totalWorkingStaff,
      totalTargetCounters,
      overallBalance,
      groups,
      areaComparison,
    };
  },

  /**
   * Get list of recommended counter specifications for an unassigned employee based on their shift code and date
   */
  getRecommendedCountersForEmployee(
    shiftCode: string,
    date: string,
    counters: Counter[]
  ): { priorityCounters: Counter[]; notes: string } {
    const d = new Date(date);
    const dayIdx = d.getDay();
    const dayOfWeek = dayIdx === 0 ? 7 : dayIdx;

    const groupKey = this.classifyShift(shiftCode);
    if (groupKey === 'OTHER') {
      return { priorityCounters: [], notes: 'Không có quầy ưu tiên cố định cho ca này' };
    }

    const rule = getRuleForDay(groupKey, dayOfWeek);
    const matchedList: Counter[] = [];
    const seenIds = new Set<string>();

    rule.counters.forEach((spec) => {
      const matches = findMatchingCounters(counters, spec);
      matches.forEach((c) => {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          matchedList.push(c);
        }
      });
    });

    return {
      priorityCounters: matchedList,
      notes: rule.notes,
    };
  },

  /**
   * Quick Auto-Assign for a specific Shift Group (e.g. only assign V815 or only V818)
   */
  autoAssignShiftGroup(
    groupKey: 'V815' | 'V818' | 'V820_V822',
    date: string,
    counters: Counter[],
    weeklySchedule: WeeklyScheduleEntry[],
    shifts: Shift[],
    currentAssignment: DayDwsAssignment
  ): {
    updatedAssignment: DayDwsAssignment;
    assignedCount: number;
    assignedList: { employeeName: string; counterNumber: string; slot: string }[];
  } {
    const d = new Date(date);
    const dayIdx = d.getDay();
    const dayOfWeek = dayIdx === 0 ? 7 : dayIdx;

    const rule = getRuleForDay(groupKey, dayOfWeek);
    const stats = this.getDailyShiftDemandStats(date, weeklySchedule, shifts, counters, currentAssignment);
    const groupStat = stats.groups.find((g) => g.groupKey === groupKey);

    if (!groupStat || groupStat.unassignedStaff === 0) {
      return {
        updatedAssignment: currentAssignment,
        assignedCount: 0,
        assignedList: [],
      };
    }

    const unassignedCandidates = groupStat.staffList.filter((s) => !s.isAssigned);

    // Sort unassigned candidates: for afternoon groups or shifts, prioritize V6* before V8*
    unassignedCandidates.sort((a, b) => {
      const aCode = (a.shiftCode || '').toUpperCase().trim();
      const bCode = (b.shiftCode || '').toUpperCase().trim();
      const aIsV6 = aCode.startsWith('V6') || aCode.startsWith('6');
      const bIsV6 = bCode.startsWith('V6') || bCode.startsWith('6');
      if (aIsV6 && !bIsV6) return -1;
      if (!aIsV6 && bIsV6) return 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const newAssignments: Record<string, CounterDayAssignment> = JSON.parse(
      JSON.stringify(currentAssignment.assignments || {})
    );

    counters.forEach((c) => {
      if (!newAssignments[c.id]) {
        newAssignments[c.id] = { counterId: c.id };
      }
    });

    let assignedCount = 0;
    const assignedList: { employeeName: string; counterNumber: string; slot: string }[] = [];
    let candidateIdx = 0;

    const isAfternoonShift = false;

    for (const spec of rule.counters) {
      if (candidateIdx >= unassignedCandidates.length) break;

      const matchedCounters = findMatchingCounters(counters, spec);
      for (const c of matchedCounters) {
        if (candidateIdx >= unassignedCandidates.length) break;

        const ca = newAssignments[c.id];
        if (!ca) continue;

        const candidate = unassignedCandidates[candidateIdx];

        if (isAfternoonShift) {
          if (!ca.afternoon) {
            ca.afternoon = {
              employeeId: candidate.employeeId,
              employeeName: candidate.employeeName,
              shiftCode: candidate.shiftCode,
              assignedAt: new Date().toISOString(),
            };
            assignedList.push({
              employeeName: candidate.employeeName,
              counterNumber: c.counterNumber,
              slot: 'Ca Chiều',
            });
            candidateIdx++;
            assignedCount++;
          }
        } else {
          if (!ca.morning) {
            ca.morning = {
              employeeId: candidate.employeeId,
              employeeName: candidate.employeeName,
              shiftCode: candidate.shiftCode,
              assignedAt: new Date().toISOString(),
            };
            assignedList.push({
              employeeName: candidate.employeeName,
              counterNumber: c.counterNumber,
              slot: 'Ca Sáng',
            });
            candidateIdx++;
            assignedCount++;
          }
        }
      }
    }

    const updatedAssignment: DayDwsAssignment = {
      ...currentAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    return {
      updatedAssignment,
      assignedCount,
      assignedList,
    };
  },
};
