/**
 * Dịch vụ dữ liệu Supabase thật cho "Góc Nhỏ Lấp Lánh".
 * Kết nối trực tiếp tới các bảng & view & RPC đã có sẵn trên Supabase:
 * - Bảng: profiles, chars, char_secrets, inventory, unlocks, daily_rolls, commissions, requests, command_vault, feedback
 * - View: public_profiles (id, display_name, role)
 * - Hàm RPC: roll_gacha(), unlock_char(p_char_id), username_available(p_username), email_for_username(p_username), set_role(p_username, p_role)
 */

import { supabase } from '../config/supabaseConfig';
import {
  CharacterItem,
  Creator,
  CreatorCommissionInfo,
  CommissionOrder,
  CharacterRequest,
  SharedPrompt,
  PersonalPrompt,
  FeedbackItem,
  FeedbackTargetType,
} from '../data/sampleData';
import {
  CharacterUnlockRequirement,
  GeneratedGameItem,
  ItemCategory,
  ItemRarity,
  ItemVisualSeed,
} from './itemSystem';

export interface SupabaseRequirementJson {
  kind: ItemCategory;
  count: number;
  name: string | null;
}

export interface SupabaseCharRow {
  id: string;
  creator_id: string;
  name: string;
  image_url: string | null;
  tags: string[] | null;
  description: string | null;
  locked: boolean | null;
  requirements: SupabaseRequirementJson[] | unknown;
  created_at: string;
}

export interface SupabaseCharSecretRow {
  char_id: string;
  chat_link: string | null;
  open_scene: string | null;
}

export interface SupabaseInventoryRow {
  id: string;
  user_id: string;
  kind: string;
  name: string;
  rarity: string | null;
  ready_at: string | null;
  created_at: string;
  count: number | null;
}

export interface SupabasePublicProfileRow {
  id: string;
  display_name: string | null;
  role: string | null;
}

const AVATAR_TINTS = [
  '#f4a3b0',
  '#8fcfbf',
  '#b8a6e0',
  '#f2cf7a',
  '#9cc7ee',
];

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Tạo visual seed ổn định từ tên & id vật phẩm trên Supabase để hiển thị SVG đa dạng
 */
export function buildVisualFromSupabaseItem(
  id: string,
  name: string,
  kind: ItemCategory,
  rarity: ItemRarity
): ItemVisualSeed {
  const seed = hashCode(`${id}_${name}_${kind}`);
  const palettes = [
    ['#f4a3b0', '#fde2e6', '#e07a8c'],
    ['#8fcfbf', '#dcf5ee', '#5ca896'],
    ['#b8a6e0', '#ebe4fa', '#8e77c4'],
    ['#f2cf7a', '#fbf0d1', '#d9ab43'],
    ['#9cc7ee', '#e1f0fc', '#6aa3d9'],
    ['#f7b299', '#fde8df', '#d98266'],
  ];
  const pal = palettes[seed % palettes.length];
  return {
    primaryColor: pal[0],
    secondaryColor: pal[1],
    accentColor: pal[2],
    shapeVariant: seed % 6,
    patternVariant: (seed >> 3) % 5,
    petalOrFinCount: 5 + (seed % 6),
    hasSparkle: rarity !== 'common',
  };
}

/**
 * Chuyển đổi requirements JSON trên Supabase (`[{"kind":"fish|flower|drink|pet","count":2,"name":null}]`)
 * sang định dạng `CharacterUnlockRequirement[]` trên giao diện.
 */
export function parseSupabaseRequirements(
  raw: unknown
): CharacterUnlockRequirement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const rawKind = String(obj.kind || obj.category || 'flower').toLowerCase();
      const category: ItemCategory =
        rawKind === 'fish' ||
        rawKind === 'flower' ||
        rawKind === 'drink' ||
        rawKind === 'pet'
          ? rawKind
          : 'flower';
      const count = Math.max(1, Number(obj.count) || 1);
      const specificItemName =
        typeof obj.name === 'string' && obj.name.trim()
          ? obj.name.trim()
          : typeof obj.specificItemName === 'string' &&
            obj.specificItemName.trim()
          ? obj.specificItemName.trim()
          : undefined;
      return {
        id: `req_${idx}_${category}`,
        category,
        count,
        specificItemName,
      };
    })
    .filter(Boolean) as CharacterUnlockRequirement[];
}

/**
 * Chuyển đổi `CharacterUnlockRequirement[]` từ form về đúng chuẩn JSON của cột `chars.requirements`:
 * `[{"kind":"fish|flower|drink|pet","count":2,"name":null}]`
 */
export function toSupabaseRequirementsJson(
  reqs?: CharacterUnlockRequirement[]
): SupabaseRequirementJson[] {
  if (!reqs || !Array.isArray(reqs)) return [];
  return reqs.map((r) => ({
    kind: r.category,
    count: Math.max(1, Number(r.count) || 1),
    name: r.specificItemName?.trim() ? r.specificItemName.trim() : null,
  }));
}

/**
 * 1. Đọc danh sách Char từ bảng `chars` và tên Creator từ view `public_profiles`.
 * LƯU Ý BẢO MẬT:
 * - Tuyệt đối KHÔNG đọc `char_secrets` ở đây và KHÔNG lưu `chat_link` hay `open_scene` vào state toàn cục.
 */
export async function fetchCharsAndCreatorsFromSupabase(): Promise<{
  characters: CharacterItem[];
  creators: Creator[];
}> {
  const [charsRes, profilesRes] = await Promise.all([
    supabase
      .from('chars')
      .select(
        'id, creator_id, name, image_url, tags, description, locked, requirements, created_at'
      )
      .order('created_at', { ascending: false }),
    supabase.from('public_profiles').select('id, display_name, role'),
  ]);

  const profileRows: SupabasePublicProfileRow[] = Array.isArray(profilesRes.data)
    ? (profilesRes.data as SupabasePublicProfileRow[])
    : [];

  const profileMap = new Map<string, SupabasePublicProfileRow>();
  profileRows.forEach((p) => {
    profileMap.set(p.id, p);
  });

  const charRows: SupabaseCharRow[] = Array.isArray(charsRes.data)
    ? (charsRes.data as SupabaseCharRow[])
    : [];

  // Tổng hợp danh sách Creator từ public_profiles (những người có role creator/owner hoặc có char)
  const creatorIdsSet = new Set<string>();
  profileRows.forEach((p) => {
    if (p.role === 'creator' || p.role === 'owner') {
      creatorIdsSet.add(p.id);
    }
  });
  charRows.forEach((c) => {
    if (c.creator_id) creatorIdsSet.add(c.creator_id);
  });

  const creators: Creator[] = Array.from(creatorIdsSet).map((cid, idx) => {
    const prof = profileMap.get(cid);
    const displayName = prof?.display_name || 'Chủ web';
    const charListForCreator = charRows.filter((c) => c.creator_id === cid);
    const collectedTags = Array.from(
      new Set(charListForCreator.flatMap((c) => c.tags || []))
    ).slice(0, 5);

    return {
      id: cid,
      name: displayName,
      handle: `@${displayName.toLowerCase().replace(/\s+/g, '_')}`,
      avatarSymbol: displayName.slice(0, 2).toUpperCase(),
      avatarTint: AVATAR_TINTS[idx % AVATAR_TINTS.length],
      bio:
        prof?.role === 'owner'
          ? 'Chủ sổ tay Góc Nhỏ Lấp Lánh ✨'
          : 'Tác giả sáng tạo nhân vật tại Góc Nhỏ Lấp Lánh 🌸',
      longBio:
        prof?.role === 'owner'
          ? 'Người chăm sóc và lưu giữ các câu chuyện nhỏ tại Góc Nhỏ Lấp Lánh.'
          : 'Tác giả sáng tạo nhân vật AI với những cốt truyện ấm áp và giàu cảm xúc.',
      tags: collectedTags.length > 0 ? collectedTags : ['Đời thường', 'Chữa lành'],
      socials: [],
    };
  });

  const characters: CharacterItem[] = charRows.map((row, idx) => {
    const creatorProf = profileMap.get(row.creator_id);
    const creatorName = creatorProf?.display_name || 'Chủ web';
    const reqs = parseSupabaseRequirements(row.requirements);
    const isLocked = Boolean(row.locked);

    return {
      id: row.id,
      name: row.name || 'Nhân vật mới',
      creatorId: row.creator_id,
      creatorName,
      avatarSymbol: (row.name || 'NV').slice(0, 2).toUpperCase(),
      avatarTint: AVATAR_TINTS[idx % AVATAR_TINTS.length],
      imageUrl: row.image_url || undefined,
      epithet: isLocked ? 'Nhân vật khóa vật phẩm' : 'Bạn đồng hành dịu dàng',
      tags: Array.isArray(row.tags) && row.tags.length > 0 ? row.tags : ['Đời thường'],
      description: row.description || '',
      // TUYỆT ĐỐI KHÔNG lưu open_scene và chat_link vào state toàn cục!
      openingLine: '',
      openScene: undefined,
      chatUrl: '',
      featured: idx < 4,
      isLocked,
      unlockPrice: 20,
      unlockRequirements: reqs,
    };
  });

  return { characters, creators };
}

