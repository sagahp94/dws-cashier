import React from 'react';
import { Database, FileSpreadsheet, ArrowRight, Upload } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Chưa có dữ liệu để hiển thị',
  description = 'Vui lòng tải dữ liệu từ file Excel hoặc cấu hình danh mục để bắt đầu sử dụng.',
  actionText,
  onAction,
  icon,
  secondaryActionText,
  onSecondaryAction,
}) => {
  return (
    <div
      id="empty-state-container"
      className="w-full flex flex-col items-center justify-center p-8 md:p-12 text-center bg-white border border-dashed border-slate-300 rounded-xl"
    >
      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
        {icon || <Database className="w-6 h-6 text-slate-400" />}
      </div>

      <h3 className="text-sm font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-5">{description}</p>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {actionText && onAction && (
          <button
            type="button"
            id="empty-state-primary-action"
            onClick={onAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {actionText}
          </button>
        )}

        {secondaryActionText && onSecondaryAction && (
          <button
            type="button"
            id="empty-state-secondary-action"
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {secondaryActionText}
          </button>
        )}
      </div>
    </div>
  );
};
