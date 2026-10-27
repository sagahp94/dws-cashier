import { DayDwsAssignment, WeeklyScheduleEntry } from '../types';

export interface CleaningDutyAssignment {
  v815Employees: string[];
  v814Employees: string[];
  allMorningEmployees: string[];
  task1: string; // Lau quầy (Lau tấm chắn)+ chồng bao rác (1-15)
  task2: string; // Lau quầy (Lau tấm chắn)+ chồng bao rác (16-27)
  task3: string; // Lau quầy (Lau tấm chắn)+ chồng bao rác (101-109+306)
  task4: string[]; // Dọn vs quầy + túi quầy TNTT (110-117) - 2 người
  task5: string; // Giặt khăn + Lau rổ đựng hàng trả + Gom hàng trả
  task6: string; // Lấy thùng catton, dọn khu vực thùng catton
  task7: string; // Gom túi pos tạm
  task5s: string[]; // Vệ sinh 5S kho - 2 bạn ca V814
}

export interface DutyCode {
  code: string;
  description: string;
}

export const JOB_CODES_LIST: DutyCode[] = [
  { code: 'A', description: 'Vệ sinh quầy, sắp xếp bao xốp, ...' },
  { code: 'B', description: 'Họp ngắn đầu ca (hoặc đọc sổ ...' },
  { code: 'C', description: 'Chuẩn bị tiền lẻ tại quầy' },
  { code: 'D', description: 'Đổi tiền lẻ từ phòng kế toán' },
  { code: 'E', description: 'Dọn xe đẩy, sensor, thu gom ...' },
  { code: 'F', description: 'Tự đóng quầy nghỉ giữa ca - ăn ...' },
  { code: 'G', description: 'Hỗ trợ thế quầy (VD: G30, G31)' },
  { code: 'H', description: 'Giao ca (giữa ca sáng và chiều), ...' },
  { code: 'I', description: 'Kết quầy, Làm báo cáo cuối ngày' },
  { code: 'J', description: 'Tham gia đào tạo (Tại bộ phận ...)' },
  { code: 'K', description: 'Tham gia sự kiện công ty' },
  { code: 'L', description: 'Phân phát dụng cụ làm việc, bao ...' },
  { code: 'M', description: 'Hỗ trợ GL (nhận tiền lẻ buổi ...)' },
  { code: 'N', description: 'Thu gom tiền bán hàng, tiền trích ...' },
  { code: 'O', description: 'Nộp tiền vào két sắt tại phòng kế ...' },
  { code: 'P', description: 'Hỗ trợ bỏ bao tại các quầy thu ...' },
  { code: 'Q', description: 'Quan sát, điều phối và hỗ trợ ...' },
  { code: 'S', description: 'Hỗ trợ ngành hàng sắp xếp hàng ...' },
  { code: 'T', description: 'Kiểm tra thông tin khuyến mãi, ...' },
  { code: 'X', description: 'Kết ca cuối ngày cho nhân viên ...' },
  { code: 'PA', description: 'Nhân lực hỗ trợ bỏ bao xốp' },
  { code: 'SP', description: 'Nhân lực hỗ trợ đứng quầy' },
  { code: 'F/R', description: 'Có GL/Supporter thế quầy nghỉ' },
];

/**
 * Tự động trích xuất và gán nhiệm vụ dọn vệ sinh đầu ca cho ca V815 và 5S kho cho 2 bạn ca V814
 * Quy tắc:
 * - Chỉ gán tự động cho các bạn có ca làm việc V815.
 * - Nếu đã fill hết nhân viên ca V815 mà chưa đủ thì để trống mục đó (không dùng ca khác).
 * - Ưu tiên các mục từ trên xuống theo thứ tự:
 *   1. Lau quầy (1-15) -> V815 #1
 *   2. Lau quầy (16-27) -> V815 #2
 *   3. Lau quầy (101-109+306) -> V815 #3
 *   4. Dọn vs quầy + túi quầy TNTT (110-117) -> V815 #4 & #5
 *   5. Giặt khăn + Lau rổ đựng hàng trả + Gom hàng trả -> V815 #6
 *   6. Lấy thùng catton, dọn khu vực thùng catton -> V815 #7
 *   7. Gom túi pos tạm -> V815 #8
 * - Vệ sinh 5S kho: Gán tự động cho 2 bạn có ca V814 (nếu thiếu thì để trống).
 */
