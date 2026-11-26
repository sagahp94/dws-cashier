import React, { useState, useEffect, useMemo } from 'react';
import { WeekSelector, getMonday } from '../components/dws/WeekSelector';
import { DaySelector, DAYS_OF_WEEK } from '../components/dws/DaySelector';
import { HeadcountStatsBar } from '../components/dws/HeadcountStatsBar';
import { DailyPlannedDemandOverview } from '../components/dws/DailyPlannedDemandOverview';
import { WeeklySummaryDashboardWidget } from '../components/dws/WeeklySummaryDashboardWidget';
import { DailyShiftDemandPanel } from '../components/dws/DailyShiftDemandPanel';
import { UnassignedPanel } from '../components/dws/UnassignedPanel';
import { CounterGrid } from '../components/dws/CounterGrid';
import { ConflictAlertBanner } from '../components/dws/ConflictAlertBanner';
import { AssignEmployeeModal } from '../components/dws/AssignEmployeeModal';
import { AutoAssignModal } from '../components/dws/AutoAssignModal';
import { AutoSuggestModal } from '../components/dws/AutoSuggestModal';
import { EmployeeSuggestCountersModal } from '../components/dws/EmployeeSuggestCountersModal';
import { AssignmentRulesModal } from '../components/dws/AssignmentRulesModal';
import { ZoneConsecutiveWarningModal } from '../components/dws/ZoneConsecutiveWarningModal';
import { ConsecutiveTwoDayWarningModal } from '../components/dws/ConsecutiveTwoDayWarningModal';
import { MissingEmployeesAlertBanner } from '../components/dws/MissingEmployeesAlertBanner';
import { MissingScheduleEmployeesModal } from '../components/dws/MissingScheduleEmployeesModal';
import { InactiveTwoWeeksAlertBanner } from '../components/dws/InactiveTwoWeeksAlertBanner';
import { InactiveTwoWeeksModal } from '../components/dws/InactiveTwoWeeksModal';
import { ShiftChangeAlertBanner } from '../components/dws/ShiftChangeAlertBanner';
import { ShiftChangeConflict } from '../services/shiftChangeService';
import { ShiftSwapModal } from '../components/dws/ShiftSwapModal';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { storageService } from '../services/storageService';
import { assignmentService } from '../services/assignmentService';
import { shiftDemandService } from '../services/shiftDemandService';
import { excelService } from '../services/excelService';
import { checkZoneStreakWarning, findEmployeeRecord } from '../services/zoneTrackingService';
import { checkConsecutiveTwoDayWarning, ConsecutiveTwoDayWarning } from '../services/consecutiveWarningService';
import { useToast } from '../components/common/ToastContainer';
import {
  Shift,
  Counter,
  Employee,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  UnassignedEmployee,
  SlotAssignment,
  CounterDayAssignment,
  HistoryRecord,
  AutoAssignOptions,
  AssignmentRuleConfig,
  ZoneStreakWarning,
  MissingScheduleEmployee,
  InactiveTwoWeeksEmployee,
  ShiftSwapRequest,
} from '../types';
import { getDayOfWeekIndex, getDayNameVietnamese } from '../utils/dateUtils';
import {
  Upload,
  Eye,
  Sparkles,
  Save,
  Printer,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Sliders,
  ChevronDown,
  ChevronUp,
  BarChart3,
  BellRing,
} from 'lucide-react';
import { ImportDataType } from '../components/import/DataImportModal';

interface DwsWeekPageProps {
  currentMonday: string;
  onWeekChange: (mondayDate: string) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  shifts: Shift[];
  counters: Counter[];
  employees: Employee[];
  weeklySchedule: WeeklyScheduleEntry[];
  assignmentsMap: Record<string, DayDwsAssignment>;
  onOpenImport: (type: ImportDataType) => void;
  onPreviewDws: () => void;
  onDataChanged: () => void;
  onManualReviewEmployee?: (employeeNameOrId?: string) => void;
}

