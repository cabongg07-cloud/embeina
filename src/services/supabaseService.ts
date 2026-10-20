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
    const displayName = prof?.display_name || 'Creator';
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
      tags: collectedTags.length > 0 ? collectedTags : ['Đời thường', 'Chữa lành'],
      socials: [],
    };
  });

  const characters: CharacterItem[] = charRows.map((row, idx) => {
    const creatorProf = profileMap.get(row.creator_id);
    const creatorName = creatorProf?.display_name || 'Creator';
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
        hintText = `⏳ Bạn đang có ${ownedPendingCount} vật phẩm cùng loại đang đếm ngược chờ nở/lớn trong Kho đồ. Hãy đợi đếm ngược xong nhé!`;
      } else {
        hintText =
          '🌸 Hãy mở Gacha mỗi ngày ở tab Mini game để sưu tầm thêm vật phẩm vào Kho đồ nhé!';
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
  ownerId: string,
  reqData: Omit<CharacterRequest, 'id'>
): Promise<void> {
  const { error } = await supabase.from('requests').insert({
    owner_id: ownerId,
    data: reqData,
  });
  if (error) {
    throw new Error(error.message || 'Không thể gửi Request lên Supabase.');
  }
}

export async function updateRequestOnSupabase(
  id: string,
  reqData: Partial<CharacterRequest>,
  existingFull: CharacterRequest
): Promise<void> {
  const merged = { ...existingFull, ...reqData };
  const { error } = await supabase
    .from('requests')
    .update({ data: merged })
    .eq('id', id);
  if (error) {
    throw new Error(error.message || 'Không thể cập nhật Request trên Supabase.');
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
        });
      }
    }
  );

  return { personalPrompts, sharedPrompts };
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
