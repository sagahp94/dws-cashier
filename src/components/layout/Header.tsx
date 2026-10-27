import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Upload,
  Eye,
  HardDrive,
  LogOut,
  Cloud,
  CloudCheck,
  RefreshCw,
  User as UserIcon,
  ChevronDown,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Crown,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { CloudSyncStatus } from '../../services/firebaseService';
import { appInfoService } from '../../services/appInfoService';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenImportWeeklySchedule: () => void;
  onOpenImportCatalog?: () => void;
  onPreviewDws?: () => void;
  canPreviewDws?: boolean;
  onOpenCloudSync?: () => void;
  onOpenAbout?: () => void;
  syncStatus?: CloudSyncStatus;
  onSignOut?: () => void;
  onForceSync?: () => void;
  onForcePull?: () => void;
  onOpenSyncHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenImportWeeklySchedule,
  onOpenImportCatalog,
  onPreviewDws,
  canPreviewDws = false,
  onOpenCloudSync,
  onOpenAbout,
  syncStatus,
  onSignOut,
  onForceSync,
  onForcePull,
  onOpenSyncHistory,
}) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

  const user = syncStatus?.user;
  const isOwner = appInfoService.isProjectOwner(user);

  const formatLastSync = (iso: string | null | undefined) => {
    if (!iso) return 'Chưa đồng bộ';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${time} - ${date}`;
    } catch {
      return iso;
    }
  };

  return (
    <header
      id="app-header"
      className="neu-header px-4 sm:px-6 h-14 flex items-center justify-between gap-3 sticky top-0 z-20"
    >
      {/* Left: Mobile hamburger & Single-Line Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-2 text-slate-600 hover:text-teal-800 hover:bg-slate-100 rounded-lg md:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
          Quản Lý Phân Quầy
        </h1>
      </div>

      {/* Right: Sync Status, Primary Action & Account Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Interactive Sync Status Button (Desktop & Tablet) */}
        {syncStatus?.isSignedIn && (
          <button
            type="button"
            id="header-btn-sync-status"
            onClick={onOpenSyncHistory}
            className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 hover:text-teal-900 bg-slate-50/80 hover:bg-teal-50/70 border border-slate-200/90 hover:border-teal-300 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer shadow-xs group"
            title="Bấm để xem lịch sử đồng bộ & đối chiếu dữ liệu với Đám mây"
          >
            {syncStatus.isSyncing ? (
              <span className="flex items-center gap-1.5 text-teal-700 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                <span>Đang đồng bộ...</span>
              </span>
            ) : syncStatus.isQuotaExceeded ? (
              <span className="flex items-center gap-1.5 font-medium text-amber-800 bg-amber-50/90 px-1 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                <span>Hạn mức đám mây tạm đầy · Dữ liệu máy an toàn</span>
              </span>
            ) : (syncStatus.pendingAssignmentsCount || 0) > 0 ? (
              <span className="flex items-center gap-1.5 font-medium text-teal-800 bg-teal-50/90 border border-teal-200/80 px-2 py-0.5 rounded-md text-[11px]">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <span>Đã xếp {syncStatus.pendingAssignmentsCount}/{syncStatus.batchSyncThreshold || 3} NV</span>
                <span className="text-[10px] text-teal-600 font-normal hidden lg:inline">· Chuẩn bị tự động sync</span>
              </span>
            ) : syncStatus.isOnline ? (
              <span className="flex items-center gap-1.5 tabular-nums font-medium text-slate-600 group-hover:text-teal-950">
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 group-hover:scale-110 transition-transform" />
                <span>Đã đồng bộ · {formatLastSync(syncStatus.lastSyncedAt)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Ngoại tuyến</span>
              </span>
            )}
          </button>
        )}

        {/* Offline Backup Modal Trigger (Desktop) */}
        {onOpenCloudSync && (
          <button
            type="button"
            id="header-btn-backup-restore"
            onClick={onOpenCloudSync}
            title="Sao lưu & Khôi phục dữ liệu ngoại tuyến (Tệp JSON)"
            className="neu-button-secondary hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer text-slate-700 whitespace-nowrap"
          >
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>Sao lưu tệp</span>
          </button>
        )}

        {/* Preview & Print DWS */}
        {canPreviewDws && onPreviewDws && (
          <button
            type="button"
            id="header-btn-preview-dws"
            onClick={onPreviewDws}
            className="neu-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer text-slate-800 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs whitespace-nowrap hover:border-teal-300 hover:text-teal-900 transition-colors"
            title="Xem trước & In bảng phân quầy DWS chuẩn A4"
          >
            <Eye className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="hidden sm:inline">Xem & In DWS</span>
            <span className="sm:hidden">In DWS</span>
          </button>
        )}

        {/* Import Weekly Schedule Button (Primary CTA) */}
        <button
          type="button"
          id="header-btn-import-weekly"
          onClick={onOpenImportWeeklySchedule}
          className="neu-button-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
          title="Tải lên tệp Excel lịch ca làm việc tuần (.xlsx)"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nạp lịch tuần</span>
          <span className="sm:hidden">+ Lịch</span>
        </button>

        {/* User Account Menu Dropdown */}
        {syncStatus?.isSignedIn && user && (
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              id="header-btn-account-menu"
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer group"
              title={`Tài khoản: ${user.displayName || user.email}`}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google Avatar'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-md object-cover border border-slate-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-7 h-7 rounded-md bg-teal-700 text-white font-semibold flex items-center justify-center text-xs">
                  {user.displayName?.charAt(0)?.toUpperCase() || <UserIcon className="w-3.5 h-3.5" />}
                </div>
              )}

              <div className="text-left hidden md:block max-w-[130px] truncate">
                <div className="text-xs font-semibold text-slate-800 leading-tight truncate flex items-center gap-1">
                  <span>{user.displayName || 'Người dùng'}</span>
                  {isOwner && (
                    <Crown className="w-3 h-3 text-amber-500 shrink-0" title="Chủ ứng dụng" />
                  )}
                </div>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform hidden sm:block ${
                  isAccountMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isAccountMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 sm:w-72 rounded-xl bg-white border border-slate-200 shadow-lg z-50 p-2 space-y-1.5">
                {/* User Info Header */}
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar'}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-teal-700 text-white font-semibold flex items-center justify-center text-xs">
                      {user.displayName?.charAt(0)?.toUpperCase() || <UserIcon className="w-4 h-4" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {user.displayName || 'Tài khoản Google'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                    {isOwner && (
                      <div className="text-[10px] font-semibold text-amber-700 mt-0.5 flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-600" />
                        <span>Chủ ứng dụng</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation & Action Buttons */}
                <div className="space-y-0.5 pt-0.5">
                  {onOpenAbout && (
                    <button
                      type="button"
                      id="menu-btn-open-about"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onOpenAbout();
                      }}
                      className="w-full py-2 px-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-500" />
                        <span>Thông tin về ứng dụng</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">v1.4.0</span>
                    </button>
                  )}

                  {onOpenSyncHistory && (
                    <button
                      type="button"
                      id="menu-btn-sync-history"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onOpenSyncHistory();
                      }}
                      className="w-full py-2 px-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <CloudCheck className="w-3.5 h-3.5 text-teal-700" />
                        <span>Lịch sử & Đối chiếu đồng bộ</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {syncStatus.lastSyncedAt ? formatLastSync(syncStatus.lastSyncedAt).split(' - ')[0] : 'Chưa'}
                      </span>
                    </button>
                  )}

                  {onOpenCloudSync && (
                    <button
                      type="button"
                      id="menu-btn-open-backup"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onOpenCloudSync();
                      }}
                      className="w-full py-2 px-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                        <span>Sao lưu & Khôi phục tệp JSON</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Offline</span>
                    </button>
                  )}

                  {isOwner && onForceSync && (
                    <button
                      type="button"
                      id="menu-btn-force-sync"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onForceSync();
                      }}
                      disabled={syncStatus.isSyncing || syncStatus.isQuotaExceeded}
                      title={syncStatus.isQuotaExceeded ? 'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn' : undefined}
                      className="w-full py-2 px-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                        <span>Đồng bộ lên Đám mây</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {syncStatus.isQuotaExceeded ? 'Tạm đầy' : 'Tải lên'}
                      </span>
                    </button>
                  )}

                  {isOwner && onForcePull && (
                    <button
                      type="button"
                      id="menu-btn-force-pull"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onForcePull();
                      }}
                      disabled={syncStatus.isSyncing}
                      className="w-full py-2 px-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        <Cloud className="w-3.5 h-3.5 text-teal-700" />
                        <span>Tải dữ liệu từ Đám mây</span>
                      </span>
                      <span className="text-[11px] text-slate-400">Tải về</span>
                    </button>
                  )}
                </div>

                {/* Sign Out Button */}
                {onSignOut && (
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      id="menu-btn-signout"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full py-2 px-2.5 rounded-lg hover:bg-rose-50 text-rose-700 text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
