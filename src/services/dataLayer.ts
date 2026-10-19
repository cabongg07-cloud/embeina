/**
 * Data Layer trừu tượng cho "Góc Nhỏ Lấp Lánh".
 * Cung cấp các phương thức get / set / list / setList / add / update / remove / moveItem
 * kèm hệ thống Hoàn tác (Undo), Khôi phục mặc định (Reset) và Xuất/Nhập JSON.
 *
 * GHI CHÚ QUAN TRỌNG:
 * Hiện tại mọi chỉnh sửa chỉ lưu cục bộ trên trình duyệt của người sửa (localStorage bọc try/catch).
 * Khi nối backend thật (Firebase Firestore hoặc Supabase), bạn chỉ cần thay thế các phương thức
 * trong `dataStore` bên dưới mà không cần sửa giao diện.
 */

export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface UndoSnapshot {
  id: string;
  label: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const STORAGE_PREFIX = 'thu_vien_dem:';
const UNDO_STACK_KEY = 'edit_undo_stack_v1';
const MAX_UNDO_STEPS = 18;

type DataChangeListener = () => void;
const changeListeners = new Set<DataChangeListener>();

function getFullKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function notifyDataChange() {
  changeListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Bỏ qua lỗi listener
    }
  });
}

export const dataStore = {
  /**
   * Đăng ký lắng nghe khi dữ liệu thay đổi (Hoàn tác, Nhập JSON, Khôi phục mặc định...)
   */
  onChange(listener: DataChangeListener): () => void {
    changeListeners.add(listener);
    return () => {
      changeListeners.delete(listener);
    };
  },

  /**
   * Thông báo thủ công cho toàn bộ ứng dụng biết dữ liệu vừa cập nhật
   */
  emitChange(): void {
    notifyDataChange();
  },

  /**
   * Lấy một giá trị đơn lẻ theo key (bọc try/catch an toàn)
   */
  get<T>(key: string, fallback: T): T {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return fallback;
      }
      const raw = window.localStorage.getItem(getFullKey(key));
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  /**
   * Lưu một giá trị đơn lẻ theo key (bọc try/catch an toàn)
   * GHI CHÚ: Hiện tại chỉnh sửa chỉ lưu trên trình duyệt của người sửa.
   */
  set<T>(key: string, value: T, silent = false): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      window.localStorage.setItem(getFullKey(key), JSON.stringify(value));
      if (!silent) {
        notifyDataChange();
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Lấy danh sách bản ghi từ một collection
   */
  list<T extends BaseEntity>(collection: string): T[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return [];
      }
      const raw = window.localStorage.getItem(getFullKey(`col_${collection}`));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  },

  /**
   * Ghi đè toàn bộ danh sách của một collection
   */
  setList<T extends BaseEntity>(collection: string, items: T[]): boolean {
    return this.set(`col_${collection}`, items);
  },

  /**
   * Chụp lại trạng thái dữ liệu hiện tại vào ngăn xếp Hoàn tác (Undo) trước khi chỉnh sửa
   */
  pushUndoSnapshot(label = 'Chỉnh sửa'): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const currentDump = this.exportAll();
      const dataObj =
        currentDump.data && typeof currentDump.data === 'object'
          ? { ...(currentDump.data as Record<string, unknown>) }
          : {};
      delete dataObj[UNDO_STACK_KEY];
      delete dataObj['auth_current_session_v1'];

      const stack = this.get<UndoSnapshot[]>(UNDO_STACK_KEY, []);
      const snapshot: UndoSnapshot = {
        id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        timestamp: Date.now(),
        data: dataObj,
      };
      const nextStack = [snapshot, ...stack].slice(0, MAX_UNDO_STEPS);
      this.set(UNDO_STACK_KEY, nextStack, true);
    } catch {
      // Bỏ qua nếu bộ nhớ đầy
    }
  },

  /**
   * Kiểm tra số bước có thể Hoàn tác
   */
  getUndoCount(): number {
    return this.get<UndoSnapshot[]>(UNDO_STACK_KEY, []).length;
  },

  /**
   * Lấy nhãn của bước hoàn tác gần nhất
   */
  getLastUndoLabel(): string | null {
    const stack = this.get<UndoSnapshot[]>(UNDO_STACK_KEY, []);
    return stack[0]?.label || null;
  },

  /**
   * Thực hiện Hoàn tác (khôi phục bản chụp gần nhất)
   */
  undo(): UndoSnapshot | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const stack = this.get<UndoSnapshot[]>(UNDO_STACK_KEY, []);
      if (stack.length === 0) return null;

      const [latest, ...rest] = stack;
      const authSession = this.get<unknown>('auth_current_session_v1', null);

      // Xóa các khóa dữ liệu hiện hành (trừ phiên đăng nhập và undo stack)
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const fullKey = window.localStorage.key(i);
        if (fullKey && fullKey.startsWith(STORAGE_PREFIX)) {
          const shortKey = fullKey.slice(STORAGE_PREFIX.length);
          if (
            shortKey !== UNDO_STACK_KEY &&
            shortKey !== 'auth_current_session_v1'
          ) {
            keysToRemove.push(fullKey);
          }
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));

      // Ghi lại dữ liệu từ snapshot
      Object.entries(latest.data).forEach(([shortKey, val]) => {
        if (
          shortKey === '_meta' ||
          shortKey === UNDO_STACK_KEY ||
          shortKey === 'auth_current_session_v1'
        ) {
          return;
        }
        window.localStorage.setItem(getFullKey(shortKey), JSON.stringify(val));
      });

      if (authSession) {
        this.set('auth_current_session_v1', authSession, true);
      }
      this.set(UNDO_STACK_KEY, rest, true);
      notifyDataChange();
      return latest;
    } catch {
      return null;
    }
  },

  /**
   * Thêm một bản ghi mới vào collection
   */
  add<T extends BaseEntity>(
    collection: string,
    item: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    recordUndo = true
  ): T | null {
    try {
      if (recordUndo) {
        this.pushUndoSnapshot(`Thêm mục vào ${collection}`);
      }
      const items = this.list<T>(collection);
      const now = new Date().toISOString();
      const newItem = {
        ...item,
        id:
          item.id ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        createdAt: now,
        updatedAt: now,
      } as T;

      items.unshift(newItem);
      this.set(`col_${collection}`, items);
      return newItem;
    } catch {
      return null;
    }
  },

  /**
   * Cập nhật một bản ghi theo id trong collection
   */
  update<T extends BaseEntity>(
    collection: string,
    id: string,
    patch: Partial<T>,
    recordUndo = true
  ): T | null {
    try {
      if (recordUndo) {
        this.pushUndoSnapshot(`Sửa mục trong ${collection}`);
      }
      const items = this.list<T>(collection);
      const index = items.findIndex((entry) => entry.id === id);
      if (index === -1) return null;

      const updated: T = {
        ...items[index],
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      };
      items[index] = updated;
      this.set(`col_${collection}`, items);
      return updated;
    } catch {
      return null;
    }
  },

  /**
   * Đổi thứ tự (Sắp xếp ↕️) một bản ghi lên hoặc xuống trong collection
   */
  moveItem<T extends BaseEntity>(
    collection: string,
    id: string,
    direction: 'up' | 'down'
  ): T[] {
    try {
      const items = this.list<T>(collection);
      const index = items.findIndex((entry) => entry.id === id);
      if (index === -1) return items;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return items;

      this.pushUndoSnapshot(`Sắp xếp lại ${collection}`);
      const next = [...items];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      this.set(`col_${collection}`, next);
      return next;
    } catch {
      return this.list<T>(collection);
    }
  },

  /**
   * Xóa một bản ghi theo id khỏi collection hoặc xóa một key đơn lẻ
   */
  remove(collectionOrKey: string, id?: string, recordUndo = true): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      if (recordUndo) {
        this.pushUndoSnapshot(`Xóa mục khỏi ${collectionOrKey}`);
      }
      if (id !== undefined) {
        const items = this.list<BaseEntity>(collectionOrKey);
        const filtered = items.filter((entry) => entry.id !== id);
        return this.set(`col_${collectionOrKey}`, filtered);
      } else {
        window.localStorage.removeItem(getFullKey(collectionOrKey));
        notifyDataChange();
        return true;
      }
    } catch {
      return false;
    }
  },

  /**
   * Khôi phục toàn bộ trang web về trạng thái mặc định ban đầu (giữ lại phiên đăng nhập hiện tại)
   */
  resetAllToDefaults(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      this.pushUndoSnapshot('Khôi phục mặc định');
      const undoStack = this.get<UndoSnapshot[]>(UNDO_STACK_KEY, []);
      const authSession = this.get<unknown>('auth_current_session_v1', null);
      const guideSeen = this.get<boolean>('edit_guide_seen_v1', false);

      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const fullKey = window.localStorage.key(i);
        if (fullKey && fullKey.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(fullKey);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));

      if (authSession) {
        this.set('auth_current_session_v1', authSession, true);
      }
      if (guideSeen) {
        this.set('edit_guide_seen_v1', true, true);
      }
      this.set(UNDO_STACK_KEY, undoStack, true);
      notifyDataChange();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Xuất toàn bộ dữ liệu & cấu hình của Góc Nhỏ Lấp Lánh ra object JSON
   */
  exportAll(): Record<string, unknown> {
    const dump: Record<string, unknown> = {
      _meta: {
        app: 'Góc Nhỏ Lấp Lánh',
        exportedAt: new Date().toISOString(),
        version: 3,
        note: 'File cấu hình và dữ liệu sổ tay Góc Nhỏ Lấp Lánh',
      },
      data: {},
    };
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return dump;
      }
      const dataObj: Record<string, unknown> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const fullKey = window.localStorage.key(i);
        if (fullKey && fullKey.startsWith(STORAGE_PREFIX)) {
          const shortKey = fullKey.slice(STORAGE_PREFIX.length);
          if (shortKey === UNDO_STACK_KEY) continue;
          const rawVal = window.localStorage.getItem(fullKey);
          if (rawVal !== null) {
            try {
              dataObj[shortKey] = JSON.parse(rawVal);
            } catch {
              dataObj[shortKey] = rawVal;
            }
          }
        }
      }
      dump.data = dataObj;
      return dump;
    } catch {
      return dump;
    }
  },

  /**
   * Nhập toàn bộ dữ liệu & cấu hình từ file JSON đã xuất
   */
  importAll(payload: unknown): boolean {
    try {
      if (
        typeof window === 'undefined' ||
        !window.localStorage ||
        !payload ||
        typeof payload !== 'object'
      ) {
        return false;
      }
      this.pushUndoSnapshot('Nhập file cấu hình JSON');
      const record = payload as Record<string, unknown>;
      const source =
        record.data && typeof record.data === 'object'
          ? (record.data as Record<string, unknown>)
          : record;

      Object.entries(source).forEach(([shortKey, val]) => {
        if (shortKey === '_meta' || shortKey === UNDO_STACK_KEY) return;
        window.localStorage.setItem(
          getFullKey(shortKey),
          JSON.stringify(val)
        );
      });
      notifyDataChange();
      return true;
    } catch {
      return false;
    }
  },
};