export const DwsWeekPage: React.FC<DwsWeekPageProps> = ({
  currentMonday,
  onWeekChange,
  selectedDate,
  onSelectDate,
  shifts,
  counters,
  employees,
  weeklySchedule,
  assignmentsMap,
  onOpenImport,
  onPreviewDws,
  onDataChanged,
  onManualReviewEmployee,
}) => {
  const { success, error, warning, info } = useToast();

  // Current day assignment object
  const currentDayAssignment = useMemo(() => {
    return (
      assignmentsMap[selectedDate] || {
        date: selectedDate,
        weekId: currentMonday,
        dayOfWeek: getDayOfWeekIndex(selectedDate),
        assignments: {},
        updatedAt: new Date().toISOString(),
      }
    );
  }, [assignmentsMap, selectedDate, currentMonday]);

  // Day Name for display
  const currentDayInfo = useMemo(() => {
    return getDayNameVietnamese(selectedDate);
  }, [selectedDate]);

  // Stats for the day
  const dayStats = useMemo(() => {
    return assignmentService.getDayStats(selectedDate, weeklySchedule, shifts, currentDayAssignment);
  }, [selectedDate, weeklySchedule, shifts, currentDayAssignment]);

  // Unassigned employees for the day
  const unassignedEmployees = useMemo(() => {
    return assignmentService.getUnassignedEmployees(selectedDate, weeklySchedule, shifts, currentDayAssignment);
  }, [selectedDate, weeklySchedule, shifts, currentDayAssignment]);

  // Excluded employees for the day ("Không phân quầy")
  const excludedEmployeesForDay = useMemo(() => {
    return assignmentService.getExcludedEmployeesForDay(selectedDate, weeklySchedule, shifts);
  }, [selectedDate, weeklySchedule, shifts]);

  // Missing or deleted employees in weekly schedule
  const missingScheduleEmployees = useMemo(() => {
    return assignmentService.getMissingEmployeesInSchedule(weeklySchedule, employees, { weekId: currentMonday });
  }, [weeklySchedule, employees, currentMonday]);

  // Active employees who have 0 working shifts in 2 consecutive weeks
  const inactiveTwoWeeksEmployees = useMemo(() => {
    return assignmentService.getInactiveTwoWeeksEmployees(currentMonday, employees, shifts);
  }, [currentMonday, employees, shifts, weeklySchedule]);

  // Validation issues
  const validationIssues = useMemo(() => {
    return assignmentService.validateDayAssignment(
      selectedDate,
      currentDayAssignment,
      weeklySchedule,
      shifts,
      counters,
      employees
    );
  }, [selectedDate, currentDayAssignment, weeklySchedule, shifts, counters, employees]);

  // Shift change conflicts: detects employees assigned to counters whose shift has changed
  const shiftChangeConflicts = useMemo(() => {
    if (!currentDayAssignment?.assignments || !weeklySchedule || weeklySchedule.length === 0) {
      return [];
    }

    const conflicts: ShiftChangeConflict[] = [];
    const counterMap = new Map<string, Counter>();
    counters.forEach((c) => counterMap.set(c.id, c));

    // Map weekly schedule for selected date by employee
    const dayScheduleEntries = weeklySchedule.filter((e) => e.date === selectedDate);
    const dayScheduleByName = new Map<string, WeeklyScheduleEntry>();
    const dayScheduleById = new Map<string, WeeklyScheduleEntry>();

    dayScheduleEntries.forEach((e) => {
      if (e.employeeName) dayScheduleByName.set(e.employeeName.toLowerCase().trim(), e);
      if (e.employeeId) dayScheduleById.set(e.employeeId.toLowerCase().trim(), e);
    });

    Object.entries(currentDayAssignment.assignments).forEach(([counterId, rawCa]) => {
      const ca = rawCa as CounterDayAssignment;
      if (!ca) return;
      const slotsToCheck: Array<{
        slotName: 'morning' | 'morning2' | 'afternoon' | 'afternoon2';
        slotData: SlotAssignment | null | undefined;
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

        // Match schedule entry
        const isGenericStt = /^\d{1,3}$/.test(assignedId);
        const sched =
          (!isGenericStt && assignedId && dayScheduleById.get(assignedId)) ||
          (assignedName && dayScheduleByName.get(assignedName));

        if (!sched) continue;

        const oldShiftCode = (slotData.shiftCode || '').trim();
        const newShiftCode = (sched.shiftCode || '').trim();

        if (!newShiftCode) continue;

        // Skip if same shift code
        if (oldShiftCode.toUpperCase() === newShiftCode.toUpperCase()) continue;

        const oldCategory = assignmentService.getShiftCategory(oldShiftCode, shifts);
        const newCategory = assignmentService.getShiftCategory(newShiftCode, shifts);

        const isMorningSlot = slotName === 'morning' || slotName === 'morning2';

        const counterObj = counterMap.get(counterId);
        const counterDisplay = counterObj?.counterNumber || counterId;
        const counterArea = counterObj?.area || '';
        const dayName = getDayNameVietnamese(selectedDate);

        const message = `Nhân viên ${slotData.employeeName} được phân vào quầy ${counterDisplay} đã bị đổi ca từ ${oldShiftCode} thành ${newShiftCode}. Hiện tại quầy ${counterDisplay} đang thiếu ca ${oldShiftCode}. Bổ sung ngay?`;

        conflicts.push({
          id: `${selectedDate}_${slotData.employeeName}_${counterId}_${slotName}`,
          date: selectedDate,
          dayName,
          employeeId: slotData.employeeId,
          employeeName: slotData.employeeName,
          counterId,
          counterNumber: counterDisplay,
          counterArea,
          assignedSlot: slotName,
          oldShiftCode,
          newShiftCode,
          oldCategory,
          newCategory,
          changeType: isMorningSlot ? 'morning_to_afternoon' : 'afternoon_to_morning',
          message,
        });
      }
    });

    return conflicts;
  }, [currentDayAssignment, weeklySchedule, selectedDate, counters, shifts]);

  // State for Modals
  const [assignModalData, setAssignModalData] = useState<{
    isOpen: boolean;
    counterId: string;
    slot: 'morning' | 'afternoon';
    preselectedEmployee?: UnassignedEmployee | null;
  }>({
    isOpen: false,
    counterId: counters[0]?.id || '1',
    slot: 'morning',
    preselectedEmployee: null,
  });

  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false);
  const [isAutoSuggestOpen, setIsAutoSuggestOpen] = useState(false);
  const [suggestEmployeeModalData, setSuggestEmployeeModalData] = useState<UnassignedEmployee | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [isMissingModalOpen, setIsMissingModalOpen] = useState(false);
  const [isInactiveTwoWeeksModalOpen, setIsInactiveTwoWeeksModalOpen] = useState(false);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'grid' | 'unassigned'>('grid');

  // REC-001 & REC-002: Compact view states to bring CounterGrid above the fold
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);
  const [isAlertsDetailExpanded, setIsAlertsDetailExpanded] = useState(false);

  // Shift Swap Modal state
  const [swapModalData, setSwapModalData] = useState<{
    isOpen: boolean;
    counterId: string;
    counterNumber: string;
    slot: 'morning' | 'afternoon';
    slotAssignment: SlotAssignment | null;
    existingRequest?: ShiftSwapRequest | null;
  }>({
    isOpen: false,
    counterId: '',
    counterNumber: '',
    slot: 'morning',
    slotAssignment: null,
    existingRequest: null,
  });

  const handleOpenSwapModal = (counterId: string, slot: 'morning' | 'afternoon', emp: SlotAssignment) => {
    const counter = counters.find((c) => c.id === counterId);
    const counterNumber = counter?.counterNumber || counterId;
    const existingReq = storageService.isSlotSwapRequested(selectedDate, counterId, slot);

    setSwapModalData({
      isOpen: true,
      counterId,
      counterNumber,
      slot,
      slotAssignment: emp,
      existingRequest: existingReq,
    });
  };

  const handleSwapRequestSubmitted = (req: ShiftSwapRequest) => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };
    if (newAssignments[req.counterId]?.[req.slot]) {
      newAssignments[req.counterId] = {
        ...newAssignments[req.counterId],
        [req.slot]: {
          ...newAssignments[req.counterId][req.slot]!,
          swapRequested: true,
          swapRequestId: req.id,
          swapReason: req.reason,
        },
      };

      const updated: DayDwsAssignment = {
        ...currentDayAssignment,
        assignments: newAssignments,
        updatedAt: new Date().toISOString(),
      };
      handleSaveAssignment(updated);
      onDataChanged();
    }
  };

  const handleSwapRequestCancelled = (requestId: string) => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    Object.keys(newAssignments).forEach((cId) => {
      const ca = newAssignments[cId];
      if (ca.morning?.swapRequestId === requestId) {
        ca.morning = {
          ...ca.morning,
          swapRequested: false,
          swapRequestId: undefined,
          swapReason: undefined,
        };
      }
      if (ca.afternoon?.swapRequestId === requestId) {
        ca.afternoon = {
          ...ca.afternoon,
          swapRequested: false,
          swapRequestId: undefined,
          swapReason: undefined,
        };
      }
    });

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };
    handleSaveAssignment(updated);
    onDataChanged();
  };

  // Handle batch applying auto-suggestions
  const handleApplyAutoSuggestions = (
    plan: { counterId: string; slot: 'morning' | 'afternoon'; employee: UnassignedEmployee }[]
  ) => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    plan.forEach(({ counterId, slot, employee }) => {
      if (!newAssignments[counterId]) {
        newAssignments[counterId] = { counterId };
      }
      newAssignments[counterId] = {
        ...newAssignments[counterId],
        [slot]: {
          employeeId: employee.employeeId,
          employeeName: employee.fullName,
          shiftCode: employee.shiftCode,
          startTime: employee.startTime,
          endTime: employee.endTime,
          assignedAt: new Date().toISOString(),
        },
      };
    });

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    handleSaveAssignment(updated);
    onDataChanged();
  };

  // Handler for auto-repairing data inconsistencies
  const handleAutoRepair = () => {
    const res = storageService.repairDataIntegrity(currentMonday);
    const details = [];
    if (res.repairedMismatchCount > 0) {
      details.push(`đã gỡ ${res.repairedMismatchCount} vị trí phân quầy lệch ca (đưa về danh sách chưa phân quầy)`);
    }
    if (res.repairedScheduleCount > 0) {
      details.push(`đã đồng bộ ${res.repairedScheduleCount} lịch làm việc`);
    }
    const detailMsg = details.length > 0 ? details.join(', ') + '.' : 'Dữ liệu đã được kiểm tra và chuẩn hóa đồng bộ.';
    success(
      'Khắc phục & Đồng bộ dữ liệu thành công',
      detailMsg
    );
    onDataChanged();
  };

  // Handlers for Missing Schedule Employees (do not auto-create employee IDs; require updating Employee Catalog first)
  const handleUpdateEmployeeCatalogForMissing = (emp?: { fullName?: string; employeeName?: string; employeeId?: string }) => {
    const name = emp?.employeeName || emp?.fullName || '';
    info(
      'Cần cập nhật Danh sách nhân viên trước',
      name
        ? `Nhân viên "${name}" chưa có trong Danh sách nhân viên. Hệ thống không tự động tạo mã NV và thông tin liên quan, vui lòng cập nhật Danh sách nhân viên trước.`
        : 'Vui lòng cập nhật Danh sách nhân viên trước (hệ thống không tự động tạo mã nhân viên).'
    );
    onOpenImport('employees');
  };

  const handleExcludeEmployee = (emp: { fullName?: string; employeeName?: string; employeeId?: string }) => {
    const name = emp.employeeName || emp.fullName || '';
    if (!name) return;
    storageService.setEmployeeExcluded(name, emp.employeeId, true);
    const removedCount = storageService.removeEmployeeFromAssignments(name, emp.employeeId, currentMonday);
    info(
      'Đã chọn: Không phân quầy',
      `Nhân viên ${name} sẽ không được xếp quầy${removedCount > 0 ? ` (đã xóa khỏi ${removedCount} ca phân quầy)` : ''}.`
    );
    onDataChanged();
  };

  const handleExcludeAllMissingEmployees = () => {
    const unresolved = missingScheduleEmployees.filter((e) => !e.isExcluded);
    if (unresolved.length === 0) return;
    storageService.batchSetEmployeesExcluded(unresolved, true);
    unresolved.forEach((emp) => {
      storageService.removeEmployeeFromAssignments(emp.employeeName, emp.employeeId, currentMonday);
    });
    info('Đã chọn: Không phân quầy', `Đã đánh dấu Không phân quầy cho ${unresolved.length} nhân viên.`);
    onDataChanged();
  };

  const handleRestoreEmployee = (emp: { fullName?: string; employeeName?: string; employeeId?: string }) => {
    const name = emp.employeeName || emp.fullName || '';
    if (!name) return;
    const empRecord = findEmployeeRecord(name, emp.employeeId);
    if (empRecord?.isResigned) {
      storageService.setEmployeeResigned(empRecord.employeeId, false, currentMonday);
    } else {
      storageService.setEmployeeExcluded(name, emp.employeeId, false);
    }
    success('Đã khôi phục', `Nhân viên ${name} đã được phép tham gia phân quầy.`);
    onDataChanged();
  };

  // Handlers for 2-week inactive employees ("Đã nghỉ việc" vs "Xem xét thủ công")
  const handleMarkInactiveEmployeeResigned = (emp: InactiveTwoWeeksEmployee) => {
    storageService.setEmployeeResigned(emp.employeeId, true, currentMonday);
    info(
      `Đã cập nhật trạng thái: Nghỉ việc`,
      `Nhân viên ${emp.fullName} (${emp.employeeId}) đã được cập nhật trạng thái "Nghỉ việc" trong Danh sách nhân viên và chuyển sang mục Không phân quầy.`
    );
    onDataChanged();
  };

  const handleMarkAllInactiveEmployeesResigned = () => {
    if (inactiveTwoWeeksEmployees.length === 0) return;
    inactiveTwoWeeksEmployees.forEach((emp) => {
      storageService.setEmployeeResigned(emp.employeeId, true, currentMonday);
    });
    info(
      `Đã cập nhật trạng thái: Nghỉ việc`,
      `Đã cập nhật trạng thái "Nghỉ việc" cho ${inactiveTwoWeeksEmployees.length} nhân viên không có ca làm việc 2 tuần liên tiếp.`
    );
    setIsInactiveTwoWeeksModalOpen(false);
    onDataChanged();
  };

  const handleManualReviewInactiveEmployee = (emp?: InactiveTwoWeeksEmployee) => {
    if (onManualReviewEmployee) {
      onManualReviewEmployee(emp?.fullName || emp?.employeeId || '');
    }
    info(
      'Chuyển sang Xem xét thủ công',
      'Vào Danh sách nhân viên -> tick "Đã nghỉ việc" -> chuyển nhân viên sang mục "Nghỉ việc" và không phân quầy.'
    );
  };

  // 3-day consecutive zone warning state
  const [zoneWarningData, setZoneWarningData] = useState<{
    isOpen: boolean;
    warning: ZoneStreakWarning | null;
    onConfirmAssign: () => void;
    onCancelAssign: () => void;
  }>({
    isOpen: false,
    warning: null,
    onConfirmAssign: () => {},
    onCancelAssign: () => {},
  });

  // 2-day consecutive counter / monitored cluster warning state
  const [consecutiveTwoDayWarningData, setConsecutiveTwoDayWarningData] = useState<{
    isOpen: boolean;
    warning: ConsecutiveTwoDayWarning | null;
    onConfirmAssign: () => void;
    onCancelAssign: () => void;
  }>({
    isOpen: false,
    warning: null,
    onConfirmAssign: () => {},
    onCancelAssign: () => {},
  });

  // Save current assignment to storage & history
  const handleSaveAssignment = (updated: DayDwsAssignment) => {
    storageService.saveAssignment(updated);

    // Also record in history
    const record: HistoryRecord = {
      id: `${updated.date}_${Date.now()}`,
      date: updated.date,
      weekId: updated.weekId,
      dayName: currentDayInfo,
      timestamp: new Date().toISOString(),
      author: 'Quản lý Thu ngân',
      workingCount: dayStats.workingCount,
      offCount: dayStats.offCount,
      assignedCount: dayStats.assignedCount,
      unassignedCount: dayStats.unassignedCount,
      counterCount: counters.length,
      data: updated,
    };
    storageService.addHistoryRecord(record);

    onDataChanged();
  };

  // Handlers for shift change conflicts
  const handleOpenAssignForConflict = (conflict: ShiftChangeConflict) => {
    // 1. Remove the employee with the changed shift from the counter slot
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    if (newAssignments[conflict.counterId]) {
      newAssignments[conflict.counterId] = {
        ...newAssignments[conflict.counterId],
        [conflict.assignedSlot]: null,
      };
    }

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    handleSaveAssignment(updated);

    // 2. Target slot for this counter
    const targetSlot: 'morning' | 'afternoon' =
      conflict.assignedSlot === 'morning' || conflict.assignedSlot === 'morning2'
        ? 'morning'
        : 'afternoon';

    // 3. Compute available unassigned employees for this slot
    const updatedUnassigned = assignmentService.getUnassignedEmployees(
      selectedDate,
      weeklySchedule,
      shifts,
      updated
    );

    const availableForSlot = updatedUnassigned.filter((e) => {
      const cat = assignmentService.getShiftCategory(e.shiftCode, shifts);
      if (targetSlot === 'morning') {
        return cat === 'morning' || (cat !== 'afternoon' && (!e.startTime || e.startTime < '13:00'));
      } else {
        return cat === 'afternoon' || (cat !== 'morning' && e.startTime && e.startTime >= '13:00');
      }
    });

    if (availableForSlot.length > 0) {
      info(
        'Đã đưa về danh sách chưa phân quầy',
        `Nhân viên ${conflict.employeeName} (ca mới ${conflict.newShiftCode}) đã được chuyển về danh sách chưa phân quầy. Đang mở danh sách phân quầy (${availableForSlot.length} nhân viên hợp lệ) để chọn nhân viên bổ sung vào Quầy ${conflict.counterNumber}.`
      );

      setAssignModalData({
        isOpen: true,
        counterId: conflict.counterId,
        slot: targetSlot,
        preselectedEmployee: null,
      });
    } else {
      info(
        'Đã đưa về danh sách chưa phân quầy',
        `Nhân viên ${conflict.employeeName} (ca mới ${conflict.newShiftCode}) đã được chuyển về danh sách chưa phân quầy. Hiện tại quầy ${conflict.counterNumber} đang thiếu ca ${conflict.oldShiftCode}, nhưng không còn nhân viên nào chưa phân quầy phù hợp với ${targetSlot === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}.`
      );
    }
  };

  const handleDismissOrUnassignConflict = (conflict: ShiftChangeConflict) => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    if (newAssignments[conflict.counterId]) {
      newAssignments[conflict.counterId] = {
        ...newAssignments[conflict.counterId],
        [conflict.assignedSlot]: null,
      };
    }

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    handleSaveAssignment(updated);

    success(
      'Đã gỡ khỏi quầy',
      `Nhân viên ${conflict.employeeName} đã được gỡ khỏi Quầy ${conflict.counterNumber} và đưa về danh sách chưa phân quầy.`
    );
  };

  // Direct execute assign slot
  const executeAssignSlot = (
    counterId: string,
    slot: 'morning' | 'afternoon',
    emp: UnassignedEmployee | SlotAssignment
  ) => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    if (!newAssignments[counterId]) {
      newAssignments[counterId] = { counterId };
    }

    const slotData: SlotAssignment = {
      employeeId: emp.employeeId,
      employeeName: (emp as UnassignedEmployee).fullName || (emp as SlotAssignment).employeeName,
      shiftCode: emp.shiftCode,
      startTime: emp.startTime,
      endTime: emp.endTime,
      assignedAt: new Date().toISOString(),
    };

    newAssignments[counterId] = {
      ...newAssignments[counterId],
      [slot]: slotData,
    };

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    handleSaveAssignment(updated);
  };

  // Assign slot handler with 2-day consecutive check and 3-day consecutive zone check
  const handleAssignSlot = (
    counterId: string,
    slot: 'morning' | 'afternoon',
    emp: UnassignedEmployee | SlotAssignment,
    bypassWarning = false
  ) => {
    const empName = (emp as UnassignedEmployee).fullName || (emp as SlotAssignment).employeeName;
    const empId = emp.employeeId;
    const empRecord = findEmployeeRecord(empName, empId);

    if (!empRecord) {
      error(
        `Nhân viên "${empName}" chưa có trong Danh sách nhân viên! Vui lòng cập nhật Danh sách nhân viên trước khi xếp quầy.`
      );
      onOpenImport('employees');
      return;
    }

    const isSup = (emp as UnassignedEmployee).isSup ?? empRecord?.isSup ?? false;

    // Nhân viên SUP bỏ qua mọi cảnh báo về xếp quầy
    if (isSup) {
      executeAssignSlot(counterId, slot, emp);
      return;
    }

    if (!bypassWarning) {
      // 1. Kiểm tra cảnh báo 2 ngày liên tiếp (đứng cùng quầy hoặc cùng khu vực SSC-17, 20-27, 101-106 & 306, 109-117)
      const twoDayWarning = checkConsecutiveTwoDayWarning(
        empName,
        empId,
        selectedDate,
        counterId,
        counters,
        currentDayAssignment
      );
      if (twoDayWarning) {
        setConsecutiveTwoDayWarningData({
          isOpen: true,
          warning: twoDayWarning,
          onConfirmAssign: () => {
            // Sau khi người dùng xác nhận ngoại lệ 2 ngày, tiếp tục gán (bypass warning 2 ngày)
            handleAssignSlot(counterId, slot, emp, true);
            success(`Đã phân ${empName} vào Quầy ${twoDayWarning.targetCounterNumber} (xác nhận ngoại lệ 2 ngày liên tiếp).`);
          },
          onCancelAssign: () => {
            info(`Đã hủy phân quầy cho ${empName} để đảm bảo quy tắc xoay vòng 2 ngày liên tiếp.`);
          },
        });
        return;
      }

      // 2. Kiểm tra cảnh báo 3 ngày liên tiếp cùng zone lớn (Siêu thị, Delica, Bánh mì)
      const isSup = (emp as UnassignedEmployee).isSup;
      const streakWarning = checkZoneStreakWarning(empName, empId, selectedDate, counterId, counters, isSup);
      if (streakWarning) {
        setZoneWarningData({
          isOpen: true,
          warning: streakWarning,
          onConfirmAssign: () => {
            executeAssignSlot(counterId, slot, emp);
            success(`Đã phân ${empName} vào Quầy ${streakWarning.targetCounterNumber || counterId} (${streakWarning.targetZone}) do có nhân viên mới.`);
          },
          onCancelAssign: () => {
            info(`Đã hủy phân quầy cho ${empName} (không có nhân viên mới nhường quầy). Vui lòng phân vào khu vực khác.`);
          },
        });
        return;
      }
    }

    executeAssignSlot(counterId, slot, emp);
  };

  // Unassign slot handler
  const handleUnassignSlot = (counterId: string, slot: 'morning' | 'afternoon') => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    if (newAssignments[counterId]) {
      newAssignments[counterId] = {
        ...newAssignments[counterId],
        [slot]: null,
      };
    }

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    handleSaveAssignment(updated);
  };

  // Direct execute move / swap employee
  const executeMoveEmployee = (
    fromCounterId: string,
    fromSlot: 'morning' | 'afternoon',
    toCounterId: string,
    toSlot: 'morning' | 'afternoon'
  ) => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    if (!newAssignments[fromCounterId]) newAssignments[fromCounterId] = { counterId: fromCounterId };
    if (!newAssignments[toCounterId]) newAssignments[toCounterId] = { counterId: toCounterId };

    const sourceEmp = newAssignments[fromCounterId]?.[fromSlot];
    const targetEmp = newAssignments[toCounterId]?.[toSlot];

    // Swap
    newAssignments[fromCounterId] = {
      ...newAssignments[fromCounterId],
      [fromSlot]: targetEmp || null,
    };

    newAssignments[toCounterId] = {
      ...newAssignments[toCounterId],
      [toSlot]: sourceEmp || null,
    };

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    handleSaveAssignment(updated);
    success(`Đã chuyển nhân viên sang Quầy ${toCounterId} (${toSlot === 'morning' ? 'Ca Sáng' : 'Ca Chiều'})`);
  };

  // Move / Swap employee between slots with 2-day consecutive check and 3-day zone check
  const handleMoveEmployee = (
    fromCounterId: string,
    fromSlot: 'morning' | 'afternoon',
    toCounterId: string,
    toSlot: 'morning' | 'afternoon',
    bypassWarning = false
  ) => {
    const sourceEmp = currentDayAssignment.assignments?.[fromCounterId]?.[fromSlot];
    const targetEmp = currentDayAssignment.assignments?.[toCounterId]?.[toSlot];

    // Shift category cross-slot restrictions removed per user request

    if (sourceEmp && !bypassWarning) {
      const empRecord = findEmployeeRecord(sourceEmp.employeeName, sourceEmp.employeeId);
      const isSup = empRecord?.isSup ?? false;

      // Nhân viên SUP bỏ qua mọi cảnh báo về xếp quầy
      if (isSup) {
        executeMoveEmployee(fromCounterId, fromSlot, toCounterId, toSlot);
        return;
      }

      // 1. Check 2-day consecutive counter / monitored cluster
      const twoDayWarning = checkConsecutiveTwoDayWarning(
        sourceEmp.employeeName,
        sourceEmp.employeeId,
        selectedDate,
        toCounterId,
        counters,
        currentDayAssignment
      );
      if (twoDayWarning) {
        setConsecutiveTwoDayWarningData({
          isOpen: true,
          warning: twoDayWarning,
          onConfirmAssign: () => {
            handleMoveEmployee(fromCounterId, fromSlot, toCounterId, toSlot, true);
            success(`Đã chuyển ${sourceEmp.employeeName} sang Quầy ${twoDayWarning.targetCounterNumber} (xác nhận ngoại lệ 2 ngày liên tiếp).`);
          },
          onCancelAssign: () => {
            info(`Đã giữ nguyên quầy cho ${sourceEmp.employeeName} để tránh vi phạm quy tắc 2 ngày liên tiếp.`);
          },
        });
        return;
      }

      // 2. Check 3-day consecutive zone
      const streakWarning = checkZoneStreakWarning(
        sourceEmp.employeeName,
        sourceEmp.employeeId,
        selectedDate,
        toCounterId,
        counters
      );
      if (streakWarning) {
        setZoneWarningData({
          isOpen: true,
          warning: streakWarning,
          onConfirmAssign: () => {
            executeMoveEmployee(fromCounterId, fromSlot, toCounterId, toSlot);
          },
          onCancelAssign: () => {
            info(`Đã giữ nguyên quầy cho ${sourceEmp.employeeName} để luân chuyển khu vực.`);
          },
        });
        return;
      }
    }

    executeMoveEmployee(fromCounterId, fromSlot, toCounterId, toSlot);
  };


  // Update metadata (excess, signed)
  const handleUpdateMetadata = (counterId: string, updates: Partial<CounterDayAssignment>) => {
    const newAssignments: Record<string, CounterDayAssignment> = {
      ...currentDayAssignment.assignments,
    };

    if (!newAssignments[counterId]) {
      newAssignments[counterId] = { counterId };
    }

    newAssignments[counterId] = {
      ...newAssignments[counterId],
      ...updates,
    };

    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: newAssignments,
      updatedAt: new Date().toISOString(),
    };

    handleSaveAssignment(updated);
  };

  // Execute Auto Assign
  const handleExecuteAutoAssign = (options: AutoAssignOptions, rules: AssignmentRuleConfig) => {
    if (options.scope === 'full_week') {
      const result = assignmentService.autoAssignWeek(
        currentMonday,
        counters,
        weeklySchedule,
        shifts,
        assignmentsMap,
        options,
        rules
      );

      // Save each updated day
      Object.values(result.updatedAssignmentsMap).forEach((dayAssigned) => {
        storageService.saveAssignment(dayAssigned);
      });

      onDataChanged();
      success(
        `Đã tự động phân bổ thành công cho cả tuần (Tổng cộng ${result.totalAssignedCount} lượt phân quầy)!`
      );
    } else {
      const { updatedAssignment, assignedCount, fixedRulesCount } = assignmentService.autoAssign(
        counters,
        unassignedEmployees,
        currentDayAssignment,
        options,
        rules
      );

      handleSaveAssignment(updatedAssignment);
      if (fixedRulesCount > 0) {
        success(
          `Đã tự động phân bổ thành công ${assignedCount} nhân viên (trong đó có ${fixedRulesCount} vị trí cố định theo Rule)!`
        );
      } else {
        success(`Đã tự động phân bổ thành công ${assignedCount} nhân viên vào các quầy!`);
      }
    }
  };

  // Clear all assignments for the day
  const handleClearAllDay = () => {
    const updated: DayDwsAssignment = {
      ...currentDayAssignment,
      assignments: {},
      updatedAt: new Date().toISOString(),
    };
    handleSaveAssignment(updated);
    setIsClearAllConfirmOpen(false);
    success('Đã làm trống toàn bộ phân quầy của ngày hôm nay.');
  };

  // Check missing foundation catalog data
  const hasShifts = shifts.length > 0;
  const hasCounters = counters.length > 0;
  const hasEmployees = employees.length > 0;
  const hasWeeklyRoster = weeklySchedule.length > 0;
  const isReady = hasShifts && hasCounters && hasEmployees && hasWeeklyRoster;

  const handleExportDailyExcel = () => {
    excelService.exportDailyDwsToExcel({
      date: selectedDate,
      dayName: currentDayInfo,
      weekId: currentMonday,
      counters,
      assignment: currentDayAssignment,
      shifts,
      weeklySchedule,
    });
  };

  const handleExportWeeklyExcel = () => {
    excelService.exportWeeklyDwsToExcel({
      mondayDate: currentMonday,
      counters,
      assignmentsMap,
      shifts,
      weeklySchedule,
      employees,
    });
  };

  return (
    <div id="dws-week-page" className="space-y-4 w-full max-w-[1720px] mx-auto pb-16 px-1 sm:px-3">
      {/* 1. TOP WEEK SELECTION BAR */}
      <WeekSelector currentMonday={currentMonday} onWeekChange={onWeekChange} />

      {/* 2. DAY SELECTOR (THỨ 2 -> THỨ 7) */}
      <DaySelector
        mondayDate={currentMonday}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        weeklySchedule={weeklySchedule}
        assignmentsMap={assignmentsMap}
      />

      {/* 3. MISSING DATA EMPTY STATES */}
      {!isReady ? (
        <div className="space-y-4">
          <EmptyState
            title="Chưa có dữ liệu để hiển thị"
            description={
              !hasShifts
                ? 'Hệ thống chưa có Danh mục Ca làm việc. Vui lòng nạp danh mục Ca trong Cài đặt.'
                : !hasCounters
                ? 'Hệ thống chưa có Danh sách Quầy thu ngân. Vui lòng nạp danh sách Quầy trong Cài đặt.'
                : !hasEmployees
                ? 'Hệ thống chưa có Danh sách Nhân viên. Vui lòng nạp danh sách Nhân viên trong Cài đặt.'
                : 'Chưa có Ca làm việc tuần cho tuần này. Vui lòng tải lên file Excel Ca làm việc tuần để bắt đầu phân quầy.'
            }
            actionText={!hasWeeklyRoster ? 'Import Ca làm việc tuần' : 'Vào Cài đặt danh mục'}
            onAction={() => {
              if (!hasWeeklyRoster && hasShifts && hasCounters && hasEmployees) {
                onOpenImport('weeklySchedule');
              } else {
                onOpenImport(!hasShifts ? 'shifts' : !hasCounters ? 'counters' : 'employees');
              }
            }}
            secondaryActionText="Tải file Excel mẫu"
            onSecondaryAction={() => {
              excelService.downloadSampleTemplate(
                !hasShifts ? 'shifts' : !hasCounters ? 'counters' : !hasEmployees ? 'employees' : 'weeklySchedule',
                currentMonday
              );
            }}
          />

          {/* Quick Guidance Checklist */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Các bước chuẩn bị dữ liệu cần thiết:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  hasShifts ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${hasShifts ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>1. Danh mục Ca ({shifts.length})</span>
              </div>
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  hasCounters ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${hasCounters ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>2. Danh sách Quầy ({counters.length})</span>
              </div>
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  hasEmployees ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${hasEmployees ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>3. Danh sách NV ({employees.length})</span>
              </div>
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  hasWeeklyRoster ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${hasWeeklyRoster ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>4. Ca làm việc tuần ({weeklySchedule.length})</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 4. DAILY HEADCOUNT STATS BAR */}
          <HeadcountStatsBar
            date={selectedDate}
            dayName={currentDayInfo}
            workingCount={dayStats.workingCount}
            offCount={dayStats.offCount}
            totalEmployees={dayStats.total}
            assignedCount={dayStats.assignedCount}
            unassignedCount={dayStats.unassignedCount}
            openedCountersCount={
              (Object.values(currentDayAssignment.assignments || {}) as CounterDayAssignment[]).filter(
                (a) =>
                  a.morning?.employeeName ||
                  a.morning?.employeeId ||
                  a.afternoon?.employeeName ||
                  a.afternoon?.employeeId
              ).length
            }
            targetCountersCount={
              shiftDemandService.getAreaShiftComparisonStats(
                selectedDate,
                weeklySchedule,
                shifts,
                counters,
                currentDayAssignment
              ).summary.grandTotalTarget
            }
            onExportExcel={handleExportDailyExcel}
            onExportWeeklyExcel={handleExportWeeklyExcel}
            onAutoAssign={() => setIsAutoAssignOpen(true)}
            onAutoSuggest={() => setIsAutoSuggestOpen(true)}
          />

          {/* REC-002: UNIFIED ALERT HUB */}
          {(shiftChangeConflicts.length > 0 ||
            missingScheduleEmployees.length > 0 ||
            inactiveTwoWeeksEmployees.length > 0 ||
            validationIssues.length > 0) && (
            <div className="rounded-xl border border-amber-300/90 bg-amber-50/70 p-2.5 sm:p-3 shadow-2xs transition-all">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-amber-950">
                    Phát hiện {shiftChangeConflicts.length + missingScheduleEmployees.length + inactiveTwoWeeksEmployees.length + validationIssues.length} lưu ý nghiệp vụ:
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {shiftChangeConflicts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsAlertsDetailExpanded(!isAlertsDetailExpanded)}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-200/90 hover:bg-amber-300 text-amber-950 border border-amber-400/80 cursor-pointer transition-colors"
                        title="Bấm để xem và xử lý ca bị đổi giờ"
                      >
                        🔄 {shiftChangeConflicts.length} đổi ca
                      </button>
                    )}

                    {missingScheduleEmployees.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsMissingModalOpen(true)}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 cursor-pointer transition-colors"
                        title="Bấm để bổ sung nhân viên vào danh mục"
                      >
                        ⚠️ {missingScheduleEmployees.length} NV thiếu danh mục
                      </button>
                    )}

                    {inactiveTwoWeeksEmployees.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsInactiveTwoWeeksModalOpen(true)}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 cursor-pointer transition-colors"
                        title="Bấm để duyệt nhân sự 2 tuần không có ca"
                      >
                        👤 {inactiveTwoWeeksEmployees.length} NV 2 tuần vắng
                      </button>
                    )}

                    {validationIssues.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoRepair}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 cursor-pointer transition-colors"
                        title="Bấm để tự động sửa xung đột quầy"
                      >
                        ⚡ {validationIssues.length} xung đột quầy
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAlertsDetailExpanded(!isAlertsDetailExpanded)}
                  className="text-xs font-semibold text-amber-900 hover:text-amber-950 px-2 py-1 rounded-lg hover:bg-amber-100 cursor-pointer inline-flex items-center gap-1 transition-colors"
                >
                  <span>{isAlertsDetailExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
                  {isAlertsDetailExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Detailed Alert Banners Expandable */}
              {isAlertsDetailExpanded && (
                <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-3">
                  <ShiftChangeAlertBanner
                    conflicts={shiftChangeConflicts}
                    onOpenAssignForConflict={handleOpenAssignForConflict}
                    onUnassignOnlyConflict={handleDismissOrUnassignConflict}
                  />
                  <MissingEmployeesAlertBanner
                    missingEmployees={missingScheduleEmployees}
                    onOpenModal={() => setIsMissingModalOpen(true)}
                    onUpdateEmployeeCatalog={() => handleUpdateEmployeeCatalogForMissing()}
                    onExcludeAll={handleExcludeAllMissingEmployees}
                  />
                  <InactiveTwoWeeksAlertBanner
                    inactiveEmployees={inactiveTwoWeeksEmployees}
                    onOpenModal={() => setIsInactiveTwoWeeksModalOpen(true)}
                    onMarkResigned={handleMarkInactiveEmployeeResigned}
                    onMarkAllResigned={handleMarkAllInactiveEmployeesResigned}
                    onManualReview={handleManualReviewInactiveEmployee}
                  />
                  <ConflictAlertBanner issues={validationIssues} onAutoFix={handleAutoRepair} />
                </div>
              )}
            </div>
          )}

          {/* 6. MAIN WORKSPACE: UNASSIGNED LIST + COUNTER GRID */}
          {/* Mobile View Toggle Switcher (lg:hidden) */}
          <div className="lg:hidden flex items-center p-1 bg-slate-200/80 rounded-xl">
            <button
              type="button"
              onClick={() => setMobileWorkspaceTab('grid')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                mobileWorkspaceTab === 'grid'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bảng quầy thu ngân ({counters.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileWorkspaceTab('unassigned')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileWorkspaceTab === 'unassigned'
                  ? 'bg-white text-amber-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Chờ xếp</span>
              {unassignedEmployees.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {unassignedEmployees.length}
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Unassigned Panel (3.5 cols on xl) */}
            <div className={`${mobileWorkspaceTab === 'unassigned' ? 'block' : 'hidden'} lg:block lg:col-span-4 xl:col-span-3 sticky top-20`}>
              <UnassignedPanel
                unassignedEmployees={unassignedEmployees}
                excludedEmployees={excludedEmployeesForDay}
                counters={counters}
                selectedDate={selectedDate}
                onAutoAssignClick={() => setIsAutoAssignOpen(true)}
                onAutoSuggestClick={() => setIsAutoSuggestOpen(true)}
                onOpenEmployeeSuggest={(emp) => setSuggestEmployeeModalData(emp)}
                onOpenRulesClick={() => setIsRulesModalOpen(true)}
                onAddEmployee={handleUpdateEmployeeCatalogForMissing}
                onExcludeEmployee={handleExcludeEmployee}
                onRestoreEmployee={handleRestoreEmployee}
                onSelectEmployee={(emp) => {
                  if (emp.isMissingFromCatalog) {
                    handleUpdateEmployeeCatalogForMissing(emp);
                    return;
                  }
                  setAssignModalData({
                    isOpen: true,
                    counterId: counters[0]?.id || '1',
                    slot: emp.category === 'morning' ? 'morning' : 'afternoon',
                    preselectedEmployee: emp,
                  });
                }}
              />
            </div>

            {/* Right Column: Counter Grid (9 cols on xl) */}
            <div className={`${mobileWorkspaceTab === 'grid' ? 'block' : 'hidden'} lg:block lg:col-span-8 xl:col-span-9`}>
              <CounterGrid
                counters={counters}
                assignments={currentDayAssignment.assignments}
                selectedDate={selectedDate}
                onAssignSlot={handleAssignSlot}
                onUnassignSlot={handleUnassignSlot}
                onMoveEmployee={handleMoveEmployee}
                onUpdateMetadata={handleUpdateMetadata}
                onOpenAssignModal={(counterId, slot) => {
                  setAssignModalData({
                    isOpen: true,
                    counterId,
                    slot,
                    preselectedEmployee: null,
                  });
                }}
                onClearAllDay={() => setIsClearAllConfirmOpen(true)}
                onAutoAssignClick={() => setIsAutoAssignOpen(true)}
                onAutoSuggestClick={() => setIsAutoSuggestOpen(true)}
                onOpenRulesClick={() => setIsRulesModalOpen(true)}
                onOpenSwapModal={handleOpenSwapModal}
              />
            </div>
          </div>

          {/* REC-001: EXPANDABLE DEEP ANALYTICS ACCORDION */}
          <div className="pt-2">
            <button
              type="button"
              id="btn-toggle-deep-analytics"
              onClick={() => setIsAnalyticsExpanded(!isAnalyticsExpanded)}
              className="w-full neu-panel p-3.5 flex items-center justify-between text-xs font-bold text-slate-800 hover:text-teal-900 bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-300 rounded-xl cursor-pointer transition-all shadow-2xs group"
            >
              <span className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-900">
                  Phân tích & Cân đối chuyên sâu tuần
                </span>
                <span className="text-slate-400 font-normal hidden sm:inline">
                  (Tổng quan tuần, kế hoạch quầy Siêu thị/FL2 & cân đối ca)
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 text-teal-700 group-hover:text-teal-900 font-semibold bg-slate-50 group-hover:bg-teal-100/70 px-2.5 py-1 rounded-lg border border-slate-200/80 transition-colors">
                <span>{isAnalyticsExpanded ? 'Thu gọn phân tích' : 'Xem chi tiết phân tích'}</span>
                {isAnalyticsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>

            {isAnalyticsExpanded && (
              <div className="mt-3.5 space-y-4 animate-in fade-in duration-200">
                {/* 3.5. BIRD'S-EYE VIEW: WEEKLY SUMMARY DASHBOARD WIDGET */}
                <WeeklySummaryDashboardWidget
                  currentMonday={currentMonday}
                  selectedDate={selectedDate}
                  onSelectDate={onSelectDate}
                  weeklySchedule={weeklySchedule}
                  assignmentsMap={assignmentsMap}
                  shifts={shifts}
                  counters={counters}
                  employees={employees}
                  onAutoAssignWeek={() => setIsAutoAssignOpen(true)}
                />

                {/* 4.0. NHÂN SỰ & NHU CẦU MỞ QUẦY THEO KẾ HOẠCH (SIÊU THỊ & FL2) */}
                <DailyPlannedDemandOverview
                  date={selectedDate}
                  dayName={currentDayInfo}
                  weeklySchedule={weeklySchedule}
                  shifts={shifts}
                  counters={counters}
                  employees={employees}
                  currentAssignment={currentDayAssignment}
                  onNavigateToAssign={() => {
                    const target = document.getElementById('counter-grid-container') || document.getElementById('unassigned-panel');
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  onNavigateToScheduleAdjust={() => {
                    onOpenImport('weeklySchedule');
                  }}
                />

                {/* 4.1. DAILY SHIFT DEMAND & COUNTER BALANCE PANEL */}
                <DailyShiftDemandPanel
                  date={selectedDate}
                  counters={counters}
                  weeklySchedule={weeklySchedule}
                  shifts={shifts}
                  currentAssignment={currentDayAssignment}
                  onOpenRulesConfig={() => setIsRulesModalOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Employee Modal */}
      <AssignEmployeeModal
        isOpen={assignModalData.isOpen}
        onClose={() => setAssignModalData((prev) => ({ ...prev, isOpen: false, preselectedEmployee: null }))}
        targetCounterId={assignModalData.counterId}
        targetSlot={assignModalData.slot}
        counters={counters}
        unassignedEmployees={unassignedEmployees}
        preselectedEmployee={assignModalData.preselectedEmployee}
        selectedDate={selectedDate}
        shifts={shifts}
        weeklySchedule={weeklySchedule}
        onConfirm={(cId, s, emp) => handleAssignSlot(cId, s, emp)}
      />

      {/* Shift Swap Modal (Đề nghị / Yêu cầu đổi ca) */}
      <ShiftSwapModal
        isOpen={swapModalData.isOpen}
        onClose={() => setSwapModalData((prev) => ({ ...prev, isOpen: false }))}
        date={selectedDate}
        weekId={currentMonday}
        counterId={swapModalData.counterId}
        counterNumber={swapModalData.counterNumber}
        slot={swapModalData.slot}
        slotAssignment={swapModalData.slotAssignment}
        existingRequest={swapModalData.existingRequest}
        onSwapRequestSubmitted={handleSwapRequestSubmitted}
        onSwapRequestCancelled={handleSwapRequestCancelled}
      />

      {/* Smart Auto-Suggest Modal (Full Day Heuristics) */}
      <AutoSuggestModal
        isOpen={isAutoSuggestOpen}
        onClose={() => setIsAutoSuggestOpen(false)}
        selectedDate={selectedDate}
        counters={counters}
        shifts={shifts}
        weeklySchedule={weeklySchedule}
        unassignedEmployees={unassignedEmployees}
        currentAssignment={currentDayAssignment}
        onApplyAssignments={handleApplyAutoSuggestions}
      />

      {/* Employee Specific Suggestion Modal */}
      <EmployeeSuggestCountersModal
        isOpen={!!suggestEmployeeModalData}
        onClose={() => setSuggestEmployeeModalData(null)}
        employee={suggestEmployeeModalData}
        selectedDate={selectedDate}
        counters={counters}
        shifts={shifts}
        weeklySchedule={weeklySchedule}
        currentAssignment={currentDayAssignment}
        onAssignToCounter={(cId, s, emp) => handleAssignSlot(cId, s, emp)}
      />

      {/* 3-Day Consecutive Zone Streak Warning Modal */}
      <ZoneConsecutiveWarningModal
        isOpen={zoneWarningData.isOpen}
        warning={zoneWarningData.warning}
        onClose={() => {
          setZoneWarningData((prev) => ({ ...prev, isOpen: false }));
          zoneWarningData.onCancelAssign();
        }}
        onConfirmAssign={() => {
          setZoneWarningData((prev) => ({ ...prev, isOpen: false }));
          zoneWarningData.onConfirmAssign();
        }}
        onCancelAssign={() => {
          setZoneWarningData((prev) => ({ ...prev, isOpen: false }));
          zoneWarningData.onCancelAssign();
        }}
      />

      {/* 2-Day Consecutive Counter & Monitored Cluster (SSC-17, 20-27, 101-106 & 306, 109-117) Warning Modal */}
      <ConsecutiveTwoDayWarningModal
        isOpen={consecutiveTwoDayWarningData.isOpen}
        warning={consecutiveTwoDayWarningData.warning}
        onClose={() => {
          setConsecutiveTwoDayWarningData((prev) => ({ ...prev, isOpen: false }));
          consecutiveTwoDayWarningData.onCancelAssign();
        }}
        onConfirmAssign={() => {
          setConsecutiveTwoDayWarningData((prev) => ({ ...prev, isOpen: false }));
          consecutiveTwoDayWarningData.onConfirmAssign();
        }}
        onCancelAssign={() => {
          setConsecutiveTwoDayWarningData((prev) => ({ ...prev, isOpen: false }));
          consecutiveTwoDayWarningData.onCancelAssign();
        }}
      />

      {/* Auto Assign Modal */}
      <AutoAssignModal
        isOpen={isAutoAssignOpen}
        onClose={() => setIsAutoAssignOpen(false)}
        date={selectedDate}
        dayName={currentDayInfo}
        counters={counters}
        unassignedEmployees={unassignedEmployees}
        currentAssignment={currentDayAssignment}
        onExecute={handleExecuteAutoAssign}
        onOpenRulesConfig={() => {
          setIsAutoAssignOpen(false);
          setIsRulesModalOpen(true);
        }}
      />

      {/* Assignment Rules Config Modal */}
      <AssignmentRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        counters={counters}
        employees={employees}
        shifts={shifts}
        onRulesUpdated={() => {
          onDataChanged();
        }}
      />

      {/* Missing Schedule Employees Modal */}
      <MissingScheduleEmployeesModal
        isOpen={isMissingModalOpen}
        onClose={() => setIsMissingModalOpen(false)}
        missingEmployees={missingScheduleEmployees}
        onUpdateEmployeeCatalog={handleUpdateEmployeeCatalogForMissing}
        onExcludeEmployee={handleExcludeEmployee}
        onRestoreEmployee={handleRestoreEmployee}
        onExcludeAll={handleExcludeAllMissingEmployees}
      />

      {/* Inactive 2 Weeks Employees Modal */}
      <InactiveTwoWeeksModal
        isOpen={isInactiveTwoWeeksModalOpen}
        onClose={() => setIsInactiveTwoWeeksModalOpen(false)}
        inactiveEmployees={inactiveTwoWeeksEmployees}
        onMarkResigned={handleMarkInactiveEmployeeResigned}
        onMarkAllResigned={handleMarkAllInactiveEmployeesResigned}
        onManualReview={handleManualReviewInactiveEmployee}
      />

      {/* Clear All Day Confirmation */}
      <ConfirmDialog
        isOpen={isClearAllConfirmOpen}
        onClose={() => setIsClearAllConfirmOpen(false)}
        onConfirm={handleClearAllDay}
        title="Làm trống tất cả quầy trong ngày"
        message={
          <div>
            Bạn có chắc chắn muốn xóa toàn bộ phân công của <strong>{currentDayInfo} ({selectedDate})</strong> không?
            Các nhân viên sẽ được đưa trở lại danh sách Chưa phân quầy.
          </div>
        }
        confirmText="Xóa phân công"
        cancelText="Hủy"
        type="warning"
      />
    </div>
  );
};

