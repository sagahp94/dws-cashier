import {
  Counter,
  Shift,
  Employee,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  UnassignedEmployee,
  SlotAssignment,
} from '../types';
import { storageService } from './storageService';
import { isOffShift } from './excelService';
import { getCounterZone, isEmployeeCapableForZone, findEmployeeRecord } from './zoneTrackingService';
import { checkConsecutiveTwoDayWarning } from './consecutiveWarningService';
import {
  shiftDemandService,
  getCounterMorningRequiredShift,
  isShiftMatchingMorningGroup,
} from './shiftDemandService';
import { getDayOfWeekIndex } from '../utils/dateUtils';

export type SuggestionTier = 'optimal' | 'strong' | 'acceptable' | 'low';

export interface HeuristicBreakdown {
  score: number;
  label: string;
  type: 'positive' | 'warning' | 'neutral';
  icon?: string;
}

export interface EmployeeSuggestion {
  employee: UnassignedEmployee;
  matchScore: number; // 0 - 100
  tier: SuggestionTier;
  tierLabel: string;
  tierColor: string;
  reasons: HeuristicBreakdown[];
  isEligible: boolean;
}

export interface CounterSlotSuggestion {
  counterId: string;
  counterNumber: string;
  counterArea: string;
  slot: 'morning' | 'afternoon';
  slotLabel: string;
  topSuggestion: EmployeeSuggestion | null;
  allSuggestions: EmployeeSuggestion[];
}

export interface EmployeeSlotRecommendation {
  counterId: string;
  counterNumber: string;
  counterArea: string;
  slot: 'morning' | 'afternoon';
  slotLabel: string;
  matchScore: number;
  tier: SuggestionTier;
  reasons: HeuristicBreakdown[];
}

/**
 * Count employee's scheduled shifts in weekly schedule to gauge familiarity
 */
function getEmployeeShiftCount(
  emp: UnassignedEmployee | Employee,
  weeklySchedule: WeeklyScheduleEntry[]
): number {
  const name = (emp.fullName || '').trim().toLowerCase();
  const id = (emp.employeeId || '').trim();

  return weeklySchedule.filter(
    (e) =>
      (id && e.employeeId === id) ||
      (e.employeeName && e.employeeName.trim().toLowerCase() === name)
  ).length;
}

