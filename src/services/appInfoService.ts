import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { firebaseService, UserProfileData, handleFirestoreError, OperationType } from './firebaseService';
import { AppCreatorInfo, AppCreatorParsedFields, AppChangelogItem } from '../types';

const APP_INFO_LOCAL_KEY = 'dws_app_creator_info_cache';
const APP_INFO_DOC_PATH = 'app_metadata';
const APP_INFO_DOC_ID = 'creator_info';

// Known Owner Identifiers from environment or project specifications
const DEFAULT_OWNER_EMAIL = 'lecongthanh299@gmail.com';
const KNOWN_OWNER_UID = 'oL66Iw6DiLMPiq48Qx60c7Jwq123';

export const APP_CURRENT_VERSION = {
  version: 'v1.4.0',
  build: '2026.10-DWS-Enterprise',
  releaseDate: 'Tháng 10/2026',
  environment: 'Production & Cloud Connected',
  techStack: [
    'React 18 & TypeScript',
    'Tailwind CSS (Neumorphism Design System)',
    'Firebase Cloud Firestore & Authentication',
    'Vite High-Performance Bundler',
    'Excel & PDF Sheet Processing Engine',
  ],
  license: 'Bản quyền thuộc về tác giả & Ban Quản trị DWS Siêu Thị AEON',
};

export const DEFAULT_CREATOR_TEMPLATE_TEXT = `Tên người tạo: Lê Công Thành
Email: lecongthanh299@gmail.com
Đơn vị/Bộ phận: Bộ phận Thu Ngân Siêu Thị - Khối Vận Hành DWS
Vai trò: Trưởng nhóm phát triển & Điều phối kỹ thuật
Ngày bắt đầu phát triển: 01/01/2026
Mô tả ứng dụng: Hệ thống điều phối quầy thu ngân DWS & phân ca tự động chuyên nghiệp cho siêu thị AEON
Thông tin liên hệ: lecongthanh299@gmail.com | Zalo / SĐT nội bộ
Ghi chú: Bản quyền thuộc về tác giả & Ban Quản trị DWS Siêu Thị.`;

