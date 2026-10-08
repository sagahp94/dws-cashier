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
  onSnapshot,
  Unsubscribe,
  getDocFromServer,
} from 'firebase/firestore';
import { firebaseConfig } from '../config/firebaseConfig';
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

const LOCAL_DEVICE_KEY = 'aeon_dws_device_id';
const LAST_SYNC_KEY = 'aeon_dws_last_synced_at';
const AUTO_SYNC_KEY = 'aeon_dws_auto_sync';

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
    this.app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    const dbId = (firebaseConfig as any).firestoreDatabaseId;
    try {
      this.db = initializeFirestore(
        this.app,
        {
          ignoreUndefinedProperties: true,
        },
        dbId
      );
    } catch {
      this.db = getFirestore(this.app, dbId);
    }

    // Online/offline window events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateStatus({ isOnline: true });
        if (this.currentUser && this.status.autoSyncEnabled && !this.status.isQuotaExceeded) {
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
          reason.includes('Free daily write units')
        ) {
          this.markQuotaExceeded();
        }
      });
    }
  }

  private markQuotaExceeded() {
    if (!this.status.isQuotaExceeded) {
      console.warn('[Cloud Sync] Cloud Firestore quota exceeded. Switching to offline mode.');
      this.updateStatus({
        isQuotaExceeded: true,
        autoSyncEnabled: false,
        error: 'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn. Dữ liệu vẫn được lưu an toàn trên máy.',
      });
    }
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

    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        existingProfile = snap.data() as UserProfileData;
      }
    } catch (e) {
      console.warn('Could not read existing user profile:', e);
    }

    const profileData: UserProfileData = {
      uid: user.uid,
      displayName: user.displayName || 'Người dùng Google',
      email: user.email || null,
      photoURL: user.photoURL || null,
      createdAt: existingProfile?.createdAt || now,
      lastLoginAt: now,
    };

    try {
      await setDoc(userDocRef, profileData, { merge: true });
    } catch (err) {
      console.warn('Error saving user profile to Firestore:', err);
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
    const authUnsub = onAuthStateChanged(this.auth, async (user) => {
      this.currentUser = user;
      if (user) {
        // Save/update user profile in users/{uid}
        const profile = await this.recordUserProfile(user);

        this.updateStatus({
          isAuthLoading: false,
          isSignedIn: true,
          user: profile,
          error: null,
        });

        // Setup real-time listener for incoming changes from other devices
        this.subscribeToUserCloudData(user.uid);

        // Check if this account needs first-time migration from localStorage
        await this.handleInitialSignInSync(user.uid, onMigrationNeeded);
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
      if (!this.currentUser || !this.status.autoSyncEnabled || this.status.isQuotaExceeded) {
        return;
      }
      // Debounce auto-sync by 2.5 seconds to batch rapid edits
      if (this.debounceSyncTimer) {
        clearTimeout(this.debounceSyncTimer);
      }
      this.debounceSyncTimer = setTimeout(() => {
        if (!this.status.isQuotaExceeded && this.currentUser) {
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
    onProgress?: (percent: number, stepText: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Chưa đăng nhập tài khoản Google.' };
    }

    if (!manual && this.status.isQuotaExceeded) {
      return {
        success: false,
        error: 'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã đầy. Hệ thống tạm thời chuyển sang chế độ Offline.',
      };
    }

    if (!manual && Date.now() - this.lastSyncErrorTime < 6000) {
      return { success: false, error: 'Tạm dừng đồng bộ tự động để đường truyền ổn định.' };
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

    this.activeSyncPromise = this.executeSyncToCloud(manual, onProgress);
    try {
      const res = await this.activeSyncPromise;
      return res;
    } finally {
      this.activeSyncPromise = null;
      if (this.pendingSyncRequested && this.currentUser && this.status.autoSyncEnabled) {
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
    onProgress?: (percent: number, stepText: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Chưa đăng nhập tài khoản Google.' };
    }

    try {
      this.updateStatus({ isSyncing: true, error: null });
      onProgress?.(15, 'Kiểm tra tài khoản & kết nối Cloud Firestore...');
      await new Promise((r) => setTimeout(r, 40));

      const now = new Date().toISOString();
      const myDeviceId = getOrCreateDeviceId();
      const deviceName = getDeviceName();
      const userId = this.currentUser.uid;
      const userEmail = this.currentUser.email || null;

      onProgress?.(35, 'Thu thập dữ liệu Ca, Quầy, Nhân sự...');
      await new Promise((r) => setTimeout(r, 40));

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

      onProgress?.(55, 'Tối ưu và phân vùng dữ liệu Firestore...');
      await new Promise((r) => setTimeout(r, 40));

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

      onProgress?.(75, 'Đang lưu lên Cloud Firestore...');

      const writePromises: Promise<any>[] = [
        // Meta doc
        setDoc(doc(this.db, 'users', userId, 'data', 'meta'), JSON.parse(JSON.stringify(metaDocData))),
        // Employees doc
        setDoc(doc(this.db, 'users', userId, 'data', 'employees'), JSON.parse(JSON.stringify(employeesDocData))),
        // History doc
        setDoc(doc(this.db, 'users', userId, 'data', 'history'), JSON.parse(JSON.stringify(historyDocData))),
        // Schedules chunk docs
        ...scheduleDocs.map((s) =>
          setDoc(doc(this.db, 'users', userId, 'data', s.id), JSON.parse(JSON.stringify(s.data)))
        ),
        // Assignments chunk docs
        ...assignmentDocs.map((a) =>
          setDoc(doc(this.db, 'users', userId, 'data', a.id), JSON.parse(JSON.stringify(a.data)))
        ),
        // Manifest doc (current)
        setDoc(doc(this.db, 'users', userId, 'data', 'current'), JSON.parse(JSON.stringify(manifestDocData))),
        // Legacy collection mirror for safety
        setDoc(doc(this.db, 'users', userId, 'dwsData', 'current'), JSON.parse(JSON.stringify(manifestDocData))),
      ];

      try {
        await Promise.race([
          Promise.all(writePromises),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Quá thời gian ghi dữ liệu lên Cloud Firestore. Vui lòng thử lại.'
                  )
                ),
              35000
            )
          ),
        ]);
      } catch (writeErr: any) {
        this.lastSyncErrorTime = Date.now();
        const wMsg = String(writeErr?.message || writeErr);

        if (
          wMsg.includes('Quota limit exceeded') ||
          wMsg.includes('Quota exceeded') ||
          wMsg.includes('quota metric') ||
          wMsg.includes('Free daily write units') ||
          this.status.isQuotaExceeded
        ) {
          this.markQuotaExceeded();
          throw new Error(
            'Hạn mức ghi Cloud Firestore miễn phí hôm nay đã chạm giới hạn. Dữ liệu trên máy của bạn vẫn an toàn 100%.'
          );
        }

        if (wMsg.includes('permission') || wMsg.includes('PERMISSION_DENIED')) {
          handleFirestoreError(
            writeErr,
            OperationType.WRITE,
            `users/${userId}/data/current`,
            this.currentUser
          );
          throw new Error('Không có quyền ghi dữ liệu. Vui lòng đăng nhập lại.');
        }

        throw writeErr;
      }

      localStorage.setItem(LAST_SYNC_KEY, now);
      localStorage.setItem(`aeon_dws_migrated_${userId}`, 'true');

      this.updateStatus({
        isSyncing: false,
        lastSyncedAt: now,
        lastSyncDevice: deviceName,
        error: null,
      });

      onProgress?.(100, 'Sao lưu lên Đám mây hoàn tất!');
      return { success: true };
    } catch (err: any) {
      console.error('Sync to cloud error:', err);
      const errorMsg = err?.message || 'Lỗi đẩy dữ liệu lên đám mây Firestore.';
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

      this.updateStatus({ isSyncing: false });
      onProgress?.(100, 'Tải về máy và đồng bộ thành công!');
      return { success: true };
    } catch (err: any) {
      console.error('Pull from cloud error:', err);
      const errorMsg = err?.message || 'Không thể tải dữ liệu từ đám mây.';
      this.updateStatus({ isSyncing: false, error: errorMsg });
      return { success: false, error: errorMsg };
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
