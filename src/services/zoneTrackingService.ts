import { Counter, DayDwsAssignment, Employee, RecentCounterAssignment, EmployeeRecentHistorySummary, ZoneStreakWarning, ZoneType } from '../types';
import { storageService } from './storageService';

/**
 * Phân loại quầy thành các khu vực chính theo chuẩn AEON:
 * - "Siêu thị": Quầy 1 -> 27, SSC, KGFL1, Tầng 2, Tự chọn, Bách hóa, Thực phẩm, Gia dụng, Thời trang...
 * - "Delica": Quầy 101, 102, 105, 106, 109, 306 (Đồ uống, Sữa chua, Trái cây, Dịch vụ, Ẩm thực)
 * - "Bánh mì": Quầy 103, 104 (Bánh mì, Bánh kẹo)
 * - "Mỹ phẩm - Dược phẩm": Quầy 110, 111, 112, 114, 115, 117
 * - "CSKH": Quầy 305, 307, 311, 312
 * - "Quản lý": QL1, QL2
 */
export function getCounterZone(counterOrId: Counter | string | undefined, areaHint?: string): ZoneType {
  if (!counterOrId) return 'Siêu thị';

  let cId = '';
  let cNumber = '';
  let cArea = areaHint || '';

  if (typeof counterOrId === 'string') {
    cId = counterOrId.trim();
    cNumber = counterOrId.trim();
  } else {
    cId = (counterOrId.id || '').trim();
    cNumber = (counterOrId.counterNumber || '').trim();
    cArea = (counterOrId.area || areaHint || '').trim();
  }

  const raw = `${cId} ${cNumber} ${cArea}`.toLowerCase();

  // 1. Bánh mì / Bánh kẹo
  if (
    cId === '103' ||
    cId === '104' ||
    cNumber === '103' ||
    cNumber === '104' ||
    raw.includes('bánh mì') ||
    raw.includes('bánh kẹo') ||
    raw.includes('bakery')
  ) {
    return 'Bánh mì';
  }

  // 2. Delica / Đồ uống / Trái cây / Sữa chua / Dịch vụ
  if (
    ['101', '102', '105', '106', '109', '306'].includes(cId) ||
    ['101', '102', '105', '106', '109', '306'].includes(cNumber) ||
    raw.includes('delica') ||
    raw.includes('đồ uống') ||
    raw.includes('trái cây') ||
    raw.includes('sữa chua') ||
    raw.includes('dịch vụ') ||
    raw.includes('ẩm thực')
  ) {
    return 'Delica';
  }

  // 3. Mỹ phẩm / Dược phẩm / Hàng trẻ em
  if (
    ['110', '111', '112', '114', '115', '117'].includes(cId) ||
    ['110', '111', '112', '114', '115', '117'].includes(cNumber) ||
    raw.includes('mỹ phẩm') ||
    raw.includes('dược phẩm') ||
    raw.includes('trẻ em')
  ) {
    return 'Mỹ phẩm - Dược phẩm';
  }

  // 4. CSKH
  if (
    ['305', '307', '311', '312'].includes(cId) ||
    ['305', '307', '311', '312'].includes(cNumber) ||
    raw.includes('cskh') ||
    raw.includes('chăm sóc khách hàng')
  ) {
    return 'CSKH';
  }

  // 5. Quản lý
  if (
    cId.toUpperCase().startsWith('QL') ||
    cNumber.toUpperCase().startsWith('QL') ||
    raw.includes('quản lý')
  ) {
    return 'Quản lý';
  }

  // 6. Mặc định: Siêu thị (Quầy 1-27, SSC, KGFL1, Tầng 2, Tự chọn...)
  return 'Siêu thị';
}

/**
 * Trả về danh sách màu sắc & badge đại diện cho từng khu vực
 */
