import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { ToastProvider, useToast } from './components/common/ToastContainer';
import { DataImportModal, ImportDataType } from './components/import/DataImportModal';
import { CloudSyncModal } from './components/common/CloudSyncModal';
import { DwsSheetPreview } from './components/preview/DwsSheetPreview';
import { LoginScreen } from './components/auth/LoginScreen';
import { MigrateLocalStorageModal } from './components/auth/MigrateLocalStorageModal';
import { DwsWeekPage } from './pages/DwsWeekPage';
import { UnassignedPage } from './pages/UnassignedPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { AppInfoPage } from './pages/AppInfoPage';
import { storageService } from './services/storageService';
import { assignmentService } from './services/assignmentService';
import { firebaseService, CloudSyncStatus } from './services/firebaseService';
import { appInfoService } from './services/appInfoService';
import { getMondayOfWeek, formatDateToYMD, getDayNameVietnamese } from './utils/dateUtils';
import {
  Shift,
  Counter,
  Employee,
  WeeklyScheduleEntry,
  DayDwsAssignment,
  CatalogMetadata,
  HistoryRecord,
} from './types';
import { Sparkles, Users } from 'lucide-react';
import { MinimalAppIcon } from './components/common/MinimalAppIcon';

function MainApp() {
  const { success, error: toastError, info, warning } = useToast();

  // Firebase Auth & Cloud Sync State
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(firebaseService.getStatus());
  const prevSignedInRef = useRef<boolean>(false);
  const prevOnlineRef = useRef<boolean>(true);

  // Migration Modal state
  const [migrationPrompt, setMigrationPrompt] = useState<{
    isOpen: boolean;
    summary: {
      shifts: number;
      counters: number;
      employees: number;
      schedules: number;
      assignments: number;
    };
  } | null>(null);

  // Navigation state
  const [currentTab, setCurrentTab] = useState<NavTab>('dws');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Preview Mode
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Cloud Sync Modal (Offline backup & restore)
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);

  // Import Modal state
  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    type: ImportDataType;
  }>({
    isOpen: false,
    type: 'weeklySchedule',
  });

  // Active Week & Selected Day
  const [currentMonday, setCurrentMonday] = useState<string>(() => {
    return getMondayOfWeek(new Date());
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const todayStr = formatDateToYMD(today);
    const mon = getMondayOfWeek(today);
    const dayOfWeek = today.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      return todayStr;
    }
    return mon;
  });

  // Foundation Data State
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsMeta, setShiftsMeta] = useState<CatalogMetadata>({ fileName: null, updatedAt: null, count: 0 });

  const [counters, setCounters] = useState<Counter[]>([]);
  const [countersMeta, setCountersMeta] = useState<CatalogMetadata>({ fileName: null, updatedAt: null, count: 0 });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesMeta, setEmployeesMeta] = useState<CatalogMetadata>({ fileName: null, updatedAt: null, count: 0 });

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleEntry[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, DayDwsAssignment>>({});
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);

  // Load all data from storage
  const reloadAllData = useCallback(() => {
    const s = storageService.getShifts();
    const sm = storageService.getShiftsMeta();
    const c = storageService.getCounters();
    const cm = storageService.getCountersMeta();
    const e = storageService.getEmployees();
    const em = storageService.getEmployeesMeta();
    const ws = storageService.getWeeklySchedule(currentMonday);
    const am = storageService.getAllAssignmentsForWeek(currentMonday);
    const hr = storageService.getHistory();

    setShifts(s);
    setShiftsMeta(sm);
    setCounters(c);
    setCountersMeta(cm);
    setEmployees(e);
    setEmployeesMeta(em);
    setWeeklySchedule(ws);
    setAssignmentsMap(am);
    setHistoryRecords(hr);
  }, [currentMonday]);

  // Firebase Auth Lifecycle Subscription
  useEffect(() => {
    const unsubStatus = firebaseService.subscribe((status) => {
      setSyncStatus(status);

      // Notify on Login
      if (!prevSignedInRef.current && status.isSignedIn && status.user) {
        success(`Đăng nhập Google thành công! Xin chào ${status.user.displayName || status.user.email}`);
      }

      // Notify on SignOut
      if (prevSignedInRef.current && !status.isSignedIn) {
        info('Đã đăng xuất tài khoản Google.');
      }

      // Notify on Online/Offline
      if (prevOnlineRef.current && !status.isOnline) {
        warning('Mất kết nối Internet. Đang làm việc ở chế độ Ngoại tuyến.');
      } else if (!prevOnlineRef.current && status.isOnline) {
        info('Đã kết nối lại Internet. Tự động kích hoạt đồng bộ đám mây...');
      }

      prevSignedInRef.current = status.isSignedIn;
      prevOnlineRef.current = status.isOnline;
    });

    const unsubFirebase = firebaseService.init((summary) => {
      // First-time local storage migration request
      setMigrationPrompt({
        isOpen: true,
        summary,
      });
    });

    return () => {
      unsubStatus();
      unsubFirebase();
    };
  }, [success, info, warning]);

  useEffect(() => {
    // Auto-heal any corrupted employee catalog or schedule state
    storageService.repairDataIntegrity(currentMonday);
    reloadAllData();

    // Re-render when local storage updates or restore occurs
    const unsubStorage = storageService.subscribe((topic) => {
      if (topic === 'all' || topic === 'cloud_sync') {
        reloadAllData();
      }
    });

    return () => {
      unsubStorage();
    };
  }, [currentMonday, reloadAllData]);

  // Handle Week Change
  const handleWeekChange = (newMonday: string) => {
    setCurrentMonday(newMonday);
    setSelectedDate(newMonday);
  };

  // Open import modal
  const handleOpenImport = (type: ImportDataType) => {
    setImportModal({
      isOpen: true,
      type,
    });
  };

  // Sign out handler
  const handleSignOut = async () => {
    await firebaseService.signOutUser();
  };

  // Force manual cloud sync
  const handleForceSync = async () => {
    info('Đang đồng bộ dữ liệu lên Đám mây...');
    const res = await firebaseService.syncToCloud(true);
    if (res.success) {
      success('Đã đồng bộ toàn bộ dữ liệu lên Google Firestore thành công!');
    } else {
      toastError('Đồng bộ thất bại: ' + (res.error || 'Lỗi không xác định'));
    }
  };

  // Force manual cloud pull
  const handleForcePull = async () => {
    info('Đang tải dữ liệu từ Đám mây về máy...');
    const res = await firebaseService.pullFromCloud();
    if (res.success) {
      reloadAllData();
      success('Đã tải và cập nhật dữ liệu mới nhất từ Đám mây thành công!');
    } else {
      toastError('Tải dữ liệu thất bại: ' + (res.error || 'Lỗi không xác định'));
    }
  };

  // Handle local storage migration confirmation
  const handleConfirmMigration = async () => {
    if (!syncStatus.user) return;
    try {
      const res = await firebaseService.syncToCloud(true);
      if (res.success) {
        localStorage.setItem(`aeon_dws_migrated_${syncStatus.user.uid}`, 'true');
        setMigrationPrompt(null);
        success('Đã chuyển toàn bộ dữ liệu máy này lên tài khoản Google thành công!');
      } else {
        toastError('Đồng bộ thất bại: ' + (res.error || 'Vui lòng thử lại'));
      }
    } catch (err: any) {
      toastError('Có lỗi xảy ra: ' + err?.message);
    }
  };

  const handleSkipMigration = () => {
    if (syncStatus.user) {
      localStorage.setItem(`aeon_dws_migrated_${syncStatus.user.uid}`, 'true');
    }
    setMigrationPrompt(null);
  };

  // Calculate unassigned count for active day
  const activeDayAssignment = assignmentsMap[selectedDate] || null;
  const activeDayUnassigned = assignmentService.getUnassignedEmployees(
    selectedDate,
    weeklySchedule,
    shifts,
    activeDayAssignment
  );

  const pendingSwapCount = useMemo(() => {
    return storageService.getPendingSwapRequests(currentMonday).length;
  }, [currentMonday, assignmentsMap]);

  // Day Name for display
  const selectedDayInfo = useMemo(() => {
    return getDayNameVietnamese(selectedDate);
  }, [selectedDate]);

  // Restore history record
  const handleRestoreRecord = (record: HistoryRecord) => {
    storageService.saveAssignment(record.data);
    reloadAllData();
    setCurrentTab('dws');
    setSelectedDate(record.date);
    setCurrentMonday(record.weekId);
  };

  const hasCatalogData = shifts.length > 0 && counters.length > 0 && employees.length > 0;

  // Check Project Owner status
  const isOwner = useMemo(() => {
    return appInfoService.isProjectOwner(syncStatus.user);
  }, [syncStatus.user]);

  // 1. Loading Splash Screen while checking initial Firebase Auth status
  if (syncStatus.isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="flex flex-col items-center space-y-4">
          <MinimalAppIcon size="lg" />
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-900">Quản Lý Phân Quầy</h2>
            <p className="text-xs text-slate-500">Đang kiểm tra trạng thái xác thực...</p>
          </div>
          <div className="w-5 h-5 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mt-1" />
        </div>
      </div>
    );
  }

  // 2. Authentication Gate: If not signed in, render Login Screen
  if (!syncStatus.isSignedIn) {
    return <LoginScreen syncStatus={syncStatus} />;
  }

  // 3. Main Authenticated Application
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#f8fafc] flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/30 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            setIsPreviewOpen(false);
            setIsMobileMenuOpen(false);
          }}
          unassignedCount={activeDayUnassigned.length}
          pendingSwapCount={pendingSwapCount}
          hasCatalogData={hasCatalogData}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isOwner={isOwner}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden relative z-10">
        {/* App Header with Account Dropdown */}
        <Header
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenImportWeeklySchedule={() => handleOpenImport('weeklySchedule')}
          onOpenImportCatalog={() => handleOpenImport('shifts')}
          onPreviewDws={() => setIsPreviewOpen(true)}
          canPreviewDws={counters.length > 0}
          onOpenCloudSync={() => setIsCloudSyncOpen(true)}
          onOpenAbout={() => {
            setCurrentTab('about');
            setIsPreviewOpen(false);
          }}
          syncStatus={syncStatus}
          onSignOut={handleSignOut}
          onForceSync={handleForceSync}
          onForcePull={handleForcePull}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-20 md:pb-8 relative">
          {isPreviewOpen ? (
            <DwsSheetPreview
              date={selectedDate}
              dayName={selectedDayInfo}
              weekId={currentMonday}
              currentMonday={currentMonday}
              counters={counters}
              assignment={activeDayAssignment}
              assignmentsMap={assignmentsMap}
              shifts={shifts}
              employees={employees}
              weeklySchedule={weeklySchedule}
              unassignedCount={activeDayUnassigned.length}
              onBackToEdit={() => setIsPreviewOpen(false)}
              onUpdateAssignment={(updatedAssignment) => {
                storageService.saveAssignment(updatedAssignment);
                reloadAllData();
              }}
            />
          ) : (
            <>
              {currentTab === 'dws' && (
                <DwsWeekPage
                  currentMonday={currentMonday}
                  onWeekChange={handleWeekChange}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  shifts={shifts}
                  counters={counters}
                  employees={employees}
                  weeklySchedule={weeklySchedule}
                  assignmentsMap={assignmentsMap}
                  onOpenImport={handleOpenImport}
                  onPreviewDws={() => setIsPreviewOpen(true)}
                  onDataChanged={reloadAllData}
                />
              )}

              {currentTab === 'unassigned' && (
                <UnassignedPage
                  currentMonday={currentMonday}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  shifts={shifts}
                  counters={counters}
                  employees={employees}
                  weeklySchedule={weeklySchedule}
                  assignmentsMap={assignmentsMap}
                  onNavigateToDws={() => setCurrentTab('dws')}
                  onDataChanged={reloadAllData}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsPage
                  shifts={shifts}
                  shiftsMeta={shiftsMeta}
                  counters={counters}
                  countersMeta={countersMeta}
                  employees={employees}
                  employeesMeta={employeesMeta}
                  weeklySchedule={weeklySchedule}
                  currentMonday={currentMonday}
                  onOpenImport={handleOpenImport}
                  onDataChanged={reloadAllData}
                  onOpenCloudSync={() => setIsCloudSyncOpen(true)}
                  onOpenAbout={() => setCurrentTab('about')}
                />
              )}

              {currentTab === 'history' && (
                <HistoryPage
                  historyRecords={historyRecords}
                  onRestoreRecord={handleRestoreRecord}
                  onDataChanged={reloadAllData}
                />
              )}

              {currentTab === 'reports' && (
                <ReportsPage
                  currentMonday={currentMonday}
                  shifts={shifts}
                  counters={counters}
                  employees={employees}
                  weeklySchedule={weeklySchedule}
                  assignmentsMap={assignmentsMap}
                />
              )}

              {currentTab === 'about' && (
                <AppInfoPage syncStatus={syncStatus} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setIsPreviewOpen(false);
          setIsMobileMenuOpen(false);
        }}
        unassignedCount={activeDayUnassigned.length}
        pendingSwapCount={pendingSwapCount}
        isOwner={isOwner}
      />

      {/* LocalStorage First-time Migration Confirmation Modal */}
      {migrationPrompt && (
        <MigrateLocalStorageModal
          isOpen={migrationPrompt.isOpen}
          userDisplayName={syncStatus.user?.displayName || null}
          userEmail={syncStatus.user?.email || null}
          summary={migrationPrompt.summary}
          onConfirm={handleConfirmMigration}
          onSkip={handleSkipMigration}
        />
      )}

      {/* Cloud Sync (Offline backup / JSON export) Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        onDataRestored={() => reloadAllData()}
      />

      {/* Reusable Data Import Modal */}
      <DataImportModal
        isOpen={importModal.isOpen}
        onClose={() => setImportModal((prev) => ({ ...prev, isOpen: false }))}
        targetType={importModal.type}
        dataType={importModal.type}
        defaultMondayDate={currentMonday}
        currentMonday={currentMonday}
        shifts={shifts}
        counters={counters}
        employees={employees}
        onSuccess={() => {
          reloadAllData();
        }}
        onImportSuccess={() => {
          reloadAllData();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
