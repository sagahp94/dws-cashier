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
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'grid' | 'unassigned'>('grid');

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
    success(
      'Khắc phục dữ liệu thành công',
      `Đã đồng bộ lại ${res.repairedEmployeesCount} nhân sự và ${res.repairedScheduleCount} lịch ca làm việc hợp lệ.`
    );
    onDataChanged();
  };

  // Handlers for Missing Schedule Employees
  const handleAddEmployeeFromSchedule = (emp: { fullName?: string; employeeName?: string; employeeId?: string }) => {
    const name = emp.employeeName || emp.fullName || '';
    if (!name) return;
    const added = storageService.addEmployeeFromSchedule(name, emp.employeeId);
    success('Đã thêm nhân viên', `Đã bổ sung ${added.fullName} vào Danh sách nhân viên thành công.`);
    onDataChanged();
  };

  const handleAddAllMissingEmployees = () => {
    const unresolved = missingScheduleEmployees.filter((e) => !e.isExcluded);
    if (unresolved.length === 0) return;
    const added = storageService.batchAddEmployeesFromSchedule(unresolved);
    success('Đã thêm nhân viên', `Đã bổ sung ${added.length} nhân viên vào Danh sách nhân viên thành công.`);
    onDataChanged();
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
        <div className="space-y-5">
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
            onPreviewDws={onPreviewDws}
          />

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
            onPreviewPdf={onPreviewDws}
            onAutoAssign={() => setIsAutoAssignOpen(true)}
            onAutoSuggest={() => setIsAutoSuggestOpen(true)}
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

          {/* 4.2. MISSING EMPLOYEES ALERT BANNER */}
          <MissingEmployeesAlertBanner
            missingEmployees={missingScheduleEmployees}
            onOpenModal={() => setIsMissingModalOpen(true)}
            onAddAll={handleAddAllMissingEmployees}
            onExcludeAll={handleExcludeAllMissingEmployees}
          />

          {/* 5. VALIDATION CONFLICT ALERTS */}
          <ConflictAlertBanner issues={validationIssues} onAutoFix={handleAutoRepair} />

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
                onAddEmployee={handleAddEmployeeFromSchedule}
                onExcludeEmployee={handleExcludeEmployee}
                onRestoreEmployee={handleRestoreEmployee}
                onSelectEmployee={(emp) => {
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
        onAddEmployee={handleAddEmployeeFromSchedule}
        onExcludeEmployee={handleExcludeEmployee}
        onRestoreEmployee={handleRestoreEmployee}
        onAddAll={handleAddAllMissingEmployees}
        onExcludeAll={handleExcludeAllMissingEmployees}
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

