import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  getDocFromServer,
} from 'firebase/firestore';
import { firebaseConfig, db as sharedDb, auth as sharedAuth, app as sharedApp } from '../config/firebaseConfig';
import { storageService } from './storageService';

export interface UserProfileData {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: string;
  lastLoginAt: string;
}

export interface CloudSyncStatus {
  isAuthLoading: boolean;
  isSignedIn: boolean;
  user: UserProfileData | null;
  isSyncing: boolean;
  isLoadingCloudData: boolean;
  lastSyncedAt: string | null;
  lastSyncDevice: string | null;
  error: string | null;
  isOnline: boolean;
  autoSyncEnabled: boolean;
  isQuotaExceeded?: boolean;
}

export enum OperationType {
  CREATE = 'create',
  GET = 'get',
  LIST = 'list',
  UPDATE = 'update',
  DELETE = 'delete',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operation: OperationType;
  path: string | null;
  authInfo: {
    uid: string | null;
    email: string | null;
    displayName: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operation: OperationType,
  path: string | null,
  currentUser: User | null
): never {
  const errorInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operation,
    path,
    authInfo: {
      uid: currentUser?.uid || null,
      email: currentUser?.email || null,
      displayName: currentUser?.displayName || null,
    },
  };
  console.error(`[Firestore Error - ${operation}]`, JSON.stringify(errorInfo, null, 2));
  throw new Error(`[Firestore ${operation}] ${errorInfo.error}`);
}

export interface CloudBackupPayload {
  userId: string;
  userEmail: string | null;
  updatedAt: string;
  deviceId: string;
  deviceName: string;
  version: string;
  shifts: any[];
  shiftsMeta: any;
  counters: any[];
  countersMeta: any;
  employees: any[];
  employeesMeta: any;
  weeklySchedules: Record<string, any>;
  assignments: Record<string, any>;
  history: any[];
  assignmentRules: any;
  excludedEmployees?: string[];
  swapRequests?: any[];
}

interface CloudManifestDoc {
  userId: string;
  userEmail: string | null;
  updatedAt: string;
  deviceId: string;
  deviceName: string;
  version: string;
  isChunked: boolean;
  chunks?: string[];
  summary?: {
    shifts: number;
    counters: number;
    employees: number;
    schedules: number;
    assignments: number;
    history: number;
  };
}

export interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  formattedTime: string;
  type: 'upload' | 'download';
  trigger: 'manual' | 'auto';
  status: 'success' | 'error';
  deviceName: string;
  summary: {
    shifts: number;
    counters: number;
    employees: number;
    schedules: number;
    assignments: number;
  };
  message?: string;
}

export interface SyncComparisonResult {
  isMatch: boolean;
  statusText: string;
  message: string;
  lastSyncedAt: string | null;
  lastSyncedFormatted: string;
  cloudUpdatedAt: string | null;
  cloudDeviceName: string | null;
  localSummary: {
    shifts: number;
    counters: number;
    employees: number;
    schedules: number;
    assignments: number;
  };
  cloudSummary: {
    shifts: number;
    counters: number;
    employees: number;
    schedules: number;
    assignments: number;
  } | null;
  differences: {
    shifts: { local: number; cloud: number; match: boolean };
    counters: { local: number; cloud: number; match: boolean };
    employees: { local: number; cloud: number; match: boolean };
    schedules: { local: number; cloud: number; match: boolean };
    assignments: { local: number; cloud: number; match: boolean };
    hasLocalChanges: boolean;
  };
}

export type SyncItemKey =
  | 'auth'
  | 'shifts_counters'
  | 'employees'
  | 'schedules'
  | 'assignments'
  | 'manifest';

export interface SyncStepDetail {
  key: SyncItemKey;
  label: string;
  sublabel: string;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  errorMessage?: string;
  itemsCount?: number;
}

export interface DetailedSyncProgress {
  percent: number;
  currentStepLabel: string;
  overallStatus: 'idle' | 'syncing' | 'completed' | 'error';
  errorMessage?: string;
  steps: SyncStepDetail[];
  summary?: {
    shifts: number;
    counters: number;
    employees: number;
    schedules: number;
    assignments: number;
  };
}

export function formatSyncDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Chưa từng đồng bộ';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} - ${date}`;
  } catch {
    return iso;
  }
}

const LOCAL_DEVICE_KEY = 'aeon_dws_device_id';
const LAST_SYNC_KEY = 'aeon_dws_last_synced_at';
const AUTO_SYNC_KEY = 'aeon_dws_auto_sync';
const SYNC_HISTORY_KEY = 'aeon_dws_sync_history';
const LOCAL_UPDATED_AT_KEY = 'aeon_dws_local_data_updated_at';
const LAST_SYNCED_FINGERPRINT_KEY = 'aeon_dws_last_synced_fingerprint';
const QUOTA_EXCEEDED_DATE_KEY = 'aeon_dws_firestore_quota_date';

export function isQuotaExceededToday(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const storedDate = localStorage.getItem(QUOTA_EXCEEDED_DATE_KEY);
  if (!storedDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return storedDate === today;
}

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(LOCAL_DEVICE_KEY);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem(LOCAL_DEVICE_KEY, id);
  }
  return id;
}

function getDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'Máy tính';
  if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('Mac')) os = 'MacBook / iMac';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';
  else if (ua.includes('Linux')) os = 'Linux';
  return `${os} (${getOrCreateDeviceId().slice(-4)})`;
}

/**
 * Split large object dictionaries into smaller buckets to prevent exceeding Firestore 1MB limit per document
 */
