import jsPDF from 'jspdf';
import { toJpeg, toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { Counter, DayDwsAssignment, Shift, WeeklyScheduleEntry } from '../types';

export interface PdfExportOptions {
  date: string;
  dayName: string;
  weekId: string;
  counters: Counter[];
  assignment: DayDwsAssignment | null;
  shifts: Shift[];
  weeklySchedule?: WeeklyScheduleEntry[];
  storeName?: string;
  isWeek?: boolean;
  onProgress?: (current: number, total: number) => void;
}

// Helper to capture DOM element as image data without throwing cssRules security error
async function captureElementToImage(element: HTMLElement): Promise<string> {
  const options = {
    quality: 0.95,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    skipFonts: true,
    fontEmbedCSS: '',
    cacheBust: false,
  };

  try {
    return await toJpeg(element, options);
  } catch (err) {
    try {
      return await toPng(element, { ...options, quality: 1 });
    } catch (err2) {
      console.warn('html-to-image failed, falling back to html2canvas:', err2);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return canvas.toDataURL('image/jpeg', 0.95);
    }
  }
}

export const pdfService = {
  // Capture high-resolution DOM pages to PDF (matches exact visual styling)
  async downloadPdfFromDom(
    filename?: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<boolean> {
    const pageElements = Array.from(document.querySelectorAll('.dws-pdf-page')) as HTMLElement[];
    let pages = pageElements;

    if (pages.length === 0) {
      const page1 = document.getElementById('dws-pdf-page-1');
      const page2 = document.getElementById('dws-pdf-page-2');
      pages = [page1, page2].filter(Boolean) as HTMLElement[];
    }

    if (pages.length === 0) {
      throw new Error('Không tìm thấy nội dung trang DWS để xuất PDF');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < pages.length; i++) {
      if (onProgress) {
        onProgress(i + 1, pages.length);
      }
      const pageEl = pages[i];
      if (i > 0) {
        doc.addPage('a4', 'portrait');
      }

      const imgData = await captureElementToImage(pageEl);
      if (imgData) {
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
    }

    const safeName =
      filename || `DWS_AEON_HAI_PHONG_LE_CHAN_${new Date().toISOString().split('T')[0]}.pdf`;

    // Save PDF
    doc.save(safeName);

    // Also offer direct Blob trigger fallback for sandboxed iframe environments
    try {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = safeName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch {
      // doc.save already called
    }

    return true;
  },

  // Save PDF to file with meaningful name
  async downloadPdf(options: PdfExportOptions): Promise<boolean> {
    const safeDate = options.date.replace(/[^0-9]/g, '-');
    const safeDay = options.dayName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
    const filename = options.isWeek
      ? `DWS_AEON_HAI_PHONG_LE_CHAN_Tuan_${options.weekId}.pdf`
      : `DWS_AEON_HAI_PHONG_LE_CHAN_${safeDay}_${safeDate}.pdf`;

    return await this.downloadPdfFromDom(filename, options.onProgress);
  },

  // Capture modified shifts report DOM container to PDF
  async downloadModifiedShiftsPdf(
    weekId?: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<boolean> {
    const pageElements = Array.from(
      document.querySelectorAll('.modified-shifts-pdf-page')
    ) as HTMLElement[];
    let pages = pageElements;

    if (pages.length === 0) {
      const pageEl = document.getElementById('modified-shifts-pdf-container');
      if (pageEl) pages = [pageEl];
    }

    if (pages.length === 0) {
      throw new Error('Không tìm thấy nội dung bảng ca đã chỉnh sửa để xuất PDF');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < pages.length; i++) {
      if (onProgress) {
        onProgress(i + 1, pages.length);
      }
      const pageEl = pages[i];
      if (i > 0) {
        doc.addPage('a4', 'portrait');
      }

      const imgData = await captureElementToImage(pageEl);
      if (imgData) {
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
    }

    const safeWeek = (weekId || new Date().toISOString().split('T')[0]).replace(/[^0-9a-zA-Z]/g, '_');
    const safeName = `DS_Ca_Da_Dieu_Chinh_Tuan_${safeWeek}.pdf`;

    doc.save(safeName);

    try {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = safeName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch {
      // doc.save already called
    }

    return true;
  },

  // Direct print with standard print dialog and fallback
  printPdf(): void {
    try {
      window.print();
    } catch (e) {
      console.warn('window.print blocked or failed:', e);
      // Try printing via focused window
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error('Print failed:', err);
      }
    }
  },
};
