import React, { useState, useMemo, useCallback } from 'react';
import { Counter, DayDwsAssignment, Employee, Shift, WeeklyScheduleEntry } from '../../types';
import { pdfService } from '../../services/pdfService';
import { excelService } from '../../services/excelService';
import { useToast } from '../common/ToastContainer';
import {
  Printer,
  Download,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  CalendarRange,
  Columns2,
} from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { addDaysToDateStr, formatDisplayDate } from '../../utils/dateUtils';

interface DwsSheetPreviewProps {
  date: string;
  dayName: string;
  weekId: string;
  currentMonday?: string;
  counters: Counter[];
  assignment: DayDwsAssignment | null;
  assignmentsMap?: Record<string, DayDwsAssignment>;
  shifts: Shift[];
  employees?: Employee[];
  weeklySchedule?: WeeklyScheduleEntry[];
  unassignedCount?: number;
  onBackToEdit?: () => void;
  onUpdateAssignment?: (updated: DayDwsAssignment) => void;
}

const SPLIT_SHIFT_COLS_STORAGE_KEY = 'dws_pdf_split_morning_afternoon';

function getInitialSplitShiftCols(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(SPLIT_SHIFT_COLS_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

function isWeekendDate(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return false;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay(); // 0 = CN, 6 = T7
  return dow === 0 || dow === 6;
}

interface ShiftEntry {
  name: string;
  code: string;
  t?: string;
}

interface CounterSplitSlotData {
  morningEntries: ShiftEntry[];
  afternoonEntries: ShiftEntry[];
  hasMorning: boolean;
  hasAfternoon: boolean;
  weight: number;
}

function getCounterSplitData(
  counterId: string,
  targetAssignment: DayDwsAssignment | null
): CounterSplitSlotData {
  const ca = targetAssignment?.assignments?.[counterId];

  const morningEntries: ShiftEntry[] = [];
  if (ca?.morning?.employeeName || ca?.morning?.shiftCode) {
    morningEntries.push({
      name: ca.morning.employeeName || '',
      code: ca.morning.shiftCode || '',
    });
  }
  if (ca?.morning2?.employeeName || ca?.morning2?.shiftCode) {
    morningEntries.push({
      name: ca.morning2.employeeName || '',
      code: ca.morning2.shiftCode || '',
    });
  }

  const afternoonEntries: ShiftEntry[] = [];
  if (ca?.afternoon?.employeeName || ca?.afternoon?.shiftCode) {
    afternoonEntries.push({
      name: ca.afternoon.employeeName || '',
      code: ca.afternoon.shiftCode || '',
    });
  }
  if (ca?.afternoon2?.employeeName || ca?.afternoon2?.shiftCode) {
    afternoonEntries.push({
      name: ca.afternoon2.employeeName || '',
      code: ca.afternoon2.shiftCode || '',
    });
  }

  const extraLines =
    (morningEntries.length > 1 ? 0.6 : 0) + (afternoonEntries.length > 1 ? 0.6 : 0);

  return {
    morningEntries,
    afternoonEntries,
    hasMorning: morningEntries.length > 0,
    hasAfternoon: afternoonEntries.length > 0,
    weight: 2 + extraLines,
  };
}

function getCounterUnifiedRows(
  counterId: string,
  targetAssignment: DayDwsAssignment | null,
  compactEmptySubRows: boolean
): ShiftEntry[] {
  const ca = targetAssignment?.assignments?.[counterId];

  const rMorning: ShiftEntry = {
    name: ca?.morning?.employeeName || '',
    code: ca?.morning?.shiftCode || '',
    t: ca?.morning ? '##' : '',
  };
  const rMorning2: ShiftEntry = {
    name: ca?.morning2?.employeeName || '',
    code: ca?.morning2?.shiftCode || '',
    t: ca?.morning2 ? '##' : '',
  };
  const rAfternoon: ShiftEntry = {
    name: ca?.afternoon?.employeeName || '',
    code: ca?.afternoon?.shiftCode || '',
    t: ca?.afternoon ? '##' : '',
  };
  const rAfternoon2: ShiftEntry = {
    name: ca?.afternoon2?.employeeName || '',
    code: ca?.afternoon2?.shiftCode || '',
    t: ca?.afternoon2 ? '##' : '',
  };

  if (!compactEmptySubRows) {
    return [rMorning, rMorning2, rAfternoon, rAfternoon2];
  }

  const rows: ShiftEntry[] = [rMorning];
  if (rMorning2.name || rMorning2.code) {
    rows.push(rMorning2);
  }
  rows.push(rAfternoon);
  if (rAfternoon2.name || rAfternoon2.code) {
    rows.push(rAfternoon2);
  }
  return rows;
}

/**
 * Chia danh sách quầy liên tiếp thành đúng `targetPages` trang (2 trang/ngày)
 * bằng quy hoạch động (minimax) sao cho trọng số chiều cao mỗi trang cân bằng nhất.
 */
function partitionCountersIntoPages(
  counters: Counter[],
  weights: number[],
  targetPages: number
): Counter[][] {
  const n = counters.length;
  if (n === 0) return [[]];
  const k = Math.min(Math.max(1, targetPages), n);
  if (k === 1) return [counters];

  const prefix = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + weights[i];
  }

  const INF = 1e9;
  const dp: number[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(INF));
  const splitPoint: number[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));

  dp[0][0] = 0;
  for (let p = 1; p <= k; p++) {
    for (let i = p; i <= n; i++) {
      for (let j = p - 1; j < i; j++) {
        const segmentCost = prefix[i] - prefix[j];
        const cost = Math.max(dp[p - 1][j], segmentCost);
        if (cost < dp[p][i]) {
          dp[p][i] = cost;
          splitPoint[p][i] = j;
        }
      }
    }
  }

  const pages: Counter[][] = [];
  let curr = n;
  for (let p = k; p >= 1; p--) {
    const prev = splitPoint[p][curr];
    pages.unshift(counters.slice(prev, curr));
    curr = prev;
  }

  return pages;
}

