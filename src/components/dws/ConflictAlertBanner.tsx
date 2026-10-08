import React, { useState } from 'react';
import { ValidationIssue } from '../../types';
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Wrench } from 'lucide-react';

interface ConflictAlertBannerProps {
  issues: ValidationIssue[];
  onAutoFix?: () => void;
}

export const ConflictAlertBanner: React.FC<ConflictAlertBannerProps> = ({ issues, onAutoFix }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!issues || issues.length === 0) return null;

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  const hasErrors = errors.length > 0;

  return (
    <div
      id="conflict-alert-banner"
      className={`rounded-xl border px-4 py-3 transition-all ${
        hasErrors ? 'bg-rose-50/70 border-rose-200 text-rose-900' : 'bg-amber-50/70 border-amber-200 text-amber-900'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {hasErrors ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <div>
            <div className="text-xs font-bold">
              Phát hiện {issues.length} vấn đề kiểm tra dữ liệu phân quầy
              {hasErrors && ` (${errors.length} lỗi nghiêm trọng)`}
            </div>
            <div className="text-[11px] opacity-80 mt-0.5">
              {hasErrors
                ? 'Một số nhân viên bị phân trùng hoặc chưa khớp lịch làm việc hôm nay.'
                : 'Cảnh báo tính hợp lệ của quầy hoặc ca làm việc.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {onAutoFix && (
            <button
              type="button"
              onClick={onAutoFix}
              className="neu-button-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              title="Tự động đồng bộ nhân viên và khôi phục lịch phân quầy"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Khắc phục &amp; Đồng bộ</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="neu-button-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Chi tiết ({issues.length})</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-current/20 space-y-1.5 max-h-48 overflow-y-auto text-xs">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg flex items-start gap-2 ${
                issue.type === 'error' ? 'bg-rose-100/60 text-rose-950 font-medium' : 'bg-amber-100/60 text-amber-950'
              }`}
            >
              <span className="font-bold shrink-0">{idx + 1}.</span>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
