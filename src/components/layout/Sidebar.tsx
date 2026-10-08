import React from 'react';
import {
  CalendarDays,
  UserCheck,
  Settings,
  History,
  BarChart3,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  Database,
  Store,
  Info,
} from 'lucide-react';
import { MinimalAppIcon } from '../common/MinimalAppIcon';

export type NavTab = 'dws' | 'unassigned' | 'settings' | 'history' | 'reports' | 'about';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unassignedCount?: number;
  pendingSwapCount?: number;
  hasCatalogData?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isOwner?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  unassignedCount = 0,
  pendingSwapCount = 0,
  hasCatalogData = false,
  isCollapsed,
  onToggleCollapse,
  isOwner = false,
}) => {
  const navItems = [
    {
      id: 'dws' as NavTab,
      label: 'Phân quầy hôm nay',
      icon: <CalendarDays className="w-4 h-4" />,
      badge: unassignedCount > 0 ? `${unassignedCount}` : null,
      badgeColor: 'amber',
      description: 'Lịch trực & xếp quầy theo ngày',
    },
    {
      id: 'unassigned' as NavTab,
      label: 'Đổi ca & Chờ xếp',
      icon: <UserCheck className="w-4 h-4" />,
      badge: pendingSwapCount > 0 ? `${pendingSwapCount}` : null,
      badgeColor: 'rose',
      description: 'Duyệt đổi ca & danh sách chờ',
    },
    {
      id: 'reports' as NavTab,
      label: 'Báo cáo & Thống kê',
      icon: <BarChart3 className="w-4 h-4" />,
      badge: null,
      badgeColor: 'slate',
      description: 'Công suất quầy & tỷ lệ đi làm',
    },
    {
      id: 'history' as NavTab,
      label: 'Lịch sử phân quầy',
      icon: <History className="w-4 h-4" />,
      badge: null,
      badgeColor: 'slate',
      description: 'Bản lưu phân quầy các ngày trước',
    },
    {
      id: 'settings' as NavTab,
      label: 'Cài đặt & Dữ liệu',
      icon: <Settings className="w-4 h-4" />,
      badge: !hasCatalogData ? '!' : null,
      badgeColor: 'rose',
      description: 'Danh mục ca, quầy, nhân viên',
    },
    {
      id: 'about' as NavTab,
      label: 'Thông tin về ứng dụng',
      icon: <Info className="w-4 h-4" />,
      badge: null,
      badgeColor: 'slate',
      description: 'Tác giả, lịch sử & phiên bản',
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className={`neu-sidebar text-slate-800 flex flex-col transition-all duration-200 z-30 shrink-0 select-none h-full ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Logo Header */}
      <div className="h-14 px-4 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <MinimalAppIcon size="sm" />
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="font-bold tracking-tight text-slate-900 text-sm truncate block">
                Quản Lý Phân Quầy
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors hidden md:flex items-center justify-center cursor-pointer"
          title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="p-2.5 flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              id={`nav-item-${item.id}`}
              onClick={() => onTabChange(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer group relative text-xs ${
                isActive
                  ? 'bg-teal-50/90 text-teal-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-teal-700 rounded-r-full" />
              )}

              <div
                className={`shrink-0 ${
                  isActive ? 'text-teal-700' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {item.icon}
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="truncate whitespace-nowrap">{item.label}</div>
                </div>
              )}

              {!isCollapsed && item.badge !== null && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums shrink-0 ${
                    item.badgeColor === 'amber'
                      ? 'bg-amber-100 text-amber-900'
                      : item.badgeColor === 'rose'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {/* Collapsed Badge indicator */}
              {isCollapsed && item.badge !== null && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quiet Footer Info */}
      <div className="border-t border-slate-200/80 p-3">
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500">
            <span>Danh mục hệ thống</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className={`w-1.5 h-1.5 rounded-full ${hasCatalogData ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {hasCatalogData ? 'Sẵn sàng' : 'Chưa nạp'}
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <span
              className={`w-2 h-2 rounded-full ${hasCatalogData ? 'bg-emerald-500' : 'bg-amber-500'}`}
              title={hasCatalogData ? 'Danh mục đã nạp đầy đủ' : 'Chưa nạp danh mục'}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
