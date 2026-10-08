import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { excelService, isOffShift } from '../../services/excelService';
import { storageService, DEFAULT_EMPLOYEES } from '../../services/storageService';
import { useToast } from '../common/ToastContainer';
import {
  findShiftChangeConflicts,
  removeEmployeesFromCounters,
  ShiftChangeConflict,
} from '../../services/shiftChangeService';
import { ShiftChangeConfirmModal } from './ShiftChangeConfirmModal';
import {
  Shift,
  Counter,
  Employee,
  ImportPreviewResult,
  ImportMode,
  WeeklyScheduleEntry,
} from '../../types';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RotateCcw,
  Download,
  Calendar,
  Layers,
  FileText,
  AlertCircle,
  Clock,
  LayoutGrid,
  Users,
} from 'lucide-react';

export type ImportDataType = 'shifts' | 'counters' | 'employees' | 'weeklySchedule';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType?: ImportDataType;
  dataType?: ImportDataType;
  onSuccess?: () => void;
  onImportSuccess?: () => void;
  defaultMondayDate?: string;
  currentMonday?: string;
  shifts?: Shift[];
  counters?: Counter[];
  employees?: Employee[];
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  dataType,
  onSuccess,
  onImportSuccess,
  defaultMondayDate,
  currentMonday,
  shifts,
  counters,
  employees,
}) => {
  const { success, error, warning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialType: ImportDataType = targetType || dataType || 'shifts';
  const initialMonday: string = defaultMondayDate || currentMonday || '2026-08-17';

  const [activeType, setActiveType] = useState<ImportDataType>(initialType);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isReading, setIsReading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('overwrite');
  const [weekMondayDate, setWeekMondayDate] = useState<string>(initialMonday);
  const [filterErrorOnly, setFilterErrorOnly] = useState(false);

  // Shift Change Conflict States for assigned staff
  const [shiftConflicts, setShiftConflicts] = useState<ShiftChangeConflict[]>([]);
  const [isShiftConflictModalOpen, setIsShiftConflictModalOpen] = useState(false);
  const [shiftDecisions, setShiftDecisions] = useState<Record<string, 'remove' | 'keep'>>({});

  useEffect(() => {
    if (isOpen) {
      const type = targetType || dataType || 'shifts';
      const monday = defaultMondayDate || currentMonday || '2026-08-17';
      setActiveType(type);
      setWeekMondayDate(monday);
      resetState();
    }
  }, [isOpen, targetType, dataType, defaultMondayDate, currentMonday]);

  const titles: Record<ImportDataType, string> = {
    shifts: 'Nhập Danh mục Ca làm việc (Excel)',
    counters: 'Nhập Danh sách Quầy thu ngân (Excel)',
    employees: 'Nhập Danh sách Nhân viên (Excel)',
    weeklySchedule: 'Nhập Ca làm việc tuần của nhân viên (Excel)',
  };

  const descriptions: Record<ImportDataType, string> = {
    shifts: 'Hỗ trợ file Excel chứa Mã ca, Giờ bắt đầu, Giờ kết thúc (hoặc Khung giờ), Loại ca (bao gồm loại ca Nghỉ)',
    counters: 'Hỗ trợ file Excel chứa Số quầy (1, 2 ssc, 24, 101, QL...) và Khu vực',
    employees: 'Hỗ trợ file Excel chứa Mã nhân viên (ID duy nhất) và Tên nhân viên',
    weeklySchedule: 'Hỗ trợ file Excel phân ca theo dòng hoặc ma trận tuần (Thứ 2 đến Thứ 7)',
  };

  const resetState = () => {
    setCurrentStep(1);
    setSelectedFile(null);
    setAvailableSheets([]);
    setSelectedSheet('');
    setIsReading(false);
    setPreviewResult(null);
    setImportMode('overwrite');
    setFilterErrorOnly(false);
    setShiftConflicts([]);
    setIsShiftConflictModalOpen(false);
    setShiftDecisions({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Step 1: File selection & Reading
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File, targetSheetName?: string, typeOverride?: ImportDataType) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      error('Vui lòng chọn file định dạng Excel (.xlsx, .xls) hoặc .csv');
      return;
    }

    const type = typeOverride || activeType;
    setSelectedFile(file);
    setIsReading(true);
    setCurrentStep(2);

    try {
      const raw = await excelService.parseRawFile(file, targetSheetName);
      setAvailableSheets(raw.sheetNames || []);
      setSelectedSheet(raw.activeSheet || raw.sheetNames?.[0] || '');

      if (!raw.rawHeaders.length || !raw.data.length) {
        throw new Error('File Excel rỗng hoặc không tìm thấy bảng dữ liệu hợp lệ trong sheet đã chọn.');
      }

      let result: ImportPreviewResult;

      if (type === 'shifts') {
        const existing = storageService.getShifts();
        result = excelService.parseShifts(raw.rawHeaders, raw.data, existing);
      } else if (type === 'counters') {
        const existing = storageService.getCounters();
        result = excelService.parseCounters(raw.rawHeaders, raw.data, existing);
      } else if (type === 'employees') {
        const existing = storageService.getEmployees();
        result = excelService.parseEmployees(raw.rawHeaders, raw.data, existing);
      } else {
        const shiftsList = shifts && shifts.length > 0 ? shifts : storageService.getShifts();
        const countersList = counters && counters.length > 0 ? counters : storageService.getCounters();
        const employeesList = employees && employees.length > 0 ? employees : storageService.getEmployees();
        const existing = storageService.getWeeklySchedule(weekMondayDate);
        result = excelService.parseWeeklySchedule(raw.rawHeaders, raw.data, {
          weekMondayDate,
          shifts: shiftsList,
          employees: employeesList,
          existingEntries: existing,
        });

        // Scan for shift conflicts on already assigned employees
        if (result.parsedData && result.parsedData.length > 0) {
          const conflicts = findShiftChangeConflicts(
            result.parsedData as WeeklyScheduleEntry[],
            shiftsList,
            countersList
          );
          setShiftConflicts(conflicts);
          if (conflicts.length > 0) {
            const initial: Record<string, 'remove' | 'keep'> = {};
            conflicts.forEach((c) => {
              initial[c.id] = 'remove';
            });
            setShiftDecisions(initial);
            // Conflicts detected; defaults pre-selected as 'remove'. 
            // Do NOT auto-open modal to avoid blocking user's preview screen.
          } else {
            setShiftDecisions({});
          }
        }
      }

      result.fileName = file.name;
      setPreviewResult(result);
      setIsReading(false);
      setCurrentStep(3); // Go to Preview
    } catch (err: any) {
      setIsReading(false);
      error(err.message || 'Lỗi khi đọc file Excel');
      setCurrentStep(1);
    }
  };

  // Switch sheet
  const handleSheetChange = async (newSheet: string) => {
    if (!selectedFile) return;
    setSelectedSheet(newSheet);
    await processFile(selectedFile, newSheet);
  };

  // Switch type tab
  const handleTypeTabChange = async (newType: ImportDataType) => {
    setActiveType(newType);
    if (selectedFile) {
      await processFile(selectedFile, selectedSheet, newType);
    }
  };

  // Re-parse when Monday date changes for weekly schedule
  const handleDateChange = async (newDate: string) => {
    setWeekMondayDate(newDate);
    if (selectedFile && activeType === 'weeklySchedule') {
      setIsReading(true);
      try {
        const raw = await excelService.parseRawFile(selectedFile, selectedSheet);
        const shiftsList = shifts && shifts.length > 0 ? shifts : storageService.getShifts();
        const countersList = counters && counters.length > 0 ? counters : storageService.getCounters();
        const employeesList = employees && employees.length > 0 ? employees : storageService.getEmployees();
        const existing = storageService.getWeeklySchedule(newDate);
        const result = excelService.parseWeeklySchedule(raw.rawHeaders, raw.data, {
          weekMondayDate: newDate,
          shifts: shiftsList,
          employees: employeesList,
          existingEntries: existing,
        });
        result.fileName = selectedFile.name;
        setPreviewResult(result);

        if (result.parsedData && result.parsedData.length > 0) {
          const conflicts = findShiftChangeConflicts(
            result.parsedData as WeeklyScheduleEntry[],
            shiftsList,
            countersList
          );
          setShiftConflicts(conflicts);
          if (conflicts.length > 0) {
            const initial: Record<string, 'remove' | 'keep'> = {};
            conflicts.forEach((c) => {
              initial[c.id] = 'remove';
            });
            setShiftDecisions(initial);
          } else {
            setShiftDecisions({});
          }
        }
      } catch (e: any) {
        console.error(e);
      } finally {
        setIsReading(false);
      }
    }
  };

  // Save & Execute Import
  const handleConfirmImport = () => {
    if (!previewResult || previewResult.validRows === 0) {
      error('Không có dòng dữ liệu hợp lệ nào để nhập.');
      return;
    }

    try {
      const validData = previewResult.parsedData;

      if (activeType === 'shifts') {
        if (importMode === 'overwrite') {
          storageService.saveShifts(validData as Shift[], selectedFile?.name);
        } else {
          const existing = storageService.getShifts();
          const map = new Map<string, Shift>();
          existing.forEach((s) => map.set(s.shiftCode.toUpperCase(), s));
          (validData as Shift[]).forEach((s) => map.set(s.shiftCode.toUpperCase(), s));
          storageService.saveShifts(Array.from(map.values()), selectedFile?.name);
        }
      } else if (activeType === 'counters') {
        if (importMode === 'overwrite') {
          storageService.saveCounters(validData as Counter[], selectedFile?.name);
        } else {
          const existing = storageService.getCounters();
          const map = new Map<string, Counter>();
          existing.forEach((c) => map.set(c.id.toLowerCase(), c));
          (validData as Counter[]).forEach((c) => map.set(c.id.toLowerCase(), c));
          storageService.saveCounters(Array.from(map.values()), selectedFile?.name);
        }
      } else if (activeType === 'employees') {
        if (importMode === 'overwrite') {
          storageService.saveEmployees(validData as Employee[], selectedFile?.name);
        } else {
          const existing = storageService.getEmployees();
          const map = new Map<string, Employee>();
          existing.forEach((e) => map.set(e.employeeId.toLowerCase(), e));
          (validData as Employee[]).forEach((e) => map.set(e.employeeId.toLowerCase(), e));
          storageService.saveEmployees(Array.from(map.values()), selectedFile?.name);
        }
      } else {
        // Handle weekly schedule import & shift change counter unassignments
        let removedEmployeesCount = 0;
        if (shiftConflicts.length > 0) {
          const conflictsToRemove = shiftConflicts.filter(
            (c) => shiftDecisions[c.id] === 'remove'
          );
          if (conflictsToRemove.length > 0) {
            const removalResult = removeEmployeesFromCounters(conflictsToRemove);
            removedEmployeesCount = removalResult.removedCount;
          }
        }

        if (importMode === 'overwrite') {
          storageService.saveWeeklySchedule(weekMondayDate, validData as WeeklyScheduleEntry[]);
        } else {
          storageService.appendWeeklySchedule(weekMondayDate, validData as WeeklyScheduleEntry[]);
        }

        // Tự động đồng bộ nhân sự mới từ lịch tuần vào Danh sách nhân viên (Bảo toàn 100% nhân viên cũ)
        let addedNewEmployeesCount = 0;
        try {
          const existingEmployees = storageService.getEmployees();
          const empMap = new Map<string, Employee>();
          
          // Luôn giữ toàn bộ nhân viên hiện có, không bao giờ xóa
          existingEmployees.forEach((e) => {
            if (e.employeeId) empMap.set(e.employeeId.toUpperCase().trim(), e);
            if (e.fullName) empMap.set(e.fullName.toLowerCase().trim(), e);
          });

          const weeklyEntries = validData as WeeklyScheduleEntry[];
          const uploadedEmps = new Map<string, { id: string; name: string }>();
          weeklyEntries.forEach((entry) => {
            const name = (entry.employeeName || '').trim();
            const id = (entry.employeeId || '').trim();
            if (!name && !id) return;
            const key = (name || id).toLowerCase();
            if (!uploadedEmps.has(key)) {
              uploadedEmps.set(key, { id, name });
            }
          });

          uploadedEmps.forEach(({ id, name }) => {
            const keyId = id ? id.toUpperCase().trim() : '';
            const keyName = name ? name.toLowerCase().trim() : '';
            const isGenericStt = /^\d{1,3}$/.test(keyId);
            const exists = (keyName && empMap.has(keyName)) || (!isGenericStt && keyId && empMap.has(keyId));

            if (!exists) {
              const uniqueEmpList = Array.from(new Set(empMap.values()));
              const validId = (!isGenericStt && id)
                ? id
                : `NV${String(uniqueEmpList.length + 1).padStart(3, '0')}`;
              const newEmp: Employee = {
                employeeId: validId,
                fullName: name || validId,
                isSup: false,
                canSieuThi: true,
                canBanhMy: true,
                canDelica: true,
                department: 'Thu ngân',
              };
              if (newEmp.employeeId) empMap.set(newEmp.employeeId.toUpperCase().trim(), newEmp);
              if (newEmp.fullName) empMap.set(newEmp.fullName.toLowerCase().trim(), newEmp);
              addedNewEmployeesCount++;
            }
          });

          if (addedNewEmployeesCount > 0) {
            const finalEmployeesList = Array.from(new Set(empMap.values()));
            storageService.saveEmployees(
              finalEmployeesList,
              selectedFile?.name || 'Tự động tạo từ lịch tuần'
            );
          }
        } catch (e) {
          console.error('Lỗi khi tự động đồng bộ nhân viên từ lịch tuần:', e);
        }

        // Tự động tạo danh mục ca mới nếu lịch tuần chứa mã ca chưa có trong hệ thống
        try {
          const existingShifts = storageService.getShifts();
          const shiftCodeMap = new Map<string, Shift>();
          existingShifts.forEach((s) => shiftCodeMap.set(s.shiftCode.toUpperCase().trim(), s));

          let addedNewShiftsCount = 0;
          (validData as WeeklyScheduleEntry[]).forEach((entry) => {
            const code = (entry.shiftCode || '').trim().toUpperCase();
            if (!code) return;
            const isOff = isOffShift(code, '');
            if (!shiftCodeMap.has(code)) {
              const isMorning =
                code.includes('814') ||
                code.includes('815') ||
                code.includes('615') ||
                code.includes('818') ||
                code.includes('618') ||
                code.startsWith('S') ||
                code.startsWith('6') ||
                code.startsWith('7') ||
                code.startsWith('8');
              const newShift: Shift = {
                shiftCode: code,
                startTime: isOff ? '00:00' : isMorning ? '08:00' : '13:30',
                endTime: isOff ? '00:00' : isMorning ? '15:30' : '22:00',
                shiftType: isOff ? `Nghỉ (${code})` : isMorning ? `Ca Sáng (${code})` : `Ca Chiều (${code})`,
                category: isOff ? 'off' : isMorning ? 'morning' : 'afternoon',
                isOff,
              };
              shiftCodeMap.set(code, newShift);
              addedNewShiftsCount++;
            }
          });

          if (addedNewShiftsCount > 0) {
            storageService.saveShifts(
              Array.from(shiftCodeMap.values()),
              selectedFile?.name || 'Tự động tạo từ lịch tuần'
            );
          }
        } catch (e) {
          console.error('Lỗi khi tự động đồng bộ ca từ lịch tuần:', e);
        }

        if (removedEmployeesCount > 0) {
          success(
            `Đã nhập thành công ${validData.length} dòng lịch tuần và xóa phân quầy cho ${removedEmployeesCount} nhân viên đổi ca (đã chuyển vào danh sách chưa phân quầy)!`,
            'Nhập lịch tuần & Cập nhật phân quầy'
          );
        } else if (addedNewEmployeesCount > 0) {
          success(
            `Đã nhập thành công ${validData.length} dòng lịch tuần và tự động đồng bộ ${addedNewEmployeesCount} nhân sự mới vào hệ thống!`,
            'Nhập lịch tuần hoàn tất'
          );
        } else {
          success(`Đã nhập thành công ${validData.length} dòng dữ liệu vào hệ thống!`, 'Nhập dữ liệu hoàn tất');
        }
        handleClose();
        onSuccess?.();
        onImportSuccess?.();
        return;
      }

      success(`Đã nhập thành công ${validData.length} dòng dữ liệu vào hệ thống!`, 'Nhập dữ liệu hoàn tất');
      handleClose();
      onSuccess?.();
      onImportSuccess?.();
    } catch (err: any) {
      error(err.message || 'Lỗi khi lưu dữ liệu vào hệ thống.');
    }
  };

  const filteredRows = previewResult
    ? filterErrorOnly
      ? previewResult.rows.filter((r) => !r.isValid)
      : previewResult.rows
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>{titles[activeType]}</div>
        </div>
      }
      description={descriptions[activeType]}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleTypeTabChange('shifts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeType === 'shifts'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            1. Danh mục Ca làm
          </button>

          <button
            type="button"
            onClick={() => handleTypeTabChange('counters')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeType === 'counters'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            2. Danh sách Quầy
          </button>

          <button
            type="button"
            onClick={() => handleTypeTabChange('employees')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeType === 'employees'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            3. Danh sách Nhân viên
          </button>

          <button
            type="button"
            onClick={() => handleTypeTabChange('weeklySchedule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeType === 'weeklySchedule'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            4. Lịch làm việc tuần
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs font-medium">
          <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto w-full">
            <span
              className={`px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${
                currentStep >= 1 ? 'bg-teal-700 text-white font-bold' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span>1</span> Chọn file
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${
                currentStep >= 3 ? 'bg-teal-700 text-white font-bold' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span>2</span> Xem trước
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${
                currentStep >= 4 ? 'bg-teal-700 text-white font-bold' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span>3</span> Kiểm tra lỗi
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${
                currentStep >= 5 ? 'bg-teal-700 text-white font-bold' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span>4</span> Chế độ
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${
                currentStep === 6 ? 'bg-teal-700 text-white font-bold' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span>5</span> Xác nhận
            </span>
          </div>
        </div>

        {/* STEP 1: Upload Dropzone */}
        {currentStep === 1 && (
          <div className="space-y-4">
            {activeType === 'weeklySchedule' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-semibold text-slate-700">Tuần bắt đầu từ Thứ 2:</span>
                </div>
                <input
                  type="date"
                  value={weekMondayDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-700 focus:outline-hidden font-medium"
                />
              </div>
            )}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-teal-600 hover:bg-teal-50/30 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                Kéo thả file Excel (.xlsx, .xls) vào đây
              </h4>
              <p className="text-xs text-slate-500 mb-3">hoặc bấm vào đây để duyệt file từ máy tính</p>
              <span className="px-3.5 py-1.5 bg-slate-100 group-hover:bg-teal-700 group-hover:text-white rounded-lg text-xs font-semibold text-slate-700 transition-colors">
                Chọn file từ thiết bị
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => excelService.downloadSampleTemplate(activeType, weekMondayDate)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors p-1.5 hover:bg-teal-50 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Tải file Excel mẫu (.xlsx) để xem cấu trúc
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Loading Indicator */}
        {currentStep === 2 && isReading && (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="animate-spin w-10 h-10 rounded-full border-3 border-teal-700 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-700">Đang đọc và phân tích cấu trúc file Excel...</p>
            <p className="text-[11px] text-slate-400">Tự động nhận diện cột tiêu đề và kiểm tra tính toàn vẹn dữ liệu</p>
          </div>
        )}

        {/* STEP 3, 4, 5: Preview, Errors, Mode */}
        {currentStep >= 3 && previewResult && (
          <div className="space-y-5">
            {/* Sheet Selector if multiple sheets */}
            {availableSheets.length > 1 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-700">Chọn Sheet dữ liệu trong file:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-teal-700"
                >
                  {availableSheets.map((name) => (
                    <option key={name} value={name}>
                      Sheet: {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Summary Statistics Pill Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <div className="text-xs text-slate-500 font-medium">Tổng số dòng</div>
                <div className="text-lg font-bold text-slate-800">{previewResult.totalRows}</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="text-xs text-emerald-700 font-medium">Hợp lệ</div>
                <div className="text-lg font-bold text-emerald-800">{previewResult.validRows}</div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <div className="text-xs text-rose-700 font-medium">Lỗi dữ liệu</div>
                <div className="text-lg font-bold text-rose-800">{previewResult.errorRows}</div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <div className="text-xs text-blue-700 font-medium">Dòng mới</div>
                <div className="text-lg font-bold text-blue-800">{previewResult.newRows}</div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <div className="text-xs text-amber-700 font-medium">Trùng lặp</div>
                <div className="text-lg font-bold text-amber-800">{previewResult.duplicateRows}</div>
              </div>
            </div>

            {/* Error diagnostic warning if errorRows > 0 */}
            {previewResult.errorRows > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Phát hiện {previewResult.errorRows} dòng có lỗi</div>
                  <div className="text-[11px] text-rose-700 mt-0.5">
                    Các dòng lỗi sẽ không được nạp vào hệ thống. Bạn có thể bấm nút "Chỉ xem dòng lỗi" bên dưới để kiểm tra chi tiết từng dòng.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterErrorOnly(!filterErrorOnly)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
                    filterErrorOnly
                      ? 'bg-rose-700 text-white'
                      : 'bg-white border border-rose-300 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  {filterErrorOnly ? 'Hiển thị tất cả' : 'Chỉ xem dòng lỗi'}
                </button>
              </div>
            )}

            {/* Shift Change Conflict Banner if activeType === 'weeklySchedule' and conflicts exist */}
            {activeType === 'weeklySchedule' && shiftConflicts.length > 0 && (
              <div
                id="shift-conflict-preview-banner"
                className="p-4 bg-gradient-to-r from-amber-50 to-amber-100/70 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-sm">
                      Phát hiện {shiftConflicts.length} nhân viên đã xếp quầy bị đổi ca (Sáng ⇄ Chiều)
                    </div>
                    <div className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                      {shiftConflicts.filter((c) => shiftDecisions[c.id] === 'remove').length} nhân viên đã chọn <strong>"CÓ"</strong> để xóa khỏi quầy hiện tại và đưa vào danh sách chưa phân quầy
                      {shiftConflicts.filter((c) => shiftDecisions[c.id] === 'keep').length > 0 &&
                        ` (${shiftConflicts.filter((c) => shiftDecisions[c.id] === 'keep').length} nhân viên giữ nguyên quầy)`}
                      .
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  id="open-shift-conflict-modal-btn"
                  onClick={() => setIsShiftConflictModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Xem thông báo &amp; Đổi lựa chọn ({shiftConflicts.length})</span>
                </button>
              </div>
            )}

            {/* Preview Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>
                  Xem trước dữ liệu ({filteredRows.length} / {previewResult.totalRows} dòng)
                </span>
                <span>Tệp: {previewResult.fileName}</span>
              </div>
              <div className="max-h-60 overflow-y-auto overflow-x-auto text-xs">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="py-2 px-3 text-left w-12">Dòng</th>
                      <th className="py-2 px-3 text-left w-20">Trạng thái</th>
                      {previewResult.headers.map((h, i) => (
                        <th key={i} className="py-2 px-3 text-left whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                      <th className="py-2 px-3 text-left">Ghi chú / Lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRows.slice(0, 50).map((row, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50/80 ${
                          !row.isValid
                            ? 'bg-rose-50/50'
                            : row.isDuplicate
                            ? 'bg-amber-50/30'
                            : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-slate-400">{row.rowNumber}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-100/80 px-2 py-0.5 rounded text-[10px]">
                              <XCircle className="w-3 h-3" /> Lỗi
                            </span>
                          )}
                        </td>
                        {/* Values */}
                        {activeType === 'shifts' && (
                          <>
                            <td className="py-2 px-3 font-bold text-slate-900">{row.parsed.shiftCode}</td>
                            <td className="py-2 px-3">{row.parsed.startTime || '-'}</td>
                            <td className="py-2 px-3">{row.parsed.endTime || '-'}</td>
                            <td className="py-2 px-3">{row.parsed.shiftType}</td>
                            <td className="py-2 px-3">
                              {row.parsed.isOff ? (
                                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-semibold">
                                  Nghỉ (Off)
                                </span>
                              ) : (
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                                  {row.parsed.category === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        {activeType === 'counters' && (
                          <>
                            <td className="py-2 px-3 font-bold text-slate-900">{row.parsed.counterNumber}</td>
                            <td className="py-2 px-3">{row.parsed.area}</td>
                          </>
                        )}
                        {activeType === 'employees' && (
                          <>
                            <td className="py-2 px-3 font-bold text-slate-900">{row.parsed.employeeId}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{row.parsed.fullName}</td>
                            <td className="py-2 px-3 text-center">
                              {row.parsed.isSup ? (
                                <span className="bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                  o (SUP)
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">x</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.parsed.canSieuThi !== false ? (
                                <span className="text-emerald-700 font-bold">o</span>
                              ) : (
                                <span className="text-slate-400 font-mono">x</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.parsed.canBanhMy ? (
                                <span className="text-amber-700 font-bold">o</span>
                              ) : (
                                <span className="text-slate-400 font-mono">x</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.parsed.canDelica ? (
                                <span className="text-orange-700 font-bold">o</span>
                              ) : (
                                <span className="text-slate-400 font-mono">x</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-500">{row.parsed.phone || '-'}</td>
                            <td className="py-2 px-3 text-slate-500">{row.parsed.department || '-'}</td>
                          </>
                        )}
                        {activeType === 'weeklySchedule' && (
                          <>
                            <td className="py-2 px-3 font-semibold text-slate-900">{row.parsed.employeeName}</td>
                            <td className="py-2 px-3 text-slate-500">{row.parsed.employeeId || '-'}</td>
                            <td className="py-2 px-3 font-mono">{row.parsed.date}</td>
                            <td className="py-2 px-3 font-medium">Thứ {row.parsed.dayOfWeek + 1}</td>
                            <td className="py-2 px-3 font-bold text-teal-800">{row.parsed.shiftCode}</td>
                          </>
                        )}
                        {/* Errors */}
                        <td className="py-2 px-3 text-rose-600 font-medium">
                          {row.errors.join('; ') || (row.isDuplicate ? 'Dòng trùng lặp mã' : '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewResult.rows.length > 50 && (
                <div className="bg-slate-50 px-4 py-1.5 text-center text-xs text-slate-500 border-t border-slate-200">
                  (Đang hiển thị 50 / {previewResult.rows.length} dòng)
                </div>
              )}
            </div>

            {/* Mode selection: Ghi đè vs Bổ sung */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Chọn phương thức nạp dữ liệu:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    importMode === 'overwrite'
                      ? 'bg-teal-50 border-teal-600 ring-1 ring-teal-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="overwrite"
                    checked={importMode === 'overwrite'}
                    onChange={() => setImportMode('overwrite')}
                    className="mt-0.5 text-teal-700 focus:ring-teal-700"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Ghi đè dữ liệu hiện tại</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Xóa toàn bộ danh mục cũ và thay thế hoàn toàn bằng dữ liệu mới từ file này.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    importMode === 'append'
                      ? 'bg-teal-50 border-teal-600 ring-1 ring-teal-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="mt-0.5 text-teal-700 focus:ring-teal-700"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Bổ sung vào dữ liệu hiện tại</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Giữ nguyên dữ liệu cũ, thêm các bản ghi mới và cập nhật bản ghi có ID trùng.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={resetState}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Chọn file khác
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  id="confirm-import-data-btn"
                  onClick={handleConfirmImport}
                  disabled={previewResult.validRows === 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Xác nhận nhập dữ liệu ({previewResult.validRows} dòng)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shift Change Conflict Notification Modal */}
      <ShiftChangeConfirmModal
        isOpen={isShiftConflictModalOpen}
        onClose={() => setIsShiftConflictModalOpen(false)}
        conflicts={shiftConflicts}
        onConfirm={(newDecisions) => {
          setShiftDecisions(newDecisions);
          setIsShiftConflictModalOpen(false);
          const removeCount = Object.values(newDecisions).filter((d) => d === 'remove').length;
          success(
            `Đã ghi nhận lựa chọn: ${removeCount} nhân viên sẽ bị xóa khỏi quầy và chuyển vào danh sách chưa phân quầy khi nạp lịch.`,
            'Cập nhật lựa chọn đổi ca'
          );
        }}
      />
    </Modal>
  );
};
