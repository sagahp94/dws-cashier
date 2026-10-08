import React from 'react';
import { CalendarDays, UserCheck, BarChart3, Settings, Info } from 'lucide-react';
import { NavTab } from './Sidebar';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unassignedCount?: number;
  pendingSwapCount?: number;
  isOwner?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  unassignedCount = 0,
  pendingSwapCount = 0,
  isOwner = false,
}) => {
  const tabs = [
    {
      id: 'dws' as NavTab,
      label: 'Phân quầy',
      icon: <CalendarDays className="w-5 h-5" />,
      badge: unassignedCount > 0 ? unassignedCount : null,
    },
    {
      id: 'unassigned' as NavTab,
      label: 'Chờ xếp',
      icon: <UserCheck className="w-5 h-5" />,
      badge: pendingSwapCount > 0 ? pendingSwapCount : null,
    },
    {
      id: 'reports' as NavTab,
      label: 'Báo cáo',
      icon: <BarChart3 className="w-5 h-5" />,
      badge: null,
    },
    {
      id: 'settings' as NavTab,
      label: 'Cài đặt',
      icon: <Settings className="w-5 h-5" />,
      badge: null,
    },
    {
      id: 'about' as NavTab,
      label: 'Thông tin',
      icon: <Info className="w-5 h-5" />,
      badge: null,
    },
  ];

  return (
    <div
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 flex items-center justify-around"
    >
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-lg transition-colors cursor-pointer relative min-h-[44px] ${
              isActive ? 'text-teal-700 font-semibold' : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className="relative">
              {tab.icon}
              {tab.badge !== null && (
                <span className="absolute -top-1 -right-2 px-1 py-0 text-[9px] font-bold tabular-nums rounded-full bg-amber-500 text-white">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
