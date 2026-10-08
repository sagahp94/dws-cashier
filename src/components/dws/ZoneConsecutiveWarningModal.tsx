import React from 'react';
import { Modal } from '../common/Modal';
import { ZoneStreakWarning } from '../../types';
import { getZoneBadgeConfig } from '../../services/zoneTrackingService';
import {
  AlertTriangle,
  UserCheck,
  Calendar,
  Layers,
  Sparkles,
  XCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

interface ZoneConsecutiveWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  warning: ZoneStreakWarning | null;
  onConfirmAssign: () => void; // Có nhân viên mới -> Xếp quầy
  onCancelAssign: () => void;  // Không có nhân viên mới -> Hủy, không xếp
}

export const ZoneConsecutiveWarningModal: React.FC<ZoneConsecutiveWarningModalProps> = ({
  isOpen,
  onClose,
  warning,
  onConfirmAssign,
  onCancelAssign,
}) => {
  if (!warning) return null;

  const zoneBadge = getZoneBadgeConfig(warning.targetZone);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-amber-900">
          <div className="p-2 rounded-xl bg-amber-100/90 text-amber-700 border border-amber-200 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <span className="font-bold text-base text-slate-900">Cảnh báo: Nhân viên đứng cùng khu vực 3 ngày liên tiếp</span>
        </div>
      }
      description="Phát hiện nhân viên chuẩn bị đứng tại 1 khu vực 3 ngày liên tục. Cần xác nhận lý do nghiệp vụ."
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Nhân viên & Khu vực Info Box */}
        <div className="glass-panel border-amber-200/80 bg-amber-50/70 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-500">Nhân viên:</div>
              <div className="text-sm font-black text-slate-900 flex items-center gap-2 mt-0.5">
                <span>{warning.employeeName}</span>
                {warning.employeeId && (
                  <span className="text-xs font-mono text-slate-600 bg-white/90 px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    {warning.employeeId}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-slate-500">Khu vực phân quầy:</div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black border mt-0.5 shadow-2xs ${zoneBadge.bg} ${zoneBadge.text} ${zoneBadge.border}`}>
                {warning.targetZone}
              </span>
            </div>
          </div>

          <div className="glass-card rounded-xl p-3 border-amber-200/70 text-xs text-slate-700 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Chuỗi {warning.streakDays} ngày làm việc liên tiếp tại khu vực {warning.targetZone}:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pl-5 font-mono text-[11px] text-slate-600">
              {warning.dates.map((dateStr, idx) => {
                const isToday = idx === warning.dates.length - 1;
                return (
                  <React.Fragment key={dateStr}>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        isToday
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-[0_2px_8px_rgba(245,158,11,0.3)]'
                          : 'bg-white/90 text-slate-700 border border-slate-200 shadow-2xs'
                      }`}
                    >
                      {dateStr} {isToday ? '(Hôm nay)' : ''}
                    </span>
                    {idx < warning.dates.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quy định & Lý do nghiệp vụ */}
        <div className="p-3.5 glass-panel rounded-2xl space-y-2 text-xs text-slate-700 shadow-xs">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-slate-900">Quy định luân chuyển & ngoại lệ nhân viên mới:</div>
              <p className="text-slate-600 leading-relaxed">
                Nhân viên đứng tại một khu vực (<strong>Siêu thị / Delica / Bánh mì</strong>) 3 ngày liên tiếp cần được luân chuyển sang khu vực khác để đảm bảo cân bằng kỹ năng. Trường hợp có nhân viên mới nhận ca/học việc, nhân viên cũ sẽ nhường các quầy siêu thị cho nhân viên mới.
              </p>
            </div>
          </div>
        </div>

        {/* Câu hỏi xác nhận */}
        <div className="p-4 bg-slate-100/80 border border-slate-200 rounded-2xl text-center space-y-1 shadow-xs">
          <div className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
            Xác nhận trường hợp nhân sự hôm nay:
          </div>
          <div className="text-sm font-extrabold text-slate-900">
            Hôm nay có nhân viên mới (cần nhường quầy) hay không?
          </div>
        </div>

        {/* 2 Nút hành động */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Lựa chọn 1: Không có nhân viên mới -> Không xếp */}
          <button
            type="button"
            id="btn-zone-warning-decline"
            onClick={() => {
              onCancelAssign();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300/80 glass-card text-slate-700 font-bold text-xs hover:bg-white hover:border-slate-400 transition-all shadow-xs cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-slate-500" />
            <span>Không có NV mới (Không xếp)</span>
          </button>

          {/* Lựa chọn 2: Có nhân viên mới -> Xếp cho nhân viên */}
          <button
            type="button"
            id="btn-zone-warning-confirm"
            onClick={() => {
              onConfirmAssign();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass-button-primary font-bold text-xs cursor-pointer shadow-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>Có NV mới (Xác nhận xếp)</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
