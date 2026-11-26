import { Counter, DayDwsAssignment } from '../types';
import { storageService } from './storageService';
import { findEmployeeRecord } from './zoneTrackingService';

/**
 * Định nghĩa 4 khu vực giám sát 2 ngày liên tiếp theo yêu cầu:
 * 1. "SSC-17": Các quầy có chứa SSC và các quầy số từ 1 đến 17
 * 2. "20-27": Các quầy số từ 20 đến 27
 * 3. "101-106, 306": Các quầy số từ 101 đến 106, và quầy 306
 * 4. "109-117": Các quầy số từ 109 đến 117
 */
export type MonitoredClusterId = 'SSC-17' | '20-27' | '101-106_306' | '109-117';

export interface MonitoredCluster {
  id: MonitoredClusterId;
  name: string;          // e.g. "khu vực từ SSC-17"
  shortLabel: string;    // e.g. "SSC - 17"
  displayRange: string;  // e.g. "Quầy SSC & 1 ➔ 17"
  bgBadge: string;
  textBadge: string;
  borderBadge: string;
}

export const MONITORED_CLUSTERS: Record<MonitoredClusterId, MonitoredCluster> = {
  'SSC-17': {
    id: 'SSC-17',
    name: 'khu vực từ SSC-17',
    shortLabel: 'Khu vực SSC - 17',
    displayRange: 'Quầy SSC & Quầy 1 ➔ 17',
    bgBadge: 'bg-amber-100',
    textBadge: 'text-amber-900',
    borderBadge: 'border-amber-300',
  },
  '20-27': {
    id: '20-27',
    name: 'khu vực 20-27',
    shortLabel: 'Khu vực 20 - 27',
    displayRange: 'Quầy 20 ➔ 27',
    bgBadge: 'bg-blue-100',
    textBadge: 'text-blue-900',
    borderBadge: 'border-blue-300',
  },
  '101-106_306': {
    id: '101-106_306',
    name: 'khu vực 101-106, 306',
    shortLabel: 'Khu vực 101-106 & 306',
    displayRange: 'Quầy 101 ➔ 106 & 306',
    bgBadge: 'bg-emerald-100',
    textBadge: 'text-emerald-900',
    borderBadge: 'border-emerald-300',
  },
  '109-117': {
    id: '109-117',
    name: 'khu vực 109-117',
    shortLabel: 'Khu vực 109 - 117',
    displayRange: 'Quầy 109 ➔ 117',
    bgBadge: 'bg-purple-100',
    textBadge: 'text-purple-900',
    borderBadge: 'border-purple-300',
  },
};

/**
 * Xác định xem một quầy có thuộc vào 1 trong 4 khu vực giám sát 2 ngày liên tiếp hay không
 */
export function getCounterMonitoredCluster(
  counterOrId: Counter | string | undefined
): MonitoredCluster | null {
  if (!counterOrId) return null;

  let idStr = '';
  let numberStr = '';
  let areaStr = '';

  if (typeof counterOrId === 'string') {
    idStr = counterOrId.trim();
    numberStr = counterOrId.trim();
  } else {
    idStr = (counterOrId.id || '').trim();
    numberStr = (counterOrId.counterNumber || '').trim();
    areaStr = (counterOrId.area || '').trim();
  }

  const raw = `${idStr} ${numberStr} ${areaStr}`.toLowerCase();

  // Bỏ qua nếu là Quản lý (QL) hoặc Gian hàng (KGFL)
  if (
    raw.includes('quản lý') ||
    idStr.toLowerCase().startsWith('ql') ||
    numberStr.toLowerCase().startsWith('ql') ||
    raw.includes('kgfl') ||
    idStr.toLowerCase().startsWith('kgfl')
  ) {
    return null;
  }

  const hasSsc = raw.includes('ssc');

  // Trích xuất số quầy đầu tiên trong idStr hoặc numberStr
  const numbersInStr = (idStr + ' ' + numberStr).match(/\d+/g);
  const num = numbersInStr && numbersInStr.length > 0 ? parseInt(numbersInStr[0], 10) : null;

  // 1. Nhóm SSC-17: Chứa chữ SSC, HOẶC số từ 1 đến 17
  if (hasSsc || (num !== null && num >= 1 && num <= 17)) {
    return MONITORED_CLUSTERS['SSC-17'];
  }

  // 2. Nhóm 20-27: Quầy có số từ 20 đến 27
  if (num !== null && num >= 20 && num <= 27) {
    return MONITORED_CLUSTERS['20-27'];
  }

  // 3. Nhóm 101-106, 306: Quầy có số từ 101 đến 106, hoặc 306
  if ((num !== null && num >= 101 && num <= 106) || num === 306) {
    return MONITORED_CLUSTERS['101-106_306'];
  }

  // 4. Nhóm 109-117: Quầy có số từ 109 đến 117
  if (num !== null && num >= 109 && num <= 117) {
    return MONITORED_CLUSTERS['109-117'];
  }

  return null;
}