function splitObjectIntoChunks<T>(
  obj: Record<string, T>,
  maxChunkBytes = 350000
): Array<Record<string, T>> {
  const keys = Object.keys(obj);
  if (keys.length === 0) return [{}];

  const chunks: Array<Record<string, T>> = [];
  let currentChunk: Record<string, T> = {};
  let currentEstimatedSize = 0;

  for (const key of keys) {
    const val = obj[key];
    const itemString = JSON.stringify({ [key]: val });
    const itemSize = itemString.length;

    if (currentEstimatedSize + itemSize > maxChunkBytes && Object.keys(currentChunk).length > 0) {
      chunks.push(currentChunk);
      currentChunk = {};
      currentEstimatedSize = 0;
    }

    currentChunk[key] = val;
    currentEstimatedSize += itemSize;
  }

  if (Object.keys(currentChunk).length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [{}];
}

class FirebaseService {
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore;
  private currentUser: User | null = null;
  private statusListeners = new Set<(status: CloudSyncStatus) => void>();
  private remoteSnapshotUnsub: Unsubscribe | null = null;
  private storageListenerUnsub: (() => void) | null = null;
  private debounceSyncTimer: any = null;
  private isApplyingRemoteUpdate = false;
  private activeSyncPromise: Promise<{ success: boolean; error?: string }> | null = null;
  private pendingSyncRequested = false;
  private lastSyncErrorTime = 0;

  private status: CloudSyncStatus = {
    isAuthLoading: true,
    isSignedIn: false,
    user: null,
    isSyncing: false,
    isLoadingCloudData: false,
    lastSyncedAt: typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_SYNC_KEY) : null,
    lastSyncDevice: null,
    error: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    autoSyncEnabled: typeof localStorage !== 'undefined' ? localStorage.getItem(AUTO_SYNC_KEY) !== 'false' : true,
  };

  constructor() {
    this.app = sharedApp;
    this.auth = sharedAuth;
    this.db = sharedDb;

    // Check if quota was already exceeded today to prevent any write attempts
    if (isQuotaExceededToday()) {
      this.status.isQuotaExceeded = true;
      this.status.autoSyncEnabled = false;
      this.status.error =
        'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn (20.000 lượt ghi/ngày). Dữ liệu máy tính vẫn được lưu an toàn 100%. Quota sẽ tự động đặt lại vào ngày mai.';
    }

    // Online/offline window events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateStatus({ isOnline: true });
        if (
          this.currentUser &&
          this.status.autoSyncEnabled &&
          !this.status.isQuotaExceeded &&
          !isQuotaExceededToday()
        ) {
          this.syncToCloud(false);
        }
      });
      window.addEventListener('offline', () => {
        this.updateStatus({ isOnline: false });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = String(event?.reason?.message || event?.reason || '');
        if (
          reason.includes('Quota limit exceeded') ||
          reason.includes('Quota exceeded') ||
          reason.includes('Free daily write units') ||
          reason.includes('resource-exhausted') ||
          (event?.reason as any)?.code === 'resource-exhausted'
        ) {
          this.markQuotaExceeded();
        }
      });

      window.addEventListener('error', (event) => {
        const msg = String(event?.message || '');
        if (
          msg.includes('Quota limit exceeded') ||
          msg.includes('Quota exceeded') ||
          msg.includes('Free daily write units') ||
          msg.includes('resource-exhausted')
        ) {
          this.markQuotaExceeded();
        }
      });
    }
  }

  private markQuotaExceeded() {
    if (typeof localStorage !== 'undefined') {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(QUOTA_EXCEEDED_DATE_KEY, today);
    }
    if (this.debounceSyncTimer) {
      clearTimeout(this.debounceSyncTimer);
      this.debounceSyncTimer = null;
    }
    console.warn('[Cloud Sync] Cloud Firestore quota exceeded. Switching to offline mode.');
    this.updateStatus({
      isQuotaExceeded: true,
      autoSyncEnabled: false,
      isSyncing: false,
      error:
        'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn (20.000 lượt ghi/ngày). Dữ liệu máy tính vẫn được lưu an toàn 100%. Quota sẽ tự động đặt lại vào ngày mai.',
    });
  }

  /**
   * Fast probe to verify if Cloud Firestore is reachable
   */
  public async checkServerHealth(): Promise<{ ok: boolean; error?: string }> {
    if (!this.currentUser) {
      return { ok: false, error: 'Chưa đăng nhập tài khoản Google.' };
    }
    try {
      const probeDoc = doc(this.db, 'users', this.currentUser.uid, 'data', 'health_probe');
      await Promise.race([
        getDocFromServer(probeDoc),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('probe_timeout')), 5000)
        ),
      ]);
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  /**
   * Save / update User Profile document at users/{uid}
   */
  private async recordUserProfile(user: User): Promise<UserProfileData> {
    const now = new Date().toISOString();
    const userDocRef = doc(this.db, 'users', user.uid);
    let existingProfile: UserProfileData | null = null;

    if (this.status.isQuotaExceeded || isQuotaExceededToday()) {
      return {
        uid: user.uid,
        displayName: user.displayName || 'Người dùng Google',
        email: user.email || null,
        photoURL: user.photoURL || null,
        createdAt: now,
        lastLoginAt: now,
      };
    }

    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        existingProfile = snap.data() as UserProfileData;
      }
    } catch (e: any) {
      console.warn('Could not read existing user profile:', e);
      const msg = String(e?.message || e);
      if (msg.includes('Quota') || msg.includes('resource-exhausted') || e?.code === 'resource-exhausted') {
        this.markQuotaExceeded();
      }
    }

    const profileData: UserProfileData = {
      uid: user.uid,
      displayName: user.displayName || 'Người dùng Google',
      email: user.email || null,
      photoURL: user.photoURL || null,
      createdAt: existingProfile?.createdAt || now,
      lastLoginAt: now,
    };

    if (this.status.isQuotaExceeded || isQuotaExceededToday()) {
      return profileData;
    }

    try {
      await setDoc(userDocRef, profileData, { merge: true });
    } catch (err: any) {
      console.warn('Error saving user profile to Firestore:', err);
      const msg = String(err?.message || err);
      if (
        msg.includes('Quota') ||
        msg.includes('resource-exhausted') ||
        msg.includes('Free daily write units') ||
        err?.code === 'resource-exhausted'
      ) {
        this.markQuotaExceeded();
      }
    }

    return profileData;
  }

  /**
   * Initializes Firebase Auth listener and cloud data synchronization
   */
  public init(
    onMigrationNeeded?: (summary: {
      shifts: number;
      counters: number;
      employees: number;
      schedules: number;
      assignments: number;
    }) => void
  ): () => void {
    // Safety timeout: Ensure isAuthLoading is never stuck for more than 3.5 seconds
    const safetyTimer = setTimeout(() => {
      if (this.status.isAuthLoading) {
        console.warn('[Cloud Sync] Auth loading timeout reached. Forcing loading completion.');
        this.updateStatus({ isAuthLoading: false });
      }
    }, 3500);

    const authUnsub = onAuthStateChanged(this.auth, async (user) => {
      clearTimeout(safetyTimer);
      this.currentUser = user;
      if (user) {
        const basicProfile: UserProfileData = {
          uid: user.uid,
          displayName: user.displayName || 'Người dùng Google',
          email: user.email || null,
          photoURL: user.photoURL || null,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        this.updateStatus({
          isAuthLoading: false,
          isSignedIn: true,
          user: basicProfile,
          error: null,
        });

        // Background tasks (non-blocking)
        this.recordUserProfile(user)
          .then((profile) => {
            if (profile) {
              this.updateStatus({ user: profile });
            }
          })
          .catch((err) => console.warn('Background recordUserProfile error:', err));

        // Setup real-time listener for incoming changes from other devices
        this.subscribeToUserCloudData(user.uid);

        // Check if this account needs first-time migration from localStorage
        this.handleInitialSignInSync(user.uid, onMigrationNeeded).catch((err) =>
          console.warn('Background handleInitialSignInSync error:', err)
        );
      } else {
        if (this.remoteSnapshotUnsub) {
          this.remoteSnapshotUnsub();
          this.remoteSnapshotUnsub = null;
        }
        this.updateStatus({
          isAuthLoading: false,
          isSignedIn: false,
          user: null,
          error: null,
        });
      }
    });

    // Listen to local changes to automatically push to Firestore
    this.storageListenerUnsub = storageService.subscribe(() => {
      if (this.isApplyingRemoteUpdate) {
        return;
      }
      if (
        !this.currentUser ||
        !this.status.autoSyncEnabled ||
        this.status.isQuotaExceeded ||
        isQuotaExceededToday()
      ) {
        return;
      }
      // Debounce auto-sync by 2.5 seconds to batch rapid edits
      if (this.debounceSyncTimer) {
        clearTimeout(this.debounceSyncTimer);
      }
      this.debounceSyncTimer = setTimeout(() => {
        if (
          !this.status.isQuotaExceeded &&
          !isQuotaExceededToday() &&
          this.currentUser
        ) {
          this.syncToCloud(false).catch((err) => {
            console.warn('Auto sync warning:', err);
          });
        }
      }, 2500);
    });

    return () => {
      authUnsub();
      if (this.remoteSnapshotUnsub) {
        this.remoteSnapshotUnsub();
      }
      if (this.storageListenerUnsub) {
        this.storageListenerUnsub();
      }
    };
  }

  /**
   * Check if local storage contains existing custom DWS data
   */
  public getLocalDataSummary() {
    const shifts = storageService.getShifts() || [];
    const counters = storageService.getCounters() || [];
    const employees = storageService.getEmployees() || [];
    const schedules = storageService.getAllWeeklySchedules() || {};
    const assignments = storageService.getAllAssignments() || {};

    const hasData =
      shifts.length > 0 ||
      counters.length > 0 ||
      employees.length > 0 ||
      Object.keys(schedules).length > 0 ||
      Object.keys(assignments).length > 0;

    return {
      hasData,
      shifts: shifts.length,
      counters: counters.length,
      employees: employees.length,
      schedules: Object.keys(schedules).length,
      assignments: Object.keys(assignments).length,
    };
  }

  /**
   * Triggers Google Sign-In with Firebase popup
   */
  public async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateStatus({ isSyncing: true, error: null });
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(this.auth, provider);
      this.updateStatus({ isSyncing: false });
      return { success: true };
    } catch (err: any) {
      console.error('Firebase Google Sign-In Error:', err);
      let errorMsg = 'Đăng nhập Google không thành công.';
      if (err.code === 'auth/popup-blocked') {
        errorMsg = 'Trình duyệt đang chặn cửa sổ đăng nhập (Popup blocked). Vui lòng cho phép popup.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'Bạn đã đóng cửa sổ đăng nhập Google.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      this.updateStatus({ isSyncing: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Signs out user
   */
  public async signOutUser(): Promise<void> {
    try {
      if (this.remoteSnapshotUnsub) {
        this.remoteSnapshotUnsub();
        this.remoteSnapshotUnsub = null;
      }
      await signOut(this.auth);
      this.currentUser = null;
      this.updateStatus({
        isSignedIn: false,
        user: null,
        error: null,
      });
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  }

  /**
   * Fetches and reassembles distributed chunked documents from users/{uid}/data/{docId}
   */
  private async fetchAndAssembleUserData(userId: string, manifest: CloudManifestDoc): Promise<CloudBackupPayload | null> {
    const chunkNames = manifest.chunks || ['meta', 'employees', 'schedules', 'assignments', 'history'];

    const docPromises = chunkNames.map(async (docName) => {
      try {
        const dRef = doc(this.db, 'users', userId, 'data', docName);
        const snap = await getDoc(dRef);
        return snap.exists() ? { docName, data: snap.data() } : null;
      } catch (err) {
        console.warn(`[Cloud Sync] Could not fetch doc ${docName}:`, err);
        return null;
      }
    });

    const results = await Promise.all(docPromises);

    const assembled: CloudBackupPayload = {
      userId,
      userEmail: manifest.userEmail,
      updatedAt: manifest.updatedAt,
      deviceId: manifest.deviceId,
      deviceName: manifest.deviceName,
      version: manifest.version || '2.0',
      shifts: [],
      shiftsMeta: null,
      counters: [],
      countersMeta: null,
      employees: [],
      employeesMeta: null,
      weeklySchedules: {},
      assignments: {},
      history: [],
      assignmentRules: null,
      excludedEmployees: [],
      swapRequests: [],
    };

    for (const res of results) {
      if (!res || !res.data) continue;
      const { data } = res;

      if (data.shifts) assembled.shifts = data.shifts;
      if (data.shiftsMeta) assembled.shiftsMeta = data.shiftsMeta;
      if (data.counters) assembled.counters = data.counters;
      if (data.countersMeta) assembled.countersMeta = data.countersMeta;
      if (data.assignmentRules) assembled.assignmentRules = data.assignmentRules;
      if (data.excludedEmployees) assembled.excludedEmployees = data.excludedEmployees;
      if (data.swapRequests) assembled.swapRequests = data.swapRequests;

      if (data.employees) assembled.employees = data.employees;
      if (data.employeesMeta) assembled.employeesMeta = data.employeesMeta;

      if (data.weeklySchedules) {
        Object.assign(assembled.weeklySchedules, data.weeklySchedules);
      }

      if (data.assignments) {
        Object.assign(assembled.assignments, data.assignments);
      }

      if (data.history && Array.isArray(data.history)) {
        assembled.history = data.history;
      }
    }

    return assembled;
  }

  /**
   * Listen to real-time changes on Firestore doc for this user.
   * If Device A updates Firestore, Device B gets this onSnapshot immediately!
   */
  private subscribeToUserCloudData(userId: string) {
    if (this.remoteSnapshotUnsub) {
      this.remoteSnapshotUnsub();
      this.remoteSnapshotUnsub = null;
    }

    const docRef = doc(this.db, 'users', userId, 'data', 'current');
    this.remoteSnapshotUnsub = onSnapshot(
      docRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data() as any;
        const myDeviceId = getOrCreateDeviceId();

        // If the update came from another device, apply it to local storage
        if (data && data.deviceId !== myDeviceId) {
          console.log(`[Cloud Sync] Nhận dữ liệu cập nhật từ ${data.deviceName || 'thiết bị khác'}`);
          if (data.isChunked) {
            const assembled = await this.fetchAndAssembleUserData(userId, data);
            if (assembled) {
              this.applyCloudPayloadToLocal(assembled, true);
            }
          } else {
            this.applyCloudPayloadToLocal(data as CloudBackupPayload, true);
          }
        }
      },
      (err) => {
        console.warn('Realtime sync listener warning:', err);
      }
    );
  }

  /**
   * On initial sign-in, check if cloud has existing data.
   * If cloud is empty and local storage has data, request migration confirmation.
   * If cloud has newer data, pull from cloud.
   */
  private async handleInitialSignInSync(
    userId: string,
    onMigrationNeeded?: (summary: {
      shifts: number;
      counters: number;
      employees: number;
      schedules: number;
      assignments: number;
    }) => void
  ) {
    try {
      this.updateStatus({ isLoadingCloudData: true });
      const docRef = doc(this.db, 'users', userId, 'data', 'current');
      let snapshot = await getDoc(docRef);

      // Fallback check legacy collection if primary doc doesn't exist
      if (!snapshot.exists()) {
        const legacyDocRef = doc(this.db, 'users', userId, 'dwsData', 'current');
        const legacySnap = await getDoc(legacyDocRef);
        if (legacySnap.exists()) {
          snapshot = legacySnap;
        }
      }

      if (snapshot.exists()) {
        const rawData = snapshot.data() as any;
        let cloudData: CloudBackupPayload | null = null;

        if (rawData.isChunked) {
          cloudData = await this.fetchAndAssembleUserData(userId, rawData);
        } else {
          cloudData = rawData as CloudBackupPayload;
        }

        const localLastSync = localStorage.getItem(LAST_SYNC_KEY);

        // If machine has never synced or cloud is newer, pull cloud data
        if (cloudData && (!localLastSync || (cloudData.updatedAt && cloudData.updatedAt > localLastSync))) {
          this.applyCloudPayloadToLocal(cloudData, false);
        }
      } else {
        // Cloud is empty for this user. Check if local storage has existing data.
        const summary = this.getLocalDataSummary();
        const hasPromptedKey = `aeon_dws_migrated_${userId}`;
        const alreadyPrompted = localStorage.getItem(hasPromptedKey);

        if (summary.hasData && !alreadyPrompted && onMigrationNeeded) {
          onMigrationNeeded(summary);
        } else if (summary.hasData) {
          await this.syncToCloud(false);
        }
      }
    } catch (err: any) {
      console.warn('Initial sign-in sync notice:', err?.message || err);
    } finally {
      this.updateStatus({ isLoadingCloudData: false });
    }
  }

  /**
   * Applies cloud payload into local storageService
   */
  public applyCloudPayloadToLocal(payload: CloudBackupPayload, notify = true) {
    try {
      this.isApplyingRemoteUpdate = true;

      const importPayload = {
        version: payload.version || '1.0',
        exportedAt: payload.updatedAt,
        shifts: payload.shifts || [],
        shiftsMeta: payload.shiftsMeta || null,
        counters: payload.counters || [],
        countersMeta: payload.countersMeta || null,
        employees: payload.employees || [],
        employeesMeta: payload.employeesMeta || null,
        weeklySchedules: payload.weeklySchedules || {},
        assignments: payload.assignments || {},
        history: payload.history || [],
        assignmentRules: payload.assignmentRules || null,
      };

      storageService.importAllData(JSON.stringify(importPayload));

      localStorage.setItem(LAST_SYNC_KEY, payload.updatedAt);
      localStorage.setItem(LOCAL_UPDATED_AT_KEY, payload.updatedAt);
      localStorage.setItem(LAST_SYNCED_FINGERPRINT_KEY, this.computeLocalFingerprint());
      this.updateStatus({
        lastSyncedAt: payload.updatedAt,
        lastSyncDevice: payload.deviceName || 'Thiết bị khác',
      });

      if (notify) {
        storageService.notifyChange('cloud_sync');
      }
    } catch (err) {
      console.error('Error applying cloud payload:', err);
    } finally {
      setTimeout(() => {
        this.isApplyingRemoteUpdate = false;
      }, 500);
    }
  }

  /**
   * Push all current data from local storageService up to Firestore
   * Automatically fragments large datasets into subdocuments so that each document never exceeds Firestore's 1MB limit.
   */
  public async syncToCloud(
    manual = true,
    onProgress?: (percent: number, stepText: string) => void,
    onDetailedProgress?: (progress: DetailedSyncProgress) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      const err = 'Chưa đăng nhập tài khoản Google.';
      onDetailedProgress?.({
        percent: 0,
        currentStepLabel: err,
        overallStatus: 'error',
        errorMessage: err,
        steps: [],
      });
      return { success: false, error: err };
    }

    if (this.status.isQuotaExceeded || isQuotaExceededToday()) {
      this.markQuotaExceeded();
      const err =
        'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn (20.000 lượt ghi/ngày). Dữ liệu trên máy tính vẫn được bảo vệ an toàn 100%. Quota sẽ tự động được làm mới vào ngày mai.';
      onDetailedProgress?.({
        percent: 0,
        currentStepLabel: 'Hạn mức đám mây tạm đầy',
        overallStatus: 'error',
        errorMessage: err,
        steps: [],
      });
      return {
        success: false,
        error: err,
      };
    }

    // Backoff auto-sync for 2.5 minutes after a sync error to prevent spamming while connection is unstable
    if (!manual && Date.now() - this.lastSyncErrorTime < 150000) {
      return { success: false, error: 'Tạm dừng đồng bộ tự động để đường truyền mạng ổn định.' };
    }

    if (this.activeSyncPromise) {
      if (!manual) {
        this.pendingSyncRequested = true;
        return this.activeSyncPromise;
      }
      try {
        await this.activeSyncPromise;
      } catch {
        // proceed
      }
    }

    this.activeSyncPromise = this.executeSyncToCloud(manual, onProgress, onDetailedProgress);
    try {
      const res = await this.activeSyncPromise;
      return res;
    } finally {
      this.activeSyncPromise = null;
      if (
        this.pendingSyncRequested &&
        this.currentUser &&
        this.status.autoSyncEnabled &&
        !this.status.isQuotaExceeded &&
        !isQuotaExceededToday()
      ) {
        this.pendingSyncRequested = false;
        setTimeout(() => {
          this.syncToCloud(false).catch((err) => {
            console.warn('[Cloud Sync] Coalesced sync notice:', err);
          });
        }, 1500);
      }
    }
  }

  private async executeSyncToCloud(
    manual: boolean,
    onProgress?: (percent: number, stepText: string) => void,
    onDetailedProgress?: (progress: DetailedSyncProgress) => void
  ): Promise<{ success: boolean; error?: string }> {
    const steps: SyncStepDetail[] = [
      {
        key: 'auth',
        label: 'Tài khoản & Kết nối Firestore',
        sublabel: this.currentUser?.email ? `Tài khoản: ${this.currentUser.email}` : 'Đang xác thực kết nối...',
        status: 'pending',
      },
      {
        key: 'shifts_counters',
        label: 'Danh mục Ca trực & Quầy thu ngân',
        sublabel: 'Ca làm việc, quầy thanh toán & quy tắc phân quầy',
        status: 'pending',
      },
      {
        key: 'employees',
        label: 'Hồ sơ & Danh sách Nhân sự',
        sublabel: 'Danh sách nhân viên & phân nhóm chức vụ',
        status: 'pending',
      },
      {
        key: 'schedules',
        label: 'Lịch làm việc các tuần (Schedules)',
        sublabel: 'Dữ liệu đăng ký ca & xếp lịch tuần',
        status: 'pending',
      },
      {
        key: 'assignments',
        label: 'Bảng phân công quầy theo ngày (Assignments)',
        sublabel: 'Dữ liệu xếp vị trí quầy chi tiết từng ngày',
        status: 'pending',
      },
      {
        key: 'manifest',
        label: 'Chỉ mục đám mây & Nhật ký an toàn',
        sublabel: 'Tạo dấu kiểm tra toàn vẹn & thời điểm đồng bộ',
        status: 'pending',
      },
    ];

    let currentSummary = {
      shifts: 0,
      counters: 0,
      employees: 0,
      schedules: 0,
      assignments: 0,
    };

    const emitDetailed = (
      percent: number,
      stepText: string,
      overallStatus: 'syncing' | 'completed' | 'error' = 'syncing',
      errorMessage?: string
    ) => {
      onProgress?.(percent, stepText);
      if (onDetailedProgress) {
        onDetailedProgress({
          percent,
          currentStepLabel: stepText,
          overallStatus,
          errorMessage,
          steps: steps.map((s) => ({ ...s })),
          summary: currentSummary,
        });
      }
    };

    if (!this.currentUser) {
      const err = 'Chưa đăng nhập tài khoản Google.';
      steps[0].status = 'error';
      steps[0].errorMessage = err;
      emitDetailed(0, err, 'error', err);
      return { success: false, error: err };
    }

    if (this.status.isQuotaExceeded || isQuotaExceededToday()) {
      this.markQuotaExceeded();
      const err =
        'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn (20.000 lượt ghi/ngày). Dữ liệu trên máy tính vẫn được bảo vệ an toàn 100%. Quota sẽ tự động được làm mới vào ngày mai.';
      steps[0].status = 'error';
      steps[0].errorMessage = err;
      emitDetailed(0, 'Hạn mức đám mây tạm đầy', 'error', err);
      return {
        success: false,
        error: err,
      };
    }

    // Skip unnecessary auto-sync writes if local data has not changed since last successful sync
    const currentFingerprint = this.computeLocalFingerprint();
    const lastSyncedFingerprint = localStorage.getItem(LAST_SYNCED_FINGERPRINT_KEY);
    if (!manual && lastSyncedFingerprint && currentFingerprint === lastSyncedFingerprint) {
      return { success: true };
    }

    try {
      this.updateStatus({ isSyncing: true, error: null });

      // Step 1: Auth & Connection
      steps[0].status = 'syncing';
      emitDetailed(12, 'Đang xác thực kết nối Google Cloud Firestore...');
      await new Promise((r) => setTimeout(r, 120));
      steps[0].status = 'completed';

      const now = new Date().toISOString();
      const myDeviceId = getOrCreateDeviceId();
      const deviceName = getDeviceName();
      const userId = this.currentUser.uid;
      const userEmail = this.currentUser.email || null;

      // Clean & prune history to prevent runaway document size
      const allHistory = storageService.getHistory() || [];
      const prunedHistory = allHistory.slice(0, 25).map((h) => ({
        id: h.id,
        date: h.date,
        weekId: h.weekId,
        dayName: h.dayName,
        timestamp: h.timestamp,
        author: h.author,
        workingCount: h.workingCount,
        offCount: h.offCount,
        assignedCount: h.assignedCount,
        unassignedCount: h.unassignedCount,
        counterCount: h.counterCount,
        data: h.data,
      }));

      const rawShifts = storageService.getShifts() || [];
      const rawShiftsMeta = storageService.getShiftsMeta() || null;
      const rawCounters = storageService.getCounters() || [];
      const rawCountersMeta = storageService.getCountersMeta() || null;
      const rawRules = storageService.getAssignmentRules() || null;
      const rawEmployees = storageService.getEmployees() || [];
      const rawEmployeesMeta = storageService.getEmployeesMeta() || null;
      const rawSchedules = storageService.getAllWeeklySchedules() || {};
      const rawAssignments = storageService.getAllAssignments() || {};

      currentSummary = {
        shifts: rawShifts.length,
        counters: rawCounters.length,
        employees: rawEmployees.length,
        schedules: Object.keys(rawSchedules).length,
        assignments: Object.keys(rawAssignments).length,
      };

      // Step 2: Shifts & Counters
      steps[1].sublabel = `${rawShifts.length} ca làm việc · ${rawCounters.length} quầy thu ngân`;
      steps[1].status = 'syncing';
      emitDetailed(28, `Đang xử lý ${rawShifts.length} ca trực và ${rawCounters.length} quầy...`);
      await new Promise((r) => setTimeout(r, 120));
      steps[1].status = 'completed';

      // Step 3: Employees
      steps[2].sublabel = `${rawEmployees.length} nhân viên thu ngân`;
      steps[2].status = 'syncing';
      emitDetailed(46, `Đang xử lý hồ sơ ${rawEmployees.length} nhân viên...`);
      await new Promise((r) => setTimeout(r, 120));
      steps[2].status = 'completed';

      // Step 4: Weekly Schedules
      steps[3].sublabel = `${Object.keys(rawSchedules).length} tuần lịch làm việc`;
      steps[3].status = 'syncing';
      emitDetailed(64, `Đang xử lý ${Object.keys(rawSchedules).length} tuần lịch làm việc...`);
      await new Promise((r) => setTimeout(r, 120));
      steps[3].status = 'completed';

      // Step 5: Daily Assignments
      steps[4].sublabel = `${Object.keys(rawAssignments).length} ngày phân công quầy`;
      steps[4].status = 'syncing';
      emitDetailed(80, `Đang xử lý ${Object.keys(rawAssignments).length} ngày xếp quầy...`);
      await new Promise((r) => setTimeout(r, 120));
      steps[4].status = 'completed';

      // Base shared properties
      const baseMeta = {
        userId,
        userEmail,
        updatedAt: now,
        deviceId: myDeviceId,
        deviceName,
        version: '2.0',
      };

      // 1. Meta Document (Shifts, Counters, Rules)
      const metaDocData = {
        ...baseMeta,
        shifts: rawShifts,
        shiftsMeta: rawShiftsMeta,
        counters: rawCounters,
        countersMeta: rawCountersMeta,
        assignmentRules: rawRules,
      };

      // 2. Employees Document
      const employeesDocData = {
        ...baseMeta,
        employees: rawEmployees,
        employeesMeta: rawEmployeesMeta,
      };

      // 3. History Document
      const historyDocData = {
        ...baseMeta,
        history: prunedHistory,
      };

      // 4. Chunk Schedules if necessary
      const scheduleChunks = splitObjectIntoChunks(rawSchedules, 350000);
      const scheduleDocs: Array<{ id: string; data: any }> = [];
      const scheduleDocIds: string[] = [];

      scheduleChunks.forEach((chunk, index) => {
        const id = scheduleChunks.length === 1 ? 'schedules' : `schedules_${index}`;
        scheduleDocIds.push(id);
        scheduleDocs.push({
          id,
          data: {
            ...baseMeta,
            weeklySchedules: chunk,
          },
        });
      });

      // 5. Chunk Assignments if necessary
      const assignmentChunks = splitObjectIntoChunks(rawAssignments, 350000);
      const assignmentDocs: Array<{ id: string; data: any }> = [];
      const assignmentDocIds: string[] = [];

      assignmentChunks.forEach((chunk, index) => {
        const id = assignmentChunks.length === 1 ? 'assignments' : `assignments_${index}`;
        assignmentDocIds.push(id);
        assignmentDocs.push({
          id,
          data: {
            ...baseMeta,
            assignments: chunk,
          },
        });
      });

      // 6. Manifest Index Document (stored at users/{uid}/data/current)
      const manifestDocData: CloudManifestDoc = {
        ...baseMeta,
        isChunked: true,
        chunks: [
          'meta',
          'employees',
          ...scheduleDocIds,
          ...assignmentDocIds,
          'history',
        ],
        summary: {
          shifts: rawShifts.length,
          counters: rawCounters.length,
          employees: rawEmployees.length,
          schedules: Object.keys(rawSchedules).length,
          assignments: Object.keys(rawAssignments).length,
          history: prunedHistory.length,
        },
      };

      steps[5].status = 'syncing';
      emitDetailed(88, 'Đang lưu lên Cloud Firestore...', 'syncing');

      // Use atomic writeBatch for superior reliability, zero pipeline stalls, and instant commit
      const batch = writeBatch(this.db);

      // Meta doc
      batch.set(
        doc(this.db, 'users', userId, 'data', 'meta'),
        JSON.parse(JSON.stringify(metaDocData))
      );
      // Employees doc
      batch.set(
        doc(this.db, 'users', userId, 'data', 'employees'),
        JSON.parse(JSON.stringify(employeesDocData))
      );
      // History doc
      batch.set(
        doc(this.db, 'users', userId, 'data', 'history'),
        JSON.parse(JSON.stringify(historyDocData))
      );
      // Schedules chunk docs
      for (const s of scheduleDocs) {
        batch.set(
          doc(this.db, 'users', userId, 'data', s.id),
          JSON.parse(JSON.stringify(s.data))
        );
      }
      // Assignments chunk docs
      for (const a of assignmentDocs) {
        batch.set(
          doc(this.db, 'users', userId, 'data', a.id),
          JSON.parse(JSON.stringify(a.data))
        );
      }
      // Manifest doc (current)
      batch.set(
        doc(this.db, 'users', userId, 'data', 'current'),
        JSON.parse(JSON.stringify(manifestDocData))
      );

      // Multi-attempt resilient write: Stage 1 = writeBatch with retry, Stage 2 = sequential setDoc fallback
      const docOperations: Array<{ path: string; data: any }> = [
        { path: 'meta', data: metaDocData },
        { path: 'employees', data: employeesDocData },
        { path: 'history', data: historyDocData },
        ...scheduleDocs.map((s) => ({ path: s.id, data: s.data })),
        ...assignmentDocs.map((a) => ({ path: a.id, data: a.data })),
        { path: 'current', data: manifestDocData },
      ];

      let commitSuccess = false;
      let lastCommitError: any = null;

      // Stage 1: Try atomic writeBatch (up to 2 attempts) with 50s timeout
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          emitDetailed(
            90,
            attempt === 1
              ? 'Đang lưu dữ liệu lên Cloud Firestore...'
              : 'Đường truyền chậm, đang thử lưu lại lần 2...',
            'syncing'
          );

          const attemptBatch = writeBatch(this.db);
          for (const op of docOperations) {
            attemptBatch.set(
              doc(this.db, 'users', userId, 'data', op.path),
              JSON.parse(JSON.stringify(op.data))
            );
          }

          await Promise.race([
            attemptBatch.commit(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout_batch')), 50000)
            ),
          ]);

          commitSuccess = true;
          break;
        } catch (err: any) {
          lastCommitError = err;
          const msg = String(err?.message || err);
          if (
            msg.includes('Quota') ||
            msg.includes('resource-exhausted') ||
            msg.includes('permission') ||
            msg.includes('PERMISSION_DENIED')
          ) {
            break;
          }
          console.warn(`[Cloud Sync] Batch commit attempt ${attempt} warning:`, err);
          await new Promise((r) => setTimeout(r, 1200));
        }
      }

      // Stage 2: If atomic batch timed out or failed on network, fallback to sequential setDoc
      // Discrete requests are vastly more resilient on unstable networks than a single giant multi-MB batch
      if (!commitSuccess) {
        const lastMsg = String(lastCommitError?.message || lastCommitError);
        const isQuotaOrPerm =
          lastMsg.includes('Quota') ||
          lastMsg.includes('resource-exhausted') ||
          lastMsg.includes('permission') ||
          lastMsg.includes('PERMISSION_DENIED');

        if (!isQuotaOrPerm) {
          try {
            emitDetailed(92, 'Chuyển sang chế độ lưu từng phần an toàn (Resilient Mode)...', 'syncing');
            for (let i = 0; i < docOperations.length; i++) {
              const op = docOperations[i];
              const pct = 90 + Math.round(((i + 1) / docOperations.length) * 8);
              emitDetailed(pct, `Đang ghi gói dữ liệu (${i + 1}/${docOperations.length})...`, 'syncing');

              const dRef = doc(this.db, 'users', userId, 'data', op.path);
              await Promise.race([
                setDoc(dRef, JSON.parse(JSON.stringify(op.data))),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('timeout_single')), 25000)
                ),
              ]);
            }
            commitSuccess = true;
          } catch (seqErr: any) {
            lastCommitError = seqErr;
          }
        }
      }

      if (!commitSuccess) {
        this.lastSyncErrorTime = Date.now();
        const writeErr = lastCommitError;
        const wMsg = String(writeErr?.message || writeErr);

        if (
          wMsg.includes('Quota limit exceeded') ||
          wMsg.includes('Quota exceeded') ||
          wMsg.includes('quota metric') ||
          wMsg.includes('Free daily write units') ||
          wMsg.includes('resource-exhausted') ||
          (writeErr as any)?.code === 'resource-exhausted' ||
          this.status.isQuotaExceeded ||
          isQuotaExceededToday()
        ) {
          this.markQuotaExceeded();
          const qMsg =
            'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn (20.000 lượt ghi/ngày). Dữ liệu trên máy an toàn 100%.';
          steps[5].status = 'error';
          steps[5].errorMessage = qMsg;
          emitDetailed(90, 'Hạn mức đám mây tạm đầy', 'error', qMsg);
          this.recordSyncHistoryEntry({
            type: 'upload',
            trigger: manual ? 'manual' : 'auto',
            status: 'error',
            timestamp: now,
            deviceName,
            summary: {
              shifts: rawShifts.length,
              counters: rawCounters.length,
              employees: rawEmployees.length,
              schedules: Object.keys(rawSchedules).length,
              assignments: Object.keys(rawAssignments).length,
            },
            message: qMsg,
          });
          return {
            success: false,
            error: qMsg,
          };
        }

        if (wMsg.includes('permission') || wMsg.includes('PERMISSION_DENIED')) {
          const pMsg = 'Không có quyền ghi dữ liệu. Vui lòng đăng nhập lại.';
          steps[5].status = 'error';
          steps[5].errorMessage = pMsg;
          emitDetailed(90, pMsg, 'error', pMsg);
          handleFirestoreError(
            writeErr,
            OperationType.WRITE,
            `users/${userId}/data/current`,
            this.currentUser
          );
          throw new Error(pMsg);
        }

        if (wMsg.includes('timeout')) {
          const tMsg =
            'Quá thời gian ghi dữ liệu lên Cloud Firestore do đường truyền mạng chậm hoặc chập chờn. Bạn có thể bấm "Thử lại ngay" hoặc xuất tệp sao lưu JSON để lưu trên máy.';
          steps[5].status = 'error';
          steps[5].errorMessage = tMsg;
          emitDetailed(90, 'Quá thời gian kết nối đám mây', 'error', tMsg);
          throw new Error(tMsg);
        }

        steps[5].status = 'error';
        steps[5].errorMessage = wMsg;
        emitDetailed(90, 'Lỗi ghi dữ liệu Firestore', 'error', wMsg);
        throw writeErr;
      }

      localStorage.setItem(LAST_SYNC_KEY, now);
      localStorage.setItem(LOCAL_UPDATED_AT_KEY, now);
      localStorage.setItem(LAST_SYNCED_FINGERPRINT_KEY, this.computeLocalFingerprint());
      localStorage.setItem(`aeon_dws_migrated_${userId}`, 'true');

      this.recordSyncHistoryEntry({
        type: 'upload',
        trigger: manual ? 'manual' : 'auto',
        status: 'success',
        timestamp: now,
        deviceName,
        summary: {
          shifts: rawShifts.length,
          counters: rawCounters.length,
          employees: rawEmployees.length,
          schedules: Object.keys(rawSchedules).length,
          assignments: Object.keys(rawAssignments).length,
        },
        message: 'Đã đồng bộ đầy đủ dữ liệu lên Google Firestore.',
      });

      this.updateStatus({
        isSyncing: false,
        lastSyncedAt: now,
        lastSyncDevice: deviceName,
        error: null,
      });

      steps[5].status = 'completed';
      emitDetailed(100, 'Đã đồng bộ đầy đủ thông tin lên Google Firestore!', 'completed');
      return { success: true };
    } catch (err: any) {
      console.error('Sync to cloud error:', err);
      const errorMsg = err?.message || 'Lỗi đẩy dữ liệu lên đám mây Firestore.';
      const activeStep = steps.find((s) => s.status === 'syncing') || steps[5];
      activeStep.status = 'error';
      activeStep.errorMessage = errorMsg;
      emitDetailed(90, errorMsg, 'error', errorMsg);

      this.recordSyncHistoryEntry({
        type: 'upload',
        trigger: manual ? 'manual' : 'auto',
        status: 'error',
        timestamp: new Date().toISOString(),
        deviceName: getDeviceName(),
        summary: this.getLocalDataSummary(),
        message: errorMsg,
      });
      this.updateStatus({ isSyncing: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Pull data manually from Firestore down to this device
   */
  public async pullFromCloud(
    onProgress?: (percent: number, stepText: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Chưa đăng nhập tài khoản Google.' };
    }

    if (this.activeSyncPromise) {
      try {
        await this.activeSyncPromise;
      } catch {
        // proceed
      }
    }

    try {
      this.updateStatus({ isSyncing: true, error: null });
      onProgress?.(25, 'Kết nối đến Cloud Firestore...');
      await new Promise((r) => setTimeout(r, 40));

      onProgress?.(50, 'Đang tải bản sao lưu mới nhất từ Cloud...');
      const primaryDocRef = doc(this.db, 'users', this.currentUser.uid, 'data', 'current');

      let snapshot;
      try {
        snapshot = await Promise.race([
          getDoc(primaryDocRef),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Quá thời gian tải dữ liệu từ Cloud Firestore. Vui lòng kiểm tra lại kết nối mạng.'
                  )
                ),
              35000
            )
          ),
        ]);

        if (!snapshot.exists()) {
          const legacyDocRef = doc(this.db, 'users', this.currentUser.uid, 'dwsData', 'current');
          snapshot = await getDoc(legacyDocRef);
        }
      } catch (getErr: any) {
        const gMsg = String(getErr?.message || getErr);
        if (gMsg.includes('permission') || gMsg.includes('PERMISSION_DENIED')) {
          handleFirestoreError(
            getErr,
            OperationType.GET,
            `users/${this.currentUser.uid}/data/current`,
            this.currentUser
          );
          throw new Error('Không có quyền đọc dữ liệu. Vui lòng đăng nhập lại.');
        }
        throw getErr;
      }

      if (!snapshot.exists()) {
        this.updateStatus({ isSyncing: false });
        return { success: false, error: 'Chưa có bản lưu nào trên đám mây của tài khoản này.' };
      }

      onProgress?.(75, 'Kiểm tra tính toàn vẹn dữ liệu...');
      await new Promise((r) => setTimeout(r, 40));

      const rawData = snapshot.data() as any;
      let cloudData: CloudBackupPayload | null = null;

      if (rawData.isChunked) {
        cloudData = await this.fetchAndAssembleUserData(this.currentUser.uid, rawData);
      } else {
        cloudData = rawData as CloudBackupPayload;
      }

      if (!cloudData) {
        throw new Error('Không thể tải các phần dữ liệu đã phân vùng từ Firestore.');
      }

      onProgress?.(92, 'Đang cập nhật vào máy...');
      this.applyCloudPayloadToLocal(cloudData, true);
      await new Promise((r) => setTimeout(r, 40));

      const now = new Date().toISOString();
      this.recordSyncHistoryEntry({
        type: 'download',
        trigger: 'manual',
        status: 'success',
        timestamp: now,
        deviceName: cloudData.deviceName || 'Google Cloud Firestore',
        summary: {
          shifts: cloudData.shifts?.length || 0,
          counters: cloudData.counters?.length || 0,
          employees: cloudData.employees?.length || 0,
          schedules: Object.keys(cloudData.weeklySchedules || {}).length,
          assignments: Object.keys(cloudData.assignments || {}).length,
        },
        message: 'Tải dữ liệu từ Đám mây về máy thành công.',
      });

      this.updateStatus({ isSyncing: false });
      onProgress?.(100, 'Tải về máy và đồng bộ thành công!');
      return { success: true };
    } catch (err: any) {
      console.error('Pull from cloud error:', err);
      const errorMsg = err?.message || 'Không thể tải dữ liệu từ đám mây.';
      this.recordSyncHistoryEntry({
        type: 'download',
        trigger: 'manual',
        status: 'error',
        timestamp: new Date().toISOString(),
        deviceName: getDeviceName(),
        summary: this.getLocalDataSummary(),
        message: errorMsg,
      });
      this.updateStatus({ isSyncing: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Compute a lightweight deterministic fingerprint of local data
   */
  public computeLocalFingerprint(): string {
    const shifts = storageService.getShifts() || [];
    const counters = storageService.getCounters() || [];
    const employees = storageService.getEmployees() || [];
    const schedules = storageService.getAllWeeklySchedules() || {};
    const assignments = storageService.getAllAssignments() || {};

    const shiftSig = shifts.length > 0 ? `${shifts.length}_${shifts[0]?.shiftCode || ''}_${shifts[shifts.length - 1]?.shiftCode || ''}` : '0';
    const counterSig = counters.length > 0 ? `${counters.length}_${counters[0]?.counterNumber || counters[0]?.id || ''}_${counters[counters.length - 1]?.counterNumber || counters[counters.length - 1]?.id || ''}` : '0';
    const empSig = employees.length > 0 ? `${employees.length}_${employees[0]?.employeeId || employees[0]?.fullName || ''}_${employees[employees.length - 1]?.employeeId || employees[employees.length - 1]?.fullName || ''}` : '0';
    const schedKeys = Object.keys(schedules).sort();
    const schedSig = `${schedKeys.length}_${schedKeys[0] || ''}_${schedKeys[schedKeys.length - 1] || ''}`;
    const asgKeys = Object.keys(assignments).sort();
    const asgSig = `${asgKeys.length}_${asgKeys[0] || ''}_${asgKeys[asgKeys.length - 1] || ''}`;

    return `${shiftSig}|${counterSig}|${empSig}|${schedSig}|${asgSig}`;
  }

  /**
   * Record a sync operation into local history
   */
  public recordSyncHistoryEntry(entry: Omit<SyncHistoryEntry, 'id' | 'formattedTime'>): void {
    try {
      const history = this.getSyncHistory();
      const newEntry: SyncHistoryEntry = {
        ...entry,
        id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        formattedTime: formatSyncDateTime(entry.timestamp),
      };
      // Keep last 30 entries
      const updated = [newEntry, ...history].slice(0, 30);
      localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to record sync history entry:', e);
    }
  }

  /**
   * Retrieve list of recent sync operations
   */
  public getSyncHistory(): SyncHistoryEntry[] {
    try {
      const raw = localStorage.getItem(SYNC_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // If empty but lastSyncedAt exists, provide an initial record
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSync) {
      const localSummary = this.getLocalDataSummary();
      return [
        {
          id: 'initial_last_sync',
          timestamp: lastSync,
          formattedTime: formatSyncDateTime(lastSync),
          type: 'upload',
          trigger: 'manual',
          status: 'success',
          deviceName: getDeviceName(),
          summary: {
            shifts: localSummary.shifts,
            counters: localSummary.counters,
            employees: localSummary.employees,
            schedules: localSummary.schedules,
            assignments: localSummary.assignments,
          },
          message: 'Đồng bộ gần nhất được ghi nhận từ thiết bị này',
        },
      ];
    }

    return [];
  }

  /**
   * Clear all sync history
   */
  public clearSyncHistory(): void {
    try {
      localStorage.removeItem(SYNC_HISTORY_KEY);
      this.updateStatus({});
    } catch {
      // ignore
    }
  }

  /**
   * Clear only failed error sync attempts
   */
  public clearFailedSyncHistory(): void {
    try {
      const history = this.getSyncHistory().filter((h) => h.status !== 'error');
      localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(history));
      this.updateStatus({});
    } catch {
      // ignore
    }
  }

  /**
   * Compare local device data with latest Google Cloud Firestore data
   * Strictly matches the user requirement:
   * - Đầy đủ và trùng khớp thông tin: Đã đồng bộ đầy đủ thông tin
   * - Bản lưu trên đám mây chưa có thông tin trên máy: Thông tin trên máy chưa được đồng bộ lên đám mây. Thời gian đồng bộ cuối {hiện mốc thời gian đồng bộ cuối cùng}
   */
  public async compareLocalWithCloud(): Promise<SyncComparisonResult> {
    const localSummary = this.getLocalDataSummary();
    const lastSyncedAt = localStorage.getItem(LAST_SYNC_KEY);
    const lastSyncedFormatted = formatSyncDateTime(lastSyncedAt);

    if (!this.currentUser) {
      return {
        isMatch: false,
        statusText: 'Bản lưu trên đám mây chưa có thông tin trên máy',
        message: `Thông tin trên máy chưa được đồng bộ lên đám mây. Thời gian đồng bộ cuối ${lastSyncedFormatted}`,
        lastSyncedAt,
        lastSyncedFormatted,
        cloudUpdatedAt: null,
        cloudDeviceName: null,
        localSummary,
        cloudSummary: null,
        differences: {
          shifts: { local: localSummary.shifts, cloud: 0, match: false },
          counters: { local: localSummary.counters, cloud: 0, match: false },
          employees: { local: localSummary.employees, cloud: 0, match: false },
          schedules: { local: localSummary.schedules, cloud: 0, match: false },
          assignments: { local: localSummary.assignments, cloud: 0, match: false },
          hasLocalChanges: true,
        },
      };
    }

    try {
      const primaryDocRef = doc(this.db, 'users', this.currentUser.uid, 'data', 'current');
      let snapshot = await Promise.race([
        getDoc(primaryDocRef),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15000)
        ),
      ]);

      if (!snapshot.exists()) {
        const legacyDocRef = doc(this.db, 'users', this.currentUser.uid, 'dwsData', 'current');
        const legacySnap = await getDoc(legacyDocRef);
        if (legacySnap.exists()) {
          snapshot = legacySnap;
        }
      }

      if (!snapshot.exists()) {
        const hasLocal = localSummary.hasData;
        return {
          isMatch: !hasLocal,
          statusText: hasLocal
            ? 'Bản lưu trên đám mây chưa có thông tin trên máy'
            : 'Đầy đủ và trùng khớp thông tin',
          message: hasLocal
            ? `Thông tin trên máy chưa được đồng bộ lên đám mây. Thời gian đồng bộ cuối ${lastSyncedFormatted}`
            : 'Đã đồng bộ đầy đủ thông tin',
          lastSyncedAt,
          lastSyncedFormatted,
          cloudUpdatedAt: null,
          cloudDeviceName: null,
          localSummary,
          cloudSummary: null,
          differences: {
            shifts: { local: localSummary.shifts, cloud: 0, match: !hasLocal },
            counters: { local: localSummary.counters, cloud: 0, match: !hasLocal },
            employees: { local: localSummary.employees, cloud: 0, match: !hasLocal },
            schedules: { local: localSummary.schedules, cloud: 0, match: !hasLocal },
            assignments: { local: localSummary.assignments, cloud: 0, match: !hasLocal },
            hasLocalChanges: hasLocal,
          },
        };
      }

      const cloudData = snapshot.data() as any;
      const cloudSummary = cloudData?.summary || {
        shifts: 0,
        counters: 0,
        employees: 0,
        schedules: 0,
        assignments: 0,
      };

      const cloudUpdatedAt = cloudData?.updatedAt || null;
      const cloudDeviceName = cloudData?.deviceName || null;

      const shiftsMatch = localSummary.shifts === cloudSummary.shifts;
      const countersMatch = localSummary.counters === cloudSummary.counters;
      const employeesMatch = localSummary.employees === cloudSummary.employees;
      const schedulesMatch = localSummary.schedules === cloudSummary.schedules;
      const assignmentsMatch = localSummary.assignments === cloudSummary.assignments;

      const localUpdatedAt = localStorage.getItem(LOCAL_UPDATED_AT_KEY);
      const lastSyncedFingerprint = localStorage.getItem(LAST_SYNCED_FINGERPRINT_KEY);
      const currentFingerprint = this.computeLocalFingerprint();

      let hasLocalChanges = false;
      if (lastSyncedFingerprint && currentFingerprint !== lastSyncedFingerprint) {
        hasLocalChanges = true;
      }
      if (
        localUpdatedAt &&
        lastSyncedAt &&
        new Date(localUpdatedAt).getTime() > new Date(lastSyncedAt).getTime() + 1500
      ) {
        hasLocalChanges = true;
      }

      const allCountsMatch =
        shiftsMatch && countersMatch && employeesMatch && schedulesMatch && assignmentsMatch;

      const isMatch = allCountsMatch && !hasLocalChanges;

      return {
        isMatch,
        statusText: isMatch
          ? 'Đầy đủ và trùng khớp thông tin'
          : 'Bản lưu trên đám mây chưa có thông tin trên máy',
        message: isMatch
          ? 'Đã đồng bộ đầy đủ thông tin'
          : `Thông tin trên máy chưa được đồng bộ lên đám mây. Thời gian đồng bộ cuối ${lastSyncedFormatted}`,
        lastSyncedAt,
        lastSyncedFormatted,
        cloudUpdatedAt,
        cloudDeviceName,
        localSummary,
        cloudSummary,
        differences: {
          shifts: { local: localSummary.shifts, cloud: cloudSummary.shifts, match: shiftsMatch },
          counters: { local: localSummary.counters, cloud: cloudSummary.counters, match: countersMatch },
          employees: { local: localSummary.employees, cloud: cloudSummary.employees, match: employeesMatch },
          schedules: { local: localSummary.schedules, cloud: cloudSummary.schedules, match: schedulesMatch },
          assignments: { local: localSummary.assignments, cloud: cloudSummary.assignments, match: assignmentsMatch },
          hasLocalChanges,
        },
      };
    } catch (err: any) {
      console.error('Error comparing local with cloud:', err);
      return {
        isMatch: false,
        statusText: 'Bản lưu trên đám mây chưa có thông tin trên máy',
        message: `Thông tin trên máy chưa được đồng bộ lên đám mây. Thời gian đồng bộ cuối ${lastSyncedFormatted}`,
        lastSyncedAt,
        lastSyncedFormatted,
        cloudUpdatedAt: null,
        cloudDeviceName: null,
        localSummary,
        cloudSummary: null,
        differences: {
          shifts: { local: localSummary.shifts, cloud: 0, match: false },
          counters: { local: localSummary.counters, cloud: 0, match: false },
          employees: { local: localSummary.employees, cloud: 0, match: false },
          schedules: { local: localSummary.schedules, cloud: 0, match: false },
          assignments: { local: localSummary.assignments, cloud: 0, match: false },
          hasLocalChanges: true,
        },
      };
    }
  }

  public getFirestoreDb(): Firestore {
    return this.db;
  }

  public getAuthInstance(): Auth {
    return this.auth;
  }

  public getCurrentAuthUser(): User | null {
    return this.currentUser;
  }

  public setAutoSync(enabled: boolean) {
    localStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
    this.updateStatus({ autoSyncEnabled: enabled });
    if (enabled && this.currentUser) {
      this.syncToCloud(false);
    }
  }

  public getStatus(): CloudSyncStatus {
    return { ...this.status };
  }

  public subscribe(callback: (status: CloudSyncStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => this.statusListeners.delete(callback);
  }

  private updateStatus(patch: Partial<CloudSyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.statusListeners.forEach((cb) => {
      try {
        cb(this.getStatus());
      } catch (err) {
        console.error('Status listener error:', err);
      }
    });
  }
}

export const firebaseService = new FirebaseService();
