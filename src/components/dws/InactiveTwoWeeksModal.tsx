import React from 'react';
import { Modal } from '../common/Modal';
import { InactiveTwoWeeksEmployee } from '../../types';
import { AlertTriangle, UserX, Eye, CheckCircle2, Calendar, ArrowRight } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

interface InactiveTwoWeeksModalProps {
  isOpen: boolean;
  onClose: () => void;
  inactiveEmployees: InactiveTwoWeeksEmployee[];
  onMarkResigned: (emp: InactiveTwoWeeksEmployee) => void;
  onMarkAllResigned: () => void;
  onManualReview: (emp?: InactiveTwoWeeksEmployee) => void;
}

export const InactiveTwoWeeksModal: React.FC<InactiveTwoWeeksModalProps> = ({
  isOpen,
  onClose,
  inactiveEmployees,
  onMarkResigned,
  onMarkAllResigned,
  onManualReview,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-slate-800">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 border border-rose-200 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">
              Cảnh báo nhân viên 2 tuần liên tiếp không có ca làm việc
            </div>
            <div className="text-xs font-normal text-slate-500">
              Nhân viên có tên trong danh sách đi làm nhưng không có ca làm việc nào trong 2 tuần liên tiếp. Nhân viên có phải đã nghỉ việc không?
            </div>
          </div>
        </div>
      }
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div className="text-xs text-slate-500 font-medium">
            {inactiveEmployees.length > 0 ? (
              <span className="text-rose-700 font-semibold">
                Có {inactiveEmployees.length} nhân viên cần xác nhận trạng thái làm việc
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã xử lý tất cả nhân viên
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {inactiveEmployees.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManualReview();
                }}
                className="neu-button-secondary px-3.5 py-2 text-xs font-semibold text-teal-800 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Xem xét thủ công tại Danh sách NV</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="neu-button-secondary px-4 py-2 text-xs font-semibold text-slate-700 rounded-lg cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Explanation Box */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2 leading-relaxed">
          <div className="font-semibold text-slate-900">Hướng dẫn 2 lựa chọn xử lý:</div>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11.5px]">
            <li>
              <strong className="text-rose-700">Đã nghỉ việc:</strong> Cập nhật ngay trạng thái nhân viên trong Danh sách nhân viên thành{' '}
              <strong>&ldquo;Nghỉ việc&rdquo;</strong> và tự động đưa vào mục <strong>Không phân quầy (Note: Nghỉ việc)</strong>.
            </li>
            <li>
              <strong className="text-teal-800">Xem xét thủ công:</strong> Chuyển đến mục{' '}
              <strong>Danh sách nhân viên</strong> để bạn trực tiếp kiểm tra và thực hiện các bước: vào Danh sách nhân viên{' '}
              <ArrowRight className="w-3 h-3 inline mx-0.5" /> tick <strong>&ldquo;Đã nghỉ việc&rdquo;</strong>{' '}
              <ArrowRight className="w-3 h-3 inline mx-0.5" /> chuyển nhân viên sang mục <strong>&ldquo;Nghỉ việc&rdquo;</strong> và không phân quầy.
            </li>
          </ul>
        </div>

        {/* Batch Action Bar */}
        {inactiveEmployees.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-rose-50/60 rounded-xl border border-rose-200">
            <span className="text-xs font-semibold text-rose-950">
              Phát hiện {inactiveEmployees.length} nhân viên không có ca làm việc trong 2 tuần liên tiếp
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onMarkAllResigned}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Đã nghỉ việc tất cả ({inactiveEmployees.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManualReview();
                }}
                className="neu-button-secondary px-3 py-1.5 text-xs font-semibold text-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-teal-700" />
                <span>Xem xét thủ công</span>
              </button>
            </div>
          </div>
        )}

        {/* Employee List */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {inactiveEmployees.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Tất cả nhân viên trong danh sách đã được cập nhật trạng thái!
            </div>
          ) : (
            inactiveEmployees.map((emp) => (
              <div
                key={emp.employeeId}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-rose-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{emp.fullName}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-700">
                      {emp.employeeId}
                    </span>
                    {emp.isSup && (
                      <span className="px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-[10px] font-bold text-purple-800">
                        SUP
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-[10px] font-semibold text-rose-700">
                      2 tuần không có ca làm việc
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Tuần trước ({formatDisplayDate(emp.previousWeekMonday)}):{' '}
                      <strong className="text-slate-700">
                        {emp.previousWeekOffShifts.length > 0
                          ? `Chỉ có ca nghỉ (${emp.previousWeekOffShifts.join(', ')})`
                          : '0 ca làm việc'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Tuần này ({formatDisplayDate(emp.currentWeekMonday)}):{' '}
                      <strong className="text-slate-700">
                        {emp.currentWeekOffShifts.length > 0
                          ? `Chỉ có ca nghỉ (${emp.currentWeekOffShifts.join(', ')})`
                          : '0 ca làm việc'}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onMarkResigned(emp)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                    title="Đánh dấu nhân viên này Đã nghỉ việc"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Đã nghỉ việc</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onManualReview(emp);
                    }}
                    className="neu-button-secondary px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-teal-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    title="Chuyển sang Danh sách nhân viên để kiểm tra và tick Đã nghỉ việc thủ công"
                  >
                    <Eye className="w-3.5 h-3.5 text-teal-700" />
                    <span>Xem xét thủ công</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
