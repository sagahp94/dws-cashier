export type ShiftCategory = 'morning' | 'afternoon' | 'other' | 'off';

export interface Shift {
  shiftCode: string;       // Mã ca, e.g. V815, V829, OFF
  startTime: string;       // HH:mm, e.g. 08:00
  endTime: string;         // HH:mm, e.g. 17:00
  shiftType: string;       // "Ca Sáng", "Ca Chiều", "Ca Gãy", "Nghỉ", etc.
  category?: ShiftCategory;
  isOff?: boolean;         // true if shift is considered OFF / Nghỉ
  notes?: string;
}

export interface Counter {
  id: string;              // e.g. "1", "2 ssc", "101", "QL"
  counterNumber: string;   // Display number
  area: string;            // Khu vực, e.g. "Khu Thực phẩm", "Khu Tự chọn", "Quản lý"
  order?: number;          // Order for layout
  description?: string;
}

export interface Employee {
  employeeId: string;      // Mã nhân viên (unique ID)
  fullName: string;        // Tên nhân viên
  isSup?: boolean;         // SUP hay Nhân viên (o = SUP, x = Nhân viên)
  canSieuThi?: boolean;    // Đứng được quầy Siêu thị (o = có, x = không)
  canBanhMy?: boolean;     // Đứng được quầy Bánh mỳ (o = có, x = không)
  canDelica?: boolean;     // Đứng được quầy Delica (o = có, x = không)
  isResigned?: boolean;    // Đã nghỉ việc
  resignedAt?: string;     // Thời điểm đánh dấu đã nghỉ việc
  phone?: string;
  department?: string;
  notes?: string;
}

export interface WeeklyScheduleEntry {
  id: string;              // unique row id
  weekId: string;          // e.g. "2026-W34" (Monday YYYY-MM-DD)
  date: string;            // YYYY-MM-DD
  dayOfWeek: number;       // 1 (Thứ 2) -> 6 (Thứ 7)
  employeeId?: string;     // Mã NV if present
  employeeName: string;    // Tên nhân viên
  shiftCode: string;       // Mã ca
  isOff?: boolean;         // Có phải ca nghỉ không
  originalShiftCode?: string; // Ca ban đầu trước khi sửa (ca cũ)
  previousShiftCode?: string; // Ca trước lần sửa gần nhất
  modifiedAt?: string;     // Thời điểm sửa ca
  modificationNote?: string; // Ghi chú lý do sửa ca
  isHardRosterSynced?: boolean; // Đã sync file lịch cứng và thông báo cho nhân viên
  syncedAt?: string;       // Thời điểm tick xác nhận đã sync
}

export interface ShiftSwapRequest {
  id: string;                    // unique ID e.g. "swap_1727345678"
  date: string;                  // YYYY-MM-DD
  weekId: string;                // e.g. "2026-09-21"
  counterId: string;             // e.g. "21"
  counterNumber: string;         // e.g. "21"
  slot: 'morning' | 'afternoon';
  employeeId?: string;
  employeeName: string;
  shiftCode: string;
  startTime?: string;
  endTime?: string;
  reason: string;                // Lý do đổi ca (e.g. "Bận việc gia đình", "Sức khỏe", "Trùng lịch học")
  customNote?: string;           // Ghi chú chi tiết
  preferredTarget?: string;      // Nguyện vọng đổi sang ca nào
  urgent?: boolean;              // Cần đổi gấp
  requestedAt: string;           // ISO timestamp
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedNote?: string;
  swappedWithEmployeeName?: string;
  swappedWithEmployeeId?: string;
}

export interface SlotAssignment {
  employeeId?: string;
  employeeName: string;
  shiftCode: string;
  startTime?: string;
  endTime?: string;
  assignedAt?: string;
  swapRequested?: boolean;       // Có đang đề nghị đổi ca không
  swapRequestId?: string;        // ID của yêu cầu đổi ca
  swapReason?: string;           // Lý do tóm tắt
}

