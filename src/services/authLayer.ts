/**
 * Lớp xác thực (Auth Layer) & Phân quyền trung tâm (RBAC) nối trực tiếp với SUPABASE THẬT.
 *
 * GHI CHÚ BẢO MẬT:
 * - Đã xóa hoàn toàn chế độ demo, thanh "Thử vai" và các tài khoản giả lập.
 * - Chỉ còn Khách (chưa đăng nhập) và Người dùng đã đăng nhập qua Supabase Auth.
 * - Vai trò ('user' | 'creator' | 'owner') CHỈ lấy từ bảng `profiles.role` trên Supabase,
 *   tuyệt đối không có nút tự nâng quyền ở client và không có đường tắt trên URL.
 * - Ẩn/hiện giao diện ở client chỉ để gọn gàng; bảo mật thực sự nằm ở Row Level Security (RLS) trên Supabase.
 */

import { supabase } from '../config/supabaseConfig';
import { UserRole } from '../data/sampleData';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type DbProfileRole = 'user' | 'creator' | 'owner';

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  role: UserRole; // 'guest' | 'user' | 'creator' (trong đó 'creator' đại diện cho cả creator & owner trên UI)
  profileRole: 'guest' | DbProfileRole; // Giá trị gốc từ bảng profiles.role
  avatarEmoji: string;
  isSiteOwner?: boolean; // true khi profiles.role === 'owner'
  linkedCreatorId?: string; // chính là user.id của tài khoản trên Supabase
}

export interface PublicProfileRow {
  id: string;
  display_name: string | null;
  role: DbProfileRole | string | null;
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
  'view_creator_tabs',
  'manage_feedback',
  'manage_own_chars',
  'manage_commission_board',
  'publish_shared_prompt',
  'manage_requests_inbox',
  'create_giveaway',
  'draw_giveaway_winner',
  'manage_rescue_status',
];

const OWNER_ACTIONS: PermissionAction[] = [
  ...CREATOR_ACTIONS,
  'edit',
  'site_settings',
  'creator_edit_mode',
  'approve_creator_requests',
];

export const DEFAULT_GUEST_USER: AuthUser = {
  id: 'guest-visitor',
  email: '',
  username: '',
  displayName: 'Khách ghé thăm',
  role: 'guest',
  profileRole: 'guest',
  avatarEmoji: '🌱',
  isSiteOwner: false,
};

let currentUserState: AuthUser = DEFAULT_GUEST_USER;

/**
 * Hàm kiểm tra quyền trung tâm `can(action, user?)` dùng trên toàn bộ ứng dụng.
 * GHI CHÚ BẢO MẬT: Ẩn giao diện chỉ cho gọn, bảo mật thật nằm ở RLS trên Supabase.
 * - Chỉ vai 'owner' mới có quyền 'edit' và 'site_settings' (Nút ✏️ Chỉnh sửa và Cài đặt trang).
 */
export function can(
  action: PermissionAction,
  user?: AuthUser | null
): boolean {
  const resolvedUser = user !== undefined ? user : currentUserState;
  if (!resolvedUser || resolvedUser.profileRole === 'guest') {
    return false;
  }

  if (resolvedUser.profileRole === 'user') {
    return USER_ACTIONS.includes(action);
  }

  if (resolvedUser.profileRole === 'creator') {
    return CREATOR_ACTIONS.includes(action);
  }

  if (resolvedUser.profileRole === 'owner') {
    return OWNER_ACTIONS.includes(action);
  }

  return false;
}

/**
 * Kiểm tra xem người dùng hiện tại có được phép sửa/xóa một mục nội dung cụ thể không.
 * GHI CHÚ BẢO MẬT: Ẩn giao diện chỉ cho gọn, bảo mật thật nằm ở RLS trên Supabase.
 */
export function canEditItem(
  user: AuthUser | null | undefined,
  ownerCreatorId?: string | null,
  editMode = true
): boolean {
  if (!user || user.profileRole === 'guest') {
    return false;
  }
  if (user.profileRole === 'owner' || user.isSiteOwner) {
    return editMode ? true : can('manage_own_chars', user);
  }
  if (!can('manage_own_chars', user)) {
    return false;
  }
  if (!ownerCreatorId) {
    return false;
  }
  return (
    ownerCreatorId === user.id ||
    ownerCreatorId === user.linkedCreatorId
  );
}

type AuthChangeListener = (user: AuthUser) => void;
const listeners = new Set<AuthChangeListener>();

function notifyListeners(user: AuthUser) {
  currentUserState = user;
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch {
      // Ignore listener error
    }
  });
}