export function getZoneBadgeConfig(zone: string): { bg: string; text: string; border: string; label: string } {
  switch (zone) {
    case 'Bánh mì':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        border: 'border-amber-300',
        label: 'Bánh mì',
      };
    case 'Delica':
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        border: 'border-orange-300',
        label: 'Delica',
      };
    case 'Mỹ phẩm - Dược phẩm':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        border: 'border-purple-300',
        label: 'Mỹ phẩm / Dược',
      };
    case 'CSKH':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-300',
        label: 'CSKH',
      };
    case 'Quản lý':
      return {
        bg: 'bg-slate-200',
        text: 'text-slate-800',
        border: 'border-slate-300',
        label: 'Quản lý',
      };
    case 'Siêu thị':
    default:
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-800',
        border: 'border-emerald-300',
        label: 'Siêu thị',
      };
  }
}

/**
 * Kiểm tra xem nhân viên có đủ kỹ năng/khả năng đứng quầy khu vực này không
 * - Bánh mì: canBanhMy hoặc là SUP
 * - Delica: canDelica hoặc là SUP
 * - Siêu thị: canSieuThi !== false (hoặc SUP)
 */
export function isEmployeeCapableForZone(
  employee: Partial<Employee> | undefined,
  zone: ZoneType
): boolean {
  if (!employee) return true;
  if (employee.isSup) return true; // SUP có thể đứng mọi quầy

  if (zone === 'Bánh mì') {
    return employee.canBanhMy === true;
  }
  if (zone === 'Delica') {
    return employee.canDelica === true;
  }
  if (zone === 'Siêu thị') {
    return employee.canSieuThi !== false;
  }
  return true;
}

/**
 * Tìm thông tin nhân viên theo tên hoặc ID
 */
export function findEmployeeRecord(
  employeeName?: string,
  employeeId?: string,
  employeeList?: Employee[]
): Employee | undefined {
  const employees = employeeList || storageService.getEmployees();
  if (employeeId) {
    const cleanId = employeeId.toLowerCase().trim();
    const foundById = employees.find((e) => (e.employeeId || '').toLowerCase().trim() === cleanId);
    if (foundById) return foundById;
  }
  const cleanName = (employeeName || '').toLowerCase().trim();
  if (!cleanName) return undefined;
  return employees.find((e) => (e.fullName || '').toLowerCase().trim() === cleanName);
}

export interface DetailedZoneHistoryItem {
  date: string;
  zone: ZoneType;
  counterId: string;
  counterNumber: string;
  slot: 'morning' | 'afternoon';
  shiftCode?: string;
}

/**
 * Lấy lịch sử khu vực làm việc và quầy chi tiết của tất cả nhân viên theo từng ngày
 */
export function getEmployeeDetailedHistoryMap(allCounters: Counter[]): Map<string, Map<string, DetailedZoneHistoryItem>> {
  const counterMap = new Map<string, Counter>();
  allCounters.forEach((c) => counterMap.set(c.id, c));

  const allAssignments = storageService.getAllAssignments();
  // Map: employeeKey -> Map<dateString, DetailedZoneHistoryItem>
  const historyMap = new Map<string, Map<string, DetailedZoneHistoryItem>>();

  Object.values(allAssignments).forEach((dayAssign: DayDwsAssignment) => {
    if (!dayAssign?.date || !dayAssign?.assignments) return;
    const date = dayAssign.date;

    Object.entries(dayAssign.assignments).forEach(([cId, slotAssign]) => {
      const counter = counterMap.get(cId) || { id: cId, counterNumber: cId, area: 'Siêu thị' };
      const zone = getCounterZone(counter);
      const cNumber = counter.counterNumber || cId;

      if (slotAssign?.morning?.employeeName) {
        const empKey = (slotAssign.morning.employeeId || slotAssign.morning.employeeName).toLowerCase().trim();
        if (!historyMap.has(empKey)) historyMap.set(empKey, new Map());
        historyMap.get(empKey)!.set(date, {
          date,
          zone,
          counterId: cId,
          counterNumber: cNumber,
          slot: 'morning',
          shiftCode: slotAssign.morning.shiftCode,
        });
      }

      if (slotAssign?.afternoon?.employeeName) {
        const empKey = (slotAssign.afternoon.employeeId || slotAssign.afternoon.employeeName).toLowerCase().trim();
        if (!historyMap.has(empKey)) historyMap.set(empKey, new Map());
        historyMap.get(empKey)!.set(date, {
          date,
          zone,
          counterId: cId,
          counterNumber: cNumber,
          slot: 'afternoon',
          shiftCode: slotAssign.afternoon.shiftCode,
        });
      }
    });
  });

  return historyMap;
}