export interface CounterDayAssignment {
  counterId: string;
  morning?: SlotAssignment | null;      // Ca Sáng 1 (Ô trên 1)
  morning2?: SlotAssignment | null;     // Ca Sáng 2 (Ô trên 2)
  afternoon?: SlotAssignment | null;    // Ca Chiều 1 (Ô dưới 1)
  afternoon2?: SlotAssignment | null;   // Ca Chiều 2 (Ô dưới 2)
  excess?: string;         // Thừa (discrepancy)
  signed?: boolean;        // Ký xác nhận
  note?: string;
}

export interface DayDwsAssignment {
  date: string;            // YYYY-MM-DD
  weekId: string;          // e.g. "2026-W34"
  dayOfWeek: number;       // 1 (Thứ 2) -> 6 (Thứ 7)
  assignments: Record<string, CounterDayAssignment>; // key = counterId
  updatedAt: string;
  updatedBy?: string;
}

export interface UnassignedEmployee {
  employeeId?: string;
  fullName: string;
  shiftCode: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  category: ShiftCategory;
  isSup?: boolean;         // SUP hay Nhân viên (o/x)
  canSieuThi?: boolean;    // Đứng được quầy Siêu thị (o/x)
  canBanhMy?: boolean;     // Đứng được quầy Bánh mỳ (o/x)
  canDelica?: boolean;     // Đứng được quầy Delica (o/x)
  isResigned?: boolean;    // Nhân viên đã nghỉ việc
  exclusionNote?: string;  // Ghi chú không phân quầy (e.g. "Nghỉ việc")
  isMissingFromCatalog?: boolean;       // Chưa có trong danh sách nhân viên hoặc đã bị xóa
  isExcludedFromAssignment?: boolean;   // Đã được đánh dấu "Không phân quầy"
}

export interface MissingScheduleEmployee {
  employeeName: string;
  employeeId?: string;
  dates: string[];           // Danh sách ngày có ca trong tuần
  shiftCodes: string[];      // Danh sách mã ca làm việc
  isExcluded: boolean;       // Đã chọn "Không phân quầy" hay chưa
  isResigned?: boolean;      // Đã nghỉ việc
  exclusionNote?: string;    // Ghi chú loại trừ (e.g. "Nghỉ việc")
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  counterId?: string;
  employeeId?: string;
  employeeName?: string;
  date?: string;
}

export interface CatalogMetadata {
  updatedAt: string | null;
  fileName: string | null;
  count: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  raw: Record<string, any>;
  parsed: any;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  newRows: number;
  rows: ImportPreviewRow[];
  headers: string[];
  detectedType: 'shifts' | 'counters' | 'employees' | 'weeklySchedule';
  parsedData: any[];
}

export interface HistoryRecord {
  id: string;
  date: string;
  weekId: string;
  dayName: string;
  timestamp: string;
  author: string;
  workingCount: number;
  offCount: number;
  assignedCount: number;
  unassignedCount: number;
  counterCount: number;
  data: DayDwsAssignment;
}

export type ImportMode = 'overwrite' | 'append';

export interface FixedCounterRule {
  id: string;
  employeeName: string;
  employeeId?: string;
  counterId: string;
  slot?: 'morning' | 'afternoon' | 'both';
  dayOfWeek?: number; // 0 = all days, 1 (Thứ 2) -> 6 (Thứ 7)
  active: boolean;
  notes?: string;
}

export interface ShiftCounterPriorityRule {
  id: string;
  shiftCodes: string[]; // e.g. ["V815"], ["V818"], ["V820", "V822"]
  dayType: 'all' | 'weekday' | 'weekend' | 'specific_days'; // weekday: T2-T6, weekend: T7-CN
  specificDays?: number[]; // [1, 2, 3, 4, 5, 6, 7] (1 = T2, 7 = CN)
  priorityCounters: string[]; // e.g. ["21", "23", "SSC", "104", "106", "110", "114", "111"]
  notes?: string;
  active: boolean;
}

