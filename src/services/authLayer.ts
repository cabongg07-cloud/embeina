/**
 * Lớp xác thực (Auth Layer) & Phân quyền trung tâm (RBAC) cho "Góc Nhỏ Lấp Lánh".
 *
 * - Hỗ trợ 2 chế độ qua hằng số AUTH_MODE = "demo" | "real":
 *   + "demo": Cho phép chuyển vai nhanh Khách / Người dùng / Creator để thử nghiệm giao diện.
 *             TUYỆT ĐỐI KHÔNG lưu mật khẩu dạng chữ thường trong localStorage (chỉ lưu tên, email và vai trò giả lập).
 *   + "real": Ẩn thanh chuyển vai nhanh, yêu cầu đăng nhập qua signUp / signIn.
 *             Các hàm bên dưới được thiết kế sẵn chữ ký bất đồng bộ chuẩn để bạn nối trực tiếp
 *             với Firebase Auth hoặc Supabase Auth mà không cần sửa giao diện.
 */

import { dataStore } from './dataLayer';
import { UserRole } from '../data/sampleData';

export const AUTH_MODE: 'demo' | 'real' = 'demo';

export type CreatorApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole; // Vai trò hiệu lực hiện tại ('guest' | 'user' | 'creator')
  requestedRole?: 'user' | 'creator';
  creatorStatus?: CreatorApprovalStatus;
  avatarEmoji: string;
  isSiteOwner?: boolean; // Đánh dấu Creator là Chủ web (mở được bảng "Cài đặt trang" & sửa mọi nội dung)
  linkedCreatorId?: string; // ID hồ sơ Creator gắn với tài khoản này (để Creator thường chỉ sửa nội dung của chính mình)
  isDemoNote?: string;
}

export type PermissionAction =
  | 'edit'
  | 'site_settings'
  | 'view_creator_tabs'
  | 'write_feedback'
  | 'manage_feedback'
  | 'favorite_char'
  | 'personal_note'
  | 'unlock_char'
  | 'vote_ranking'
  | 'send_love_message'
  | 'heart_love_message'
  | 'create_request'
  | 'reply_request'
  | 'order_commission'
  | 'join_giveaway'
  | 'play_minigame'
  | 'use_docs_vault'
  | 'use_personal_prompt_vault'
  | 'submit_rescue_report'
  | 'save_backup_entry'
  | 'creator_edit_mode'
  | 'manage_own_chars'
  | 'manage_commission_board'
  | 'publish_shared_prompt'
  | 'manage_requests_inbox'
  | 'create_giveaway'
  | 'draw_giveaway_winner'
  | 'manage_rescue_status'
  | 'approve_creator_requests';

const USER_ACTIONS: PermissionAction[] = [
  'write_feedback',
  'favorite_char',
  'personal_note',
  'unlock_char',
  'vote_ranking',
  'send_love_message',
  'heart_love_message',
  'create_request',
  'reply_request',
  'order_commission',
  'join_giveaway',
  'play_minigame',
  'use_docs_vault',
  'use_personal_prompt_vault',
  'submit_rescue_report',
  'save_backup_entry',
];

const CREATOR_ACTIONS: PermissionAction[] = [
  ...USER_ACTIONS,
  'edit',
  'view_creator_tabs',
  'manage_feedback',
  'creator_edit_mode',
  'manage_own_chars',
  'manage_commission_board',
  'publish_shared_prompt',
  'manage_requests_inbox',
  'create_giveaway',
  'draw_giveaway_winner',
  'manage_rescue_status',
  'approve_creator_requests',
];

const AUTH_SESSION_KEY = 'auth_current_session_v1';
const AUTH_ACCOUNTS_LIST_KEY = 'auth_mock_accounts_v1';

export interface StoredSafeAccount {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  requestedRole: 'user' | 'creator';
  creatorStatus: CreatorApprovalStatus;
  avatarEmoji: string;
  isSiteOwner?: boolean;
  linkedCreatorId?: string;
  createdAt: string;
  // LƯU Ý BẢO MẬT: Tuyệt đối KHÔNG lưu trường password ở đây trong localStorage.
}

const DEFAULT_GUEST_USER: AuthUser = {
  id: 'guest-visitor',
  email: '',
  displayName: 'Khách ghé thăm',
  role: 'guest',
  creatorStatus: 'none',
  avatarEmoji: '🌱',
  isSiteOwner: false,
  isDemoNote: 'Chế độ Khách (chỉ xem)',
};

