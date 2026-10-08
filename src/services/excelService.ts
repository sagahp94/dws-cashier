import * as XLSX from 'xlsx';
import {
  Shift,
  Counter,
  Employee,
  WeeklyScheduleEntry,
  ImportPreviewResult,
  ImportPreviewRow,
  ShiftCategory,
  DayDwsAssignment,
} from '../types';
import {
  addDaysToDateStr,
  formatDateToYMD,
  getDayOfWeekIndex,
  parseYMDToLocalDate,
  getMondayOfWeek,
} from '../utils/dateUtils';
import {
  extractCleaningDutyAssignments,
  JOB_CODES_LIST,
} from './cleaningDutiesService';

// Helper: Normalize string for fuzzy header matching
function normalizeHeader(str: string): string {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Helper: Parse time string to HH:mm
export function normalizeTime(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    // Check if it's a fractional day (e.g. 0.33333 = 08:00) or hours (e.g. 8 or 8.5)
    if (val > 0 && val < 1) {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const mins = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    } else if (val >= 1 && val <= 24) {
      const hours = Math.floor(val);
      const mins = Math.round((val - hours) * 60);
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
  }
  if (val instanceof Date) {
    const hours = val.getHours();
    const mins = val.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  const str = String(val).trim();
  if (!str) return '';

  // Handle formats like "8h", "8:00", "08h30", "8.30", "08:00:00", "8H00", "8h 30"
  const match = str.match(/(\d{1,2})[:h.hH\s](\d{1,2})?/);
  if (match) {
    const hours = Math.min(23, parseInt(match[1], 10));
    const mins = match[2] ? Math.min(59, parseInt(match[2], 10)) : 0;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  if (/^\d{1,2}$/.test(str)) {
    const h = Math.min(23, parseInt(str, 10));
    return `${h.toString().padStart(2, '0')}:00`;
  }
  return str;
}

// Helper: Parse time range from single or pair values (e.g. "8:00 - 16:30", "8h-16h", "8h30 đến 17h")
export function parseTimePair(startTimeVal: any, endTimeVal: any): { startTime: string; endTime: string } {
  const startStr = String(startTimeVal || '').trim();
  const endStr = String(endTimeVal || '').trim();

  // If startStr contains a range delimiter
  if (startStr.includes('-') || startStr.includes('~') || startStr.includes('đến') || startStr.includes('den') || startStr.includes('->') || startStr.includes('—')) {
    const parts = startStr.split(/[-~—]|đến|den|->/i);
    if (parts.length >= 2) {
      return {
        startTime: normalizeTime(parts[0]),
        endTime: normalizeTime(parts[1]),
      };
    }
  }

  // If separate columns were provided
  return {
    startTime: normalizeTime(startTimeVal),
    endTime: normalizeTime(endTimeVal),
  };
}

// Helper: Format date string to YYYY-MM-DD
export function normalizeDate(val: any, baseMondayDate?: string): string {
  if (!val) return '';
  if (val instanceof Date) {
    return formatDateToYMD(val);
  }
  if (typeof val === 'number') {
    // Excel date serial number
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return `${parsed.y}-${parsed.m.toString().padStart(2, '0')}-${parsed.d.toString().padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  // Check if string is already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // If user passed day of week (Thứ 2, Thu 2, T2, Mon, CN, Chủ Nhật) and we have baseMondayDate
  if (baseMondayDate) {
    const dayMap: Record<string, number> = {
      't2': 0, 'thu2': 0, 'thuhai': 0, 'thu 2': 0, 'thu hai': 0, '2': 0, 'mon': 0, 'monday': 0,
      't3': 1, 'thu3': 1, 'thuba': 1, 'thu 3': 1, 'thu ba': 1, '3': 1, 'tue': 1, 'tuesday': 1,
      't4': 2, 'thu4': 2, 'thutu': 2, 'thu 4': 2, 'thu tu': 2, '4': 2, 'wed': 2, 'wednesday': 2,
      't5': 3, 'thu5': 3, 'thunam': 3, 'thu 5': 3, 'thu nam': 3, '5': 3, 'thu': 3, 'thursday': 3,
      't6': 4, 'thu6': 4, 'thusau': 4, 'thu 6': 4, 'thu sau': 4, '6': 4, 'fri': 4, 'friday': 4,
      't7': 5, 'thu7': 5, 'thubay': 5, 'thu 7': 5, 'thu bay': 5, '7': 5, 'sat': 5, 'saturday': 5,
      'cn': 6, 'chunhat': 6, 'chu nhat': 6, 'cnhat': 6, 'c.nhat': 6, 't8': 6, 'thu8': 6, '8': 6, 'sun': 6, 'sunday': 6,
    };
    const norm = normalizeHeader(str);
    if (norm in dayMap) {
      return addDaysToDateStr(baseMondayDate, dayMap[norm]);
    }
  }
  return str;
}

// Helper: Check if shift is an OFF / Leave shift
export function isOffShift(
  shiftCode?: string,
  shiftType?: string,
  startTime?: string,
  endTime?: string
): boolean {
  const rawCode = String(shiftCode || '').trim();
  const rawType = String(shiftType || '').trim();
  const codeUpper = rawCode.toUpperCase();

  // Common off / leave codes in Vietnamese retail & schedules
  const exactOffCodes = new Set([
    'OFF', 'P', 'AL', 'RO', 'CO', 'DO', 'CL', 'SL', 'ML', 'UL', 'KL', 'NB', 'NL', 'NO', 'NP', 'NT', 'TS', 'N', 'O', 'K', 'KO', 'UP', 'PL', 'VANG'
  ]);
  if (exactOffCodes.has(codeUpper)) return true;

  // Patterns like OFF1, OFF2, OFF_SANG, OFF_CHIEU, OFF-1, RO1, AL-1, P_NAM
  if (/^OFF[\w\-\s]*$/i.test(codeUpper) || /^RO[\w\-\s]*$/i.test(codeUpper) || /^AL[\w\-\s]*$/i.test(codeUpper)) {
    return true;
  }

  // Normalize Vietnamese diacritics for text search
  const normType = rawType
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

  const normCode = rawCode
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

  const offKeywords = [
    'nghi',        // nghỉ, nghỉ phép, ca nghỉ, nghỉ lễ, nghỉ bù, nghỉ tuần
    'off',         // off, day off
    'phep',        // phép, phép năm
    'leave',       // annual leave, sick leave
    'vang',        // vắng mặt
    'le',          // lễ, nghỉ lễ
    'khong luong', // không lương
    'thai san',    // thai sản
    'om',          // nghỉ ốm
    'bu',          // nghỉ bù
    'che do',      // nghỉ chế độ
    'roster',      // roster off
    'dayoff',
    'holiday',
    'vacation',
  ];

  for (const kw of offKeywords) {
    if (normType.includes(kw) || normCode.includes(kw)) {
      return true;
    }
  }

  // If time is completely empty or "00:00 - 00:00" and type implies off or is empty with off-like pattern
  const hasTime = !!(startTime && String(startTime).trim() && startTime !== '00:00' && startTime !== '-') ||
                  !!(endTime && String(endTime).trim() && endTime !== '00:00' && endTime !== '-');
  if (!hasTime && (normType.includes('nghi') || normType === 'off' || normType === 'n' || normCode === 'n')) {
    return true;
  }

  return false;
}

// Classify Shift
export function classifyShiftCategory(
  shiftType: string,
  startTime: string,
  shiftCode?: string,
  endTime?: string
): ShiftCategory {
  if (isOffShift(shiftCode, shiftType, startTime, endTime)) {
    return 'off';
  }

  if (!startTime) return 'morning';
  const hour = parseInt(startTime.split(':')[0] || '8', 10);
  if (hour < 12) {
    return 'morning';
  } else {
    return 'afternoon';
  }
}

// Helper to parse 'o' (có) / 'x' (không) convention
export function parseOxBoolean(val: any, defaultValue = false): boolean {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;

  const str = String(val).trim().toLowerCase();
  if (!str) return defaultValue;

  // Exact matches
  if (str === 'o' || str === '0' || str === 'có' || str === 'co' || str === 'v' || str === 'yes' || str === 'true' || str === '1' || str === 'x' && false) {
    return true;
  }
  if (str === 'x' || str === 'không' || str === 'khong' || str === 'no' || str === 'false' || str === '0' || str === '-') {
    return false;
  }

  // Common variations: if string starts with 'o' or 'có' or 'sup'
  if (str.startsWith('o') || str.startsWith('co') || str.includes('có') || str.includes('sup')) {
    return true;
  }
  if (str.startsWith('x') || str.startsWith('kh') || str.includes('không')) {
    return false;
  }

  return defaultValue;
}

export const excelService = {
  // Read Excel File to Raw JSON with multi-sheet detection
  async parseRawFile(
    file: File,
    sheetIndexOrName?: number | string
  ): Promise<{ sheetNames: string[]; activeSheet: string; data: any[][]; rawHeaders: string[] }> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { sheetNames: [], activeSheet: '', data: [], rawHeaders: [] };
    }

    // Determine target sheet
    let targetSheetName = workbook.SheetNames[0];
    if (typeof sheetIndexOrName === 'string' && workbook.SheetNames.includes(sheetIndexOrName)) {
      targetSheetName = sheetIndexOrName;
    } else if (typeof sheetIndexOrName === 'number' && workbook.SheetNames[sheetIndexOrName]) {
      targetSheetName = workbook.SheetNames[sheetIndexOrName];
    } else {
      // Find the sheet that has the most non-empty rows
      let maxDataLen = -1;
      for (const name of workbook.SheetNames) {
        const ws = workbook.Sheets[name];
        if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        const nonBlank = rows.filter(
          (r) => r && r.some((c) => c !== undefined && c !== null && String(c).trim() !== '')
        );
        if (nonBlank.length > maxDataLen) {
          maxDataLen = nonBlank.length;
          targetSheetName = name;
        }
      }
    }

    const worksheet = workbook.Sheets[targetSheetName];
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
      return { sheetNames: workbook.SheetNames, activeSheet: targetSheetName, data: [], rawHeaders: [] };
    }

    // Find the header row (row with most non-empty string cells in first 20 rows)
    let headerRowIdx = 0;
    let maxCols = 0;
    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i] || [];
      const validCols = row.filter((c: any) => c !== undefined && c !== null && String(c).trim() !== '').length;
      if (validCols > maxCols) {
        maxCols = validCols;
        headerRowIdx = i;
      }
    }

    const rawHeaders = (jsonData[headerRowIdx] || []).map((h: any) => String(h || '').trim());
    const dataRows = jsonData.slice(headerRowIdx + 1);

    return {
      sheetNames: workbook.SheetNames,
      activeSheet: targetSheetName,
      data: dataRows,
      rawHeaders,
    };
  },

  // Parse SHIFTS catalog
  parseShifts(
    rawHeaders: string[],
    dataRows: any[][],
    existingShifts: Shift[] = []
  ): ImportPreviewResult {
    const headerMap: Record<string, number> = {};
    rawHeaders.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      if (
        norm.includes('maca') ||
        norm.includes('shiftcode') ||
        norm.includes('ca') ||
        norm.includes('code') ||
        norm.includes('kyhieu') ||
        norm.includes('tenca')
      ) {
        if (!('shiftCode' in headerMap)) headerMap['shiftCode'] = idx;
      }
      if (
        norm.includes('giobatdau') ||
        norm.includes('batdau') ||
        norm.includes('start') ||
        norm.includes('bd') ||
        norm.includes('tu') ||
        norm.includes('tugio') ||
        norm.includes('timestart')
      ) {
        headerMap['startTime'] = idx;
      }
      if (
        norm.includes('gioketthuc') ||
        norm.includes('ketthuc') ||
        norm.includes('end') ||
        norm.includes('kt') ||
        norm.includes('den') ||
        norm.includes('dengio') ||
        norm.includes('timeend')
      ) {
        headerMap['endTime'] = idx;
      }
      if (
        norm.includes('thoigian') ||
        norm.includes('khunggio') ||
        norm.includes('giolam') ||
        norm.includes('workinghours') ||
        norm.includes('hours')
      ) {
        if (!('timeRange' in headerMap)) headerMap['timeRange'] = idx;
      }
      if (
        norm.includes('loaica') ||
        norm.includes('type') ||
        norm.includes('phanloai') ||
        norm.includes('ghichu') ||
        norm.includes('loai') ||
        norm.includes('mota') ||
        norm.includes('note')
      ) {
        headerMap['shiftType'] = idx;
      }
    });

    const existingCodeSet = new Set(existingShifts.map((s) => s.shiftCode.toUpperCase()));
    const seenInFile = new Set<string>();
    const rows: ImportPreviewRow[] = [];
    const parsedData: Shift[] = [];

    let validRows = 0;
    let errorRows = 0;
    let duplicateRows = 0;
    let newRows = 0;

    dataRows.forEach((row, index) => {
      // Skip completely empty rows
      if (row.every((c) => c === undefined || c === null || String(c).trim() === '')) return;

      const rowNumber = index + 2; // 1-based, accounts for header
      const shiftCodeRaw = headerMap['shiftCode'] !== undefined ? row[headerMap['shiftCode']] : row[0];
      const shiftTypeRaw = headerMap['shiftType'] !== undefined ? row[headerMap['shiftType']] : (row[3] || row[2]);

      let startTimeRaw = headerMap['startTime'] !== undefined ? row[headerMap['startTime']] : undefined;
      let endTimeRaw = headerMap['endTime'] !== undefined ? row[headerMap['endTime']] : undefined;

      if (startTimeRaw === undefined && headerMap['timeRange'] !== undefined) {
        startTimeRaw = row[headerMap['timeRange']];
      }
      if (startTimeRaw === undefined) {
        startTimeRaw = row[1];
      }
      if (endTimeRaw === undefined) {
        endTimeRaw = row[2];
      }

      const shiftCode = String(shiftCodeRaw || '').trim().toUpperCase();
      const timePair = parseTimePair(startTimeRaw, endTimeRaw);
      const startTime = timePair.startTime;
      const endTime = timePair.endTime;

      const isOff = isOffShift(shiftCode, shiftTypeRaw, startTime, endTime);

      const shiftType =
        String(shiftTypeRaw || '').trim() || (isOff ? 'Ca Nghỉ' : 'Ca thường');

      const errors: string[] = [];
      if (!shiftCode) {
        errors.push('Thiếu Mã ca');
      }

      const category: ShiftCategory = isOff
        ? 'off'
        : classifyShiftCategory(shiftType, startTime, shiftCode, endTime);

      const parsed: Shift = {
        shiftCode,
        startTime: isOff ? '' : startTime,
        endTime: isOff ? '' : endTime,
        shiftType,
        category,
        isOff,
      };

      const isDuplicate = shiftCode ? (existingCodeSet.has(shiftCode) || seenInFile.has(shiftCode)) : false;
      const isValid = errors.length === 0;

      if (shiftCode) seenInFile.add(shiftCode);

      if (isValid) {
        validRows++;
        parsedData.push(parsed);
        if (isDuplicate) duplicateRows++;
        else newRows++;
      } else {
        errorRows++;
      }

      const rawObj: Record<string, any> = {};
      rawHeaders.forEach((h, i) => {
        rawObj[h || `Cột ${i + 1}`] = row[i] ?? '';
      });

      rows.push({
        rowNumber,
        raw: rawObj,
        parsed,
        isValid,
        isDuplicate,
        errors,
      });
    });

    return {
      fileName: '',
      totalRows: rows.length,
      validRows,
      errorRows,
      duplicateRows,
      newRows,
      rows,
      headers: ['Mã ca', 'Giờ bắt đầu', 'Giờ kết thúc', 'Loại ca', 'Phân loại'],
      detectedType: 'shifts',
      parsedData,
    };
  },

  // Parse COUNTERS catalog
  parseCounters(
    rawHeaders: string[],
    dataRows: any[][],
    existingCounters: Counter[] = []
  ): ImportPreviewResult {
    const headerMap: Record<string, number> = {};
    rawHeaders.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      if (norm.includes('soquay') || norm.includes('quay') || norm.includes('counter') || norm.includes('stt')) {
        if (!('counterNumber' in headerMap)) headerMap['counterNumber'] = idx;
      }
      if (norm.includes('khuvuc') || norm.includes('area') || norm.includes('zone') || norm.includes('vitri')) {
        headerMap['area'] = idx;
      }
    });

    const existingIdSet = new Set(existingCounters.map((c) => c.id.toLowerCase()));
    const seenInFile = new Set<string>();
    const rows: ImportPreviewRow[] = [];
    const parsedData: Counter[] = [];

    let validRows = 0;
    let errorRows = 0;
    let duplicateRows = 0;
    let newRows = 0;

    dataRows.forEach((row, index) => {
      if (row.every((c) => c === undefined || c === null || String(c).trim() === '')) return;

      const rowNumber = index + 2;
      const counterNumberRaw = headerMap['counterNumber'] !== undefined ? row[headerMap['counterNumber']] : row[0];
      const areaRaw = headerMap['area'] !== undefined ? row[headerMap['area']] : row[1];

      const counterNumber = String(counterNumberRaw || '').trim();
      const area = String(areaRaw || '').trim() || 'Khu vực chung';

      const errors: string[] = [];
      if (!counterNumber) {
        errors.push('Thiếu Số quầy');
      }

      const id = counterNumber;
      const parsed: Counter = {
        id,
        counterNumber,
        area,
        order: index + 1,
      };

      const isDuplicate = counterNumber ? (existingIdSet.has(id.toLowerCase()) || seenInFile.has(id.toLowerCase())) : false;
      const isValid = errors.length === 0;

      if (counterNumber) seenInFile.add(id.toLowerCase());

      if (isValid) {
        validRows++;
        parsedData.push(parsed);
        if (isDuplicate) duplicateRows++;
        else newRows++;
      } else {
        errorRows++;
      }

      const rawObj: Record<string, any> = {};
      rawHeaders.forEach((h, i) => {
        rawObj[h || `Cột ${i + 1}`] = row[i] ?? '';
      });

      rows.push({
        rowNumber,
        raw: rawObj,
        parsed,
        isValid,
        isDuplicate,
        errors,
      });
    });

    return {
      fileName: '',
      totalRows: rows.length,
      validRows,
      errorRows,
      duplicateRows,
      newRows,
      rows,
      headers: ['Số quầy', 'Khu vực'],
      detectedType: 'counters',
      parsedData,
    };
  },

  // Parse EMPLOYEES catalog
  parseEmployees(
    rawHeaders: string[],
    dataRows: any[][],
    existingEmployees: Employee[] = []
  ): ImportPreviewResult {
    const headerMap: Record<string, number> = {};
    rawHeaders.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      if (norm.includes('manv') || norm.includes('manhanvien') || norm.includes('employeeid') || norm.includes('msnv') || norm.includes('id')) {
        if (!('employeeId' in headerMap)) headerMap['employeeId'] = idx;
      }
      if (norm.includes('tennhanvien') || norm.includes('tennv') || norm.includes('hoten') || norm.includes('fullname') || norm.includes('ten')) {
        if (!('fullName' in headerMap)) headerMap['fullName'] = idx;
      }
      if (norm.includes('sup') || norm.includes('chucvu') || norm.includes('quanly') || norm.includes('lead') || norm.includes('supervisor') || norm.includes('truongca')) {
        headerMap['isSup'] = idx;
      }
      if (norm.includes('sieuthi') || norm.includes('st') || norm.includes('supermarket') || norm.includes('tuchon')) {
        headerMap['canSieuThi'] = idx;
      }
      if (norm.includes('banhmy') || norm.includes('banhmi') || norm.includes('bm') || norm.includes('bakery') || norm.includes('banhkeo')) {
        headerMap['canBanhMy'] = idx;
      }
      if (norm.includes('delica') || norm.includes('amthuc') || norm.includes('douong') || norm.includes('traicay') || norm.includes('suachua')) {
        headerMap['canDelica'] = idx;
      }
      if (norm.includes('sdt') || norm.includes('dienthoai') || norm.includes('phone')) {
        headerMap['phone'] = idx;
      }
      if (norm.includes('bophan') || norm.includes('phongban') || norm.includes('department')) {
        headerMap['department'] = idx;
      }
    });

    const existingIdSet = new Set(existingEmployees.map((e) => e.employeeId.toLowerCase()));
    const seenInFile = new Set<string>();
    const rows: ImportPreviewRow[] = [];
    const parsedData: Employee[] = [];

    let validRows = 0;
    let errorRows = 0;
    let duplicateRows = 0;
    let newRows = 0;

    dataRows.forEach((row, index) => {
      if (row.every((c) => c === undefined || c === null || String(c).trim() === '')) return;

      const rowNumber = index + 2;
      const employeeIdRaw = headerMap['employeeId'] !== undefined ? row[headerMap['employeeId']] : row[0];
      const fullNameRaw = headerMap['fullName'] !== undefined ? row[headerMap['fullName']] : row[1];
      const isSupRaw = headerMap['isSup'] !== undefined ? row[headerMap['isSup']] : undefined;
      const canSieuThiRaw = headerMap['canSieuThi'] !== undefined ? row[headerMap['canSieuThi']] : undefined;
      const canBanhMyRaw = headerMap['canBanhMy'] !== undefined ? row[headerMap['canBanhMy']] : undefined;
      const canDelicaRaw = headerMap['canDelica'] !== undefined ? row[headerMap['canDelica']] : undefined;
      const phoneRaw = headerMap['phone'] !== undefined ? row[headerMap['phone']] : '';
      const departmentRaw = headerMap['department'] !== undefined ? row[headerMap['department']] : '';

      const fullName = String(fullNameRaw || '').trim();
      let employeeId = String(employeeIdRaw || '').trim();

      // If user only provided full name and no ID, we generate a stable fallback ID
      if (!employeeId && fullName) {
        employeeId = `NV_${fullName.replace(/\s+/g, '_')}`;
      }

      const errors: string[] = [];
      if (!fullName) {
        errors.push('Thiếu Tên nhân viên');
      }
      if (!employeeId) {
        errors.push('Thiếu Mã nhân viên');
      }

      const isSup = isSupRaw !== undefined ? parseOxBoolean(isSupRaw, false) : false;
      const canSieuThi = canSieuThiRaw !== undefined ? parseOxBoolean(canSieuThiRaw, true) : true;
      const canBanhMy = canBanhMyRaw !== undefined ? parseOxBoolean(canBanhMyRaw, false) : false;
      const canDelica = canDelicaRaw !== undefined ? parseOxBoolean(canDelicaRaw, false) : false;

      const parsed: Employee = {
        employeeId,
        fullName,
        isSup,
        canSieuThi,
        canBanhMy,
        canDelica,
        phone: String(phoneRaw || '').trim(),
        department: String(departmentRaw || '').trim(),
      };

      const isDuplicate = employeeId ? (existingIdSet.has(employeeId.toLowerCase()) || seenInFile.has(employeeId.toLowerCase())) : false;
      const isValid = errors.length === 0;

      if (employeeId) seenInFile.add(employeeId.toLowerCase());

      if (isValid) {
        validRows++;
        parsedData.push(parsed);
        if (isDuplicate) duplicateRows++;
        else newRows++;
      } else {
        errorRows++;
      }

      const rawObj: Record<string, any> = {};
      rawHeaders.forEach((h, i) => {
        rawObj[h || `Cột ${i + 1}`] = row[i] ?? '';
      });

      rows.push({
        rowNumber,
        raw: rawObj,
        parsed,
        isValid,
        isDuplicate,
        errors,
      });
    });

    return {
      fileName: '',
      totalRows: rows.length,
      validRows,
      errorRows,
      duplicateRows,
      newRows,
      rows,
      headers: ['Mã NV', 'Tên nhân viên', 'SUP', 'Siêu thị', 'Bánh mỳ', 'Delica', 'Số điện thoại', 'Bộ phận'],
      detectedType: 'employees',
      parsedData,
    };
  },

  // Parse WEEKLY SCHEDULE
  parseWeeklySchedule(
    rawHeaders: string[],
    dataRows: any[][],
    options: {
      weekMondayDate: string; // YYYY-MM-DD of Monday
      shifts: Shift[];
      employees: Employee[];
      existingEntries?: WeeklyScheduleEntry[];
    }
  ): ImportPreviewResult {
    const { weekMondayDate, shifts, employees, existingEntries = [] } = options;
    const shiftCodeSet = new Set(shifts.map((s) => s.shiftCode.toUpperCase()));
    const employeeIdMap = new Map<string, Employee>();
    const employeeNameMap = new Map<string, Employee>();

    employees.forEach((e) => {
      employeeIdMap.set(e.employeeId.toUpperCase(), e);
      employeeNameMap.set(e.fullName.toLowerCase().trim(), e);
    });

    // Check if matrix format: Headers contain "Thứ 2"..."Thứ 7", "Chủ Nhật" or dates
    const dayHeaderCols: { dayIndex: number; colIdx: number; label: string; dateStr: string }[] = [];
    const dayAliases: Record<string, number> = {
      't2': 0, 'thu2': 0, 'thuhai': 0, 'thu 2': 0, 'thu hai': 0, '2': 0, 'mon': 0, 'monday': 0,
      't3': 1, 'thu3': 1, 'thuba': 1, 'thu 3': 1, 'thu ba': 1, '3': 1, 'tue': 1, 'tuesday': 1,
      't4': 2, 'thu4': 2, 'thutu': 2, 'thu 4': 2, 'thu tu': 2, '4': 2, 'wed': 2, 'wednesday': 2,
      't5': 3, 'thu5': 3, 'thunam': 3, 'thu 5': 3, 'thu nam': 3, '5': 3, 'thu': 3, 'thursday': 3,
      't6': 4, 'thu6': 4, 'thusau': 4, 'thu 6': 4, 'thu sau': 4, '6': 4, 'fri': 4, 'friday': 4,
      't7': 5, 'thu7': 5, 'thubay': 5, 'thu 7': 5, 'thu bay': 5, '7': 5, 'sat': 5, 'saturday': 5,
      'cn': 6, 'chunhat': 6, 'chu nhat': 6, 'cnhat': 6, 'c.nhat': 6, 't8': 6, 'thu8': 6, '8': 6, 'sun': 6, 'sunday': 6,
    };

    const mondayBase = new Date(weekMondayDate);

    rawHeaders.forEach((h, idx) => {
      const rawStr = String(h || '').trim();
      const norm = normalizeHeader(rawStr);
      let dayIdx: number | null = null;

      if (norm in dayAliases) {
        dayIdx = dayAliases[norm];
      } else if (norm.includes('chunhat') || norm.includes('cnhat') || norm.includes('sunday') || norm === 'cn' || norm.startsWith('cn') || norm.includes('thu8') || norm.includes('t8')) {
        dayIdx = 6;
      } else if (norm.includes('thubay') || norm.includes('saturday') || norm === 't7' || norm.startsWith('thu7') || norm.startsWith('t7') || norm.includes('sat')) {
        dayIdx = 5;
      } else if (norm.includes('thusau') || norm.includes('friday') || norm === 't6' || norm.startsWith('thu6') || norm.startsWith('t6') || norm.includes('fri')) {
        dayIdx = 4;
      } else if (norm.includes('thunam') || norm.includes('thursday') || norm === 't5' || norm.startsWith('thu5') || norm.startsWith('t5')) {
        dayIdx = 3;
      } else if (norm.includes('thutu') || norm.includes('wednesday') || norm === 't4' || norm.startsWith('thu4') || norm.startsWith('t4') || norm.includes('wed')) {
        dayIdx = 2;
      } else if (norm.includes('thuba') || norm.includes('tuesday') || norm === 't3' || norm.startsWith('thu3') || norm.startsWith('t3') || norm.includes('tue')) {
        dayIdx = 1;
      } else if (norm.includes('thuhai') || norm.includes('monday') || norm === 't2' || norm.startsWith('thu2') || norm.startsWith('t2') || norm.includes('mon')) {
        dayIdx = 0;
      } else {
        // Check if header contains a date (e.g. 23/08/2026 or 23/08)
        const parsedDate = normalizeDate(h, weekMondayDate);
        if (parsedDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
          for (let dIdx = 0; dIdx < 7; dIdx++) {
            if (addDaysToDateStr(weekMondayDate, dIdx) === parsedDate) {
              dayIdx = dIdx;
              break;
            }
          }
        }
      }

      if (dayIdx !== null && dayIdx >= 0 && dayIdx <= 6) {
        dayHeaderCols.push({
          dayIndex: dayIdx + 1,
          colIdx: idx,
          label: rawStr,
          dateStr: addDaysToDateStr(weekMondayDate, dayIdx),
        });
      }
    });

    const isMatrix = dayHeaderCols.length >= 3;
    const rows: ImportPreviewRow[] = [];
    const parsedData: WeeklyScheduleEntry[] = [];
    const seenKeySet = new Set(existingEntries.map((e) => `${e.employeeId || e.employeeName}_${e.date}`));

    let validRows = 0;
    let errorRows = 0;
    let duplicateRows = 0;
    let newRows = 0;

    if (isMatrix) {
      // Find Name and ID columns
      let nameColIdx = -1;
      let idColIdx = -1;
      rawHeaders.forEach((h, idx) => {
        const raw = String(h || '').trim();
        const norm = normalizeHeader(raw);
        const isStt = norm === 'stt' || norm === 'sott' || norm === 'no' || norm === 'tt' || raw === '#';
        if (!isStt && (norm.includes('manv') || norm.includes('msnv') || norm === 'id' || norm.includes('ma_nv') || norm.includes('manhanvien') || norm.includes('employeeid'))) {
          idColIdx = idx;
        }
        if (norm.includes('hoten') || norm.includes('tennv') || norm.includes('nhanvien') || norm.includes('fullname') || norm.includes('name') || norm.includes('ten')) {
          nameColIdx = idx;
        }
      });

      // Heuristic fallbacks if columns not named explicitly:
      if (nameColIdx === -1) {
        const col0Norm = normalizeHeader(rawHeaders[0]);
        const isCol0Stt = col0Norm === 'stt' || col0Norm === 'sott' || col0Norm === 'no' || col0Norm === 'tt' || String(rawHeaders[0] || '').trim() === '#';
        nameColIdx = isCol0Stt && rawHeaders.length > 1 ? 1 : 0;
      }

      dataRows.forEach((row, rIdx) => {
        if (row.every((c) => c === undefined || c === null || String(c).trim() === '')) return;
        const rowNumber = rIdx + 2;
        const employeeNameRaw = nameColIdx >= 0 ? String(row[nameColIdx] || '').trim() : '';
        let employeeIdRaw = idColIdx >= 0 ? String(row[idColIdx] || '').trim() : '';

        // If employeeIdRaw looks like a pure STT row index (e.g. "1", "2") and wasn't from an explicit ID column, clear it
        if (idColIdx === -1 && /^\d{1,3}$/.test(employeeIdRaw)) {
          employeeIdRaw = '';
        }

        const rowErrors: string[] = [];
        if (!employeeNameRaw && !employeeIdRaw) {
          rowErrors.push('Thiếu Tên hoặc Mã nhân viên');
        }

        // Cross-match employee: Prefer matching by name first, or by ID if ID is valid
        let matchedEmployee = employeeNameRaw ? employeeNameMap.get(employeeNameRaw.toLowerCase()) : undefined;
        if (!matchedEmployee && employeeIdRaw && !/^\d{1,3}$/.test(employeeIdRaw)) {
          matchedEmployee = employeeIdMap.get(employeeIdRaw.toUpperCase());
        }

        const finalName = matchedEmployee ? matchedEmployee.fullName : (employeeNameRaw || employeeIdRaw);
        const finalId = matchedEmployee ? matchedEmployee.employeeId : employeeIdRaw;

        // Note: New employees not yet in catalog are supported seamlessly without blocking errors!

        dayHeaderCols.forEach((dh) => {
          const shiftCodeRaw = String(row[dh.colIdx] || '').trim().toUpperCase();
          if (!shiftCodeRaw) return; // empty cell on that day

          const itemErrors = [...rowErrors];
          const isOff = isOffShift(shiftCodeRaw, '');
          let resolvedShiftCode = shiftCodeRaw;
          if (shifts.length > 0 && !shiftCodeSet.has(shiftCodeRaw) && !isOff) {
            const foundShift = shifts.find((s) => {
              const code = s.shiftCode.toUpperCase().replace(/\s+/g, '');
              const cleanRaw = shiftCodeRaw.replace(/\s+/g, '');
              return code === cleanRaw || code === `V${cleanRaw}` || `V${code}` === cleanRaw;
            });
            if (foundShift) {
              resolvedShiftCode = foundShift.shiftCode;
            }
          }

          const entry: WeeklyScheduleEntry = {
            id: `${finalId || finalName}_${dh.dateStr}`,
            weekId: weekMondayDate,
            date: dh.dateStr,
            dayOfWeek: dh.dayIndex,
            employeeId: finalId,
            employeeName: finalName,
            shiftCode: resolvedShiftCode,
          };

          const key = `${entry.employeeId || entry.employeeName}_${entry.date}`;
          const isDuplicate = seenKeySet.has(key);
          const isValid = itemErrors.length === 0;

          if (isValid) {
            validRows++;
            parsedData.push(entry);
            if (isDuplicate) duplicateRows++;
            else newRows++;
          } else {
            errorRows++;
          }

          const rawObj: Record<string, any> = {
            'Nhân viên': finalName,
            'Mã NV': finalId,
            'Ngày': dh.dateStr,
            'Thứ': dh.dayIndex === 7 ? 'Chủ Nhật' : `Thứ ${dh.dayIndex + 1}`,
            'Mã ca': shiftCodeRaw,
          };

          rows.push({
            rowNumber,
            raw: rawObj,
            parsed: entry,
            isValid,
            isDuplicate,
            errors: itemErrors,
          });
        });
      });
    } else {
      // Row by row format: Tên NV, Mã NV (opt), Ngày/Thứ, Mã ca
      let nameColIdx = -1;
      let idColIdx = -1;
      let dateColIdx = -1;
      let shiftColIdx = -1;

      rawHeaders.forEach((h, idx) => {
        const raw = String(h || '').trim();
        const norm = normalizeHeader(raw);
        const isStt = norm === 'stt' || norm === 'sott' || norm === 'no' || norm === 'tt' || raw === '#';
        if (!isStt && (norm.includes('manv') || norm.includes('msnv') || norm === 'id' || norm.includes('ma_nv') || norm.includes('manhanvien') || norm.includes('employeeid'))) {
          idColIdx = idx;
        }
        if (norm.includes('hoten') || norm.includes('tennv') || norm.includes('nhanvien') || norm.includes('fullname') || norm.includes('name') || norm.includes('ten')) {
          nameColIdx = idx;
        }
        if (norm.includes('ngay') || norm.includes('date') || norm.includes('thu')) dateColIdx = idx;
        if (norm.includes('maca') || norm.includes('ca') || norm.includes('shift')) shiftColIdx = idx;
      });

      // Heuristic fallbacks if not explicitly found
      if (nameColIdx === -1) {
        const col0Norm = normalizeHeader(rawHeaders[0]);
        const isCol0Stt = col0Norm === 'stt' || col0Norm === 'sott' || col0Norm === 'no' || col0Norm === 'tt';
        nameColIdx = isCol0Stt && rawHeaders.length > 1 ? 1 : 0;
      }
      if (dateColIdx === -1) dateColIdx = nameColIdx === 0 ? 1 : 2;
      if (shiftColIdx === -1) shiftColIdx = dateColIdx + 1;

      dataRows.forEach((row, rIdx) => {
        if (row.every((c) => c === undefined || c === null || String(c).trim() === '')) return;
        const rowNumber = rIdx + 2;
        const employeeNameRaw = nameColIdx >= 0 ? String(row[nameColIdx] || '').trim() : '';
        let employeeIdRaw = idColIdx >= 0 ? String(row[idColIdx] || '').trim() : '';
        if (idColIdx === -1 && /^\d{1,3}$/.test(employeeIdRaw)) {
          employeeIdRaw = '';
        }
        const dateRaw = dateColIdx >= 0 ? row[dateColIdx] : '';
        const shiftCodeRaw = shiftColIdx >= 0 ? String(row[shiftColIdx] || '').trim().toUpperCase() : '';

        const errors: string[] = [];
        if (!employeeNameRaw && !employeeIdRaw) errors.push('Thiếu Tên hoặc Mã NV');
        if (!shiftCodeRaw) errors.push('Thiếu Mã ca');

        const dateStr = normalizeDate(dateRaw, weekMondayDate);
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          errors.push(`Ngày làm việc không hợp lệ: "${dateRaw}"`);
        }

        // Cross-match employee: Prefer matching by name first, or by ID if valid
        let matchedEmployee = employeeNameRaw ? employeeNameMap.get(employeeNameRaw.toLowerCase()) : undefined;
        if (!matchedEmployee && employeeIdRaw && !/^\d{1,3}$/.test(employeeIdRaw)) {
          matchedEmployee = employeeIdMap.get(employeeIdRaw.toUpperCase());
        }

        const finalName = matchedEmployee ? matchedEmployee.fullName : (employeeNameRaw || employeeIdRaw);
        const finalId = matchedEmployee ? matchedEmployee.employeeId : employeeIdRaw;

        const isOff = isOffShift(shiftCodeRaw, '');
        let resolvedShiftCode = shiftCodeRaw;
        if (shifts.length > 0 && !shiftCodeSet.has(shiftCodeRaw) && !isOff) {
          const foundShift = shifts.find((s) => {
            const code = s.shiftCode.toUpperCase().replace(/\s+/g, '');
            const cleanRaw = shiftCodeRaw.replace(/\s+/g, '');
            return code === cleanRaw || code === `V${cleanRaw}` || `V${code}` === cleanRaw;
          });
          if (foundShift) {
            resolvedShiftCode = foundShift.shiftCode;
          }
        }

        // Calculate day of week (1 = Thứ 2, 7 = Chủ Nhật)
        const dayOfWeek = dateStr ? getDayOfWeekIndex(dateStr) : 1;

        const entry: WeeklyScheduleEntry = {
          id: `${finalId || finalName}_${dateStr}`,
          weekId: weekMondayDate,
          date: dateStr,
          dayOfWeek,
          employeeId: finalId,
          employeeName: finalName,
          shiftCode: resolvedShiftCode,
        };

        const key = `${entry.employeeId || entry.employeeName}_${entry.date}`;
        const isDuplicate = seenKeySet.has(key);
        const isValid = errors.length === 0;

        if (isValid) {
          validRows++;
          parsedData.push(entry);
          if (isDuplicate) duplicateRows++;
          else newRows++;
        } else {
          errorRows++;
        }

        const rawObj: Record<string, any> = {};
        rawHeaders.forEach((h, i) => {
          rawObj[h || `Cột ${i + 1}`] = row[i] ?? '';
        });

        rows.push({
          rowNumber,
          raw: rawObj,
          parsed: entry,
          isValid,
          isDuplicate,
          errors,
        });
      });
    }

    return {
      fileName: '',
      totalRows: rows.length,
      validRows,
      errorRows,
      duplicateRows,
      newRows,
      rows,
      headers: ['Nhân viên', 'Mã NV', 'Ngày làm việc', 'Thứ', 'Mã ca'],
      detectedType: 'weeklySchedule',
      parsedData,
    };
  },

  // Export Sample Template Excel files for users to download
  downloadSampleTemplate(type: 'shifts' | 'counters' | 'employees' | 'weeklySchedule', mondayDate = '2026-08-17'): void {
    const wb = XLSX.utils.book_new();

    if (type === 'shifts') {
      const data = [
        ['Mã ca', 'Giờ bắt đầu', 'Giờ kết thúc', 'Loại ca'],
        ['V814', '08:00', '17:00', 'Ca Sáng'],
        ['V815', '08:30', '17:30', 'Ca Sáng'],
        ['V818', '09:00', '18:00', 'Ca Sáng'],
        ['V820', '10:00', '19:00', 'Ca Sáng'],
        ['V822', '11:00', '20:00', 'Ca Sáng'],
        ['V829', '13:00', '22:00', 'Ca Chiều'],
        ['V830', '14:00', '22:30', 'Ca Chiều'],
        ['V633', '15:30', '22:00', 'Ca Chiều'],
        ['OFF', '', '', 'Nghỉ'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Danh_Muc_Ca');
      XLSX.writeFile(wb, 'Mau_Danh_Muc_Ca.xlsx');
    } else if (type === 'counters') {
      const data = [
        ['Số quầy', 'Khu vực'],
        ['1 ssc', 'Khu Tự chọn Tầng 1'],
        ['2 ssc', 'Khu Tự chọn Tầng 1'],
        ['3 ssc', 'Khu Tự chọn Tầng 1'],
        ['4 ssc', 'Khu Tự chọn Tầng 1'],
        ['6', 'Khu Thực phẩm'],
        ['7', 'Khu Thực phẩm'],
        ['8', 'Khu Thực phẩm'],
        ['9', 'Khu Thực phẩm'],
        ['10', 'Khu Thực phẩm'],
        ['11', 'Khu Bách hóa'],
        ['12', 'Khu Bách hóa'],
        ['13', 'Khu Bách hóa'],
        ['14', 'Khu Bách hóa'],
        ['15', 'Khu Bách hóa'],
        ['16', 'Khu Bách hóa'],
        ['17', 'Khu Bách hóa'],
        ['18', 'Khu Gia dụng'],
        ['19', 'Khu Gia dụng'],
        ['20', 'Khu Thời trang'],
        ['21', 'Khu Thời trang'],
        ['22', 'Khu Thời trang'],
        ['23', 'Khu Thời trang'],
        ['24', 'Khu Thời trang'],
        ['25', 'Tầng 2'],
        ['26', 'Tầng 2'],
        ['27', 'Tầng 2'],
        ['101', 'Khu Đồ uống'],
        ['102', 'Khu Đồ uống'],
        ['103', 'Khu Bánh kẹo'],
        ['104', 'Khu Bánh kẹo'],
        ['105', 'Khu Sữa chua'],
        ['106', 'Khu Trái cây'],
        ['306', 'Khu Dịch vụ'],
        ['311', 'Khu CSKH'],
        ['312', 'Khu CSKH'],
        ['QL', 'Quản lý Thu ngân'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Quay');
      XLSX.writeFile(wb, 'Mau_Danh_Sach_Quay.xlsx');
    } else if (type === 'employees') {
      const data = [
        ['Mã nhân viên', 'Tên nhân viên', 'SUP', 'Siêu thị', 'Bánh mỳ', 'Delica', 'Số điện thoại', 'Bộ phận'],
        ['NV001', 'Vũ Thị Vân Anh', 'o', 'o', 'o', 'o', '0901234501', 'Thu ngân T1'],
        ['NV002', 'Phạm Thị Hằng', 'x', 'o', 'o', 'x', '0901234502', 'Thu ngân T1'],
        ['NV003', 'Vũ Thị Ngọc Anh', 'x', 'o', 'x', 'o', '0901234503', 'Thu ngân T1'],
        ['NV004', 'Nguyễn Thị Ngọc Anh', 'x', 'o', 'x', 'x', '0901234504', 'Thu ngân T1'],
        ['NV005', 'Hoàng Thúy Liễu', 'o', 'o', 'o', 'x', '0901234505', 'Thu ngân T2'],
        ['NV006', 'Trần Gia Tuyển', 'x', 'o', 'x', 'o', '0901234506', 'Thu ngân T2'],
        ['NV007', 'Vũ Thị Quỳnh Anh', 'x', 'o', 'x', 'x', '0901234507', 'Thu ngân T1'],
        ['NV008', 'Nguyễn Thị Lan', 'x', 'o', 'o', 'x', '0901234508', 'Thu ngân T1'],
        ['NV009', 'Trần Ngọc Mai', 'x', 'o', 'x', 'x', '0901234509', 'Thu ngân T2'],
        ['NV010', 'Vũ Bảo Đức Duy', 'x', 'o', 'x', 'o', '0901234510', 'Thu ngân T2'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Nhan_Vien');
      XLSX.writeFile(wb, 'Mau_Danh_Sach_Nhan_Vien.xlsx');
    } else if (type === 'weeklySchedule') {
      // Create a 2-sheet workbook: Sheet 1 Matrix, Sheet 2 Row format
      const matrixData = [
        ['Mã NV', 'Tên nhân viên', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'],
        ['NV001', 'Vũ Thị Vân Anh', 'V815', 'V815', 'OFF', 'V815', 'V815', 'V818', 'V815'],
        ['NV002', 'Phạm Thị Hằng', 'V829', 'V829', 'V829', 'OFF', 'V829', 'V829', 'OFF'],
        ['NV003', 'Vũ Thị Ngọc Anh', 'V829', 'V830', 'V829', 'V829', 'OFF', 'V830', 'V830'],
        ['NV004', 'Nguyễn Thị Ngọc Anh', 'V830', 'OFF', 'V830', 'V830', 'V830', 'V830', 'OFF'],
        ['NV005', 'Hoàng Thúy Liễu', 'V818', 'V818', 'V818', 'V818', 'V818', 'OFF', 'V818'],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(matrixData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Mau_Ma_Tran_Tuan');

      const rowData = [
        ['Mã NV', 'Tên nhân viên', 'Ngày làm việc', 'Mã ca'],
        ['NV001', 'Vũ Thị Vân Anh', '2026-08-17', 'V815'],
        ['NV001', 'Vũ Thị Vân Anh', '2026-08-18', 'V815'],
        ['NV002', 'Phạm Thị Hằng', '2026-08-17', 'V829'],
        ['NV003', 'Vũ Thị Ngọc Anh', '2026-08-17', 'V829'],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(rowData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Mau_Dong_Don');

      XLSX.writeFile(wb, 'Mau_Ca_Lam_Viec_Tuan.xlsx');
    }
  },

  /**
   * Xuất file Excel bảng phân công DWS hàng ngày (*.xlsx) theo đúng chuẩn 5 cột
   */
  exportDailyDwsToExcel(params: {
    date: string;
    dayName: string;
    weekId?: string;
    counters: Counter[];
    assignment: DayDwsAssignment | null;
    shifts?: Shift[];
    weeklySchedule?: WeeklyScheduleEntry[];
  }): void {
    const { date, dayName, weekId, counters, assignment } = params;
    const wb = XLSX.utils.book_new();

    const sortedCounters = [...counters].sort((a, b) => (a.order || 0) - (b.order || 0));

    const isSscCounter = (c: Counter) => {
      const num = (c.counterNumber || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      return num.includes('ssc') || id.includes('ssc') || ['1', '2', '3', '4'].includes((c.counterNumber || '').trim());
    };

    // 1. Sheet DWS Ngày
    const dwsRows: any[][] = [];
    dwsRows.push(['Quầy', 'Tên Thu Ngân', 'MÃ', 'T', 'Quầy']);

    const merges: XLSX.Range[] = [];
    let currentRow = 1; // row 0 is header

    sortedCounters.forEach((counter) => {
      const ca = assignment?.assignments?.[counter.id] || null;

      // Dòng 1: Ca Sáng
      const r0Name = ca?.morning?.employeeName || '';
      const r0Code = ca?.morning?.shiftCode || '';
      const r0T = ca?.morning ? '##' : '';

      // Dòng 2: Ca Sáng 2 (hoặc trống)
      const r1Name = ca?.morning2?.employeeName || '';
      const r1Code = ca?.morning2?.shiftCode || '';
      const r1T = ca?.morning2 ? '##' : '';

      // Dòng 3: Ca Tối / Chiều
      const r2Name = ca?.afternoon?.employeeName || '';
      const r2Code = ca?.afternoon?.shiftCode || '';
      const r2T = ca?.afternoon ? '##' : '';

      // Dòng 4: Ca Tối 2 (hoặc trống)
      const r3Name = ca?.afternoon2?.employeeName || '';
      const r3Code = ca?.afternoon2?.shiftCode || '';
      const r3T = ca?.afternoon2 ? '##' : '';

      dwsRows.push([counter.counterNumber, r0Name, r0Code, r0T, counter.counterNumber]);
      dwsRows.push([counter.counterNumber, r1Name, r1Code, r1T, counter.counterNumber]);
      dwsRows.push([counter.counterNumber, r2Name, r2Code, r2T, counter.counterNumber]);
      dwsRows.push([counter.counterNumber, r3Name, r3Code, r3T, counter.counterNumber]);

      // Merge column A (0) and column E (4) across 4 rows
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow + 3, c: 0 } });
      merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow + 3, c: 4 } });

      currentRow += 4;
    });

    const wsDws = XLSX.utils.aoa_to_sheet(dwsRows);
    wsDws['!merges'] = merges;
    wsDws['!cols'] = [
      { wch: 8 },  // Quầy
      { wch: 20 }, // Tên Thu Ngân
      { wch: 7 },  // MÃ
      { wch: 5 },  // T
      { wch: 8 },  // Quầy
    ];

    const safeSheetName = `DWS_${date.replace(/-/g, '').slice(2)}`;
    XLSX.utils.book_append_sheet(wb, wsDws, safeSheetName);

    // Download file
    const fileName = `DWS_${date}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  /**
   * Xuất file Excel bảng phân công DWS cả tuần (*.xlsx)
   * - 7 sheet riêng tương ứng 7 ngày trong tuần: MON, TUE, WED, THU, FRI, SAT, SUN
   * - 1 sheet FOLLOW hiển thị thông tin toàn bộ nhân viên có trong danh sách cả tuần
   *   ghi nhận số quầy đã đứng (nếu là SSC thì ghi số thứ tự: SSC1 -> 1, SSC2 -> 2, nếu nghỉ/không đứng quầy ghi "-")
   */
  exportWeeklyDwsToExcel(params: {
    mondayDate: string;
    counters: Counter[];
    assignmentsMap: Record<string, DayDwsAssignment>;
    shifts?: Shift[];
    weeklySchedule?: WeeklyScheduleEntry[];
    employees?: Employee[];
  }): void {
    const { mondayDate, counters, assignmentsMap, weeklySchedule = [], employees = [] } = params;
    const wb = XLSX.utils.book_new();

    const sortedCounters = [...counters].sort((a, b) => (a.order || 0) - (b.order || 0));

    // 1. TẠO 7 SHEET CHO 7 NGÀY THEO TÊN QUY ĐỊNH: MON, TUE, WED, THU, FRI, SAT, SUN
    const sheetDayCodes = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const dStr = addDaysToDateStr(mondayDate, i);
      return {
        index: i,
        date: dStr,
        dayName: dayNames[i],
        sheetCode: sheetDayCodes[i],
        assignment: assignmentsMap[dStr] || null,
      };
    });

    // Thêm từng sheet cho 7 ngày
    days.forEach((d) => {
      const dwsRows: any[][] = [];
      dwsRows.push(['Quầy', 'Tên Thu Ngân', 'MÃ', 'T', 'Quầy']);

      const merges: XLSX.Range[] = [];
      let currentRow = 1;

      sortedCounters.forEach((counter) => {
        const ca = d.assignment?.assignments?.[counter.id] || null;

        // Dòng 1: Ca Sáng
        const r0Name = ca?.morning?.employeeName || '';
        const r0Code = ca?.morning?.shiftCode || '';
        const r0T = ca?.morning ? '##' : '';

        // Dòng 2: Ca Sáng 2 (hoặc trống)
        const r1Name = ca?.morning2?.employeeName || '';
        const r1Code = ca?.morning2?.shiftCode || '';
        const r1T = ca?.morning2 ? '##' : '';

        // Dòng 3: Ca Tối / Chiều
        const r2Name = ca?.afternoon?.employeeName || '';
        const r2Code = ca?.afternoon?.shiftCode || '';
        const r2T = ca?.afternoon ? '##' : '';

        // Dòng 4: Ca Tối 2 (hoặc trống)
        const r3Name = ca?.afternoon2?.employeeName || '';
        const r3Code = ca?.afternoon2?.shiftCode || '';
        const r3T = ca?.afternoon2 ? '##' : '';

        dwsRows.push([counter.counterNumber, r0Name, r0Code, r0T, counter.counterNumber]);
        dwsRows.push([counter.counterNumber, r1Name, r1Code, r1T, counter.counterNumber]);
        dwsRows.push([counter.counterNumber, r2Name, r2Code, r2T, counter.counterNumber]);
        dwsRows.push([counter.counterNumber, r3Name, r3Code, r3T, counter.counterNumber]);

        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow + 3, c: 0 } });
        merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow + 3, c: 4 } });

        currentRow += 4;
      });

      const wsDay = XLSX.utils.aoa_to_sheet(dwsRows);
      wsDay['!merges'] = merges;
      wsDay['!cols'] = [
        { wch: 8 },  // Quầy
        { wch: 20 }, // Tên Thu Ngân
        { wch: 7 },  // MÃ
        { wch: 5 },  // T
        { wch: 8 },  // Quầy
      ];

      // Đặt tên sheet đúng theo yêu cầu người dùng: MON, TUE, WED, THU, FRI, SAT, SUN
      XLSX.utils.book_append_sheet(wb, wsDay, d.sheetCode);
    });

    // 2. TẠO SHEET FOLLOW
    // Tập hợp toàn bộ nhân viên có trong danh sách cả tuần vừa rồi
    const sundayDate = addDaysToDateStr(mondayDate, 6);
    const weekScheduleFiltered = weeklySchedule.filter(
      (entry) => entry.date >= mondayDate && entry.date <= sundayDate
    );

    // Xây dựng danh sách nhân viên duy nhất trong tuần
    const employeeMap = new Map<string, { employeeId: string; employeeName: string }>();

    // Bổ sung nhân viên từ lịch tuần
    weekScheduleFiltered.forEach((entry) => {
      const name = entry.employeeName?.trim();
      if (!name) return;
      const key = (entry.employeeId || name).toLowerCase();
      if (!employeeMap.has(key)) {
        employeeMap.set(key, {
          employeeId: entry.employeeId || '',
          employeeName: name,
        });
      } else if (!employeeMap.get(key)!.employeeId && entry.employeeId) {
        employeeMap.get(key)!.employeeId = entry.employeeId;
      }
    });

    // Bổ sung nhân viên từ bảng phân quầy assignmentsMap nếu chưa có trong lịch
    days.forEach((d) => {
      if (!d.assignment?.assignments) return;
      Object.values(d.assignment.assignments).forEach((ca) => {
        [ca?.morning, ca?.morning2, ca?.afternoon, ca?.afternoon2].forEach((slot) => {
          if (!slot?.employeeName) return;
          const name = slot.employeeName.trim();
          const key = (slot.employeeId || name).toLowerCase();
          if (!employeeMap.has(key)) {
            employeeMap.set(key, {
              employeeId: slot.employeeId || '',
              employeeName: name,
            });
          }
        });
      });
    });

    // Tra cứu bổ sung employeeId từ danh mục employees nếu còn thiếu
    const empCatalogMap = new Map<string, Employee>();
    employees.forEach((emp) => {
      if (emp.employeeId) empCatalogMap.set(emp.employeeId.toLowerCase(), emp);
      if (emp.fullName) empCatalogMap.set(emp.fullName.trim().toLowerCase(), emp);
    });

    const allWeeklyEmployees = Array.from(employeeMap.values()).map((emp) => {
      const matched =
        (emp.employeeId ? empCatalogMap.get(emp.employeeId.toLowerCase()) : null) ||
        empCatalogMap.get(emp.employeeName.trim().toLowerCase());
      return {
        employeeId: emp.employeeId || matched?.employeeId || '',
        employeeName: emp.employeeName || matched?.fullName || '',
      };
    });

    // Sắp xếp danh sách nhân viên: ưu tiên mã NV (nếu có), sau đó theo tên Tiếng Việt
    allWeeklyEmployees.sort((a, b) => {
      if (a.employeeId && b.employeeId) {
        return a.employeeId.localeCompare(b.employeeId, 'vi', { numeric: true });
      }
      return a.employeeName.localeCompare(b.employeeName, 'vi');
    });

    // Map nhanh Counter ID/Number -> Counter Object
    const counterMap = new Map<string, Counter>();
    counters.forEach((c) => {
      counterMap.set(c.id, c);
      counterMap.set(c.counterNumber, c);
    });

    // Helper: Định dạng số quầy theo yêu cầu (SSC1 -> 1, SSC2 -> 2, Quầy 01 -> 1, Quầy 12 -> 12, etc.)
    const formatFollowCounter = (counterVal: Counter | string): string => {
      const raw = typeof counterVal === 'string' ? counterVal : (counterVal.counterNumber || counterVal.id || '');
      const trimmed = String(raw).trim();
      if (!trimmed) return '-';

      // 1. Kiểm tra SSC: ví dụ SSC1 -> 1, SSC2 -> 2, SSC 01 -> 1, 1 ssc -> 1
      const sscMatch = trimmed.match(/ssc\s*0*(\d+)/i) || trimmed.match(/0*(\d+)\s*ssc/i);
      if (sscMatch && sscMatch[1]) {
        return String(parseInt(sscMatch[1], 10));
      }

      // 2. Quầy thông thường: chỉ ghi nhận số quầy, ví dụ: Quầy 01 -> 1, Quầy 12 -> 12, 05 -> 5
      const numMatch = trimmed.match(/(?:qu[ầa]y|quay|q)?\s*0*(\d+)/i);
      if (numMatch && numMatch[1]) {
        return String(parseInt(numMatch[1], 10));
      }

      // 3. Nếu chuỗi có chữ số nào, lấy số đầu tiên
      const anyNum = trimmed.match(/\d+/);
      if (anyNum) {
        return String(parseInt(anyNum[0], 10));
      }

      return trimmed;
    };

    // Chuẩn bị dữ liệu cho sheet FOLLOW
    const followRows: any[][] = [];
    followRows.push([
      'STT',
      'Mã NV',
      'Họ Và Tên',
      'MON',
      'TUE',
      'WED',
      'THU',
      'FRI',
      'SAT',
      'SUN',
    ]);

    allWeeklyEmployees.forEach((emp, index) => {
      const rowData: any[] = [
        index + 1,
        emp.employeeId || '',
        emp.employeeName,
      ];

      // Duyệt qua 7 ngày từ Thứ 2 đến Chủ Nhật
      days.forEach((d) => {
        const dStr = d.date;
        const dayAssignment = d.assignment;

        // Tìm tất cả các quầy nhân viên này đã đứng trong ngày dStr
        const stoodCounters: string[] = [];

        if (dayAssignment?.assignments) {
          Object.entries(dayAssignment.assignments).forEach(([cId, ca]) => {
            const slots = [ca?.morning, ca?.morning2, ca?.afternoon, ca?.afternoon2];
            const isAssigned = slots.some((s) => {
              if (!s) return false;
              if (emp.employeeId && s.employeeId && s.employeeId === emp.employeeId) return true;
              return s.employeeName?.trim().toLowerCase() === emp.employeeName.trim().toLowerCase();
            });

            if (isAssigned) {
              const counterObj = counterMap.get(cId) || { id: cId, counterNumber: cId, area: '' };
              const displayVal = formatFollowCounter(counterObj);
              if (displayVal && displayVal !== '-' && !stoodCounters.includes(displayVal)) {
                stoodCounters.push(displayVal);
              }
            }
          });
        }

        if (stoodCounters.length > 0) {
          // Ghi nhận số quầy đã đứng (nếu đứng nhiều quầy trong ngày thì ngăn cách bằng dấu phẩy)
          rowData.push(stoodCounters.join(', '));
        } else {
          // Nếu nghỉ hoặc không đứng quầy nào thì để "-"
          rowData.push('-');
        }
      });

      followRows.push(rowData);
    });

    const wsFollow = XLSX.utils.aoa_to_sheet(followRows);
    wsFollow['!cols'] = [
      { wch: 6 },  // STT
      { wch: 12 }, // Mã NV
      { wch: 26 }, // Họ Và Tên
      { wch: 8 },  // MON
      { wch: 8 },  // TUE
      { wch: 8 },  // WED
      { wch: 8 },  // THU
      { wch: 8 },  // FRI
      { wch: 8 },  // SAT
      { wch: 8 },  // SUN
    ];

    XLSX.utils.book_append_sheet(wb, wsFollow, 'FOLLOW');

    // Download file
    const fileName = `DWS_AEON_HAI_PHONG_LE_CHAN_Tuan_${mondayDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  /**
   * Xuất danh sách các ca làm việc đã chỉnh sửa / đổi ca ra file Excel (.xlsx)
   */
  exportModifiedShiftsToExcel(params: {
    entries: WeeklyScheduleEntry[];
    shifts?: Shift[];
    weekId?: string;
    title?: string;
    allWeeklySchedule?: WeeklyScheduleEntry[];
    employees?: Employee[];
  }): void {
    const { entries, shifts = [], weekId, title, allWeeklySchedule = [], employees = [] } = params;
    const wb = XLSX.utils.book_new();

    const DAY_NAMES: Record<number, string> = {
      1: 'Thứ Hai',
      2: 'Thứ Ba',
      3: 'Thứ Tư',
      4: 'Thứ Năm',
      5: 'Thứ Sáu',
      6: 'Thứ Bảy',
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

    const getShiftCategoryLabel = (shiftCode: string): string => {
      const code = (shiftCode || '').trim().toUpperCase();
      if (isOffShift(code)) return 'Ca Nghỉ';
      const matched = shifts.find((s) => s.shiftCode.trim().toUpperCase() === code);
      if (matched) {
        if (matched.isOff) return 'Ca Nghỉ';
        if (matched.category === 'morning') return 'Ca Sáng';
        if (matched.category === 'afternoon') return 'Ca Chiều';
      }
      if (
        code.startsWith('V814') ||
        code.startsWith('V815') ||
        code.startsWith('V615') ||
        code.startsWith('V818') ||
        code.startsWith('V618') ||
        code.startsWith('S')
      ) {
        return 'Ca Sáng';
      }
      if (
        code.startsWith('V820') ||
        code.startsWith('V822') ||
        code.startsWith('V829') ||
        code.startsWith('V830') ||
        code.startsWith('V633') ||
        code.startsWith('C')
      ) {
        return 'Ca Chiều';
      }
      return 'Ca Thường';
    };

    // SHEET 1: DANH SÁCH CA ĐÃ CHỈNH SỬA
    const rows: any[][] = [];

    // Header title
    rows.push(['AEON VIỆT NAM - CHI NHÁNH HẢI PHÒNG LÊ CHÂN']);
    rows.push([title || 'DANH SÁCH CA LÀM VIỆC ĐÃ ĐIỀU CHỈNH / ĐỔI CA']);
    rows.push([
      `Tuần làm việc: ${weekId || 'Hiện tại'} | Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')} | Tổng số ca điều chỉnh: ${entries.length} ca`,
    ]);
    rows.push([]); // Empty row

    // Table column headers
    rows.push([
      'STT',
      'Mã NV',
      'Họ Và Tên Nhân Viên',
      'Ngày Làm Việc',
      'Thứ',
      'Ca Ban Đầu (Gốc)',
      'Ca Sau Khi Sửa (Mới)',
      'Phân Loại Ca Mới',
      'Trạng Thái Sync Lịch Cứng',
      'Thời Gian Sync / Cập Nhật',
      'Lý Do / Ghi Chú Điều Chỉnh',
    ]);

    // Sort entries: Date (ascending) -> Employee Name (ascending) -> Employee ID (ascending)
    const sortedEntries = [...entries].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      const dateCompare = dateA.localeCompare(dateB);
      if (dateCompare !== 0) return dateCompare;

      const nameA = (a.employeeName || '').trim();
      const nameB = (b.employeeName || '').trim();
      const nameCompare = nameA.localeCompare(nameB, 'vi');
      if (nameCompare !== 0) return nameCompare;

      const idA = (a.employeeId || '').trim();
      const idB = (b.employeeId || '').trim();
      return idA.localeCompare(idB, 'vi', { numeric: true });
    });

    sortedEntries.forEach((entry, idx) => {
      const dayLabel = getDayLabel(entry.date, entry.dayOfWeek);
      const catLabel = getShiftCategoryLabel(entry.shiftCode);
      const syncStatus = entry.isHardRosterSynced
        ? 'ĐÃ SYNC LỊCH CỨNG & BÁO NV'
        : 'CHƯA SYNC (CẦN SỬA LỊCH CỨNG)';
      
      let syncTime = '';
      if (entry.syncedAt) {
        try {
          const d = new Date(entry.syncedAt);
          syncTime = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
          syncTime = entry.syncedAt;
        }
      } else if (entry.modifiedAt) {
        try {
          const d = new Date(entry.modifiedAt);
          syncTime = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
          syncTime = entry.modifiedAt;
        }
      }

      rows.push([
        idx + 1,
        entry.employeeId || '',
        entry.employeeName || '',
        entry.date || '',
        dayLabel,
        entry.originalShiftCode || entry.shiftCode || '',
        entry.shiftCode || '',
        catLabel,
        syncStatus,
        syncTime,
        entry.modificationNote || '',
      ]);
    });

    const wsModified = XLSX.utils.aoa_to_sheet(rows);

    // Merge title headers
    wsModified['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
    ];

    wsModified['!cols'] = [
      { wch: 6 },  // STT
      { wch: 12 }, // Mã NV
      { wch: 28 }, // Họ Và Tên
      { wch: 14 }, // Ngày
      { wch: 12 }, // Thứ
      { wch: 18 }, // Ca Ban Đầu
      { wch: 22 }, // Ca Sau Khi Sửa
      { wch: 16 }, // Phân Loại Ca
      { wch: 28 }, // Trạng Thái Sync
      { wch: 24 }, // Thời Gian Sync
      { wch: 36 }, // Ghi Chú
    ];

    XLSX.utils.book_append_sheet(wb, wsModified, 'DS_Ca_Da_Dieu_Chinh');

    // SHEET 2: MA TRẬN TOÀN TUẦN CÓ ĐÁNH DẤU CA ĐÃ SỬA (NẾU CÓ DỮ LIỆU)
    if (allWeeklySchedule.length > 0 && weekId) {
      const dates = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysToDateStr(weekId, i));
      const dayCols = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

      // Build employee map
      const empMap = new Map<string, { id: string; name: string }>();
      allWeeklySchedule.forEach((e) => {
        const key = (e.employeeId || e.employeeName).trim().toLowerCase();
        if (!empMap.has(key)) {
          empMap.set(key, { id: e.employeeId || '', name: e.employeeName });
        }
      });

      const empList = Array.from(empMap.values()).sort((a, b) => {
        if (a.id && b.id) return a.id.localeCompare(b.id, 'vi', { numeric: true });
        return a.name.localeCompare(b.name, 'vi');
      });

      const matrixRows: any[][] = [];
      matrixRows.push(['MA TRẬN CA LÀM VIỆC TUẦN (ĐÃ CẬP NHẬT ĐIỀU CHỈNH)']);
      matrixRows.push([`Tuần: ${weekId} | Ghi chú: Ký hiệu [Gốc ➔ Mới] là các ca đã được điều chỉnh`]);
      matrixRows.push([]);
      matrixRows.push(['STT', 'Mã NV', 'Họ Và Tên', ...dayCols, 'Tổng Số Ca Đã Đổi']);

      empList.forEach((emp, eIdx) => {
        const rowData: any[] = [eIdx + 1, emp.id, emp.name];
        let modifiedCount = 0;

        dates.forEach((dStr) => {
          const match = allWeeklySchedule.find((e) => {
            if (e.date !== dStr) return false;
            const eName = (e.employeeName || '').trim().toLowerCase();
            const eId = (e.employeeId || '').trim().toLowerCase();
            const targetId = emp.id.trim().toLowerCase();
            const targetName = emp.name.trim().toLowerCase();
            return (targetId && eId && targetId === eId) || (targetName && eName === targetName);
          });

          if (match) {
            const isMod = !!(match.originalShiftCode && match.originalShiftCode !== match.shiftCode);
            if (isMod) {
              modifiedCount++;
              rowData.push(`${match.shiftCode} (Sửa từ ${match.originalShiftCode})`);
            } else {
              rowData.push(match.shiftCode || '-');
            }
          } else {
            rowData.push('-');
          }
        });

        rowData.push(modifiedCount > 0 ? `${modifiedCount} ca` : '-');
        matrixRows.push(rowData);
      });

      const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
      wsMatrix['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      ];
      wsMatrix['!cols'] = [
        { wch: 6 },
        { wch: 12 },
        { wch: 26 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Ma_Tran_Lich_Tuan_Cap_Nhat');
    }

    const safeWeek = (weekId || new Date().toISOString().split('T')[0]).replace(/[^0-9a-zA-Z]/g, '_');
    const fileName = `DS_Ca_Da_Dieu_Chinh_Tuan_${safeWeek}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },
};
