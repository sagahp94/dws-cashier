import React, { useState, useMemo } from 'react';
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
  const [isExportWarningOpen, setIsExportWarningOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'download' | 'print' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState<string>('');

  const baseMonday = currentMonday || weekId;

  // Sort counters by order
  const sortedCounters = useMemo(() => {
    return [...counters].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [counters]);

  // Check if a counter is SSC (Self-service checkout)
  const isSscCounter = (c: Counter) => {
    const num = (c.counterNumber || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    return num.includes('ssc') || id.includes('ssc') || ['1', '2', '3', '4'].includes((c.counterNumber || '').trim());
  };

  // Get display text for counter number
  const getCounterDisplay = (c: Counter) => {
    const isSsc = isSscCounter(c);
    const numOnly = (c.counterNumber || '').replace(/ssc/gi, '').trim();
    return { isSsc, numOnly: numOnly || c.counterNumber };
  };

  // Dynamic pagination: 12 counters per A4 page (48 rows per page)
  const COUNTERS_PER_PAGE = 12;
  const pages = useMemo(() => {
    const chunks: Counter[][] = [];
    for (let i = 0; i < sortedCounters.length; i += COUNTERS_PER_PAGE) {
      chunks.push(sortedCounters.slice(i, i + COUNTERS_PER_PAGE));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [sortedCounters]);

  const totalPages = pages.length;

  // 7 days of the week: Thứ 2 -> Chủ Nhật
  const weekDays = useMemo(() => {
    const dayNamesList = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const dStr = addDaysToDateStr(baseMonday, i);
      return {
        index: i,
        date: dStr,
        dayName: dayNamesList[i],
        assignment: assignmentsMap[dStr] || (dStr === date ? assignment : null),
      };
    });
  }, [baseMonday, assignmentsMap, date, assignment]);

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
          ? 'Đã xuất và tải xuống file PDF DWS cả tuần (7 ngày) thành công!'
          : 'Đã xuất và tải xuống file PDF DWS ngày thành công!'
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

  // Render the standard 5-column cashier assignment table for a given day
  const renderTableForCounters = (
    countersList: Counter[],
    targetAssignment: DayDwsAssignment | null
  ) => (
    <table className="w-full max-w-[540px] mx-auto border-collapse border border-black text-[10px]">
      <thead>
        <tr className="bg-white text-black font-bold text-center border-b border-black h-7">
          <th className="border border-black px-1 py-0.5 w-[14%] text-center font-bold text-[10px]">Quầy</th>
          <th className="border border-black px-2 py-0.5 w-[44%] text-center font-bold text-[10px]">Tên Thu Ngân</th>
          <th className="border border-black px-1 py-0.5 w-[10%] text-center font-bold text-[9.5px]">MÃ</th>
          <th className="border border-black px-0.5 py-0.5 w-[18%] text-center font-bold text-[9.5px]">T</th>
          <th className="border border-black px-1 py-0.5 w-[14%] text-center font-bold text-[10px]">Quầy</th>
        </tr>
      </thead>
      <tbody>
        {countersList.map((counter) => {
          const ca = targetAssignment?.assignments?.[counter.id];
          const isSsc = isSscCounter(counter);
          const { numOnly } = getCounterDisplay(counter);

          // Dòng 1: Ca Sáng
          const row0 = {
            name: ca?.morning?.employeeName || '',
            code: ca?.morning?.shiftCode || '',
            t: ca?.morning ? '##' : '',
          };
          // Dòng 2: Ca Sáng 2 (hoặc trống)
          const row1 = {
            name: ca?.morning2?.employeeName || '',
            code: ca?.morning2?.shiftCode || '',
            t: ca?.morning2 ? '##' : '',
          };
          // Dòng 3: Ca Tối / Chiều
          const row2 = {
            name: ca?.afternoon?.employeeName || '',
            code: ca?.afternoon?.shiftCode || '',
            t: ca?.afternoon ? '##' : '',
          };
          // Dòng 4: Ca Tối 2 (hoặc trống)
          const row3 = {
            name: ca?.afternoon2?.employeeName || '',
            code: ca?.afternoon2?.shiftCode || '',
            t: ca?.afternoon2 ? '##' : '',
          };

          const rows = [row0, row1, row2, row3];

          return (
            <React.Fragment key={counter.id}>
              {rows.map((r, rIdx) => (
                <tr key={rIdx} className="border-t border-black h-[5.2mm]">
                  {rIdx === 0 && (
                    <td
                      rowSpan={4}
                      className="border border-black text-center font-bold px-1 align-middle bg-white text-black leading-tight"
                    >
                      {isSsc ? (
                        <>
                          <div className="text-[12px] font-black">{numOnly}</div>
                          <div className="text-[9px] font-semibold lowercase text-slate-800">ssc</div>
                        </>
                      ) : (
                        <div className="text-[12px] font-black">{counter.counterNumber}</div>
                      )}
                    </td>
                  )}

                  <td className="border border-black px-2 text-left font-semibold text-[10px] truncate max-w-[220px]">
                    {r.name}
                  </td>
                  <td className="border border-black px-1 text-center font-bold text-[9.5px]">
                    {r.code}
                  </td>
                  <td className="border border-black px-0.5 text-center font-mono font-bold text-[9.5px]">
                    {r.t}
                  </td>

                  {rIdx === 0 && (
                    <td
                      rowSpan={4}
                      className="border border-black text-center font-bold px-1 align-middle bg-white text-black leading-tight"
                    >
                      {isSsc ? (
                        <>
                          <div className="text-[12px] font-black">{numOnly}</div>
                          <div className="text-[9px] font-semibold lowercase text-slate-800">ssc</div>
                        </>
                      ) : (
                        <div className="text-[12px] font-black">{counter.counterNumber}</div>
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">Xem trước & Xuất DWS Thu Ngân</h2>
            </div>
            <div className="text-xs text-slate-500">
              {previewMode === 'day' ? (
                <>
                  {dayName} — {formatDisplayDate(date)} ({totalPages} trang A4)
                </>
              ) : (
                <>
                  Cả tuần: Thứ 2 ({formatDisplayDate(baseMonday)}) → Chủ Nhật (
                  {formatDisplayDate(addDaysToDateStr(baseMonday, 6))}) — Tổng cộng {weekDays.length * totalPages} trang A4
                </>
              )}
            </div>
          </div>
        </div>

        {/* View mode toggle + Zoom controls + Export buttons */}
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

            {/* Quick alternate Excel option */}
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
              ? 'Xuất PDF cả tuần (7 ngày)'
              : 'Xuất PDF ngày này'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📄 KHU VỰC BẢN IN DWS (CÁC TRANG A4 THEO ĐÚNG MẪU CHUẨN 4 DÒNG/QUẦY) */}
      {/* TIÊU ĐỀ BẢN IN: DWS AEON HAI PHONG LE CHAN - {THỨ}(dd/mm/yyyy)            */}
      {/* ========================================================================= */}
      <div className="flex flex-col items-center gap-8 py-6 bg-slate-200/70 rounded-2xl p-2 sm:p-6 overflow-x-auto">
        {previewMode === 'day' ? (
          // ==================== CHẾ ĐỘ XEM 1 NGÀY ====================
          pages.map((pageCounters, pageIdx) => (
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
                  minHeight: '297mm',
                  boxSizing: 'border-box',
                }}
                className="print-page dws-pdf-page bg-white shadow-2xl rounded-sm p-4 sm:p-6 text-black border border-slate-300 font-sans leading-tight mb-4"
              >
                {/* TIÊU ĐỀ BẢN IN THEO ĐÚNG QUY CHUẨN: DWS AEON HAI PHONG LE CHAN - {THỨ}(dd/mm/yyyy) */}
                <div className="mb-2.5 text-center">
                  <h1 className="text-[13.5px] font-black uppercase tracking-wider text-black">
                    {getPdfTitle(dayName, date)}
                    {totalPages > 1 && (
                      <span className="text-[11.5px] font-bold text-slate-700 ml-2">
                        (Trang {pageIdx + 1}/{totalPages})
                      </span>
                    )}
                  </h1>
                </div>

                {renderTableForCounters(pageCounters, assignment)}
              </div>
            </div>
          ))
        ) : (
          // ==================== CHẾ ĐỘ XEM CẢ TUẦN (7 NGÀY: T2 -> CN) ====================
          weekDays.map((dayItem) => {
            const dayCountersPages = pages;
            return (
              <div key={dayItem.date} className="w-full flex flex-col items-center gap-6">
                {/* Dải phân cách ngày (chỉ hiển thị trên màn hình xem trước, tự động ẩn khi in/xuất PDF) */}
                <div className="no-print flex items-center justify-between w-full max-w-[210mm] px-4 py-2 text-xs font-bold text-teal-900 bg-teal-50/90 border border-teal-200 rounded-xl shadow-2xs mt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                    <span>
                      {dayItem.dayName} — Ngày {formatDisplayDate(dayItem.date)}
                    </span>
                  </div>
                  <span className="text-teal-700">
                    {dayCountersPages.length} trang A4
                  </span>
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
                        minHeight: '297mm',
                        boxSizing: 'border-box',
                      }}
                      className="print-page dws-pdf-page bg-white shadow-2xl rounded-sm p-4 sm:p-6 text-black border border-slate-300 font-sans leading-tight mb-4"
                    >
                      {/* TIÊU ĐỀ BẢN IN TỪNG NGÀY TRONG TUẦN: DWS AEON HAI PHONG LE CHAN - {THỨ}(dd/mm/yyyy) */}
                      <div className="mb-2.5 text-center">
                        <h1 className="text-[13.5px] font-black uppercase tracking-wider text-black">
                          {getPdfTitle(dayItem.dayName, dayItem.date)}
                          {totalPages > 1 && (
                            <span className="text-[11.5px] font-bold text-slate-700 ml-2">
                              (Trang {pageIdx + 1}/{totalPages})
                            </span>
                          )}
                        </h1>
                      </div>

                      {renderTableForCounters(pageCounters, dayItem.assignment)}
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