const INITIAL_PENDING_ACCOUNTS: StoredSafeAccount[] = [
  {
    id: 'usr_pending_sample_1',
    email: 'haian.creator@gocnho.local',
    displayName: 'Hải An (Mây Mùa Thu)',
    role: 'user',
    requestedRole: 'creator',
    creatorStatus: 'pending',
    avatarEmoji: '🎨',
    linkedCreatorId: 'creator-hien-suong',
    createdAt: '2026-10-18T14:20:00Z',
  },
  {
    id: 'usr_pending_sample_2',
    email: 'linhdan.writer@gocnho.local',
    displayName: 'Linh Đan (Tiệm Trà Đêm)',
    role: 'user',
    requestedRole: 'creator',
    creatorStatus: 'pending',
    avatarEmoji: '🫖',
    linkedCreatorId: 'creator-co-tich',
    createdAt: '2026-10-19T08:15:00Z',
  },
];

function ensureSampleAccounts(): StoredSafeAccount[] {
  const existing = dataStore.get<StoredSafeAccount[] | null>(
    AUTH_ACCOUNTS_LIST_KEY,
    null
  );
  if (!existing || !Array.isArray(existing)) {
    dataStore.set(AUTH_ACCOUNTS_LIST_KEY, INITIAL_PENDING_ACCOUNTS, true);
    return INITIAL_PENDING_ACCOUNTS;
  }
  return existing;
}

/**
 * Hàm kiểm tra quyền trung tâm `can(action, user?)` dùng trên toàn bộ ứng dụng.
 * Có thể gọi `can("edit")` hoặc `can("edit", currentUser)`.
 * Khách và Người dùng tuyệt đối trả về `false` với `"edit"` và `"site_settings"`.
 */
export function can(
  action: PermissionAction,
  user?: AuthUser | null
): boolean {
  const resolvedUser = user !== undefined ? user : authService.getCurrentUser();
  const effectiveRole: UserRole = resolvedUser?.role || 'guest';

  if (effectiveRole === 'guest') {
    return false;
  }

  if (effectiveRole === 'user') {
    return USER_ACTIONS.includes(action);
  }

  if (effectiveRole === 'creator') {
    // Nếu tài khoản đăng ký Creator nhưng đang ở trạng thái chờ duyệt ('pending') hoặc bị từ chối,
    // chỉ có quyền như 'user' cho đến khi được chủ web duyệt.
    if (
      resolvedUser?.creatorStatus === 'pending' ||
      resolvedUser?.creatorStatus === 'rejected'
    ) {
      return USER_ACTIONS.includes(action);
    }
    if (action === 'site_settings') {
      return Boolean(resolvedUser?.isSiteOwner);
    }
    return CREATOR_ACTIONS.includes(action);
  }

  return false;
}

/**
 * Kiểm tra xem người dùng hiện tại có được phép sửa/xóa một mục nội dung cụ thể không:
 * - Phải đang bật `editMode` VÀ `can("edit", user)` === true.
 * - Nếu là Chủ web (`user.isSiteOwner === true`) hoặc mục chung (`!ownerCreatorId`) → được phép sửa tất cả.
 * - Nếu là Creator thường (`!user.isSiteOwner`) → chỉ sửa được nội dung của chính mình (`ownerCreatorId === user.linkedCreatorId`).
 */
export function canEditItem(
  user: AuthUser | null | undefined,
  ownerCreatorId?: string | null,
  editMode = true
): boolean {
  if (!editMode || !can('edit', user)) {
    return false;
  }
  if (user?.isSiteOwner) {
    return true;
  }
  if (!ownerCreatorId) {
    return true;
  }
  const myCreatorId = user?.linkedCreatorId || 'creator-lam-vong';
  return ownerCreatorId === myCreatorId || ownerCreatorId === user?.id;
}

type AuthChangeListener = (user: AuthUser) => void;
const listeners = new Set<AuthChangeListener>();

function notifyListeners(user: AuthUser) {
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch {
      // Ignore listener error
    }
  });
}