export const APP_CHANGELOG: AppChangelogItem[] = [
  {
    version: 'v1.4.0',
    date: '10/2026',
    title: 'Bổ sung Thông tin ứng dụng & Phân quyền Chủ dự án (Owner RBAC)',
    description:
      'Thêm phân hệ quản lý thông tin tác giả qua tệp TXT, bảo mật đa tầng Client & Firestore Security Rules, tối ưu hoá phân mảnh dữ liệu đám mây.',
    highlights: [
      'Thêm trang "Thông tin về ứng dụng" với 3 khu vực: Người tạo, Lịch sử chỉnh sửa và Phiên bản hệ thống.',
      'Cơ chế nạp và phân tích tệp .txt thông tin tác giả tự động với tiếng Việt UTF-8 chuẩn xác.',
      'Bảo mật phân quyền Chủ dự án (Owner Role): Chỉ tài khoản Google chủ sở hữu được quyền tải lên và cập nhật thông tin.',
      'Tích hợp Firebase Security Rules kiểm tra quyền cấp sở hữu, khóa chỉnh sửa với người dùng thông thường.',
      'Cung cấp tính năng tải tệp mẫu app-creator-info-template.txt chuẩn hóa.',
      'Tối ưu hóa kiến trúc phân mảnh dữ liệu Firestore (Chunking) giải quyết triệt để giới hạn 1MB tài liệu.',
    ],
    tags: ['security', 'feature', 'performance', 'ui'],
    isCurrent: true,
  },
  {
    version: 'v1.3.0',
    date: '09/2026',
    title: 'Tích hợp Firebase Authentication & Đồng bộ Cloud Đa Thiết Bị',
    description:
      'Nâng cấp hệ thống đăng nhập tài khoản Google và đồng bộ dữ liệu thời gian thực giữa các thiết bị di động, tablet và máy tính.',
    highlights: [
      'Đăng nhập một chạm với Google Popup Authentication bảo mật cao.',
      'Tự động đồng bộ hóa hai chiều (Cloud Sync) giữa máy trạm thu ngân và máy tính bảng giám sát.',
      'Cơ chế di chuyển dữ liệu (Migration) an toàn từ LocalStorage lên Cloud Firestore mà không làm mất dữ liệu cũ.',
      'Trạng thái mạng trực tuyến / ngoại tuyến thông minh và tự động thử lại khi có kết nối.',
      'Giao diện menu tài khoản hiển thị Avatar, Email và trạng thái đồng bộ chi tiết.',
    ],
    tags: ['sync', 'security', 'feature'],
  },
  {
    version: 'v1.2.0',
    date: '08/2026',
    title: 'Thuật toán Tự động Xếp quầy DWS & Cấu hình Quy tắc Nâng cao',
    description:
      'Tự động hóa hoàn toàn quy trình phân quầy thu ngân theo ca sáng/chiều, hỗ trợ các điều kiện phân bổ đặc thù của AEON.',
    highlights: [
      'Thuật toán Auto-Assigner cân đối nhân sự theo năng lực (SUP, Siêu thị, Bánh mỳ, Delica).',
      'Cấu hình quy tắc quầy cố định, ưu tiên khu vực và cảnh báo xếp ca liên tục (Zone Streak Warning).',
      'Công cụ gợi ý tự động (Auto-Suggest) tìm kiếm nhân sự phù hợp nhất cho các vị trí còn trống.',
      'Tự động tính toán nhu cầu nhân sự theo khung giờ (Planned Demand vs Actual Capacity).',
    ],
    tags: ['feature', 'performance'],
  },
  {
    version: 'v1.1.0',
    date: '07/2026',
    title: 'Hệ thống Quản lý Đổi ca & Báo cáo Phân tích Trực quan',
    description:
      'Cung cấp quy trình phê duyệt đổi ca làm việc nhanh chóng và bảng điều khiển báo cáo phân tích hiệu suất.',
    highlights: [
      'Giao diện yêu cầu đổi ca trực tiếp giữa các nhân viên thu ngân với đầy đủ lý do và trạng thái phê duyệt.',
      'Bảng phân tích tỷ lệ đi làm, công suất vận hành từng quầy thu ngân theo ngày và theo tuần.',
      'Tính năng Xem trước & In bảng phân quầy DWS chuẩn khổ A4 xuất trình ban quản lý siêu thị.',
      'Hỗ trợ chế độ ngoại tuyến hoàn toàn với tính năng Xuất/Nhập tệp sao lưu JSON.',
    ],
    tags: ['feature', 'ui'],
  },
  {
    version: 'v1.0.0',
    date: '06/2026',
    title: 'Khởi tạo Dự án DWS Cashier Management System',
    description:
      'Xây dựng nền tảng cốt lõi quản lý ca trực thu ngân, danh mục ca, quầy và nhân sự theo tiêu chuẩn siêu thị hiện đại.',
    highlights: [
      'Kiến trúc React + TypeScript hiện đại kết hợp phong cách Neumorphism mềm mại, sang trọng.',
      'Đọc và xử lý tệp Excel lịch tuần (.xlsx) tự động nhận diện danh sách nhân viên và mã ca.',
      'Quản lý danh mục Ca làm việc, Danh mục Quầy thu ngân và Hồ sơ nhân viên linh hoạt.',
      'Lưu trữ dữ liệu cục bộ an toàn, phản hồi tức thì trên mọi kích thước màn hình.',
    ],
    tags: ['feature', 'ui'],
  },
];