/**
 * 2. Đọc `chat_link` và `open_scene` từ bảng `char_secrets` CHỈ KHI người dùng bấm vào char.
 * Nếu rỗng (null) hoặc lỗi phân quyền RLS, trả về null để hiện bảng yêu cầu mở khóa.
 */
export async function fetchCharSecretOnDemand(
  charId: string
): Promise<{ chatLink: string; openScene: string } | null> {
  try {
    const { data, error } = await supabase
      .from('char_secrets')
      .select('char_id, chat_link, open_scene')
      .eq('char_id', charId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as SupabaseCharSecretRow;
    if (!row.chat_link && !row.open_scene) {
      return null;
    }

    return {
      chatLink: row.chat_link || '',
      openScene: row.open_scene || '',
    };
  } catch {
    return null;
  }
}

/**
 * 3. Thêm nhân vật mới (Chỉ Creator/Owner):
 * Ghi vào bảng `chars` và `char_secrets`.
 */
export async function createCharOnSupabase(params: {
  creatorId: string;
  name: string;
  imageUrl?: string;
  tags: string[];
  description: string;
  locked: boolean;
  requirements: CharacterUnlockRequirement[];
  chatLink: string;
  openScene: string;
}): Promise<SupabaseCharRow> {
  const reqJson = params.locked
    ? toSupabaseRequirementsJson(params.requirements)
    : [];

  const { data: insertedChar, error: charErr } = await supabase
    .from('chars')
    .insert({
      creator_id: params.creatorId,
      name: params.name.trim(),
      image_url: params.imageUrl?.trim() || null,
      tags: params.tags.length > 0 ? params.tags : ['Đời thường'],
      description: params.description.trim(),
      locked: params.locked,
      requirements: reqJson,
    })
    .select('*')
    .single();

  if (charErr || !insertedChar) {
    throw new Error(
      charErr?.message || 'Không thể lưu nhân vật mới vào bảng chars trên Supabase.'
    );
  }

  const charRow = insertedChar as SupabaseCharRow;

  const { error: secretErr } = await supabase.from('char_secrets').upsert(
    {
      char_id: charRow.id,
      chat_link: params.chatLink.trim(),
      open_scene: params.openScene.trim(),
    },
    { onConflict: 'char_id' }
  );

  if (secretErr) {
    throw new Error(
      secretErr.message || 'Đã tạo char nhưng chưa lưu được char_secrets.'
    );
  }

  return charRow;
}

/**
 * 4. Cập nhật nhân vật trên bảng `chars` và (nếu có) `char_secrets`.
 */
export async function updateCharOnSupabase(
  charId: string,
  patch: Partial<CharacterItem> & {
    chatLink?: string;
    openSceneSecret?: string;
  }
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};

  if (patch.name !== undefined) dbPatch.name = patch.name.trim();
  if ('imageUrl' in patch) dbPatch.image_url = patch.imageUrl?.trim() || null;
  if (patch.tags !== undefined) dbPatch.tags = patch.tags;
  if (patch.description !== undefined)
    dbPatch.description = patch.description.trim();
  if (patch.isLocked !== undefined) dbPatch.locked = patch.isLocked;
  if (patch.unlockRequirements !== undefined) {
    dbPatch.requirements = toSupabaseRequirementsJson(patch.unlockRequirements);
  }

  if (Object.keys(dbPatch).length > 0) {
    const { error } = await supabase
      .from('chars')
      .update(dbPatch)
      .eq('id', charId);
    if (error) {
      throw new Error(error.message || 'Không thể cập nhật thông tin nhân vật.');
    }
  }

  if (patch.chatLink !== undefined || patch.openSceneSecret !== undefined) {
    const secretPayload: Record<string, unknown> = { char_id: charId };
    if (patch.chatLink !== undefined) {
      secretPayload.chat_link = patch.chatLink.trim();
    }
    if (patch.openSceneSecret !== undefined) {
      secretPayload.open_scene = patch.openSceneSecret.trim();
    }
    const { error: secErr } = await supabase
      .from('char_secrets')
      .upsert(secretPayload, { onConflict: 'char_id' });
    if (secErr) {
      throw new Error(secErr.message || 'Không thể cập nhật char_secrets.');
    }
  }
}

/**
 * 5. Xóa nhân vật khỏi bảng `chars`
 */
export async function deleteCharOnSupabase(charId: string): Promise<void> {
  await supabase.from('char_secrets').delete().eq('char_id', charId);
  const { error } = await supabase.from('chars').delete().eq('id', charId);
  if (error) {
    throw new Error(error.message || 'Không thể xóa nhân vật này.');
  }
}

/**
 * 6. Đọc danh sách vật phẩm từ bảng `inventory` của người dùng hiện tại.
 */
export interface SupabaseInventoryItem extends GeneratedGameItem {
  count: number;
  readyAt: string | null;
}

export async function fetchInventoryFromSupabase(): Promise<
  SupabaseInventoryItem[]
> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('inventory')
    .select('id, user_id, kind, name, rarity, ready_at, created_at, count')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as SupabaseInventoryRow[]).map((row) => {
    const rawKind = String(row.kind || 'flower').toLowerCase();
    const category: ItemCategory =
      rawKind === 'fish' ||
      rawKind === 'flower' ||
      rawKind === 'drink' ||
      rawKind === 'pet'
        ? rawKind
        : 'flower';
    const rawRarity = String(row.rarity || 'common').toLowerCase();
    const rarity: ItemRarity =
      rawRarity === 'legendary' || rawRarity === 'rare' ? rawRarity : 'common';

    const count = Math.max(1, Number(row.count) || 1);
    const visual = buildVisualFromSupabaseItem(
      row.id,
      row.name || 'Vật phẩm',
      category,
      rarity
    );

    return {
      id: row.id,
      name: row.name || 'Vật phẩm kỷ niệm',
      category,
      rarity,
      visual,
      createdAt: row.created_at || new Date().toISOString(),
      description:
        category === 'flower'
          ? 'Đóa hoa trong vườn nhỏ dùng để mở khóa nhân vật.'
          : category === 'fish'
          ? 'Chú cá nhỏ lấp lánh trong hồ dùng để mở khóa nhân vật.'
          : category === 'drink'
          ? 'Ly thức uống thơm dịu dùng để mở khóa nhân vật.'
          : 'Người bạn thú cưng đáng yêu dùng để mở khóa nhân vật.',
      count,
      readyAt: row.ready_at || null,
    };
  });
}

/**
 * Kiểm tra xem vật phẩm trong `inventory` đã sẵn sàng chưa:
 * Hoa và cá chỉ tính khi `ready_at` là `null` hoặc thời gian hiện tại đã qua `ready_at`.
 */
export function isInventoryItemReady(
  item: SupabaseInventoryItem,
  nowMs = Date.now()
): boolean {
  if (!item.readyAt) return true;
  const readyTime = new Date(item.readyAt).getTime();
  if (Number.isNaN(readyTime)) return true;
  return readyTime <= nowMs;
}

/**
 * Kiểm tra điều kiện mở khóa Char dựa HOÀN TOÀN trên bảng `inventory` của Supabase
 * (chỉ tính vật phẩm có `ready_at` null hoặc đã qua).
 */