export interface AssignmentRuleConfig {
  autoMatchShiftCategory: boolean; // Bắt buộc Ca Sáng vào slot Sáng, Ca Chiều vào slot Chiều
  prioritizeSscCounters: boolean; // Ưu tiên xếp quầy SSC trước
  balanceAreas: boolean; // Cân bằng phân bổ nhân sự đều giữa các khu vực
  counterPriorityOrder: string[]; // Danh sách ID quầy theo thứ tự ưu tiên mở
  avoidConsecutiveDaysSameCounter: boolean; // Luân chuyển quầy giữa các ngày trong tuần
  fixedRules: FixedCounterRule[]; // Quy tắc gán cố định nhân sự - quầy
  shiftCounterRules?: ShiftCounterPriorityRule[]; // Quy tắc quầy ưu tiên theo ca làm việc (V815, V818, V820, V822...)
  prioritizeV6OverV8Afternoon?: boolean; // Ca chiều các quầy ưu tiên ca V6* trước ca V8*
}

export interface AutoAssignOptions {
  scope: 'current_day' | 'full_week';
  mode: 'fill_empty' | 'overwrite_all';
  applyFixedRules: boolean;
  applyCounterPriority: boolean;
  applyAreaBalancing: boolean;
}

export type ZoneType = 'Siêu thị' | 'Delica' | 'Bánh mì' | 'Mỹ phẩm - Dược phẩm' | 'CSKH' | 'Quản lý' | string;

export interface EmployeeZoneAssignment {
  employeeKey: string;
  employeeName: string;
  employeeId?: string;
  date: string;
  counterId: string;
  zone: string;
  slot: 'morning' | 'afternoon';
}

export interface TargetCounterDetail {
  spec: string;
  matchedCounters: Counter[];
  isAssigned: boolean;
  assignedTo?: {
    employeeName: string;
    shiftCode: string;
    slot: 'morning' | 'afternoon';
    counterId: string;
    counterNumber: string;
  };
}

export interface ShiftGroupDemandStat {
  groupKey: 'V815' | 'V818' | 'V820_V822' | 'V829_V830' | 'OTHER';
  groupLabel: string;
  shiftCodes: string[];
  shiftTypeLabel: string;
  badgeColor: string;
  totalStaff: number;
  assignedStaff: number;
  unassignedStaff: number;
  staffList: {
    employeeId?: string;
    employeeName: string;
    shiftCode: string;
    isAssigned: boolean;
    assignedCounterId?: string;
    assignedSlot?: 'morning' | 'afternoon';
  }[];
  targetCounters: TargetCounterDetail[];
  targetCount: number;
  balance: number;
  ruleNotes: string;
}

export interface AreaShiftDemandTarget {
  dayOfWeek: number;
  dayName: string;
  sieuThi: {
    morning: number;
    night: number;
    total: number;
  };
  fl2: {
    morning: number;
    night: number;
    total: number;
  };
  totalMorning: number;
  totalNight: number;
  grandTotal: number;
}

export interface AreaShiftActualStat {
  area: 'SIEU_THI' | 'FL2';
  areaLabel: string;
  morningTarget: number;
  morningStaff: number;
  morningAssigned: number;
  morningAssignedBalance: number; // morningAssigned - morningTarget
  morningStaffBalance: number; // morningStaff - morningTarget
  morningBalance: number; // legacy fallback

  nightTarget: number;
  nightStaff: number;
  nightAssigned: number;
  nightAssignedBalance: number; // nightAssigned - nightTarget
  nightStaffBalance: number; // nightStaff - nightTarget
  nightBalance: number; // legacy fallback