async function buildAuthUserFromSession(
  sbUser: SupabaseUser | null
): Promise<AuthUser> {
  if (!sbUser) {
    return DEFAULT_GUEST_USER;
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, role')
      .eq('id', sbUser.id)
      .maybeSingle();

    const rawRole = String(profile?.role || 'user').toLowerCase();
    const profileRole: DbProfileRole =
      rawRole === 'owner'
        ? 'owner'
        : rawRole === 'creator'
        ? 'creator'
        : 'user';

    const uiRole: UserRole =
      profileRole === 'creator' || profileRole === 'owner'
        ? 'creator'
        : 'user';

    const username =
      profile?.username ||
      (sbUser.user_metadata?.username as string | undefined) ||
      '';
    const displayName =
      profile?.display_name ||
      username ||
      (sbUser.user_metadata?.display_name as string | undefined) ||
      sbUser.email?.split('@')[0] ||
      'Bạn Nhỏ';

    return {
      id: sbUser.id,
      email: sbUser.email || '',
      username,
      displayName,
      role: uiRole,
      profileRole,
      avatarEmoji:
        profileRole === 'owner'
          ? '👑'
          : profileRole === 'creator'
          ? '🎨'
          : '🌸',
      isSiteOwner: profileRole === 'owner',
      linkedCreatorId: sbUser.id,
    };
  } catch {
    const fallbackName =
      (sbUser.user_metadata?.display_name as string | undefined) ||
      (sbUser.user_metadata?.username as string | undefined) ||
      sbUser.email?.split('@')[0] ||
      'Bạn Nhỏ';
    return {
      id: sbUser.id,
      email: sbUser.email || '',
      username: (sbUser.user_metadata?.username as string | undefined) || '',
      displayName: fallbackName,
      role: 'user',
      profileRole: 'user',
      avatarEmoji: '🌸',
      isSiteOwner: false,
      linkedCreatorId: sbUser.id,
    };
  }
}

// Khởi tạo lắng nghe phiên đăng nhập từ Supabase Auth
let authInitialized = false;
function initSupabaseAuthListener() {
  if (authInitialized) return;
  authInitialized = true;

  supabase.auth
    .getSession()
    .then(async ({ data }) => {
      const user = await buildAuthUserFromSession(data.session?.user ?? null);
      notifyListeners(user);
    })
    .catch(() => {
      notifyListeners(DEFAULT_GUEST_USER);
    });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = await buildAuthUserFromSession(session?.user ?? null);
    notifyListeners(user);
  });
}