export function checkSupabaseUnlockRequirements(
  requirements: CharacterUnlockRequirement[],
  inventoryItems: SupabaseInventoryItem[],
  nowMs = Date.now()
): {
  allMet: boolean;
  details: {
    req: CharacterUnlockRequirement;
    ownedReadyCount: number;
    ownedPendingCount: number;
    isMet: boolean;
    hintText: string;
  }[];
} {
  // Tạo bản sao số lượng khả dụng của từng dòng inventory đã ready
  const readyPool = inventoryItems
    .filter((item) => isInventoryItemReady(item, nowMs))
    .map((item) => ({
      ...item,
      remaining: Math.max(0, item.count || 1),
    }));

  const pendingPool = inventoryItems.filter(
    (item) => !isInventoryItemReady(item, nowMs)
  );

  const details = requirements.map((req) => {
    const specific = req.specificItemName?.trim().toLowerCase();

    let ownedReadyCount = 0;
    readyPool.forEach((entry) => {
      if (entry.remaining <= 0) return;
      if (entry.category !== req.category) return;
      if (specific && entry.name.trim().toLowerCase() !== specific) return;
      ownedReadyCount += entry.remaining;
    });

    // Trừ số lượng đã dùng cho requirement này để các requirement sau không tính trùng
    let needed = req.count;
    for (const entry of readyPool) {
      if (needed <= 0) break;
      if (entry.remaining <= 0) continue;
      if (entry.category !== req.category) continue;
      if (specific && entry.name.trim().toLowerCase() !== specific) continue;
      const take = Math.min(entry.remaining, needed);
      entry.remaining -= take;
      needed -= take;
    }

    let ownedPendingCount = 0;
    pendingPool.forEach((entry) => {
      if (entry.category !== req.category) return;
      if (specific && entry.name.trim().toLowerCase() !== specific) return;
      ownedPendingCount += Math.max(1, entry.count || 1);
    });

    const isMet = ownedReadyCount >= req.count;
    let hintText = '';
    if (!isMet) {
      if (ownedPendingCount > 0) {
        let minMs: number | null = null;
        pendingPool.forEach((entry) => {
          if (entry.category !== req.category) return;
          if (specific && entry.name.trim().toLowerCase() !== specific) return;
          if (entry.readyAt) {
            const diff = new Date(entry.readyAt).getTime() - nowMs;
            if (diff > 0) {
              if (minMs === null || diff < minMs) minMs = diff;
            }
          }
        });
        if (minMs !== null && minMs > 0) {
          const totalSec = Math.ceil(minMs / 1000);
          const mins = Math.floor(totalSec / 60);
          const secs = totalSec % 60;
          const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          hintText = `🌱 Đang lớn, còn ${formatted}`;
        } else {
          hintText = `🌱 Đang lớn (${ownedPendingCount} vật phẩm sắp sẵn sàng)`;
        }
      } else {
        hintText =
          '🌸 Chưa có vật phẩm này trong Kho đồ. Bạn có thể ghé Chợ nhỏ để mua nhanh nhé!';
      }
    }

    return {
      req,
      ownedReadyCount,
      ownedPendingCount,
      isMet,
      hintText,
    };
  });

  return {
    allMet: details.every((d) => d.isMet),
    details,
  };
}

/**
 * 7. Đọc danh sách `char_id` mà người dùng đã mở khóa từ bảng `unlocks`.
 */
export async function fetchUnlockedCharIdsFromSupabase(): Promise<string[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('unlocks')
    .select('char_id')
    .eq('user_id', uid);

  if (error || !Array.isArray(data)) return [];
  return data.map((row: { char_id: string }) => row.char_id);
}

/**
 * 8. Gọi RPC `unlock_char(p_char_id)` để mở khóa nhân vật trên Supabase.
 * Bắt lỗi `missing_items` và `not_logged_in` và trả về thông báo dễ thương.
 */
export async function unlockCharViaRpc(charId: string): Promise<{
  secret: { chatLink: string; openScene: string } | null;
}> {
  const { error } = await supabase.rpc('unlock_char', {
    p_char_id: charId,
  });

  if (error) {
    const rawMsg = `${error.message || ''} ${error.details || ''} ${
      error.hint || ''
    }`.toLowerCase();

    if (
      rawMsg.includes('not_logged_in') ||
      rawMsg.includes('unauthenticated') ||
      rawMsg.includes('permission denied') ||
      error.code === '42501'
    ) {
      throw new Error(
        '🌸 Mời bạn đăng nhập tài khoản để mở khóa và trò chuyện cùng nhân vật nhé!'
      );
    }

    if (rawMsg.includes('missing_items') || rawMsg.includes('insufficient')) {
      throw new Error(
        '🌸 Bạn chưa đủ vật phẩm sẵn sàng trong Kho đồ (hoa đã nở / cá đã lớn) để mở khóa nhân vật này nhé!'
      );
    }

    throw new Error(
      '🌸 Chưa thể mở khóa nhân vật lúc này, bạn kiểm tra lại các vật phẩm đã sẵn sàng trong Kho đồ nhé!'
    );
  }

  const secret = await fetchCharSecretOnDemand(charId);
  return { secret };
}

/**
 * 9. Kiểm tra xem hôm nay người dùng đã quay Gacha miễn phí chưa từ bảng `daily_rolls`.
 */
export async function fetchHasRolledTodayFromSupabase(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return false;

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_rolls')
    .select('user_id, day')
    .eq('user_id', uid)
    .eq('day', todayStr)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

/**
 * 10. Gọi RPC `roll_gacha()` mỗi ngày:
 * - Nếu lỗi `already_rolled` thì báo đúng câu: "Hôm nay bạn đã nhận rồi, mai quay lại nhé"
 */
export async function rollDailyGachaViaRpc(): Promise<{
  rawResult: unknown;
  updatedInventory: SupabaseInventoryItem[];
}> {
  const { data, error } = await supabase.rpc('roll_gacha');

  if (error) {
    const rawMsg = `${error.message || ''} ${error.details || ''} ${
      error.hint || ''
    }`.toLowerCase();

    if (rawMsg.includes('already_rolled') || rawMsg.includes('already rolled') || rawMsg.includes('duplicate')) {
      throw new Error('Hôm nay bạn đã nhận rồi, mai quay lại nhé');
    }

    if (
      rawMsg.includes('not_logged_in') ||
      rawMsg.includes('permission denied') ||
      error.code === '42501'
    ) {
      throw new Error('🌸 Mời bạn đăng nhập tài khoản để mở Gacha mỗi ngày nhé!');
    }

    throw new Error(
      error.message || 'Không thể quay Gacha lúc này, bạn thử lại sau giây lát nhé 🌸'
    );
  }

  const updatedInventory = await fetchInventoryFromSupabase();
  return {
    rawResult: data,
    updatedInventory,
  };
}

/**
 * 11. Bảng `commissions` (id, owner_id, data, created_at)
 */
export async function fetchCommissionsFromSupabase(): Promise<{
  boards: CreatorCommissionInfo[];
  orders: CommissionOrder[];
}> {
  const { data, error } = await supabase
    .from('commissions')
    .select('id, owner_id, data, created_at')
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    return { boards: [], orders: [] };
  }

  const boards: CreatorCommissionInfo[] = [];
  const orders: CommissionOrder[] = [];

  data.forEach((row: { id: string; owner_id: string; data: Record<string, unknown>; created_at: string }) => {
    const d = row.data || {};
    if (d.recordType === 'order') {
      orders.push({
        id: row.id,
        creatorId: String(d.creatorId || row.owner_id || ''),
        requesterName: String(d.requesterName || 'Bạn Nhỏ'),
        characterConcept: String(d.characterConcept || ''),
        budget: String(d.budget || 'Thỏa thuận'),
        contact: String(d.contact || ''),
        status: (d.status as CommissionOrder['status']) || 'pending',
        createdAt: row.created_at,
      });
    } else {
      boards.push({
        id: row.id,
        creatorId: String(d.creatorId || row.owner_id || ''),
        isOpen: d.isOpen !== undefined ? Boolean(d.isOpen) : true,
        waitTime: String(d.waitTime || '3 – 5 ngày'),
        slotsLeft: Number(d.slotsLeft ?? 3),
        note: String(d.note || ''),
        imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
        tiers: Array.isArray(d.tiers) ? (d.tiers as CreatorCommissionInfo['tiers']) : [],
      });
    }
  });

  return { boards, orders };
}

