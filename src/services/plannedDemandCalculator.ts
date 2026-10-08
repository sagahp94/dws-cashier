import {
  WeeklyScheduleEntry,
  Shift,
  Counter,
  Employee,
  DayDwsAssignment,
} from '../types';
import { isOffShift } from './excelService';
import { classifyCounter, classifyShiftTime } from './shiftDemandService';
import { getPlannedTargetByDate, AreaShiftPlannedTarget } from '../config/plannedDemandConfig';

export interface StaffShiftDetail {
  employeeId?: string;
  employeeName: string;
  shiftCode: string;
  startTime?: string;
  timeSlot: 'morning' | 'night';
  area: 'SIEU_THI' | 'FL2';
  isAssigned: boolean;
  assignedCounterNumber?: string;
  assignedSlot?: string;
}

export interface ShiftSlotComparison {
  timeSlot: 'morning' | 'night';
  timeSlotLabel: string; // "Ca sáng" | "Ca tối"
  plannedCounters: number;
  actualStaff: number;
  assignedStaff: number;
  unassignedStaff: number;
  diff: number; // actualStaff - plannedCounters
  status: 'exact' | 'surplus' | 'warning' | 'danger';
  statusLabel: string; // "Đủ nhân sự" | "Dư X người" | "Thiếu X người"
  smartNote: string;
  staffList: StaffShiftDetail[];
}

export interface AreaDemandOverview {
  areaKey: 'SIEU_THI' | 'FL2';
  areaTitle: string; // "SIÊU THỊ" | "FL2"
  areaSubtitle: string; // "SSC01 - Quầy 27" | "Delica & Bánh mỳ / Quầy 101 - 117"
  morning: ShiftSlotComparison;
  night: ShiftSlotComparison;
  totalPlanned: number;
  totalActual: number;
  totalDiff: number;
}

export interface DailyPlannedDemandSummary {
  date: string;
  dayOfWeek: number;
  dayName: string;
  targetBenchmark: AreaShiftPlannedTarget;
  sieuThi: AreaDemandOverview;
  fl2: AreaDemandOverview;
  allSufficient: boolean;
  missingSlotsSummary: string[];
  alertBannerMessage: string;
  totalDayWorkingStaff: number;
  totalDayMorningStaff: number;
  totalDayNightStaff: number;
  totalDayPlannedCounters: number;
  totalDayUnassignedStaff: number;
}

/**
 * Phân loại khu vực cho nhân viên:
 * 1. Nếu đã được gán vào quầy trong ngày -> lấy theo khu vực của quầy đó
 * 2. Nếu chưa gán -> đối chiếu với phòng ban/kỹ năng trong danh mục Employee:
 *    - Department chứa 'T2', 'FL2', 'Delica', 'Bánh mỳ' -> FL2
 *    - Department chứa 'T1', 'Siêu thị' -> SIEU_THI
 *    - Có kỹ năng Delica/Bánh mỳ và không có Siêu thị -> FL2
 *    - Mặc định: SIEU_THI
 */
export function classifyEmployeeArea(
  empProfile?: Employee,
  assignedCounterArea?: 'SIEU_THI' | 'FL2' | 'OTHER'
): 'SIEU_THI' | 'FL2' {
  if (assignedCounterArea === 'FL2') return 'FL2';
  if (assignedCounterArea === 'SIEU_THI') return 'SIEU_THI';

  if (empProfile) {
    const dept = (empProfile.department || '').toLowerCase();
    if (dept.includes('t2') || dept.includes('fl2') || dept.includes('delica') || dept.includes('bánh')) {
      return 'FL2';
    }
    if (dept.includes('t1') || dept.includes('st') || dept.includes('siêu thị')) {
      return 'SIEU_THI';
    }
    if ((empProfile.canDelica || empProfile.canBanhMy) && !empProfile.canSieuThi) {
      return 'FL2';
    }
  }

  return 'SIEU_THI';
}

/**
 * Tính toán so sánh toàn diện giữa Nhân sự thực tế và Số quầy dự kiến cho một ngày cụ thể
 */
