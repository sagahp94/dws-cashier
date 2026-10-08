import React, { useState, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { excelService, isOffShift } from '../services/excelService';
import { Shift, Counter, Employee, CatalogMetadata, WeeklyScheduleEntry } from '../types';
import { useToast } from '../components/common/ToastContainer';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import {
  Clock,
  LayoutGrid,
  Users,
  Upload,
  Eye,
  Trash2,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Database,
  RefreshCcw,
  Search,
  ExternalLink,
  UserX,
  X,
  CheckSquare,
  Square,
  UserMinus,
  HardDrive,
  Check,
  Edit3,
  Sparkles,
  ArrowRight,
  History,
  User,
  Filter,
  RotateCcw,
  Image as ImageIcon,
  Info,
} from 'lucide-react';

/**
 * Phân loại ca thành 'morning' (ca sáng), 'afternoon' (ca chiều), hoặc 'off' (ca nghỉ)
 */
export function getShiftSlotType(shiftCode: string, shiftsCatalog: Shift[]): 'morning' | 'afternoon' | 'off' {
  const code = (shiftCode || '').trim().toUpperCase();
  if (isOffShift(code) || ['OFF', 'AL', 'RO', 'DO', 'PRD', 'TS', 'OT-OFF'].includes(code)) {
    return 'off';
  }

  // Check matching shift in catalog
  const match = shiftsCatalog.find((s) => s.shiftCode.trim().toUpperCase() === code);
  if (match) {
    if (match.isOff || match.category === 'off') return 'off';
    if (match.category === 'morning') return 'morning';
    if (match.category === 'afternoon') return 'afternoon';
    if (match.startTime) {
      const h = parseInt(match.startTime.split(':')[0], 10);
      if (!isNaN(h)) {
        return h < 12 ? 'morning' : 'afternoon';
      }
    }
  }

  // Fallback pattern matching for AEON shifts:
  // V814 (08:00), V815 (08:00), V615 (08:00), V818 (09:00), V618, S1, S2, S3, etc. -> Morning
  if (
    code.startsWith('V814') ||
    code.startsWith('V815') ||
    code.startsWith('V615') ||
    code.startsWith('V818') ||
    code.startsWith('V618') ||
    code.startsWith('S') ||
    code === '814' ||
    code === '815' ||
    code === '818'
  ) {
    return 'morning';
  }

  // V820 (13:00), V822 (14:00), V829 (13:30/14:00-22:00), V830, V633, C1, C2, C3, etc. -> Afternoon
  if (
    code.startsWith('V820') ||
    code.startsWith('V822') ||
    code.startsWith('V829') ||
    code.startsWith('V830') ||
    code.startsWith('V633') ||
    code.startsWith('C') ||
    code === '820' ||
    code === '822' ||
    code === '829' ||
    code === '830'
  ) {
    return 'afternoon';
  }

  return 'morning';
}
import { ImportDataType } from '../components/import/DataImportModal';
import { AssignmentRulesSection } from '../components/settings/AssignmentRulesSection';
import { BackupProgressModal, BackupProgressState } from '../components/common/BackupProgressModal';
import { EditWeeklyShiftModal } from '../components/dws/EditWeeklyShiftModal';
import { EmployeeHoverCard } from '../components/dws/EmployeeHoverCard';
import { ExportModifiedShiftsModal } from '../components/dws/ExportModifiedShiftsModal';

interface SettingsPageProps {
  shifts: Shift[];
  shiftsMeta: CatalogMetadata;
  counters: Counter[];
  countersMeta: CatalogMetadata;
  employees: Employee[];
  employeesMeta: CatalogMetadata;
  weeklySchedule?: WeeklyScheduleEntry[];
  currentMonday?: string;
  onOpenImport: (type: ImportDataType) => void;
  onDataChanged: () => void;
  onOpenCloudSync?: () => void;
  onOpenAbout?: () => void;
  onOpenUiGallery?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  shifts,
  shiftsMeta,
  counters,
  countersMeta,
  employees,
  employeesMeta,
  weeklySchedule = [],
  currentMonday,
  onOpenImport,
  onDataChanged,
  onOpenCloudSync,
  onOpenAbout,
  onOpenUiGallery,
}) => {
  const { success, error, info } = useToast();

  // Viewing catalog details modal
  const [viewingCatalog, setViewingCatalog] = useState<'shifts' | 'counters' | 'employees' | 'weeklySchedule' | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [filterOnlyModifiedSchedule, setFilterOnlyModifiedSchedule] = useState(false);
  const [scheduleSyncFilter, setScheduleSyncFilter] = useState<'all' | 'unsynced' | 'synced'>('all');
  const [editingScheduleEntry, setEditingScheduleEntry] = useState<WeeklyScheduleEntry | null>(null);
  const [isExportModifiedModalOpen, setIsExportModifiedModalOpen] = useState(false);
  const [exportInitialFilter, setExportInitialFilter] = useState<
    'all_modified' | 'unsynced_modified' | 'synced_modified' | 'current_filtered'
  >('all_modified');

  // New filters for weekly schedule view
  const [scheduleDateFilter, setScheduleDateFilter] = useState<string>('all');
  const [scheduleEmployeeFilter, setScheduleEmployeeFilter] = useState<string>('all');
  const [scheduleSlotFilter, setScheduleSlotFilter] = useState<'all' | 'morning' | 'afternoon' | 'off'>('all');

  // Compute unique dates for weekly schedule filter
  const scheduleDates = useMemo(() => {
    const dates = Array.from(new Set(weeklySchedule.map((e) => e.date).filter(Boolean))).sort();
    const DAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return dates.map((dateStr) => {
      let label = dateStr;
      try {
        const parts = dateStr.split('-').map(Number);
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2], 12);
          label = `${DAY_NAMES[d.getDay()]}, ${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}`;
        }
      } catch {
        // fallback
      }
      const count = weeklySchedule.filter((e) => e.date === dateStr).length;
      return { date: dateStr, label, count };
    });
  }, [weeklySchedule]);

  // Compute unique employees for weekly schedule filter
  const scheduleEmployees = useMemo(() => {
    const map = new Map<string, { name: string; id?: string; count: number }>();
    weeklySchedule.forEach((e) => {
      const name = (e.employeeName || '').trim();
      if (!name) return;
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
        if (!existing.id && e.employeeId) existing.id = e.employeeId;
      } else {
        map.set(name, { name, id: e.employeeId, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
    );
  }, [weeklySchedule]);

  // Compute morning, afternoon, and off counts for weekly schedule based on active filters
  const scheduleSlotCounts = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let off = 0;

    weeklySchedule.forEach((e) => {
      if (scheduleDateFilter !== 'all' && e.date !== scheduleDateFilter) return;
      if (scheduleEmployeeFilter !== 'all' && (e.employeeName || '').trim() !== scheduleEmployeeFilter) return;
      if (filterOnlyModifiedSchedule) {
        const isModified = !!(e.originalShiftCode && e.originalShiftCode !== e.shiftCode);
        if (!isModified) return;
        if (scheduleSyncFilter === 'unsynced' && e.isHardRosterSynced) return;
        if (scheduleSyncFilter === 'synced' && !e.isHardRosterSynced) return;
      }

      const cat = getShiftSlotType(e.shiftCode, shifts);
      if (cat === 'morning') morning++;
      else if (cat === 'afternoon') afternoon++;
      else if (cat === 'off') off++;
    });

    return { morning, afternoon, off };
  }, [weeklySchedule, scheduleDateFilter, scheduleEmployeeFilter, filterOnlyModifiedSchedule, scheduleSyncFilter, shifts]);

  // Filtered and sorted weekly schedule entries
  const filteredWeeklySchedule = useMemo(() => {
    return weeklySchedule
      .filter((entry) => {
        if (filterOnlyModifiedSchedule) {
          const isModified = !!(entry.originalShiftCode && entry.originalShiftCode !== entry.shiftCode);
          if (!isModified) return false;
          if (scheduleSyncFilter === 'unsynced' && entry.isHardRosterSynced) return false;
          if (scheduleSyncFilter === 'synced' && !entry.isHardRosterSynced) return false;
        }
        if (scheduleDateFilter !== 'all' && entry.date !== scheduleDateFilter) {
          return false;
        }
        if (scheduleEmployeeFilter !== 'all' && (entry.employeeName || '').trim() !== scheduleEmployeeFilter) {
          return false;
        }
        if (scheduleSlotFilter !== 'all') {
          const cat = getShiftSlotType(entry.shiftCode, shifts);
          if (cat !== scheduleSlotFilter) return false;
        }
        const search = catalogSearch.toLowerCase().trim();
        if (!search) return true;
        return (
          entry.employeeName.toLowerCase().includes(search) ||
          (entry.employeeId && entry.employeeId.toLowerCase().includes(search)) ||
          entry.shiftCode.toLowerCase().includes(search) ||
          entry.date.includes(search) ||
          (entry.originalShiftCode && entry.originalShiftCode.toLowerCase().includes(search))
        );
      })
      .sort((a, b) => {
        // 1. Sắp xếp theo Ngày tăng dần (ví dụ: 2026-09-21 -> 2026-09-22) để khớp với bản in và file Excel
        const dateA = a.date || '';
        const dateB = b.date || '';
        const dateCompare = dateA.localeCompare(dateB);
        if (dateCompare !== 0) return dateCompare;

        // 2. Sắp xếp theo Tên nhân viên theo bảng chữ cái tiếng Việt (A -> Z)
        const nameA = (a.employeeName || '').trim();
        const nameB = (b.employeeName || '').trim();
        const nameCompare = nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
        if (nameCompare !== 0) return nameCompare;

        // 3. Nếu cùng tên thì sắp theo Mã nhân viên
        const idA = (a.employeeId || '').trim();
        const idB = (b.employeeId || '').trim();
        return idA.localeCompare(idB, 'vi', { numeric: true });
      });
  }, [weeklySchedule, filterOnlyModifiedSchedule, scheduleSyncFilter, scheduleDateFilter, scheduleEmployeeFilter, scheduleSlotFilter, catalogSearch, shifts]);

  const handleToggleHardRosterSync = (entry: WeeklyScheduleEntry) => {
    const res = storageService.toggleWeeklyScheduleHardRosterSync({
      weekId: entry.weekId || currentMonday,
      date: entry.date,
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
    });
    if (res.success) {
      if (res.isHardRosterSynced) {
        success(`Đã tick "Đã sync file lịch cứng & báo NV" cho ${entry.employeeName} (${entry.date})`);
      } else {
        info(`Đã bỏ tick sync lịch cứng cho ${entry.employeeName} (${entry.date})`);
      }
      onDataChanged();
    }
  };

  const handleBatchSyncHardRoster = (entriesToSync: WeeklyScheduleEntry[]) => {
    if (entriesToSync.length === 0) return;
    const count = storageService.batchSetWeeklyScheduleHardRosterSync(
      entriesToSync.map((e) => ({ date: e.date, employeeId: e.employeeId, employeeName: e.employeeName })),
      true
    );
    success(`Đã đánh dấu sync file lịch cứng thành công cho ${count} lượt ca đã chọn!`);
    onDataChanged();
  };

  // Individual employee deletion state
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  // Multi-selected employees for batch deletion
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isBatchDeletingEmployees, setIsBatchDeletingEmployees] = useState(false);
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<'all' | 'active' | 'resigned'>('all');

  // Toggle employee area capability (Siêu thị, Bánh mỳ, Delica, SUP) directly via double click
  const handleToggleEmployeeCapability = (
    emp: Employee,
    field: 'canSieuThi' | 'canBanhMy' | 'canDelica' | 'isSup'
  ) => {
    const currentValue = field === 'canSieuThi' ? emp.canSieuThi !== false : !!emp[field];
    const newValue = !currentValue;
    storageService.updateEmployee(emp.employeeId, { [field]: newValue });
    onDataChanged();

    const fieldLabel =
      field === 'canSieuThi'
        ? 'Khu vực Siêu thị'
        : field === 'canBanhMy'
        ? 'Khu vực Bánh mỳ'
        : field === 'canDelica'
        ? 'Khu vực Delica'
        : 'Vai trò SUP';

    success(
      `Đã cập nhật ${emp.fullName}`,
      `${fieldLabel}: chuyển sang "${newValue ? 'o (Có)' : 'x (Không)'}"`
    );
  };

  // Toggle employee "Đã nghỉ việc" status
  const handleToggleEmployeeResigned = (emp: Employee) => {
    const nextResigned = !emp.isResigned;
    const { removedCount } = storageService.setEmployeeResigned(emp.employeeId, nextResigned, currentMonday);
    onDataChanged();

    if (nextResigned) {
      info(
        `Đã đánh dấu nghỉ việc: ${emp.fullName}`,
        `Nhân viên sẽ mặc định đưa vào danh sách "Không phân quầy" với ghi chú "Nghỉ việc"${
          removedCount > 0 ? ` (đã gỡ khỏi ${removedCount} ca quầy)` : ''
        }.`
      );
    } else {
      success(
        `Đã cập nhật đi làm lại: ${emp.fullName}`,
        `Nhân viên ${emp.fullName} đã được đưa trở lại danh sách nhân viên đi làm hiện tại.`
      );
    }
  };

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<'shifts' | 'counters' | 'employees' | 'weeklySchedule' | 'all' | null>(null);

  const handleDeleteSingleEmployee = () => {
    if (!employeeToDelete) return;
    const emp = employeeToDelete;
    storageService.deleteEmployee(emp.employeeId);
    setSelectedEmployeeIds((prev) => prev.filter((id) => id !== emp.employeeId));
    setEmployeeToDelete(null);
    onDataChanged();
    success(`Đã xóa nhân viên "${emp.fullName}" (${emp.employeeId}) khỏi danh sách thành công.`);
  };

  const handleBatchDeleteEmployees = () => {
    if (selectedEmployeeIds.length === 0) return;
    const count = selectedEmployeeIds.length;
    storageService.deleteEmployees(selectedEmployeeIds);
    setSelectedEmployeeIds([]);
    setIsBatchDeletingEmployees(false);
    onDataChanged();
    success(`Đã xóa ${count} nhân viên đã chọn khỏi danh sách thành công.`);
  };

  const handleDeleteCatalog = () => {
    if (!deleteTarget) return;

    if (deleteTarget === 'shifts') {
      storageService.clearShifts();
      success('Đã xóa sạch toàn bộ danh mục ca làm việc (0 ca)');
    } else if (deleteTarget === 'counters') {
      storageService.clearCounters();
      success('Đã xóa sạch toàn bộ danh mục quầy thu ngân (0 quầy)');
    } else if (deleteTarget === 'employees') {
      storageService.clearEmployees();
      success('Đã xóa sạch toàn bộ danh mục nhân viên (0 nhân viên)');
    } else if (deleteTarget === 'weeklySchedule') {
      storageService.clearWeeklySchedule();
      success('Đã xóa sạch toàn bộ lịch ca làm việc tuần');
    } else if (deleteTarget === 'all') {
      storageService.resetAll();
      success('Đã xóa sạch toàn bộ cơ sở dữ liệu hệ thống');
    }

    setDeleteTarget(null);
    setViewingCatalog(null);
    onDataChanged();
  };

  const handleRestoreSampleData = () => {
    storageService.restoreDefaultSampleData();
    success('Đã nạp lại danh mục ca và quầy mẫu mặc định AEON thành công!');
    onDataChanged();
  };

  // Backup & Restore Progress State
  const [backupProgress, setBackupProgress] = useState<BackupProgressState>({
    isOpen: false,
    type: 'backup',
    percent: 0,
    stepText: '',
    isComplete: false,
    error: null,
    fileName: '',
  });

  const handleExportBackup = async () => {
    const fileName = `Backup_DWS_System_${new Date().toISOString().split('T')[0]}.json`;
    try {
      setBackupProgress({
        isOpen: true,
        type: 'backup',
        percent: 15,
        stepText: 'Đang đọc danh mục Ca làm việc và Quầy thu ngân...',
        isComplete: false,
        error: null,
        fileName,
      });

      await new Promise((r) => setTimeout(r, 120));
      setBackupProgress((prev) => ({
        ...prev,
        percent: 45,
        stepText: 'Đang đóng gói hồ sơ Nhân viên & Lịch làm việc tuần...',
      }));

      await new Promise((r) => setTimeout(r, 150));
      setBackupProgress((prev) => ({
        ...prev,
        percent: 75,
        stepText: 'Đang tổng hợp dữ liệu Phân bổ DWS và Quy tắc xếp quầy...',
      }));

      await new Promise((r) => setTimeout(r, 150));
      const jsonStr = storageService.exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;

      setBackupProgress((prev) => ({
        ...prev,
        percent: 95,
        stepText: 'Đang chuẩn bị tải tệp sao lưu về máy...',
      }));

      await new Promise((r) => setTimeout(r, 150));
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupProgress((prev) => ({
        ...prev,
        percent: 100,
        stepText: `Đã xuất tệp sao lưu "${fileName}" và tải về máy thành công!`,
        isComplete: true,
      }));
      success('Đã xuất file sao lưu dữ liệu toàn hệ thống');
    } catch (err: any) {
      console.error('Export backup error:', err);
      setBackupProgress((prev) => ({
        ...prev,
        error: err?.message || 'Có lỗi xảy ra khi tạo tệp sao lưu.',
      }));
      error('Có lỗi xảy ra khi tạo tệp sao lưu.');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    setBackupProgress({
      isOpen: true,
      type: 'restore',
      percent: 20,
      stepText: `Đang nạp file sao lưu "${fileName}" từ máy tính...`,
      isComplete: false,
      error: null,
      fileName,
    });

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await new Promise((r) => setTimeout(r, 220));
        setBackupProgress((prev) => ({
          ...prev,
          percent: 50,
          stepText: 'Đang kiểm tra tính hợp lệ & cấu trúc dữ liệu bản sao lưu...',
        }));

        await new Promise((r) => setTimeout(r, 250));
        const content = ev.target?.result as string;

        setBackupProgress((prev) => ({
          ...prev,
          percent: 80,
          stepText: 'Đang ghi danh mục, lịch tuần và phân quầy DWS vào máy...',
        }));

        await new Promise((r) => setTimeout(r, 250));
        const ok = storageService.importAllData(content);

        if (ok) {
          setBackupProgress((prev) => ({
            ...prev,
            percent: 100,
            stepText: 'Đã khôi phục toàn bộ dữ liệu từ bản sao lưu thành công!',
            isComplete: true,
          }));
          success('Đã khôi phục dữ liệu từ bản sao lưu thành công!');
          onDataChanged();
        } else {
          setBackupProgress((prev) => ({
            ...prev,
            error: 'File sao lưu không hợp lệ hoặc dữ liệu bị hỏng cấu trúc.',
          }));
          error('File sao lưu không hợp lệ.');
        }
      } catch (err: any) {
        setBackupProgress((prev) => ({
          ...prev,
          error: err?.message || 'Có lỗi xảy ra khi khôi phục dữ liệu.',
        }));
        error('File sao lưu không hợp lệ.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Chưa cập nhật';
    const d = new Date(iso);
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN')}`;
  };

  return (
    <div id="settings-page" className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Page Heading */}
      <div className="neu-panel p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Cài đặt danh mục & dữ liệu</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý độc lập các danh mục nền tảng: Ca làm việc, Danh sách Quầy, Nhân viên và Lịch tuần
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onOpenAbout && (
            <button
              type="button"
              id="btn-settings-about-app"
              onClick={onOpenAbout}
              className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer"
              title="Xem thông tin chi tiết về ứng dụng, tác giả và lịch sử phiên bản"
            >
              <Info className="w-3.5 h-3.5 text-teal-700" />
              <span>Thông tin ứng dụng</span>
            </button>
          )}

          {onOpenCloudSync && (
            <button
              type="button"
              id="btn-settings-cloud-sync"
              onClick={onOpenCloudSync}
              className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer text-teal-800"
            >
              <HardDrive className="w-3.5 h-3.5 text-teal-700" />
              <span>Sao lưu & Khôi phục (JSON)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRestoreSampleData}
            title="Nạp lại danh mục Ca và Quầy chuẩn mặc định của siêu thị AEON"
            className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-teal-800 text-xs font-medium rounded-lg transition-all cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-teal-700" />
            <span>Nạp mẫu mặc định AEON</span>
          </button>

          <button
            type="button"
            id="btn-settings-export-backup"
            onClick={handleExportBackup}
            disabled={backupProgress.isOpen && !backupProgress.isComplete}
            title="Tải tệp sao lưu toàn bộ hệ thống (.json) về máy tính để lưu trữ hoặc chuyển sang máy khác"
            className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-700 text-xs font-medium rounded-lg transition-all cursor-pointer disabled:opacity-60"
          >
            {backupProgress.isOpen && backupProgress.type === 'backup' && !backupProgress.isComplete ? (
              <RefreshCcw className="w-3.5 h-3.5 animate-spin text-teal-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>
              {backupProgress.isOpen && backupProgress.type === 'backup' && !backupProgress.isComplete
                ? `Đang sao lưu (${backupProgress.percent}%)`
                : 'Sao lưu tệp (.json)'}
            </span>
          </button>

          <label
            id="lbl-settings-restore-backup"
            title="Khôi phục dữ liệu từ tệp sao lưu (.json) ngoại tuyến của máy khác"
            className={`neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-700 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              backupProgress.isOpen && backupProgress.type === 'restore' && !backupProgress.isComplete
                ? 'opacity-60 cursor-not-allowed'
                : ''
            }`}
          >
            {backupProgress.isOpen && backupProgress.type === 'restore' && !backupProgress.isComplete ? (
              <RefreshCcw className="w-3.5 h-3.5 animate-spin text-teal-600" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>
              {backupProgress.isOpen && backupProgress.type === 'restore' && !backupProgress.isComplete
                ? `Đang khôi phục (${backupProgress.percent}%)`
                : 'Khôi phục (.json)'}
            </span>
            <input
              id="input-settings-restore-file"
              type="file"
              accept=".json"
              disabled={backupProgress.isOpen && !backupProgress.isComplete}
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 4 Catalog Cards (Shifts, Counters, Employees, Weekly Roster) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. DANH MỤC CA LÀM VIỆC */}
        <div
          id="card-catalog-shifts"
          className="glass-card rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-all border-white/80"
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-amber-100/90 text-amber-800 border border-amber-200 shadow-2xs">
                <Clock className="w-5 h-5" />
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  shifts.length > 0
                    ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {shifts.length > 0 ? `${shifts.length} ca` : 'Trống (0 ca)'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Danh mục Ca làm việc</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Mã ca, giờ bắt đầu, kết thúc và phân loại ca (Sáng, Chiều, Nghỉ).
              </p>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1 glass-card p-2.5 rounded-2xl border-white/80">
              <div>
                Nguồn: <strong className="text-slate-800">{shiftsMeta.fileName || (shifts.length > 0 ? 'Mặc định' : 'Chưa có')}</strong>
              </div>
              <div>
                Cập nhật: <span className="font-mono text-slate-600">{formatDate(shiftsMeta.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200/60">
            <button
              type="button"
              id="btn-upload-shifts"
              onClick={() => onOpenImport('shifts')}
              className="glass-button-primary w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4 text-teal-200" />
              {shifts.length > 0 ? 'Nạp / Thay thế Ca' : 'Tải file Excel Ca'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setViewingCatalog('shifts')}
                disabled={shifts.length === 0}
                className="py-2 text-xs font-bold text-slate-700 glass-card rounded-xl hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" /> Xem dữ liệu
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget('shifts')}
                disabled={shifts.length === 0}
                className="py-2 text-xs font-bold text-rose-600 glass-card border-rose-200/80 hover:bg-rose-50/80 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa dữ liệu
              </button>
            </div>
          </div>
        </div>

        {/* 2. DANH SÁCH QUẦY THU NGÂN */}
        <div
          id="card-catalog-counters"
          className="glass-card rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-all border-white/80"
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-blue-100/90 text-blue-800 border border-blue-200 shadow-2xs">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  counters.length > 0
                    ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {counters.length > 0 ? `${counters.length} quầy` : 'Trống (0 quầy)'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Danh sách Quầy Thu Ngân</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Số quầy (1, 2 ssc, 24, 101, QL...) và khu vực bố trí siêu thị.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1 glass-card p-2.5 rounded-2xl border-white/80">
              <div>
                Nguồn: <strong className="text-slate-800">{countersMeta.fileName || (counters.length > 0 ? 'Mặc định' : 'Chưa có')}</strong>
              </div>
              <div>
                Cập nhật: <span className="font-mono text-slate-600">{formatDate(countersMeta.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200/60">
            <button
              type="button"
              id="btn-upload-counters"
              onClick={() => onOpenImport('counters')}
              className="glass-button-primary w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4 text-teal-200" />
              {counters.length > 0 ? 'Nạp / Thay thế Quầy' : 'Tải file Excel Quầy'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setViewingCatalog('counters')}
                disabled={counters.length === 0}
                className="py-2 text-xs font-bold text-slate-700 glass-card rounded-xl hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" /> Xem dữ liệu
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget('counters')}
                disabled={counters.length === 0}
                className="py-2 text-xs font-bold text-rose-600 glass-card border-rose-200/80 hover:bg-rose-50/80 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa dữ liệu
              </button>
            </div>
          </div>
        </div>

        {/* 3. DANH SÁCH NHÂN VIÊN */}
        <div
          id="card-catalog-employees"
          className="glass-card rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-all border-white/80"
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-purple-100/90 text-purple-800 border border-purple-200 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  employees.length > 0
                    ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {employees.length > 0
                  ? `${employees.filter((e) => !e.isResigned).length} đi làm / ${employees.length} NV`
                  : 'Trống (0 NV)'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Danh sách Nhân viên</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Mã nhân viên (ID duy nhất), Họ tên thu ngân, SĐT và Bộ phận.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1 glass-card p-2.5 rounded-2xl border-white/80">
              <div>
                Nguồn: <strong className="text-slate-800">{employeesMeta.fileName || 'Chưa có'}</strong>
              </div>
              <div>
                Cập nhật: <span className="font-mono text-slate-600">{formatDate(employeesMeta.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200/60">
            <button
              type="button"
              id="btn-upload-employees"
              onClick={() => onOpenImport('employees')}
              className="glass-button-primary w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4 text-teal-200" />
              {employees.length > 0 ? 'Nạp / Thay thế NV' : 'Tải file Excel NV'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setViewingCatalog('employees')}
                disabled={employees.length === 0}
                className="py-2 text-xs font-bold text-slate-700 glass-card rounded-xl hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" /> Xem dữ liệu
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget('employees')}
                disabled={employees.length === 0}
                className="py-2 text-xs font-bold text-rose-600 glass-card border-rose-200/80 hover:bg-rose-50/80 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa dữ liệu
              </button>
            </div>
          </div>
        </div>

        {/* 4. CA LÀM VIỆC TUẦN */}
        <div
          id="card-catalog-weekly-schedule"
          className="glass-card rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-all border-white/80"
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-indigo-100/90 text-indigo-800 border border-indigo-200 shadow-2xs">
                <Calendar className="w-5 h-5" />
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  weeklySchedule.length > 0
                    ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {weeklySchedule.length > 0 ? `${weeklySchedule.length} lượt ca` : 'Trống (0 ca)'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Ca làm việc Tuần</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Lịch ca phân công hàng tuần của nhân viên từ Thứ 2 đến Chủ nhật.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1 glass-card p-2.5 rounded-2xl border-white/80">
              <div>
                Tuần: <strong className="text-slate-800 font-mono">{currentMonday || 'Hiện tại'}</strong>
              </div>
              <div>
                Trạng thái: <span className="font-semibold text-slate-700">{weeklySchedule.length > 0 ? 'Đã nạp lịch' : 'Chưa nạp lịch'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200/60">
            <button
              type="button"
              id="btn-upload-weekly-schedule"
              onClick={() => onOpenImport('weeklySchedule')}
              className="glass-button-primary w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4 text-teal-200" />
              {weeklySchedule.length > 0 ? 'Nạp / Thay thế Lịch' : 'Tải file Excel Lịch Tuần'}
            </button>

            {weeklySchedule.length > 0 && (
              <button
                type="button"
                id="btn-card-export-modified-shifts"
                onClick={() => {
                  setExportInitialFilter('all_modified');
                  setIsExportModifiedModalOpen(true);
                }}
                className="w-full py-2 px-3 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/90 border border-amber-300/80 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                title="Tải xuống danh sách các ca làm việc đã chỉnh sửa định dạng PDF hoặc Excel"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                <span>Tải file ca đã sửa (PDF / Excel)</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setViewingCatalog('weeklySchedule')}
                disabled={weeklySchedule.length === 0}
                className="py-2 text-xs font-bold text-slate-700 glass-card rounded-xl hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" /> Xem dữ liệu
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget('weeklySchedule')}
                disabled={weeklySchedule.length === 0}
                className="py-2 text-xs font-bold text-rose-600 glass-card border-rose-200/80 hover:bg-rose-50/80 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa dữ liệu
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Assign Rules Configuration Section */}
      <AssignmentRulesSection
        counters={counters}
        employees={employees}
        onRulesChanged={onDataChanged}
      />

      {/* Sample Templates Download Card */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Tải các file Excel mẫu chuẩn (.xlsx)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Tải file mẫu về máy tính để điền dữ liệu thực tế rồi nạp vào hệ thống theo đúng cấu trúc tiêu đề cột.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => excelService.downloadSampleTemplate('shifts')}
            className="p-4 rounded-2xl glass-card border-white/80 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group cursor-pointer shadow-2xs"
          >
            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center justify-between">
              <span>Mẫu Danh mục Ca</span>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Mã ca, Giờ BĐ, Giờ KT, Loại ca</div>
          </button>

          <button
            type="button"
            onClick={() => excelService.downloadSampleTemplate('counters')}
            className="p-4 rounded-2xl glass-card border-white/80 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group cursor-pointer shadow-2xs"
          >
            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center justify-between">
              <span>Mẫu Danh sách Quầy</span>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Số quầy, Khu vực bố trí</div>
          </button>

          <button
            type="button"
            onClick={() => excelService.downloadSampleTemplate('employees')}
            className="p-4 rounded-2xl glass-card border-white/80 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group cursor-pointer shadow-2xs"
          >
            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center justify-between">
              <span>Mẫu Danh sách Nhân viên</span>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Mã NV, Tên NV, SUP, Siêu thị, Bánh mỳ, Delica, SĐT</div>
          </button>

          <button
            type="button"
            onClick={() => excelService.downloadSampleTemplate('weeklySchedule')}
            className="p-4 rounded-2xl glass-card border-white/80 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group cursor-pointer shadow-2xs"
          >
            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center justify-between">
              <span>Mẫu Ca làm việc tuần</span>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Dạng ma trận T2-T7 & Dạng dòng</div>
          </button>
        </div>
      </div>


      {/* Offline JSON Backup & Restore Panel */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm border border-teal-200/80 bg-gradient-to-br from-white/90 via-teal-50/25 to-emerald-50/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Trung tâm Sao lưu & Khôi phục Ngoại tuyến (Tệp JSON)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Ngoại tuyến 100%
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Xuất hoặc nạp tệp sao lưu .json để chuyển đổi dữ liệu giữa các máy tính (Máy A ↔ Máy B) hoàn toàn ngoại tuyến, an toàn và không phụ thuộc mạng.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenUiGallery && (
              <button
                type="button"
                id="btn-settings-open-ui-gallery"
                onClick={onOpenUiGallery}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-teal-700" />
                <span>Xem ảnh giao diện</span>
              </button>
            )}

            {onOpenCloudSync && (
              <button
                type="button"
                id="btn-settings-open-cloud-modal"
                onClick={onOpenCloudSync}
                className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <HardDrive className="w-4 h-4" />
                <span>Quản lý Sao lưu & Khôi phục</span>
              </button>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-600 pt-2 border-t border-teal-100/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Dữ liệu đang lưu tại máy: <strong>{shifts.length} Ca</strong> • <strong>{counters.length} Quầy</strong> • <strong>{employees.length} Nhân viên</strong> • <strong>{weeklySchedule.length} Ca tuần</strong>
            </span>
          </div>
          <span className="text-slate-500">
            Định dạng tương thích: JSON chuẩn Quản Lý Phân Quầy
          </span>
        </div>
      </div>

      {/* Danger Zone: Reset Database */}
      <div className="glass-panel rounded-3xl border-rose-200/80 bg-rose-50/60 p-5 sm:p-6 flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">Vùng nguy hiểm: Xóa trắng hệ thống</h4>
          <p className="text-xs text-rose-700 mt-0.5">
            Xóa toàn bộ ca, quầy, nhân viên, lịch tuần và các bản phân quầy DWS đã lưu.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDeleteTarget('all')}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
        >
          Xóa toàn bộ dữ liệu
        </button>
      </div>

      {/* Modal: View Catalog Table */}
      {viewingCatalog && (
        <Modal
          isOpen={true}
          onClose={() => {
            setViewingCatalog(null);
            setCatalogSearch('');
            setSelectedEmployeeIds([]);
            setFilterOnlyModifiedSchedule(false);
            setScheduleSyncFilter('all');
            setScheduleDateFilter('all');
            setScheduleEmployeeFilter('all');
            setScheduleSlotFilter('all');
          }}
          title={
            viewingCatalog === 'shifts'
              ? `Chi tiết Danh mục Ca làm việc (${shifts.length} ca)`
              : viewingCatalog === 'counters'
              ? `Chi tiết Danh sách Quầy (${counters.length} quầy)`
              : viewingCatalog === 'employees'
              ? `Quản lý & Tìm kiếm Danh sách Nhân viên (${employees.length} NV)`
              : `Chi tiết Ca làm việc tuần (${weeklySchedule.length} lượt ca)`
          }
          maxWidth={viewingCatalog === 'employees' || viewingCatalog === 'weeklySchedule' ? '6xl' : '4xl'}
        >
          <div className="space-y-3.5">
            {/* Search and Filter bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={
                    viewingCatalog === 'employees'
                      ? 'Tìm kiếm theo Mã NV, Tên nhân viên, Số điện thoại, Bộ phận...'
                      : 'Tìm kiếm trong danh mục...'
                  }
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-700 focus:outline-hidden bg-slate-50/60 focus:bg-white transition-all"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {viewingCatalog === 'employees' && employees.length > 0 && (
                <div className="flex items-center flex-wrap gap-2 shrink-0">
                  <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setEmployeeStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        employeeStatusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả ({employees.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployeeStatusFilter('active')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        employeeStatusFilter === 'active'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      Đang làm ({employees.filter((e) => !e.isResigned).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployeeStatusFilter('resigned')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        employeeStatusFilter === 'resigned'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      Đã nghỉ việc ({employees.filter((e) => e.isResigned).length})
                    </button>
                  </div>
                </div>
              )}

              {viewingCatalog === 'weeklySchedule' && weeklySchedule.length > 0 && (
                <div className="flex items-center flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    id="btn-modal-export-modified-shifts"
                    onClick={() => {
                      setExportInitialFilter(filterOnlyModifiedSchedule ? 'all_modified' : 'current_filtered');
                      setIsExportModifiedModalOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                    title="Mở hộp thoại tải xuống File ca đã chỉnh sửa định dạng PDF hoặc Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-700" />
                    <span>Tải File ca đã sửa (PDF / Excel)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Batch actions bar for employees */}
            {viewingCatalog === 'employees' && selectedEmployeeIds.length > 0 && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-2xs animate-fadeIn">
                <div className="flex items-center gap-2 text-xs text-rose-950 font-bold">
                  <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Đã chọn <strong className="text-rose-700 underline">{selectedEmployeeIds.length}</strong> nhân viên
                    (nhân viên đã nghỉ)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeIds([])}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-all"
                  >
                    Bỏ chọn
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBatchDeletingEmployees(true)}
                    className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa {selectedEmployeeIds.length} NV đã chọn
                  </button>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto text-xs shadow-2xs">
              {viewingCatalog === 'shifts' && (
                shifts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-1.5">
                    <p className="text-sm font-bold text-slate-600">Danh mục ca làm việc hiện đang trống (0 ca)</p>
                    <p className="text-xs text-slate-400">Bạn có thể tải file Excel lên hoặc bấm nút &quot;Nạp mẫu mặc định AEON&quot;.</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-14">STT</th>
                        <th className="py-2.5 px-3 text-left">Mã ca</th>
                        <th className="py-2.5 px-3 text-left">Giờ BĐ</th>
                        <th className="py-2.5 px-3 text-left">Giờ KT</th>
                        <th className="py-2.5 px-3 text-left">Loại ca</th>
                        <th className="py-2.5 px-3 text-left">Phân nhóm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shifts
                        .filter(
                          (s) =>
                            s.shiftCode.toLowerCase().includes(catalogSearch.toLowerCase().trim()) ||
                            s.shiftType.toLowerCase().includes(catalogSearch.toLowerCase().trim())
                        )
                        .map((s, idx) => (
                          <tr key={s.shiftCode} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{s.shiftCode}</td>
                            <td className="py-2 px-3">{s.startTime || '-'}</td>
                            <td className="py-2 px-3">{s.endTime || '-'}</td>
                            <td className="py-2 px-3">{s.shiftType}</td>
                            <td className="py-2 px-3">
                              {s.isOff ? (
                                <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-semibold">
                                  Nghỉ (Off)
                                </span>
                              ) : (
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                                  {s.category === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )
              )}

              {viewingCatalog === 'counters' && (
                counters.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-1.5">
                    <p className="text-sm font-bold text-slate-600">Danh mục quầy thu ngân hiện đang trống (0 quầy)</p>
                    <p className="text-xs text-slate-400">Bạn có thể tải file Excel lên hoặc bấm nút &quot;Nạp mẫu mặc định AEON&quot;.</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-14">STT</th>
                        <th className="py-2.5 px-3 text-left">Số quầy</th>
                        <th className="py-2.5 px-3 text-left">Khu vực</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {counters
                        .filter(
                          (c) =>
                            c.counterNumber.toLowerCase().includes(catalogSearch.toLowerCase().trim()) ||
                            c.area.toLowerCase().includes(catalogSearch.toLowerCase().trim())
                        )
                        .map((c, idx) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{c.counterNumber}</td>
                            <td className="py-2 px-3 text-slate-700">{c.area}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )
              )}

              {viewingCatalog === 'employees' && (
                employees.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-1.5">
                    <p className="text-sm font-bold text-slate-600">Danh sách nhân viên hiện đang trống (0 nhân viên)</p>
                    <p className="text-xs text-slate-400">Vui lòng tải file Excel danh sách nhân viên để nạp vào hệ thống.</p>
                  </div>
                ) : (() => {
                  const filtered = employees.filter((e) => {
                    if (employeeStatusFilter === 'active' && e.isResigned) return false;
                    if (employeeStatusFilter === 'resigned' && !e.isResigned) return false;
                    const term = catalogSearch.toLowerCase().trim();
                    if (!term) return true;
                    return (
                      e.fullName.toLowerCase().includes(term) ||
                      e.employeeId.toLowerCase().includes(term) ||
                      (e.phone && e.phone.toLowerCase().includes(term)) ||
                      (e.department && e.department.toLowerCase().includes(term))
                    );
                  });

                  const isAllFilteredSelected =
                    filtered.length > 0 &&
                    filtered.every((e) => selectedEmployeeIds.includes(e.employeeId));

                  const toggleSelectAll = () => {
                    if (isAllFilteredSelected) {
                      const filteredIds = new Set(filtered.map((e) => e.employeeId));
                      setSelectedEmployeeIds((prev) => prev.filter((id) => !filteredIds.has(id)));
                    } else {
                      const newIds = new Set([...selectedEmployeeIds, ...filtered.map((e) => e.employeeId)]);
                      setSelectedEmployeeIds(Array.from(newIds));
                    }
                  };

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 space-y-1.5">
                        <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-sm font-bold text-slate-600">
                          Không tìm thấy nhân viên nào khớp với bộ lọc
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCatalogSearch('');
                            setEmployeeStatusFilter('all');
                          }}
                          className="text-xs text-teal-700 font-bold hover:underline cursor-pointer"
                        >
                          Xóa bộ lọc tìm kiếm
                        </button>
                      </div>
                    );
                  }

                  return (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold border-b border-slate-200 z-10">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">
                            <input
                              type="checkbox"
                              checked={isAllFilteredSelected}
                              onChange={toggleSelectAll}
                              title="Chọn / Bỏ chọn tất cả"
                              className="w-3.5 h-3.5 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer"
                            />
                          </th>
                          <th className="py-2.5 px-2 text-left w-10">STT</th>
                          <th className="py-2.5 px-3 text-left">Mã NV</th>
                          <th className="py-2.5 px-3 text-left">Tên nhân viên</th>
                          <th className="py-2.5 px-2 text-center" title="Kích đúp vào o/x để thay đổi SUP">
                            SUP
                          </th>
                          <th className="py-2.5 px-2 text-center" title="Kích đúp vào o/x để cập nhật khu vực Siêu thị">
                            Siêu thị
                          </th>
                          <th className="py-2.5 px-2 text-center" title="Kích đúp vào o/x để cập nhật khu vực Bánh mỳ">
                            Bánh mỳ
                          </th>
                          <th className="py-2.5 px-2 text-center" title="Kích đúp vào o/x để cập nhật khu vực Delica">
                            Delica
                          </th>
                          <th className="py-2.5 px-3 text-center" title="Tick Đã nghỉ việc: mặc định đưa vào Không phân quầy với note Nghỉ việc">
                            Đã nghỉ việc
                          </th>
                          <th className="py-2.5 px-3 text-left">Số điện thoại</th>
                          <th className="py-2.5 px-3 text-left">Bộ phận</th>
                          <th className="py-2.5 px-3 text-center w-24">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((e, idx) => {
                          const isSelected = selectedEmployeeIds.includes(e.employeeId);
                          const isResigned = !!e.isResigned;
                          return (
                            <tr
                              key={e.employeeId}
                              className={`transition-colors ${
                                isResigned
                                  ? 'bg-rose-50/40 text-slate-500 hover:bg-rose-50/70'
                                  : isSelected
                                  ? 'bg-amber-50/70 hover:bg-amber-100/60'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedEmployeeIds((prev) =>
                                      prev.includes(e.employeeId)
                                        ? prev.filter((id) => id !== e.employeeId)
                                        : [...prev, e.employeeId]
                                    );
                                  }}
                                  className="w-3.5 h-3.5 text-teal-700 rounded border-slate-300 focus:ring-teal-700 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <span className="font-bold font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                                  {e.employeeId}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-semibold ${isResigned ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                    {e.fullName}
                                  </span>
                                  {isResigned && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                      Nghỉ việc
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td
                                className="py-2 px-2 text-center select-none cursor-pointer"
                                onDoubleClick={() => handleToggleEmployeeCapability(e, 'isSup')}
                                title="Kích đúp để đổi trạng thái SUP (o / x)"
                              >
                                {e.isSup ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300 hover:ring-2 hover:ring-purple-300 transition-all">
                                    o (SUP)
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-mono text-xs transition-all">
                                    x
                                  </span>
                                )}
                              </td>
                              <td
                                className="py-2 px-2 text-center select-none cursor-pointer"
                                onDoubleClick={() => handleToggleEmployeeCapability(e, 'canSieuThi')}
                                title="Kích đúp vào o hoặc x để thay đổi khu vực Siêu thị"
                              >
                                {e.canSieuThi !== false ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:ring-2 hover:ring-emerald-300 transition-all">
                                    o
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-all">
                                    x
                                  </span>
                                )}
                              </td>
                              <td
                                className="py-2 px-2 text-center select-none cursor-pointer"
                                onDoubleClick={() => handleToggleEmployeeCapability(e, 'canBanhMy')}
                                title="Kích đúp vào o hoặc x để thay đổi khu vực Bánh mỳ"
                              >
                                {e.canBanhMy ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:ring-2 hover:ring-amber-300 transition-all">
                                    o
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-all">
                                    x
                                  </span>
                                )}
                              </td>
                              <td
                                className="py-2 px-2 text-center select-none cursor-pointer"
                                onDoubleClick={() => handleToggleEmployeeCapability(e, 'canDelica')}
                                title="Kích đúp vào o hoặc x để thay đổi khu vực Delica"
                              >
                                {e.canDelica ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-300 hover:ring-2 hover:ring-orange-300 transition-all">
                                    o
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-all">
                                    x
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <label
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer select-none transition-all ${
                                    isResigned
                                      ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                  title="Tick Đã nghỉ việc: cập nhật lại danh sách nhân viên đi làm hiện tại và đưa vào danh sách Không phân quầy (note Nghỉ việc)"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isResigned}
                                    onChange={() => handleToggleEmployeeResigned(e)}
                                    className="w-3.5 h-3.5 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer accent-rose-600"
                                  />
                                  <span>{isResigned ? 'Đã nghỉ việc' : 'Đang làm'}</span>
                                </label>
                              </td>
                              <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{e.phone || '-'}</td>
                              <td className="py-2 px-3 text-slate-600">{e.department || '-'}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEmployeeToDelete(e)}
                                  title={`Xóa nhân viên ${e.fullName} (${e.employeeId}) khỏi danh sách`}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-500" />
                                  <span>Xóa</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()
              )}

              {viewingCatalog === 'weeklySchedule' && (
                weeklySchedule.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-1.5">
                    <p className="text-sm font-bold text-slate-600">Lịch ca làm việc tuần hiện đang trống (0 lượt ca)</p>
                    <p className="text-xs text-slate-400">Vui lòng tải file Excel lịch ca tuần để nạp vào hệ thống.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Weekly Schedule Toolbar: filter & notes */}
                    {(() => {
                      const modifiedEntries = weeklySchedule.filter((e) => e.originalShiftCode && e.originalShiftCode !== e.shiftCode);
                      const unsyncedModifiedEntries = modifiedEntries.filter((e) => !e.isHardRosterSynced);
                      const syncedModifiedEntries = modifiedEntries.filter((e) => e.isHardRosterSynced);

                      const isFilterActive =
                        filterOnlyModifiedSchedule ||
                        scheduleDateFilter !== 'all' ||
                        scheduleEmployeeFilter !== 'all' ||
                        scheduleSlotFilter !== 'all' ||
                        !!catalogSearch.trim();

                      const handleResetAllFilters = () => {
                        setFilterOnlyModifiedSchedule(false);
                        setScheduleSyncFilter('all');
                        setScheduleDateFilter('all');
                        setScheduleEmployeeFilter('all');
                        setScheduleSlotFilter('all');
                        setCatalogSearch('');
                      };

                      return (
                        <div className="space-y-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          {/* Row 1: Primary Switcher (All vs Modified) & Sync Filter */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center p-0.5 bg-slate-200/70 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFilterOnlyModifiedSchedule(false);
                                    setScheduleSyncFilter('all');
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-all ${
                                    !filterOnlyModifiedSchedule
                                      ? 'bg-teal-700 text-white shadow-3xs'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                  }`}
                                >
                                  Tất cả ({weeklySchedule.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFilterOnlyModifiedSchedule(true)}
                                  className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                                    filterOnlyModifiedSchedule
                                      ? 'bg-amber-600 text-white shadow-3xs'
                                      : 'text-amber-900 hover:bg-amber-100/70'
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Ca đã chỉnh sửa ({modifiedEntries.length})</span>
                                  {unsyncedModifiedEntries.length > 0 && (
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                      filterOnlyModifiedSchedule ? 'bg-white text-amber-800' : 'bg-rose-500 text-white'
                                    }`}>
                                      {unsyncedModifiedEntries.length} chưa sync
                                    </span>
                                  )}
                                </button>
                              </div>

                              {/* Sub-filter by Sync status when viewing modified shifts */}
                              {filterOnlyModifiedSchedule && (
                                <div className="flex items-center gap-1 pl-2 border-l border-slate-300">
                                  <span className="text-[11px] text-slate-500 font-medium">Lọc:</span>
                                  <button
                                    type="button"
                                    onClick={() => setScheduleSyncFilter('all')}
                                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                                      scheduleSyncFilter === 'all'
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                  >
                                    Tất cả ({modifiedEntries.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setScheduleSyncFilter('unsynced')}
                                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                      scheduleSyncFilter === 'unsynced'
                                        ? 'bg-rose-700 text-white'
                                        : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                                    }`}
                                  >
                                    <span>Chưa sync ({unsyncedModifiedEntries.length})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setScheduleSyncFilter('synced')}
                                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                      scheduleSyncFilter === 'synced'
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                                    }`}
                                  >
                                    <span>Đã sync ({syncedModifiedEntries.length})</span>
                                  </button>

                                  {unsyncedModifiedEntries.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleBatchSyncHardRoster(unsyncedModifiedEntries)}
                                      className="ml-2 px-2.5 py-0.5 text-[11px] font-extrabold text-teal-900 bg-teal-100/90 hover:bg-teal-200 border border-teal-300 rounded-md flex items-center gap-1 cursor-pointer transition-all shadow-3xs"
                                      title="Đánh dấu tất cả các ca đã chỉnh sửa là đã sync vào file lịch cứng"
                                    >
                                      <Check className="w-3.5 h-3.5 text-teal-800" />
                                      <span>Sync tất cả ({unsyncedModifiedEntries.length})</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <span className="font-semibold text-teal-800">💡 Mẹo:</span>
                              <span>Tick vào ô &ldquo;Đã sync file lịch cứng&rdquo; để đánh dấu đã sửa ca trên lịch và thông báo nhân viên</span>
                            </div>
                          </div>

                          {/* Row 2: Detailed Filters (Date, Employee, Shift Slot: Morning / Afternoon / Off) */}
                          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                <Filter className="w-3.5 h-3.5 text-teal-700" />
                                <span>Bộ lọc:</span>
                              </div>

                              {/* 1. Filter by Date */}
                              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-3xs">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <select
                                  value={scheduleDateFilter}
                                  onChange={(e) => setScheduleDateFilter(e.target.value)}
                                  className="text-xs bg-transparent border-0 font-medium text-slate-800 focus:outline-none focus:ring-0 cursor-pointer pr-1"
                                >
                                  <option value="all">Tất cả các ngày ({scheduleDates.length} ngày)</option>
                                  {scheduleDates.map((item) => (
                                    <option key={item.date} value={item.date}>
                                      {item.label} ({item.count} ca)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 2. Filter by Employee */}
                              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-3xs">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <select
                                  value={scheduleEmployeeFilter}
                                  onChange={(e) => setScheduleEmployeeFilter(e.target.value)}
                                  className="text-xs bg-transparent border-0 font-medium text-slate-800 focus:outline-none focus:ring-0 cursor-pointer pr-1 max-w-[200px]"
                                >
                                  <option value="all">Tất cả nhân viên ({scheduleEmployees.length} người)</option>
                                  {scheduleEmployees.map((emp) => (
                                    <option key={emp.name} value={emp.name}>
                                      {emp.name} {emp.id ? `(${emp.id})` : ''} - {emp.count} ca
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 3. Filter by Shift Slot: All, Morning, Afternoon, Off */}
                              <div className="inline-flex items-center p-0.5 bg-slate-200/70 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => setScheduleSlotFilter('all')}
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                                    scheduleSlotFilter === 'all'
                                      ? 'bg-white text-slate-800 font-bold shadow-3xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Tất cả ca
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScheduleSlotFilter('morning')}
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                                    scheduleSlotFilter === 'morning'
                                      ? 'bg-amber-500 text-white font-bold shadow-3xs'
                                      : 'text-amber-900 hover:bg-amber-100/60'
                                  }`}
                                  title="Các ca sáng (bắt đầu trước 12:00: V814, V815, V615, V818, S1...)"
                                >
                                  <span>🌅 Ca sáng</span>
                                  <span className={`text-[10px] px-1 py-0.1 rounded font-bold ${scheduleSlotFilter === 'morning' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                                    {scheduleSlotCounts.morning}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScheduleSlotFilter('afternoon')}
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                                    scheduleSlotFilter === 'afternoon'
                                      ? 'bg-indigo-600 text-white font-bold shadow-3xs'
                                      : 'text-indigo-900 hover:bg-indigo-100/60'
                                  }`}
                                  title="Các ca chiều/tối (bắt đầu từ 12:00 trở đi: V820, V822, V829, V830, C1...)"
                                >
                                  <span>🌇 Ca chiều</span>
                                  <span className={`text-[10px] px-1 py-0.1 rounded font-bold ${scheduleSlotFilter === 'afternoon' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                                    {scheduleSlotCounts.afternoon}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScheduleSlotFilter('off')}
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                                    scheduleSlotFilter === 'off'
                                      ? 'bg-slate-700 text-white font-bold shadow-3xs'
                                      : 'text-slate-600 hover:bg-slate-200'
                                  }`}
                                  title="Các ca nghỉ (OFF, AL, RO, DO, PRD, TS...)"
                                >
                                  <span>☕ Nghỉ</span>
                                  <span className={`text-[10px] px-1 py-0.1 rounded font-bold ${scheduleSlotFilter === 'off' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {scheduleSlotCounts.off}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Result count & reset */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 font-medium">
                                Hiển thị <strong className="text-teal-800 font-bold">{filteredWeeklySchedule.length}</strong> / {weeklySchedule.length} ca
                              </span>
                              {isFilterActive && (
                                <button
                                  type="button"
                                  onClick={handleResetAllFilters}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg cursor-pointer transition-all shadow-3xs"
                                  title="Đặt lại tất cả các bộ lọc về mặc định"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Xóa bộ lọc</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold border-b border-slate-200 z-10 text-xs">
                        <tr>
                          <th className="py-2.5 px-3 text-left w-12">STT</th>
                          <th className="py-2.5 px-3 text-left w-24">Mã NV</th>
                          <th className="py-2.5 px-3 text-left">Tên Nhân Viên</th>
                          <th className="py-2.5 px-3 text-left w-28">Ngày</th>
                          <th className="py-2.5 px-3 text-left w-16">Thứ</th>
                          <th className="py-2.5 px-3 text-left">Mã Ca (Cũ ➔ Mới)</th>
                          <th className="py-2.5 px-3 text-left w-24">Trạng thái</th>
                          <th className="py-2.5 px-3 text-center w-44">
                            <div className="flex items-center justify-center gap-1" title="Đã sửa ca cho nhân viên trên file lịch cứng và thông báo cho nhân viên">
                              <CheckSquare className="w-3.5 h-3.5 text-teal-700" />
                              <span>Đã sync file lịch cứng</span>
                            </div>
                          </th>
                          <th className="py-2.5 px-3 text-right w-24">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredWeeklySchedule.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Filter className="w-8 h-8 text-slate-300" />
                                <p className="font-semibold text-slate-700 text-sm">Không tìm thấy ca làm việc phù hợp với bộ lọc</p>
                                <p className="text-xs text-slate-400">Thử chọn ngày, nhân viên khác hoặc xóa các điều kiện lọc</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFilterOnlyModifiedSchedule(false);
                                    setScheduleSyncFilter('all');
                                    setScheduleDateFilter('all');
                                    setScheduleEmployeeFilter('all');
                                    setScheduleSlotFilter('all');
                                    setCatalogSearch('');
                                  }}
                                  className="mt-1 px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer transition-all inline-flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Đặt lại toàn bộ bộ lọc</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredWeeklySchedule.map((entry, idx) => {
                            const isModified = !!(entry.originalShiftCode && entry.originalShiftCode !== entry.shiftCode);
                            return (
                              <tr key={`${entry.employeeId || entry.employeeName}_${entry.date}_${idx}`} className={`hover:bg-teal-50/40 transition-colors ${isModified ? (entry.isHardRosterSynced ? 'bg-emerald-50/20' : 'bg-amber-50/30') : ''}`}>
                                <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-2 px-3 font-bold font-mono text-slate-800">{entry.employeeId || '---'}</td>
                                <td className="py-2 px-3">
                                  <EmployeeHoverCard
                                    employeeName={entry.employeeName}
                                    employeeId={entry.employeeId}
                                    currentDate={entry.date}
                                    currentShiftCodeFallback={entry.shiftCode}
                                    allCounters={counters}
                                  >
                                    <div className="inline-flex items-center gap-1.5 cursor-help group/emp">
                                      <span className="font-bold text-slate-900 group-hover/emp:text-teal-800 group-hover/emp:underline transition-colors">
                                        {entry.employeeName}
                                      </span>
                                      {isModified && (
                                        <span className="px-1.5 py-0.2 text-[9.5px] font-black rounded bg-amber-100 text-amber-900 border border-amber-300 shadow-3xs" title={`Ca gốc: ${entry.originalShiftCode} ➔ Đã sửa thành: ${entry.shiftCode}`}>
                                          Đã đổi
                                        </span>
                                      )}
                                    </div>
                                  </EmployeeHoverCard>
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600">{entry.date}</td>
                                <td className="py-2 px-3 text-slate-700">{entry.dayOfWeek}</td>
                                <td className="py-2 px-3">
                                  {isModified ? (
                                    <div className="inline-flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                      <span className="line-through text-slate-400 font-mono font-bold" title="Mã ca ban đầu từ file Excel">{entry.originalShiftCode}</span>
                                      <ArrowRight className="w-3 h-3 text-amber-600 shrink-0" />
                                      <span className="font-black text-teal-800 font-mono" title="Mã ca đã cập nhật">{entry.shiftCode}</span>
                                    </div>
                                  ) : (
                                    <span className="font-bold text-teal-800 font-mono">{entry.shiftCode}</span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  {entry.isOff ? (
                                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold text-[11px]">
                                      Nghỉ
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[11px]">
                                      Làm việc
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <label
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all shadow-3xs hover:shadow-2xs ${
                                      entry.isHardRosterSynced
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100/80'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300'
                                    }`}
                                    title={
                                      entry.isHardRosterSynced
                                        ? `Đã sync file lịch cứng & báo NV${entry.syncedAt ? ` (lúc ${new Date(entry.syncedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(entry.syncedAt).toLocaleDateString('vi-VN')})` : ''}. Bấm để bỏ tick.`
                                        : 'Chưa sync lên file lịch cứng hoặc chưa báo nhân viên. Bấm để tick đã hoàn thành.'
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!entry.isHardRosterSynced}
                                      onChange={() => handleToggleHardRosterSync(entry)}
                                      className="w-4 h-4 rounded text-teal-700 focus:ring-teal-600 cursor-pointer accent-teal-700"
                                    />
                                    <span className={entry.isHardRosterSynced ? 'text-emerald-800 font-extrabold text-[11px]' : 'text-slate-500 text-[11px]'}>
                                      {entry.isHardRosterSynced ? 'Đã sync' : 'Chưa sync'}
                                    </span>
                                  </label>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setEditingScheduleEntry(entry)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 hover:text-teal-900 border border-teal-200 rounded-lg cursor-pointer transition-all shadow-3xs hover:shadow-2xs"
                                    title={`Sửa ca làm việc của ${entry.employeeName} ngày ${entry.date}`}
                                  >
                                    <Edit3 className="w-3 h-3 text-teal-700" />
                                    <span>Sửa ca</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-500">
                {viewingCatalog === 'employees' && (
                  <span>
                    * <strong>Mẹo:</strong> Kích đúp vào dấu <strong>o</strong> hoặc <strong>x</strong> để đổi trực tiếp khu vực đứng quầy. Tick <strong>Đã nghỉ việc</strong> để cập nhật danh sách đi làm hiện tại (tự động đưa vào <em>Không phân quầy</em> với note <em>Nghỉ việc</em>).
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingCatalog(null);
                  setCatalogSearch('');
                  setSelectedEmployeeIds([]);
                  setEmployeeStatusFilter('all');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Single Employee Deletion */}
      <ConfirmDialog
        isOpen={employeeToDelete !== null}
        onClose={() => setEmployeeToDelete(null)}
        onConfirm={handleDeleteSingleEmployee}
        title="Xác nhận xóa nhân viên đã nghỉ"
        message={
          employeeToDelete ? (
            <div className="space-y-2">
              <div>
                Bạn có chắc chắn muốn xóa nhân viên{' '}
                <strong className="text-slate-900 font-bold">&quot;{employeeToDelete.fullName}&quot;</strong> (Mã NV:{' '}
                <span className="font-mono font-bold text-teal-800">{employeeToDelete.employeeId}</span>) đã nghỉ việc
                khỏi danh sách hệ thống?
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                Bộ phận: <strong>{employeeToDelete.department || 'Chưa thiết lập'}</strong> • SĐT:{' '}
                <strong>{employeeToDelete.phone || 'Chưa có'}</strong>
              </div>
            </div>
          ) : null
        }
        confirmText="Xóa nhân viên"
        cancelText="Hủy"
        type="danger"
      />

      {/* Confirm Batch Employees Deletion */}
      <ConfirmDialog
        isOpen={isBatchDeletingEmployees}
        onClose={() => setIsBatchDeletingEmployees(false)}
        onConfirm={handleBatchDeleteEmployees}
        title={`Xác nhận xóa ${selectedEmployeeIds.length} nhân viên đã chọn`}
        message={
          <div>
            Bạn có chắc chắn muốn xóa vĩnh viễn{' '}
            <strong className="text-rose-700">{selectedEmployeeIds.length}</strong> nhân viên đã chọn (nhân viên đã
            nghỉ việc) khỏi cơ sở dữ liệu danh sách nhân viên không?
          </div>
        }
        confirmText={`Xóa ${selectedEmployeeIds.length} nhân viên`}
        cancelText="Hủy"
        type="danger"
      />

      {/* Confirm Delete Catalog Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteCatalog}
        title={deleteTarget === 'all' ? 'Xác nhận xóa trắng toàn bộ hệ thống' : 'Xác nhận xóa danh mục'}
        message={
          deleteTarget === 'all' ? (
            <div>
              Thao tác này sẽ xóa vĩnh viễn <strong>tất cả dữ liệu</strong> bao gồm ca làm việc, quầy, nhân viên,
              lịch tuần và lịch sử DWS. Bạn có chắc chắn muốn tiếp tục?
            </div>
          ) : (
            <div>
              Bạn có chắc chắn muốn xóa toàn bộ danh mục{' '}
              <strong>
                {deleteTarget === 'shifts'
                  ? 'Ca làm việc'
                  : deleteTarget === 'counters'
                  ? 'Quầy thu ngân'
                  : deleteTarget === 'employees'
                  ? 'Nhân viên'
                  : 'Lịch ca tuần'}
              </strong>{' '}
              khỏi hệ thống?
            </div>
          )
        }
        confirmText="Xóa dữ liệu"
        cancelText="Hủy"
        type="danger"
      />

      {/* Backup & Restore Progress Modal */}
      <BackupProgressModal
        state={backupProgress}
        onClose={() => setBackupProgress((p) => ({ ...p, isOpen: false }))}
      />

      {/* Edit Weekly Shift Modal */}
      {editingScheduleEntry && (
        <EditWeeklyShiftModal
          isOpen={!!editingScheduleEntry}
          entry={editingScheduleEntry}
          shifts={shifts}
          weekId={currentMonday}
          weeklySchedule={weeklySchedule}
          onClose={() => setEditingScheduleEntry(null)}
          onSaved={() => {
            setEditingScheduleEntry(null);
            onDataChanged();
          }}
        />
      )}

      {/* Export Modified Shifts (PDF & Excel) Modal */}
      <ExportModifiedShiftsModal
        isOpen={isExportModifiedModalOpen}
        onClose={() => setIsExportModifiedModalOpen(false)}
        weekId={currentMonday || new Date().toISOString().split('T')[0]}
        weeklySchedule={weeklySchedule}
        shifts={shifts}
        counters={counters}
        employees={employees}
        initialFilter={exportInitialFilter}
        customFilteredEntries={filteredWeeklySchedule}
      />
    </div>
  );
};