export function extractCleaningDutyAssignments(
  date: string,
  assignment: DayDwsAssignment | null,
  weeklySchedule: WeeklyScheduleEntry[] = []
): CleaningDutyAssignment {
  const seen = new Set<string>();
  const workingEmployees: { name: string; shiftCode: string; counter?: string }[] = [];

  // 1. Lấy từ phân quầy ngày
  if (assignment && assignment.assignments) {
    Object.entries(assignment.assignments).forEach(([cId, ca]) => {
      if (ca?.morning?.employeeName) {
        const name = ca.morning.employeeName.trim();
        const code = (ca.morning.shiftCode || '').toUpperCase().trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          workingEmployees.push({ name, shiftCode: code, counter: cId });
        }
      }
      if (ca?.afternoon?.employeeName) {
        const name = ca.afternoon.employeeName.trim();
        const code = (ca.afternoon.shiftCode || '').toUpperCase().trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          workingEmployees.push({ name, shiftCode: code, counter: cId });
        }
      }
    });
  }

  // 2. Bổ sung từ lịch tuần nếu có nhân viên chưa phân quầy
  const schedToday = weeklySchedule.filter((e) => e.date === date);
  schedToday.forEach((e) => {
    const name = (e.employeeName || '').trim();
    const code = (e.shiftCode || '').toUpperCase().trim();
    if (name && !seen.has(name) && code !== 'OFF' && !code.includes('NGHI')) {
      seen.add(name);
      workingEmployees.push({ name, shiftCode: code });
    }
  });

  // Lọc danh sách nhân viên ca V815 (chỉ lấy ca V815)
  const v815Employees = workingEmployees
    .filter((e) => e.shiftCode.includes('V815'))
    .map((e) => e.name);

  // Lọc danh sách nhân viên ca V814 (dành cho 5S kho)
  const v814Employees = workingEmployees
    .filter((e) => e.shiftCode.includes('V814'))
    .map((e) => e.name);

  // Các nhân viên ca sáng tổng thể
  const allMorningPool = workingEmployees
    .filter((e) => e.shiftCode.startsWith('V8') || e.shiftCode.startsWith('V6') || e.shiftCode.startsWith('V7'))
    .map((e) => e.name);

  // Helper lấy nhân viên V815 theo index, nếu không có thì trả về rỗng ''
  const getV815Employee = (idx: number): string => {
    return v815Employees[idx] || '';
  };

  // Thứ tự ưu tiên từ trên xuống dưới (ưu tiên từ Lấy thùng catton trở lên trên):
  // 1. Lau quầy (1-15)
  const task1 = getV815Employee(0);
  // 2. Lau quầy (16-27)
  const task2 = getV815Employee(1);
  // 3. Lau quầy (101-109+306)
  const task3 = getV815Employee(2);
  // 4. Dọn vs quầy + túi TNTT 110-117 (2 người: slot 3 & slot 4)
  const task4_1 = getV815Employee(3);
  const task4_2 = getV815Employee(4);
  const task4 = [task4_1, task4_2].filter(Boolean);
  // 5. Giặt khăn + Lau rổ đựng hàng trả + Gom hàng trả
  const task5 = getV815Employee(5);
  // 6. Lấy thùng catton, dọn khu vực thùng catton
  const task6 = getV815Employee(6);
  // 7. Gom túi pos tạm (ở cuối cùng)
  const task7 = getV815Employee(7);

  // Vệ sinh 5S kho cho 2 bạn ca V814 (nếu không đủ thì để trống)
  const task5s = [v814Employees[0] || '', v814Employees[1] || ''].filter(Boolean);

  return {
    v815Employees,
    v814Employees,
    allMorningEmployees: allMorningPool,
    task1,
    task2,
    task3,
    task4,
    task5,
    task6,
    task7,
    task5s,
  };
}
