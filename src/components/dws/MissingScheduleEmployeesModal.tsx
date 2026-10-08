import React from 'react';
import { Modal } from '../common/Modal';
import { MissingScheduleEmployee } from '../../types';
import { UserPlus, UserX, AlertCircle, CheckCircle2, ShieldAlert, Calendar, Clock, RefreshCw } from 'lucide-react';

interface MissingScheduleEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingEmployees: MissingScheduleEmployee[];
  onAddEmployee: (emp: MissingScheduleEmployee) => void;
  onExcludeEmployee: (emp: MissingScheduleEmployee) => void;
  onRestoreEmployee: (emp: MissingScheduleEmployee) => void;
  onAddAll: () => void;
  onExcludeAll: () => void;
}

export const MissingScheduleEmployeesModal: React.FC<MissingScheduleEmployeesModalProps> = ({
  isOpen,
  onClose,
  missingEmployees,
  onAddEmployee,
  onExcludeEmployee,
  onRestoreEmployee,
  onAddAll,
  onExcludeAll,
}) => {
  const unresolvedCount = missingEmployees.filter((e) => !e.isExcluded).length;
  const excludedCount = missingEmployees.filter((e) => e.isExcluded).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-800">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-black">Xử lý nhân viên chưa có trong Danh sách nhân viên</div>
            <div className="text-xs font-normal text-slate-500">
              Nhân viên có ca làm việc nhưng đã bị xóa hoặc chưa được thêm vào danh mục nhân viên
            </div>
          </div>
        </div>
      }
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div className="text-xs text-slate-500 font-medium">
            {unresolvedCount > 0 ? (
              <span className="text-amber-700 font-bold">Còn {unresolvedCount} nhân viên cần xử lý</span>
            ) : (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn tất xử lý tất cả nhân viên
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-button px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Notice Info Box */}
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-xs text-slate-700 space-y-1.5 leading-relaxed">
          <div className="font-bold text-amber-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            Hướng dẫn xử lý nhân viên:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11.5px]">
            <li>
              <strong className="text-emerald-800">Thêm nhân viên:</strong> Bổ sung trực tiếp nhân viên này vào{' '}
              <strong>Danh sách nhân viên</strong> với thông tin mặc định (Bộ phận Thu ngân, đứng quầy Siêu thị) và cho phép phân quầy bình thường.
            </li>
            <li>
              <strong className="text-rose-800">Không phân quầy:</strong> Loại trừ nhân viên này khỏi danh sách phân quầy (sẽ không xuất hiện trong bảng Chưa phân quầy và không bị xếp quầy tự động).
            </li>
          </ul>
        </div>

        {/* Batch Actions Bar */}
        {missingEmployees.length > 0 && (
          <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-100/80 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">
              Tổng cộng: {missingEmployees.length} nhân viên ({unresolvedCount} chờ xử lý, {excludedCount} đã chọn không phân quầy)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAddAll}
                className="neu-button-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
                title="Bổ sung tất cả nhân viên vào danh sách nhân viên"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Thêm tất cả</span>
              </button>
              <button
                type="button"
                onClick={onExcludeAll}
                className="neu-button-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 rounded-lg cursor-pointer hover:bg-rose-50"
                title="Đánh dấu không phân quầy cho tất cả"
              >
                <UserX className="w-3.5 h-3.5 text-rose-600" />
                <span>Không phân quầy tất cả</span>
              </button>
            </div>
          </div>
        )}

        {/* Employee List */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {missingEmployees.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Tất cả nhân viên trong ca làm việc tuần này đều đã có đầy đủ trong Danh sách nhân viên!
            </div>
          ) : (
            missingEmployees.map((emp) => {
              return (
                <div
                  key={emp.employeeId || emp.employeeName}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    emp.isExcluded
                      ? 'bg-slate-50 border-slate-200 opacity-90'
                      : 'bg-white border-amber-200/90 shadow-sm'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900">{emp.employeeName}</span>
                      {emp.employeeId ? (
                        <span className="neu-pill px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600">
                          {emp.employeeId}
                        </span>
                      ) : (
                        <span className="neu-pill px-2 py-0.5 text-[9.5px] font-semibold text-slate-500">
                          Chưa có mã NV
                        </span>
                      )}
                      {emp.isExcluded ? (
                        <span className="neu-pill bg-rose-50 border-rose-200 text-rose-700 text-[10px] font-bold px-2 py-0.5">
                          🚫 Đang chọn: Không phân quầy
                        </span>
                      ) : (
                        <span className="neu-pill bg-amber-50 border-amber-300 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                          ⚠️ Đã bị xóa / Chưa có trong DS
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {emp.dates.length} ngày có ca: {emp.dates.join(', ')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Ca: {emp.shiftCodes.join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Actions for this employee */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onAddEmployee(emp)}
                      className="neu-button-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
                      title="Bổ sung vào Danh sách nhân viên"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Thêm nhân viên</span>
                    </button>

                    {!emp.isExcluded ? (
                      <button
                        type="button"
                        onClick={() => onExcludeEmployee(emp)}
                        className="neu-button-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 rounded-lg cursor-pointer hover:bg-rose-50"
                        title="Không cho vào danh sách phân quầy"
                      >
                        <UserX className="w-3.5 h-3.5 text-rose-600" />
                        <span>Không phân quầy</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRestoreEmployee(emp)}
                        className="neu-button-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg cursor-pointer hover:bg-slate-100"
                        title="Hủy bỏ trạng thái không phân quầy"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                        <span>Phân quầy lại</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
