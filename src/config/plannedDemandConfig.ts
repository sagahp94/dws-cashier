/**
 * CẤU HÌNH SỐ LƯỢNG QUẦY DỰ KIẾN (KẾ HOẠCH ĐỊNH BIÊN MỞ QUẦY)
 * Phân chia theo từng ngày trong tuần (Thứ 2 -> Chủ Nhật)
 * và theo 2 khu vực chính: SIÊU THỊ & FL2 (Delica / Bánh mỳ / Tầng 2)
 */

export interface AreaShiftPlannedTarget {
  dayOfWeek: number; // 1: Thứ 2, 2: Thứ 3, ..., 6: Thứ 7, 7: Chủ Nhật
  dayName: string;
  sieuThi: {
    morning: number; // Ca sáng
    night: number;   // Ca tối / chiều
    total: number;   // Tổng quầy dự kiến Siêu thị
  };
  fl2: {
    morning: number; // Ca sáng
    night: number;   // Ca tối / chiều
    total: number;   // Tổng quầy dự kiến FL2
  };
  totalMorning: number; // Tổng sáng toàn siêu thị
  totalNight: number;   // Tổng tối toàn siêu thị
  grandTotal: number;   // Tổng cả ngày
}

/**
 * BẢNG DỰ KIẾN THEO QUY ĐỊNH:
 * 
 * SIÊU THỊ
 * Ca sáng:
 * - Thứ 2: 11 quầy
 * - Thứ 3: 11 quầy
 * - Thứ 4: 13 quầy
 * - Thứ 5: 11 quầy
 * - Thứ 6: 13 quầy
 * - Thứ 7: 24 quầy
 * - Chủ nhật: 26 quầy
 * 
 * Ca tối:
 * - Thứ 2: 16 quầy
 * - Thứ 3: 16 quầy
 * - Thứ 4: 18 quầy
 * - Thứ 5: 16 quầy
 * - Thứ 6: 18 quầy
 * - Thứ 7: 26 quầy
 * - Chủ nhật: 26 quầy
 * 
 * FL2
 * Ca sáng:
 * - Thứ 2: 8 quầy
 * - Thứ 3: 8 quầy
 * - Thứ 4: 9 quầy
 * - Thứ 5: 8 quầy
 * - Thứ 6: 9 quầy
 * - Thứ 7: 18 quầy
 * - Chủ nhật: 19 quầy
 * 
 * Ca tối:
 * - Thứ 2: 10 quầy
 * - Thứ 3: 10 quầy
 * - Thứ 4: 11 quầy
 * - Thứ 5: 10 quầy
 * - Thứ 6: 11 quầy
 * - Thứ 7: 19 quầy
 * - Chủ nhật: 18 quầy
 */
export const PLANNED_WEEKLY_DEMAND_CONFIG: Record<number, AreaShiftPlannedTarget> = {
  1: {
    dayOfWeek: 1,
    dayName: 'Thứ 2',
    sieuThi: { morning: 11, night: 16, total: 27 },
    fl2: { morning: 8, night: 10, total: 18 },
    totalMorning: 19,
    totalNight: 26,
    grandTotal: 45,
  },
  2: {
    dayOfWeek: 2,
    dayName: 'Thứ 3',
    sieuThi: { morning: 11, night: 16, total: 27 },
    fl2: { morning: 8, night: 10, total: 18 },
    totalMorning: 19,
    totalNight: 26,
    grandTotal: 45,
  },
  3: {
    dayOfWeek: 3,
    dayName: 'Thứ 4',
    sieuThi: { morning: 13, night: 18, total: 31 },
    fl2: { morning: 9, night: 11, total: 20 },
    totalMorning: 22,
    totalNight: 29,
    grandTotal: 51,
  },
  4: {
    dayOfWeek: 4,
    dayName: 'Thứ 5',
    sieuThi: { morning: 11, night: 16, total: 27 },
    fl2: { morning: 8, night: 10, total: 18 },
    totalMorning: 19,
    totalNight: 26,
    grandTotal: 45,
  },
  5: {
    dayOfWeek: 5,
    dayName: 'Thứ 6',
    sieuThi: { morning: 13, night: 18, total: 31 },
    fl2: { morning: 9, night: 11, total: 20 },
    totalMorning: 22,
    totalNight: 29,
    grandTotal: 51,
  },
  6: {
    dayOfWeek: 6,
    dayName: 'Thứ 7',
    sieuThi: { morning: 24, night: 26, total: 50 },
    fl2: { morning: 18, night: 19, total: 37 },
    totalMorning: 42,
    totalNight: 45,
    grandTotal: 87,
  },
  7: {
    dayOfWeek: 7,
    dayName: 'Chủ Nhật',
    sieuThi: { morning: 26, night: 26, total: 52 },
    fl2: { morning: 19, night: 18, total: 37 },
    totalMorning: 45,
    totalNight: 44,
    grandTotal: 89,
  },
};

/**
 * Lấy chỉ tiêu quầy dự kiến theo ngày (YYYY-MM-DD)
 */
export function getPlannedTargetByDate(dateStr: string): AreaShiftPlannedTarget {
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12);
      const day = d.getDay(); // 0: CN, 1: T2, ..., 6: T7
      const dayOfWeek = day === 0 ? 7 : day;
      return PLANNED_WEEKLY_DEMAND_CONFIG[dayOfWeek] || PLANNED_WEEKLY_DEMAND_CONFIG[1];
    }
  } catch (err) {
    console.error('getPlannedTargetByDate error:', err);
  }
  return PLANNED_WEEKLY_DEMAND_CONFIG[1];
}