/**
 * Kiểm tra xem 2 quầy có phải là cùng 1 quầy hay không
 */
export function isSameCounter(
  c1: Counter | string | undefined,
  c2: Counter | string | undefined
): boolean {
  if (!c1 || !c2) return false;

  const id1 = typeof c1 === 'string' ? c1.trim().toLowerCase() : (c1.id || '').trim().toLowerCase();
  const id2 = typeof c2 === 'string' ? c2.trim().toLowerCase() : (c2.id || '').trim().toLowerCase();

  if (id1 && id2 && id1 === id2) return true;

  const numStr1 = typeof c1 === 'string' ? c1.trim().toLowerCase() : (c1.counterNumber || c1.id || '').trim().toLowerCase();
  const numStr2 = typeof c2 === 'string' ? c2.trim().toLowerCase() : (c2.counterNumber || c2.id || '').trim().toLowerCase();

  // Chuẩn hóa bỏ khoảng trắng và xuống dòng
  const clean1 = numStr1.replace(/\s+/g, '');
  const clean2 = numStr2.replace(/\s+/g, '');

  if (clean1 && clean2 && clean1 === clean2) return true;

  // So khớp số
  const nums1 = (id1 + ' ' + numStr1).match(/\d+/g);
  const nums2 = (id2 + ' ' + numStr2).match(/\d+/g);
  const n1 = nums1 ? parseInt(nums1[0], 10) : null;
  const n2 = nums2 ? parseInt(nums2[0], 10) : null;

  const ssc1 = (id1 + ' ' + numStr1).includes('ssc');
  const ssc2 = (id2 + ' ' + numStr2).includes('ssc');

  if (n1 !== null && n2 !== null && n1 === n2 && ssc1 === ssc2) {
    return true;
  }

  return false;
}

/**
 * Format ngày dạng thân thiện tiếng Việt: Thứ 2 (18/08)
 */
