import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Info, Trash2, CheckCircle2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  type = 'warning',
  isLoading = false,
}) => {
  const iconMap = {
    danger: <Trash2 className="w-6 h-6 text-rose-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    info: <Info className="w-6 h-6 text-blue-600" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
  };

  const bgMap = {
    danger: 'bg-rose-50/70 border-rose-200/80 backdrop-blur-md',
    warning: 'bg-amber-50/70 border-amber-200/80 backdrop-blur-md',
    info: 'bg-blue-50/70 border-blue-200/80 backdrop-blur-md',
    success: 'bg-emerald-50/70 border-emerald-200/80 backdrop-blur-md',
  };

  const btnMap = {
    danger: 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-[0_4px_12px_rgba(225,29,72,0.3)]',
    warning: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)]',
    info: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]',
    success: 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md" showCloseButton={!isLoading}>
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${bgMap[type]}`}>
          <div className="shrink-0 mt-0.5">{iconMap[type]}</div>
          <div className="text-sm text-slate-700 leading-relaxed">{message}</div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="glass-button-secondary px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 ${btnMap[type]}`}
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
