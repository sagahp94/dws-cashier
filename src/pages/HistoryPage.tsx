import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { HistoryRecord } from '../types';
import { useToast } from '../components/common/ToastContainer';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import {
  History,
  RotateCcw,
  Trash2,
  Calendar,
  UserCheck,
  LayoutGrid,
  Clock,
  ArrowRight,
  Download,
} from 'lucide-react';

interface HistoryPageProps {
  historyRecords: HistoryRecord[];
  onRestoreRecord: (record: HistoryRecord) => void;
  onDataChanged: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  historyRecords,
  onRestoreRecord,
  onDataChanged,
}) => {
  const { success, info } = useToast();
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const [isClearHistoryOpen, setIsClearHistoryOpen] = useState(false);

  const handleRestore = () => {
    if (!selectedRecord) return;
    onRestoreRecord(selectedRecord);
    setIsConfirmRestoreOpen(false);
    success(`Đã khôi phục thành công bản phân quầy ngày ${selectedRecord.date}`);
  };

  const handleClearHistory = () => {
    storageService.clearHistory();
    setIsClearHistoryOpen(false);
    onDataChanged();
    success('Đã xóa toàn bộ lịch sử phân quầy.');
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN')}`;
  };

  return (
    <div id="history-page" className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="neu-panel p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Lịch sử phân quầy DWS</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ghi nhận các mốc lưu trữ phân quầy theo từng ngày và hỗ trợ khôi phục khi cần thiết
              </p>
            </div>
          </div>
        </div>

        {historyRecords.length > 0 && (
          <button
            type="button"
            onClick={() => setIsClearHistoryOpen(true)}
            className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa lịch sử</span>
          </button>
        )}
      </div>

      {historyRecords.length === 0 ? (
        <EmptyState
          title="Chưa có bản ghi lịch sử nào"
          description="Khi bạn thực hiện phân quầy và lưu lại, các mốc lịch sử sẽ tự động hiển thị tại đây để bạn có thể xem lại hoặc khôi phục."
        />
      ) : (
        <div className="neu-panel overflow-hidden">
          <div className="overflow-x-auto text-xs">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-left">Thời điểm lưu</th>
                  <th className="py-3 px-4 text-left">Ngày phân quầy</th>
                  <th className="py-3 px-4 text-left">Người thực hiện</th>
                  <th className="py-3 px-4 text-center">Đi làm</th>
                  <th className="py-3 px-4 text-center">Đã phân</th>
                  <th className="py-3 px-4 text-center">Chưa phân</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {historyRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{formatDate(record.timestamp)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {record.dayName} — {record.date}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{record.author}</td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-800">{record.workingCount}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-700">{record.assignedCount}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-semibold ${
                          record.unassignedCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {record.unassignedCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecord(record);
                          setIsConfirmRestoreOpen(true);
                        }}
                        className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 rounded-lg transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-teal-700" />
                        <span>Khôi phục</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Restore Dialog */}
      <ConfirmDialog
        isOpen={isConfirmRestoreOpen}
        onClose={() => setIsConfirmRestoreOpen(false)}
        onConfirm={handleRestore}
        title="Khôi phục bản phân quầy"
        message={
          <div>
            Bạn có chắc chắn muốn khôi phục phân quầy ngày{' '}
            <strong>
              {selectedRecord?.dayName} ({selectedRecord?.date})
            </strong>{' '}
            từ bản lưu lúc <strong>{selectedRecord ? formatDate(selectedRecord.timestamp) : ''}</strong>?
            <br />
            Phân quầy hiện tại của ngày này sẽ được thay thế bằng bản lưu.
          </div>
        }
        confirmText="Xác nhận khôi phục"
        cancelText="Hủy"
        type="warning"
      />

      {/* Confirm Clear History Dialog */}
      <ConfirmDialog
        isOpen={isClearHistoryOpen}
        onClose={() => setIsClearHistoryOpen(false)}
        onConfirm={handleClearHistory}
        title="Xóa toàn bộ lịch sử"
        message="Bạn có chắc chắn muốn xóa tất cả các mốc lịch sử đã ghi nhận không? Dữ liệu phân quầy hiện tại sẽ không bị ảnh hưởng."
        confirmText="Xóa lịch sử"
        cancelText="Hủy"
        type="danger"
      />
    </div>
  );
};
