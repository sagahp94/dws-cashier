import React, { useState, useEffect, useRef } from 'react';
import {
  Info,
  User,
  Mail,
  Building2,
  Briefcase,
  Calendar,
  FileText,
  Phone,
  BookOpen,
  Upload,
  Download,
  ShieldCheck,
  Crown,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Code2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FileCheck,
  Tag,
  Lock,
  Cpu,
} from 'lucide-react';
import { useToast } from '../components/common/ToastContainer';
import { Modal } from '../components/common/Modal';
import {
  appInfoService,
  APP_CURRENT_VERSION,
  APP_CHANGELOG,
} from '../services/appInfoService';
import { MinimalAppIcon } from '../components/common/MinimalAppIcon';
import { AppCreatorInfo, AppChangelogItem } from '../types';
import { CloudSyncStatus } from '../services/firebaseService';

interface AppInfoPageProps {
  syncStatus?: CloudSyncStatus;
}

export const AppInfoPage: React.FC<AppInfoPageProps> = ({ syncStatus }) => {
  const { success, error: toastError, info: toastInfo, warning } = useToast();

  const [creatorInfo, setCreatorInfo] = useState<AppCreatorInfo>(() =>
    appInfoService.getDefaultCreatorInfo()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isRawModalOpen, setIsRawModalOpen] = useState<boolean>(false);
  const [activeTabSection, setActiveTabSection] = useState<'creator' | 'changelog' | 'version'>('creator');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUser = syncStatus?.user;
  const isOwner = appInfoService.isProjectOwner(currentUser);

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = appInfoService.subscribeToCreatorInfo(
      (data) => {
        setCreatorInfo(data);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Realtime creator info error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle template download
  const handleDownloadTemplate = () => {
    try {
      appInfoService.downloadTemplateFile();
      success('Đã tải xuống tệp mẫu "app-creator-info-template.txt" thành công!');
    } catch (err) {
      toastError('Không thể tải xuống tệp mẫu: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Handle download current saved file
  const handleDownloadCurrent = () => {
    try {
      appInfoService.downloadCurrentInfoFile(creatorInfo);
      success('Đã tải xuống tệp thông tin hiện tại thành công!');
    } catch (err) {
      toastError('Không thể tải tệp: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Handle TXT file upload (Owner only)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!isOwner || !currentUser) {
      warning('Chỉ tài khoản Chủ ứng dụng mới có quyền thay đổi thông tin này.');
      if (event.target) event.target.value = '';
      return;
    }

    const file = files[0];
    setIsUploading(true);

    try {
      // 1. Validate & Read TXT UTF-8
      const rawText = await appInfoService.validateAndReadTxtFile(file);

      // 2. Save to Firestore & local cache
      const updatedInfo = await appInfoService.saveCreatorInfoToCloud(rawText, currentUser);
      setCreatorInfo(updatedInfo);

      success('Cập nhật thông tin người tạo ứng dụng thành công!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(msg);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  // Filter changelog
  const filteredChangelog = APP_CHANGELOG.filter((item) => {
    if (selectedTagFilter === 'all') return true;
    return item.tags.includes(selectedTagFilter as any);
  });

  const parsed = creatorInfo.parsedFields;

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return 'Chưa ghi nhận';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div id="app-info-page" className="space-y-6 pb-12 animate-fade-in">
      {/* Hidden File Input for TXT Upload (Owner only) */}
      {isOwner && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".txt,text/plain"
          className="hidden"
        />
      )}

      {/* Top Banner & Header */}
      <div className="neu-panel p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center flex-wrap gap-3">
              <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Thông tin về ứng dụng
                  <span className="text-xs px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-semibold border border-teal-200 font-mono">
                    {APP_CURRENT_VERSION.version}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Tổng quan hệ thống, hồ sơ tác giả, lịch sử phát triển & kiến trúc bảo mật
                </p>
              </div>
            </div>
          </div>

          {/* Owner Status Badge & Actions (Only visible to Project Owner) */}
          {isOwner && (
            <div className="flex items-center flex-wrap gap-2 pt-2 md:pt-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <Crown className="w-4 h-4 text-amber-600" />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight flex items-center gap-1">
                    Chủ ứng dụng (Owner)
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer text-slate-700 hover:text-teal-800 transition-all"
                title="Tải tệp mẫu app-creator-info-template.txt"
              >
                <Download className="w-3.5 h-3.5 text-teal-700" />
                <span>Tải file mẫu .txt</span>
              </button>
            </div>
          )}
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80 mt-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTabSection('creator')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTabSection === 'creator'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-teal-700" />
            <span>1. Người tạo ứng dụng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabSection('changelog')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTabSection === 'changelog'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-teal-700" />
            <span>2. Lịch sử chỉnh sửa ({APP_CHANGELOG.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabSection('version')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTabSection === 'version'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-700" />
            <span>3. Phiên bản & Hệ thống</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: THÔNG TIN NGƯỜI TẠO ỨNG DỤNG
          ========================================================================= */}
      {activeTabSection === 'creator' && (
        <div className="space-y-6">
          {/* Action & Status Card for Creator Info */}
          <div className="neu-card p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                <FileCheck className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Hồ sơ Tác giả & Đơn vị Phát triển
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cập nhật gần nhất:{' '}
                  <span className="font-semibold text-slate-700">{formatDate(creatorInfo.updatedAt)}</span>
                </p>
              </div>
            </div>

            {isOwner && (
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsRawModalOpen(true)}
                  className="neu-button-secondary px-3 py-1.5 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1.5"
                  title="Xem văn bản TXT gốc"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Xem tệp TXT</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCurrent}
                  className="neu-button-secondary px-3 py-1.5 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1.5"
                  title="Tải về tệp TXT này"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải tệp về</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="neu-button-primary px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                  title="Tải lên tệp .txt mới để cập nhật thông tin"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải lên / Cập nhật (.txt)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Creator Information Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Creator Name */}
            <div className="neu-card p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-300/80 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-100">
                  <User className="w-5 h-5 text-teal-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Tên người tạo
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5 break-words">
                    {parsed.creatorName || 'Chưa cung cấp'}
                  </div>
                  {parsed.creatorName && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Tác giả chính thức
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="neu-card p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-300/80 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0 border border-blue-100">
                  <Mail className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Địa chỉ Email
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 break-all">
                    {parsed.email ? (
                      <a
                        href={`mailto:${parsed.email}`}
                        className="text-teal-800 hover:text-teal-900 hover:underline inline-flex items-center gap-1.5"
                      >
                        {parsed.email}
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    ) : (
                      'Chưa cung cấp'
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Liên hệ hỗ trợ kỹ thuật & đóng góp ý kiến</span>
                </div>
              </div>
            </div>

            {/* Department */}
            <div className="neu-card p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-300/80 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-800 flex items-center justify-center shrink-0 border border-indigo-100">
                  <Building2 className="w-5 h-5 text-indigo-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Đơn vị / Bộ phận
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 break-words">
                    {parsed.department || 'Chưa cung cấp'}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Khối Vận hành DWS & Điều phối Siêu thị</span>
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="neu-card p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-300/80 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-100">
                  <Briefcase className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Vai trò / Chức vụ
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 break-words">
                    {parsed.role || 'Chưa cung cấp'}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Phụ trách phát triển & kiến trúc phần mềm</span>
                </div>
              </div>
            </div>

            {/* Development Start Date */}
            <div className="neu-card p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-300/80 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center shrink-0 border border-rose-100">
                  <Calendar className="w-5 h-5 text-rose-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Ngày bắt đầu phát triển
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 break-words">
                    {parsed.developmentStartDate || 'Chưa cung cấp'}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Giai đoạn nghiên cứu & triển khai ban đầu</span>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="neu-card p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-300/80 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Phone className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Thông tin liên hệ
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 break-words">
                    {parsed.contactInfo || 'Chưa cung cấp'}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Kênh trao đổi & hỗ trợ trực tiếp</span>
                </div>
              </div>
            </div>
          </div>

          {/* App Description Box */}
          <div className="neu-card p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div className="flex items-center gap-2.5 text-slate-800 font-extrabold text-sm">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center">
                <FileText className="w-4 h-4 text-teal-700" />
              </div>
              <span>Mô Tả Ứng Dụng</span>
            </div>
            <div className="text-sm text-slate-700 leading-relaxed pl-10 whitespace-pre-line font-normal">
              {parsed.appDescription || 'Chưa có thông tin mô tả ứng dụng trong tệp cấu hình.'}
            </div>
          </div>

          {/* Custom Parsed Fields (If Any Extra Fields Exist in TXT) */}
          {parsed.customFields && parsed.customFields.length > 0 && (
            <div className="neu-card p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Thông tin bổ sung khác từ tệp
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsed.customFields.map((cf, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">{cf.label}</span>
                    <span className="text-sm font-semibold text-slate-800 break-words whitespace-pre-line">
                      {cf.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions Box (Owner only) */}
          {isOwner && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-teal-700" />
                <span>Hướng dẫn cập nhật thông tin người tạo bằng tệp TXT</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600 leading-relaxed">
                <li>
                  Bấm nút <strong className="text-slate-800">"Tải file mẫu .txt"</strong> để tải tệp mẫu{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-mono text-[11px]">
                    app-creator-info-template.txt
                  </code>
                  .
                </li>
                <li>Chỉnh sửa nội dung bằng Notepad hoặc bất kỳ trình soạn thảo văn bản UTF-8 nào.</li>
                <li>
                  Tài khoản <strong className="text-slate-800">Chủ ứng dụng (Project Owner)</strong> sau đó bấm{' '}
                  <strong className="text-teal-800">"Tải lên / Cập nhật (.txt)"</strong> để lưu thông tin lên Cloud
                  Firestore.
                </li>
                <li>Hệ thống tự động phân tích và hiển thị ngay lập tức trên mọi thiết bị mà không cần reload trang.</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 2: LỊCH SỬ CHỈNH SỬA ỨNG DỤNG (CHANGELOG)
          ========================================================================= */}
      {activeTabSection === 'changelog' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="neu-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Tag className="w-4 h-4 text-teal-700" />
              <span>Lọc theo nhóm cải tiến:</span>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'security', label: '🛡️ Bảo mật' },
                { id: 'feature', label: '✨ Tính năng' },
                { id: 'sync', label: '☁️ Đồng bộ Cloud' },
                { id: 'performance', label: '⚡ Hiệu năng' },
                { id: 'ui', label: '🎨 Giao diện' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedTagFilter(btn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedTagFilter === btn.id
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline of Changelog Items */}
          <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {filteredChangelog.map((item) => {
              return (
                <div key={item.version} className="relative group">
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-4 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${
                      item.isCurrent ? 'bg-teal-600 ring-2 ring-teal-400' : 'bg-slate-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  {/* Card Content */}
                  <div
                    className={`neu-card p-5 sm:p-6 rounded-2xl bg-white border transition-all ${
                      item.isCurrent
                        ? 'border-teal-300 ring-1 ring-teal-200 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-teal-800 text-white font-black text-xs font-mono shadow-2xs">
                          {item.version}
                        </span>
                        {item.isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                            Phiên bản hiện tại
                          </span>
                        )}
                        <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
                      </div>

                      <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{item.date}</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Highlights List */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Các cải tiến quan trọng:
                      </div>
                      <ul className="space-y-1.5">
                        {item.highlights.map((h, hIdx) => (
                          <li
                            key={hIdx}
                            className="text-xs sm:text-sm text-slate-700 flex items-start gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Tags */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center flex-wrap gap-1.5">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 uppercase border border-slate-200"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 3: PHIÊN BẢN HIỆN TẠI & KIẾN TRÚC HỆ THỐNG
          ========================================================================= */}
      {activeTabSection === 'version' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Version Overview Card */}
            <div className="neu-card p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <MinimalAppIcon size="md" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Quản Lý Phân Quầy
                  </h3>
                  <p className="text-xs text-slate-500">Hệ thống phân quầy thu ngân chuẩn Siêu thị AEON</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-700 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Phiên bản phát hành:</span>
                  <span className="font-extrabold font-mono text-teal-800 text-sm">
                    {APP_CURRENT_VERSION.version}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Mã bản dựng (Build):</span>
                  <span className="font-bold font-mono text-slate-800">
                    {APP_CURRENT_VERSION.build}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Thời gian phát hành:</span>
                  <span className="font-bold text-slate-800">{APP_CURRENT_VERSION.releaseDate}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-500 font-medium">Môi trường vận hành:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {APP_CURRENT_VERSION.environment}
                  </span>
                </div>
              </div>
            </div>

            {/* Security Architecture Card */}
            <div className="neu-card p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Kiến Trúc Bảo Mật & Phân Quyền
                  </h3>
                  <p className="text-xs text-slate-500">Zero-Trust Firestore Security Rules & Owner RBAC</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-700" />
                    <span>Cô lập dữ liệu người dùng (User-Level Isolation)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mỗi tài khoản Google sở hữu phân vùng Firestore riêng biệt theo Firebase Auth UID. Tuyệt đối không
                    chia sẻ hoặc rò rỉ dữ liệu giữa các tài khoản khác nhau.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-600" />
                    <span>Quyền Chủ Dự Án (Project Owner Protection)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Chỉ tài khoản Google được cấu hình chính thức mới có quyền ghi/sửa tệp thông tin người tạo ứng dụng
                    cả ở tầng Client và Security Rules Backend.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tech Stack List */}
          <div className="neu-card p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
              <Cpu className="w-4 h-4 text-teal-700" />
              <span>Công Nghệ & Nền Tảng Phát Triển</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {APP_CURRENT_VERSION.techStack.map((tech, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs font-bold text-slate-700"
                >
                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                  <span>{tech}</span>
                </div>
              ))}
            </div>
          </div>

          {/* License & Copyright */}
          <div className="p-5 rounded-2xl bg-slate-100/80 border border-slate-200 text-center space-y-1">
            <p className="text-xs font-bold text-slate-700">{APP_CURRENT_VERSION.license}</p>
            <p className="text-[11px] text-slate-500">
              Phát triển riêng cho nghiệp vụ Quản lý Quầy Thu Ngân & Điều Phối Lịch Ca AEON.
            </p>
          </div>
        </div>
      )}

      {/* Raw TXT Content Modal (Owner only) */}
      {isOwner && (
        <Modal
          isOpen={isRawModalOpen}
          onClose={() => setIsRawModalOpen(false)}
          title="Nội Dung Tệp Văn Bản TXT Gốc"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Dưới đây là chuỗi văn bản UTF-8 nguyên bản được lưu trữ trong Firestore và tải từ tệp cấu hình:
            </p>

            <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-96 whitespace-pre-wrap select-all border border-slate-800">
              {creatorInfo.rawText || 'Chưa có nội dung'}
            </pre>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDownloadCurrent}
                className="neu-button-secondary px-3.5 py-2 text-xs font-bold rounded-xl text-slate-700 hover:text-teal-800 cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Tải về tệp này</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRawModalOpen(false)}
                className="neu-button-primary px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
