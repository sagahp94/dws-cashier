import { storageService } from './storageService';
import { isOffShift } from './excelService';
import { Counter, Employee, WeeklyScheduleEntry } from '../types';
import { getCounterMonitoredCluster } from './consecutiveWarningService';

export interface PastWorkingDayRecord {
  date: string;              // YYYY-MM-DD
  dateLabel: string;         // e.g. "Thứ Tư, 19/08"
  dayOfWeekName: string;     // e.g. "Thứ 4"
  shiftCode: string;         // Mã ca làm việc ngày hôm đó
  counterNumber?: string;    // Số quầy (ví dụ: "05", "12", "SSC 03")
  counterId?: string;
  counterArea?: string;      // Khu vực (Siêu thị, Bánh mỳ, Delica...)
  clusterShortLabel?: string;// Cụm quầy kiểm soát (SSC-17, 20-27...)
  slot?: 'morning' | 'afternoon';
  slotLabel?: string;        // "Ca Sáng" / "Ca Chiều"
  wasAssigned: boolean;      // true nếu đứng quầy, false nếu có ca làm việc nhưng chưa phân quầy
}

export interface EmployeeShiftChangeInfo {
  hasChanged: boolean;
  currentShiftCode: string;
  originalShiftCode?: string;
  previousShiftCode?: string;
  modifiedAt?: string;
  modificationNote?: string;
  isHardRosterSynced?: boolean;
  syncedAt?: string;
}

export interface EmployeeProfileInfo {
  fullName: string;
  employeeId?: string;
  isSup: boolean;
  canSieuThi: boolean;
  canBanhMy: boolean;
  canDelica: boolean;
  phone?: string;
  department?: string;
}

export interface Employee3DaysHistoryResult {
  employeeName: string;
  employeeId?: string;
  currentDate: string;
  profile: EmployeeProfileInfo;
  shiftToday: EmployeeShiftChangeInfo;
  history: PastWorkingDayRecord[];
  skippedOffDaysCount: number;
}

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/**
 * Format ngày thành "Thứ X, DD/MM"
 */
function formatShortDateWithDay(dateStr: string): { label: string; dayName: string } {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayName = DAY_NAMES[d.getDay()];
      const dd = parts[2];
      const mm = parts[1];
      return {
        label: `${dayName}, ${dd}/${mm}`,
        dayName,
      };
    }
  } catch {
    // fallback
  }
  return { label: dateStr, dayName: '' };
}

/**
 * Lấy hồ sơ nhân viên từ danh mục nhân viên
 */
export function getEmployeeProfile(employeeName: string, employeeId?: string): EmployeeProfileInfo {
  const employees = storageService.getEmployees();
  const cleanName = (employeeName || '').trim().toLowerCase();
  const cleanId = (employeeId || '').trim().toLowerCase();

  const found = employees.find((e) => {
    const eId = (e.employeeId || '').trim().toLowerCase();
    const eName = (e.fullName || '').trim().toLowerCase();
    if (cleanId && eId && cleanId === eId) return true;
    return cleanName && eName === cleanName;
  });

  if (found) {
    return {
      fullName: found.fullName,
      employeeId: found.employeeId,
      isSup: !!found.isSup,
      canSieuThi: found.canSieuThi !== false,
      canBanhMy: !!found.canBanhMy,
      canDelica: !!found.canDelica,
      phone: found.phone,
      department: found.department,
    };
  }

  return {
    fullName: employeeName,
    employeeId,
    isSup: false,
    canSieuThi: true,
    canBanhMy: false,
    canDelica: false,
    department: 'Thu ngân',
  };
}

/**
 * Lấy thông tin ca làm việc ngày hôm nay và kiểm tra xem ca có bị điều chỉnh/sửa hay không
 */