interface DayPaginationPlan {
  pages: Counter[][];
  compactEmptySubRows: boolean;
  isWeekend: boolean;
  targetPages: number;
}

export const DwsSheetPreview: React.FC<DwsSheetPreviewProps> = ({
  date,
  dayName,
  weekId,
  currentMonday,
  counters,
  assignment,
  assignmentsMap = {},
  shifts,
  employees = [],
  weeklySchedule = [],
  unassignedCount = 0,
  onBackToEdit,
}) => {
  const { success, error, info } = useToast();
  const [previewMode, setPreviewMode] = useState<'day' | 'week'>('day');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [splitMorningAfternoon, setSplitMorningAfternoon] = useState<boolean>(
    getInitialSplitShiftCols
  );
  const [isExportWarningOpen, setIsExportWarningOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'download' | 'print' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState<string>('');

  const baseMonday = currentMonday || weekId;

  const toggleSplitMorningAfternoon = useCallback(() => {
    setSplitMorningAfternoon((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SPLIT_SHIFT_COLS_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Sort counters by order
  const sortedCounters = useMemo(() => {
    return [...counters].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [counters]);

  // Check if a counter is SSC (Self-service checkout)
  const isSscCounter = (c: Counter) => {
    const num = (c.counterNumber || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    return (
      num.includes('ssc') ||
      id.includes('ssc') ||
      ['1', '2', '3', '4'].includes((c.counterNumber || '').trim())
    );
  };

  // Get display text for counter number
  const getCounterDisplay = (c: Counter) => {
    const isSsc = isSscCounter(c);
    const numOnly = (c.counterNumber || '').replace(/ssc/gi, '').trim();
    return { isSsc, numOnly: numOnly || c.counterNumber };
  };

  // Build pagination plan for any given day:
  // Tất cả các ngày trong tuần (Thứ 2 -> Chủ Nhật) đều xuất đúng 2 trang A4
  const buildDayPaginationPlan = useCallback(
    (targetDate: string, targetAssignment: DayDwsAssignment | null): DayPaginationPlan => {
      const weekend = isWeekendDate(targetDate);
      const targetPages = 2;

      if (splitMorningAfternoon) {
        const weights = sortedCounters.map(
          (c) => getCounterSplitData(c.id, targetAssignment).weight
        );
        const pages = partitionCountersIntoPages(sortedCounters, weights, targetPages);
        return {
          pages,
          compactEmptySubRows: false,
          isWeekend: weekend,
          targetPages,
        };
      }

      // Chế độ chung 1 cột như cũ: luôn co gọn dòng phụ trống để vừa 2 trang A4 cho mọi ngày
      const compactEmptySubRows = true;
      const rowCounts = sortedCounters.map(
        (c) => getCounterUnifiedRows(c.id, targetAssignment, compactEmptySubRows).length
      );
      const pages = partitionCountersIntoPages(sortedCounters, rowCounts, targetPages);

      return {
        pages,
        compactEmptySubRows,
        isWeekend: weekend,
        targetPages,
      };
    },
    [sortedCounters, splitMorningAfternoon]
  );

  // Single day pagination plan
  const currentDayPlan = useMemo(
    () => buildDayPaginationPlan(date, assignment),
    [buildDayPaginationPlan, date, assignment]
  );

  const totalPages = currentDayPlan.pages.length;

  // 7 days of the week: Thứ 2 -> Chủ Nhật
  const weekDays = useMemo(() => {
    const dayNamesList = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const dStr = addDaysToDateStr(baseMonday, i);
      const dayAssignment = assignmentsMap[dStr] || (dStr === date ? assignment : null);
      const plan = buildDayPaginationPlan(dStr, dayAssignment);
      return {
        index: i,
        date: dStr,
        dayName: dayNamesList[i],
        assignment: dayAssignment,
        plan,
      };
    });
  }, [baseMonday, assignmentsMap, date, assignment, buildDayPaginationPlan]);

  const totalWeekPages = useMemo(
    () => weekDays.reduce((sum, d) => sum + d.plan.pages.length, 0),
    [weekDays]
  );

  // Generate standardized PDF title: DWS AEON HAI PHONG LE CHAN - {THỨ}(dd/mm/yyyy)
  const getPdfTitle = (dName: string, dDate: string) => {
    return `DWS AEON HAI PHONG LE CHAN - ${dName.toUpperCase()}(${formatDisplayDate(dDate)})`;
  };

  const handleDownload = () => {
    if (previewMode === 'day' && unassignedCount > 0) {
      setPendingAction('download');
      setIsExportWarningOpen(true);
      return;
    }
    executeDownload();
  };

  const handlePrint = () => {
    if (previewMode === 'day' && unassignedCount > 0) {
      setPendingAction('print');
      setIsExportWarningOpen(true);
      return;
    }
    executePrint();
  };

  const executeDownload = async () => {
    setIsExporting(true);
    setExportProgressText('Đang khởi tạo tài liệu PDF...');
    try {
      const isWeek = previewMode === 'week';
      await pdfService.downloadPdf({
        date,
        dayName,
        weekId: baseMonday,
        counters: sortedCounters,
        assignment,
        shifts,
        weeklySchedule,
        isWeek,
        onProgress: (cur, tot) => {
          setExportProgressText(`Đang xử lý trang ${cur}/${tot}...`);
        },
      });
      success(
        isWeek
          ? `Đã xuất và tải xuống file PDF DWS cả tuần (${totalWeekPages} trang) thành công!`
          : `Đã xuất và tải xuống file PDF DWS ngày (${totalPages} trang) thành công!`
      );
    } catch (err: any) {
      console.error('PDF export error:', err);
      error(err?.message || 'Có lỗi khi xuất file PDF. Vui lòng thử lại!');
    } finally {
      setIsExporting(false);
      setExportProgressText('');
    }
  };

  const executePrint = () => {
    info('Đang mở lệnh in... Nếu trình duyệt chặn cửa sổ in, bạn có thể tải file PDF để in trực tiếp.');
    pdfService.printPdf();
  };

  const handleDownloadExcelDaily = () => {
    try {
      excelService.exportDailyDwsToExcel({
        date,
        dayName,
        weekId: baseMonday,
        counters: sortedCounters,
        assignment,
        shifts,
        weeklySchedule,
      });
      success(`Đã tải xuống file Excel DWS ngày ${dayName} (${formatDisplayDate(date)}) thành công!`);
    } catch (err: any) {
      console.error('Daily Excel export error:', err);
      error('Có lỗi khi xuất file Excel. Vui lòng thử lại!');
    }
  };

  const handleDownloadExcelWeekly = () => {
    try {
      excelService.exportWeeklyDwsToExcel({
        mondayDate: baseMonday,
        counters: sortedCounters,
        assignmentsMap,
        shifts,
        weeklySchedule,
        employees,
      });
      success('Đã tải xuống file Excel DWS cả tuần (7 sheets MON..SUN + sheet FOLLOW) thành công!');
    } catch (err: any) {
      console.error('Weekly Excel export error:', err);
      error('Có lỗi khi xuất file Excel tuần. Vui lòng thử lại!');
    }
  };

  const handleZoomChange = (delta: number) => {
    setZoomLevel((prev) => Math.min(150, Math.max(50, prev + delta)));
  };

  /**
   * Bảng 1: Chế độ CHIA SÁNG / CHIỀU (BẬT)
   * - Mỗi quầy gồm 2 ô xếp dọc (trên: Ca Sáng bên trái; dưới: Ca Chiều bên phải)
   */
  const renderSplitShiftTable = (
    pageCounters: Counter[],
    targetAssignment: DayDwsAssignment | null
  ) => {
    const slotDataList = pageCounters.map((c) => getCounterSplitData(c.id, targetAssignment));
    const totalWeight = slotDataList.reduce((sum, s) => sum + s.weight, 0);

    const calculatedMm = Math.floor((252 / Math.max(1, totalWeight)) * 10) / 10;
    const rowHeightMm = Math.min(6.4, Math.max(3.8, calculatedMm));

    const isSpacious = rowHeightMm >= 5.5;
    const textSizeClass = isSpacious ? 'text-[10.5px]' : 'text-[9.5px]';
    const codeSizeClass = isSpacious ? 'text-[9.5px]' : 'text-[8.5px]';
    const counterNumClass = isSpacious ? 'text-[12px]' : 'text-[11px]';
    const sscSubClass = isSpacious ? 'text-[8.5px]' : 'text-[8px]';

    return (
      <table className={`w-full max-w-[188mm] mx-auto border-collapse border border-black ${textSizeClass}`}>
        <thead>
          <tr className="bg-white text-black font-bold text-center border-b border-black h-[6.5mm]">
            <th className="border border-black px-1 py-0 w-[8%] text-center font-bold text-[9.5px]">
              Quầy
            </th>
            <th className="border border-black px-1.5 py-0 w-[30%] text-center font-bold text-[9.5px] bg-amber-50/50">
              Ca Sáng (Tên Thu Ngân)
            </th>
            <th className="border border-black border-r-[1.5px] border-r-black px-1 py-0 w-[8%] text-center font-bold text-[9px] bg-amber-50/50">
              MÃ
            </th>
            <th className="border border-black px-1.5 py-0 w-[30%] text-center font-bold text-[9.5px] bg-sky-50/50">
              Ca Chiều (Tên Thu Ngân)
            </th>
            <th className="border border-black px-1 py-0 w-[8%] text-center font-bold text-[9px] bg-sky-50/50">
              MÃ
            </th>
            <th className="border border-black px-0.5 py-0 w-[8%] text-center font-bold text-[9px]">
              T
            </th>
            <th className="border border-black px-1 py-0 w-[8%] text-center font-bold text-[9.5px]">
              Quầy
            </th>
          </tr>
        </thead>
        <tbody>
          {pageCounters.map((counter, idx) => {
            const isSsc = isSscCounter(counter);
            const { numOnly } = getCounterDisplay(counter);
            const { morningEntries, afternoonEntries, hasMorning, hasAfternoon } =
              slotDataList[idx];

            return (
              <React.Fragment key={counter.id}>
                {/* Ô BÊN TRÊN: CA SÁNG (CỘT TRÁI) */}
                <tr
                  style={{ height: `${rowHeightMm}mm` }}
                  className="border-t-[1.2px] border-t-black"
                >
                  <td
                    rowSpan={2}
                    className="border border-black text-center font-bold px-0.5 py-0 align-middle bg-white text-black leading-none"
                  >
                    {isSsc ? (
                      <div className="flex flex-col items-center justify-center leading-none">
                        <span className={`${counterNumClass} font-black leading-none`}>
                          {numOnly}
                        </span>
                        <span
                          className={`${sscSubClass} font-semibold lowercase text-slate-800 leading-none mt-[1px]`}
                        >
                          ssc
                        </span>
                      </div>
                    ) : (
                      <div className={`${counterNumClass} font-black leading-none`}>
                        {counter.counterNumber}
                      </div>
                    )}
                  </td>

                  <td className="border border-black px-1.5 py-0.5 text-left font-semibold leading-tight align-middle">
                    {hasMorning ? (
                      <div className="flex flex-col justify-center gap-[1px]">
                        {morningEntries.map((m, mIdx) => (
                          <div key={mIdx} className="truncate max-w-[54mm]">
                            {m.name}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </td>

                  <td
                    className={`border border-black border-r-[1.5px] border-r-black px-1 py-0.5 text-center font-bold leading-tight align-middle ${codeSizeClass}`}
                  >
                    {hasMorning ? (
                      <div className="flex flex-col justify-center gap-[1px]">
                        {morningEntries.map((m, mIdx) => (
                          <div key={mIdx}>{m.code}</div>
                        ))}
                      </div>
                    ) : null}
                  </td>

                  <td className="border border-black px-1.5 py-0 bg-white" />
                  <td className="border border-black px-1 py-0 bg-white" />

                  <td
                    className={`border border-black px-0.5 py-0.5 text-center font-mono font-bold leading-tight align-middle ${codeSizeClass}`}
                  >
                    {hasMorning ? morningEntries.map(() => '##').join(' ') : ''}
                  </td>

                  <td
                    rowSpan={2}
                    className="border border-black text-center font-bold px-0.5 py-0 align-middle bg-white text-black leading-none"
                  >
                    {isSsc ? (
                      <div className="flex flex-col items-center justify-center leading-none">
                        <span className={`${counterNumClass} font-black leading-none`}>
                          {numOnly}
                        </span>
                        <span
                          className={`${sscSubClass} font-semibold lowercase text-slate-800 leading-none mt-[1px]`}
                        >
                          ssc
                        </span>
                      </div>
                    ) : (
                      <div className={`${counterNumClass} font-black leading-none`}>
                        {counter.counterNumber}
                      </div>
                    )}
                  </td>
                </tr>

                {/* Ô BÊN DƯỚI: CA CHIỀU (CỘT PHẢI) */}
                <tr
                  style={{ height: `${rowHeightMm}mm` }}
                  className="border-t border-t-slate-400 border-b-[1.2px] border-b-black"
                >
                  <td className="border border-black px-1.5 py-0 bg-white" />
                  <td className="border border-black border-r-[1.5px] border-r-black px-1 py-0 bg-white" />

                  <td className="border border-black px-1.5 py-0.5 text-left font-semibold leading-tight align-middle">
                    {hasAfternoon ? (
                      <div className="flex flex-col justify-center gap-[1px]">
                        {afternoonEntries.map((a, aIdx) => (
                          <div key={aIdx} className="truncate max-w-[54mm]">
                            {a.name}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </td>

                  <td
                    className={`border border-black px-1 py-0.5 text-center font-bold leading-tight align-middle ${codeSizeClass}`}
                  >
                    {hasAfternoon ? (
                      <div className="flex flex-col justify-center gap-[1px]">
                        {afternoonEntries.map((a, aIdx) => (
                          <div key={aIdx}>{a.code}</div>
                        ))}
                      </div>
                    ) : null}
                  </td>

                  <td
                    className={`border border-black px-0.5 py-0.5 text-center font-mono font-bold leading-tight align-middle ${codeSizeClass}`}
                  >
                    {hasAfternoon ? afternoonEntries.map(() => '##').join(' ') : ''}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  /**
   * Bảng 2: Chế độ CHUNG 1 CỘT NHƯ CŨ (TẮT chia Sáng/Chiều)
   * - Cột chuẩn 5 cột: Quầy | Tên Thu Ngân | MÃ | T | Quầy
   */
  const renderUnifiedSingleTable = (
    countersList: Counter[],
    targetAssignment: DayDwsAssignment | null,
    compactEmptySubRows: boolean,
    rowHeightMm: number,
    isSplitTwoColumn: boolean
  ) => {
    const isDense = rowHeightMm < 4.1;
    const textSizeClass = isSplitTwoColumn
      ? 'text-[8.5px]'
      : isDense
      ? 'text-[9px]'
      : 'text-[10px]';
    const counterNumClass = isSplitTwoColumn || isDense ? 'text-[10px]' : 'text-[11.5px]';
    const sscSubClass = isSplitTwoColumn || isDense ? 'text-[7.5px]' : 'text-[8.5px]';

    return (
      <table
        className={`w-full border-collapse border border-black ${textSizeClass} ${
          isSplitTwoColumn ? '' : 'max-w-[160mm] mx-auto'
        }`}
      >
        <thead>
          <tr className="bg-white text-black font-bold text-center border-b border-black h-[6mm]">
            <th
              className={`border border-black px-1 py-0 text-center font-bold ${
                isSplitTwoColumn ? 'w-[12%] text-[8.5px]' : 'w-[13%] text-[10px]'
              }`}
            >
              Quầy
            </th>
            <th
              className={`border border-black px-1.5 py-0 text-center font-bold ${
                isSplitTwoColumn ? 'w-[50%] text-[8.5px]' : 'w-[46%] text-[10px]'
              }`}
            >
              Tên Thu Ngân
            </th>
            <th
              className={`border border-black px-1 py-0 text-center font-bold ${
                isSplitTwoColumn ? 'w-[14%] text-[8px]' : 'w-[11%] text-[9.5px]'
              }`}
            >
              MÃ
            </th>
            <th
              className={`border border-black px-0.5 py-0 text-center font-bold ${
                isSplitTwoColumn ? 'w-[12%] text-[8px]' : 'w-[17%] text-[9.5px]'
              }`}
            >
              T
            </th>
            <th
              className={`border border-black px-1 py-0 text-center font-bold ${
                isSplitTwoColumn ? 'w-[12%] text-[8.5px]' : 'w-[13%] text-[10px]'
              }`}
            >
              Quầy
            </th>
          </tr>
        </thead>
        <tbody>
          {countersList.map((counter) => {
            const isSsc = isSscCounter(counter);
            const { numOnly } = getCounterDisplay(counter);
            const rows = getCounterUnifiedRows(
              counter.id,
              targetAssignment,
              compactEmptySubRows
            );

            return (
              <React.Fragment key={counter.id}>
                {rows.map((r, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{ height: `${rowHeightMm}mm` }}
                    className="border-t border-black"
                  >
                    {rIdx === 0 && (
                      <td
                        rowSpan={rows.length}
                        className="border border-black text-center font-bold px-0.5 py-0 align-middle bg-white text-black leading-none"
                      >
                        {isSsc ? (
                          <div className="flex flex-col items-center justify-center leading-none">
                            <span className={`${counterNumClass} font-black leading-none`}>
                              {numOnly}
                            </span>
                            <span
                              className={`${sscSubClass} font-semibold lowercase text-slate-800 leading-none mt-[1px]`}
                            >
                              ssc
                            </span>
                          </div>
                        ) : (
                          <div className={`${counterNumClass} font-black leading-none`}>
                            {counter.counterNumber}
                          </div>
                        )}
                      </td>
                    )}

                    <td
                      className={`border border-black px-1.5 py-0 text-left font-semibold leading-none truncate ${
                        isSplitTwoColumn ? 'max-w-[46mm]' : 'max-w-[82mm]'
                      } ${textSizeClass}`}
                    >
                      {r.name}
                    </td>
                    <td
                      className={`border border-black px-1 py-0 text-center font-bold leading-none ${
                        isSplitTwoColumn ? 'text-[8px]' : isDense ? 'text-[8.5px]' : 'text-[9.5px]'
                      }`}
                    >
                      {r.code}
                    </td>
                    <td
                      className={`border border-black px-0.5 py-0 text-center font-mono font-bold leading-none ${
                        isSplitTwoColumn ? 'text-[8px]' : isDense ? 'text-[8.5px]' : 'text-[9.5px]'
                      }`}
                    >
                      {r.t || ''}
                    </td>

                    {rIdx === 0 && (
                      <td
                        rowSpan={rows.length}
                        className="border border-black text-center font-bold px-0.5 py-0 align-middle bg-white text-black leading-none"
                      >
                        {isSsc ? (
                          <div className="flex flex-col items-center justify-center leading-none">
                            <span className={`${counterNumClass} font-black leading-none`}>
                              {numOnly}
                            </span>
                            <span
                              className={`${sscSubClass} font-semibold lowercase text-slate-800 leading-none mt-[1px]`}
                            >
                              ssc
                            </span>
                          </div>
                        ) : (
                          <div className={`${counterNumClass} font-black leading-none`}>
                            {counter.counterNumber}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderPageContent = (
    pageCounters: Counter[],
    targetAssignment: DayDwsAssignment | null,
    compactEmptySubRows: boolean
  ) => {
    if (splitMorningAfternoon) {
      return renderSplitShiftTable(pageCounters, targetAssignment);
    }

    const rowCounts = pageCounters.map(
      (c) => getCounterUnifiedRows(c.id, targetAssignment, compactEmptySubRows).length
    );
    const totalPageRows = rowCounts.reduce((a, b) => a + b, 0);

    if (totalPageRows <= 70) {
      const calculatedMm = Math.floor((254 / Math.max(1, totalPageRows)) * 10) / 10;
      const rowHeightMm = Math.min(5.0, Math.max(3.5, calculatedMm));
      return renderUnifiedSingleTable(
        pageCounters,
        targetAssignment,
        compactEmptySubRows,
        rowHeightMm,
        false
      );
    }

    const [leftCounters, rightCounters] = partitionCountersIntoPages(pageCounters, rowCounts, 2);
    const leftRows = leftCounters.reduce(
      (sum, c) =>
        sum + getCounterUnifiedRows(c.id, targetAssignment, compactEmptySubRows).length,
      0
    );
    const rightRows = rightCounters.reduce(
      (sum, c) =>
        sum + getCounterUnifiedRows(c.id, targetAssignment, compactEmptySubRows).length,
      0
    );
    const maxColRows = Math.max(leftRows, rightRows, 1);
    const colRowHeightMm = Math.min(
      5.0,
      Math.max(3.4, Math.floor((254 / maxColRows) * 10) / 10)
    );

    return (
      <div className="grid grid-cols-2 gap-[4mm] items-start w-full">
        <div>
          {renderUnifiedSingleTable(
            leftCounters,
            targetAssignment,
            compactEmptySubRows,
            colRowHeightMm,
            true
          )}
        </div>
        <div>
          {rightCounters.length > 0 &&
            renderUnifiedSingleTable(
              rightCounters,
              targetAssignment,
              compactEmptySubRows,
              colRowHeightMm,
              true
            )}
        </div>
      </div>
    );
  };

  return (
    <div id="dws-sheet-preview-wrapper" className="space-y-4">
      {/* Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 sticky top-4 z-20 no-print">
        <div className="flex items-center gap-3">
          {onBackToEdit && (
            <button
              type="button"
              id="btn-back-to-edit"
              onClick={onBackToEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại phân quầy
            </button>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900">Xem trước & Xuất DWS Thu Ngân</h2>
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              {previewMode === 'day' ? (
                <span>
                  {dayName} — {formatDisplayDate(date)} ({totalPages} trang A4)
                </span>
              ) : (
                <span>
                  Cả tuần: Thứ 2 ({formatDisplayDate(baseMonday)}) → Chủ Nhật (
                  {formatDisplayDate(addDaysToDateStr(baseMonday, 6))}) — Tổng cộng{' '}
                  <strong className="text-teal-700">{totalWeekPages} trang A4</strong> (2 trang A4/ngày)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View mode toggle + Split Shift toggle + Zoom controls + Export buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Toggle Chế độ xem: Ngày / Cả tuần */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              id="btn-preview-day-mode"
              onClick={() => setPreviewMode('day')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                previewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Xem ngày ({dayName})
            </button>
            <button
              type="button"
              id="btn-preview-week-mode"
              onClick={() => setPreviewMode('week')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                previewMode === 'week'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Xem cả tuần (7 ngày)
            </button>
          </div>

          {/* Toggle Chia 2 cột Sáng / Chiều */}
          <button
            type="button"
            id="btn-toggle-split-shift-cols"
            role="switch"
            aria-checked={splitMorningAfternoon}
            onClick={toggleSplitMorningAfternoon}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              splitMorningAfternoon
                ? 'bg-sky-50 text-sky-900 border-sky-300 shadow-2xs hover:bg-sky-100/70'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={
              splitMorningAfternoon
                ? 'Đang BẬT: Chia 2 cột Sáng (trái) / Chiều (phải). Bấm để về dạng chung 1 cột như cũ.'
                : 'Đang TẮT: Hiển thị chung 1 cột như cũ. Bấm để bật chia 2 cột Sáng / Chiều.'
            }
          >
            <Columns2 className="w-3.5 h-3.5 text-sky-700" />
            <span>Chia Sáng/Chiều</span>
            <span
              className={`inline-flex items-center w-7 h-4 rounded-full p-0.5 transition-colors ${
                splitMorningAfternoon ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
            </span>
          </button>

          {/* Zoom controls */}
          <div className="hidden md:flex items-center bg-slate-100 rounded-xl p-1 text-xs font-semibold text-slate-700">
            <button
              type="button"
              onClick={() => handleZoomChange(-25)}
              className="p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 min-w-[50px] text-center">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => handleZoomChange(25)}
              className="p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1.5 hover:bg-white rounded-lg transition-colors ml-1 cursor-pointer"
              title="Về 100%"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Print button */}
          <button
            type="button"
            id="btn-print-dws"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            title={previewMode === 'week' ? 'In toàn bộ 7 ngày DWS tuần' : `In DWS ${dayName}`}
          >
            <Printer className="w-4 h-4" />
            {previewMode === 'week' ? 'In cả tuần' : 'In ngày này'}
          </button>

          {/* Excel Export Buttons */}
          <div className="inline-flex items-center rounded-lg border border-emerald-600/30 overflow-hidden shadow-2xs">
            <button
              type="button"
              id="btn-download-excel-primary"
              onClick={previewMode === 'week' ? handleDownloadExcelWeekly : handleDownloadExcelDaily}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              title={
                previewMode === 'week'
                  ? 'Tải file Excel cả tuần gồm 7 sheets (MON -> SUN) và sheet FOLLOW'
                  : `Tải file Excel ngày ${dayName}`
              }
            >
              <FileSpreadsheet className="w-4 h-4" />
              {previewMode === 'week' ? 'Tải Excel tuần (7 ngày + FOLLOW)' : 'Tải Excel ngày này'}
            </button>

            {previewMode === 'day' && (
              <button
                type="button"
                onClick={handleDownloadExcelWeekly}
                className="px-2.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-emerald-100 text-xs font-semibold border-l border-emerald-600 transition-colors cursor-pointer"
                title="Tải Excel cả tuần (7 sheets MON..SUN + sheet FOLLOW)"
              >
                + Cả tuần
              </button>
            )}
            {previewMode === 'week' && (
              <button
                type="button"
                onClick={handleDownloadExcelDaily}
                className="px-2.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-emerald-100 text-xs font-semibold border-l border-emerald-600 transition-colors cursor-pointer"
                title={`Tải riêng Excel ngày ${dayName}`}
              >
                Riêng {dayName}
              </button>
            )}
          </div>

          {/* PDF Download Button */}
          <button
            type="button"
            id="btn-download-pdf"
            disabled={isExporting}
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
            title={
              previewMode === 'week'
                ? 'Xuất và tải PDF toàn bộ 7 ngày trong tuần'
                : `Xuất và tải PDF ngày ${dayName}`
            }
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting
              ? exportProgressText || 'Đang xuất PDF...'
              : previewMode === 'week'
              ? `Xuất PDF cả tuần (${totalWeekPages} trang)`
              : `Xuất PDF ngày này (${totalPages} trang)`}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📄 KHU VỰC BẢN IN DWS                                                      */}
      {/* TIÊU ĐỀ BẢN IN: DWS AEON HAI PHONG LE CHAN - {THỨ}(dd/mm/yyyy)            */}
      {/* ========================================================================= */}
      <div className="flex flex-col items-center gap-8 py-6 bg-slate-200/70 rounded-2xl p-2 sm:p-6 overflow-x-auto">
        {previewMode === 'day' ? (
          // ==================== CHẾ ĐỘ XEM 1 NGÀY ====================
          currentDayPlan.pages.map((pageCounters, pageIdx) => (
            <div
              key={pageIdx}
              style={{
                transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                transformOrigin: 'top center',
              }}
            >
              <div
                id={`dws-pdf-page-${pageIdx + 1}`}
                style={{
                  width: '210mm',
                  height: '297mm',
                  padding: '8mm 10mm',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
                className="print-page dws-pdf-page bg-white shadow-2xl rounded-sm text-black border border-slate-300 font-sans leading-tight mb-4"
              >
                <div className="mb-[2.5mm] text-center">
                  <h1 className="text-[13px] font-black uppercase tracking-wider text-black leading-tight">
                    {getPdfTitle(dayName, date)}
                    {totalPages > 1 && (
                      <span className="text-[11px] font-bold text-slate-700 ml-2">
                        (Trang {pageIdx + 1}/{totalPages})
                      </span>
                    )}
                  </h1>
                </div>

                {renderPageContent(pageCounters, assignment, currentDayPlan.compactEmptySubRows)}
              </div>
            </div>
          ))
        ) : (
          // ==================== CHẾ ĐỘ XEM CẢ TUẦN (7 NGÀY: T2 -> CN) ====================
          weekDays.map((dayItem) => {
            const { pages: dayCountersPages, compactEmptySubRows, isWeekend } = dayItem.plan;
            const dayPageCount = dayCountersPages.length;

            return (
              <div key={dayItem.date} className="w-full flex flex-col items-center gap-6">
                <div className="no-print flex flex-wrap items-center justify-between gap-2 w-full max-w-[210mm] px-4 py-2 text-xs font-bold text-teal-900 bg-teal-50/90 border border-teal-200 rounded-xl shadow-2xs mt-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full inline-block ${
                        isWeekend ? 'bg-sky-600' : 'bg-teal-600'
                      }`}
                    />
                    <span>
                      {dayItem.dayName} — Ngày {formatDisplayDate(dayItem.date)}
                    </span>
                    {isWeekend && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                        Cuối tuần
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-teal-700 font-extrabold">
                      {dayPageCount} trang A4
                    </span>
                  </div>
                </div>

                {dayCountersPages.map((pageCounters, pageIdx) => (
                  <div
                    key={`${dayItem.date}-p-${pageIdx}`}
                    style={{
                      transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                      transformOrigin: 'top center',
                    }}
                  >
                    <div
                      id={`dws-pdf-page-${dayItem.date}-${pageIdx + 1}`}
                      style={{
                        width: '210mm',
                        height: '297mm',
                        padding: '8mm 10mm',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
                      className="print-page dws-pdf-page bg-white shadow-2xl rounded-sm text-black border border-slate-300 font-sans leading-tight mb-4"
                    >
                      <div className="mb-[2.5mm] text-center">
                        <h1 className="text-[13px] font-black uppercase tracking-wider text-black leading-tight">
                          {getPdfTitle(dayItem.dayName, dayItem.date)}
                          {dayPageCount > 1 && (
                            <span className="text-[11px] font-bold text-slate-700 ml-2">
                              (Trang {pageIdx + 1}/{dayPageCount})
                            </span>
                          )}
                        </h1>
                      </div>

                      {renderPageContent(pageCounters, dayItem.assignment, compactEmptySubRows)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Warning confirmation before export if unassigned > 0 */}
      <ConfirmDialog
        isOpen={isExportWarningOpen}
        onClose={() => setIsExportWarningOpen(false)}
        onConfirm={() => {
          setIsExportWarningOpen(false);
          if (pendingAction === 'download') executeDownload();
          if (pendingAction === 'print') executePrint();
        }}
        title="Xác nhận xuất DWS"
        message={
          <div>
            Hệ thống phát hiện vẫn còn <strong>{unassignedCount} nhân viên</strong> chưa được phân quầy trong ngày này.
            <br />
            Bạn có chắc chắn muốn tiếp tục xuất DWS không?
          </div>
        }
        confirmText="Tiếp tục xuất"
        cancelText="Quay lại phân quầy"
        type="warning"
      />
    </div>
  );
};