export async function insertCommissionRecordOnSupabase(
  ownerId: string,
  payload: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('commissions')
    .insert({
      owner_id: ownerId,
      data: payload,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Không thể lưu dữ liệu vào bảng commissions.');
  }
  return (data as { id: string }).id;
}

export async function updateCommissionRecordOnSupabase(
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('commissions')
    .update({ data: payload })
    .eq('id', id);
  if (error) {
    throw new Error(error.message || 'Không thể cập nhật bảng commissions.');
  }
}

export async function deleteCommissionRecordOnSupabase(id: string): Promise<void> {
  const { error } = await supabase.from('commissions').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Không thể xóa mục khỏi bảng commissions.');
  }
}

export async function saveCommissionBoardOnSupabase(
  info: CreatorCommissionInfo,
  isNew = false
): Promise<{ ok: boolean; message: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id || info.creatorId;
    const payload: Record<string, unknown> = {
      recordType: 'board',
      creatorId: info.creatorId || uid,
      isOpen: info.isOpen,
      waitTime: info.waitTime,
      slotsLeft: info.slotsLeft,
      note: info.note,
      imageUrl: info.imageUrl,
      tiers: info.tiers,
    };
    if (isNew || !info.id || info.id.startsWith('comm-info-')) {
      await insertCommissionRecordOnSupabase(uid, payload);
    } else {
      await updateCommissionRecordOnSupabase(info.id, payload);
    }
    return { ok: true, message: 'Đã lưu bảng giá Commission lên Supabase!' };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Không thể lưu bảng giá Commission lên Supabase.',
    };
  }
}

export async function deleteCommissionBoardOnSupabase(
  id: string
): Promise<boolean> {
  try {
    await deleteCommissionRecordOnSupabase(id);
    return true;
  } catch {
    return false;
  }
}

export async function insertCommissionOrderOnSupabase(
  order: Omit<CommissionOrder, 'id' | 'createdAt'>
): Promise<{ ok: boolean; message: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      return {
        ok: false,
        message: 'Bạn hãy đăng nhập trước khi gửi đơn Commission nhé 🌸',
      };
    }
    await insertCommissionRecordOnSupabase(uid, {
      recordType: 'order',
      ...order,
    });
    return { ok: true, message: 'Đã gửi đơn đặt Commission thành công!' };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Không thể gửi đơn Commission lúc này.',
    };
  }
}