export const authService = {
  getCurrentUser(): AuthUser {
    initSupabaseAuthListener();
    return currentUserState;
  },

  async refreshProfile(): Promise<AuthUser> {
    try {
      const { data } = await supabase.auth.getSession();
      const user = await buildAuthUserFromSession(data.session?.user ?? null);
      notifyListeners(user);
      return user;
    } catch {
      return currentUserState;
    }
  },

  onAuthChange(callback: AuthChangeListener): () => void {
    initSupabaseAuthListener();
    listeners.add(callback);
    callback(currentUserState);
    return () => {
      listeners.delete(callback);
    };
  },

  /**
   * Kiểm tra tên tài khoản (username) có hợp lệ và còn trống không bằng RPC `username_available(p_username)`
   */
  async checkUsernameAvailable(username: string): Promise<{
    valid: boolean;
    available: boolean;
    reason?: string;
  }> {
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(clean)) {
      return {
        valid: false,
        available: false,
        reason:
          'Tên tài khoản cần từ 3–20 ký tự, chỉ gồm chữ thường a-z, số 0-9, dấu gạch dưới (_) hoặc dấu chấm (.).',
      };
    }

    try {
      const { data, error } = await supabase.rpc('username_available', {
        p_username: clean,
      });
      if (error) {
        return {
          valid: true,
          available: false,
          reason: 'Chưa kiểm tra được tên tài khoản lúc này, bạn thử lại nhé.',
        };
      }
      const isAvail = Boolean(data);
      return {
        valid: true,
        available: isAvail,
        reason: isAvail
          ? '✨ Tên tài khoản này còn trống, bạn có thể dùng nhé!'
          : '🌸 Tên tài khoản này đã có người dùng rồi, bạn chọn tên khác nhé.',
      };
    } catch {
      return {
        valid: true,
        available: false,
        reason: 'Không thể kết nối máy chủ để kiểm tra tên tài khoản.',
      };
    }
  },

  /**
   * Đăng ký tài khoản mới trên Supabase Auth:
   * - Gmail bắt buộc kết thúc bằng @gmail.com
   * - Tên tài khoản: 3-20 ký tự a-z 0-9 _ . (kiểm tra bằng RPC username_available)
   * - Mật khẩu >= 8 ký tự
   * - Gọi supabase.auth.signUp với options.data { username, display_name: username }
   */
  async signUp(params: {
    email: string;
    username: string;
    password: string;
  }): Promise<{ user: AuthUser; message: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanUsername = params.username.trim().toLowerCase();
    const password = params.password;

    if (!cleanEmail.endsWith('@gmail.com') || cleanEmail.length <= 10) {
      throw new Error('Vui lòng sử dụng địa chỉ Gmail hợp lệ (có đuôi @gmail.com) nhé 🌸');
    }

    if (!/^[a-z0-9_.]{3,20}$/.test(cleanUsername)) {
      throw new Error(
        'Tên tài khoản phải từ 3–20 ký tự và chỉ gồm chữ cái thường (a-z), chữ số (0-9), dấu _ hoặc dấu . nhé 🌸'
      );
    }

    if (password.length < 8) {
      throw new Error('Mật khẩu cần có tối thiểu 8 ký tự nhé 🔒');
    }

    // Kiểm tra tên tài khoản qua RPC trước khi đăng ký
    const availCheck = await this.checkUsernameAvailable(cleanUsername);
    if (!availCheck.available) {
      throw new Error(
        availCheck.reason || 'Tên tài khoản này đã có người sử dụng rồi nhé 🌸'
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: cleanUsername,
          display_name: cleanUsername,
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        throw new Error('Gmail này đã được đăng ký rồi, bạn hãy chuyển sang Đăng nhập nhé 🌸');
      }
      throw new Error('Không thể hoàn tất đăng ký lúc này, bạn kiểm tra lại thông tin nhé 🌸');
    }

    if (data.session?.user) {
      const authUser = await buildAuthUserFromSession(data.session.user);
      notifyListeners(authUser);
      return {
        user: authUser,
        message: `🌸 Chào mừng ${authUser.displayName} gia nhập Góc Nhỏ Lấp Lánh!`,
      };
    }

    // Trường hợp Supabase yêu cầu xác nhận email hoặc chưa tạo session ngay
    return {
      user: currentUserState,
      message:
        '💌 Đăng ký thành công! Bạn hãy kiểm tra hộp thư Gmail để xác nhận tài khoản rồi đăng nhập nhé ✨',
    };
  },

  /**
   * Đăng nhập:
   * - Ô "Tên tài khoản" + mật khẩu:
   *   + Nếu không có "@": gọi RPC `email_for_username(p_username)` rồi `signInWithPassword`
   *   + Nếu có "@": coi là email và đăng nhập thẳng
   * - Nếu sai ở bất kỳ bước nào thì chỉ báo chung: "Tên tài khoản hoặc mật khẩu chưa đúng nhé"
   */
  async signIn(params: {
    identifier: string;
    password: string;
  }): Promise<{ user: AuthUser; message: string }> {
    const rawId = params.identifier.trim();
    const password = params.password;
    const GENERIC_ERR = 'Tên tài khoản hoặc mật khẩu chưa đúng nhé';

    if (!rawId || !password) {
      throw new Error(GENERIC_ERR);
    }

    let targetEmail = rawId.toLowerCase();

    if (!rawId.includes('@')) {
      const cleanUsername = rawId.toLowerCase();
      const { data: resolvedEmail, error: rpcErr } = await supabase.rpc(
        'email_for_username',
        { p_username: cleanUsername }
      );

      if (rpcErr || !resolvedEmail || typeof resolvedEmail !== 'string') {
        throw new Error(GENERIC_ERR);
      }
      targetEmail = resolvedEmail.trim().toLowerCase();
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (error || !data.user) {
      throw new Error(GENERIC_ERR);
    }

    const authUser = await buildAuthUserFromSession(data.user);
    notifyListeners(authUser);

    return {
      user: authUser,
      message: `✨ Chào mừng ${authUser.displayName} đã quay trở lại!`,
    };
  },

  /**
   * Đăng xuất khỏi Supabase Auth
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    notifyListeners(DEFAULT_GUEST_USER);
  },

  /**
   * Quên mật khẩu: gọi `supabase.auth.resetPasswordForEmail`
   */
  async requestPasswordReset(emailOrUsername: string): Promise<string> {
    let targetEmail = emailOrUsername.trim().toLowerCase();

    if (!targetEmail.includes('@')) {
      const { data: resolvedEmail } = await supabase.rpc('email_for_username', {
        p_username: targetEmail,
      });
      if (resolvedEmail && typeof resolvedEmail === 'string') {
        targetEmail = resolvedEmail.trim().toLowerCase();
      } else {
        throw new Error('Vui lòng nhập đúng địa chỉ Gmail hoặc Tên tài khoản đã đăng ký nhé 🌸');
      }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    if (error) {
      throw new Error('Chưa thể gửi email khôi phục lúc này, bạn vui lòng thử lại sau ít phút nhé 🌸');
    }

    return `💌 Đã gửi hướng dẫn đặt lại mật khẩu về hộp thư Gmail của bạn. Bạn nhớ kiểm tra cả mục Thư rác (Spam) nhé!`;
  },

  /**
   * Cấp quyền vai trò cho tài khoản bằng RPC `set_role(p_username, p_role)` (Chỉ Owner mới gọi được qua RLS/RPC)
   */
  async setUserRoleByRpc(
    username: string,
    role: DbProfileRole
  ): Promise<string> {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      throw new Error('Vui lòng nhập tên tài khoản (username) cần phân quyền.');
    }
    const { error } = await supabase.rpc('set_role', {
      p_username: cleanUsername,
      p_role: role,
    });
    if (error) {
      throw new Error(
        error.message || 'Không thể đổi vai trò (chỉ Owner mới có quyền thực hiện thao tác này).'
      );
    }
    await this.refreshProfile();
    return `✨ Đã cập nhật vai trò của @${cleanUsername} thành "${role}" trên Supabase!`;
  },
};
