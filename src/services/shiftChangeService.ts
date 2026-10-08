import { Shift, Counter, WeeklyScheduleEntry, DayDwsAssignment } from '../types';
import { storageService } from './storageService';
import { isOffShift } from './excelService';
import { getDayNameVietnamese } from '../utils/dateUtils';

export interface ShiftChangeConflict {
  id: string; // unique ID: `${date}_${employeeName}_${counterId}_${assignedSlot}`
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Thứ Hai, 17/08/2026"
  employeeId?: string;
  employeeName: string;
  counterId: string;
  counterNumber: string;
  counterArea?: string;
  assignedSlot: 'morning' | 'morning2' | 'afternoon' | 'afternoon2';
  oldShiftCode: string;
  newShiftCode: string;
  oldCategory: 'morning' | 'afternoon' | 'off' | 'other';
  newCategory: 'morning' | 'afternoon' | 'off' | 'other';
  changeType: 'afternoon_to_morning' | 'morning_to_afternoon';
  message: string;
}

/**
 * Detect shift category (morning, afternoon, off, other)
 * - Morning shifts: start before 13:00 or standard codes (V814, V815, V615, V818, V618, etc.)
 * - Afternoon shifts: start at or after 13:00 or standard codes (V820, V822, V829, V830, V633, etc.)
 */
export function detectShiftCategory(
  shiftCode: string,
  shifts: Shift[] = []
): 'morning' | 'afternoon' | 'off' | 'other' {
  if (!shiftCode) return 'other';
  const code = shiftCode.toUpperCase().trim();

  if (isOffShift(code, '')) return 'off';

  // Check against defined shifts list
  const matched = shifts.find((s) => s.shiftCode.toUpperCase().trim() === code);
  if (matched) {
    if (matched.isOff || matched.category === 'off') return 'off';
    if (matched.category === 'morning') return 'morning';
    if (matched.category === 'afternoon') return 'afternoon';
    if (matched.startTime) {
      const [h] = matched.startTime.split(':').map((x) => parseInt(x, 10));
      if (!isNaN(h)) {
        return h < 13 ? 'morning' : 'afternoon';
      }
    }
  }

  // Fallback by standard AEON shift code conventions:
  // Afternoon / Night shifts (starting from 13:00 onwards)
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
    code.startsWith('C') ||
    code.startsWith('T')
  ) {
    return 'afternoon';
  }

  // Morning shifts (starting before 13:00)
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
    code.startsWith('S') ||
    code.startsWith('V8')
  ) {
    return 'morning';
  }

  return 'other';
}

/**
 * Scan newly uploaded weekly schedule entries against existing counter assignments.
 * Detects if an employee already assigned to a counter has their shift changed
 * between morning and afternoon (afternoon -> morning or morning -> afternoon).
 */