export class AppInfoService {
  /**
   * Kiểm tra xem tài khoản người dùng hiện tại có phải là Chủ dự án (Project Owner) hay không.
   * Kiểm tra theo cả UID và Email qua biến môi trường hoặc cấu hình chuẩn.
   */
  public isProjectOwner(user: UserProfileData | null | undefined): boolean {
    if (!user) return false;

    const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
    const envOwnerUid = (env.VITE_PROJECT_OWNER_UID as string | undefined)?.trim();
    const envOwnerEmail = (env.VITE_PROJECT_OWNER_EMAIL as string | undefined)?.trim().toLowerCase();

    const targetEmail = envOwnerEmail || DEFAULT_OWNER_EMAIL;

    // Check UID
    if (envOwnerUid && user.uid === envOwnerUid) return true;
    if (user.uid === KNOWN_OWNER_UID) return true;

    // Check Email
    if (user.email && user.email.toLowerCase() === targetEmail) return true;

    return false;
  }

  /**
   * Phân tích nội dung tệp .txt thành cấu trúc dữ liệu hiển thị có cấu trúc
   */
  public parseCreatorInfoTxt(rawText: string): AppCreatorParsedFields {
    const result: AppCreatorParsedFields = {
      customFields: [],
    };

    if (!rawText || typeof rawText !== 'string') {
      return result;
    }

    const lines = rawText.split(/\r?\n/);
    let currentKey: string | null = null;
    let currentValueAccumulator: string[] = [];

    const flushCurrent = () => {
      if (!currentKey) return;
      const combinedVal = currentValueAccumulator.join('\n').trim();
      if (!combinedVal) {
        currentKey = null;
        currentValueAccumulator = [];
        return;
      }

      const normalizedKey = currentKey.trim().toLowerCase();

      if (
        normalizedKey.includes('tên người tạo') ||
        normalizedKey.includes('người tạo') ||
        normalizedKey.includes('tác giả') ||
        normalizedKey.includes('creator') ||
        normalizedKey.includes('author')
      ) {
        result.creatorName = combinedVal;
      } else if (normalizedKey.includes('email') || normalizedKey.includes('thư điện tử')) {
        result.email = combinedVal;
      } else if (
        normalizedKey.includes('đơn vị') ||
        normalizedKey.includes('bộ phận') ||
        normalizedKey.includes('phòng ban') ||
        normalizedKey.includes('department')
      ) {
        result.department = combinedVal;
      } else if (
        normalizedKey.includes('vai trò') ||
        normalizedKey.includes('chức vụ') ||
        normalizedKey.includes('vị trí') ||
        normalizedKey.includes('role')
      ) {
        result.role = combinedVal;
      } else if (
        normalizedKey.includes('ngày bắt đầu') ||
        normalizedKey.includes('ngày phát triển') ||
        normalizedKey.includes('bắt đầu') ||
        normalizedKey.includes('start date')
      ) {
        result.developmentStartDate = combinedVal;
      } else if (
        normalizedKey.includes('mô tả') ||
        normalizedKey.includes('giới thiệu') ||
        normalizedKey.includes('description')
      ) {
        result.appDescription = combinedVal;
      } else if (
        normalizedKey.includes('thông tin liên hệ') ||
        normalizedKey.includes('liên hệ') ||
        normalizedKey.includes('contact') ||
        normalizedKey.includes('sđt') ||
        normalizedKey.includes('điện thoại')
      ) {
        result.contactInfo = combinedVal;
      } else if (
        normalizedKey.includes('ghi chú') ||
        normalizedKey.includes('lưu ý') ||
        normalizedKey.includes('notes') ||
        normalizedKey.includes('bản quyền')
      ) {
        result.notes = combinedVal;
      } else {
        // Custom field
        result.customFields = result.customFields || [];
        result.customFields.push({
          label: currentKey.trim(),
          value: combinedVal,
        });
      }

      currentKey = null;
      currentValueAccumulator = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      // Look for a key-value pattern: "Key: Value" or "Key：Value"
      const colonIdx = line.indexOf(':') !== -1 ? line.indexOf(':') : line.indexOf('：');

      if (colonIdx > 0 && colonIdx < 60) {
        // Potential new key
        const candidateKey = line.substring(0, colonIdx).trim();
        const candidateVal = line.substring(colonIdx + 1).trim();

        // Check if candidate key is a valid label (not just a time or URL like http://)
        if (
          !candidateKey.startsWith('http') &&
          !candidateKey.startsWith('https') &&
          candidateKey.length >= 2 &&
          !/^\d+$/.test(candidateKey)
        ) {
          flushCurrent();
          currentKey = candidateKey;
          if (candidateVal) {
            currentValueAccumulator.push(candidateVal);
          }
          continue;
        }
      }

      // Continuation of current key or loose text
      if (currentKey) {
        if (line.trim()) {
          currentValueAccumulator.push(line.trim());
        }
      } else if (line.trim()) {
        // Line without preceding key -> add as notes
        if (!result.notes) {
          result.notes = line.trim();
        } else {
          result.notes += '\n' + line.trim();
        }
      }
    }

    flushCurrent();
    return result;
  }

