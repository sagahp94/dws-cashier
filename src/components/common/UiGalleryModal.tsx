import React, { useState } from 'react';
import { Modal } from './Modal';
import { Image as ImageIcon, Download, ExternalLink, ChevronLeft, ChevronRight, ZoomIn, CheckCircle2 } from 'lucide-react';

interface UiScreenshotItem {
  id: string;
  title: string;
  description: string;
  category: string;
  imageSrc: string;
}

const UI_SCREENS: UiScreenshotItem[] = [
  {
    id: 'dashboard',
    title: '1. Bảng phân công quầy thu ngân DWS chính (Main Workspace)',
    description: 'Giao diện lưới quầy thu ngân chuẩn AEON với slot Sáng/Chiều, bộ lọc ca, thanh trạng thái nhân sự và bảng kéo thả nhân viên chưa phân quầy.',
    category: 'Tổng quan & Phân quầy',
    imageSrc: '/src/assets/images/dws_main_dashboard_1790562728674.jpg',
  },
  {
    id: 'auto_suggest',
    title: '2. Cửa sổ Gợi ý thông minh (Auto-Suggest AI & Heuristics)',
    description: 'Thuật toán heuristics tính điểm độ khớp (Match %), phân tích năng lực ca, quy tắc luân chuyển quầy và tự động lấp đầy quầy trống 1-click.',
    category: 'Tính năng thông minh',
    imageSrc: '/src/assets/images/dws_auto_suggest_modal_1790562738774.jpg',
  },
  {
    id: 'weekly_matrix',
    title: '3. Bảng tổng hợp tuần & Đối chiếu định biên (Weekly Roster Matrix)',
    description: 'Góc nhìn toàn cảnh 7 ngày trong tuần, đối chiếu định biên quầy Siêu thị & Tầng 2, kiểm soát cân bằng nhân sự và luân chuyển ca.',
    category: 'Báo cáo & Tổng hợp',
    imageSrc: '/src/assets/images/dws_weekly_matrix_view_1790562754262.jpg',
  },
  {
    id: 'print_preview',
    title: '4. Bản xem trước in biểu mẫu DWS khổ A4 chuẩn AEON',
    description: 'Mẫu biểu in Daily Work Schedule chuẩn khung giờ 08:00 - 22:00, phân trang 12 quầy/trang, cột giờ ăn và chữ ký xác nhận.',
    category: 'In ấn & Xuất file',
    imageSrc: '/src/assets/images/dws_printable_sheet_preview_1790562765827.jpg',
  },
];

interface UiGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UiGalleryModal: React.FC<UiGalleryModalProps> = ({ isOpen, onClose }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const currentScreen = UI_SCREENS[selectedIdx];

  const handleDownload = (imgSrc: string, title: string) => {
    const a = document.createElement('a');
    a.href = imgSrc;
    a.download = `${title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
            <ImageIcon className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-base">Bộ ảnh toàn bộ giao diện ứng dụng (UI Gallery)</span>
            <p className="text-xs text-slate-500 font-normal">
              Hình ảnh thiết kế độ phân giải cao để kiểm tra, đánh giá toàn diện các màn hình của hệ thống
            </p>
          </div>
        </div>
      }
      maxWidth="6xl"
      bodyClassName="p-4 sm:p-5 max-h-[88vh] overflow-y-auto"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {UI_SCREENS.map((screen, idx) => (
            <button
              key={screen.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                selectedIdx === idx
                  ? 'bg-teal-700 text-white border-teal-800 shadow-sm'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-0.5">
                {screen.category}
              </div>
              <div className="text-xs font-bold line-clamp-1">
                {screen.title}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Screen Large Display */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-md relative group">
          <img
            src={currentScreen.imageSrc}
            alt={currentScreen.title}
            className="w-full h-auto max-h-[58vh] object-contain mx-auto"
            referrerPolicy="no-referrer"
          />

          {/* Quick Overlay Controls */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-900/60 to-transparent p-4 flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="max-w-xl">
              <h4 className="text-sm font-extrabold flex items-center gap-2">
                {currentScreen.title}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentScreen.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={currentScreen.imageSrc}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Xem ảnh gốc</span>
              </a>
              <button
                type="button"
                onClick={() => handleDownload(currentScreen.imageSrc, currentScreen.title)}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ảnh về (.jpg)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnails Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {UI_SCREENS.map((screen, idx) => (
            <div
              key={screen.id}
              onClick={() => setSelectedIdx(idx)}
              className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                selectedIdx === idx ? 'border-teal-600 ring-2 ring-teal-200' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={screen.imageSrc}
                alt={screen.title}
                className="w-full h-24 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="p-2 bg-slate-50 text-[11px] font-bold text-slate-800 line-clamp-1 border-t border-slate-100">
                {screen.title}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>4 màn hình đại diện toàn diện cho hệ thống phân công DWS Thu ngân.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
