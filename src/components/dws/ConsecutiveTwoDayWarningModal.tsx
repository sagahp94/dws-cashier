import React from 'react';
import { Modal } from '../common/Modal';
import { ConsecutiveTwoDayWarning } from '../../services/consecutiveWarningService';
import {
  AlertTriangle,
  ArrowRight,
  Store,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ConsecutiveTwoDayWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  warning: ConsecutiveTwoDayWarning | null;
  onConfirmAssign: () => void;
  onCancelAssign: () => void;
}

export const ConsecutiveTwoDayWarningModal: React.FC<ConsecutiveTwoDayWarningModalProps> = ({
  isOpen,
  onClose,
  warning,
  onConfirmAssign,
  onCancelAssign,
}) => {
  if (!warning) return null;

  const isSameCounter = warning.warningType === 'same_counter' || warning.warningType === 'both';
  const isSameCluster = warning.warningType === 'same_cluster' || warning.warningType === 'both';

  const day1Text = warning.direction === 'yesterday' ? warning.adjacentDateLabel : warning.targetDateLabel;
  const day1Counter = warning.direction === 'yesterday' ? warning.adjacentCounterNumber : warning.targetCounterNumber;
  const day1Cluster = warning.direction === 'yesterday' ? warning.adjacentCluster : warning.targetCluster;

  const day2Text = warning.direction === 'yesterday' ? warning.targetDateLabel : warning.adjacentDateLabel;
  const day2Counter = warning.direction === 'yesterday' ? warning.targetCounterNumber : warning.adjacentCounterNumber;
  const day2Cluster = warning.direction === 'yesterday' ? warning.targetCluster : warning.adjacentCluster;

  const titleText = isSameCounter && isSameCluster
    ? `Cảnh báo: Nhân viên đứng cùng Quầy ${warning.targetCounterNumber} (${warning.targetCluster?.shortLabel}) 2 ngày liên tiếp`
    : isSameCounter
    ? `Cảnh báo: Nhân viên đứng cùng Quầy ${warning.targetCounterNumber} trong 2 ngày liên tiếp`
    : `Cảnh báo: Nhân viên đứng ${warning.targetCluster?.name || 'cùng khu vực'} 2 ngày liên tiếp`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-amber-900">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <span className="font-bold text-base text-slate-900">{titleText}</span>
        </div>
      }
      description="Phát hiện nhân viên bị vi phạm quy tắc xoay vòng quầy trong 2 ngày liên tiếp. Vui lòng xác nhận trước khi phân quầy."
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Nhân viên info */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-500">Nhân viên vi phạm:</div>
              <div className="text-sm font-black text-slate-900 flex items-center gap-2 mt-0.5">
                <span>{warning.employeeName}</span>
                {warning.employeeId && (
                  <span className="text-xs font-mono text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                    {warning.employeeId}
                  </span>
                )}
              </div>
            </div>

            {/* Badge khu vực nếu có */}
            {warning.targetCluster && (
              <div className="text-right">
                <div className="text-xs font-bold text-slate-500">Khu vực kiểm soát:</div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-black border mt-0.5 shadow-2xs ${warning.targetCluster.bgBadge} ${warning.targetCluster.textBadge} ${warning.targetCluster.borderBadge}`}
                >
                  {warning.targetCluster.shortLabel}
                </span>
              </div>
            )}
          </div>

          {/* Timeline 2 ngày liên tiếp */}
          <div className="bg-white rounded-xl p-3.5 border border-amber-200 text-xs text-slate-700 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Lịch sử phân quầy trong 2 ngày liên tiếp:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-2 pt-1">
              {/* Ngày 1 */}
              <div className="sm:col-span-5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{day1Text}</span>
                  {warning.direction === 'yesterday' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 ml-auto">
                      Đã phân
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-900">Quầy {day1Counter}</div>
                    </div>
                  </div>
                  {day1Cluster && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${day1Cluster.bgBadge} ${day1Cluster.textBadge} ${day1Cluster.borderBadge}`}>
                      {day1Cluster.shortLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Mũi tên */}
              <div className="sm:col-span-1 flex items-center justify-center text-amber-600 py-1 sm:py-0">
                <ArrowRight className="w-5 h-5" />
              </div>

              {/* Ngày 2 */}
              <div className="sm:col-span-5 p-3 rounded-xl bg-amber-50 border-2 border-amber-300 flex flex-col justify-between shadow-2xs">
                <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>{day2Text}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 ml-auto">
                    Đang chọn
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-xs">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-900">Quầy {day2Counter}</div>
                    </div>
                  </div>
                  {day2Cluster && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${day2Cluster.bgBadge} ${day2Cluster.textBadge} ${day2Cluster.borderBadge}`}>
                      {day2Cluster.shortLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chi tiết cảnh báo theo yêu cầu nghiệp vụ */}
          <div className="p-3 bg-amber-100/60 rounded-xl border border-amber-200 text-xs text-amber-950 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>Quy tắc nghiệp vụ phân quầy:</span>
            </div>
            {isSameCounter && (
              <div>
                • <strong>Trùng quầy 2 ngày:</strong> Nhân viên đang được xếp đứng cùng <strong>Quầy {warning.targetCounterNumber}</strong> trong 2 ngày liên tục.
              </div>
            )}
            {isSameCluster && warning.targetCluster && (
              <div className="mt-1">
                • <strong>Trùng khu vực ({warning.targetCluster.shortLabel}):</strong> Cả 2 ngày đều thuộc <strong>{warning.targetCluster.displayRange}</strong>.
                {warning.warningType === 'same_cluster' && (
                  <span className="text-amber-800 block text-[11px] mt-0.5">
                    (Ví dụ: Thứ 2 đứng Quầy {warning.direction === 'yesterday' ? warning.adjacentCounterNumber : warning.targetCounterNumber}, Thứ 3 đứng Quầy {warning.direction === 'yesterday' ? warning.targetCounterNumber : warning.adjacentCounterNumber} ➔ Đều thuộc {warning.targetCluster.name})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            id="cancel-two-day-assign-btn"
            onClick={() => {
              onCancelAssign();
              onClose();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
          >
            <XCircle className="w-4 h-4 text-slate-500" />
            <span>Hủy &amp; Chọn quầy khác</span>
          </button>

          <button
            type="button"
            id="confirm-two-day-assign-btn"
            onClick={() => {
              onConfirmAssign();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-200" />
            <span>Vẫn phân quầy (Xác nhận ngoại lệ)</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