export function findShiftChangeConflicts(
  newEntries: WeeklyScheduleEntry[],
  shifts: Shift[],
  counters: Counter[]
): ShiftChangeConflict[] {
  if (!newEntries || newEntries.length === 0) return [];

  const conflicts: ShiftChangeConflict[] = [];
  const counterMap = new Map<string, Counter>();
  counters.forEach((c) => counterMap.set(c.id, c));

  // Cache day assignments by date to avoid repeated lookups
  const assignmentCache = new Map<string, DayDwsAssignment | null>();
  const getDayAssignmentCached = (date: string): DayDwsAssignment | null => {
    if (!assignmentCache.has(date)) {
      assignmentCache.set(date, storageService.getAssignment(date));
    }
    return assignmentCache.get(date) || null;
  };

  // Group new entries by employee + date to avoid duplicate checks in same batch
  const checkedKeys = new Set<string>();

  for (const entry of newEntries) {
    if (!entry.date || !entry.employeeName || !entry.shiftCode) continue;

    // Skip if shift is OFF (OFF is handled separately by off-shift validators)
    if (isOffShift(entry.shiftCode, '')) continue;

    const key = `${(entry.employeeName || '').toLowerCase().trim()}_${entry.date}`;
    if (checkedKeys.has(key)) continue;
    checkedKeys.add(key);

    const dayAssignment = getDayAssignmentCached(entry.date);
    if (!dayAssignment || !dayAssignment.assignments) continue;

    const empNameClean = entry.employeeName.toLowerCase().trim();
    const empIdClean = entry.employeeId ? entry.employeeId.toLowerCase().trim() : '';

    // Search across all counter assignments on this day
    for (const [counterId, ca] of Object.entries(dayAssignment.assignments)) {
      const slotsToCheck: Array<{
        slotName: 'morning' | 'morning2' | 'afternoon' | 'afternoon2';
        slotData: any;
      }> = [
        { slotName: 'morning', slotData: ca.morning },
        { slotName: 'morning2', slotData: ca.morning2 },
        { slotName: 'afternoon', slotData: ca.afternoon },
        { slotName: 'afternoon2', slotData: ca.afternoon2 },
      ];

      for (const { slotName, slotData } of slotsToCheck) {
        if (!slotData) continue;

        const assignedName = (slotData.employeeName || '').toLowerCase().trim();
        const assignedId = slotData.employeeId ? slotData.employeeId.toLowerCase().trim() : '';

        // Ignore generic STT digits (e.g. "1", "2") for ID-only matching
        const isGenericStt = /^\d{1,3}$/.test(assignedId) && /^\d{1,3}$/.test(empIdClean);

        const isMatch =
          (assignedName && empNameClean && assignedName === empNameClean) ||
          (assignedId && empIdClean && assignedId === empIdClean && !isGenericStt);

        if (!isMatch) continue;

        // Employee IS assigned to this counter on this date!
        const oldShiftCode = (slotData.shiftCode || '').trim();
        const newShiftCode = (entry.shiftCode || '').trim();

        // Detect categories
        const oldCategory = detectShiftCategory(oldShiftCode, shifts);
        const newCategory = detectShiftCategory(newShiftCode, shifts);

        const isMorningSlot = slotName === 'morning' || slotName === 'morning2';
        const isAfternoonSlot = slotName === 'afternoon' || slotName === 'afternoon2';

        // Check if shift is changed from afternoon to morning or morning to afternoon
        const isAfternoonToMorning =
          (oldCategory === 'afternoon' && newCategory === 'morning') ||
          (isAfternoonSlot && newCategory === 'morning');

        const isMorningToAfternoon =
          (oldCategory === 'morning' && newCategory === 'afternoon') ||
          (isMorningSlot && newCategory === 'afternoon');

        const isChanged = (isAfternoonToMorning || isMorningToAfternoon) && (oldShiftCode.toUpperCase() !== newShiftCode.toUpperCase());

        if (isChanged) {
          const counterObj = counterMap.get(counterId);
          const counterDisplay = counterObj?.counterNumber || counterId;
          const counterArea = counterObj?.area || '';
          const dayName = getDayNameVietnamese(entry.date);

          const changeType = isAfternoonToMorning ? 'afternoon_to_morning' : 'morning_to_afternoon';

          // Exact requested string:
          // "Nhân viên {tên nhân viên} đã bị thay đổi ca làm việc từ {ca cũ} thành ca {ca mới}. Xóa phân quẩy? -> chọn "CÓ" để xóa khỏi quầy hiện tại và đưa vào danh sách chưa phân quầy"
          const displayOldShift = oldShiftCode || (isAfternoonSlot ? 'Ca Chiều' : 'Ca Sáng');
          const displayNewShift = newShiftCode;
          const message = `Nhân viên ${entry.employeeName} đã bị thay đổi ca làm việc từ ${displayOldShift} thành ca ${displayNewShift}. Xóa phân quẩy? -> chọn "CÓ" để xóa khỏi quầy hiện tại và đưa vào danh sách chưa phân quầy`;

          conflicts.push({
            id: `${entry.date}_${entry.employeeName}_${counterId}_${slotName}`,
            date: entry.date,
            dayName,
            employeeId: entry.employeeId || slotData.employeeId,
            employeeName: entry.employeeName,
            counterId,
            counterNumber: counterDisplay,
            counterArea,
            assignedSlot: slotName,
            oldShiftCode: displayOldShift,
            newShiftCode: displayNewShift,
            oldCategory,
            newCategory,
            changeType,
            message,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Remove resolved employees from their counters in storage.
 * This frees up the counter slot and places the employee into the unassigned pool.
 */
export function removeEmployeesFromCounters(
  conflictsToRemove: ShiftChangeConflict[]
): { removedCount: number } {
  if (!conflictsToRemove || conflictsToRemove.length === 0) {
    return { removedCount: 0 };
  }

  // Group by date
  const byDate = new Map<string, ShiftChangeConflict[]>();
  conflictsToRemove.forEach((c) => {
    const list = byDate.get(c.date) || [];
    list.push(c);
    byDate.set(c.date, list);
  });

  let totalRemoved = 0;

  byDate.forEach((conflictList, date) => {
    const dayAssignment = storageService.getAssignment(date);
    if (!dayAssignment || !dayAssignment.assignments) return;

    let modified = false;

    conflictList.forEach((conflict) => {
      const empNameClean = conflict.employeeName.toLowerCase().trim();
      const empIdClean = conflict.employeeId ? conflict.employeeId.toLowerCase().trim() : '';

      // Direct clear on specified counter
      const ca = dayAssignment.assignments[conflict.counterId];
      if (ca) {
        if (ca[conflict.assignedSlot]) {
          ca[conflict.assignedSlot] = null;
          modified = true;
          totalRemoved++;
        }
      }

      // Safety sweep: Also clean any other slot on this day assigned to this employee
      Object.values(dayAssignment.assignments).forEach((cItem) => {
        const slots: Array<'morning' | 'morning2' | 'afternoon' | 'afternoon2'> = [
          'morning',
          'morning2',
          'afternoon',
          'afternoon2',
        ];
        slots.forEach((s) => {
          const slotObj = cItem[s];
          if (slotObj) {
            const matchName = (slotObj.employeeName || '').toLowerCase().trim() === empNameClean;
            const matchId = empIdClean && slotObj.employeeId && slotObj.employeeId.toLowerCase().trim() === empIdClean;
            if (matchName || matchId) {
              cItem[s] = null;
              modified = true;
            }
          }
        });
      });
    });

    if (modified) {
      storageService.saveAssignment(dayAssignment);
    }
  });

  return { removedCount: totalRemoved };
}