  totalTarget: number;
  totalStaff: number;
  totalAssigned: number;
  totalAssignedBalance: number; // totalAssigned - totalTarget
  totalStaffBalance: number; // totalStaff - totalTarget
  totalBalance: number; // legacy fallback
}

export interface AreaShiftComparisonResult {
  date: string;
  dayOfWeek: number;
  dayName: string;
  isWeekend: boolean;
  sieuThi: AreaShiftActualStat;
  fl2: AreaShiftActualStat;
  summary: {
    totalMorningTarget: number;
    totalMorningStaff: number;
    totalMorningAssigned: number;
    totalMorningAssignedBalance: number; // totalMorningAssigned - totalMorningTarget
    totalMorningStaffBalance: number; // totalMorningStaff - totalMorningTarget
    totalMorningBalance: number; // legacy fallback

    totalNightTarget: number;
    totalNightStaff: number;
    totalNightAssigned: number;
    totalNightAssignedBalance: number; // totalNightAssigned - totalNightTarget
    totalNightStaffBalance: number; // totalNightStaff - totalNightTarget
    totalNightBalance: number; // legacy fallback

    grandTotalTarget: number;
    grandTotalStaff: number;
    grandTotalAssigned: number;
    grandTotalAssignedBalance: number; // grandTotalAssigned - grandTotalTarget
    grandTotalStaffBalance: number; // grandTotalStaff - grandTotalTarget
    grandTotalBalance: number; // legacy fallback
  };
  morningStaffList: {
    employeeId?: string;
    employeeName: string;
    shiftCode: string;
    startTime?: string;
    isAssigned: boolean;
    assignedCounterNumber?: string;
    assignedArea?: string;
  }[];
  nightStaffList: {
    employeeId?: string;
    employeeName: string;
    shiftCode: string;
    startTime?: string;
    isAssigned: boolean;
    assignedCounterNumber?: string;
    assignedArea?: string;
  }[];
  standardWeeklyTable: Record<number, AreaShiftDemandTarget>;
}

export interface DailyShiftDemandResult {
  date: string;
  dayOfWeek: number;
  dayName: string;
  isWeekend: boolean;
  totalWorkingStaff: number;
  totalTargetCounters: number;
  overallBalance: number;
  groups: ShiftGroupDemandStat[];
  areaComparison?: AreaShiftComparisonResult;
}

export interface RecentCounterAssignment {
  date: string;
  dayNameShort: string; // e.g. "T4 (19/08)"
  counterId: string;
  counterNumber: string;
  zone: string;
  slot: 'morning' | 'afternoon';
  shiftCode?: string;
}

export interface EmployeeRecentHistorySummary {
  streakZone: string | null;
  streakCount: number;
  recentHistoryText: string;
  isSup?: boolean;
  isExemptFromStreakWarning?: boolean;
  recentCounters: RecentCounterAssignment[];
  recentCounterNumbers: string[];
  lastWorkedCounterNumber?: string;
}

export interface ZoneStreakWarning {
  employeeName: string;
  employeeId?: string;
  isSup?: boolean;
  targetZone: string;
  targetCounterId: string;
  targetCounterNumber?: string;
  targetSlot: 'morning' | 'afternoon';
  streakDays: number;
  dates: string[];
}

export interface AppCreatorParsedFields {
  creatorName?: string;
  email?: string;
  department?: string;
  role?: string;
  developmentStartDate?: string;
  appDescription?: string;
  contactInfo?: string;
  notes?: string;
  customFields?: { label: string; value: string }[];
}

export interface AppCreatorInfo {
  rawText: string;
  parsedFields: AppCreatorParsedFields;
  updatedAt: string;
  updatedByUid: string;
  updatedByEmail?: string | null;
  version?: string;
}

export interface AppChangelogItem {
  version: string;
  date: string;
  title: string;
  description: string;
  highlights: string[];
  tags: ('security' | 'feature' | 'performance' | 'ui' | 'sync')[];
  isCurrent?: boolean;
}

