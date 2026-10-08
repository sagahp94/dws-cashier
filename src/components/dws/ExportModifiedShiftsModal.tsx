import React, { useState, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { WeeklyScheduleEntry, Shift, Counter, Employee } from '../../types';
import { excelService, isOffShift } from '../../services/excelService';
import { pdfService } from '../../services/pdfService';
import { useToast } from '../common/ToastContainer';
import { getShiftSlotType } from '../../pages/SettingsPage';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  ArrowRight,
  Check,
  RefreshCw,
  Eye,
  Sliders,
} from 'lucide-react';

interface ExportModifiedShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekId: string;
  weeklySchedule: WeeklyScheduleEntry[];
  shifts: Shift[];
  counters?: Counter[];
  employees?: Employee[];
  initialFilter?: 'all_modified' | 'unsynced_modified' | 'synced_modified' | 'current_filtered';
  customFilteredEntries?: WeeklyScheduleEntry[];
}

export const ExportModifiedShiftsModal: React.FC<ExportModifiedShiftsModalProps> = ({
  isOpen,
  onClose,
  weekId,
  weeklySchedule,
  shifts,
  counters = [],
  employees = [],
  initialFilter = 'all_modified',
  customFilteredEntries,
}) => {
  const { success, error, info } = useToast();
  const [filterType, setFilterType] = useState<
    'all_modified' | 'unsynced_modified' | 'synced_modified' | 'all_schedule' | 'custom_filtered'
  >(customFilteredEntries && customFilteredEntries.length > 0 ? 'custom_filtered' : initialFilter);
  const [includeFullMatrixSheet, setIncludeFullMatrixSheet] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [previewTab, setPreviewTab] = useState<'preview' | 'table'>('table');

  const printRef = useRef<HTMLDivElement>(null);

  // Compute modified entries
  const allModifiedEntries = useMemo(() => {
    return weeklySchedule.filter(
      (e) => e.originalShiftCode && e.originalShiftCode !== e.shiftCode
    );
  }, [weeklySchedule]);

  const unsyncedModifiedEntries = useMemo(() => {
    return allModifiedEntries.filter((e) => !e.isHardRosterSynced);
  }, [allModifiedEntries]);

  const syncedModifiedEntries = useMemo(() => {
    return allModifiedEntries.filter((e) => e.isHardRosterSynced);
  }, [allModifiedEntries]);

  // Selected target entries based on filterType
  const targetEntries = useMemo(() => {
    let list: WeeklyScheduleEntry[] = [];
    if (filterType === 'all_modified') {
      list = allModifiedEntries;
    } else if (filterType === 'unsynced_modified') {
      list = unsyncedModifiedEntries;
    } else if (filterType === 'synced_modified') {
      list = syncedModifiedEntries;
    } else if (filterType === 'custom_filtered' && customFilteredEntries) {
      list = customFilteredEntries;
    } else {
      list = weeklySchedule;
    }

    return [...list].sort((a, b) => {
      // 1. Sort by Date ascending (e.g. 2026-09-21 before 2026-09-22)
      const dateA = a.date || '';
      const dateB = b.date || '';
      const dateCompare = dateA.localeCompare(dateB);
      if (dateCompare !== 0) return dateCompare;

      // 2. Sort by Employee Name ascending (Vietnamese collation)
      const nameA = (a.employeeName || '').trim();
      const nameB = (b.employeeName || '').trim();
      const nameCompare = nameA.localeCompare(nameB, 'vi');
      if (nameCompare !== 0) return nameCompare;

      // 3. Sort by Employee ID ascending
      const idA = (a.employeeId || '').trim();
      const idB = (b.employeeId || '').trim();
      return idA.localeCompare(idB, 'vi', { numeric: true });
    });
  }, [
    filterType,
    allModifiedEntries,
    unsyncedModifiedEntries,
    syncedModifiedEntries,
    customFilteredEntries,
    weeklySchedule,
  ]);

  // Summary counts for target entries
  const stats = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let off = 0;
    let synced = 0;
    let unsynced = 0;

    targetEntries.forEach((e) => {
      const type = getShiftSlotType(e.shiftCode, shifts);
      if (type === 'morning') morning++;
      else if (type === 'afternoon') afternoon++;
      else if (type === 'off') off++;

      if (e.isHardRosterSynced) synced++;
      else unsynced++;
    });

    return {
      total: targetEntries.length,
      morning,
      afternoon,
      off,
      synced,
      unsynced,
    };
  }, [targetEntries, shifts]);

  const DAY_NAMES: Record<number, string> = {
    1: 'Thứ 2',
    2: 'Thứ 3',
    3: 'Thứ 4',
    4: 'Thứ 5',
    5: 'Thứ 6',
    6: 'Thứ 7',
    7: 'Chủ Nhật',
  };

  const getDayLabel = (dateStr: string, dayOfWeekNum?: number): string => {
    if (dayOfWeekNum && DAY_NAMES[dayOfWeekNum]) return DAY_NAMES[dayOfWeekNum];
    try {
      const parts = dateStr.split('-').map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2], 12);
        const idx = d.getDay();
        return idx === 0 ? 'Chủ Nhật' : `Thứ ${idx + 1}`;
      }
    } catch {
      // fallback
    }
    return 'Thứ -';
  };

  // Handler: Export Excel
  const handleExportExcel = () => {
    if (targetEntries.length === 0) {
      error('Không có ca làm việc nào để xuất Excel.');
      return;
    }

    try {
      let title = 'DANH SÁCH CA LÀM VIỆC ĐÃ ĐIỀU CHỈNH';
      if (filterType === 'unsynced_modified') {
        title = 'DANH SÁCH CA ĐÃ ĐIỀU CHỈNH (CHƯA SYNC LỊCH CỨNG)';
      } else if (filterType === 'synced_modified') {
        title = 'DANH SÁCH CA ĐÃ ĐIỀU CHỈNH (ĐÃ SYNC LỊCH CỨNG)';
      } else if (filterType === 'all_schedule') {
        title = 'DANH SÁCH TOÀN BỘ CA LÀM VIỆC TUẦN';
      }

      excelService.exportModifiedShiftsToExcel({
        entries: targetEntries,
        shifts,
        weekId,
        title,
        allWeeklySchedule: includeFullMatrixSheet ? weeklySchedule : undefined,
        employees,
      });

      success('Đã tải xuống file Excel ca làm việc thành công!');
    } catch (err: any) {
      console.error('Export Excel error:', err);
      error(err?.message || 'Có lỗi xảy ra khi xuất file Excel.');
    }
  };

  // Handler: Export PDF
  const handleExportPdf = async () => {
    if (targetEntries.length === 0) {
      error('Không có ca làm việc nào để xuất PDF.');
      return;
    }

    try {
      setIsExportingPdf(true);
      setPdfProgress({ current: 1, total: 1 });

      await new Promise((r) => setTimeout(r, 200));

      await pdfService.downloadModifiedShiftsPdf(weekId, (current, total) => {
        setPdfProgress({ current, total });
      });

      success('Đã tải xuống file PDF ca làm việc thành công!');
    } catch (err: any) {
      console.error('Export PDF error:', err);
      error(err?.message || 'Có lỗi xảy ra khi tạo file PDF.');
    } finally {
      setIsExportingPdf(false);
      setPdfProgress(null);
    }
  };

  // Handler: Direct Print
  const handleDirectPrint = () => {
    pdfService.printPdf();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-teal-700" />
          </div>
          <div>
            <span className="text-base font-extrabold text-slate-900">
              Tải xuống File Ca đã chỉnh sửa (PDF / Excel)
            </span>
            <p className="text-xs font-normal text-slate-500">
              Tuần làm việc: <strong className="text-teal-800 font-mono">{weekId}</strong>
            </p>
          </div>
        </div>
      }
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Filter Selection Tabs */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-teal-700" />
              Chọn phạm vi dữ liệu xuất file:
            </span>
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewTab('table')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  previewTab === 'table'
                    ? 'bg-teal-700 text-white shadow-3xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Danh sách ({targetEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('preview')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  previewTab === 'preview'
                    ? 'bg-teal-700 text-white shadow-3xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Trang in A4 PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setFilterType('all_modified')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                filterType === 'all_modified'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Tất cả ca đã sửa</span>
                <span
                  className={`text-xs font-mono font-black px-1.5 py-0.2 rounded-full ${
                    filterType === 'all_modified' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {allModifiedEntries.length} ca
                </span>
              </div>
              <p className={`text-[11px] mt-1 ${filterType === 'all_modified' ? 'text-amber-100' : 'text-slate-400'}`}>
                Toàn bộ các ca có thay đổi so với file gốc
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('unsynced_modified')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                filterType === 'unsynced_modified'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Chưa sync lịch cứng</span>
                <span
                  className={`text-xs font-mono font-black px-1.5 py-0.2 rounded-full ${
                    filterType === 'unsynced_modified' ? 'bg-white text-rose-800' : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {unsyncedModifiedEntries.length} ca
                </span>
              </div>
              <p className={`text-[11px] mt-1 ${filterType === 'unsynced_modified' ? 'text-rose-100' : 'text-slate-400'}`}>
                Các ca cần báo nhân viên & sửa file cứng
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('synced_modified')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                filterType === 'synced_modified'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Đã sync lịch cứng</span>
                <span
                  className={`text-xs font-mono font-black px-1.5 py-0.2 rounded-full ${
                    filterType === 'synced_modified' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {syncedModifiedEntries.length} ca
                </span>
              </div>
              <p className={`text-[11px] mt-1 ${filterType === 'synced_modified' ? 'text-emerald-100' : 'text-slate-400'}`}>
                Đã hoàn tất cập nhật và thông báo
              </p>
            </button>

            {customFilteredEntries && customFilteredEntries.length > 0 ? (
              <button
                type="button"
                onClick={() => setFilterType('custom_filtered')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  filterType === 'custom_filtered'
                    ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Theo bộ lọc hiện tại</span>
                  <span
                    className={`text-xs font-mono font-black px-1.5 py-0.2 rounded-full ${
                      filterType === 'custom_filtered' ? 'bg-white text-teal-900' : 'bg-teal-100 text-teal-900'
                    }`}
                  >
                    {customFilteredEntries.length} ca
                  </span>
                </div>
                <p className={`text-[11px] mt-1 ${filterType === 'custom_filtered' ? 'text-teal-100' : 'text-slate-400'}`}>
                  Các ca đang lọc theo ngày / nhân viên
                </p>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFilterType('all_schedule')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  filterType === 'all_schedule'
                    ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Toàn bộ lịch tuần</span>
                  <span
                    className={`text-xs font-mono font-black px-1.5 py-0.2 rounded-full ${
                      filterType === 'all_schedule' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {weeklySchedule.length} ca
                  </span>
                </div>
                <p className={`text-[11px] mt-1 ${filterType === 'all_schedule' ? 'text-slate-300' : 'text-slate-400'}`}>
                  Bao gồm cả ca gốc và ca đã điều chỉnh
                </p>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-between border border-slate-200">
            <span>Tổng số ca xuất:</span>
            <strong className="text-slate-900 font-mono text-sm">{stats.total}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 flex items-center justify-between border border-amber-200">
            <span>Ca sáng:</span>
            <strong className="font-mono text-sm">{stats.morning}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-between border border-indigo-200">
            <span>Ca chiều:</span>
            <strong className="font-mono text-sm">{stats.afternoon}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 flex items-center justify-between border border-emerald-200">
            <span>Đã sync:</span>
            <strong className="font-mono text-sm">{stats.synced}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-900 flex items-center justify-between border border-rose-200">
            <span>Chưa sync:</span>
            <strong className="font-mono text-sm">{stats.unsynced}</strong>
          </div>
        </div>

        {/* Options for Excel */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeFullMatrixSheet}
              onChange={(e) => setIncludeFullMatrixSheet(e.target.checked)}
              className="w-4 h-4 rounded text-teal-700 focus:ring-teal-600 cursor-pointer accent-teal-700"
            />
            <span className="font-bold text-slate-800">
              Đính kèm Sheet 2: Ma trận ca làm việc tuần hoàn chỉnh (có đánh dấu ca đã đổi)
            </span>
          </label>
          <span className="text-teal-700 text-[11px] font-medium hidden sm:inline">
            Tự động tạo 2 sheet trong file Excel
          </span>
        </div>

        {/* Main Content: Table View vs A4 Printable Document View */}
        {previewTab === 'table' ? (
          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[42vh] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3 text-left w-10">STT</th>
                  <th className="py-2.5 px-3 text-left w-20">Mã NV</th>
                  <th className="py-2.5 px-3 text-left">Tên Nhân Viên</th>
                  <th className="py-2.5 px-3 text-left w-24">Ngày</th>
                  <th className="py-2.5 px-3 text-left w-16">Thứ</th>
                  <th className="py-2.5 px-3 text-left">Ca Gốc ➔ Ca Mới</th>
                  <th className="py-2.5 px-3 text-left w-24">Phân Loại</th>
                  <th className="py-2.5 px-3 text-center w-36">Sync Lịch Cứng</th>
                  <th className="py-2.5 px-3 text-left">Ghi Chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {targetEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Không có ca làm việc nào phù hợp với phạm vi xuất đã chọn.
                    </td>
                  </tr>
                ) : (
                  targetEntries.map((entry, idx) => {
                    const isMod = !!(entry.originalShiftCode && entry.originalShiftCode !== entry.shiftCode);
                    const slotType = getShiftSlotType(entry.shiftCode, shifts);
                    return (
                      <tr
                        key={`${entry.employeeId || entry.employeeName}_${entry.date}_${idx}`}
                        className={`hover:bg-slate-50 transition-colors ${
                          isMod ? (entry.isHardRosterSynced ? 'bg-emerald-50/20' : 'bg-amber-50/30') : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {entry.employeeId || '---'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{entry.employeeName}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{entry.date}</td>
                        <td className="py-2 px-3 text-slate-700">{getDayLabel(entry.date, entry.dayOfWeek)}</td>
                        <td className="py-2 px-3">
                          {isMod ? (
                            <div className="inline-flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <span className="line-through text-slate-400 font-mono font-bold">
                                {entry.originalShiftCode}
                              </span>
                              <ArrowRight className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="font-black text-teal-800 font-mono">{entry.shiftCode}</span>
                            </div>
                          ) : (
                            <span className="font-bold font-mono text-slate-800">{entry.shiftCode}</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              slotType === 'morning'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : slotType === 'afternoon'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {slotType === 'morning' ? 'Ca Sáng' : slotType === 'afternoon' ? 'Ca Chiều' : 'Nghỉ'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {entry.isHardRosterSynced ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <Check className="w-3 h-3 text-emerald-700" />
                              Đã sync
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-700" />
                              Chưa sync
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 max-w-[200px] truncate" title={entry.modificationNote}>
                          {entry.modificationNote || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Rendered A4 Document View (also used as DOM capture target for PDF) */
          <div className="border border-slate-300 rounded-2xl p-4 bg-slate-200/50 max-h-[46vh] overflow-y-auto flex justify-center">
            <div
              id="modified-shifts-pdf-container"
              ref={printRef}
              className="modified-shifts-pdf-page w-[210mm] min-h-[297mm] bg-white p-8 shadow-md text-slate-900 font-sans text-xs space-y-4 rounded-sm border border-slate-200"
            >
              {/* Report Header */}
              <div className="flex items-start justify-between border-b-2 border-teal-800 pb-3">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-slate-600 tracking-wider">
                    AEON VIỆT NAM • CHI NHÁNH HẢI PHÒNG LÊ CHÂN
                  </div>
                  <div className="text-[10px] font-semibold text-teal-800">
                    BỘ PHẬN THU NGÂN (CASHIER MANAGEMENT)
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <div>Tuần: <strong className="text-slate-800 font-mono">{weekId}</strong></div>
                  <div>Ngày in: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN')}</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-1 my-2">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  DANH SÁCH CA LÀM VIỆC ĐÃ ĐIỀU CHỈNH / ĐỔI CA
                </h2>
                <p className="text-[11px] text-slate-500">
                  Bảng tổng hợp các ca trực được quản lý điều chỉnh trực tiếp trên hệ thống DWS
                </p>
              </div>

              {/* KPI Chips */}
              <div className="grid grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="text-center border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px]">Tổng số ca điều chỉnh</span>
                  <strong className="text-slate-900 font-mono text-sm">{stats.total} ca</strong>
                </div>
                <div className="text-center border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px]">Ca sáng / Ca chiều</span>
                  <strong className="text-teal-900 font-mono text-sm">{stats.morning}S / {stats.afternoon}C</strong>
                </div>
                <div className="text-center border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px]">Đã sync file lịch cứng</span>
                  <strong className="text-emerald-700 font-mono text-sm">{stats.synced} ca</strong>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 block text-[10px]">Chưa sync lịch cứng</span>
                  <strong className="text-rose-700 font-mono text-sm">{stats.unsynced} ca</strong>
                </div>
              </div>

              {/* Printable Table */}
              <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <tr>
                    <th className="border border-slate-300 p-1.5 text-center w-8">STT</th>
                    <th className="border border-slate-300 p-1.5 text-left w-16">Mã NV</th>
                    <th className="border border-slate-300 p-1.5 text-left">Tên Nhân Viên</th>
                    <th className="border border-slate-300 p-1.5 text-center w-20">Ngày</th>
                    <th className="border border-slate-300 p-1.5 text-center w-14">Thứ</th>
                    <th className="border border-slate-300 p-1.5 text-center w-28">Ca Gốc ➔ Ca Mới</th>
                    <th className="border border-slate-300 p-1.5 text-center w-20">Phân Loại</th>
                    <th className="border border-slate-300 p-1.5 text-center w-24">Sync Lịch</th>
                    <th className="border border-slate-300 p-1.5 text-left">Lý Do / Ghi Chú</th>
                  </tr>
                </thead>
                <tbody>
                  {targetEntries.map((entry, idx) => {
                    const isMod = !!(entry.originalShiftCode && entry.originalShiftCode !== entry.shiftCode);
                    const slotType = getShiftSlotType(entry.shiftCode, shifts);
                    return (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                        <td className="border border-slate-300 p-1 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-1 font-mono font-bold text-slate-800">
                          {entry.employeeId || '-'}
                        </td>
                        <td className="border border-slate-300 p-1 font-bold text-slate-900">
                          {entry.employeeName}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-mono">{entry.date}</td>
                        <td className="border border-slate-300 p-1 text-center">
                          {getDayLabel(entry.date, entry.dayOfWeek)}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-mono">
                          {isMod ? (
                            <span>
                              <span className="line-through text-slate-400 font-semibold">{entry.originalShiftCode}</span>{' '}
                              ➔ <strong className="text-teal-900 font-black">{entry.shiftCode}</strong>
                            </span>
                          ) : (
                            <strong className="text-slate-800">{entry.shiftCode}</strong>
                          )}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-semibold">
                          {slotType === 'morning' ? 'Ca Sáng' : slotType === 'afternoon' ? 'Ca Chiều' : 'Nghỉ'}
                        </td>
                        <td className="border border-slate-300 p-1 text-center text-[9.5px] font-bold">
                          {entry.isHardRosterSynced ? (
                            <span className="text-emerald-700">✓ Đã sync</span>
                          ) : (
                            <span className="text-rose-700">✗ Chưa sync</span>
                          )}
                        </td>
                        <td className="border border-slate-300 p-1 text-slate-600 text-[10px]">
                          {entry.modificationNote || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Signature Section */}
              <div className="pt-8 grid grid-cols-3 gap-4 text-center text-[11px] text-slate-700">
                <div className="space-y-12">
                  <div><strong>Người Lập Bảng</strong></div>
                  <div className="text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                </div>
                <div className="space-y-12">
                  <div><strong>Thu Ngân Trưởng / SUP</strong></div>
                  <div className="text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                </div>
                <div className="space-y-12">
                  <div><strong>Quản Lý Phê Duyệt</strong></div>
                  <div className="text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Container For PDF Capturing if not in preview tab */}
        {previewTab !== 'preview' && (
          <div className="fixed -left-[9999px] top-0 pointer-events-none">
            <div
              id="modified-shifts-pdf-container"
              className="modified-shifts-pdf-page w-[210mm] min-h-[297mm] bg-white p-8 shadow-none text-slate-900 font-sans text-xs space-y-4"
            >
              {/* Report Header */}
              <div className="flex items-start justify-between border-b-2 border-teal-800 pb-3">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-slate-600 tracking-wider">
                    AEON VIỆT NAM • CHI NHÁNH HẢI PHÒNG LÊ CHÂN
                  </div>
                  <div className="text-[10px] font-semibold text-teal-800">
                    BỘ PHẬN THU NGÂN (CASHIER MANAGEMENT)
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <div>Tuần: <strong className="text-slate-800 font-mono">{weekId}</strong></div>
                  <div>Ngày in: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN')}</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-1 my-2">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  DANH SÁCH CA LÀM VIỆC ĐÃ ĐIỀU CHỈNH / ĐỔI CA
                </h2>
                <p className="text-[11px] text-slate-500">
                  Bảng tổng hợp các ca trực được quản lý điều chỉnh trực tiếp trên hệ thống DWS
                </p>
              </div>

              {/* KPI Chips */}
              <div className="grid grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="text-center border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px]">Tổng số ca điều chỉnh</span>
                  <strong className="text-slate-900 font-mono text-sm">{stats.total} ca</strong>
                </div>
                <div className="text-center border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px]">Ca sáng / Ca chiều</span>
                  <strong className="text-teal-900 font-mono text-sm">{stats.morning}S / {stats.afternoon}C</strong>
                </div>
                <div className="text-center border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px]">Đã sync file lịch cứng</span>
                  <strong className="text-emerald-700 font-mono text-sm">{stats.synced} ca</strong>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 block text-[10px]">Chưa sync lịch cứng</span>
                  <strong className="text-rose-700 font-mono text-sm">{stats.unsynced} ca</strong>
                </div>
              </div>

              {/* Printable Table */}
              <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <tr>
                    <th className="border border-slate-300 p-1.5 text-center w-8">STT</th>
                    <th className="border border-slate-300 p-1.5 text-left w-16">Mã NV</th>
                    <th className="border border-slate-300 p-1.5 text-left">Tên Nhân Viên</th>
                    <th className="border border-slate-300 p-1.5 text-center w-20">Ngày</th>
                    <th className="border border-slate-300 p-1.5 text-center w-14">Thứ</th>
                    <th className="border border-slate-300 p-1.5 text-center w-28">Ca Gốc ➔ Ca Mới</th>
                    <th className="border border-slate-300 p-1.5 text-center w-20">Phân Loại</th>
                    <th className="border border-slate-300 p-1.5 text-center w-24">Sync Lịch</th>
                    <th className="border border-slate-300 p-1.5 text-left">Lý Do / Ghi Chú</th>
                  </tr>
                </thead>
                <tbody>
                  {targetEntries.map((entry, idx) => {
                    const isMod = !!(entry.originalShiftCode && entry.originalShiftCode !== entry.shiftCode);
                    const slotType = getShiftSlotType(entry.shiftCode, shifts);
                    return (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                        <td className="border border-slate-300 p-1 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-1 font-mono font-bold text-slate-800">
                          {entry.employeeId || '-'}
                        </td>
                        <td className="border border-slate-300 p-1 font-bold text-slate-900">
                          {entry.employeeName}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-mono">{entry.date}</td>
                        <td className="border border-slate-300 p-1 text-center">
                          {getDayLabel(entry.date, entry.dayOfWeek)}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-mono">
                          {isMod ? (
                            <span>
                              <span className="line-through text-slate-400 font-semibold">{entry.originalShiftCode}</span>{' '}
                              ➔ <strong className="text-teal-900 font-black">{entry.shiftCode}</strong>
                            </span>
                          ) : (
                            <strong className="text-slate-800">{entry.shiftCode}</strong>
                          )}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-semibold">
                          {slotType === 'morning' ? 'Ca Sáng' : slotType === 'afternoon' ? 'Ca Chiều' : 'Nghỉ'}
                        </td>
                        <td className="border border-slate-300 p-1 text-center text-[9.5px] font-bold">
                          {entry.isHardRosterSynced ? (
                            <span className="text-emerald-700">✓ Đã sync</span>
                          ) : (
                            <span className="text-rose-700">✗ Chưa sync</span>
                          )}
                        </td>
                        <td className="border border-slate-300 p-1 text-slate-600 text-[10px]">
                          {entry.modificationNote || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Signature Section */}
              <div className="pt-8 grid grid-cols-3 gap-4 text-center text-[11px] text-slate-700">
                <div className="space-y-12">
                  <div><strong>Người Lập Bảng</strong></div>
                  <div className="text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                </div>
                <div className="space-y-12">
                  <div><strong>Thu Ngân Trưởng / SUP</strong></div>
                  <div className="text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                </div>
                <div className="space-y-12">
                  <div><strong>Quản Lý Phê Duyệt</strong></div>
                  <div className="text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
          >
            Đóng
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={targetEntries.length === 0}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all disabled:opacity-40"
              title="Mở hộp thoại In nhanh của trình duyệt"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>In trang (Print)</span>
            </button>

            <button
              type="button"
              id="btn-download-modified-excel"
              onClick={handleExportExcel}
              disabled={targetEntries.length === 0}
              className="px-4 py-2 text-xs font-extrabold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-40"
              title="Tải xuống tệp Excel .xlsx"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Tải Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              id="btn-download-modified-pdf"
              onClick={handleExportPdf}
              disabled={targetEntries.length === 0 || isExportingPdf}
              className="px-4 py-2 text-xs font-extrabold text-white bg-teal-800 hover:bg-teal-900 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-50"
              title="Tải xuống tệp PDF A4 chuẩn định dạng"
            >
              {isExportingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-200" />
                  <span>Đang tạo PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-teal-200" />
                  <span>Tải PDF (.pdf)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