export function getEmployeeZoneHistoryMap(allCounters: Counter[]): Map<string, Map<string, { zone: ZoneType; counterId: string }>> {
  const detailed = getEmployeeDetailedHistoryMap(allCounters);
  const simplified = new Map<string, Map<string, { zone: ZoneType; counterId: string }>>();
  detailed.forEach((dateMap, empKey) => {
    const subMap = new Map<string, { zone: ZoneType; counterId: string }>();
    dateMap.forEach((item, d) => {
      subMap.set(d, { zone: item.zone, counterId: item.counterId });
    });
    simplified.set(empKey, subMap);
  });
  return simplified;
}

/**
 * Lấy danh sách quầy nhân viên đã đứng trong N ngày gần nhất (mặc định 3 ngày gần nhất)
 */
export function getEmployeeRecentCounters(
  employeeName: string,
  employeeId: string | undefined,
  targetDate: string,
  allCounters: Counter[],
  maxDays = 3
): RecentCounterAssignment[] {
  if (!employeeName || !targetDate) return [];

  const empKey = (employeeId || employeeName).toLowerCase().trim();
  const historyMap = getEmployeeDetailedHistoryMap(allCounters);
  const empHistory = historyMap.get(empKey);
  if (!empHistory) return [];

  const currDate = new Date(targetDate);
  if (isNaN(currDate.getTime())) return [];

  const results: RecentCounterAssignment[] = [];
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  for (let i = 1; i <= maxDays; i++) {
    const d = new Date(currDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const item = empHistory.get(dateStr);

    if (item) {
      const dayOfWeekNum = d.getDay();
      const dayShort = `${dayNames[dayOfWeekNum]} (${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)})`;
      results.push({
        date: dateStr,
        dayNameShort: dayShort,
        counterId: item.counterId,
        counterNumber: item.counterNumber,
        zone: item.zone,
        slot: item.slot,
        shiftCode: item.shiftCode,
      });
    }
  }

  return results;
}

/**
 * Kiểm tra xem khi xếp nhân viên vào quầy ở ngày targetDate có tạo thành 3 ngày liên tiếp đứng cùng 1 khu vực hay không
 * QUY TẮC: Nhân viên SUP có thể đứng siêu thị nhiều ngày mà không hiện cảnh báo!
 */
export function checkZoneStreakWarning(
  employeeName: string,
  employeeId: string | undefined,
  targetDate: string,
  targetCounter: Counter | string,
  allCounters: Counter[],
  isSupOverride?: boolean
): ZoneStreakWarning | null {
  if (!employeeName || !targetDate) return null;

  const targetCounterObj: Counter =
    typeof targetCounter === 'string'
      ? allCounters.find((c) => c.id === targetCounter) || { id: targetCounter, counterNumber: targetCounter, area: 'Siêu thị' }
      : targetCounter;

  const targetZone = getCounterZone(targetCounterObj);

  // Kiểm tra nhân viên có phải SUP không
  let isSup = isSupOverride;
  if (isSup === undefined) {
    const empRecord = findEmployeeRecord(employeeName, employeeId);
    isSup = empRecord?.isSup === true;
  }

  // QUY TẮC ĐẶC BIỆT: Nhân viên SUP bỏ qua mọi cảnh báo về xếp quầy
  if (isSup) {
    return null;
  }

  const empKey = (employeeId || employeeName).toLowerCase().trim();
  const historyMap = getEmployeeZoneHistoryMap(allCounters);
  const empHistory = historyMap.get(empKey);

  if (!empHistory) return null;

  // Tính 2 ngày trước targetDate
  const currDate = new Date(targetDate);
  if (isNaN(currDate.getTime())) return null;

  const getPastDateStr = (daysAgo: number) => {
    const d = new Date(currDate);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const dayMinus1 = getPastDateStr(1);
  const dayMinus2 = getPastDateStr(2);

  const prev1 = empHistory.get(dayMinus1);
  const prev2 = empHistory.get(dayMinus2);

  // Điều kiện 3 ngày liên tiếp:
  // Ngày D-2: làm ở targetZone
  // Ngày D-1: làm ở targetZone
  // Ngày D (hôm nay): đang chuẩn bị phân vào targetZone
  if (prev1 && prev1.zone === targetZone && prev2 && prev2.zone === targetZone) {
    const dates = [dayMinus2, dayMinus1, targetDate];

    // Kiểm tra thêm ngày D-3, D-4 nếu chuỗi dài hơn
    let streakCount = 3;
    let lookback = 3;
    while (lookback <= 7) {
      const pastD = getPastDateStr(lookback);
      const pastRecord = empHistory.get(pastD);
      if (pastRecord && pastRecord.zone === targetZone) {
        streakCount++;
        dates.unshift(pastD);
        lookback++;
      } else {
        break;
      }
    }

    return {
      employeeName,
      employeeId,
      isSup,
      targetZone,
      targetCounterId: targetCounterObj.id,
      targetCounterNumber: targetCounterObj.counterNumber,
      targetSlot: 'morning',
      streakDays: streakCount,
      dates,
    };
  }

  return null;
}

/**
 * Lấy tóm tắt lịch sử 3 ngày gần nhất của nhân viên để hiển thị gợi ý (bao gồm quầy cụ thể và khu vực)
 */
export function getEmployeeRecentZoneSummary(
  employeeName: string,
  employeeId: string | undefined,
  targetDate: string,
  allCounters: Counter[],
  isSupOverride?: boolean
): EmployeeRecentHistorySummary {
  const empKey = (employeeId || employeeName).toLowerCase().trim();
  const historyMap = getEmployeeDetailedHistoryMap(allCounters);
  const empHistory = historyMap.get(empKey);

  let isSup = isSupOverride;
  if (isSup === undefined) {
    const empRecord = findEmployeeRecord(employeeName, employeeId);
    isSup = empRecord?.isSup === true;
  }

  const recentCounters = getEmployeeRecentCounters(employeeName, employeeId, targetDate, allCounters, 3);
  const recentCounterNumbers = recentCounters.map((r) => r.counterNumber || r.counterId);
  const lastWorkedCounterNumber = recentCounters[0]?.counterNumber || recentCounters[0]?.counterId;

  if (!empHistory || recentCounters.length === 0) {
    return {
      streakZone: null,
      streakCount: 0,
      recentHistoryText: 'Chưa có dữ liệu 3 ngày trước',
      isSup,
      isExemptFromStreakWarning: isSup,
      recentCounters: [],
      recentCounterNumbers: [],
      lastWorkedCounterNumber: undefined,
    };
  }

  const currDate = new Date(targetDate);
  const getPastDateStr = (daysAgo: number) => {
    const d = new Date(currDate);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const d1 = getPastDateStr(1);
  const d2 = getPastDateStr(2);

  const r1 = empHistory.get(d1);
  const r2 = empHistory.get(d2);

  let streakZone: string | null = null;
  let streakCount = 0;

  if (r1 && r2 && r1.zone === r2.zone) {
    streakZone = r1.zone;
    streakCount = 2;
  } else if (r1) {
    streakZone = r1.zone;
    streakCount = 1;
  }

  // Tóm tắt lịch sử hiển thị cả Quầy và Khu vực
  const textParts = recentCounters.map((rc) => `${rc.dayNameShort}: Q.${rc.counterNumber} (${rc.zone})`);

  return {
    streakZone,
    streakCount,
    recentHistoryText: textParts.length > 0 ? textParts.join(' → ') : 'Không có ca trong 3 ngày trước',
    isSup,
    isExemptFromStreakWarning: isSup,
    recentCounters,
    recentCounterNumbers,
    lastWorkedCounterNumber,
  };
}
