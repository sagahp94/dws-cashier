import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { SlotAssignment, Counter, ShiftSwapRequest, Shift } from '../../types';
import { storageService } from '../../services/storageService';
import { useToast } from '../common/ToastContainer';
import {
  ArrowLeftRight,
  Sun,
  Moon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Send,
  Trash2,
  Check,
} from 'lucide-react';

interface ShiftSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  weekId: string;
  counterId: string;
  counterNumber: string;
  slot: 'morning' | 'afternoon';
  slotAssignment: SlotAssignment | null;
  existingRequest?: ShiftSwapRequest | null;
  onSwapRequestSubmitted: (req: ShiftSwapRequest) => void;
  onSwapRequestCancelled: (requestId: string) => void;
}

const COMMON_REASONS = [
  'Bận việc gia đình / Cá nhân đột xuất',
  'Trùng lịch học / Lịch thi',
  'Vấn đề sức khỏe / Cần nghỉ dưỡng',
  'Nguyện vọng đổi từ Ca Sáng sang Ca Chiều',
  'Nguyện vọng đổi từ Ca Chiều sang Ca Sáng',
  'Tăng ca / Hỗ trợ đồng nghiệp',
  'Lý do khác (ghi rõ bên dưới)',
];

export const ShiftSwapModal: React.FC<ShiftSwapModalProps> = ({
  isOpen,
  onClose,
  date,
  weekId,
  counterId,
  counterNumber,
  slot,
  slotAssignment,
  existingRequest,
  onSwapRequestSubmitted,
  onSwapRequestCancelled,
}) => {
  const { success, warning, info } = useToast();

  const [reason, setReason] = useState(COMMON_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [preferredTarget, setPreferredTarget] = useState<string>('any');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (existingRequest) {
      setReason(existingRequest.reason || COMMON_REASONS[0]);
      setCustomNote(existingRequest.customNote || '');
      setPreferredTarget(existingRequest.preferredTarget || 'any');
      setUrgent(!!existingRequest.urgent);
    } else {
      setReason(COMMON_REASONS[0]);
      setCustomNote('');
      setPreferredTarget(slot === 'morning' ? 'afternoon' : 'morning');
      setUrgent(false);
    }
  }, [existingRequest, slot, isOpen]);

  if (!isOpen || !slotAssignment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newRequest: ShiftSwapRequest = {
      id: existingRequest?.id || `swap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date,
      weekId,
      counterId,
      counterNumber,
      slot,
      employeeId: slotAssignment.employeeId,
      employeeName: slotAssignment.employeeName,
      shiftCode: slotAssignment.shiftCode,
      startTime: slotAssignment.startTime,
      endTime: slotAssignment.endTime,
      reason,
      customNote: customNote.trim(),
      preferredTarget:
        preferredTarget === 'morning'
          ? 'Đổi sang Ca Sáng'
          : preferredTarget === 'afternoon'
          ? 'Đổi sang Ca Chiều'
          : 'Đổi với bất kỳ ca nào',
      urgent,
      requestedAt: existingRequest?.requestedAt || new Date().toISOString(),
      status: 'pending',
    };

    storageService.saveSwapRequest(newRequest);
    onSwapRequestSubmitted(newRequest);

    success(
      'Đã gửi yêu cầu đổi ca thành công!',
      `Thông báo đổi ca của ${slotAssignment.employeeName} (Quầy ${counterNumber}) đã được chuyển đến Quản lý.`
    );
    onClose();
  };

  const handleCancelRequest = () => {
    if (existingRequest) {
      storageService.updateSwapRequestStatus(existingRequest.id, 'cancelled');
      onSwapRequestCancelled(existingRequest.id);
      info('Đã hủy yêu cầu đổi ca', `Yêu cầu đổi ca của ${slotAssignment.employeeName} đã được rút lại.`);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-extrabold text-slate-900">
              {existingRequest ? 'Chi tiết & Quản lý Yêu cầu Đổi ca' : 'Đề xuất / Báo Yêu cầu Đổi ca (Swap Requested)'}
            </span>
            <p className="text-xs text-slate-500 font-normal">
              Gửi thông báo đề xuất nhượng ca hoặc hoán đổi ca đến bộ phận Quản lý phân quầy
            </p>
          </div>
        </div>
      }
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shift & Employee Context Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono font-black text-xs flex items-center justify-center shadow-3xs">
                {counterNumber}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {slotAssignment.employeeName}
                  {slotAssignment.employeeId && (
                    <span className="text-slate-400 font-mono ml-1 font-normal">
                      #{slotAssignment.employeeId}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Quầy {counterNumber} • Ngày {date}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black border inline-flex items-center gap-1 ${
                  slot === 'morning'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                }`}
              >
                {slot === 'morning' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                <span>Ca {slotAssignment.shiftCode} ({slot === 'morning' ? 'Sáng' : 'Chiều'})</span>
              </span>
              <div className="text-[10.5px] text-slate-400 font-mono">
                {slotAssignment.startTime || '08:00'} - {slotAssignment.endTime || '17:00'}
              </div>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3">
          {/* Reason Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Lý do xin đổi / nhượng ca:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-700 focus:outline-none cursor-pointer"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Preferred Swap Target */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nguyện vọng hoán đổi:
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPreferredTarget('morning')}
                className={`p-2 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                  preferredTarget === 'morning'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-3xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Sang Ca Sáng
              </button>
              <button
                type="button"
                onClick={() => setPreferredTarget('afternoon')}
                className={`p-2 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                  preferredTarget === 'afternoon'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-3xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Sang Ca Chiều
              </button>
              <button
                type="button"
                onClick={() => setPreferredTarget('any')}
                className={`p-2 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                  preferredTarget === 'any'
                    ? 'bg-teal-700 text-white border-teal-800 shadow-3xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Bất kỳ ca nào
              </button>
            </div>
          </div>

          {/* Detailed Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú chi tiết thêm (nếu có):
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Nhập ghi chú hoặc tên đồng nghiệp đã thỏa thuận đổi ca cùng..."
              className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-700 focus:outline-none"
            />
          </div>

          {/* Urgent Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
              />
              <span className="font-bold text-rose-950 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Đánh dấu Yêu cầu khẩn cấp (Cần xử lý gấp trong ngày)
              </span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div>
            {existingRequest ? (
              <button
                type="button"
                onClick={handleCancelRequest}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1 cursor-pointer transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hủy yêu cầu đổi ca</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
              >
                Đóng
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-teal-800 hover:from-amber-600 hover:to-teal-900 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{existingRequest ? 'Cập nhật yêu cầu' : 'Gửi yêu cầu đổi ca'}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