export async function updateCommissionOrderStatusOnSupabase(
  order: CommissionOrder,
  nextStatus: CommissionOrder['status']
): Promise<boolean> {
  try {
    await updateCommissionRecordOnSupabase(order.id, {
      recordType: 'order',
      creatorId: order.creatorId,
      requesterName: order.requesterName,
      characterConcept: order.characterConcept,
      budget: order.budget,
      contact: order.contact,
      status: nextStatus,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 12. Bảng `requests` (id, owner_id, data, created_at)
 */
export async function fetchRequestsFromSupabase(): Promise<CharacterRequest[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('id, owner_id, data, created_at')
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) return [];

  return data.map(
    (row: {
      id: string;
      owner_id: string;
      data: Record<string, unknown>;
      created_at: string;
    }) => {
      const d = row.data || {};
      return {
        id: row.id,
        creatorId: String(d.creatorId || row.owner_id || ''),
        requesterName: String(d.requesterName || 'Bạn Nhỏ'),
        title: String(d.title || 'Request nhân vật'),
        description: String(d.description || ''),
        tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
        status: (d.status as CharacterRequest['status']) || 'pending',
        replies: Array.isArray(d.replies)
          ? (d.replies as CharacterRequest['replies'])
          : [],
        createdAt: row.created_at,
      };
    }
  );
}

export async function insertRequestOnSupabase(
  arg1: string | Omit<CharacterRequest, 'id' | 'createdAt' | 'replies'>,
  arg2?: Omit<CharacterRequest, 'id'>
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid =
      typeof arg1 === 'string'
        ? arg1
        : sessionData.session?.user?.id || '';
    const reqPayload =
      typeof arg1 === 'string'
        ? arg2
        : {
            ...arg1,
            replies: [],
            createdAt: new Date().toISOString(),
          };
    if (!uid || !reqPayload) {
      return { ok: false, message: 'Vui lòng đăng nhập để gửi Request.' };
    }
    const { error } = await supabase.from('requests').insert({
      owner_id: uid,
      data: reqPayload,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Lỗi gửi Request.',
    };
  }
}

export async function updateRequestOnSupabase(
  arg1: string | CharacterRequest,
  arg2?: Partial<CharacterRequest>,
  arg3?: CharacterRequest
): Promise<boolean> {
  try {
    const id = typeof arg1 === 'string' ? arg1 : arg1.id;
    const merged =
      typeof arg1 === 'string' ? { ...arg3, ...arg2 } : arg1;
    const { error } = await supabase
      .from('requests')
      .update({ data: merged })
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * 13. Bảng `command_vault` (id, owner_id, data, created_at)
 */
export async function fetchCommandVaultFromSupabase(): Promise<{
  personalPrompts: PersonalPrompt[];
  sharedPrompts: SharedPrompt[];
}> {
  const { data, error } = await supabase
    .from('command_vault')
    .select('id, owner_id, data, created_at')
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    return { personalPrompts: [], sharedPrompts: [] };
  }

  const personalPrompts: PersonalPrompt[] = [];
  const sharedPrompts: SharedPrompt[] = [];

  data.forEach(
    (row: {
      id: string;
      owner_id: string;
      data: Record<string, unknown>;
      created_at: string;
    }) => {
      const d = row.data || {};
      if (d.vaultType === 'shared') {
        sharedPrompts.push({
          id: row.id,
          title: String(d.title || 'Lệnh chia sẻ'),
          creatorId: String(d.creatorId || row.owner_id || ''),
          characterId: d.characterId ? String(d.characterId) : undefined,
          tags: Array.isArray(d.tags) ? (d.tags as string[]) : ['Đa dụng'],
          usageNote: String(d.usageNote || ''),
          content: String(d.content || ''),
          imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
          createdAt: row.created_at,
        });
      } else {
        personalPrompts.push({
          id: row.id,
          title: String(d.title || 'Lệnh cá nhân'),
          folder: String(d.folder || 'Mặc định'),
          tags: Array.isArray(d.tags) ? (d.tags as string[]) : ['Cá nhân'],
          content: String(d.content || ''),
          starred: Boolean(d.starred),
          sourceCreatorName: d.sourceCreatorName
            ? String(d.sourceCreatorName)
            : undefined,
          createdAt: row.created_at,
        });
      }
    }
  );

  return { personalPrompts, sharedPrompts };
}

export async function fetchSharedPromptsFromSupabase(): Promise<SharedPrompt[]> {
  const res = await fetchCommandVaultFromSupabase();
  return res.sharedPrompts;
}

export async function fetchPersonalPromptsFromSupabase(): Promise<PersonalPrompt[]> {
  const res = await fetchCommandVaultFromSupabase();
  return res.personalPrompts;
}

export async function insertCommandVaultOnSupabase(
  ownerId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('command_vault').insert({
    owner_id: ownerId,
    data: payload,
  });
  if (error) {
    throw new Error(error.message || 'Không thể lưu vào bảng command_vault.');
  }
}

export async function updateCommandVaultOnSupabase(
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('command_vault')
    .update({ data: payload })
    .eq('id', id);
  if (error) {
    throw new Error(error.message || 'Không thể cập nhật bảng command_vault.');
  }
}

export async function deleteCommandVaultOnSupabase(id: string): Promise<void> {
  const { error } = await supabase.from('command_vault').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Không thể xóa mục khỏi command_vault.');
  }
}

export async function deleteCommandVaultRowOnSupabase(
  id: string
): Promise<boolean> {
  try {
    await deleteCommandVaultOnSupabase(id);
    return true;
  } catch {
    return false;
  }
}

export async function insertSharedPromptOnSupabase(
  prompt: Omit<SharedPrompt, 'id' | 'createdAt'>
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = String(sessionData.session?.user?.id || prompt.creatorId || '');
    await insertCommandVaultOnSupabase(uid, {
      vaultType: 'shared',
      ...prompt,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Không thể đăng lệnh chia sẻ.',
    };
  }
}

export async function updateSharedPromptOnSupabase(
  prompt: SharedPrompt
): Promise<boolean> {
  try {
    await updateCommandVaultOnSupabase(prompt.id, {
      vaultType: 'shared',
      title: prompt.title,
      creatorId: prompt.creatorId,
      characterId: prompt.characterId,
      tags: prompt.tags,
      usageNote: prompt.usageNote,
      content: prompt.content,
      imageUrl: prompt.imageUrl,
    });
    return true;
  } catch {
    return false;
  }
}

export async function insertPersonalPromptOnSupabase(
  prompt: Omit<PersonalPrompt, 'id' | 'createdAt'>
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      return { ok: false, message: 'Vui lòng đăng nhập để lưu vào Kho lệnh.' };
    }
    await insertCommandVaultOnSupabase(uid, {
      vaultType: 'personal',
      ...prompt,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Không thể lưu vào Kho lệnh.',
    };
  }
}

export async function updatePersonalPromptOnSupabase(
  prompt: PersonalPrompt
): Promise<boolean> {
  try {
    await updateCommandVaultOnSupabase(prompt.id, {
      vaultType: 'personal',
      title: prompt.title,
      folder: prompt.folder,
      tags: prompt.tags,
      content: prompt.content,
      starred: prompt.starred,
      sourceCreatorName: prompt.sourceCreatorName,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Các hàm tương thích với MiniGameTab (DbInventoryRow, rollGachaOnSupabase, v.v.)
 */
export interface DbInventoryRow {
  id: string;
  user_id: string;
  item_type: string;
  item_name: string;
  rarity: string | null;
  color?: string | null;
  ready_at: string | null;
  created_at: string;
  count?: number | null;
}

export async function fetchMyInventoryFromSupabase(): Promise<DbInventoryRow[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('inventory')
    .select('id, user_id, kind, name, rarity, ready_at, created_at, count')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return (data as SupabaseInventoryRow[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    item_type: r.kind || 'flower',
    item_name: r.name || 'Vật phẩm',
    rarity: r.rarity || 'common',
    ready_at: r.ready_at,
    created_at: r.created_at,
    count: r.count ?? 1,
  }));
}

export async function fetchMyDailyRollToday(): Promise<boolean> {
  return fetchHasRolledTodayFromSupabase();
}

export async function rollGachaOnSupabase(): Promise<{
  ok: boolean;
  error?: string;
  errorCode?: string;
  message: string;
  item?: DbInventoryRow;
}> {
  try {
    const res = await rollDailyGachaViaRpc();
    const raw = res.rawResult as Record<string, unknown> | null;
    const latest = res.updatedInventory[0];
    if (latest) {
      return {
        ok: true,
        message: 'Đã nhận quà Gacha thành công!',
        item: {
          id: latest.id,
          user_id: '',
          item_type: latest.category,
          item_name: latest.name,
          rarity: latest.rarity,
          color: latest.visual.primaryColor,
          ready_at: latest.readyAt,
          created_at: latest.createdAt,
          count: latest.count,
        },
      };
    }
    if (raw && typeof raw === 'object') {
      return {
        ok: true,
        message: 'Đã nhận quà Gacha thành công!',
        item: {
          id: String(raw.id || `gacha_${Date.now()}`),
          user_id: String(raw.user_id || ''),
          item_type: String(raw.kind || raw.item_type || 'flower'),
          item_name: String(raw.name || raw.item_name || 'Hoa Sương Mai Ngọt'),
          rarity: String(raw.rarity || 'common'),
          ready_at: raw.ready_at ? String(raw.ready_at) : null,
          created_at: new Date().toISOString(),
        },
      };
    }
    return { ok: true, message: 'Đã nhận quà Gacha thành công!' };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Hôm nay bạn đã nhận rồi, mai quay lại nhé';
    const isAlreadyRolled =
      msg.includes('already_rolled') || msg.includes('Hôm nay bạn đã nhận rồi');
    return {
      ok: false,
      error: msg,
      errorCode: isAlreadyRolled ? 'already_rolled' : 'roll_failed',
      message: isAlreadyRolled
        ? 'Hôm nay bạn đã nhận rồi, mai quay lại nhé'
        : msg,
    };
  }
}

export async function updateInventoryItemReadyAt(
  id: string,
  readyAtIso: string | null
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('inventory')
      .update({ ready_at: readyAtIso })
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function insertCraftedDrinkToInventory(params: {
  item_type: string;
  item_name: string;
  rarity: string;
  color?: string;
}): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return false;
    const { error } = await supabase.from('inventory').insert({
      user_id: uid,
      kind: params.item_type || 'drink',
      name: params.item_name,
      rarity: params.rarity || 'common',
      ready_at: null,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * 14. Bảng `feedback` (id, author_id, rating, body, anonymous, created_at)
 */
interface FeedbackBodyEnvelope {
  _v?: number;
  text: string;
  targetType?: FeedbackTargetType;
  targetId?: string;
  targetName?: string;
  creatorId?: string;
  authorName?: string;
  hearts?: number;
  isRead?: boolean;
  replies?: FeedbackItem['replies'];
}

function parseFeedbackBody(rawBody: string | null): FeedbackBodyEnvelope {
  if (!rawBody) {
    return { text: '' };
  }
  const trimmed = rawBody.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as FeedbackBodyEnvelope;
      if (parsed && typeof parsed.text === 'string') {
        return parsed;
      }
    } catch {
      // Fallback plain text
    }
  }
  return { text: rawBody };
}

export async function fetchFeedbacksFromSupabase(): Promise<FeedbackItem[]> {
  const [fbRes, profRes] = await Promise.all([
    supabase
      .from('feedback')
      .select('id, author_id, rating, body, anonymous, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('public_profiles').select('id, display_name'),
  ]);

  if (fbRes.error || !Array.isArray(fbRes.data)) {
    return [];
  }

  const profMap = new Map<string, string>();
  if (Array.isArray(profRes.data)) {
    profRes.data.forEach((p: { id: string; display_name: string | null }) => {
      if (p.display_name) profMap.set(p.id, p.display_name);
    });
  }

  return fbRes.data.map(
    (row: {
      id: string;
      author_id: string | null;
      rating: number | null;
      body: string | null;
      anonymous: boolean | null;
      created_at: string;
    }) => {
      const env = parseFeedbackBody(row.body);
      const isAnon = Boolean(row.anonymous);
      const resolvedAuthorName = isAnon
        ? 'Một người bạn ẩn danh'
        : env.authorName ||
          (row.author_id ? profMap.get(row.author_id) : null) ||
          'Bạn Nhỏ';

      return {
        id: row.id,
        targetType: env.targetType || 'web',
        targetId: env.targetId || 'web',
        targetName: env.targetName || 'Góc Nhỏ Lấp Lánh',
        creatorId: env.creatorId,
        authorId: row.author_id || '',
        authorName: resolvedAuthorName,
        isAnonymous: isAnon,
        rating: Math.max(1, Math.min(5, Number(row.rating) || 5)),
        content: env.text,
        hearts: Number(env.hearts ?? 1),
        isRead: Boolean(env.isRead),
        replies: Array.isArray(env.replies) ? env.replies : [],
        createdAt: row.created_at,
      };
    }
  );
}

export async function insertFeedbackOnSupabase(params: {
  authorId: string;
  authorName: string;
  rating: number;
  content: string;
  anonymous: boolean;
  targetType: FeedbackTargetType;
  targetId: string;
  targetName: string;
  creatorId?: string;
}): Promise<void> {
  const envelope: FeedbackBodyEnvelope = {
    _v: 1,
    text: params.content.trim(),
    targetType: params.targetType,
    targetId: params.targetId,
    targetName: params.targetName,
    creatorId: params.creatorId,
    authorName: params.anonymous ? 'Một người bạn ẩn danh' : params.authorName,
    hearts: 1,
    isRead: false,
    replies: [],
  };

  const { error } = await supabase.from('feedback').insert({
    author_id: params.authorId,
    rating: Math.max(1, Math.min(5, params.rating)),
    body: JSON.stringify(envelope),
    anonymous: params.anonymous,
  });

  if (error) {
    throw new Error(
      error.message || 'Không thể gửi Feedback lúc này, bạn thử lại nhé 🌸'
    );
  }
}

export async function updateFeedbackEnvelopeOnSupabase(
  feedbackId: string,
  item: FeedbackItem
): Promise<void> {
  const envelope: FeedbackBodyEnvelope = {
    _v: 1,
    text: item.content,
    targetType: item.targetType,
    targetId: item.targetId,
    targetName: item.targetName,
    creatorId: item.creatorId,
    authorName: item.authorName,
    hearts: item.hearts,
    isRead: item.isRead,
    replies: item.replies,
  };

  const { error } = await supabase
    .from('feedback')
    .update({
      body: JSON.stringify(envelope),
    })
    .eq('id', feedbackId);

  if (error) {
    throw new Error(error.message || 'Không thể cập nhật Feedback.');
  }
}

// ============================================================================
// 7) DANH SÁCH THÀNH VIÊN CHO CHỦ WEB (RPC `admin_list_users`)
// - Chỉ owner gọi được; trả về id, username, display_name, email, role, created_at
// - Nếu RPC báo lỗi `not_allowed` thì trả về notAllowed = true để ẩn mục này
// - Tuyệt đối KHÔNG lưu danh sách này vào localStorage
// ============================================================================
export interface AdminListedUser {
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

export async function fetchAdminListUsersFromSupabase(): Promise<{
  ok: boolean;
  notAllowed?: boolean;
  error?: string;
  users: AdminListedUser[];
}> {
  try {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) {
      const errText = `${error.message || ''} ${error.details || ''} ${error.code || ''}`.toLowerCase();
      if (
        errText.includes('not_allowed') ||
        errText.includes('permission denied') ||
        errText.includes('forbidden') ||
        errText.includes('42501')
      ) {
        return {
          ok: false,
          notAllowed: true,
          error: 'not_allowed',
          users: [],
        };
      }
      return {
        ok: false,
        error: error.message || 'Không thể tải danh sách thành viên.',
        users: [],
      };
    }

    if (!Array.isArray(data)) {
      return { ok: true, users: [] };
    }

    const users: AdminListedUser[] = data.map((row: Record<string, unknown>) => ({
      id: String(row.id || ''),
      username: String(row.username || ''),
      display_name: String(row.display_name || row.username || 'Người dùng'),
      email: String(row.email || ''),
      role: String(row.role || 'user').toLowerCase(),
      created_at: String(row.created_at || ''),
    }));

    return { ok: true, users };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg.toLowerCase().includes('not_allowed')) {
      return {
        ok: false,
        notAllowed: true,
        error: 'not_allowed',
        users: [],
      };
    }
    return {
      ok: false,
      error: msg || 'Không thể tải danh sách thành viên.',
      users: [],
    };
  }
}

// ============================================================================
// 15) CHỢ NHỎ & NHIỆM VỤ HÀNG NGÀY (TIỀN TỆ "XU" TRÊN PROFILES.COINS)
// ============================================================================

export interface MarketPriceRow {
  kind: ItemCategory;
  buy_price: number;
  sell_price: number;
  enabled: boolean;
}

export const DEFAULT_MARKET_PRICES: MarketPriceRow[] = [
  { kind: 'flower', buy_price: 5, sell_price: 2, enabled: true },
  { kind: 'fish', buy_price: 8, sell_price: 3, enabled: true },
  { kind: 'drink', buy_price: 4, sell_price: 2, enabled: true },
  { kind: 'pet', buy_price: 20, sell_price: 8, enabled: true },
];

export interface QuestPoolRow {
  id: string | number;
  title: string;
  reward: number;
  active: boolean;
}

export interface DailyQuestItem {
  index: number;
  id?: string | number;
  title: string;
  reward: number;
  completed: boolean;
}

export interface DailyQuestsResult {
  ok: boolean;
  quests: DailyQuestItem[];
  resetsAt: string;
  coins?: number;
  error?: string;
}

/**
 * Đọc số Xu hiện tại từ cột `profiles.coins` trên Supabase (KHÔNG lưu Xu trong localStorage)
 */
export async function fetchMyCoinsFromSupabase(): Promise<number> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return 0;

    const { data, error } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', uid)
      .maybeSingle();

    if (error || !data) return 0;
    return typeof data.coins === 'number' ? data.coins : 0;
  } catch {
    return 0;
  }
}

/**
 * Đọc bảng `market_prices` (kind, buy_price, sell_price, enabled)
 */
export async function fetchMarketPricesFromSupabase(): Promise<MarketPriceRow[]> {
  try {
    const { data, error } = await supabase
      .from('market_prices')
      .select('kind, buy_price, sell_price, enabled');

    if (error || !Array.isArray(data) || data.length === 0) {
      return DEFAULT_MARKET_PRICES;
    }

    const order: ItemCategory[] = ['flower', 'fish', 'drink', 'pet'];
    const map = new Map<string, MarketPriceRow>();

    data.forEach((row: Record<string, unknown>) => {
      const kind = String(row.kind || 'flower').toLowerCase() as ItemCategory;
      map.set(kind, {
        kind,
        buy_price: Math.max(0, Number(row.buy_price) || 0),
        sell_price: Math.max(0, Number(row.sell_price) || 0),
        enabled: row.enabled !== false,
      });
    });

    return order.map((k) => map.get(k) || DEFAULT_MARKET_PRICES.find((d) => d.kind === k)!);
  } catch {
    return DEFAULT_MARKET_PRICES;
  }
}

/**
 * Cập nhật giá mua, giá bán hoặc bật/tắt một món trong `market_prices` (Dành cho Chủ web)
 */
export async function updateMarketPriceOnSupabase(
  row: MarketPriceRow
): Promise<{ ok: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('market_prices')
      .upsert(
        {
          kind: row.kind,
          buy_price: Math.max(0, Math.floor(row.buy_price)),
          sell_price: Math.max(0, Math.floor(row.sell_price)),
          enabled: Boolean(row.enabled),
        },
        { onConflict: 'kind' }
      );

    if (error) {
      return { ok: false, message: error.message || 'Không thể lưu giá Chợ nhỏ.' };
    }
    return { ok: true, message: 'Đã lưu giá vật phẩm Chợ nhỏ!' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Có lỗi khi cập nhật giá.',
    };
  }
}

/**
 * Đọc bảng `quest_pool` (id, title, reward, active) (Dành cho Chủ web)
 */
export async function fetchQuestPoolFromSupabase(): Promise<QuestPoolRow[]> {
  try {
    const { data, error } = await supabase
      .from('quest_pool')
      .select('id, title, reward, active')
      .order('id', { ascending: true });

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string | number,
      title: String(r.title || ''),
      reward: Math.max(0, Number(r.reward) || 5),
      active: r.active !== false,
    }));
  } catch {
    return [];
  }
}