export function formatDayOfWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const dayName = dayNames[d.getDay()];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${dayName} (${parts[2]}/${parts[1]})`;
  }
  return `${dayName} (${dateStr})`;
}

/**
 * Tính ngày liền kề (+/- offsetDays)
 */
export function getAdjacentDate(dateStr: string, offsetDays: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

export interface EmployeeAssignedSlotInfo {
  counterId: string;
  counterNumber: string;
  slot: 'morning' | 'afternoon';
  shiftCode?: string;
  date: string;
}

function lookupCounterNumber(counterId: string): string {
  const counters = storageService.getCounters();
  const c = counters.find((item) => item.id === counterId);
  return c?.counterNumber || counterId;
}

/**
 * Tìm quầy nhân viên đang đứng ở một ngày cụ thể
 */
export function getEmployeeCounterOnDate(
  employeeName: string,
  employeeId: string | undefined,
  dateStr: string,
  dayAssignmentOverride?: DayDwsAssignment | null
): EmployeeAssignedSlotInfo | null {
  const assignment =
    dayAssignmentOverride && dayAssignmentOverride.date === dateStr
      ? dayAssignmentOverride
      : storageService.getAssignment(dateStr);

  if (!assignment || !assignment.assignments) return null;

  const cleanName = (employeeName || '').toLowerCase().trim();
  const cleanId = (employeeId || '').toLowerCase().trim();

  for (const [cId, ca] of Object.entries(assignment.assignments)) {
    // Kiểm tra Ca Sáng
    if (ca.morning) {
      const mName = (ca.morning.employeeName || '').toLowerCase().trim();
      const mId = (ca.morning.employeeId || '').toLowerCase().trim();
      if ((cleanId && mId === cleanId) || (cleanName && mName === cleanName)) {
        return {
          counterId: cId,
          counterNumber: lookupCounterNumber(cId),
          slot: 'morning',
          shiftCode: ca.morning.shiftCode,
          date: dateStr,
        };
      }
    }

    // Kiểm tra Ca Chiều
    if (ca.afternoon) {
      const aName = (ca.afternoon.employeeName || '').toLowerCase().trim();
      const aId = (ca.afternoon.employeeId || '').toLowerCase().trim();
      if ((cleanId && aId === cleanId) || (cleanName && aName === cleanName)) {
        return {
          counterId: cId,
          counterNumber: lookupCounterNumber(cId),
          slot: 'afternoon',
          shiftCode: ca.afternoon.shiftCode,
          date: dateStr,
        };
      }
    }
  }

  return null;
}

export interface ConsecutiveTwoDayWarning {
  employeeName: string;
  employeeId?: string;
  warningType: 'same_counter' | 'same_cluster' | 'both';

  // Thông tin ngày đang thao tác (target)
  targetDate: string;
  targetDateLabel: string;
  targetCounterId: string;
  targetCounterNumber: string;
  targetCluster: MonitoredCluster | null;

  // Thông tin ngày liền kề bị trùng (hôm qua hoặc ngày mai)
  adjacentDate: string;
  adjacentDateLabel: string;
  adjacentCounterId: string;
  adjacentCounterNumber: string;
  adjacentCluster: MonitoredCluster | null;
  adjacentSlot: 'morning' | 'afternoon';
  adjacentShiftCode?: string;

  direction: 'yesterday' | 'tomorrow';
  message: string;
  shortDescription: string;
}

/**
 * Kiểm tra cảnh báo 2 ngày liên tiếp cho 1 nhân viên khi dự kiến xếp vào targetCounter ở targetDate
 * So sánh với ngày hôm trước (D-1) và ngày hôm sau (D+1).
 */
export function checkConsecutiveTwoDayWarning(
  employeeName: string,
  employeeId: string | undefined,
  targetDate: string,
  targetCounter: Counter | string,
  allCounters: Counter[],
  currentDayAssignmentOverride?: DayDwsAssignment | null,
  isSupOverride?: boolean
): ConsecutiveTwoDayWarning | null {
  if (!employeeName || !targetDate) return null;

  // QUY TẮC ĐẶC BIỆT: Nhân viên SUP bỏ qua mọi cảnh báo về xếp quầy
  let isSup = isSupOverride;
  if (isSup === undefined) {
    const empRecord = findEmployeeRecord(employeeName, employeeId);
    isSup = empRecord?.isSup === true;
  }
  if (isSup) {
    return null;
  }

  const targetCounterObj: Counter =
    typeof targetCounter === 'string'
      ? allCounters.find((c) => c.id === targetCounter) || {
          id: targetCounter,
          counterNumber: targetCounter,
          area: 'Siêu thị',
        }
      : targetCounter;

  const targetCounterId = targetCounterObj.id;
  const targetCounterNum = (targetCounterObj.counterNumber || targetCounterObj.id).replace(/\n/g, ' ');
  const targetCluster = getCounterMonitoredCluster(targetCounterObj);
  const targetDateLabel = formatDayOfWeekLabel(targetDate);

  // 1. Kiểm tra ngày hôm trước (D - 1)
  const yesterday = getAdjacentDate(targetDate, -1);
  const yesterdayAssignment = getEmployeeCounterOnDate(
    employeeName,
    employeeId,
    yesterday,
    currentDayAssignmentOverride
  );

  if (yesterdayAssignment) {
    const yesterdayCounterObj = allCounters.find((c) => c.id === yesterdayAssignment.counterId) || {
      id: yesterdayAssignment.counterId,
      counterNumber: yesterdayAssignment.counterNumber,
      area: 'Siêu thị',
    };
    const yesterdayCounterNum = (yesterdayAssignment.counterNumber || yesterdayAssignment.counterId).replace(/\n/g, ' ');
    const yesterdayCluster = getCounterMonitoredCluster(yesterdayCounterObj);
    const yesterdayDateLabel = formatDayOfWeekLabel(yesterday);

    const sameCounter = isSameCounter(targetCounterObj, yesterdayCounterObj);
    const sameCluster =
      targetCluster !== null &&
      yesterdayCluster !== null &&
      targetCluster.id === yesterdayCluster.id;

    if (sameCounter || sameCluster) {
      const warningType: 'same_counter' | 'same_cluster' | 'both' =
        sameCounter && sameCluster ? 'both' : sameCounter ? 'same_counter' : 'same_cluster';

      let message = '';
      let shortDescription = '';

      if (warningType === 'both') {
        message = `Nhân viên "${employeeName}" đứng cùng Quầy ${targetCounterNum} (${targetCluster?.name}) trong 2 ngày liên tiếp (${yesterdayDateLabel} và ${targetDateLabel}).`;
        shortDescription = `Đứng cùng Quầy ${targetCounterNum} (${targetCluster?.shortLabel}) 2 ngày liên tiếp`;
      } else if (warningType === 'same_counter') {
        message = `Nhân viên "${employeeName}" đứng cùng Quầy ${targetCounterNum} trong 2 ngày liên tiếp (${yesterdayDateLabel} và ${targetDateLabel}).`;
        shortDescription = `Đứng cùng Quầy ${targetCounterNum} 2 ngày liên tiếp`;
      } else {
        // same_cluster: ví dụ thứ 2 đứng 17, thứ 3 đứng 13
        message = `Nhân viên "${employeeName}" đứng ${targetCluster?.name} trong 2 ngày liên tiếp (${yesterdayDateLabel}: Quầy ${yesterdayCounterNum} ➔ ${targetDateLabel}: Quầy ${targetCounterNum}).`;
        shortDescription = `Đứng ${targetCluster?.shortLabel} 2 ngày liên tiếp (Q.${yesterdayCounterNum} ➔ Q.${targetCounterNum})`;
      }

      return {
        employeeName,
        employeeId,
        warningType,
        targetDate,
        targetDateLabel,
        targetCounterId,
        targetCounterNumber: targetCounterNum,
        targetCluster,
        adjacentDate: yesterday,
        adjacentDateLabel: yesterdayDateLabel,
        adjacentCounterId: yesterdayAssignment.counterId,
        adjacentCounterNumber: yesterdayCounterNum,
        adjacentCluster: yesterdayCluster,
        adjacentSlot: yesterdayAssignment.slot,
        adjacentShiftCode: yesterdayAssignment.shiftCode,
        direction: 'yesterday',
        message,
        shortDescription,
      };
    }
  }

  // 2. Kiểm tra ngày hôm sau (D + 1)
  const tomorrow = getAdjacentDate(targetDate, 1);
  const tomorrowAssignment = getEmployeeCounterOnDate(
    employeeName,
    employeeId,
    tomorrow,
    currentDayAssignmentOverride
  );

  if (tomorrowAssignment) {
    const tomorrowCounterObj = allCounters.find((c) => c.id === tomorrowAssignment.counterId) || {
      id: tomorrowAssignment.counterId,
      counterNumber: tomorrowAssignment.counterNumber,
      area: 'Siêu thị',
    };
    const tomorrowCounterNum = (tomorrowAssignment.counterNumber || tomorrowAssignment.counterId).replace(/\n/g, ' ');
    const tomorrowCluster = getCounterMonitoredCluster(tomorrowCounterObj);
    const tomorrowDateLabel = formatDayOfWeekLabel(tomorrow);

    const sameCounter = isSameCounter(targetCounterObj, tomorrowCounterObj);
    const sameCluster =
      targetCluster !== null &&
      tomorrowCluster !== null &&
      targetCluster.id === tomorrowCluster.id;

    if (sameCounter || sameCluster) {
      const warningType: 'same_counter' | 'same_cluster' | 'both' =
        sameCounter && sameCluster ? 'both' : sameCounter ? 'same_counter' : 'same_cluster';

      let message = '';
      let shortDescription = '';

      if (warningType === 'both') {
        message = `Nhân viên "${employeeName}" đứng cùng Quầy ${targetCounterNum} (${targetCluster?.name}) trong 2 ngày liên tiếp (${targetDateLabel} và ${tomorrowDateLabel}).`;
        shortDescription = `Đứng cùng Quầy ${targetCounterNum} (${targetCluster?.shortLabel}) 2 ngày liên tiếp`;
      } else if (warningType === 'same_counter') {
        message = `Nhân viên "${employeeName}" đứng cùng Quầy ${targetCounterNum} trong 2 ngày liên tiếp (${targetDateLabel} và ${tomorrowDateLabel}).`;
        shortDescription = `Đứng cùng Quầy ${targetCounterNum} 2 ngày liên tiếp`;
      } else {
        message = `Nhân viên "${employeeName}" đứng ${targetCluster?.name} trong 2 ngày liên tiếp (${targetDateLabel}: Quầy ${targetCounterNum} ➔ ${tomorrowDateLabel}: Quầy ${tomorrowCounterNum}).`;
        shortDescription = `Đứng ${targetCluster?.shortLabel} 2 ngày liên tiếp (Q.${targetCounterNum} ➔ Q.${tomorrowCounterNum})`;
      }

      return {
        employeeName,
        employeeId,
        warningType,
        targetDate,
        targetDateLabel,
        targetCounterId,
        targetCounterNumber: targetCounterNum,
        targetCluster,
        adjacentDate: tomorrow,
        adjacentDateLabel: tomorrowDateLabel,
        adjacentCounterId: tomorrowAssignment.counterId,
        adjacentCounterNumber: tomorrowCounterNum,
        adjacentCluster: tomorrowCluster,
        adjacentSlot: tomorrowAssignment.slot,
        adjacentShiftCode: tomorrowAssignment.shiftCode,
        direction: 'tomorrow',
        message,
        shortDescription,
      };
    }
  }

  return null;
}

/**
 * Quét kiểm tra toàn bộ các nhân viên đã xếp quầy trong ngày để tìm vi phạm 2 ngày liên tiếp
 * Dùng cho validation banner và thống kê
 */
export function validateConsecutiveTwoDayRulesForDay(
  date: string,
  assignment: DayDwsAssignment | null,
  allCounters: Counter[]
): ConsecutiveTwoDayWarning[] {
  const warnings: ConsecutiveTwoDayWarning[] = [];
  if (!assignment || !assignment.assignments) return warnings;

  const scannedEmployees = new Set<string>();

  Object.entries(assignment.assignments).forEach(([cId, ca]) => {
    const counterObj = allCounters.find((c) => c.id === cId) || {
      id: cId,
      counterNumber: cId,
      area: 'Siêu thị',
    };

    // Kiểm tra Ca Sáng
    if (ca.morning && ca.morning.employeeName) {
      const empRecord = findEmployeeRecord(ca.morning.employeeName, ca.morning.employeeId);
      if (!empRecord?.isSup) {
        const empKey = (ca.morning.employeeId || ca.morning.employeeName).toLowerCase().trim();
        if (!scannedEmployees.has(empKey)) {
          scannedEmployees.add(empKey);
          const warn = checkConsecutiveTwoDayWarning(
            ca.morning.employeeName,
            ca.morning.employeeId,
            date,
            counterObj,
            allCounters,
            assignment,
            false
          );
          if (warn) warnings.push(warn);
        }
      }
    }

    // Kiểm tra Ca Chiều
    if (ca.afternoon && ca.afternoon.employeeName) {
      const empRecord = findEmployeeRecord(ca.afternoon.employeeName, ca.afternoon.employeeId);
      if (!empRecord?.isSup) {
        const empKey = (ca.afternoon.employeeId || ca.afternoon.employeeName).toLowerCase().trim();
        if (!scannedEmployees.has(empKey)) {
          scannedEmployees.add(empKey);
          const warn = checkConsecutiveTwoDayWarning(
            ca.afternoon.employeeName,
            ca.afternoon.employeeId,
            date,
            counterObj,
            allCounters,
            assignment,
            false
          );
          if (warn) warnings.push(warn);
        }
      }
    }
  });

  return warnings;
}