export const autoSuggestService = {
  /**
   * Evaluate a single employee candidate for a target counter slot using multi-factor heuristics
   */
  evaluateCandidate(params: {
    employee: UnassignedEmployee;
    targetCounter: Counter;
    targetSlot: 'morning' | 'afternoon';
    selectedDate: string;
    counters: Counter[];
    shifts: Shift[];
    weeklySchedule: WeeklyScheduleEntry[];
    currentAssignment?: DayDwsAssignment | null;
  }): EmployeeSuggestion {
    const {
      employee,
      targetCounter,
      targetSlot,
      selectedDate,
      counters,
      shifts,
      weeklySchedule,
      currentAssignment,
    } = params;

    const reasons: HeuristicBreakdown[] = [];
    let rawScore = 0;
    let isEligible = true;

    const targetZone = getCounterZone(targetCounter);
    const counterNum = targetCounter.counterNumber || targetCounter.id;
    const shiftCodeUpper = (employee.shiftCode || '').trim().toUpperCase();

    // 1. FACTOR 1: SHIFT SLOT COMPATIBILITY (0 - 35 points)
    const isOff = isOffShift(shiftCodeUpper);
    if (isOff) {
      isEligible = false;
      rawScore -= 100;
      reasons.push({
        score: -100,
        label: `Nhân viên đang trong ca nghỉ (${employee.shiftCode})`,
        type: 'warning',
        icon: '🚫',
      });
    }

    if (targetSlot === 'morning') {
      const requiredMorningGroup = getCounterMorningRequiredShift(targetCounter);
      const isMorningCategory =
        employee.category === 'morning' ||
        (employee.category === 'other' && (!employee.startTime || employee.startTime < '12:30')) ||
        shiftCodeUpper.startsWith('V815') ||
        shiftCodeUpper.startsWith('V818') ||
        shiftCodeUpper.startsWith('V820') ||
        shiftCodeUpper.startsWith('V615');

      if (!isMorningCategory) {
        isEligible = false;
        rawScore -= 50;
        reasons.push({
          score: -50,
          label: `Ca làm việc (${employee.shiftCode}) thuộc Ca Chiều/Tối, không khớp ca sáng`,
          type: 'warning',
          icon: '⚠️',
        });
      } else {
        rawScore += 25;
        reasons.push({
          score: 25,
          label: `Đúng khung giờ Ca Sáng (${employee.startTime || '08:00'} - ${employee.endTime || '17:00'})`,
          type: 'positive',
          icon: '🌅',
        });

        // Specific morning shift group rule (V815 / V818 / V820)
        if (requiredMorningGroup) {
          const isExactGroupMatch = isShiftMatchingMorningGroup(employee.shiftCode, requiredMorningGroup);
          if (isExactGroupMatch) {
            rawScore += 15;
            reasons.push({
              score: 15,
              label: `Khớp chuẩn nhóm ca ${requiredMorningGroup} theo quy định quầy ${counterNum}`,
              type: 'positive',
              icon: '🎯',
            });
          } else {
            rawScore -= 10;
            reasons.push({
              score: -10,
              label: `Quầy ${counterNum} ưu tiên ca ${requiredMorningGroup} (hiện là ${employee.shiftCode})`,
              type: 'warning',
              icon: 'ℹ️',
            });
          }
        }
      }
    } else {
      // Afternoon slot
      const isAfternoonCategory =
        employee.category === 'afternoon' ||
        (employee.category === 'other' && employee.startTime && employee.startTime >= '12:30') ||
        shiftCodeUpper.startsWith('V820') ||
        shiftCodeUpper.startsWith('V822') ||
        shiftCodeUpper.startsWith('V829') ||
        shiftCodeUpper.startsWith('V830') ||
        shiftCodeUpper.startsWith('V633');

      if (!isAfternoonCategory) {
        isEligible = false;
        rawScore -= 50;
        reasons.push({
          score: -50,
          label: `Ca làm việc (${employee.shiftCode}) thuộc Ca Sáng, không khớp ca chiều`,
          type: 'warning',
          icon: '⚠️',
        });
      } else {
        rawScore += 25;
        reasons.push({
          score: 25,
          label: `Đúng khung giờ Ca Chiều (${employee.startTime || '14:00'} - ${employee.endTime || '22:00'})`,
          type: 'positive',
          icon: '🌙',
        });

        // Afternoon V6* prioritization
        const isV6 = shiftCodeUpper.startsWith('V6') || shiftCodeUpper.startsWith('6');
        if (isV6) {
          rawScore += 8;
          reasons.push({
            score: 8,
            label: `Ưu tiên ca tăng cường V6 (${employee.shiftCode}) cho ca chiều tối`,
            type: 'positive',
            icon: '⚡',
          });
        }
      }
    }

    // 2. FACTOR 2: SKILL LEVEL & ZONE QUALIFICATION (0 - 25 points)
    const empRecord = findEmployeeRecord(employee.fullName, employee.employeeId);
    const isCapable = isEmployeeCapableForZone(empRecord || employee, targetZone);

    if (targetZone === 'Bánh mì') {
      if (empRecord?.canBanhMy || employee.canBanhMy) {
        rawScore += 20;
        reasons.push({
          score: 20,
          label: 'Có kỹ năng chuyên môn quầy Bánh mì',
          type: 'positive',
          icon: '🥖',
        });
      } else {
        rawScore -= 25;
        reasons.push({
          score: -25,
          label: 'Chưa có chứng chỉ đứng quầy Bánh mì',
          type: 'warning',
          icon: '⚠️',
        });
      }
    } else if (targetZone === 'Delica') {
      if (empRecord?.canDelica || employee.canDelica) {
        rawScore += 20;
        reasons.push({
          score: 20,
          label: 'Có kỹ năng chuyên môn quầy Delica',
          type: 'positive',
          icon: '🍱',
        });
      } else {
        rawScore -= 25;
        reasons.push({
          score: -25,
          label: 'Chưa có chứng chỉ đứng quầy Delica',
          type: 'warning',
          icon: '⚠️',
        });
      }
    } else if (targetZone === 'Quản lý' || targetCounter.area.toLowerCase().includes('quản lý')) {
      if (employee.isSup || empRecord?.isSup) {
        rawScore += 20;
        reasons.push({
          score: 20,
          label: 'Trình độ Giám sát (SUP) / Quản lý',
          type: 'positive',
          icon: '⭐',
        });
      } else {
        rawScore -= 10;
        reasons.push({
          score: -10,
          label: 'Quầy giám sát / điều phối (Ưu tiên SUP)',
          type: 'warning',
          icon: 'ℹ️',
        });
      }
    } else {
      // Standard Supermarket / Self-checkout
      if (isCapable) {
        rawScore += 12;
      }
    }

    // 3. FACTOR 3: SCHEDULE EXPERIENCE (0 - 15 points)
    const shiftCount = getEmployeeShiftCount(employee, weeklySchedule);
    if (shiftCount >= 4) {
      rawScore += 10;
      reasons.push({
        score: 10,
        label: `Lịch tuần ổn định (${shiftCount} ca trong tuần)`,
        type: 'positive',
        icon: '📊',
      });
    }

    // 4. FACTOR 4: FIXED RULES & SHIFT PRIORITY CONFIG (0 - 20 points)
    const rules = storageService.getAssignmentRules();
    const dayOfWeek = getDayOfWeekIndex(selectedDate);
    const matchingFixedRule = rules.fixedRules?.find((r) => {
      if (!r.active) return false;
      const isEmpMatch =
        (r.employeeId && r.employeeId === employee.employeeId) ||
        r.employeeName.trim().toLowerCase() === employee.fullName.trim().toLowerCase();
      if (!isEmpMatch) return false;
      const isCounterMatch = r.counterId === targetCounter.id;
      if (!isCounterMatch) return false;
      const isSlotMatch = !r.slot || r.slot === 'both' || r.slot === targetSlot;
      const isDayMatch = !r.dayOfWeek || r.dayOfWeek === 0 || r.dayOfWeek === dayOfWeek;
      return isSlotMatch && isDayMatch;
    });

    if (matchingFixedRule) {
      rawScore += 25;
      reasons.push({
        score: 25,
        label: `Khớp quy tắc cố định được cấu hình: ${matchingFixedRule.notes || 'Quầy ưu tiên'}`,
        type: 'positive',
        icon: '📌',
      });
    }

    // 5. FACTOR 5: WORKLOAD ROTATION & FATIGUE BALANCING (-30 to +10 points)
    const consecutiveWarning = checkConsecutiveTwoDayWarning(
      employee.fullName,
      employee.employeeId,
      selectedDate,
      targetCounter,
      counters,
      currentAssignment,
      employee.isSup
    );

    if (consecutiveWarning) {
      const penalty = consecutiveWarning.warningType === 'same_counter' ? 25 : 15;
      rawScore -= penalty;
      reasons.push({
        score: -penalty,
        label: `Cần luân chuyển: Đã đứng ${consecutiveWarning.adjacentCounterNumber} vào ${consecutiveWarning.adjacentDateLabel || consecutiveWarning.adjacentDate}`,
        type: 'warning',
        icon: '🛡️',
      });
    } else {
      rawScore += 6;
      reasons.push({
        score: 6,
        label: 'Đảm bảo luân chuyển quầy hợp lý (Không trùng quầy 2 ngày liên tiếp)',
        type: 'positive',
        icon: '🔄',
      });
    }

    // Normalize Final Score: 0 - 100
    // Base possible max raw score is approx 90 - 105
    let finalScore = Math.max(0, Math.min(100, Math.round((rawScore / 85) * 100)));
    if (!isEligible) {
      finalScore = Math.min(finalScore, 30);
    }

    // Determine Tier
    let tier: SuggestionTier = 'acceptable';
    let tierLabel = 'Khả thi';
    let tierColor = 'text-amber-700 bg-amber-50 border-amber-300';

    if (finalScore >= 90) {
      tier = 'optimal';
      tierLabel = 'Xuất sắc (#1)';
      tierColor = 'text-emerald-800 bg-emerald-100 border-emerald-300';
    } else if (finalScore >= 75) {
      tier = 'strong';
      tierLabel = 'Rất phù hợp';
      tierColor = 'text-teal-800 bg-teal-100 border-teal-300';
    } else if (finalScore >= 55) {
      tier = 'acceptable';
      tierLabel = 'Khả thi';
      tierColor = 'text-blue-800 bg-blue-100 border-blue-300';
    } else {
      tier = 'low';
      tierLabel = 'Ít phù hợp';
      tierColor = 'text-rose-800 bg-rose-100 border-rose-300';
    }

    // Sort reasons so positive highlights are first
    reasons.sort((a, b) => b.score - a.score);

    return {
      employee,
      matchScore: finalScore,
      tier,
      tierLabel,
      tierColor,
      reasons,
      isEligible,
    };
  },

  /**
   * Get sorted list of candidate employees recommended for a specific counter and slot
   */
  getSuggestionsForSlot(params: {
    targetCounterId: string;
    targetSlot: 'morning' | 'afternoon';
    selectedDate: string;
    unassignedEmployees: UnassignedEmployee[];
    counters: Counter[];
    shifts: Shift[];
    weeklySchedule: WeeklyScheduleEntry[];
    currentAssignment?: DayDwsAssignment | null;
  }): EmployeeSuggestion[] {
    const {
      targetCounterId,
      targetSlot,
      selectedDate,
      unassignedEmployees,
      counters,
      shifts,
      weeklySchedule,
      currentAssignment,
    } = params;

    const targetCounter = counters.find((c) => c.id === targetCounterId) || {
      id: targetCounterId,
      counterNumber: targetCounterId,
      area: 'Siêu thị',
    };

    const evaluated = unassignedEmployees.map((emp) =>
      this.evaluateCandidate({
        employee: emp,
        targetCounter,
        targetSlot,
        selectedDate,
        counters,
        shifts,
        weeklySchedule,
        currentAssignment,
      })
    );

    // Sort by Match Score descending
    return evaluated.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.employee.fullName.localeCompare(b.employee.fullName, 'vi');
    });
  },

  /**
   * Get top recommended counter slots for a specific unassigned employee
   */
  getBestCountersForEmployee(params: {
    employee: UnassignedEmployee;
    selectedDate: string;
    counters: Counter[];
    shifts: Shift[];
    weeklySchedule: WeeklyScheduleEntry[];
    currentAssignment: DayDwsAssignment;
  }): EmployeeSlotRecommendation[] {
    const { employee, selectedDate, counters, shifts, weeklySchedule, currentAssignment } = params;

    const isMorning =
      employee.category === 'morning' ||
      (employee.category === 'other' && (!employee.startTime || employee.startTime < '12:30'));
    const isAfternoon =
      employee.category === 'afternoon' ||
      (employee.category === 'other' && employee.startTime && employee.startTime >= '12:30');

    const candidateSlots: { counter: Counter; slot: 'morning' | 'afternoon' }[] = [];

    counters.forEach((counter) => {
      const assign = currentAssignment.assignments[counter.id];
      if (isMorning && (!assign || !assign.morning?.employeeName)) {
        candidateSlots.push({ counter, slot: 'morning' });
      }
      if (isAfternoon && (!assign || !assign.afternoon?.employeeName)) {
        candidateSlots.push({ counter, slot: 'afternoon' });
      }
    });

    const evaluated = candidateSlots.map(({ counter, slot }) => {
      const suggestion = this.evaluateCandidate({
        employee,
        targetCounter: counter,
        targetSlot: slot,
        selectedDate,
        counters,
        shifts,
        weeklySchedule,
        currentAssignment,
      });

      return {
        counterId: counter.id,
        counterNumber: counter.counterNumber || counter.id,
        counterArea: counter.area,
        slot,
        slotLabel: slot === 'morning' ? 'Ca Sáng' : 'Ca Chiều',
        matchScore: suggestion.matchScore,
        tier: suggestion.tier,
        reasons: suggestion.reasons,
      };
    });

    return evaluated
      .filter((e) => e.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5); // Return top 5 slots
  },

  /**
   * Get recommendations for all currently unassigned counter slots on the day
   */
  getAllUnassignedSlotSuggestions(params: {
    selectedDate: string;
    counters: Counter[];
    shifts: Shift[];
    weeklySchedule: WeeklyScheduleEntry[];
    unassignedEmployees: UnassignedEmployee[];
    currentAssignment: DayDwsAssignment;
  }): CounterSlotSuggestion[] {
    const {
      selectedDate,
      counters,
      shifts,
      weeklySchedule,
      unassignedEmployees,
      currentAssignment,
    } = params;

    const results: CounterSlotSuggestion[] = [];

    counters.forEach((counter) => {
      const assign = currentAssignment.assignments[counter.id];

      // Check morning slot
      if (!assign?.morning?.employeeName) {
        const suggestions = this.getSuggestionsForSlot({
          targetCounterId: counter.id,
          targetSlot: 'morning',
          selectedDate,
          unassignedEmployees,
          counters,
          shifts,
          weeklySchedule,
          currentAssignment,
        });

        results.push({
          counterId: counter.id,
          counterNumber: counter.counterNumber || counter.id,
          counterArea: counter.area,
          slot: 'morning',
          slotLabel: 'Ca Sáng',
          topSuggestion: suggestions[0] || null,
          allSuggestions: suggestions,
        });
      }

      // Check afternoon slot
      if (!assign?.afternoon?.employeeName) {
        const suggestions = this.getSuggestionsForSlot({
          targetCounterId: counter.id,
          targetSlot: 'afternoon',
          selectedDate,
          unassignedEmployees,
          counters,
          shifts,
          weeklySchedule,
          currentAssignment,
        });

        results.push({
          counterId: counter.id,
          counterNumber: counter.counterNumber || counter.id,
          counterArea: counter.area,
          slot: 'afternoon',
          slotLabel: 'Ca Chiều',
          topSuggestion: suggestions[0] || null,
          allSuggestions: suggestions,
        });
      }
    });

    return results;
  },
};