/**
 * Thêm nhiệm vụ mới vào `quest_pool`
 */
export async function createQuestPoolRow(params: {
  title: string;
  reward: number;
  active?: boolean;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('quest_pool').insert({
      title: params.title.trim(),
      reward: Math.max(1, Math.floor(params.reward)),
      active: params.active ?? true,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Cập nhật nhiệm vụ trong `quest_pool`
 */
export async function updateQuestPoolRow(
  id: string | number,
  patch: Partial<Omit<QuestPoolRow, 'id'>>
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title.trim();
    if (patch.reward !== undefined) payload.reward = Math.max(1, Math.floor(patch.reward));
    if (patch.active !== undefined) payload.active = Boolean(patch.active);

    const { error } = await supabase
      .from('quest_pool')
      .update(payload)
      .eq('id', id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Xóa nhiệm vụ khỏi `quest_pool`
 */
export async function deleteQuestPoolRow(id: string | number): Promise<boolean> {
  try {
    const { error } = await supabase.from('quest_pool').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Tính thời điểm nửa đêm kế tiếp (UTC / Ngày mới) làm fallback nếu rpc không trả về resets_at
 */
function getNextMidnightIso(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return next.toISOString();
}

/**
 * Gọi RPC `get_daily_quests()` để lấy 3 nhiệm vụ hôm nay và thời gian đếm ngược resets_at
 */
export async function fetchDailyQuestsFromSupabase(): Promise<DailyQuestsResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user?.id) {
      return {
        ok: false,
        quests: [],
        resetsAt: getNextMidnightIso(),
        error: 'not_logged_in',
      };
    }

    const { data, error } = await supabase.rpc('get_daily_quests');

    if (error) {
      return {
        ok: false,
        quests: [],
        resetsAt: getNextMidnightIso(),
        error: error.message || 'Lỗi khi tải nhiệm vụ.',
      };
    }

    let rawList: Record<string, unknown>[] = [];
    let resetsAt = getNextMidnightIso();
    let coins: number | undefined;

    if (Array.isArray(data)) {
      if (data.length === 1 && data[0] && typeof data[0] === 'object' && Array.isArray(data[0].quests)) {
        rawList = data[0].quests as Record<string, unknown>[];
        if (typeof data[0].resets_at === 'string') resetsAt = data[0].resets_at;
        if (typeof data[0].coins === 'number') coins = data[0].coins;
      } else {
        rawList = data as Record<string, unknown>[];
        if (rawList[0] && typeof rawList[0].resets_at === 'string') {
          resetsAt = rawList[0].resets_at as string;
        }
      }
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.quests)) {
        rawList = obj.quests as Record<string, unknown>[];
      } else if (Array.isArray(obj.items)) {
        rawList = obj.items as Record<string, unknown>[];
      } else if (Array.isArray(obj.daily_quests)) {
        rawList = obj.daily_quests as Record<string, unknown>[];
      }
      if (typeof obj.resets_at === 'string') resetsAt = obj.resets_at;
      if (typeof obj.coins === 'number') coins = obj.coins;
    }

    const quests: DailyQuestItem[] = rawList.map((item, idx) => {
      const rawIndex =
        typeof item.index === 'number'
          ? item.index
          : typeof item.quest_index === 'number'
          ? item.quest_index
          : typeof item.p_index === 'number'
          ? item.p_index
          : idx;

      const isCompleted = Boolean(
        item.completed ?? item.done ?? item.is_completed ?? item.claimed ?? item.is_done
      );

      return {
        index: rawIndex,
        id: (item.id as string | number) ?? `quest_${rawIndex}`,
        title: String(item.title || item.name || `Nhiệm vụ #${idx + 1}`),
        reward: Math.max(1, Number(item.reward ?? item.reward_coins ?? 5)),
        completed: isCompleted,
      };
    });

    return {
      ok: true,
      quests,
      resetsAt,
      coins,
    };
  } catch (err) {
    return {
      ok: false,
      quests: [],
      resetsAt: getNextMidnightIso(),
      error: err instanceof Error ? err.message : 'Có lỗi khi tải nhiệm vụ.',
    };
  }
}

export const getDailyQuestsViaRpc = fetchDailyQuestsFromSupabase;

/**
 * Gọi RPC `claim_daily_coins()`:
 * Nút "Nhận quà mỗi ngày (+10 Xu)".
 * Lỗi `already_claimed` thì báo "Hôm nay bạn nhận rồi, mai quay lại nhé".
 */
export async function claimDailyCoinsViaRpc(): Promise<{
  ok: boolean;
  alreadyClaimed?: boolean;
  notLoggedIn?: boolean;
  coins?: number;
  reward?: number;
  message: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user?.id) {
      return {
        ok: false,
        notLoggedIn: true,
        message: 'Mời bạn đăng nhập để điểm danh nhận quà mỗi ngày nhé 🌸',
      };
    }

    const { data, error } = await supabase.rpc('claim_daily_coins');

    if (error) {
      const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
      if (msg.includes('already_claimed') || msg.includes('hôm nay bạn nhận rồi') || msg.includes('already')) {
        return {
          ok: false,
          alreadyClaimed: true,
          message: 'Hôm nay bạn nhận rồi, mai quay lại nhé',
        };
      }
      if (msg.includes('not_logged_in') || msg.includes('permission denied') || error.code === '42501') {
        return {
          ok: false,
          notLoggedIn: true,
          message: 'Mời bạn đăng nhập để điểm danh nhận quà mỗi ngày nhé 🌸',
        };
      }
      return {
        ok: false,
        message: error.message || 'Không thể nhận quà lúc này, bạn thử lại sau nhé.',
      };
    }

    let newCoins: number | undefined;
    let reward = 10;
    if (typeof data === 'number') {
      newCoins = data;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (obj.already_claimed) {
        return {
          ok: false,
          alreadyClaimed: true,
          message: 'Hôm nay bạn nhận rồi, mai quay lại nhé',
        };
      }
      if (typeof obj.coins === 'number') newCoins = obj.coins;
      if (typeof obj.reward === 'number') reward = obj.reward;
    }

    if (newCoins === undefined) {
      newCoins = await fetchMyCoinsFromSupabase();
    }

    return {
      ok: true,
      coins: newCoins,
      reward,
      message: `🎉 Điểm danh thành công! Bạn nhận được +${reward} Xu.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg.toLowerCase().includes('already_claimed')) {
      return {
        ok: false,
        alreadyClaimed: true,
        message: 'Hôm nay bạn nhận rồi, mai quay lại nhé',
      };
    }
    return {
      ok: false,
      message: msg || 'Không thể điểm danh lúc này.',
    };
  }
}

/**
 * Gọi RPC `complete_quest(p_index)`
 * Lỗi `already_done` thì bỏ qua nhẹ nhàng.
 */
export async function completeQuestViaRpc(
  p_index: number
): Promise<{
  ok: boolean;
  alreadyDone?: boolean;
  notLoggedIn?: boolean;
  reward?: number;
  coins?: number;
  message?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user?.id) {
      return {
        ok: false,
        notLoggedIn: true,
        message: 'Mời bạn đăng nhập để nhận thưởng nhiệm vụ nhé 🌸',
      };
    }

    const { data, error } = await supabase.rpc('complete_quest', {
      p_index,
    });

    if (error) {
      const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
      if (msg.includes('already_done') || msg.includes('already') || msg.includes('đã hoàn thành')) {
        return {
          ok: true,
          alreadyDone: true,
          message: 'Nhiệm vụ này đã hoàn thành rồi.',
        };
      }
      if (msg.includes('not_logged_in') || error.code === '42501') {
        return {
          ok: false,
          notLoggedIn: true,
          message: 'Mời bạn đăng nhập để nhận thưởng nhé 🌸',
        };
      }
      return {
        ok: false,
        message: error.message || 'Không thể hoàn thành nhiệm vụ.',
      };
    }

    let coins: number | undefined;
    let reward = 5;

    if (typeof data === 'number') {
      coins = data;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (obj.already_done) {
        return {
          ok: true,
          alreadyDone: true,
          message: 'Nhiệm vụ này đã hoàn thành rồi.',
        };
      }
      if (typeof obj.coins === 'number') coins = obj.coins;
      if (typeof obj.reward === 'number') reward = obj.reward;
    }

    if (coins === undefined) {
      coins = await fetchMyCoinsFromSupabase();
    }

    return {
      ok: true,
      alreadyDone: false,
      reward,
      coins,
      message: `✨ Đã hoàn thành nhiệm vụ! Nhận +${reward} Xu.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg.toLowerCase().includes('already_done')) {
      return {
        ok: true,
        alreadyDone: true,
        message: 'Nhiệm vụ này đã hoàn thành.',
      };
    }
    return {
      ok: false,
      message: msg || 'Không thể hoàn thành nhiệm vụ.',
    };
  }
}

/**
 * Gọi RPC `buy_item(p_kind)`:
 * Thành công: trả về vật phẩm với tên do server cấp, hoa/cá cần 30 phút để lớn (ready_at).
 * Lỗi `not_enough_coins`: báo "Chưa đủ Xu, làm nhiệm vụ để kiếm thêm nhé".
 */
export async function buyItemViaRpc(
  kind: ItemCategory
): Promise<{
  ok: boolean;
  notEnoughCoins?: boolean;
  notLoggedIn?: boolean;
  disabled?: boolean;
  item?: DbInventoryRow;
  coins?: number;
  message: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user?.id) {
      return {
        ok: false,
        notLoggedIn: true,
        message: 'Mời bạn đăng nhập để mua vật phẩm tại Chợ nhỏ nhé 🌸',
      };
    }

    const { data, error } = await supabase.rpc('buy_item', {
      p_kind: kind,
    });

    if (error) {
      const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
      if (
        msg.includes('not_enough_coins') ||
        msg.includes('insufficient') ||
        msg.includes('không đủ xu') ||
        msg.includes('chưa đủ xu')
      ) {
        return {
          ok: false,
          notEnoughCoins: true,
          message: 'Chưa đủ Xu, làm nhiệm vụ để kiếm thêm nhé',
        };
      }
      if (msg.includes('not_logged_in') || error.code === '42501') {
        return {
          ok: false,
          notLoggedIn: true,
          message: 'Mời bạn đăng nhập để mua vật phẩm tại Chợ nhỏ nhé 🌸',
        };
      }
      if (msg.includes('disabled') || msg.includes('ngưng') || msg.includes('not available')) {
        return {
          ok: false,
          disabled: true,
          message: 'Món này hiện đang tạm ngưng bán tại Chợ nhỏ.',
        };
      }
      return {
        ok: false,
        message: error.message || 'Chưa thể mua vật phẩm lúc này.',
      };
    }

    let updatedCoins: number | undefined;
    let createdItem: DbInventoryRow | undefined;

    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (obj.not_enough_coins) {
        return {
          ok: false,
          notEnoughCoins: true,
          message: 'Chưa đủ Xu, làm nhiệm vụ để kiếm thêm nhé',
        };
      }
      if (typeof obj.coins === 'number') updatedCoins = obj.coins;
      if (obj.item && typeof obj.item === 'object') {
        const it = obj.item as Record<string, unknown>;
        createdItem = {
          id: String(it.id || `item_${Date.now()}`),
          user_id: String(it.user_id || ''),
          item_type: String(it.kind || it.item_type || kind),
          item_name: String(it.name || it.item_name || 'Vật phẩm Chợ nhỏ'),
          rarity: String(it.rarity || 'common'),
          ready_at: it.ready_at ? String(it.ready_at) : null,
          created_at: String(it.created_at || new Date().toISOString()),
          count: Number(it.count) || 1,
        };
      } else if (obj.name || obj.item_name || obj.id) {
        createdItem = {
          id: String(obj.id || `item_${Date.now()}`),
          user_id: String(obj.user_id || ''),
          item_type: String(obj.kind || obj.item_type || kind),
          item_name: String(obj.name || obj.item_name || 'Vật phẩm Chợ nhỏ'),
          rarity: String(obj.rarity || 'common'),
          ready_at: obj.ready_at ? String(obj.ready_at) : null,
          created_at: String(obj.created_at || new Date().toISOString()),
          count: Number(obj.count) || 1,
        };
      }
    }

    // Nếu RPC không trả trực tiếp item, ta tải lại kho đồ và lấy item mới nhất
    if (!createdItem) {
      const inv = await fetchMyInventoryFromSupabase();
      createdItem = inv[0];
    }

    if (updatedCoins === undefined) {
      updatedCoins = await fetchMyCoinsFromSupabase();
    }

    return {
      ok: true,
      coins: updatedCoins,
      item: createdItem,
      message: `✨ Chúc mừng bạn đã mua thành công "${createdItem?.item_name || 'Vật phẩm'}"!`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg.toLowerCase().includes('not_enough_coins')) {
      return {
        ok: false,
        notEnoughCoins: true,
        message: 'Chưa đủ Xu, làm nhiệm vụ để kiếm thêm nhé',
      };
    }
    return {
      ok: false,
      message: msg || 'Chưa thể mua vật phẩm lúc này.',
    };
  }
}