  /**
   * Đọc và xác thực tệp .txt từ người dùng tải lên
   */
  public async validateAndReadTxtFile(file: File): Promise<string> {
    // 1. Check extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.txt')) {
      throw new Error('Định dạng tệp không hợp lệ. Vui lòng chỉ tải lên tệp văn bản có phần mở rộng .txt');
    }

    // 2. Check size (max 1 MB)
    const MAX_SIZE = 1024 * 1024; // 1 MB
    if (file.size > MAX_SIZE) {
      throw new Error(`Dung lượng tệp quá lớn (${(file.size / 1024).toFixed(1)} KB). Giới hạn tối đa là 1 MB.`);
    }

    // 3. Read content as UTF-8
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        resolve(text);
      };
      reader.onerror = () => {
        reject(new Error('Không thể đọc nội dung tệp tin. Vui lòng thử lại.'));
      };
      reader.readAsText(file, 'UTF-8');
    });

    // 4. Security sanitization - check for dangerous script tags / executable markup
    if (
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(content) ||
      /javascript:/gi.test(content) ||
      /data:text\/html/gi.test(content)
    ) {
      throw new Error('Tệp chứa nội dung mã thực thi không an toàn và bị từ chối.');
    }

    if (!content.trim()) {
      throw new Error('Tệp tải lên rỗng, không có nội dung văn bản.');
    }

    return content;
  }

  /**
   * Tải về tệp mẫu app-creator-info-template.txt
   */
  public downloadTemplateFile(): void {
    const blob = new Blob([DEFAULT_CREATOR_TEMPLATE_TEXT], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app-creator-info-template.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Tải về tệp TXT hiện tại đang lưu
   */
  public downloadCurrentInfoFile(info: AppCreatorInfo): void {
    const rawContent = info.rawText || DEFAULT_CREATOR_TEMPLATE_TEXT;
    const blob = new Blob([rawContent], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-creator-info-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Lấy dữ liệu App Creator Info từ bộ nhớ đệm nội bộ (LocalStorage)
   */
  public getCachedCreatorInfo(): AppCreatorInfo | null {
    try {
      const raw = localStorage.getItem(APP_INFO_LOCAL_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Lưu thông tin vào bộ nhớ đệm cục bộ
   */
  public setCachedCreatorInfo(info: AppCreatorInfo): void {
    try {
      localStorage.setItem(APP_INFO_LOCAL_KEY, JSON.stringify(info));
    } catch (err) {
      console.warn('Failed to cache creator info locally', err);
    }
  }

  /**
   * Lấy thông tin người tạo mặc định khi chưa có dữ liệu trên Firestore
   */
  public getDefaultCreatorInfo(): AppCreatorInfo {
    const cached = this.getCachedCreatorInfo();
    if (cached) return cached;

    const parsed = this.parseCreatorInfoTxt(DEFAULT_CREATOR_TEMPLATE_TEXT);
    return {
      rawText: DEFAULT_CREATOR_TEMPLATE_TEXT,
      parsedFields: parsed,
      updatedAt: '2026-10-01T00:00:00.000Z',
      updatedByUid: KNOWN_OWNER_UID,
      updatedByEmail: DEFAULT_OWNER_EMAIL,
      version: APP_CURRENT_VERSION.version,
    };
  }

  /**
   * Tải dữ liệu từ Cloud Firestore
   */
  public async fetchCreatorInfoFromCloud(): Promise<AppCreatorInfo> {
    const db = firebaseService.getFirestoreDb();
    if (!db) {
      return this.getDefaultCreatorInfo();
    }

    try {
      const docRef = doc(db, APP_INFO_DOC_PATH, APP_INFO_DOC_ID);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        const rawText = data.rawText || '';
        const parsed = this.parseCreatorInfoTxt(rawText);

        const info: AppCreatorInfo = {
          rawText,
          parsedFields: parsed,
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedByUid: data.updatedByUid || KNOWN_OWNER_UID,
          updatedByEmail: data.updatedByEmail || DEFAULT_OWNER_EMAIL,
          version: data.version || APP_CURRENT_VERSION.version,
        };

        this.setCachedCreatorInfo(info);
        return info;
      }
    } catch (err) {
      console.warn('Error fetching app creator info from cloud:', err);
    }

    return this.getDefaultCreatorInfo();
  }

  /**
   * Lưu thông tin người tạo ứng dụng lên Cloud Firestore (Chỉ Owner có quyền)
   */
  public async saveCreatorInfoToCloud(
    rawText: string,
    currentUser: UserProfileData
  ): Promise<AppCreatorInfo> {
    if (!this.isProjectOwner(currentUser)) {
      throw new Error('Chỉ tài khoản Chủ ứng dụng (Project Owner) mới có quyền cập nhật thông tin tác giả.');
    }

    const db = firebaseService.getFirestoreDb();
    if (!db) {
      throw new Error('Không thể kết nối đến cơ sở dữ liệu Firestore.');
    }

    const parsed = this.parseCreatorInfoTxt(rawText);
    const info: AppCreatorInfo = {
      rawText,
      parsedFields: parsed,
      updatedAt: new Date().toISOString(),
      updatedByUid: currentUser.uid,
      updatedByEmail: currentUser.email || DEFAULT_OWNER_EMAIL,
      version: APP_CURRENT_VERSION.version,
    };

    try {
      const docRef = doc(db, APP_INFO_DOC_PATH, APP_INFO_DOC_ID);
      await setDoc(docRef, {
        rawText: info.rawText,
        updatedAt: info.updatedAt,
        updatedByUid: info.updatedByUid,
        updatedByEmail: info.updatedByEmail,
        version: info.version,
      });

      this.setCachedCreatorInfo(info);
      return info;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${APP_INFO_DOC_PATH}/${APP_INFO_DOC_ID}`, firebaseService.getCurrentAuthUser());
    }
  }

  /**
   * Lắng nghe thay đổi thời gian thực của thông tin người tạo từ Firestore
   */
  public subscribeToCreatorInfo(
    onUpdate: (info: AppCreatorInfo) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const db = firebaseService.getFirestoreDb();
    if (!db) {
      onUpdate(this.getDefaultCreatorInfo());
      return () => {};
    }

    const docRef = doc(db, APP_INFO_DOC_PATH, APP_INFO_DOC_ID);
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const rawText = data.rawText || '';
          const parsed = this.parseCreatorInfoTxt(rawText);

          const info: AppCreatorInfo = {
            rawText,
            parsedFields: parsed,
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedByUid: data.updatedByUid || KNOWN_OWNER_UID,
            updatedByEmail: data.updatedByEmail || DEFAULT_OWNER_EMAIL,
            version: data.version || APP_CURRENT_VERSION.version,
          };

          this.setCachedCreatorInfo(info);
          onUpdate(info);
        } else {
          onUpdate(this.getDefaultCreatorInfo());
        }
      },
      (error) => {
        console.warn('Snapshot error on creator_info:', error);
        if (onError) onError(error);
      }
    );
  }
}

export const appInfoService = new AppInfoService();