export function getEmployeeShiftTodayInfo(
  employeeName: string,
  employeeId: string | undefined,
  currentDate: string,
  currentShiftCodeFallback?: string,
  scheduleOverride?: WeeklyScheduleEntry[]
): EmployeeShiftChangeInfo {
  const cleanName = (employeeName || '').trim().toLowerCase();
  const cleanId = (employeeId || '').trim().toLowerCase();

  // Tìm trong lịch tuần được truyền vào hoặc toàn bộ lịch tuần trong storage
  let entry: WeeklyScheduleEntry | undefined;
  if (scheduleOverride && scheduleOverride.length > 0) {
    entry = scheduleOverride.find((e) => {
      if (e.date !== currentDate) return false;
      const eName = (e.employeeName || '').trim().toLowerCase();
      const eId = (e.employeeId || '').trim().toLowerCase();
      if (cleanId && eId && cleanId === eId) return true;
      return cleanName && eName === cleanName;
    });
  }

  if (!entry) {
    const all = storageService.getAllWeeklySchedules();
    for (const entries of Object.values(all)) {
      const match = entries.find((e) => {
        if (e.date !== currentDate) return false;
        const eName = (e.employeeName || '').trim().toLowerCase();
        const eId = (e.employeeId || '').trim().toLowerCase();
        if (cleanId && eId && cleanId === eId) return true;
        return cleanName && eName === cleanName;
      });
      if (match) {
        entry = match;
        break;
      }
    }
  }

  if (entry) {
    const hasChanged = !!entry.originalShiftCode && entry.originalShiftCode !== entry.shiftCode;
    return {
      hasChanged,
      currentShiftCode: entry.shiftCode,
      originalShiftCode: entry.originalShiftCode,
      previousShiftCode: entry.previousShiftCode,
      modifiedAt: entry.modifiedAt,
      modificationNote: entry.modificationNote,
      isHardRosterSynced: entry.isHardRosterSynced,
      syncedAt: entry.syncedAt,
    };
  }

  return {
    hasChanged: false,
    currentShiftCode: currentShiftCodeFallback || 'N/A',
  };
}

/**
 * Tìm lịch sử đứng quầy 3 ngày làm việc gần nhất của nhân viên (KHÔNG TÍNH NGÀY CÓ CA NGHỈ)
 * @param employeeName Tên nhân viên
 * @param employeeId Mã nhân viên
 * @param currentDate Ngày hiện tại đang xem (YYYY-MM-DD)
 * @param allCounters Danh sách tất cả quầy (nếu có để tra cứu tên/khu vực)
 */