/**
 * Gọi RPC `sell_item(p_item)` để bán lại vật phẩm trong kho lấy Xu
 */
export async function sellItemViaRpc(
  itemId: string
): Promise<{
  ok: boolean;
  notLoggedIn?: boolean;
  coins?: number;
  message: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user?.id) {
      return {
        ok: false,
        notLoggedIn: true,
        message: 'Mời bạn đăng nhập để bán vật phẩm nhé 🌸',
      };
    }

    const { data, error } = await supabase.rpc('sell_item', {
      p_item: itemId,
    });

    if (error) {
      return {
        ok: false,
        message: error.message || 'Không thể bán vật phẩm lúc này.',
      };
    }

    let updatedCoins: number | undefined;
    if (typeof data === 'number') {
      updatedCoins = data;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (typeof obj.coins === 'number') updatedCoins = obj.coins;
    }

    if (updatedCoins === undefined) {
      updatedCoins = await fetchMyCoinsFromSupabase();
    }

    return {
      ok: true,
      coins: updatedCoins,
      message: '✨ Đã bán vật phẩm và nhận Xu thành công!',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Có lỗi khi bán vật phẩm.',
    };
  }
}

// ============================================================================
// HỆ THỐNG PHÁT SỰ KIỆN HÀNH ĐỘNG GAME ĐỂ TỰ ĐỘNG HOÀN THÀNH NHIỆM VỤ
// ============================================================================