export const authService = {
  /**
   * Lấy người dùng hiện tại
   * [CHỖ CẦN NỐI BACKEND THẬT]: Thay bằng `firebase.auth().currentUser` hoặc `supabase.auth.getUser()`
   */
  getCurrentUser(): AuthUser {
    ensureSampleAccounts();
    const saved = dataStore.get<AuthUser | null>(AUTH_SESSION_KEY, null);
    if (!saved || !saved.role) {
      return DEFAULT_GUEST_USER;
    }
    return saved;
  },

  /**
   * Lắng nghe sự thay đổi trạng thái đăng nhập
   * [CHỖ CẦN NỐI BACKEND THẬT]: Thay bằng `onAuthStateChanged(auth, callback)` hoặc `supabase.auth.onAuthStateChange`
   */
  onAuthChange(callback: AuthChangeListener): () => void {
    listeners.add(callback);
    callback(this.getCurrentUser());
    return () => {
      listeners.delete(callback);
    };
  },

  /**
   * Đăng ký tài khoản mới
   * - Nếu chọn "Tôi là creator", tài khoản sẽ ở trạng thái `creatorStatus: 'pending'` (chờ duyệt)
   *   và trong lúc chờ vẫn dùng với quyền `role: 'user'`.
   * - KHÔNG lưu mật khẩu chữ thường vào localStorage.
   * [CHỖ CẦN NỐI BACKEND THẬT]: Thay bằng `createUserWithEmailAndPassword` hoặc `supabase.auth.signUp`
   */
  async signUp(params: {
    email: string;
    password: string; // Chỉ nhận ở form, không bao giờ lưu plaintext xuống localStorage
    displayName: string;
    accountType: 'user' | 'creator';
  }): Promise<{ user: AuthUser; message: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.displayName.trim() || 'Bạn Nhỏ Đáng Yêu';
    const isApplyingCreator = params.accountType === 'creator';

    const newAccount: StoredSafeAccount = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      displayName: cleanName,
      role: 'user',
      requestedRole: params.accountType,
      creatorStatus: isApplyingCreator ? 'pending' : 'none',
      avatarEmoji: isApplyingCreator ? '🎨' : '🌸',
      isSiteOwner: false,
      linkedCreatorId: 'creator-lam-vong',
      createdAt: new Date().toISOString(),
    };

    const existingList = ensureSampleAccounts();
    const filtered = existingList.filter((a) => a.email !== cleanEmail);
    dataStore.set(AUTH_ACCOUNTS_LIST_KEY, [newAccount, ...filtered]);

    const sessionUser: AuthUser = {
      id: newAccount.id,
      email: newAccount.email,
      displayName: newAccount.displayName,
      role: newAccount.role,
      requestedRole: newAccount.requestedRole,
      creatorStatus: newAccount.creatorStatus,
      avatarEmoji: newAccount.avatarEmoji,
      isSiteOwner: false,
      linkedCreatorId: newAccount.linkedCreatorId,
      isDemoNote:
        'Bản thử nghiệm: Chỉ lưu tên hiển thị và vai trò giả lập, không lưu mật khẩu.',
    };

    dataStore.set(AUTH_SESSION_KEY, sessionUser);
    notifyListeners(sessionUser);

    return {
      user: sessionUser,
      message: isApplyingCreator
        ? '✨ Đăng ký thành công! Tài khoản Creator của bạn đang ở trạng thái "Chờ duyệt", trong lúc chờ bạn vẫn dùng được mọi tính năng của Người dùng nhé!'
        : '🌸 Chào mừng bạn gia nhập Góc Nhỏ Lấp Lánh!',
    };
  },

  /**
   * Đăng nhập
   * [CHỖ CẦN NỐI BACKEND THẬT]: Thay bằng `signInWithEmailAndPassword` hoặc `supabase.auth.signInWithPassword`
   */
  async signIn(params: {
    email: string;
    password: string;
  }): Promise<{ user: AuthUser; message: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const existingList = ensureSampleAccounts();
    const found = existingList.find((a) => a.email === cleanEmail);

    const sessionUser: AuthUser = found
      ? {
          id: found.id,
          email: found.email,
          displayName: found.displayName,
          role: found.role,
          requestedRole: found.requestedRole,
          creatorStatus: found.creatorStatus,
          avatarEmoji: found.avatarEmoji,
          isSiteOwner: Boolean(found.isSiteOwner),
          linkedCreatorId: found.linkedCreatorId || 'creator-lam-vong',
          isDemoNote:
            'Bản thử nghiệm: Không lưu mật khẩu trong localStorage.',
        }
      : {
          id: `usr_${Date.now()}`,
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0] || 'Bạn Nhỏ',
          role: 'user',
          requestedRole: 'user',
          creatorStatus: 'none',
          avatarEmoji: '🌸',
          isSiteOwner: false,
          linkedCreatorId: 'creator-lam-vong',
          isDemoNote:
            'Bản thử nghiệm: Không lưu mật khẩu trong localStorage.',
        };

    dataStore.set(AUTH_SESSION_KEY, sessionUser);
    notifyListeners(sessionUser);

    return {
      user: sessionUser,
      message: `✨ Chào mừng ${sessionUser.displayName} đã quay trở lại!`,
    };
  },

  /**
   * Đăng xuất (trở về vai Khách)
   * [CHỖ CẦN NỐI BACKEND THẬT]: Thay bằng `signOut(auth)` hoặc `supabase.auth.signOut()`
   */
  async signOut(): Promise<void> {
    dataStore.set(AUTH_SESSION_KEY, DEFAULT_GUEST_USER);
    notifyListeners(DEFAULT_GUEST_USER);
  },

  /**
   * Gửi yêu cầu đặt lại mật khẩu (Giao diện sẵn sàng nối backend)
   * [CHỖ CẦN NỐI BACKEND THẬT]: Thay bằng `sendPasswordResetEmail(auth, email)` hoặc `supabase.auth.resetPasswordForEmail(email)`
   */
  async requestPasswordReset(email: string): Promise<string> {
    return `💌 Đã ghi nhận yêu cầu khôi phục mật khẩu cho ${email.trim()}. (Khi nối Firebase/Supabase Auth, liên kết đặt lại mật khẩu sẽ được gửi về hộp thư của bạn).`;
  },

  /**
   * Chuyển vai nhanh trong chế độ AUTH_MODE === "demo"
   */
  switchDemoRole(role: UserRole): AuthUser {
    if (role === 'guest') {
      dataStore.set(AUTH_SESSION_KEY, DEFAULT_GUEST_USER);
      notifyListeners(DEFAULT_GUEST_USER);
      return DEFAULT_GUEST_USER;
    }

    const demoUser: AuthUser =
      role === 'creator'
        ? {
            id: 'demo-creator',
            email: 'creator.demo@gocnho.local',
            displayName: 'Lâm Vọng Nguyệt (Chủ web)',
            role: 'creator',
            requestedRole: 'creator',
            creatorStatus: 'approved',
            avatarEmoji: '👑',
            isSiteOwner: true,
            linkedCreatorId: 'creator-lam-vong',
            isDemoNote:
              'Vai trò giả lập Creator (Chủ web - mở được Cài đặt trang & sửa mọi mục)',
          }
        : {
            id: 'demo-user',
            email: 'user.demo@gocnho.local',
            displayName: 'Miên Miên (Người dùng)',
            role: 'user',
            requestedRole: 'user',
            creatorStatus: 'none',
            avatarEmoji: '🌸',
            isSiteOwner: false,
            isDemoNote: 'Vai trò giả lập bản thử (không lưu mật khẩu)',
          };

    dataStore.set(AUTH_SESSION_KEY, demoUser);
    notifyListeners(demoUser);
    return demoUser;
  },

  /**
   * Đổi qua lại giữa "Creator Chủ web" (sửa toàn trang + mở bảng Cài đặt trang)
   * và "Creator thường" (chỉ sửa được char, lệnh, giveaway, commission của chính mình)
   */
  setCreatorOwnerMode(isOwner: boolean, linkedCreatorId = 'creator-lam-vong'): AuthUser {
    const current = this.getCurrentUser();
    if (current.role !== 'creator') return current;

    const updated: AuthUser = {
      ...current,
      isSiteOwner: isOwner,
      linkedCreatorId,
      avatarEmoji: isOwner ? '👑' : '🎨',
      displayName: isOwner
        ? 'Lâm Vọng Nguyệt (Chủ web)'
        : 'Lâm Vọng Nguyệt (Creator thường)',
      isDemoNote: isOwner
        ? 'Chủ web: Mở được Cài đặt trang & chỉnh sửa mọi nội dung.'
        : 'Creator thường: Chỉ chỉnh sửa nội dung của chính mình (Lâm Vọng Nguyệt).',
    };
    dataStore.set(AUTH_SESSION_KEY, updated);
    notifyListeners(updated);
    return updated;
  },

  /**
   * Duyệt tài khoản Creator đang chờ của phiên hiện tại
   */
  approvePendingCreator(): AuthUser {
    const current = this.getCurrentUser();
    const updated: AuthUser = {
      ...current,
      role: 'creator',
      requestedRole: 'creator',
      creatorStatus: 'approved',
      avatarEmoji: '✨',
      isSiteOwner: true,
      linkedCreatorId: current.linkedCreatorId || 'creator-lam-vong',
    };
    dataStore.set(AUTH_SESSION_KEY, updated);

    const existingList = ensureSampleAccounts();
    const nextList = existingList.map((acc) =>
      acc.email === current.email
        ? {
            ...acc,
            role: 'creator' as UserRole,
            creatorStatus: 'approved' as CreatorApprovalStatus,
          }
        : acc
    );
    dataStore.set(AUTH_ACCOUNTS_LIST_KEY, nextList);

    notifyListeners(updated);
    return updated;
  },

  /**
   * Lấy danh sách các tài khoản đăng ký làm Creator (để Chủ web duyệt / từ chối trong bảng Cài đặt trang)
   */
  listCreatorApplications(): StoredSafeAccount[] {
    const all = ensureSampleAccounts();
    return all.filter((acc) => acc.requestedRole === 'creator');
  },

  /**
   * Chủ web duyệt một tài khoản Creator đang chờ theo ID
   */
  approveCreatorById(accountId: string): StoredSafeAccount[] {
    const all = ensureSampleAccounts();
    const next = all.map((acc) =>
      acc.id === accountId
        ? {
            ...acc,
            role: 'creator' as UserRole,
            creatorStatus: 'approved' as CreatorApprovalStatus,
          }
        : acc
    );
    dataStore.set(AUTH_ACCOUNTS_LIST_KEY, next);

    const current = this.getCurrentUser();
    if (current.id === accountId) {
      const updatedCurrent: AuthUser = {
        ...current,
        role: 'creator',
        creatorStatus: 'approved',
      };
      dataStore.set(AUTH_SESSION_KEY, updatedCurrent);
      notifyListeners(updatedCurrent);
    }
    return next.filter((acc) => acc.requestedRole === 'creator');
  },

  /**
   * Chủ web từ chối một tài khoản Creator đang chờ theo ID
   */
  rejectCreatorById(accountId: string): StoredSafeAccount[] {
    const all = ensureSampleAccounts();
    const next = all.map((acc) =>
      acc.id === accountId
        ? {
            ...acc,
            role: 'user' as UserRole,
            creatorStatus: 'rejected' as CreatorApprovalStatus,
          }
        : acc
    );
    dataStore.set(AUTH_ACCOUNTS_LIST_KEY, next);

    const current = this.getCurrentUser();
    if (current.id === accountId) {
      const updatedCurrent: AuthUser = {
        ...current,
        role: 'user',
        creatorStatus: 'rejected',
      };
      dataStore.set(AUTH_SESSION_KEY, updatedCurrent);
      notifyListeners(updatedCurrent);
    }
    return next.filter((acc) => acc.requestedRole === 'creator');
  },

  /**
   * Tạo thêm một hồ sơ đăng ký Creator mẫu đang chờ duyệt để Chủ web thử nghiệm
   */
  addSamplePendingCreator(name?: string, email?: string): StoredSafeAccount[] {
    const all = ensureSampleAccounts();
    const cleanName = name?.trim() || `Tác giả Mới #${all.length + 1}`;
    const cleanEmail =
      email?.trim().toLowerCase() || `creator${Date.now().toString().slice(-4)}@gocnho.local`;
    const newAcc: StoredSafeAccount = {
      id: `usr_pending_${Date.now()}`,
      email: cleanEmail,
      displayName: cleanName,
      role: 'user',
      requestedRole: 'creator',
      creatorStatus: 'pending',
      avatarEmoji: '🌸',
      linkedCreatorId: 'creator-lam-vong',
      createdAt: new Date().toISOString(),
    };
    const next = [newAcc, ...all];
    dataStore.set(AUTH_ACCOUNTS_LIST_KEY, next);
    return next.filter((acc) => acc.requestedRole === 'creator');
  },
};