export function getEmployee3DaysCounterHistory(
  employeeName: string,
  employeeId: string | undefined,
  currentDate: string,
  allCounters?: Counter[]
): Employee3DaysHistoryResult {
  const profile = getEmployeeProfile(employeeName, employeeId);
  const shiftToday = getEmployeeShiftTodayInfo(employeeName, employeeId, currentDate);

  const cleanName = (employeeName || '').trim().toLowerCase();
  const cleanId = (employeeId || '').trim().toLowerCase();

  const history: PastWorkingDayRecord[] = [];
  let skippedOffDaysCount = 0;

  if (!currentDate) {
    return {
      employeeName,
      employeeId,
      currentDate,
      profile,
      shiftToday,
      history,
      skippedOffDaysCount: 0,
    };
  }

  // Danh mục quầy để tra cứu nhanh thông tin quầy
  const countersList = allCounters && allCounters.length > 0 ? allCounters : storageService.getCounters();
  const counterMap = new Map<string, Counter>();
  countersList.forEach((c) => {
    counterMap.set(c.id, c);
  });

  // Lấy toàn bộ lịch tuần đã lưu để tra cứu ca làm việc các ngày trước
  const allWeekly = storageService.getAllWeeklySchedules();
  const allScheduleEntries = Object.values(allWeekly).flat();

  // Bắt đầu lùi từng ngày một từ ngày hôm qua (currentDate - 1)
  const [cy, cm, cd] = currentDate.split('-').map((n) => parseInt(n, 10));
  const currentD = new Date(cy, cm - 1, cd);

  // Quét tối đa 60 ngày về quá khứ để tìm đủ 3 ngày làm việc
  for (let offset = 1; offset <= 60; offset++) {
    if (history.length >= 3) {
      break;
    }

    const pastDateObj = new Date(currentD);
    pastDateObj.setDate(currentD.getDate() - offset);
    const yStr = pastDateObj.getFullYear();
    const mStr = String(pastDateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(pastDateObj.getDate()).padStart(2, '0');
    const pastDate = `${yStr}-${mStr}-${dStr}`;

    // 1. Kiểm tra lịch làm việc của nhân viên trong ngày pastDate
    const scheduleMatch = allScheduleEntries.find((e) => {
      if (e.date !== pastDate) return false;
      const eName = (e.employeeName || '').trim().toLowerCase();
      const eId = (e.employeeId || '').trim().toLowerCase();
      if (cleanId && eId && cleanId === eId) return true;
      return cleanName && eName === cleanName;
    });

    // Nếu có lịch làm việc và là ca nghỉ (OFF, AL, RO...) -> BỎ QUA NGÀY NÀY!
    if (scheduleMatch) {
      const isOff = scheduleMatch.isOff || isOffShift(scheduleMatch.shiftCode);
      if (isOff) {
        skippedOffDaysCount++;
        continue; // Bỏ qua ngày có ca nghỉ
      }
    }

    // 2. Kiểm tra bản phân quầy DWS của ngày pastDate
    const pastAssignment = storageService.getAssignment(pastDate);

    let assignedSlot: {
      counterId: string;
      slot: 'morning' | 'afternoon';
      shiftCode: string;
    } | null = null;

    if (pastAssignment && pastAssignment.assignments) {
      for (const [cId, ca] of Object.entries(pastAssignment.assignments)) {
        if (ca.morning) {
          const sName = (ca.morning.employeeName || '').trim().toLowerCase();
          const sId = (ca.morning.employeeId || '').trim().toLowerCase();
          if ((cleanId && sId && cleanId === sId) || (cleanName && sName === cleanName)) {
            assignedSlot = {
              counterId: cId,
              slot: 'morning',
              shiftCode: ca.morning.shiftCode,
            };
            break;
          }
        }
        if (ca.afternoon) {
          const sName = (ca.afternoon.employeeName || '').trim().toLowerCase();
          const sId = (ca.afternoon.employeeId || '').trim().toLowerCase();
          if ((cleanId && sId && cleanId === sId) || (cleanName && sName === cleanName)) {
            assignedSlot = {
              counterId: cId,
              slot: 'afternoon',
              shiftCode: ca.afternoon.shiftCode,
            };
            break;
          }
        }
      }
    }

    // 3. Nếu có đứng quầy HOẶC có ca làm việc thực tế (không phải ngày nghỉ)
    if (assignedSlot) {
      const cObj = counterMap.get(assignedSlot.counterId);
      const cluster = cObj ? getCounterMonitoredCluster(cObj) : null;
      const { label, dayName } = formatShortDateWithDay(pastDate);

      history.push({
        date: pastDate,
        dateLabel: label,
        dayOfWeekName: dayName,
        shiftCode: assignedSlot.shiftCode || scheduleMatch?.shiftCode || 'Làm việc',
        counterId: assignedSlot.counterId,
        counterNumber: cObj?.counterNumber || assignedSlot.counterId,
        counterArea: cObj?.area || 'Siêu thị',
        clusterShortLabel: cluster?.shortLabel,
        slot: assignedSlot.slot,
        slotLabel: assignedSlot.slot === 'morning' ? 'Ca Sáng' : 'Ca Chiều',
        wasAssigned: true,
      });
    } else if (scheduleMatch) {
      // Có ca làm việc trong lịch tuần nhưng chưa được phân vào quầy cụ thể
      const { label, dayName } = formatShortDateWithDay(pastDate);
      history.push({
        date: pastDate,
        dateLabel: label,
        dayOfWeekName: dayName,
        shiftCode: scheduleMatch.shiftCode,
        wasAssigned: false,
      });
    }
    // Nếu cả scheduleMatch lẫn assignment đều không có thông tin thì là ngày không có dữ liệu, tiếp tục lùi
  }

  return {
    employeeName,
    employeeId,
    currentDate,
    profile,
    shiftToday,
    history,
    skippedOffDaysCount,
  };
}