export type GameQuestAction =
  | 'water'
  | 'fish'
  | 'gift_drink'
  | 'gift_flower'
  | 'chat_companion'
  | 'feed_pet'
  | 'gacha'
  | 'love_letter'
  | 'buy_market';

type GameQuestActionListener = (action: GameQuestAction) => void;
const questActionListeners = new Set<GameQuestActionListener>();

export function onGameQuestAction(listener: GameQuestActionListener): () => void {
  questActionListeners.add(listener);
  return () => {
    questActionListeners.delete(listener);
  };
}

export function emitGameQuestAction(action: GameQuestAction): void {
  questActionListeners.forEach((fn) => {
    try {
      fn(action);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Kiểm tra xem tên nhiệm vụ có khớp với hành động người chơi vừa thực hiện không
 */
export function doesQuestMatchAction(
  questTitle: string,
  action: GameQuestAction
): boolean {
  const t = questTitle.toLowerCase();
  switch (action) {
    case 'water':
      return (
        t.includes('tưới') ||
        t.includes('vườn') ||
        t.includes('trồng cây') ||
        t.includes('gieo') ||
        t.includes('chăm cây') ||
        t.includes('hoa')
      );
    case 'fish':
      return (
        t.includes('cá') ||
        t.includes('câu') ||
        t.includes('hồ cá') ||
        t.includes('cho cá') ||
        t.includes('thả cá')
      );
    case 'gift_drink':
      return (
        t.includes('nước') ||
        t.includes('thức uống') ||
        t.includes('trà') ||
        t.includes('cà phê') ||
        t.includes('pha') ||
        t.includes('tặng nước') ||
        t.includes('quầy')
      );
    case 'gift_flower':
      return (
        t.includes('tặng hoa') ||
        t.includes('hoa') ||
        t.includes('quà') ||
        t.includes('tặng')
      );
    case 'chat_companion':
      return (
        t.includes('trò chuyện') ||
        t.includes('tâm sự') ||
        t.includes('tri kỷ') ||
        t.includes('chào') ||
        t.includes('nói chuyện') ||
        t.includes('thăm')
      );
    case 'feed_pet':
      return (
        t.includes('thú') ||
        t.includes('pet') ||
        t.includes('mèo') ||
        t.includes('cún') ||
        t.includes('cho thú') ||
        t.includes('chăm thú')
      );
    case 'gacha':
      return (
        t.includes('gacha') ||
        t.includes('mở quà') ||
        t.includes('hộp quà') ||
        t.includes('quay')
      );
    case 'love_letter':
      return (
        t.includes('thư') ||
        t.includes('lời nhắn') ||
        t.includes('yêu thương') ||
        t.includes('gửi lời') ||
        t.includes('feedback') ||
        t.includes('nhắn')
      );
    case 'buy_market':
      return (
        t.includes('chợ') ||
        t.includes('mua') ||
        t.includes('sắm') ||
        t.includes('cửa hàng')
      );
    default:
      return false;
  }
}