export function calculateDailyPlannedDemand(
  date: string,
  weeklySchedule: WeeklyScheduleEntry[],
  shifts: Shift[],
  counters: Counter[],
  employees: Employee[],
  currentAssignment: DayDwsAssignment | null
): DailyPlannedDemandSummary {
  const targetBenchmark = getPlannedTargetByDate(date);
  const dayOfWeek = targetBenchmark.dayOfWeek;
  const dayName = targetBenchmark.dayName;

  // Map tra cứu nhanh
  const shiftMap = new Map<string, Shift>();
  shifts.forEach((s) => shiftMap.set((s.shiftCode || '').toUpperCase().trim(), s));

  const counterMap = new Map<string, Counter>();
  counters.forEach((c) => counterMap.set(c.id, c));

  const empCatalogMap = new Map<string, Employee>();
  employees.forEach((e) => {
    if (e.employeeId) empCatalogMap.set(e.employeeId.toLowerCase().trim(), e);
    if (e.fullName) empCatalogMap.set(e.fullName.toLowerCase().trim(), e);
  });

  // Track thông tin quầy đã gán của nhân viên trong ngày
  const assignedStaffMap = new Map<
    string,
    {
      counterId: string;
      counterNumber: string;
      counterArea: 'SIEU_THI' | 'FL2' | 'OTHER';
      slot: 'morning' | 'afternoon';
    }
  >();

  if (currentAssignment && currentAssignment.assignments) {
    Object.entries(currentAssignment.assignments).forEach(([cId, ca]) => {
      const cObj = counterMap.get(cId);
      const cNum = cObj ? cObj.counterNumber : cId;
      const cArea = cObj ? classifyCounter(cObj) : 'OTHER';

      const checkAndRecord = (slotData: any, slotName: 'morning' | 'afternoon') => {
        if (!slotData) return;
        const keyId = slotData.employeeId ? slotData.employeeId.toLowerCase().trim() : '';
        const keyName = slotData.employeeName ? slotData.employeeName.toLowerCase().trim() : '';
        const info = { counterId: cId, counterNumber: cNum, counterArea: cArea, slot: slotName };
        if (keyId) assignedStaffMap.set(keyId, info);
        if (keyName) assignedStaffMap.set(keyName, info);
      };

      checkAndRecord(ca.morning, 'morning');
      checkAndRecord(ca.morning2, 'morning');
      checkAndRecord(ca.afternoon, 'afternoon');
      checkAndRecord(ca.afternoon2, 'afternoon');
    });
  }

  // Danh sách nhân sự đi làm trong ngày
  const dayEntries = weeklySchedule.filter((e) => e.date === date);

  const sieuThiMorningList: StaffShiftDetail[] = [];
  const sieuThiNightList: StaffShiftDetail[] = [];
  const fl2MorningList: StaffShiftDetail[] = [];
  const fl2NightList: StaffShiftDetail[] = [];

  let totalDayWorkingStaff = 0;
  let totalDayMorningStaff = 0;
  let totalDayNightStaff = 0;
  let totalDayUnassignedStaff = 0;

  dayEntries.forEach((entry) => {
    const shiftCode = (entry.shiftCode || '').toUpperCase().trim();
    if (!shiftCode) return;

    // Kiểm tra ca nghỉ (OFF, AL, RO, DO, PRD, TS...)
    const shiftObj = shiftMap.get(shiftCode) || null;
    const isOff = shiftObj
      ? shiftObj.isOff || shiftObj.category === 'off' || isOffShift(shiftObj.shiftCode, shiftObj.shiftType, shiftObj.startTime, shiftObj.endTime)
      : isOffShift(shiftCode, '');

    if (isOff) return;

    const timeCat = classifyShiftTime(shiftCode, shifts);
    if (timeCat === 'OFF') return;

    totalDayWorkingStaff++;
    if (timeCat === 'MORNING') {
      totalDayMorningStaff++;
    } else {
      totalDayNightStaff++;
    }

    // Tra cứu phân công quầy và hồ sơ nhân viên
    const keyId = entry.employeeId ? entry.employeeId.toLowerCase().trim() : '';
    const keyName = entry.employeeName ? entry.employeeName.toLowerCase().trim() : '';
    const assignInfo = (keyId ? assignedStaffMap.get(keyId) : null) || (keyName ? assignedStaffMap.get(keyName) : null);

    const empProfile = (keyId ? empCatalogMap.get(keyId) : null) || (keyName ? empCatalogMap.get(keyName) : null);
    const area = classifyEmployeeArea(empProfile, assignInfo?.counterArea);

    const isAssigned = !!assignInfo;
    if (!isAssigned) {
      totalDayUnassignedStaff++;
    }

    const staffDetail: StaffShiftDetail = {
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      shiftCode: entry.shiftCode,
      startTime: shiftObj?.startTime || (timeCat === 'NIGHT' ? '13:00' : '08:00'),
      timeSlot: timeCat === 'MORNING' ? 'morning' : 'night',
      area,
      isAssigned,
      assignedCounterNumber: assignInfo?.counterNumber,
      assignedSlot: assignInfo?.slot,
    };

    if (area === 'SIEU_THI') {
      if (timeCat === 'MORNING') {
        sieuThiMorningList.push(staffDetail);
      } else {
        sieuThiNightList.push(staffDetail);
      }
    } else {
      if (timeCat === 'MORNING') {
        fl2MorningList.push(staffDetail);
      } else {
        fl2NightList.push(staffDetail);
      }
    }
  });

  // Helper tạo thống kê cho từng ca
  const buildSlotComparison = (
    timeSlot: 'morning' | 'night',
    plannedCounters: number,
    staffList: StaffShiftDetail[]
  ): ShiftSlotComparison => {
    const timeSlotLabel = timeSlot === 'morning' ? 'Ca sáng' : 'Ca tối';
    const actualStaff = staffList.length;
    const assignedStaff = staffList.filter((s) => s.isAssigned).length;
    const unassignedStaff = actualStaff - assignedStaff;
    const diff = actualStaff - plannedCounters;

    let status: ShiftSlotComparison['status'] = 'exact';
    let statusLabel = 'Đủ nhân sự';

    if (diff === 0) {
      status = 'exact';
      statusLabel = 'Đủ nhân sự';
    } else if (diff > 0) {
      status = 'surplus';
      statusLabel = `Dư ${diff} người`;
    } else {
      const missing = Math.abs(diff);
      status = missing <= 2 ? 'warning' : 'danger';
      statusLabel = `Thiếu ${missing} người`;
    }

    // Smart note
    let smartNote = '';
    if (diff < 0) {
      smartNote = `Thiếu ${Math.abs(diff)} nhân sự để đạt kế hoạch mở quầy.`;
    } else if (unassignedStaff > 0) {
      smartNote = `Đủ nhân sự nhưng còn ${unassignedStaff} người chưa được phân quầy.`;
    } else {
      smartNote = 'Đã phân đủ nhân sự vào quầy theo kế hoạch.';
    }

    return {
      timeSlot,
      timeSlotLabel,
      plannedCounters,
      actualStaff,
      assignedStaff,
      unassignedStaff,
      diff,
      status,
      statusLabel,
      smartNote,
      staffList,
    };
  };

  const sieuThiMorning = buildSlotComparison('morning', targetBenchmark.sieuThi.morning, sieuThiMorningList);
  const sieuThiNight = buildSlotComparison('night', targetBenchmark.sieuThi.night, sieuThiNightList);

  const fl2Morning = buildSlotComparison('morning', targetBenchmark.fl2.morning, fl2MorningList);
  const fl2Night = buildSlotComparison('night', targetBenchmark.fl2.night, fl2NightList);

  const sieuThi: AreaDemandOverview = {
    areaKey: 'SIEU_THI',
    areaTitle: 'SIÊU THỊ',
    areaSubtitle: 'SSC01 - Quầy 27 (Tầng 1)',
    morning: sieuThiMorning,
    night: sieuThiNight,
    totalPlanned: targetBenchmark.sieuThi.total,
    totalActual: sieuThiMorning.actualStaff + sieuThiNight.actualStaff,
    totalDiff: (sieuThiMorning.actualStaff + sieuThiNight.actualStaff) - targetBenchmark.sieuThi.total,
  };

  const fl2: AreaDemandOverview = {
    areaKey: 'FL2',
    areaTitle: 'FL2',
    areaSubtitle: 'Delica & Bánh mì / Quầy 101 - 117 (Tầng 2)',
    morning: fl2Morning,
    night: fl2Night,
    totalPlanned: targetBenchmark.fl2.total,
    totalActual: fl2Morning.actualStaff + fl2Night.actualStaff,
    totalDiff: (fl2Morning.actualStaff + fl2Night.actualStaff) - targetBenchmark.fl2.total,
  };

  // Cảnh báo tổng quan toàn ngày
  const missingSlotsSummary: string[] = [];
  if (sieuThiMorning.diff < 0) {
    missingSlotsSummary.push(`SIÊU THỊ sáng: thiếu ${Math.abs(sieuThiMorning.diff)}`);
  }
  if (sieuThiNight.diff < 0) {
    missingSlotsSummary.push(`SIÊU THỊ tối: thiếu ${Math.abs(sieuThiNight.diff)}`);
  }
  if (fl2Morning.diff < 0) {
    missingSlotsSummary.push(`FL2 sáng: thiếu ${Math.abs(fl2Morning.diff)}`);
  }
  if (fl2Night.diff < 0) {
    missingSlotsSummary.push(`FL2 tối: thiếu ${Math.abs(fl2Night.diff)}`);
  }

  const allSufficient = missingSlotsSummary.length === 0;
  const alertBannerMessage = allSufficient
    ? '✓ Nhân sự hôm nay đáp ứng kế hoạch mở quầy.'
    : `⚠ Hôm nay có ${missingSlotsSummary.length} ca chưa đủ nhân sự theo kế hoạch mở quầy.`;

  return {
    date,
    dayOfWeek,
    dayName,
    targetBenchmark,
    sieuThi,
    fl2,
    allSufficient,
    missingSlotsSummary,
    alertBannerMessage,
    totalDayWorkingStaff,
    totalDayMorningStaff,
    totalDayNightStaff,
    totalDayPlannedCounters: targetBenchmark.grandTotal,
    totalDayUnassignedStaff,
  };
}
