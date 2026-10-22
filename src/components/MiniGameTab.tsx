import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles,
  Droplets,
  Flower2,
  Fish,
  Coffee,
  Heart,
  Gift,
  MessageCircle,
  Plus,
  Package,
  ShoppingBag,
  CheckCircle2,
  Clock,
  PawPrint,
  RefreshCw,
  Coins,
  Store,
  X,
  Lock,
} from 'lucide-react';
import {
  CharacterItem,
} from '../data/sampleData';
import { AuthUser, can } from '../services/authLayer';
import { EditableText } from './EditableText';
import {
  DbInventoryRow,
  SupabaseInventoryItem,
  SupabaseGardenPlotRow,
  SupabasePondFishRow,
  SupabaseBrewOrderRow,
  BrewRecipePayload,
  DailyStatusData,
  fetchDailyStatusViaRpc,
  getNextVietnam7AmIso,
  rollGachaOnSupabase,
  fetchMyCoinsFromSupabase,
  fetchMyProfileGameStatsFromSupabase,
  fetchMarketPricesFromSupabase,
  claimDailyCoinsViaRpc,
  getDailyQuestsViaRpc,
  completeQuestViaRpc,
  buyItemViaRpc,
  sellItemViaRpc,
  plantSeedViaRpc,
  harvestPlotViaRpc,
  buyPlotViaRpc,
  fetchPondFishFromSupabase,
  fishCastViaRpc,
  fishCatchViaRpc,
  releaseFishViaRpc,
  takeOutFishViaRpc,
  fetchBrewOrdersFromSupabase,
  brewStartViaRpc,
  brewCollectViaRpc,
  fetchCharSecretOnDemand,
  MarketPriceRow,
  DailyQuestItem,
  DEFAULT_MARKET_PRICES,
  emitGameQuestAction,
  logGameActionViaRpc,
  onQuestActionLogged,
  getQuestHintForAction,
  ownerRefillViaRpc,
} from '../services/supabaseService';
import {
  GeneratedGameItem,
  ItemCategory,
  ItemRarity,
  GardenStage,
  CompanionRoomState,
  RARITY_LABELS,
  CATEGORY_LABELS,
  GARDEN_STAGE_NAMES,
  formatSeedName,
  formatFlowerNameFromSeed,
  getCompanionRoomState,
  saveCompanionRoomState,
} from '../services/itemSystem';
import {
  TagVoiceProfile,
  TagPetProfile,
  DialogueSituation,
  DEFAULT_TAG_VOICES,
  DEFAULT_TAG_PETS,
  AddressKeywordRule,
  DEFAULT_ADDRESS_MAP,
  resolveAddress,
  generateCompanionDialogueByTags,
  generateCompanionPetComment,
  resolveBlendedVoicesForCharacter,
  getPersistedTraitForPet,
  selectPetTraitForCompanionTags,
  persistTraitForPet,
  sanitizePetVibeNote,
} from '../services/tagCompanionSystem';
import {
  DEFAULT_GACHA_DAILY_DESC,
  DEFAULT_MARKET_TEXTS,
  MarketTextsConfig,
  getSiteConfig,
} from '../services/siteSettings';
import { ProceduralItemSvg, renderItem } from './ProceduralItemSvg';

const PET_CARE_STORAGE_KEY = 'pet_care_stats_by_id_v1';

interface PetCareStat {
  fullness: number;
  happiness: number;
  updatedAt: number;
}

function loadPetCareStatsMap(): Record<string, PetCareStat> {
  try {
    const raw = localStorage.getItem(PET_CARE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePetCareStatsMap(map: Record<string, PetCareStat>): void {
  try {
    localStorage.setItem(PET_CARE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export type ExtendedGameItem = GeneratedGameItem & {
  seed: string;
};

function mapDbInvRowToGameItem(
  row: DbInventoryRow & { meta?: Record<string, unknown> | null },
  companionCharTags: string[] = ['Dịu dàng'],
  customPets: TagPetProfile[] = DEFAULT_TAG_PETS,
  companionCharName?: string
): ExtendedGameItem {
  const rawType = String(row.kind || row.item_type || 'flower').toLowerCase();
  const category: ItemCategory =
    rawType === 'seed' || rawType === 'hat_giong' || rawType === 'hạt giống'
      ? 'seed'
      : rawType === 'fish' || rawType === 'ca' || rawType === 'cá'
      ? 'fish'
      : rawType === 'pet' || rawType === 'thu_cung' || rawType === 'thú cưng' || rawType === 'thú'
      ? 'pet'
      : rawType === 'drink' || rawType === 'thuc_uong' || rawType === 'thức uống' || rawType === 'nước'
      ? 'drink'
      : 'flower';
  const rawRarity = String(row.rarity || 'common').toLowerCase();
  const rarity: ItemRarity =
    rawRarity === 'legendary' || rawRarity === 'hiếm' || rawRarity === 'hiem' || rawRarity === 'epic' || rawRarity === 'ssr'
      ? 'legendary'
      : rawRarity === 'rare' || rawRarity === 'quý' || rawRarity === 'quy' || rawRarity === 'sr'
      ? 'rare'
      : 'common';

  const rawName = String(row.name || row.item_name || 'Vật phẩm bí ẩn');
  const displayName = category === 'seed' ? formatSeedName(rawName) : rawName;
  const seedStr = String(row.seed || rawName || row.id);
  const hashKey = `${category === 'seed' ? 'flower' : category}_${seedStr}`;

  let h = 2166136261;
  for (let i = 0; i < hashKey.length; i++) {
    h ^= hashKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const absH = Math.abs(h);
  const palettes = [
    { primary: '#F4A9B8', secondary: '#FDE2E8', accent: '#FFE599' },
    { primary: '#B39DDB', secondary: '#EDE7F6', accent: '#FFD54F' },
    { primary: '#81D4FA', secondary: '#E1F5FE', accent: '#FFF59D' },
    { primary: '#A5D6A7', secondary: '#E8F5E9', accent: '#FFE082' },
    { primary: '#FFCC80', secondary: '#FFF3E0', accent: '#F48FB1' },
  ];
  const pal = palettes[absH % palettes.length];
  const metaObj =
    row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : null;
  const metaColor =
    metaObj && typeof metaObj.color === 'string' && metaObj.color.trim()
      ? metaObj.color.trim()
      : null;

  if (category === 'pet') {
    let petTrait = getPersistedTraitForPet(row.id, displayName, customPets);
    if (!petTrait) {
      petTrait = selectPetTraitForCompanionTags(companionCharTags, customPets);
      persistTraitForPet(row.id, displayName, petTrait);
    }
    const cleanVibe = sanitizePetVibeNote(
      petTrait.vibeReason,
      petTrait.matchedTag,
      petTrait.petSpecies,
      companionCharName
    );
    return {
      id: row.id,
      name: displayName,
      seed: seedStr,
      category,
      rarity,
      visual: {
        primaryColor: row.color || pal.primary,
        secondaryColor: pal.secondary,
        accentColor: pal.accent,
        shapeVariant: absH % 6,
        patternVariant: (absH >> 3) % 5,
        petalOrFinCount: 5 + (absH % 6),
        hasSparkle: rarity !== 'common',
      },
      createdAt: row.created_at || new Date().toISOString(),
      description: cleanVibe,
      petSpecies: petTrait.petSpecies,
      matchedTag: petTrait.matchedTag,
      vibeReason: cleanVibe,
      petPersonality: petTrait.personality,
      petBehaviorStyle: petTrait.behaviorStyle,
      petSound: petTrait.sound,
      readyAt: row.ready_at || null,
      meta: metaObj,
    };
  }

  let drinkDesc = `Vật phẩm ${CATEGORY_LABELS[category].name} thuộc phẩm cấp ${RARITY_LABELS[rarity]} được lưu trữ trong Kho đồ.`;
  if (category === 'drink' && metaObj) {
    const parts = [
      typeof metaObj.base === 'string' ? `Nền: ${metaObj.base}` : '',
      typeof metaObj.flavor === 'string' ? `Hương: ${metaObj.flavor}` : '',
      typeof metaObj.topping === 'string' ? `Topping: ${metaObj.topping}` : '',
    ].filter(Boolean);
    if (parts.length > 0) {
      drinkDesc = `Công thức pha chế: ${parts.join(' · ')}`;
    }
  }

  return {
    id: row.id,
    name: displayName,
    seed: seedStr,
    category,
    rarity,
    visual: {
      primaryColor: metaColor || row.color || pal.primary,
      secondaryColor: pal.secondary,
      accentColor: pal.accent,
      shapeVariant: absH % 6,
      patternVariant: (absH >> 3) % 5,
      petalOrFinCount: 5 + (absH % 6),
      hasSparkle: rarity !== 'common',
    },
    createdAt: row.created_at || new Date().toISOString(),
    description: drinkDesc,
    readyAt: row.ready_at || null,
    meta: metaObj,
  };
}

interface MiniGameTabProps {
  characters: CharacterItem[];
  petalsBalance: number;
  onAddPetals: (amount: number) => void;
  currentUser?: AuthUser;
  onRequireAuth?: (reason: string) => void;
  editMode?: boolean;
  currencyName?: string;
  currencyEmoji?: string;
  coinCurrencyName?: string;
  coinCurrencyEmoji?: string;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
  onInventoryChange?: (rows: DbInventoryRow[]) => void;
  supabaseInventory?: SupabaseInventoryItem[];
  gardenPlots?: SupabaseGardenPlotRow[];
  profilePlots?: number;
  inventoryLoading?: boolean;
  inventoryError?: string | null;
  onRefreshInventory?: () => Promise<void>;
  onOptimisticAddInventoryItem?: (item: SupabaseInventoryItem) => void;
  tagVoices?: TagVoiceProfile[];
  tagPets?: TagPetProfile[];
  initialSubZone?: string;
  initialTargetKind?: string;
  unlockedCharIds?: string[];
  marketTexts?: MarketTextsConfig;
  addressMap?: AddressKeywordRule[];
}

type MiniZone = 'market' | 'gacha_inv' | 'garden' | 'pond' | 'companion' | 'drinks';

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '00:00';
  const totalSec = Math.ceil(msRemaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function computePlotGardenStage(
  plantedAtIso: string | undefined,
  nowMs: number
): {
  stage: GardenStage;
  isBloomed: boolean;
  remainingMs: number;
  progressPercent: number;
} {
  const TOTAL_GROW_MS = 30 * 60 * 1000; // 30 phút
  const STAGE_MS = 6 * 60 * 1000; // 6 phút mỗi giai đoạn
  if (!plantedAtIso) {
    return { stage: 0, isBloomed: false, remainingMs: TOTAL_GROW_MS, progressPercent: 0 };
  }
  const plantedMs = new Date(plantedAtIso).getTime();
  if (Number.isNaN(plantedMs)) {
    return { stage: 0, isBloomed: false, remainingMs: TOTAL_GROW_MS, progressPercent: 0 };
  }
  const bloomMs = plantedMs + TOTAL_GROW_MS;
  if (nowMs >= bloomMs) {
    return { stage: 4, isBloomed: true, remainingMs: 0, progressPercent: 100 };
  }
  const elapsedMs = Math.max(0, nowMs - plantedMs);
  const remainingMs = Math.max(0, bloomMs - nowMs);
  const progressPercent = Math.min(99, Math.round((elapsedMs / TOTAL_GROW_MS) * 100));
  if (elapsedMs < STAGE_MS) {
    return { stage: 0, isBloomed: false, remainingMs, progressPercent }; // Hạt giống (0-6p)
  }
  if (elapsedMs < STAGE_MS * 2) {
    return { stage: 1, isBloomed: false, remainingMs, progressPercent }; // Nảy mầm (6-12p)
  }
  if (elapsedMs < STAGE_MS * 3) {
    return { stage: 2, isBloomed: false, remainingMs, progressPercent }; // Cây con (12-18p)
  }
  return { stage: 3, isBloomed: false, remainingMs, progressPercent }; // Kết nụ (18-30p)
}

export const MiniGameTab: React.FC<MiniGameTabProps> = ({
  characters,
  petalsBalance,
  onAddPetals,
  currentUser,
  onRequireAuth,
  editMode = false,
  currencyName = 'Cánh hoa',
  currencyEmoji = '🌸',
  coinCurrencyName = 'Xu',
  coinCurrencyEmoji = '🪙',
  customTexts = {},
  onUpdateCustomText,
  supabaseInventory = [],
  gardenPlots = [],
  profilePlots = 10,
  inventoryLoading = false,
  inventoryError = null,
  onRefreshInventory,
  onOptimisticAddInventoryItem,
  tagVoices,
  tagPets,
  initialSubZone,
  initialTargetKind,
  unlockedCharIds = [],
  marketTexts: marketTextsProp,
  addressMap: addressMapProp,
}) => {
  const canEdit = Boolean(editMode && can('edit', currentUser));
  const isOwner = Boolean(currentUser?.profileRole === 'owner');

  const effectiveMarketTexts = useMemo<MarketTextsConfig>(
    () => ({
      ...DEFAULT_MARKET_TEXTS,
      ...(getSiteConfig().marketTexts || {}),
      ...(marketTextsProp || {}),
    }),
    [marketTextsProp]
  );

  const effectiveAddressMap = useMemo<AddressKeywordRule[]>(
    () =>
      addressMapProp && addressMapProp.length > 0
        ? addressMapProp
        : getSiteConfig().addressMap || DEFAULT_ADDRESS_MAP,
    [addressMapProp]
  );

  // Điều hướng 6 khu vực trong Mini Game (bao gồm Chợ Nhỏ)
  const [activeZone, setActiveZone] = useState<MiniZone>(() =>
    initialSubZone === 'market'
      ? 'market'
      : initialSubZone === 'garden'
      ? 'garden'
      : 'gacha_inv'
  );

  // Gọi refreshInventory() mỗi khi mở từng tab con (activeZone)
  useEffect(() => {
    onRefreshInventory?.();
  }, [activeZone, onRefreshInventory]);

  useEffect(() => {
    if (isOwner) {
      ownerRefillViaRpc()
        .then((res) => {
          if (res.ok && typeof res.coins === 'number') {
            setCoins(res.coins);
          }
          onRefreshInventory?.();
        })
        .catch(() => {});
    }
  }, [isOwner, activeZone, onRefreshInventory]);

  const effectiveTagVoices = useMemo(
    () =>
      tagVoices && tagVoices.length > 0
        ? tagVoices
        : getSiteConfig().tagVoices || DEFAULT_TAG_VOICES,
    [tagVoices]
  );

  const effectiveTagPets = useMemo(
    () =>
      tagPets && tagPets.length > 0
        ? tagPets
        : getSiteConfig().tagPets || DEFAULT_TAG_PETS,
    [tagPets]
  );

  // ============================================================================
  // STATE DAILY STATUS (daily_status RPC), CHỢ NHỎ, XU & NHIỆM VỤ NGÀY (RESET 7:00 SÁNG VN)
  // ============================================================================
  const [dailyStatus, setDailyStatus] = useState<DailyStatusData>(() => ({
    day: new Date().toISOString().slice(0, 10),
    resets_at: getNextVietnam7AmIso(),
    checked_in: false,
    rolled: false,
    casts_used: 0,
    brews_used: 0,
  }));
  const [checkInJustSparkled, setCheckInJustSparkled] = useState(false);

  const [coins, setCoins] = useState<number>(0);
  const [marketPrices, setMarketPrices] = useState<MarketPriceRow[]>(DEFAULT_MARKET_PRICES);
  const [dailyQuests, setDailyQuests] = useState<DailyQuestItem[]>([]);
  const [resetsAtIso, setResetsAtIso] = useState<string>(() => getNextVietnam7AmIso());
  const [questCountdownStr, setQuestCountdownStr] = useState<string>('00:00:00');
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [isBuyingKind, setIsBuyingKind] = useState<string | null>(null);
  const [isSellingItemId, setIsSellingItemId] = useState<string | null>(null);
  const [boughtItemModal, setBoughtItemModal] = useState<{
    item: ExtendedGameItem;
    kind: ItemCategory;
    buyPrice: number;
    message: string;
  } | null>(null);
  const [itemToSellConfirm, setItemToSellConfirm] = useState<{
    item: ExtendedGameItem;
    price: number;
  } | null>(null);
  const [questSparkleEffect, setQuestSparkleEffect] = useState<{
    questTitle: string;
    reward: number;
  } | null>(null);

  // Đánh dấu món vừa nhận ("Mới") trong phiên hiện tại
  const [newlyReceivedIds, setNewlyReceivedIds] = useState<Set<string>>(() => new Set());
  // Ghi nhận hiệu ứng tưới nước cho ô vườn trong phiên
  const [wateredPlotSlots, setWateredPlotSlots] = useState<Set<number>>(() => new Set());
  // Trạng thái Vườn hoa mới: Hộp chọn gieo hạt, Kết quả thu hoạch, Mua thêm ô vườn
  const [localPlotsCount, setLocalPlotsCount] = useState<number>(profilePlots || 10);
  useEffect(() => {
    if (typeof profilePlots === 'number' && profilePlots >= 10) {
      setLocalPlotsCount(profilePlots);
    }
  }, [profilePlots]);
  const [plantingModal, setPlantingModal] = useState<{
    slot: number;
    preselectedSeedId?: string | null;
    insufficientCoinsDiff?: number | null;
    errorMsg?: string | null;
  } | null>(null);
  const [isPlantingSeed, setIsPlantingSeed] = useState<boolean>(false);
  const [harvestingSlot, setHarvestingSlot] = useState<number | null>(null);
  const [harvestResultModal, setHarvestResultModal] = useState<{
    flowerItem: ExtendedGameItem;
    slot: number;
  } | null>(null);
  const [isBuyingPlot, setIsBuyingPlot] = useState<boolean>(false);
  const [newlyBoughtPlotSlot, setNewlyBoughtPlotSlot] = useState<number | null>(null);
  const [plotBuyShortfallDiff, setPlotBuyShortfallDiff] = useState<number | null>(null);

  // Ghi nhận các ly nước đã tặng trong phiên (ẩn khỏi quầy thức uống, không tự xóa khỏi kho server)
  const [giftedDrinkIds, setGiftedDrinkIds] = useState<Set<string>>(() => new Set());
  // Chỉ số độ no / niềm vui của thú cưng lưu phụ ở localStorage theo pet.id
  const [petCareMap, setPetCareMap] = useState<Record<string, PetCareStat>>(() =>
    loadPetCareStatsMap()
  );
  // Chỉ số chăm cá trong hồ theo fish.id
  const [fishCareMap, setFishCareMap] = useState<
    Record<string, { fullUntil: number; xp: number; pendingPetals: number }>
  >({});

  // Đồng hồ thời gian thực (cập nhật mỗi giây cho Kho đồ, Vườn hoa & Hồ cá)
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // State chính: Phòng tri kỷ
  const [roomState, setRoomState] = useState<CompanionRoomState>(() =>
    getCompanionRoomState(characters[0]?.id || 'char-ta-khanh-inh')
  );

  const companionChar = useMemo(
    () =>
      characters.find((c) => c.id === roomState?.companionCharId) ||
      characters[0],
    [characters, roomState?.companionCharId]
  );

  // NGUỒN DUY NHẤT: Tất cả vật phẩm đọc trực tiếp từ supabaseInventory
  const inventory = useMemo<ExtendedGameItem[]>(() => {
    const charTagsForPet = companionChar?.tags || ['Dịu dàng'];
    return (supabaseInventory || []).map((item) => {
      const dbRow: DbInventoryRow & { meta?: Record<string, unknown> | null } = {
        id: item.id,
        user_id: '',
        kind: item.kind || item.category,
        item_type: item.kind || item.category,
        name: item.name,
        item_name: item.name,
        rarity: item.rarity,
        seed: item.seed || `${item.name}_${item.id}`,
        ready_at: item.readyAt,
        created_at: item.createdAt,
        count: item.count,
        meta: item.meta || null,
      };
      return mapDbInvRowToGameItem(
        dbRow,
        charTagsForPet,
        effectiveTagPets,
        companionChar?.name
      );
    });
  }, [supabaseInventory, companionChar?.tags, companionChar?.name, effectiveTagPets]);

  // Phân loại từ nguồn duy nhất inventory (Hạt giống kind='seed' tách riêng với Hoa đã nở kind='flower')
  const ownedSeeds = useMemo(
    () => inventory.filter((i) => i.category === 'seed'),
    [inventory]
  );
  const ownedFlowers = useMemo(
    () => inventory.filter((i) => i.category === 'flower'),
    [inventory]
  );
  const ownedFish = useMemo(
    () => inventory.filter((i) => i.category === 'fish'),
    [inventory]
  );
  const ownedPets = useMemo(
    () => inventory.filter((i) => i.category === 'pet'),
    [inventory]
  );
  const ownedDrinks = useMemo(
    () => inventory.filter((i) => i.category === 'drink'),
    [inventory]
  );
  const barDrinks = useMemo(
    () => ownedDrinks.filter((d) => !giftedDrinkIds.has(d.id)),
    [ownedDrinks, giftedDrinkIds]
  );

  // Ánh xạ các ô vườn đang trồng từ bảng garden_plots
  const plantedBySlot = useMemo(() => {
    const map = new Map<number, SupabaseGardenPlotRow>();
    for (const row of gardenPlots || []) {
      map.set(Number(row.slot), row);
    }
    return map;
  }, [gardenPlots]);

  const plantedSlotBySeedId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of gardenPlots || []) {
      if (row.seed_id) {
        map.set(String(row.seed_id), Number(row.slot));
      }
    }
    return map;
  }, [gardenPlots]);

  const unplantedSeeds = useMemo(
    () => ownedSeeds.filter((s) => !plantedSlotBySeedId.has(s.id)),
    [ownedSeeds, plantedSlotBySeedId]
  );

  const effectivePlotsCount = Math.max(
    10,
    Math.min(40, localPlotsCount || profilePlots || 10)
  );

  const emptySlots = useMemo(() => {
    const list: number[] = [];
    for (let s = 0; s < effectivePlotsCount; s++) {
      if (!plantedBySlot.has(s)) {
        list.push(s);
      }
    }
    return list;
  }, [effectivePlotsCount, plantedBySlot]);

  // Trạng thái Gacha & Kho đồ
  const [isRollingGacha, setIsRollingGacha] = useState(false);
  const [lastGachaResult, setLastGachaResult] = useState<{
    item: ExtendedGameItem;
    destinationNote: string;
  } | null>(null);
  const [invCategoryFilter, setInvCategoryFilter] = useState<
    'all' | ItemCategory
  >('all');
  const [invRarityFilter, setInvRarityFilter] = useState<'all' | ItemRarity>(
    'all'
  );
  const [invSearch, setInvSearch] = useState('');

  // Thông báo nhẹ nhàng trong Mini game
  const [gameToast, setGameToast] = useState<string | null>(null);
  const [activePetSpeech, setActivePetSpeech] = useState<{
    petId: string;
    text: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setGameToast(msg);
    setTimeout(() => {
      setGameToast((prev) => (prev === msg ? null : prev));
    }, 4200);
  };

  // Open Scene chỉ giữ trong RAM khi nhân vật đồng hành đã mở khóa hoặc là Chủ web (TUYỆT ĐỐI không lưu vào localStorage)
  const [inMemoryCompanionOpenScene, setInMemoryCompanionOpenScene] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const charId = companionChar?.id;
    if (!charId) {
      setInMemoryCompanionOpenScene(null);
      return;
    }
    const isUnlocked = isOwner || unlockedCharIds.includes(charId);
    if (!isUnlocked) {
      setInMemoryCompanionOpenScene(null);
      return;
    }
    fetchCharSecretOnDemand(charId)
      .then((secret) => {
        if (!active) return;
        setInMemoryCompanionOpenScene(secret?.openScene || null);
      })
      .catch(() => {
        if (active) setInMemoryCompanionOpenScene(null);
      });
    return () => {
      active = false;
    };
  }, [companionChar?.id, isOwner, unlockedCharIds]);

  // Cặp xưng hô (xưng, gọi) tính từ resolveAddress(companionChar)
  const companionAddressPair = useMemo(
    () =>
      resolveAddress(companionChar, {
        inMemoryOpenScene: inMemoryCompanionOpenScene,
        addressMap: effectiveAddressMap,
      }),
    [companionChar, inMemoryCompanionOpenScene, effectiveAddressMap]
  );

  // Giọng văn kết hợp từ 2-3 tag đầu của nhân vật đang đồng hành
  const companionBlendedVoices = useMemo(
    () =>
      resolveBlendedVoicesForCharacter(
        companionChar?.tags || ['Dịu dàng'],
        effectiveTagVoices
      ),
    [companionChar?.tags, effectiveTagVoices]
  );

  const [activeDialogueText, setActiveDialogueText] = useState<string>(() => {
    const firstChar =
      characters.find((c) => c.id === roomState.companionCharId) ||
      characters[0];
    const initialPair = resolveAddress(firstChar, {
      addressMap: effectiveAddressMap,
    });
    return generateCompanionDialogueByTags({
      charTags: firstChar?.tags || ['Dịu dàng'],
      situation: 'greeting',
      bondPoints: roomState.bondPoints,
      customVoices: effectiveTagVoices,
      addressPair: initialPair,
      charName: firstChar?.name,
    }).text;
  });

  // Lời nhận xét riêng của nhân vật đồng hành về thú cưng ở Khu thú cưng
  const [companionPetComment, setCompanionPetComment] = useState<string>('');

  useEffect(() => {
    if (!companionChar) return;
    const firstPet = ownedPets[0];
    setCompanionPetComment(
      generateCompanionPetComment({
        char: companionChar,
        petName: firstPet?.name || 'bé thú nhỏ',
        petSpecies: firstPet?.petSpecies,
        action: 'select',
        bondPoints: roomState.bondPoints,
        inMemoryOpenScene: inMemoryCompanionOpenScene,
        addressMap: effectiveAddressMap,
        customVoices: effectiveTagVoices,
      }).text
    );
  }, [
    companionChar,
    ownedPets,
    roomState.bondPoints,
    inMemoryCompanionOpenScene,
    effectiveAddressMap,
    effectiveTagVoices,
  ]);

  const todayStr = dailyStatus.day || new Date().toISOString().slice(0, 10);
  // Gacha miễn phí hôm nay chỉ dựa vào daily_status().rolled từ server
  const hasFreeGachaToday = !dailyStatus.rolled;

  const loadDailyStatus = useCallback(async () => {
    if (!currentUser || currentUser.role === 'guest' || !currentUser.id) {
      const nextReset = getNextVietnam7AmIso();
      setDailyStatus({
        day: new Date().toISOString().slice(0, 10),
        resets_at: nextReset,
        checked_in: false,
        rolled: false,
        casts_used: 0,
        brews_used: 0,
      });
      setResetsAtIso(nextReset);
      return;
    }
    const res = await fetchDailyStatusViaRpc();
    setDailyStatus(res.status);
    if (res.status.resets_at) {
      setResetsAtIso(res.status.resets_at);
    }
  }, [currentUser]);

  const refreshSupabaseInventoryAndRoll = useCallback(async () => {
    const [, profileStats] = await Promise.all([
      onRefreshInventory ? onRefreshInventory() : Promise.resolve(),
      fetchMyProfileGameStatsFromSupabase(),
      loadDailyStatus(),
    ]);
    setCoins(profileStats.coins);
    if (profileStats.plots >= 10) {
      setLocalPlotsCount(profileStats.plots);
    }
  }, [onRefreshInventory, loadDailyStatus]);

  useEffect(() => {
    refreshSupabaseInventoryAndRoll();
  }, [refreshSupabaseInventoryAndRoll]);

  const loadMarketDataAndCoins = useCallback(async () => {
    const [prices, profileStats] = await Promise.all([
      fetchMarketPricesFromSupabase(),
      fetchMyProfileGameStatsFromSupabase(),
      loadDailyStatus(),
    ]);
    setMarketPrices(prices);
    setCoins(profileStats.coins);
    if (profileStats.plots >= 10) {
      setLocalPlotsCount(profileStats.plots);
    }

    if (currentUser && currentUser.role !== 'guest' && currentUser.id) {
      const qRes = await getDailyQuestsViaRpc();
      if (qRes.ok) {
        setDailyQuests(qRes.quests);
        if (qRes.resetsAt) {
          setResetsAtIso(qRes.resetsAt);
        }
        if (typeof qRes.coins === 'number') {
          setCoins(qRes.coins);
        }
      }
    } else {
      setDailyQuests([
        { index: 0, id: 1, title: 'Tưới nước cho Vườn hoa ban mai', reward: 6, completed: false, action: 'water', target: 2, progress: 0 },
        { index: 1, id: 2, title: 'Mở Phòng tri kỷ ghé thăm người thương', reward: 5, completed: false, action: 'visit_room', target: 1, progress: 0 },
        { index: 2, id: 3, title: 'Lắng nghe trọn vẹn một bản nhạc êm', reward: 8, completed: false, action: 'listen_song', target: 1, progress: 0 },
      ]);
      setResetsAtIso(getNextVietnam7AmIso());
    }
  }, [currentUser, loadDailyStatus]);

  const loadDailyQuests = useCallback(async () => {
    if (!currentUser || currentUser.role === 'guest' || !currentUser.id) return;
    try {
      const qRes = await getDailyQuestsViaRpc();
      if (qRes.ok) {
        setDailyQuests(qRes.quests);
        if (qRes.resetsAt) setResetsAtIso(qRes.resetsAt);
        if (typeof qRes.coins === 'number') {
          setCoins(qRes.coins);
        }
      }
    } catch {
      // Bỏ qua lỗi
    }
  }, [currentUser]);

  useEffect(() => {
    loadMarketDataAndCoins();
  }, [loadMarketDataAndCoins]);

  // Gọi daily_status() khi mở tab Mini game/Chợ hoặc đổi sub-tab
  useEffect(() => {
    loadDailyStatus();
    if (activeZone === 'market') {
      loadMarketDataAndCoins();
    }
  }, [activeZone, loadDailyStatus, loadMarketDataAndCoins]);

  useEffect(() => {
    const unsub = onQuestActionLogged(() => {
      loadDailyQuests();
    });
    return unsub;
  }, [loadDailyQuests]);

  useEffect(() => {
    if (activeZone !== 'market') return;
    if (!currentUser || currentUser.role === 'guest' || !currentUser.id) return;
    const interval = setInterval(() => {
      loadDailyQuests();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeZone, currentUser, loadDailyQuests]);

  // Đồng hồ đếm ngược đến resets_at (7:00 sáng giờ Việt Nam); về 0 tự gọi lại get_daily_quests & daily_status
  useEffect(() => {
    const targetIso = dailyStatus.resets_at || resetsAtIso || getNextVietnam7AmIso();
    let refreshedOnZero = false;

    const tickCountdown = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) {
        setQuestCountdownStr('00:00:00');
        if (!refreshedOnZero) {
          refreshedOnZero = true;
          loadDailyStatus();
          loadDailyQuests();
          loadMarketDataAndCoins();
        }
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      setQuestCountdownStr(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    tickCountdown();
    const timer = setInterval(tickCountdown, 1000);
    return () => clearInterval(timer);
  }, [dailyStatus.resets_at, resetsAtIso, loadDailyStatus, loadDailyQuests, loadMarketDataAndCoins]);

  useEffect(() => {
    if (initialSubZone === 'garden') {
      setActiveZone('garden');
    } else if (initialSubZone === 'market') {
      setActiveZone('market');
      if (initialTargetKind) {
        setTimeout(() => {
          const targetEl = document.getElementById(`market-card-${initialTargetKind}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.add('ring-4', 'ring-[var(--accent)]');
            setTimeout(() => {
              targetEl.classList.remove('ring-4', 'ring-[var(--accent)]');
            }, 3000);
          }
        }, 250);
      }
    }
  }, [initialSubZone, initialTargetKind]);

  // Điểm danh chỉ gọi khi người chơi bấm nút; trạng thái lấy từ daily_status()
  const handleClaimDailyCoins = async () => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.(`Mời bạn đăng nhập để điểm danh nhận +10 ${coinCurrencyName} mỗi ngày nhé 🌸`);
      return;
    }
    if (isClaimingDaily || dailyStatus.checked_in) return;
    setIsClaimingDaily(true);
    try {
      const res = await claimDailyCoinsViaRpc();
      if (res.ok) {
        setCheckInJustSparkled(true);
        setTimeout(() => setCheckInJustSparkled(false), 4500);
        if (typeof res.coins === 'number') {
          setCoins(res.coins);
        } else {
          const c = await fetchMyCoinsFromSupabase();
          setCoins(c);
        }
        await loadDailyStatus();
        showToast(res.message);
      } else if (res.alreadyClaimed) {
        // Nếu rpc báo already_claimed thì gọi lại daily_status rồi hiện đúng trạng thái theo server, không tự bịa thông báo
        await loadDailyStatus();
      } else {
        await loadDailyStatus();
        showToast(res.message);
      }
    } finally {
      setIsClaimingDaily(false);
    }
  };

  const [isClaimingQuestIndex, setIsClaimingQuestIndex] = useState<number | null>(null);

  const handleClaimQuestReward = async (index: number) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.(`Mời bạn đăng nhập để làm nhiệm vụ và nhận ${coinCurrencyName} nhé 🌸`);
      return;
    }
    const targetQuest = dailyQuests[index];
    if (!targetQuest) return;

    if (targetQuest.completed) {
      showToast('Nhiệm vụ này đã nhận thưởng rồi nè ✨');
      return;
    }

    const target = Math.max(1, targetQuest.target || 1);
    const progress = targetQuest.progress || 0;
    if (progress < target) {
      const hint = getQuestHintForAction(targetQuest.action, targetQuest.title);
      showToast(`Bạn chưa làm xong nhiệm vụ này nhé (${progress}/${target}). ${hint}`);
      return;
    }

    setIsClaimingQuestIndex(index);
    try {
      const res = await completeQuestViaRpc(index);
      if (res.ok) {
        if (!res.alreadyDone) {
          setQuestSparkleEffect({
            questTitle: targetQuest.title,
            reward: res.reward ?? targetQuest.reward,
          });
          setTimeout(() => setQuestSparkleEffect(null), 4000);
          showToast(`✨ Đã nhận thưởng "${targetQuest.title}"! Nhận +${res.reward ?? targetQuest.reward} ${coinCurrencyName}!`);
        } else {
          showToast('Nhiệm vụ này đã nhận thưởng rồi nè ✨');
        }
        if (typeof res.coins === 'number') {
          setCoins(res.coins);
        } else {
          const c = await fetchMyCoinsFromSupabase();
          setCoins(c);
        }
        await loadDailyQuests();
      } else {
        if (res.notFinished) {
          const hint = getQuestHintForAction(targetQuest.action, targetQuest.title);
          showToast(`Bạn chưa làm xong nhiệm vụ này nhé. ${hint}`);
        } else if (res.alreadyDone) {
          showToast('Nhiệm vụ này đã nhận thưởng rồi nè ✨');
        } else if (res.notLoggedIn) {
          onRequireAuth?.(`Mời bạn đăng nhập để nhận thưởng nhé 🌸`);
        } else {
          showToast(res.message || 'Chưa thể nhận thưởng nhiệm vụ lúc này.');
        }
      }
    } finally {
      setIsClaimingQuestIndex(null);
    }
  };

  // Mua vật phẩm ở Chợ: cập nhật lạc quan ngay + gọi refreshInventory()
  const handleBuyMarketItem = async (kind: ItemCategory) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.(`Mời bạn đăng nhập để mua vật phẩm tại Chợ nhỏ nhé 🌸`);
      return;
    }
    if (isBuyingKind) return;
    setIsBuyingKind(kind);
    try {
      const res = await buyItemViaRpc(kind);
      if (res.ok) {
        if (typeof res.coins === 'number') {
          setCoins(res.coins);
        } else {
          const c = await fetchMyCoinsFromSupabase();
          setCoins(c);
        }
        if (res.normalizedItem) {
          onOptimisticAddInventoryItem?.(res.normalizedItem);
          setNewlyReceivedIds((prev) => {
            const next = new Set(prev);
            next.add(res.normalizedItem!.id);
            return next;
          });
        }
        await refreshSupabaseInventoryAndRoll();

        if (res.item) {
          const mapped = mapDbInvRowToGameItem(
            res.item,
            companionChar?.tags || ['Dịu dàng'],
            effectiveTagPets
          );
          const priceRow = marketPrices.find((p) => p.kind === kind);
          setBoughtItemModal({
            item: mapped,
            kind,
            buyPrice: priceRow?.buy_price || 5,
            message: res.message,
          });
        } else {
          showToast(res.message);
        }
        emitGameQuestAction('buy_market');
      } else {
        showToast(res.message);
      }
    } finally {
      setIsBuyingKind(null);
    }
  };

  const handleSellItem = async (item: ExtendedGameItem) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.(`Mời bạn đăng nhập để bán vật phẩm nhé 🌸`);
      return;
    }
    if (isSellingItemId) return;
    setIsSellingItemId(item.id);
    try {
      const res = await sellItemViaRpc(item.id);
      if (res.ok) {
        if (typeof res.coins === 'number') {
          setCoins(res.coins);
        } else {
          const c = await fetchMyCoinsFromSupabase();
          setCoins(c);
        }
        showToast(res.message);
        setItemToSellConfirm(null);
        await refreshSupabaseInventoryAndRoll();
      } else {
        showToast(res.message);
      }
    } finally {
      setIsSellingItemId(null);
    }
  };

  // Helper đánh dấu hoàn thành nhiệm vụ nhỏ mỗi ngày để nhận Cánh hoa
  const markDailyTaskReady = (taskKey: string) => {
    setRoomState((prev) => {
      if (prev.completedDailyTasks[`${taskKey}_done`] === todayStr) {
        return prev;
      }
      const next: CompanionRoomState = {
        ...prev,
        completedDailyTasks: {
          ...prev.completedDailyTasks,
          [`${taskKey}_done`]: todayStr,
        },
      };
      saveCompanionRoomState(next);
      return next;
    });
  };

  const handleClaimDailyTaskReward = (taskKey: string, reward: number, label: string) => {
    const claimedKey = `${taskKey}_claimed`;
    if (roomState.completedDailyTasks[claimedKey] === todayStr) return;
    onAddPetals(reward);
    const next: CompanionRoomState = {
      ...roomState,
      completedDailyTasks: {
        ...roomState.completedDailyTasks,
        [claimedKey]: todayStr,
      },
    };
    setRoomState(next);
    saveCompanionRoomState(next);
    showToast(`🎉 Đã nhận +${reward} ${currencyName} từ nhiệm vụ "${label}"!`);
  };

  // ============================================================================
  // 1. XỬ LÝ GACHA MỖI NGÀY: Dùng daily_status().rolled + Gọi rpc roll_gacha trên Supabase
  // ============================================================================
  const handleRollGacha = async () => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để mở Gacha và nhận quà mỗi ngày nhé 🌸');
      return;
    }
    if (isRollingGacha) return;
    if (!hasFreeGachaToday) {
      showToast('Hôm nay bạn đã mở quà rồi, 7 giờ sáng mai có lượt miễn phí mới nhé');
      return;
    }

    setIsRollingGacha(true);
    setLastGachaResult(null);

    try {
      const res = await rollGachaOnSupabase();
      if (!res.ok) {
        await loadDailyStatus();
        if (res.errorCode === 'already_rolled') {
          showToast('Hôm nay bạn đã mở quà rồi, 7 giờ sáng mai có lượt miễn phí mới nhé');
        } else {
          showToast(res.message);
        }
        return;
      }

      markDailyTaskReady('gacha');

      if (res.normalizedItem) {
        onOptimisticAddInventoryItem?.(res.normalizedItem);
        setNewlyReceivedIds((prev) => {
          const next = new Set(prev);
          next.add(res.normalizedItem!.id);
          return next;
        });
      }

      await refreshSupabaseInventoryAndRoll();

      if (res.item) {
        const newItem = mapDbInvRowToGameItem(
          res.item,
          companionChar?.tags || ['Dịu dàng'],
          effectiveTagPets,
          companionChar?.name
        );
        let destinationNote = 'Đã cất vào Kho đồ ✨';
        if (newItem.category === 'seed' || newItem.category === 'flower') {
          destinationNote = 'Đã cất vào Kho đồ ✨ Hãy đem gieo vào ô Vườn hoa để nở thành Hoa nhé!';
        } else if (newItem.category === 'fish') {
          destinationNote = 'Đã cất vào Kho đồ ✨ Hãy ghé Hồ cá để thả bé xuống hồ nhé!';
        } else if (newItem.category === 'pet') {
          destinationNote = 'Đã cất vào Kho đồ ✨ & đón thú cưng về Khu thú cưng!';
        } else if (newItem.category === 'drink') {
          destinationNote = 'Đã cất vào Kho đồ ✨ & treo lên kệ tại Quầy pha chế!';
        }
        setLastGachaResult({ item: newItem, destinationNote });
        emitGameQuestAction('gacha');
        showToast(
          `🎉 Bạn nhận được ${
            newItem.category === 'seed' || newItem.category === 'flower'
              ? formatSeedName(newItem.name)
              : newItem.name
          } (${RARITY_LABELS[newItem.rarity]})!`
        );
      } else {
        showToast(`🎉 ${res.message}`);
      }
    } finally {
      setIsRollingGacha(false);
    }
  };

  // ============================================================================
  // 2. XỬ LÝ VƯỜN HOA THEO Ô (HẠT GIỐNG → GIEO VÀO Ô → CHỜ NỞ 30 PHÚT → THU HOẠCH)
  // ============================================================================
  const handleGoToDailyQuests = () => {
    setPlantingModal(null);
    setPlotBuyShortfallDiff(null);
    setCastShortfallDiff(null);
    setBrewShortfallDiff(null);
    setConfirmPaidCastModal(false);
    setActiveZone('market');
    setTimeout(() => {
      const questSection = document.getElementById('daily-quests-section');
      if (questSection) {
        questSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  const handleOpenPlantModalForSeed = (seedId?: string | null, preferredSlot?: number) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để gieo hạt trong Vườn hoa nhé 🌱');
      return;
    }
    setActiveZone('garden');
    const chosenSlot =
      typeof preferredSlot === 'number'
        ? preferredSlot
        : emptySlots.length > 0
        ? emptySlots[0]
        : 0;
    setPlantingModal({
      slot: chosenSlot,
      preselectedSeedId: seedId || null,
      insufficientCoinsDiff: null,
      errorMsg: null,
    });
  };

  const handlePlantSeedInSlot = async (slot: number, itemId: string | null) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để gieo hạt trong Vườn hoa nhé 🌱');
      return;
    }
    if (isPlantingSeed) return;

    // Kiểm tra Xu nếu gieo hạt ngẫu nhiên (3 Xu, Chủ web miễn phí)
    if (itemId === null && !isOwner && coins < 3) {
      const diff = Math.max(1, 3 - coins);
      setPlantingModal((prev) =>
        prev
          ? {
              ...prev,
              slot,
              insufficientCoinsDiff: diff,
              errorMsg: `Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`,
            }
          : null
      );
      return;
    }

    setIsPlantingSeed(true);
    setPlantingModal((prev) =>
      prev ? { ...prev, insufficientCoinsDiff: null, errorMsg: null } : null
    );
    try {
      const res = await plantSeedViaRpc(slot, itemId);
      if (!res.ok) {
        if (res.errorCode === 'not_enough_coins') {
          const diff = Math.max(1, 3 - coins);
          setPlantingModal((prev) =>
            prev
              ? {
                  ...prev,
                  insufficientCoinsDiff: diff,
                  errorMsg: `Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`,
                }
              : null
          );
        } else {
          setPlantingModal((prev) =>
            prev ? { ...prev, errorMsg: res.message } : null
          );
          showToast(res.message);
        }
        return;
      }

      await refreshSupabaseInventoryAndRoll();
      setPlantingModal(null);
      showToast(res.message);
    } finally {
      setIsPlantingSeed(false);
    }
  };

  const handleWaterGardenPlot = (slot: number, flowerName: string) => {
    setWateredPlotSlots((prev) => {
      const next = new Set(prev);
      next.add(slot);
      return next;
    });
    markDailyTaskReady('water');
    emitGameQuestAction('water');
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('water');
    }
    showToast(`💧 Đã tưới làn nước mát lành cho ô #${slot + 1} (${flowerName})!`);
  };

  const handleHarvestGardenPlot = async (
    slot: number,
    seedItem?: ExtendedGameItem
  ) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để thu hoạch hoa nhé 🌸');
      return;
    }
    if (harvestingSlot !== null) return;
    setHarvestingSlot(slot);
    try {
      const res = await harvestPlotViaRpc(slot);
      if (!res.ok) {
        showToast(res.message);
        return;
      }

      // Gọi log_action('harvest') sau mỗi lần thu hoạch
      await logGameActionViaRpc('harvest');
      emitGameQuestAction('water');

      if (res.harvestedItem) {
        onOptimisticAddInventoryItem?.(res.harvestedItem);
        setNewlyReceivedIds((prev) => {
          const next = new Set(prev);
          next.add(res.harvestedItem!.id);
          return next;
        });
      }

      await refreshSupabaseInventoryAndRoll();

      const harvestedFlower: ExtendedGameItem = res.harvestedItem
        ? mapDbInvRowToGameItem(
            {
              id: res.harvestedItem.id,
              user_id: '',
              kind: 'flower',
              item_type: 'flower',
              name: res.harvestedItem.name,
              item_name: res.harvestedItem.name,
              rarity: res.harvestedItem.rarity,
              seed: res.harvestedItem.seed,
              ready_at: null,
              created_at: res.harvestedItem.createdAt,
            },
            companionChar?.tags || ['Dịu dàng'],
            effectiveTagPets,
            companionChar?.name
          )
        : {
            id: seedItem?.id || `harvested-${slot}-${Date.now()}`,
            name: formatFlowerNameFromSeed(seedItem?.name || 'Hoa Ban Mai'),
            seed: seedItem?.seed || `plot_${slot}`,
            category: 'flower',
            rarity: seedItem?.rarity || 'common',
            visual: seedItem?.visual || {
              primaryColor: '#F4A9B8',
              secondaryColor: '#FDE2E8',
              accentColor: '#FFE599',
              shapeVariant: 0,
              patternVariant: 0,
              petalOrFinCount: 6,
              hasSparkle: false,
            },
            createdAt: new Date().toISOString(),
            description: 'Hoa vừa thu hoạch từ Vườn hoa.',
            readyAt: null,
          };

      setHarvestResultModal({
        flowerItem: {
          ...harvestedFlower,
          category: 'flower',
          name: formatFlowerNameFromSeed(harvestedFlower.name),
        },
        slot,
      });
    } finally {
      setHarvestingSlot(null);
    }
  };

  const handleBuyExtraPlot = async () => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để mở rộng Vườn hoa nhé 🌱');
      return;
    }
    if (isBuyingPlot) return;
    if (effectivePlotsCount >= 40) {
      showToast('🌸 Vườn hoa đã đạt tối đa 40 ô rồi nhé!');
      return;
    }

    const cost = 20 + (effectivePlotsCount - 10) * 10;
    if (!isOwner && coins < cost) {
      const diff = Math.max(1, cost - coins);
      setPlotBuyShortfallDiff(diff);
      showToast(`Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`);
      return;
    }

    setPlotBuyShortfallDiff(null);
    setIsBuyingPlot(true);
    try {
      const res = await buyPlotViaRpc();
      if (!res.ok) {
        if (res.errorCode === 'not_enough_coins') {
          const diff = Math.max(1, cost - coins);
          setPlotBuyShortfallDiff(diff);
          showToast(`Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`);
        } else {
          showToast(res.message);
        }
        return;
      }

      const nextPlots =
        typeof res.plots === 'number' && res.plots > effectivePlotsCount
          ? res.plots
          : Math.min(40, effectivePlotsCount + 1);
      setLocalPlotsCount(nextPlots);
      if (typeof res.coins === 'number') {
        setCoins(res.coins);
      }
      setNewlyBoughtPlotSlot(nextPlots - 1);
      setTimeout(() => {
        setNewlyBoughtPlotSlot((prev) => (prev === nextPlots - 1 ? null : prev));
      }, 4500);

      await refreshSupabaseInventoryAndRoll();
      showToast(res.message);
    } finally {
      setIsBuyingPlot(false);
    }
  };

  // ============================================================================
  // 3. XỬ LÝ HỒ CÁ: CÂU CÁ (fish_cast / fish_catch) & THẢ CÁ VÀO HỒ (pond_fish)
  // ============================================================================
  const [pondFishRows, setPondFishRows] = useState<SupabasePondFishRow[]>([]);
  const [pondLoading, setPondLoading] = useState(false);
  const [releaseFishModalOpen, setReleaseFishModalOpen] = useState(false);
  const [selectedFishIdsToRelease, setSelectedFishIdsToRelease] = useState<string[]>([]);
  const [isReleasingFish, setIsReleasingFish] = useState(false);
  const [takingOutFishId, setTakingOutFishId] = useState<string | null>(null);
  const [pondSplashEffect, setPondSplashEffect] = useState<boolean>(false);

  const loadPondFish = useCallback(async () => {
    if (!currentUser || currentUser.role === 'guest' || !currentUser.id) {
      setPondFishRows([]);
      return;
    }
    setPondLoading(true);
    try {
      const rows = await fetchPondFishFromSupabase();
      setPondFishRows(rows);
    } finally {
      setPondLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadPondFish();
  }, [loadPondFish]);

  useEffect(() => {
    if (activeZone === 'pond') {
      loadPondFish();
    }
  }, [activeZone, loadPondFish]);

  const pondFishIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of pondFishRows) {
      if (r.fish_id) s.add(String(r.fish_id));
    }
    return s;
  }, [pondFishRows]);

  // Hồ chỉ hiện cá có trong bảng pond_fish (join với inventory qua fish_id)
  const pondFishItems = useMemo(
    () => ownedFish.filter((f) => pondFishIdSet.has(f.id)),
    [ownedFish, pondFishIdSet]
  );

  // Cá trong Kho đồ (kind='fish') chưa có trong pond_fish
  const unreleasedFishItems = useMemo(
    () => ownedFish.filter((f) => !pondFishIdSet.has(f.id)),
    [ownedFish, pondFishIdSet]
  );

  // Trạng thái câu cá tương tác 5 giây
  const freeCastsLeft = Math.max(0, 5 - (dailyStatus?.casts_used || 0));
  const [fishingPhase, setFishingPhase] = useState<
    'idle' | 'dropping' | 'active' | 'catching' | 'missed'
  >('idle');
  const [fishingSession, setFishingSession] = useState<string | null>(null);
  const [fishingStartMs, setFishingStartMs] = useState<number>(0);
  const [fishingRemainingMs, setFishingRemainingMs] = useState<number>(5000);
  const [fishingBoxX, setFishingBoxX] = useState<number>(45);
  const [fishingBoxY, setFishingBoxY] = useState<number>(52);
  const fishingDirRef = useRef<number>(1);
  const fishingSpeedRef = useRef<number>(2.1);
  const fishingSessionRef = useRef<string | null>(null);
  const fishingHandledRef = useRef<boolean>(false);
  const [confirmPaidCastModal, setConfirmPaidCastModal] = useState<boolean>(false);
  const [castShortfallDiff, setCastShortfallDiff] = useState<number | null>(null);
  const [fishingResultModal, setFishingResultModal] = useState<{
    item: ExtendedGameItem;
  } | null>(null);
  const [fishingMissMessage, setFishingMissMessage] = useState<string | null>(null);

  const handleBuyFishFood = () => {
    const cost = 8;
    if (!isOwner && petalsBalance < cost) {
      showToast(`Bạn cần ${cost} ${currencyName} để mua túi 3 Hạt cá nhé 🌸`);
      return;
    }
    onAddPetals(-cost);
    const nextRoom = {
      ...roomState,
      fishFoodCount: roomState.fishFoodCount + 3,
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);
    showToast('🐟 Đã mua +3 Hạt cá dinh dưỡng!');
  };

  const handleFeedFish = (fish: ExtendedGameItem) => {
    if (roomState.fishFoodCount <= 0) {
      showToast(
        'Bạn đã hết Hạt cá rồi! Hãy bấm nút "Mua Hạt cá" ngay phía trên hồ nhé 🐟'
      );
      return;
    }

    const now = Date.now();
    const nextRoom = {
      ...roomState,
      fishFoodCount: roomState.fishFoodCount - 1,
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);

    setFishCareMap((prev) => {
      const cur = prev[fish.id] || { fullUntil: 0, xp: 10, pendingPetals: 0 };
      return {
        ...prev,
        [fish.id]: {
          fullUntil: now + 3 * 60 * 1000,
          xp: cur.xp + 20,
          pendingPetals: cur.pendingPetals + 2,
        },
      };
    });

    markDailyTaskReady('feed_fish');
    emitGameQuestAction('fish');
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('feed_fish');
    }
    showToast(`🐟 Đã cho "${fish.name}" ăn Hạt cá! Chú cá quẫy đuôi vui vẻ ✨`);
  };

  // Bắt đầu thả cần câu (gọi sau khi bấm nút hoặc xác nhận tốn 5 Xu)
  const executeFishingCast = async () => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để thả cần câu ở Hồ cá nhé 🎣');
      return;
    }
    if (fishingPhase !== 'idle' && fishingPhase !== 'missed') return;

    setConfirmPaidCastModal(false);
    setCastShortfallDiff(null);
    setFishingMissMessage(null);
    setFishingPhase('dropping');

    // Hoạt ảnh thả dây câu xuống nước ~1 giây + vòng sóng lan, ngay khi hộp quà hiện ra mới gọi fish_cast()
    setTimeout(async () => {
      const res = await fishCastViaRpc();
      if (!res.ok || !res.session) {
        setFishingPhase('idle');
        if (res.errorCode === 'not_enough_coins') {
          const diff = Math.max(1, 5 - coins);
          setCastShortfallDiff(diff);
          showToast(`Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`);
        } else {
          showToast(res.message || 'Không thể thả cần câu lúc này.');
        }
        await loadDailyStatus();
        return;
      }

      if (typeof res.cost === 'number' && res.cost > 0) {
        const c = await fetchMyCoinsFromSupabase();
        setCoins(c);
      }
      setDailyStatus((prev) => ({
        ...prev,
        casts_used:
          typeof res.casts_used === 'number' ? res.casts_used : prev.casts_used + 1,
      }));

      fishingSessionRef.current = res.session;
      fishingHandledRef.current = false;
      setFishingSession(res.session);
      const start = Date.now();
      setFishingStartMs(start);
      setFishingRemainingMs(5000);
      setFishingBoxX(25 + Math.random() * 45);
      setFishingBoxY(38 + Math.random() * 28);
      fishingDirRef.current = Math.random() > 0.5 ? 1 : -1;
      fishingSpeedRef.current = 1.8 + Math.random() * 1.6;
      setFishingPhase('active');
    }, 950);
  };

  const handleClickCastButton = () => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để thả cần câu ở Hồ cá nhé 🎣');
      return;
    }
    if (fishingPhase === 'dropping' || fishingPhase === 'active' || fishingPhase === 'catching') {
      return;
    }
    if (freeCastsLeft <= 0 && !isOwner) {
      if (coins < 5) {
        const diff = Math.max(1, 5 - coins);
        setCastShortfallDiff(diff);
        showToast(`Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`);
        return;
      }
      setConfirmPaidCastModal(true);
      return;
    }
    executeFishingCast();
  };

  // Xử lý khi hết 5 giây hoặc bấm trượt hộp quà
  const handleFishingMiss = useCallback(
    async (sessionToClose: string) => {
      if (fishingHandledRef.current) return;
      fishingHandledRef.current = true;
      setFishingPhase('missed');
      setFishingMissMessage('Hụt mất quà rồi, thử lại nhé 🥺');
      setTimeout(() => {
        setFishingPhase((p) => (p === 'missed' ? 'idle' : p));
      }, 2800);
      try {
        await fishCatchViaRpc(sessionToClose, false);
        await loadDailyStatus();
        await loadDailyQuests();
      } catch {
        // ignore
      }
    },
    [loadDailyStatus, loadDailyQuests]
  );

  // Xử lý khi người chơi bấm trúng hộp quà 🎁 trong 5 giây
  const handleFishingCatchSuccess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const activeSession = fishingSessionRef.current || fishingSession;
    if (!activeSession || fishingPhase !== 'active' || fishingHandledRef.current) {
      return;
    }
    fishingHandledRef.current = true;
    setFishingPhase('catching');

    try {
      const res = await fishCatchViaRpc(activeSession, true);
      if (!res.ok || res.missed) {
        setFishingPhase('missed');
        setFishingMissMessage('Hụt mất quà rồi, thử lại nhé 🥺');
        setTimeout(() => {
          setFishingPhase((p) => (p === 'missed' ? 'idle' : p));
        }, 2600);
        await loadDailyStatus();
        return;
      }

      if (res.item) {
        onOptimisticAddInventoryItem?.(res.item);
        setNewlyReceivedIds((prev) => {
          const next = new Set(prev);
          next.add(res.item!.id);
          return next;
        });
      }

      await refreshSupabaseInventoryAndRoll();
      await loadDailyQuests();
      setFishingPhase('idle');

      if (res.item) {
        const dbRow: DbInventoryRow & { meta?: Record<string, unknown> | null } = {
          id: res.item.id,
          user_id: '',
          kind: res.item.kind || res.item.category,
          item_type: res.item.kind || res.item.category,
          name: res.item.name,
          item_name: res.item.name,
          rarity: res.item.rarity,
          seed: res.item.seed || `${res.item.name}_${res.item.id}`,
          ready_at: res.item.readyAt,
          created_at: res.item.createdAt,
          count: res.item.count,
          meta: res.item.meta || null,
        };
        const caughtItem = mapDbInvRowToGameItem(
          dbRow,
          companionChar?.tags || ['Dịu dàng'],
          effectiveTagPets,
          companionChar?.name
        );
        setFishingResultModal({ item: caughtItem });
      } else {
        showToast(res.message);
      }
    } catch {
      setFishingPhase('idle');
    }
  };

  // Hiệu ứng hộp quà 🎁 chạy qua lại ngẫu nhiên + đếm ngược 5 giây
  useEffect(() => {
    if (fishingPhase !== 'active' || !fishingStartMs) return;

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - fishingStartMs;
      const remain = Math.max(0, 5000 - elapsed);
      setFishingRemainingMs(remain);

      if (remain <= 0) {
        window.clearInterval(interval);
        const sess = fishingSessionRef.current;
        if (sess) {
          handleFishingMiss(sess);
        }
        return;
      }

      // Đổi tốc độ/hướng nhẹ ngẫu nhiên
      if (Math.random() < 0.14) {
        fishingDirRef.current = -fishingDirRef.current;
      }
      if (Math.random() < 0.22) {
        fishingSpeedRef.current = 1.5 + Math.random() * 2.4;
      }

      setFishingBoxX((prevX) => {
        let nextX = prevX + fishingDirRef.current * fishingSpeedRef.current;
        if (nextX <= 12) {
          nextX = 12;
          fishingDirRef.current = 1;
        } else if (nextX >= 82) {
          nextX = 82;
          fishingDirRef.current = -1;
        }
        return nextX;
      });

      setFishingBoxY((prevY) => {
        const wave = Math.sin(Date.now() / 240) * 1.4;
        return Math.max(26, Math.min(72, prevY + wave));
      });
    }, 60);

    return () => window.clearInterval(interval);
  }, [fishingPhase, fishingStartMs, handleFishingMiss]);

  // Thả 1 hoặc nhiều cá từ Kho đồ vào hồ (release_fish)
  const handleReleaseSelectedFish = async (fishIds: string[]) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để thả cá vào hồ nhé 🐟');
      return;
    }
    if (fishIds.length === 0 || isReleasingFish) return;
    setIsReleasingFish(true);
    try {
      let successCount = 0;
      for (const id of fishIds) {
        const res = await releaseFishViaRpc(id);
        if (res.ok) successCount++;
      }
      await Promise.all([loadPondFish(), refreshSupabaseInventoryAndRoll()]);
      setReleaseFishModalOpen(false);
      setSelectedFishIdsToRelease([]);
      if (successCount > 0) {
        setPondSplashEffect(true);
        setTimeout(() => setPondSplashEffect(false), 2600);
        showToast(
          `💦 Đã thả ${successCount} chú cá xuống Hồ cá đêm! Nước bắn tung tóe mát lành ✨`
        );
      }
    } finally {
      setIsReleasingFish(false);
    }
  };

  // Nhấc cá từ hồ về Kho đồ (take_out_fish)
  const handleTakeOutFish = async (fish: ExtendedGameItem) => {
    if (!currentUser || currentUser.role === 'guest') return;
    if (takingOutFishId) return;
    setTakingOutFishId(fish.id);
    try {
      const res = await takeOutFishViaRpc(fish.id);
      if (res.ok) {
        await Promise.all([loadPondFish(), refreshSupabaseInventoryAndRoll()]);
        showToast(`🐟 Đã nhấc "${fish.name}" lên cất lại vào Kho đồ!`);
      } else {
        showToast(res.message);
      }
    } finally {
      setTakingOutFishId(null);
    }
  };

  const handleCollectFishPetals = (fish: ExtendedGameItem) => {
    const care = fishCareMap[fish.id];
    if (!care || care.pendingPetals <= 0) return;
    const amount = care.pendingPetals;
    onAddPetals(amount);
    setFishCareMap((prev) => ({
      ...prev,
      [fish.id]: {
        ...care,
        pendingPetals: 0,
      },
    }));
    emitGameQuestAction('fish');
    showToast(
      `✨ Đã nhận +${amount} ${currencyName} từ chú cá "${fish.name}"!`
    );
  };

  // ============================================================================
  // 4. XỬ LÝ PHÒNG TRI KỶ, KHU THÚ CƯNG & QUẦY PHA CHẾ
  // ============================================================================
  const triggerCompanionDialogue = useCallback(
    (
      situation: DialogueSituation,
      options?: {
        charTagsOverride?: string[];
        bondOverride?: number;
        itemName?: string;
        charOverride?: CharacterItem;
      }
    ) => {
      const targetChar = options?.charOverride || companionChar;
      const tagsToUse =
        options?.charTagsOverride || targetChar?.tags || ['Dịu dàng'];
      const bondToUse =
        options?.bondOverride !== undefined
          ? options.bondOverride
          : roomState.bondPoints;
      const pairToUse = options?.charOverride
        ? resolveAddress(options.charOverride, {
            addressMap: effectiveAddressMap,
          })
        : companionAddressPair;

      const generated = generateCompanionDialogueByTags({
        charTags: tagsToUse,
        situation,
        bondPoints: bondToUse,
        itemName: options?.itemName,
        customVoices: effectiveTagVoices,
        previousText: activeDialogueText,
        addressPair: pairToUse,
        charName: targetChar?.name,
        inMemoryOpenScene: options?.charOverride
          ? null
          : inMemoryCompanionOpenScene,
      });
      setActiveDialogueText(generated.text);
    },
    [
      companionChar,
      roomState.bondPoints,
      effectiveTagVoices,
      activeDialogueText,
      companionAddressPair,
      effectiveAddressMap,
      inMemoryCompanionOpenScene,
    ]
  );

  // Tự động cập nhật câu chào khi cặp xưng hô hoặc Open Scene trong RAM vừa nạp xong
  useEffect(() => {
    if (!companionChar) return;
    const generated = generateCompanionDialogueByTags({
      charTags: companionChar.tags || ['Dịu dàng'],
      situation: 'greeting',
      bondPoints: roomState.bondPoints,
      customVoices: effectiveTagVoices,
      addressPair: companionAddressPair,
      charName: companionChar.name,
      inMemoryOpenScene: inMemoryCompanionOpenScene,
    });
    setActiveDialogueText(generated.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionChar?.id, companionAddressPair.self, companionAddressPair.user, inMemoryCompanionOpenScene]);

  const handleSelectCompanionChar = (charId: string) => {
    const next = { ...roomState, companionCharId: charId };
    setRoomState(next);
    saveCompanionRoomState(next);
    const found = characters.find((c) => c.id === charId);
    if (found) {
      triggerCompanionDialogue('greeting', {
        charTagsOverride: found.tags,
        bondOverride: next.bondPoints,
        charOverride: found,
      });
    }
  };

  const handleChatWithCompanion = (
    situation: DialogueSituation = 'chat'
  ) => {
    const nextBond = roomState.bondPoints + 4;
    const nextHappy = Math.min(100, roomState.happiness + 3);
    const next = {
      ...roomState,
      bondPoints: nextBond,
      happiness: nextHappy,
    };
    setRoomState(next);
    saveCompanionRoomState(next);
    markDailyTaskReady('chat_partner');
    emitGameQuestAction('chat_companion');
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('chat_companion');
    }

    triggerCompanionDialogue(situation, {
      bondOverride: nextBond,
    });
  };

  // Tặng thức uống / hoa cho người thương: ghi nhận hiệu ứng và ẩn ly đã tặng khỏi Quầy thức uống (không tự xóa khỏi kho server)
  const handleGiftItemToCompanion = async (item: ExtendedGameItem) => {
    const bondGain =
      item.rarity === 'legendary' ? 18 : item.rarity === 'rare' ? 12 : 8;

    if (item.category === 'drink') {
      setGiftedDrinkIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    }

    const nextBond = roomState.bondPoints + bondGain;
    const nextRoom = {
      ...roomState,
      bondPoints: nextBond,
      happiness: Math.min(100, roomState.happiness + 10),
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);

    if (item.category === 'flower') {
      triggerCompanionDialogue('gift_flower', {
        bondOverride: nextBond,
        itemName: item.name,
      });
      emitGameQuestAction('gift_flower');
      if (currentUser && currentUser.role !== 'guest') {
        logGameActionViaRpc('gift_flower');
      }
    } else {
      triggerCompanionDialogue('gift_drink', {
        bondOverride: nextBond,
        itemName: item.name,
      });
      emitGameQuestAction('gift_drink');
      if (currentUser && currentUser.role !== 'guest') {
        logGameActionViaRpc('gift_drink');
      }
    }
    showToast(
      `💝 Đã tặng "${item.name}" cho ${companionChar?.name || 'người thương'}! (+${bondGain} Gắn bó)`
    );
  };

  const handleBuyPetFood = () => {
    const cost = 8;
    if (!isOwner && petalsBalance < cost) {
      showToast(
        `Bạn cần ${cost} ${currencyName} để mua túi 3 Thức ăn thú cưng nhé 🐾`
      );
      return;
    }
    onAddPetals(-cost);
    const next = {
      ...roomState,
      petFoodCount: roomState.petFoodCount + 3,
    };
    setRoomState(next);
    saveCompanionRoomState(next);
    showToast('🐾 Đã mua +3 phần Thức ăn thú cưng!');
  };

  const getPetStats = useCallback(
    (petId: string): PetCareStat => {
      const saved = petCareMap[petId];
      if (saved) return saved;
      return { fullness: 75, happiness: 85, updatedAt: Date.now() };
    },
    [petCareMap]
  );

  const handleStrokePet = (petId: string) => {
    const targetPet = inventory.find((it) => it.id === petId);
    const sound = targetPet?.petSound || 'Meo~ 🌸';
    setActivePetSpeech({
      petId,
      text: `❤️ ${sound}`,
    });
    setTimeout(() => {
      setActivePetSpeech((prev) => (prev?.petId === petId ? null : prev));
    }, 3200);

    setPetCareMap((prev) => {
      const cur = prev[petId] || { fullness: 75, happiness: 85, updatedAt: Date.now() };
      const nextMap = {
        ...prev,
        [petId]: {
          ...cur,
          happiness: Math.min(100, cur.happiness + 12),
          updatedAt: Date.now(),
        },
      };
      savePetCareStatsMap(nextMap);
      return nextMap;
    });

    const nextRoom = {
      ...roomState,
      happiness: Math.min(100, roomState.happiness + 4),
      bondPoints: roomState.bondPoints + 2,
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);

    if (companionChar && targetPet) {
      setCompanionPetComment(
        generateCompanionPetComment({
          char: companionChar,
          petName: targetPet.name,
          petSpecies: targetPet.petSpecies,
          action: 'pet',
          bondPoints: nextRoom.bondPoints,
          inMemoryOpenScene: inMemoryCompanionOpenScene,
          addressMap: effectiveAddressMap,
          customVoices: effectiveTagVoices,
        }).text
      );
    }

    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('pet_stroke');
    }
    showToast(
      `🐾 Bạn nhẹ nhàng vuốt ve "${targetPet?.name || 'bé thú cưng'}", bé rúc vào tay kêu "${sound}"!`
    );
  };

  const handleFeedPet = async (petId: string) => {
    const targetPet = inventory.find((it) => it.id === petId);
    if (targetPet?.petSound) {
      setActivePetSpeech({
        petId,
        text: targetPet.petSound,
      });
      setTimeout(() => {
        setActivePetSpeech((prev) => (prev?.petId === petId ? null : prev));
      }, 3200);
    }

    if (roomState.petFoodCount <= 0) {
      showToast('Hết thức ăn thú cưng rồi! Hãy bấm nút "Mua thức ăn" nhé 🐾');
      return;
    }

    const nextRoom = {
      ...roomState,
      petFoodCount: roomState.petFoodCount - 1,
      happiness: Math.min(100, roomState.happiness + 6),
      bondPoints: roomState.bondPoints + 3,
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);

    setPetCareMap((prev) => {
      const cur = prev[petId] || { fullness: 70, happiness: 80, updatedAt: Date.now() };
      const nextMap = {
        ...prev,
        [petId]: {
          fullness: Math.min(100, cur.fullness + 25),
          happiness: Math.min(100, cur.happiness + 10),
          updatedAt: Date.now(),
        },
      };
      savePetCareStatsMap(nextMap);
      return nextMap;
    });

    if (companionChar && targetPet) {
      setCompanionPetComment(
        generateCompanionPetComment({
          char: companionChar,
          petName: targetPet.name,
          petSpecies: targetPet.petSpecies,
          action: 'feed',
          bondPoints: nextRoom.bondPoints,
          inMemoryOpenScene: inMemoryCompanionOpenScene,
          addressMap: effectiveAddressMap,
          customVoices: effectiveTagVoices,
        }).text
      );
    }

    emitGameQuestAction('feed_pet');
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('feed_pet');
    }
    showToast(
      `🐾 "${targetPet?.name || 'Thú cưng'}" kêu "${
        targetPet?.petSound || 'Meo~'
      }" và ăn no nê vui vẻ!`
    );
  };

  // ============================================================================
  // 5. QUẦY PHA CHẾ (brew_start, brew_collect, brew_orders) & KỆ TRƯNG BÀY
  // ============================================================================
  const BREW_BASE_OPTIONS: Array<{ label: string; defaultColor: string }> = [
    { label: 'Americano', defaultColor: '#8d6e63' },
    { label: 'Trà sữa', defaultColor: '#d7b399' },
    { label: 'Matcha latte', defaultColor: '#88bf73' },
    { label: 'Cacao nóng', defaultColor: '#795548' },
    { label: 'Trà hoa cúc', defaultColor: '#f2cf7a' },
    { label: 'Cà phê muối', defaultColor: '#a1887f' },
    { label: 'Trà đào', defaultColor: '#f7b299' },
  ];
  const BREW_FLAVOR_OPTIONS: string[] = [
    'Vani dịu',
    'Caramel ấm',
    'Bạc hà mát',
    'Hoa nhài thanh',
    'Quế mật',
    'Sữa yến mạch',
  ];
  const BREW_TOPPING_OPTIONS: string[] = [
    'mật ong',
    'kem mây',
    'trân châu',
    'hoa khô',
  ];
  const BREW_COLOR_SWATCHES: string[] = [
    '#d7b399',
    '#88bf73',
    '#f2cf7a',
    '#f7b299',
    '#f4a3b0',
    '#b8a6e0',
    '#9cc7ee',
    '#8d6e63',
  ];

  const [brewBase, setBrewBase] = useState<string>('Trà sữa');
  const [brewFlavor, setBrewFlavor] = useState<string>('Vani dịu');
  const [brewTopping, setBrewTopping] = useState<string>('trân châu');
  const [brewColor, setBrewColor] = useState<string>('#d7b399');
  const [brewOrders, setBrewOrders] = useState<SupabaseBrewOrderRow[]>([]);
  const [isStartingBrew, setIsStartingBrew] = useState<boolean>(false);
  const [brewShortfallDiff, setBrewShortfallDiff] = useState<number | null>(null);
  const [brewResultModal, setBrewResultModal] = useState<{
    item: ExtendedGameItem;
    recipe: BrewRecipePayload;
  } | null>(null);
  const [newlyShelvedDrinkId, setNewlyShelvedDrinkId] = useState<string | null>(null);
  const [selectedShelfDrink, setSelectedShelfDrink] = useState<ExtendedGameItem | null>(null);
  const [shelfPage, setShelfPage] = useState<number>(0);
  const collectingOrderIdsRef = useRef<Set<string>>(new Set());

  const freeBrewsLeft = Math.max(0, 6 - (dailyStatus?.brews_used || 0));

  const collectReadyBrewOrder = useCallback(
    async (orderRow: SupabaseBrewOrderRow) => {
      const orderId = String(orderRow.id);
      if (collectingOrderIdsRef.current.has(orderId)) return;
      collectingOrderIdsRef.current.add(orderId);

      try {
        const res = await brewCollectViaRpc(orderId);
        if (res.ok) {
          setBrewOrders((prev) => prev.filter((o) => String(o.id) !== orderId));
          if (res.item) {
            onOptimisticAddInventoryItem?.(res.item);
            setNewlyReceivedIds((prev) => {
              const next = new Set(prev);
              next.add(res.item!.id);
              return next;
            });
            setNewlyShelvedDrinkId(res.item.id);
            setTimeout(() => {
              setNewlyShelvedDrinkId((cur) =>
                cur === res.item!.id ? null : cur
              );
            }, 5000);
          }

          await refreshSupabaseInventoryAndRoll();

          if (res.item) {
            const recipeMeta =
              (res.item.meta && typeof res.item.meta === 'object'
                ? (res.item.meta as unknown as BrewRecipePayload)
                : orderRow.recipe) || {
                base: brewBase,
                flavor: brewFlavor,
                topping: brewTopping,
                color: brewColor,
              };
            const dbRow: DbInventoryRow & { meta?: Record<string, unknown> | null } = {
              id: res.item.id,
              user_id: '',
              kind: 'drink',
              item_type: 'drink',
              name: res.item.name,
              item_name: res.item.name,
              rarity: res.item.rarity,
              seed: res.item.seed || `${res.item.name}_${res.item.id}`,
              ready_at: res.item.readyAt,
              created_at: res.item.createdAt,
              count: res.item.count,
              meta: recipeMeta as unknown as Record<string, unknown>,
            };
            const mapped = mapDbInvRowToGameItem(
              dbRow,
              companionChar?.tags || ['Dịu dàng'],
              effectiveTagPets,
              companionChar?.name
            );
            setBrewResultModal({
              item: mapped,
              recipe: recipeMeta,
            });
          } else {
            showToast(res.message);
          }
        } else {
          // Nếu chưa tới giờ hoặc lỗi khác thì bỏ cờ để thử lại sau
          collectingOrderIdsRef.current.delete(orderId);
        }
      } catch {
        collectingOrderIdsRef.current.delete(orderId);
      }
    },
    [
      brewBase,
      brewFlavor,
      brewTopping,
      brewColor,
      companionChar?.tags,
      companionChar?.name,
      effectiveTagPets,
      onOptimisticAddInventoryItem,
      refreshSupabaseInventoryAndRoll,
    ]
  );

  const loadBrewOrders = useCallback(async () => {
    if (!currentUser || currentUser.role === 'guest' || !currentUser.id) {
      setBrewOrders([]);
      return;
    }
    const orders = await fetchBrewOrdersFromSupabase();
    setBrewOrders(orders);
    const now = Date.now();
    for (const ord of orders) {
      const rMs = ord.ready_at ? new Date(ord.ready_at).getTime() : 0;
      if (rMs > 0 && now >= rMs) {
        collectReadyBrewOrder(ord);
      }
    }
  }, [currentUser, collectReadyBrewOrder]);

  useEffect(() => {
    loadBrewOrders();
  }, [loadBrewOrders]);

  useEffect(() => {
    if (activeZone === 'drinks') {
      loadBrewOrders();
    }
  }, [activeZone, loadBrewOrders]);

  // Kiểm tra mỗi giây: khi đếm ngược pha chế xong (nowMs >= ready_at) tự động gọi brew_collect(order)
  useEffect(() => {
    if (brewOrders.length === 0) return;
    for (const ord of brewOrders) {
      const rMs = ord.ready_at ? new Date(ord.ready_at).getTime() : 0;
      if (rMs > 0 && nowMs >= rMs) {
        collectReadyBrewOrder(ord);
      }
    }
  }, [nowMs, brewOrders, collectReadyBrewOrder]);

  const handleStartBrew = async () => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để pha chế thức uống tại quầy nhé ☕');
      return;
    }
    if (isStartingBrew) return;
    if (brewOrders.length >= 3) {
      showToast('☕ Quầy đang pha tối đa 3 ly cùng lúc rồi, đợi ly chín thêm chút nhé!');
      return;
    }
    if (freeBrewsLeft <= 0 && !isOwner && coins < 3) {
      const diff = Math.max(1, 3 - coins);
      setBrewShortfallDiff(diff);
      showToast(`Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`);
      return;
    }

    setBrewShortfallDiff(null);
    setIsStartingBrew(true);
    try {
      const recipe: BrewRecipePayload = {
        base: brewBase,
        flavor: brewFlavor,
        topping: brewTopping,
        color: brewColor,
      };
      const res = await brewStartViaRpc(recipe);
      if (!res.ok) {
        if (res.errorCode === 'not_enough_coins') {
          const diff = Math.max(1, 3 - coins);
          setBrewShortfallDiff(diff);
          showToast(`Chưa đủ ${coinCurrencyName}, còn thiếu ${diff} ${coinCurrencyName}`);
        } else {
          showToast(res.message);
        }
        await loadDailyStatus();
        return;
      }

      if (typeof res.cost === 'number' && res.cost > 0) {
        const c = await fetchMyCoinsFromSupabase();
        setCoins(c);
      }
      setDailyStatus((prev) => ({
        ...prev,
        brews_used:
          typeof res.brews_used === 'number' ? res.brews_used : prev.brews_used + 1,
      }));

      if (res.order && res.ready_at) {
        const newOrderRow: SupabaseBrewOrderRow = {
          id: res.order,
          recipe,
          ready_at: res.ready_at,
          collected: false,
        };
        setBrewOrders((prev) => [...prev, newOrderRow]);
      } else {
        await loadBrewOrders();
      }
      await loadDailyQuests();
      showToast(res.message);
    } finally {
      setIsStartingBrew(false);
    }
  };

  // Lọc danh sách Kho đồ
  const filteredInventory = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    return inventory.filter((item) => {
      if (invCategoryFilter !== 'all' && item.category !== invCategoryFilter)
        return false;
      if (invRarityFilter !== 'all' && item.rarity !== invRarityFilter)
        return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inventory, invCategoryFilter, invRarityFilter, invSearch]);

  // Danh sách nhiệm vụ nhỏ mỗi ngày giúp kiếm thêm Cánh hoa
  const dailyPetalTasks = [
    {
      key: 'gacha',
      label: 'Mở hộp quà Gacha mỗi ngày',
      reward: 8,
    },
    {
      key: 'water',
      label: 'Tưới nước chăm sóc Vườn hoa',
      reward: 10,
    },
    {
      key: 'feed_fish',
      label: 'Cho cá ăn trong Hồ cá',
      reward: 10,
    },
    {
      key: 'chat_partner',
      label: 'Trò chuyện cùng nhân vật ở Phòng tri kỷ',
      reward: 8,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Số dư Cánh hoa + Vật tư */}
      <div className="border-b border-[var(--border)] pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={
                customTexts['minigame_title'] ||
                '🌸 Khu Vườn Nhỏ, Hồ Cá & Phòng Tri Kỷ'
              }
              onSave={(val) => onUpdateCustomText?.('minigame_title', val)}
              editMode={canEdit}
            />
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            <EditableText
              value={
                customTexts['minigame_desc'] ||
                'Không gian chăm sóc hoa lá, hồ cá đêm, thú cưng và quầy pha chế ấm áp. Tích lũy thành quả mỗi ngày để tặng tri kỷ hoặc mở khóa nhân vật mới.'
              }
              onSave={(val) => onUpdateCustomText?.('minigame_desc', val)}
              editMode={canEdit}
              multiline
            />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="px-4 py-2 rounded-full border-2 border-[var(--accent)] bg-[var(--surface)] font-bold text-[var(--text)] shadow-xs flex items-center gap-1.5">
            <span>{currencyEmoji}</span>
            <span>Số dư: {isOwner ? 'Đầy' : petalsBalance} {currencyName}</span>
          </div>
          <div className="px-4 py-2 rounded-full border-2 border-amber-400 bg-amber-500/10 font-black text-amber-700 dark:text-amber-300 shadow-xs flex items-center gap-1.5">
            <span>{coinCurrencyEmoji}</span>
            <span>{isOwner ? 'Đầy' : coins} {coinCurrencyName}</span>
          </div>
          <div className="sticker-chip font-bold">
            🐟 Hạt cá: {roomState.fishFoodCount}
          </div>
          <div className="sticker-chip font-bold">
            🐾 Thức ăn thú: {roomState.petFoodCount}
          </div>
        </div>
      </div>

      {/* Thanh chuyển đổi 6 khu vực trong Mini Game */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            {
              id: 'market',
              label: '🛒 Chợ Nhỏ',
              badge: `${coins} ${coinCurrencyName}`,
            },
            {
              id: 'gacha_inv',
              label: '🎁 Gacha & Kho Đồ',
              badge: hasFreeGachaToday ? '1 lượt Free!' : `${inventory.length} món`,
            },
            {
              id: 'garden',
              label: '🌱 Vườn Hoa (5 giai đoạn)',
              badge: `${plantedBySlot.size}/${effectivePlotsCount} ô`,
            },
            {
              id: 'pond',
              label: '🐟 Hồ Cá Đêm',
              badge: `${pondFishItems.length} cá bơi`,
            },
            {
              id: 'companion',
              label: '🏡 Khu Thú Cưng & Tri Kỷ',
              badge: `${ownedPets.length} thú cưng`,
            },
            {
              id: 'drinks',
              label: '☕ Quầy Pha Chế & Kệ Ly',
              badge: `${ownedDrinks.length} ly`,
            },
          ] as const
        ).map((tab) => {
          const active = activeZone === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveZone(tab.id);
                onRefreshInventory?.();
                if (currentUser && currentUser.role !== 'guest') {
                  if (tab.id === 'companion') {
                    logGameActionViaRpc('visit_room');
                  } else if (tab.id === 'drinks') {
                    logGameActionViaRpc('visit_drinks');
                  }
                }
              }}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 bouncy-btn ${
                active
                  ? 'bg-[var(--accent)] text-[#3a2b30] shadow-sm'
                  : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  active
                    ? 'bg-white/50 text-[#3a2b30]'
                    : 'bg-[var(--bg)] text-[var(--muted)]'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Banner lỗi đỏ rõ ràng nếu đọc inventory thất bại */}
      {inventoryError && (
        <div className="p-4 rounded-2xl border-2 border-red-500 bg-red-500/15 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-between shadow-md">
          <span>⚠️ Không thể đọc Kho đồ từ Supabase: {inventoryError}</span>
          {onRefreshInventory && (
            <button
              type="button"
              onClick={onRefreshInventory}
              className="px-3 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold cursor-pointer"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {inventoryLoading && (
        <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)] flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
          <span>Đang đồng bộ Kho đồ từ Supabase...</span>
        </div>
      )}

      {/* Toast thông báo dịu dàng */}
      {gameToast && (
        <div className="p-3.5 rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] text-xs font-bold text-[var(--text)] flex items-center justify-between shadow-sm animate-fade-in">
          <span>{gameToast}</span>
          <button
            type="button"
            onClick={() => setGameToast(null)}
            className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* =====================================================================
          KHU 0: CHỢ NHỎ (TIỀN XU, ĐIỂM DANH, NHIỆM VỤ NGÀY, CỬA HÀNG & BÁN LẠI)
         ===================================================================== */}
      {activeZone === 'market' && (
        <div className="space-y-6">
          {/* 1. THANH XU & LỜI CHÀO CHỢ NHỎ */}
          <div className="soft-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-2 border-[var(--border)] bg-gradient-to-r from-[var(--surface)] via-[var(--surface)] to-[var(--accent)]/10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛒</span>
                <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
                  Chợ Nhỏ Bình Yên
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-[#3a2b30] shadow-2xs">
                  Supabase Realtime
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] max-w-xl leading-relaxed">
                Nơi trao đổi những thức quà dịu dàng, hạt giống mầm hoa, cá bơi đêm, thú cưng và thức uống thơm lành. Hoàn thành nhiệm vụ mỗi ngày để tích lũy thêm {coinCurrencyName}!
              </p>
            </div>

            {/* Khối hiển thị số Xu nổi bật */}
            <div className="flex items-center gap-3 bg-[var(--bg)]/90 px-5 py-3 rounded-2xl border border-[var(--border)] shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
                {coinCurrencyEmoji}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)]">
                  Số dư {coinCurrencyName} của bạn
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif-title text-2xl font-black text-amber-600 dark:text-amber-400">
                    {isOwner ? 'Đầy' : coins}
                  </span>
                  <span className="text-xs font-bold text-[var(--text)]">
                    {coinCurrencyName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={loadMarketDataAndCoins}
                className="ml-2 p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                title="Làm mới số Xu"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Hiệu ứng lấp lánh nhẹ khi hoàn thành nhiệm vụ */}
          {questSparkleEffect && (
            <div className="p-4 rounded-2xl border-2 border-amber-400 bg-amber-500/15 text-[var(--text)] flex items-center justify-between gap-3 shadow-md animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/30 flex items-center justify-center text-xl animate-bounce">
                  ✨
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    🎉 Tuyệt vời! Bạn vừa hoàn thành nhiệm vụ:
                  </p>
                  <p className="text-sm font-extrabold text-[var(--text)]">
                    “{questSparkleEffect.questTitle}”
                  </p>
                </div>
              </div>
              <div className="px-3.5 py-1.5 rounded-full bg-amber-500 text-white font-extrabold text-sm shadow-xs flex items-center gap-1">
                <span>+{questSparkleEffect.reward}</span>
                <span>{coinCurrencyEmoji}</span>
              </div>
            </div>
          )}

          {/* 2. ĐIỂM DANH & 3. NHIỆM VỤ HÔM NAY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 2. ĐIỂM DANH NHẬN XU (trạng thái chỉ lấy từ rpc daily_status()) */}
            <div
              className={`soft-card p-5 border flex flex-col justify-between gap-4 transition-all ${
                dailyStatus.checked_in
                  ? 'border-emerald-400/60 bg-gradient-to-b from-emerald-500/10 to-[var(--bg)]'
                  : 'border-[var(--border)] bg-gradient-to-b from-[var(--surface)] to-[var(--bg)]'
              } ${checkInJustSparkled ? 'ring-4 ring-amber-400/40 animate-pulse' : ''}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent)] uppercase tracking-wider">
                    <Gift className="w-4 h-4" />
                    <span>Điểm danh hôm nay</span>
                  </div>
                  {dailyStatus.checked_in && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                      ✅ Đã điểm danh
                    </span>
                  )}
                </div>
                <h4 className="font-serif-title text-lg font-bold text-[var(--text)]">
                  Điểm danh hôm nay 🎁
                </h4>
                {!dailyStatus.checked_in ? (
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Mỗi ngày ghé thăm Chợ nhỏ, bấm nút bên dưới để nhận ngay +10 {coinCurrencyName} khởi đầu ngày mới nhé.
                  </p>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 space-y-2">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
                      <span className="text-base shrink-0">✅</span>
                      <span>
                        Hôm nay bạn đã điểm danh rồi 🌙 Hẹn bạn 7 giờ sáng mai quay lại điểm danh nhé!
                      </span>
                    </p>
                    {checkInJustSparkled && (
                      <p className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 animate-bounce">
                        ✨ +10 {coinCurrencyName} đã cộng vào túi của bạn!
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2">
                {!dailyStatus.checked_in ? (
                  <>
                    <button
                      type="button"
                      disabled={isClaimingDaily}
                      onClick={handleClaimDailyCoins}
                      className="w-full py-3 rounded-2xl font-extrabold text-xs bg-[var(--accent)] text-[#3a2b30] bouncy-btn shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isClaimingDaily ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>✨</span>
                      )}
                      <span>Điểm danh +10 {coinCurrencyName}</span>
                    </button>
                    <p className="text-[10px] text-[var(--muted)] text-center mt-2">
                      Làm mới lúc 7 giờ sáng mỗi ngày
                    </p>
                  </>
                ) : (
                  <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--muted)] font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Lượt mới lúc 7 giờ sáng:</span>
                    </span>
                    <strong className="font-mono text-amber-600 dark:text-amber-400">
                      {questCountdownStr || '00:00:00'}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* 3. NHIỆM VỤ HÔM NAY (ĐỒNG HỒ ĐẾM NGƯỢC 7 GIỜ SÁNG & 3 THẺ NHIỆM VỤ) */}
            <div id="daily-quests-section" className="lg:col-span-2 soft-card p-5 border border-[var(--border)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <div>
                    <h4 className="font-serif-title text-base font-bold text-[var(--text)]">
                      Nhiệm Vụ Nhỏ Hôm Nay
                    </h4>
                    <p className="text-[11px] text-[var(--muted)]">
                      Hoàn thành hành động trong game rồi bấm &quot;Nhận thưởng&quot; để nhận {coinCurrencyName}.
                    </p>
                  </div>
                </div>

                {/* Đồng hồ đếm ngược resets_at (7 giờ sáng) */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[11px] font-bold text-[var(--text)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>
                    Nhiệm vụ mới lúc 7 giờ sáng · còn{' '}
                    <strong className="text-amber-600 dark:text-amber-400 font-mono">
                      {questCountdownStr || '00:00:00'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* 3 Thẻ nhiệm vụ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {dailyQuests.map((quest, index) => {
                  const target = Math.max(1, quest.target || 1);
                  const progress = Math.min(
                    target,
                    Math.max(0, quest.progress || (quest.completed ? target : 0))
                  );
                  const isReadyToClaim = !quest.completed && progress >= target;
                  const percent = Math.min(100, Math.round((progress / target) * 100));
                  const hint = getQuestHintForAction(quest.action, quest.title);

                  return (
                    <div
                      key={quest.id || index}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3.5 transition-all shadow-2xs ${
                        quest.completed
                          ? 'border-emerald-400/50 bg-emerald-500/10'
                          : isReadyToClaim
                          ? 'border-amber-400/70 bg-gradient-to-b from-amber-500/10 to-amber-500/5 ring-2 ring-amber-400/30'
                          : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                            Nhiệm vụ #{index + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            +{quest.reward} {coinCurrencyName}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-[var(--text)] leading-snug">
                          {quest.title}
                        </p>

                        {/* Thanh tiến độ */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-[var(--muted)] text-[10px]">Tiến độ</span>
                            <span
                              className={`font-mono text-xs ${
                                quest.completed
                                  ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                                  : isReadyToClaim
                                  ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                                  : 'text-[var(--text)]'
                              }`}
                            >
                              {progress}/{target}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                quest.completed
                                  ? 'bg-emerald-500'
                                  : isReadyToClaim
                                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                                  : 'bg-[var(--accent)]'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {!quest.completed && !isReadyToClaim && (
                          <p className="text-[10.5px] text-[var(--muted)] leading-relaxed italic bg-[var(--bg)]/70 p-2 rounded-xl border border-[var(--border)]/50">
                            💡 {hint}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[var(--border)]/40">
                        {quest.completed ? (
                          <div className="py-2 text-center text-[11px] font-extrabold text-emerald-600 dark:text-emerald-300 flex items-center justify-center gap-1.5 bg-emerald-500/15 rounded-xl border border-emerald-400/30">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Đã nhận (+{quest.reward} {coinCurrencyName})</span>
                          </div>
                        ) : isReadyToClaim ? (
                          <button
                            type="button"
                            onClick={() => handleClaimQuestReward(index)}
                            disabled={isClaimingQuestIndex === index}
                            className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-stone-900 font-extrabold text-xs shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
                            <span>
                              {isClaimingQuestIndex === index
                                ? 'Đang nhận Xu...'
                                : `Nhận thưởng (+${quest.reward} ${coinCurrencyName})`}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!currentUser || currentUser.role === 'guest') {
                                onRequireAuth?.(
                                  `Mời bạn đăng nhập để làm nhiệm vụ và nhận ${coinCurrencyName} nhé 🌸`
                                );
                              } else {
                                showToast(
                                  `Bạn chưa làm xong nhiệm vụ này nhé (${progress}/${target}). ${hint}`
                                );
                              }
                            }}
                            className="w-full py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 text-[11px] font-medium text-[var(--muted)] opacity-60 cursor-not-allowed flex items-center justify-center gap-1.5"
                            title={hint}
                          >
                            <Lock className="w-3 h-3 opacity-60" />
                            <span>Chưa hoàn thành ({progress}/{target})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. CỬA HÀNG CHỢ NHỎ: LỜI RIÊNG THÂN MẬT THEO NHÓM HÀNG (LƯU TRONG site_settings.market_texts) */}
          <div className="soft-card p-6 space-y-4 border border-[var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                  <Store className="w-5 h-5 text-[var(--accent)]" />
                  <span>Cửa Hàng Vật Phẩm</span>
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Hạt giống hoa mua về đem gieo ở Vườn hoa (nở thành Hoa sau 30 phút), cá mới mua cần 30 phút để lớn khôn trước khi mở khóa nhân vật ⏳
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {marketPrices
                .filter((p) => p.enabled)
                .map((row) => {
                  const labelMap: Record<
                    string,
                    {
                      name: string;
                      emoji: string;
                      tagline: string;
                      desc: string;
                      needGrow: boolean;
                      sampleSeed: string;
                    }
                  > = {
                    flower: {
                      name: 'Hạt giống hoa',
                      emoji: '🌱',
                      tagline: effectiveMarketTexts.seed,
                      desc: 'Hạt giống hoa đem gieo vào ô Vườn hoa để nở thành Hoa sau 30 phút.',
                      needGrow: true,
                      sampleSeed: 'market_sample_flower_sakura_bloom',
                    },
                    fish: {
                      name: 'Cá Bơi',
                      emoji: '🐟',
                      tagline: effectiveMarketTexts.fish,
                      desc: 'Chú cá lấp lánh, thả vào Hồ cá đêm để ấp nở và bơi lội êm đềm.',
                      needGrow: true,
                      sampleSeed: 'market_sample_fish_koi_moon',
                    },
                    drink: {
                      name: 'Thức Uống',
                      emoji: '☕',
                      tagline: effectiveMarketTexts.drink,
                      desc: 'Ly nước pha sẵn ngọt lành, trưng trên kệ gỗ ở Quầy pha chế và dùng ngay.',
                      needGrow: false,
                      sampleSeed: 'market_sample_drink_matcha_latte',
                    },
                    pet: {
                      name: 'Thú Cưng',
                      emoji: '🐾',
                      tagline: effectiveMarketTexts.pet,
                      desc: 'Người bạn thú đáng yêu đồng hành cùng bạn và người thương tại Khu thú cưng.',
                      needGrow: false,
                      sampleSeed: 'market_sample_pet_fluffy_kitty',
                    },
                  };
                  const meta = labelMap[row.kind] || {
                    name: row.kind,
                    emoji: '📦',
                    tagline: effectiveMarketTexts.seed,
                    desc: 'Vật phẩm kỳ diệu tại Chợ nhỏ.',
                    needGrow: false,
                    sampleSeed: `market_sample_${row.kind}`,
                  };

                  return (
                    <div
                      key={row.kind}
                      id={`market-card-${row.kind}`}
                      className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{meta.emoji}</span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <span>{row.buy_price}</span>
                            <span>{coinCurrencyEmoji}</span>
                          </span>
                        </div>

                        {/* Hình minh họa SVG mẫu của loại đó */}
                        <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shadow-2xs">
                          {renderItem(
                            row.kind === 'flower' ? 'seed' : (row.kind as ItemCategory),
                            meta.sampleSeed,
                            'rare',
                            row.kind === 'flower' ? 0 : 'adult',
                            { size: 64 }
                          )}
                        </div>

                        <div className="text-center space-y-1">
                          <h5 className="font-serif-title text-base font-bold text-[var(--text)]">
                            {row.buy_price} {coinCurrencyName} → 1 {meta.emoji} {meta.name}
                          </h5>
                          <p className="text-xs font-bold text-[var(--accent)]">
                            {meta.tagline}
                          </p>
                        </div>

                        <p className="text-[11px] text-[var(--muted)] leading-relaxed text-center">
                          {meta.desc}
                        </p>

                        {meta.needGrow && (
                          <div className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg)] text-[10px] font-semibold text-[var(--muted)]">
                            <Clock className="w-3 h-3 text-[var(--accent)]" />
                            <span>
                              {row.kind === 'flower'
                                ? 'Gieo ở Vườn hoa (30 phút nở)'
                                : 'Cần 30 phút lớn khôn'}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isBuyingKind === row.kind}
                        onClick={() => handleBuyMarketItem(row.kind)}
                        className="w-full py-2.5 rounded-xl font-bold text-xs bg-[var(--accent)] text-[#3a2b30] bouncy-btn shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {isBuyingKind === row.kind ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShoppingBag className="w-3.5 h-3.5" />
                        )}
                        <span>Mua {meta.name} ({row.buy_price} {coinCurrencyName})</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 5. BÁN LẠI VẬT PHẨM LẤY XU */}
          <div className="soft-card p-6 space-y-4 border border-[var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span>Bán Lại Vật Phẩm Lấy {coinCurrencyName}</span>
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Trao đổi các vật phẩm bạn đang có trong Kho đồ để thu về {coinCurrencyName} (Hạt giống đang gieo trong Vườn hoa không bán được).
                </p>
              </div>
              <span className="text-xs font-bold text-[var(--muted)]">
                Trong kho: {inventory.length} món
              </span>
            </div>

            {inventory.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--muted)]">
                Kho đồ của bạn đang trống. Hãy mua ở Chợ hoặc mở Gacha mỗi ngày nhé!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
                {inventory.map((item) => {
                  const lookupKind = item.category === 'seed' ? 'flower' : item.category;
                  const priceRow = marketPrices.find((p) => p.kind === lookupKind);
                  const sellPrice = priceRow?.sell_price || 0;
                  const plantedSlot =
                    item.category === 'seed' ? plantedSlotBySeedId.get(item.id) : undefined;
                  const isPlantedInGarden = typeof plantedSlot === 'number';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                          {renderItem(
                            item.category,
                            item.seed,
                            item.rarity,
                            item.category === 'seed'
                              ? 0
                              : item.category === 'flower'
                              ? 4
                              : 'adult',
                            { size: 36 }
                          )}
                        </div>
                        <div className="min-w-0">
                          <h6 className="font-bold text-xs text-[var(--text)] truncate">
                            {item.category === 'seed'
                              ? formatSeedName(item.name)
                              : item.name}
                          </h6>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)] flex-wrap">
                            <span>{CATEGORY_LABELS[item.category].emoji}</span>
                            <span>{RARITY_LABELS[item.rarity]}</span>
                            {isPlantedInGarden && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                                Đang gieo ở ô #{plantedSlot + 1}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/40">
                        <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                          +{sellPrice} {coinCurrencyName}
                        </span>
                        {isPlantedInGarden ? (
                          <span
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 cursor-not-allowed"
                            title="Hạt giống đang gieo trong Vườn hoa không bán được"
                          >
                            🌱 Đang gieo ở ô #{plantedSlot + 1}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={sellPrice <= 0 || isSellingItemId === item.id}
                            onClick={() =>
                              setItemToSellConfirm({ item, price: sellPrice })
                            }
                            className="px-3 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] text-[11px] font-bold text-[var(--text)] cursor-pointer disabled:opacity-40"
                          >
                            {isSellingItemId === item.id ? 'Đang bán...' : 'Bán lại'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 1: GACHA MỖI NGÀY, NHIỆM VỤ NHỎ & KHO ĐỒ VẬT PHẨM
         ===================================================================== */}
      {activeZone === 'gacha_inv' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Hộp Gacha mỗi ngày */}
            <div className="lg:col-span-7 soft-card p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] flex items-center gap-2">
                    <Gift className="w-5 h-5 text-[var(--accent)]" />
                    <span>Gacha Quà Tặng Mỗi Ngày</span>
                  </h3>
                  <span className="sticker-chip text-[11px] font-bold">
                    ✨ Hình vẽ &amp; tên riêng theo seed
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] leading-relaxed">
                  {canEdit ? (
                    <EditableText
                      value={
                        customTexts['gacha_daily_desc'] ||
                        DEFAULT_GACHA_DAILY_DESC
                      }
                      onSave={(val) =>
                        onUpdateCustomText?.('gacha_daily_desc', val)
                      }
                      editMode={canEdit}
                      multiline
                    />
                  ) : customTexts['gacha_daily_desc'] &&
                    customTexts['gacha_daily_desc'] !==
                      DEFAULT_GACHA_DAILY_DESC ? (
                    <span>{customTexts['gacha_daily_desc']}</span>
                  ) : (
                    <>
                      Mỗi ngày bạn có 1 lượt mở quà miễn phí (không phạt nếu bỏ lỡ ngày). Quà mở ra ngẫu nhiên 1 trong 4 loại:
                      <strong> 🌱 Hạt giống hoa</strong> (đem gieo ở Vườn hoa để nở thành Hoa),
                      <strong> 🐟 Cá</strong> (bơi ở Hồ cá),
                      <strong> 🐾 Thú cưng</strong> (ở Khu thú cưng), hoặc
                      <strong> ☕ Thức uống</strong> (ở Quầy thức uống).
                    </>
                  )}
                </div>
              </div>

              {/* Khu hiển thị hiệu ứng mở quà hoặc kết quả vừa mở */}
              <div className="min-h-[185px] rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)]/80 p-5 flex flex-col items-center justify-center text-center">
                {isRollingGacha ? (
                  <div className="space-y-3 py-4 animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-[var(--accent)]/30 flex items-center justify-center mx-auto">
                      <Sparkles className="w-8 h-8 text-[var(--accent)] animate-spin" />
                    </div>
                    <p className="font-serif-title text-lg font-bold text-[var(--text)]">
                      ✨ Đang mở hộp quà lấp lánh...
                    </p>
                  </div>
                ) : lastGachaResult ? (
                  <div className="space-y-3 max-w-md">
                    <div className="flex items-center justify-center">
                      {renderItem(
                        lastGachaResult.item.category,
                        lastGachaResult.item.seed,
                        lastGachaResult.item.rarity,
                        lastGachaResult.item.category === 'seed'
                          ? 0
                          : lastGachaResult.item.category === 'flower'
                          ? 4
                          : 'adult',
                        { size: 80 }
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-2">
                        <span className="sticker-chip text-[10px] font-bold">
                          {
                            CATEGORY_LABELS[lastGachaResult.item.category]
                              .emoji
                          }{' '}
                          {CATEGORY_LABELS[lastGachaResult.item.category].name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/25 text-[var(--text)]">
                          Độ hiếm: {RARITY_LABELS[lastGachaResult.item.rarity]}
                        </span>
                      </div>
                      <h4 className="font-serif-title text-xl font-bold text-[var(--text)]">
                        {lastGachaResult.item.category === 'seed' ||
                        lastGachaResult.item.category === 'flower'
                          ? `Bạn nhận được ${formatSeedName(lastGachaResult.item.name)}`
                          : `Bạn nhận được ${lastGachaResult.item.name}`}
                      </h4>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Đã cất vào Kho đồ ✨
                      </p>
                      <p className="text-xs text-[var(--muted)] leading-relaxed">
                        {lastGachaResult.destinationNote}
                      </p>
                      {(lastGachaResult.item.category === 'seed' ||
                        lastGachaResult.item.category === 'flower') && (
                        <div className="pt-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenPlantModalForSeed(lastGachaResult.item.id)
                            }
                            className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                          >
                            <span>🌱 Gieo ngay</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-4 text-[var(--muted)]">
                    <Sparkles className="w-7 h-7 text-[var(--accent)] mx-auto" />
                    <p className="text-xs">
                      Bấm nút mở quà bên dưới để đón một vật phẩm có hình vẽ và tên riêng duy nhất nhé!
                    </p>
                  </div>
                )}
              </div>

              {/* Nút mở quà Gacha theo daily_status().rolled */}
              {hasFreeGachaToday ? (
                <button
                  type="button"
                  disabled={isRollingGacha}
                  onClick={handleRollGacha}
                  className="w-full py-3.5 px-5 rounded-full text-xs font-extrabold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Gift className="w-4 h-4" />
                  <span>🎁 Mở quà hôm nay</span>
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[var(--text)]">
                    🎁 Hôm nay bạn đã mở quà rồi, 7 giờ sáng mai có lượt miễn phí mới nhé
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>{questCountdownStr || '00:00:00'}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Bảng Nhiệm vụ nhỏ mỗi ngày kiếm Cánh hoa */}
            <div className="lg:col-span-5 soft-card p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" />
                  <span>Nhiệm Vụ Nhỏ Mỗi Ngày</span>
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Hoàn thành các việc nhẹ nhàng để nhận thêm {currencyName} mua Hạt cá, Thức ăn thú hoặc roll Gacha.
                </p>
              </div>

              <div className="space-y-2.5">
                {dailyPetalTasks.map((q) => {
                  const isDone =
                    roomState.completedDailyTasks[`${q.key}_done`] === todayStr;
                  const isClaimed =
                    roomState.completedDailyTasks[`${q.key}_claimed`] ===
                    todayStr;
                  return (
                    <div
                      key={q.key}
                      className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text)]">
                          {q.label}
                        </div>
                        <div className="text-[11px] text-[var(--muted)]">
                          Thưởng: +{q.reward} {currencyEmoji} {currencyName}
                        </div>
                      </div>

                      {isClaimed ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-bold text-[11px]">
                          ✓ Đã nhận
                        </span>
                      ) : isDone ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleClaimDailyTaskReward(q.key, q.reward, q.label)
                          }
                          className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[11px] cursor-pointer bouncy-btn"
                        >
                          Nhận +{q.reward} {currencyEmoji}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--muted)]">
                          Chưa xong
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KHO ĐỒ VẬT PHẨM (INVENTORY - NGUỒN DUY NHẤT) */}
          <div className="soft-card p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] flex items-center gap-2">
                  <Package className="w-5 h-5 text-[var(--accent)]" />
                  <span>Kho Đồ Của Bạn ({inventory.length} vật phẩm)</span>
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Tất cả vật phẩm từ Chợ và Gacha được lưu trực tiếp tại Kho đồ (🌱 {ownedSeeds.length} Hạt giống · 🌸 {ownedFlowers.length} Hoa đã nở · 🐟 {ownedFish.length} Cá · 🐾 {ownedPets.length} Thú · ☕ {ownedDrinks.length} Nước).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                  placeholder="Tìm tên vật phẩm..."
                  className="px-3.5 py-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />

                <select
                  value={invRarityFilter}
                  onChange={(e) =>
                    setInvRarityFilter(e.target.value as 'all' | ItemRarity)
                  }
                  className="px-3 py-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
                >
                  <option value="all">Mọi độ hiếm</option>
                  <option value="common">Thường</option>
                  <option value="rare">Quý</option>
                  <option value="legendary">Hiếm ✨</option>
                </select>
              </div>
            </div>

            {/* Lưới thẻ theo loại (Tất cả / Hạt giống / Hoa / Cá / Thú / Nước) */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: `Tất cả (${inventory.length})` },
                  {
                    id: 'seed',
                    label: `🌱 Hạt giống (${ownedSeeds.length})`,
                  },
                  {
                    id: 'flower',
                    label: `🌸 Hoa (${ownedFlowers.length})`,
                  },
                  {
                    id: 'fish',
                    label: `🐟 Cá (${ownedFish.length})`,
                  },
                  {
                    id: 'pet',
                    label: `🐾 Thú (${ownedPets.length})`,
                  },
                  {
                    id: 'drink',
                    label: `☕ Nước (${ownedDrinks.length})`,
                  },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setInvCategoryFilter(c.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
                    invCategoryFilter === c.id
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] shadow-2xs'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {inventory.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)]/60 text-center space-y-3">
                <p className="text-sm font-bold text-[var(--text)]">
                  Kho đồ của bạn đang trống 🌸
                </p>
                <p className="text-xs text-[var(--muted)] max-w-md mx-auto leading-relaxed">
                  Hãy ghé Chợ nhỏ hoặc mở hộp quà Gacha phía trên để đón những hạt giống hoa, chú cá, thú cưng và thức uống mang tên riêng độc nhất về Kho đồ nhé!
                </p>
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveZone('market')}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer"
                  >
                    🛒 Ghé Chợ Nhỏ
                  </button>
                  {hasFreeGachaToday && (
                    <button
                      type="button"
                      onClick={handleRollGacha}
                      className="px-4 py-2 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] cursor-pointer"
                    >
                      🎁 Mở quà hôm nay
                    </button>
                  )}
                </div>
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--muted)]">
                Chưa có vật phẩm nào khớp với bộ lọc hiện tại 🌸
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredInventory.map((item) => {
                  const isNew = newlyReceivedIds.has(item.id);
                  const readyMs = item.readyAt ? new Date(item.readyAt).getTime() : 0;
                  const isGrowing =
                    item.category === 'fish' &&
                    Boolean(item.readyAt && !Number.isNaN(readyMs) && readyMs > nowMs);
                  const remainingGrowMs = isGrowing ? Math.max(0, readyMs - nowMs) : 0;
                  const plantedSlot =
                    item.category === 'seed'
                      ? plantedSlotBySeedId.get(item.id)
                      : undefined;
                  const isPlantedInGarden = typeof plantedSlot === 'number';
                  const fishStage =
                    item.category === 'fish'
                      ? isGrowing
                        ? 'egg'
                        : 'adult'
                      : 'adult';
                  const createdDateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('vi-VN')
                    : 'Hôm nay';

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col justify-between gap-3 hover:border-[var(--accent)] transition-colors relative"
                    >
                      {isNew && (
                        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold shadow-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>Mới</span>
                        </span>
                      )}

                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                          {renderItem(
                            item.category,
                            item.seed,
                            item.rarity,
                            item.category === 'seed'
                              ? 0
                              : item.category === 'flower'
                              ? 4
                              : fishStage,
                            { size: 54, meta: item.meta }
                          )}
                        </div>
                        <div className="min-w-0 space-y-1 pr-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] font-bold">
                              {CATEGORY_LABELS[item.category].emoji}{' '}
                              {CATEGORY_LABELS[item.category].name}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                item.rarity === 'legendary'
                                  ? 'bg-amber-400/25 text-amber-700 dark:text-amber-300'
                                  : item.rarity === 'rare'
                                  ? 'bg-purple-400/20 text-purple-700 dark:text-purple-300'
                                  : 'bg-[var(--surface)] text-[var(--muted)]'
                              }`}
                            >
                              {RARITY_LABELS[item.rarity]}
                            </span>
                          </div>
                          <h4 className="font-serif-title text-base font-bold text-[var(--text)] leading-snug">
                            {item.category === 'seed'
                              ? formatSeedName(item.name)
                              : item.name}
                          </h4>
                          <p className="text-[10px] text-[var(--muted)]">
                            Ngày nhận: {createdDateStr}
                          </p>
                        </div>
                      </div>

                      {item.category === 'seed' ? (
                        isPlantedInGarden ? (
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                            <span>🌱 Đang gieo ở ô #{plantedSlot + 1}</span>
                            <span className="text-[10px] opacity-80">Không bán được</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                            🌱 Hạt giống Hoa chưa gieo — bấm <strong>Gieo ngay</strong> để trồng vào ô Vườn hoa và thu hoạch Hoa sau 30 phút.
                          </p>
                        )
                      ) : isGrowing ? (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Đang lớn, còn {formatCountdown(remainingGrowMs)}</span>
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                          {item.category === 'pet'
                            ? sanitizePetVibeNote(
                                item.vibeReason || item.description,
                                item.matchedTag,
                                item.petSpecies,
                                companionChar?.name
                              )
                            : item.category === 'flower'
                            ? '🌸 Hoa đã nở rực rỡ — sẵn sàng dùng để mở khóa nhân vật hoặc tặng người thương.'
                            : item.category === 'fish'
                            ? pondFishIdSet.has(item.id)
                              ? '🐟 Đang bơi lội trong Hồ cá đêm & sẵn sàng mở khóa.'
                              : '🐟 Đang ở trong Kho đồ — có thể thả xuống Hồ cá đêm hoặc mở khóa nhân vật.'
                            : '☕ Đang trưng trên kệ gỗ ở Quầy pha chế & sẵn sàng tặng người thương.'}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {item.category === 'seed' ? (
                          isPlantedInGarden ? (
                            <button
                              type="button"
                              onClick={() => setActiveZone('garden')}
                              className="flex-1 py-1.5 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-400/50 text-emerald-800 dark:text-emerald-200 transition-colors cursor-pointer"
                            >
                              🌱 Xem ô #{plantedSlot + 1} ở Vườn hoa
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenPlantModalForSeed(item.id)}
                              className="flex-1 py-1.5 rounded-full text-[11px] font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-2xs"
                            >
                              🌱 Gieo ngay
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (item.category === 'flower') setActiveZone('companion');
                              else if (item.category === 'fish') setActiveZone('pond');
                              else if (item.category === 'pet') setActiveZone('companion');
                              else setActiveZone('drinks');
                            }}
                            className="flex-1 py-1.5 rounded-full text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] transition-colors cursor-pointer"
                          >
                            {item.category === 'flower'
                              ? '🌸 Tặng ở Phòng tri kỷ'
                              : item.category === 'fish'
                              ? '🐟 Xem ở Hồ cá'
                              : item.category === 'pet'
                              ? '🐾 Đến Khu thú cưng'
                              : '☕ Đến Quầy thức uống'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 2: VƯỜN HOA THEO Ô (HẠT GIỐNG → GIEO VÀO Ô → CHỜ NỞ 30 PHÚT → THU HOẠCH)
         ===================================================================== */}
      {activeZone === 'garden' && (
        <div className="soft-card p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Flower2 className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
                  Vườn Hoa ({plantedBySlot.size}/{effectivePlotsCount} ô đang trồng)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent)]/25 text-[var(--text)]">
                  🌱 Hạt trong túi: {unplantedSeeds.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  🌸 Hoa đã thu hoạch: {ownedFlowers.length}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Chọn một ô trống để gieo hạt giống từ túi hoặc gieo hạt ngẫu nhiên (3 {coinCurrencyName}). Cây lớn qua 5 giai đoạn: <strong>Hạt → Nảy mầm → Cây con → Nụ → Nở</strong> trong 30 phút (6 phút/giai đoạn). Khi hoa nở rộ, bấm <strong>Thu hoạch</strong> để cất Hoa vào Kho đồ mở khóa nhân vật!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInvCategoryFilter('flower');
                  setActiveZone('gacha_inv');
                }}
                className="px-3.5 py-2 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1.5"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Xem Kho Hoa ({ownedFlowers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveZone('market')}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Store className="w-3.5 h-3.5" />
                <span>🌱 Mua Hạt giống ở Chợ</span>
              </button>
            </div>
          </div>

          {/* Cảnh báo thiếu Xu khi mua thêm ô vườn */}
          {plotBuyShortfallDiff !== null && plotBuyShortfallDiff > 0 && (
            <div className="p-4 rounded-2xl border-2 border-rose-400 bg-rose-500/10 text-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in">
              <div className="space-y-0.5">
                <p className="font-extrabold text-rose-600 dark:text-rose-300">
                  ⚠️ Chưa đủ {coinCurrencyName}, còn thiếu {plotBuyShortfallDiff} {coinCurrencyName} để mở thêm ô vườn mới!
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Hãy hoàn thành nhiệm vụ hằng ngày hoặc điểm danh ở Chợ nhỏ để nhận thêm {coinCurrencyName} nhé.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoToDailyQuests}
                  className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-xs cursor-pointer bouncy-btn"
                >
                  📋 Đi làm nhiệm vụ
                </button>
                <button
                  type="button"
                  onClick={() => setPlotBuyShortfallDiff(null)}
                  className="px-2.5 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] text-xs cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* Lưới các ô vườn (mặc định 10 ô, tối đa 40 ô) + Thẻ cuối "➕ Mua thêm ô vườn" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: effectivePlotsCount }, (_, slot) => {
              const plotRow = plantedBySlot.get(slot);
              const isJustBought = newlyBoughtPlotSlot === slot;

              // Ô TRỐNG
              if (!plotRow) {
                return (
                  <div
                    key={`plot-${slot}`}
                    className={`p-5 rounded-2xl border-2 border-dashed flex flex-col justify-between gap-4 min-h-[260px] transition-all ${
                      isJustBought
                        ? 'border-amber-400 bg-amber-500/10 ring-4 ring-amber-400/30 animate-pulse'
                        : 'border-[var(--border)] bg-[var(--bg)]/70 hover:border-[var(--accent)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--muted)]">
                        Ô vườn #{slot + 1}
                      </span>
                      {isJustBought ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/30 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold">
                          ✨ Ô mới mở!
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[10px] text-[var(--muted)]">
                          Ô trống
                        </span>
                      )}
                    </div>

                    <div className="py-4 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-2xl shadow-2xs">
                        🌱
                      </div>
                      <p className="text-xs font-bold text-[var(--text)]">
                        Đất mềm sẵn sàng gieo hạt
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {unplantedSeeds.length > 0
                          ? `Bạn có ${unplantedSeeds.length} hạt giống trong túi`
                          : 'Gieo hạt từ túi hoặc gieo ngẫu nhiên'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenPlantModalForSeed(null, slot)}
                      className="w-full py-2.5 rounded-full text-xs font-extrabold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <span>🌱 Gieo hạt</span>
                    </button>
                  </div>
                );
              }

              // Ô ĐANG TRỒNG
              const seedItem = inventory.find((it) => it.id === plotRow.seed_id);
              const { stage, isBloomed, remainingMs, progressPercent } =
                computePlotGardenStage(plotRow.planted_at, nowMs);
              const flowerName = formatFlowerNameFromSeed(
                seedItem?.name || `Hoa Ô #${slot + 1}`
              );
              const rarity: ItemRarity = seedItem?.rarity || 'common';
              const visualSeed = seedItem?.seed || `${flowerName}_${plotRow.seed_id}`;
              const isWatered = wateredPlotSlots.has(slot);
              const isHarvestingThis = harvestingSlot === slot;

              return (
                <div
                  key={`plot-${slot}`}
                  className={`p-5 rounded-2xl border bg-[var(--bg)] flex flex-col justify-between gap-3.5 min-h-[260px] transition-all relative overflow-hidden ${
                    isBloomed
                      ? 'border-2 border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/25'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--muted)] font-bold">
                        Ô vườn #{slot + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rarity === 'legendary'
                            ? 'bg-amber-400/25 text-amber-700 dark:text-amber-300'
                            : rarity === 'rare'
                            ? 'bg-purple-400/20 text-purple-700 dark:text-purple-300'
                            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >
                        {RARITY_LABELS[rarity]}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span>
                        Giai đoạn ({stage + 1}/5):{' '}
                        <strong className="text-[var(--text)]">
                          {GARDEN_STAGE_NAMES[stage]}
                        </strong>
                      </span>
                      <span className="font-mono text-[10px] font-bold text-[var(--accent)]">
                        {progressPercent}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isBloomed ? 'bg-emerald-500' : 'bg-[var(--accent)]'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Hình SVG phát triển theo seed và 5 giai đoạn + Tên riêng của hoa */}
                  <div className="py-1 flex flex-col items-center justify-center gap-1.5 relative">
                    {isWatered && (
                      <span className="absolute -top-1 right-2 text-xs animate-bounce pointer-events-none">
                        💧✨
                      </span>
                    )}
                    {renderItem('flower', visualSeed, rarity, stage, {
                      size: 88,
                    })}
                    <h4 className="font-serif-title text-sm font-bold text-[var(--text)] text-center leading-snug line-clamp-2">
                      {flowerName}
                    </h4>
                  </div>

                  {/* Đồng hồ đếm ngược, nút Tưới nước & nút Thu hoạch */}
                  <div className="space-y-2">
                    {!isBloomed ? (
                      <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-[11px]">
                        <span className="text-[var(--muted)] inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[var(--accent)]" />
                          <span>Nở sau:</span>
                        </span>
                        <span className="font-bold text-[var(--text)] font-mono tabular-nums">
                          {formatCountdown(remainingMs)}
                        </span>
                      </div>
                    ) : (
                      <div className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-center text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        🌸 Đã nở rộ! Sẵn sàng thu hoạch
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleWaterGardenPlot(slot, flowerName)}
                        className={`w-full py-1.5 rounded-full text-[11px] font-bold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                          isWatered
                            ? 'bg-[var(--surface)] border border-[var(--accent)] text-[var(--text)]'
                            : 'bg-[var(--accent)]/20 text-[var(--text)] hover:bg-[var(--accent)] hover:text-[#3a2b30]'
                        }`}
                      >
                        <Droplets className="w-3.5 h-3.5" />
                        <span>
                          {isWatered ? '💧 Đã tưới mát lành' : '💧 Tưới nước'}
                        </span>
                      </button>

                      {isBloomed && (
                        <button
                          type="button"
                          disabled={isHarvestingThis}
                          onClick={() => handleHarvestGardenPlot(slot, seedItem)}
                          className="w-full py-2 rounded-full text-xs font-extrabold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {isHarvestingThis ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isHarvestingThis ? 'Đang thu hoạch...' : '✨ Thu hoạch'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* THẺ CUỐI VƯỜN: ➕ Mua thêm ô vườn */}
            {effectivePlotsCount < 40 ? (
              <div className="p-5 rounded-2xl border-2 border-dashed border-amber-400/70 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col justify-between gap-4 min-h-[260px] transition-all">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-300">
                    Mở rộng vườn
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold">
                    {effectivePlotsCount}/40 ô
                  </span>
                </div>

                <div className="py-3 flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center shadow-2xs">
                    <Plus className="w-7 h-7" />
                  </div>
                  <h4 className="font-serif-title text-base font-bold text-[var(--text)]">
                    ➕ Mua thêm ô vườn
                  </h4>
                  <p className="text-xs font-bold text-[var(--accent)]">
                    {effectiveMarketTexts.plot}
                  </p>
                  <p className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                    Giá:{' '}
                    {isOwner
                      ? 'Miễn phí (Chủ web)'
                      : `${20 + (effectivePlotsCount - 10) * 10} ${coinCurrencyName}`}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Mở thêm ô đất mới để gieo được nhiều hoa cùng lúc hơn (tối đa 40 ô).
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isBuyingPlot}
                  onClick={handleBuyExtraPlot}
                  className="w-full py-2.5 rounded-full text-xs font-extrabold bg-amber-400 text-stone-900 hover:brightness-105 bouncy-btn cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isBuyingPlot ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isOwner
                      ? '➕ Mở thêm ô (Miễn phí)'
                      : `➕ Mua thêm ô (${20 + (effectivePlotsCount - 10) * 10} ${coinCurrencyName})`}
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col items-center justify-center text-center gap-2 min-h-[260px]">
                <span className="text-2xl">🌸✨</span>
                <p className="text-xs font-bold text-[var(--text)]">
                  Đã mở tối đa 40/40 ô vườn!
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Khu vườn của bạn đã rộng rãi hết cỡ rồi nhé.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 3: HỒ CÁ ĐÊM (CÂU CÁ 5 GIÂY fish_cast/fish_catch & THẢ CÁ pond_fish)
         ===================================================================== */}
      {activeZone === 'pond' && (
        <div className="space-y-6">
          <div className="soft-card p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Fish className="w-5 h-5 text-[var(--accent)]" />
                  <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
                    Hồ Cá Đêm ({pondFishItems.length} chú cá đang bơi)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent)]/25 text-[var(--text)]">
                    🎣 Còn {freeCastsLeft} lượt câu miễn phí hôm nay (làm mới 7 giờ sáng)
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Thả cần câu để săn hộp quà 🎁 trôi qua lại trong 5 giây! Cá mới nhận được cất vào Kho đồ — bấm <strong>➕ Thả cá vào hồ</strong> để chọn những chú cá bạn muốn cho bơi trong hồ nhé.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Nút Thả cần câu */}
                <button
                  type="button"
                  onClick={handleClickCastButton}
                  disabled={
                    fishingPhase === 'dropping' ||
                    fishingPhase === 'active' ||
                    fishingPhase === 'catching'
                  }
                  className="px-4 py-2.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-stone-900 shadow-xs hover:brightness-105 bouncy-btn cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <span>
                    {fishingPhase === 'dropping'
                      ? '🎣 Đang thả dây câu...'
                      : fishingPhase === 'active'
                      ? '🎁 Bấm vào hộp quà dưới hồ!'
                      : fishingPhase === 'catching'
                      ? '✨ Đang kéo quà lên...'
                      : freeCastsLeft > 0 || isOwner
                      ? '🎣 Thả cần'
                      : `🎣 Câu thêm (5 ${coinCurrencyName})`}
                  </span>
                </button>

                {/* Nút ➕ Thả cá vào hồ */}
                <button
                  type="button"
                  onClick={() => {
                    if (!currentUser || currentUser.role === 'guest') {
                      onRequireAuth?.('Mời bạn đăng nhập để thả cá vào hồ nhé 🐟');
                      return;
                    }
                    setSelectedFishIdsToRelease(
                      unreleasedFishItems.map((f) => f.id)
                    );
                    setReleaseFishModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    ➕ Thả cá vào hồ ({unreleasedFishItems.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleBuyFishFood}
                  className="px-3.5 py-2 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>+3 Hạt cá (-8 {currencyEmoji})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveZone('market')}
                  className="px-3.5 py-2 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--accent)]/20 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Chợ cá</span>
                </button>
              </div>
            </div>

            {/* Thanh thông tin lượt câu miễn phí hôm nay */}
            <div className="px-4 py-2.5 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span>🎣</span>
                <span className="font-bold text-[var(--text)]">
                  Còn {freeCastsLeft} lượt câu miễn phí hôm nay (làm mới 7 giờ sáng)
                </span>
                {freeCastsLeft === 0 && !isOwner && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    · Hết lượt miễn phí, câu thêm tốn 5 {coinCurrencyName}/lượt
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                <span>🐟 Hạt cá: <strong className="text-[var(--text)]">{roomState.fishFoodCount}</strong></span>
                <span>📦 Cá chờ thả trong kho: <strong className="text-[var(--text)]">{unreleasedFishItems.length}</strong></span>
              </div>
            </div>

            {/* Cảnh báo thiếu Xu khi câu thêm */}
            {castShortfallDiff !== null && castShortfallDiff > 0 && (
              <div className="p-4 rounded-2xl border-2 border-rose-400 bg-rose-500/10 text-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                <div className="space-y-0.5">
                  <p className="font-extrabold text-rose-600 dark:text-rose-300">
                    ⚠️ Chưa đủ {coinCurrencyName}, còn thiếu {castShortfallDiff} {coinCurrencyName} để câu thêm!
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Hoàn thành nhiệm vụ hằng ngày hoặc điểm danh để nhận thêm {coinCurrencyName} nhé.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoToDailyQuests}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-xs cursor-pointer bouncy-btn"
                  >
                    📋 Đi làm nhiệm vụ
                  </button>
                  <button
                    type="button"
                    onClick={() => setCastShortfallDiff(null)}
                    className="px-2.5 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] text-xs cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}

            {/* Mặt hồ SVG trực quan: Câu cá tương tác 5 giây + Cá trong pond_fish bơi chậm */}
            <div
              onClick={() => {
                // Nếu đang có hộp quà active mà bấm trượt ra ngoài mặt hồ -> hụt quà
                if (fishingPhase === 'active' && fishingSessionRef.current) {
                  handleFishingMiss(fishingSessionRef.current);
                }
              }}
              className={`relative h-72 rounded-2xl border-2 border-[var(--border)] bg-gradient-to-b from-[#9cc7ee]/25 via-[#89bdd8]/20 to-[#8fcfbf]/30 overflow-hidden p-4 select-none ${
                fishingPhase === 'active' ? 'cursor-crosshair ring-2 ring-amber-400/60' : ''
              }`}
            >
              {/* Sóng nước dịu */}
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div
                  className="w-32 h-32 rounded-full border border-[var(--accent)] absolute top-6 left-12 animate-ping"
                  style={{ animationDuration: '6s' }}
                />
                <div
                  className="w-40 h-40 rounded-full border border-[var(--accent)] absolute bottom-4 right-16 animate-ping"
                  style={{ animationDuration: '8s' }}
                />
              </div>

              {/* Hiệu ứng nước bắn khi vừa thả cá vào hồ */}
              {pondSplashEffect && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 animate-fade-in">
                  <div className="px-4 py-2 rounded-full bg-sky-500/20 border border-sky-300/60 backdrop-blur-xs text-xs font-extrabold text-[var(--text)] shadow-lg animate-bounce">
                    💦 Tủm! Các bé cá vừa nhảy xuống hồ mát lành ✨
                  </div>
                </div>
              )}

              {/* Hoạt ảnh dây câu SVG thả xuống mặt nước (~1 giây + vòng sóng lan) */}
              {(fishingPhase === 'dropping' ||
                fishingPhase === 'active' ||
                fishingPhase === 'catching') && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none z-20"
                  viewBox="0 0 400 220"
                  preserveAspectRatio="none"
                >
                  {/* Cần câu ở góc trên */}
                  <path
                    d="M 180 0 Q 195 25 200 42"
                    stroke="#8d6e63"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Dây câu thả xuống */}
                  <line
                    x1="200"
                    y1="42"
                    x2={fishingPhase === 'active' ? `${fishingBoxX * 4}` : '200'}
                    y2={fishingPhase === 'active' ? `${fishingBoxY * 2.2}` : '125'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    opacity="0.85"
                  />
                  {/* Vòng sóng lan nơi phao chạm nước */}
                  <ellipse
                    cx={fishingPhase === 'active' ? `${fishingBoxX * 4}` : '200'}
                    cy={fishingPhase === 'active' ? `${fishingBoxY * 2.2}` : '125'}
                    rx="18"
                    ry="6"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    opacity="0.65"
                  >
                    <animate
                      attributeName="rx"
                      values="8;28;8"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0.1;0.8"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </ellipse>
                </svg>
              )}

              {/* Trạng thái đang thả dây câu (~1s) */}
              {fishingPhase === 'dropping' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[var(--surface)]/95 border border-[var(--accent)] text-xs font-extrabold text-[var(--text)] shadow-md animate-pulse">
                  🎣 Dây câu đang chạm mặt nước... Chuẩn bị bấm vào hộp quà nhé!
                </div>
              )}

              {/* Hộp quà 🎁 chạy qua lại + vòng tròn đếm ngược ĐÚNG 5 GIÂY */}
              {fishingPhase === 'active' && (
                <>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-amber-400 text-stone-900 text-xs font-black shadow-md flex items-center gap-2">
                    <span>🎯 Bấm trúng hộp quà 🎁 trước khi hết giờ!</span>
                    <span className="font-mono bg-white/80 px-2 py-0.5 rounded-full text-[11px]">
                      {(fishingRemainingMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleFishingCatchSuccess}
                    style={{
                      left: `${fishingBoxX}%`,
                      top: `${fishingBoxY}%`,
                      transition: 'left 65ms linear, top 65ms linear',
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 w-16 h-16 rounded-full flex items-center justify-center cursor-pointer group focus:outline-none"
                    title="Bấm ngay để bắt hộp quà!"
                  >
                    {/* Vòng tròn SVG đếm ngược 5 giây */}
                    <svg className="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="rgba(255, 255, 255, 0.22)"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={
                          2 * Math.PI * 28 * (1 - fishingRemainingMs / 5000)
                        }
                      />
                    </svg>
                    <span className="relative text-3xl drop-shadow-md group-hover:scale-125 active:scale-95 transition-transform animate-bounce">
                      🎁
                    </span>
                  </button>
                </>
              )}

              {/* Thông báo khi hụt mất hộp quà */}
              {fishingPhase === 'missed' && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                  <div className="px-5 py-3 rounded-2xl bg-[var(--surface)]/95 border-2 border-amber-400 text-center space-y-1 shadow-xl animate-fade-in">
                    <div className="text-2xl animate-bounce">🎁💨</div>
                    <p className="text-xs font-extrabold text-[var(--text)]">
                      {fishingMissMessage || 'Hụt mất quà rồi, thử lại nhé 🥺'}
                    </p>
                  </div>
                </div>
              )}

              {/* Cá đang bơi trong hồ (chỉ hiển thị cá trong bảng pond_fish) */}
              {pondLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--muted)] gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent)]" />
                  <span>Đang tải Hồ cá đêm...</span>
                </div>
              ) : pondFishItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-xs text-[var(--muted)]">
                  <p className="font-bold text-[var(--text)]">
                    Mặt hồ đêm đang tĩnh lặng 🐟
                  </p>
                  <p className="max-w-md">
                    {unreleasedFishItems.length > 0
                      ? `Bạn đang có ${unreleasedFishItems.length} bé cá trong Kho đồ chờ thả xuống hồ. Hãy bấm nút "➕ Thả cá vào hồ" phía trên nhé!`
                      : 'Hãy bấm "🎣 Thả cần" để câu quà hoặc ghé Chợ nhỏ rước cá về thả xuống hồ nhé!'}
                  </p>
                </div>
              ) : (
                pondFishItems.map((fish, idx) => {
                  const readyMs = fish.readyAt ? new Date(fish.readyAt).getTime() : 0;
                  const isEgg = Boolean(
                    fish.readyAt && !Number.isNaN(readyMs) && readyMs > nowMs
                  );
                  const topPercent = 16 + ((idx * 23) % 62);
                  const swimOffset = (idx * 19) % 80;
                  const leftPercent = isEgg
                    ? 14 + ((idx * 17) % 72)
                    : (swimOffset + Math.floor(nowMs / 1000) * 2) % 82;
                  const care = fishCareMap[fish.id];
                  const isFull = (care?.fullUntil || 0) > nowMs;

                  return (
                    <div
                      key={fish.id}
                      style={{
                        top: `${topPercent}%`,
                        left: `${leftPercent}%`,
                        transition: 'left 1.2s linear, top 1s ease',
                      }}
                      className="absolute flex flex-col items-center group z-10"
                    >
                      {(care?.pendingPetals || 0) > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCollectFishPetals(fish);
                          }}
                          className="mb-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-[#3a2b30] text-[10px] font-bold shadow-sm animate-bounce cursor-pointer"
                        >
                          +{care?.pendingPetals} {currencyEmoji}
                        </button>
                      )}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFeedFish(fish);
                        }}
                        title={`Bấm để cho "${fish.name}" ăn`}
                        className="cursor-pointer hover:scale-110 transition-transform"
                      >
                        {renderItem(
                          'fish',
                          fish.seed,
                          fish.rarity,
                          isEgg ? 'egg' : 'adult',
                          { size: isEgg ? 44 : 60 }
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--surface)]/90 border border-[var(--border)] text-[10px] font-bold text-[var(--text)] whitespace-nowrap shadow-2xs">
                        {fish.name} {isEgg ? '🥚' : isFull ? '💛' : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Danh sách chi tiết từng chú cá đang bơi trong hồ (pond_fish) */}
            {pondFishItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pondFishItems.map((fish) => {
                  const readyMs = fish.readyAt ? new Date(fish.readyAt).getTime() : 0;
                  const isEgg = Boolean(
                    fish.readyAt && !Number.isNaN(readyMs) && readyMs > nowMs
                  );
                  const remainingMs = isEgg ? Math.max(0, readyMs - nowMs) : 0;
                  const care = fishCareMap[fish.id];
                  const isFull = (care?.fullUntil || 0) > nowMs;
                  const isTakingOut = takingOutFishId === fish.id;

                  return (
                    <div
                      key={fish.id}
                      className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                          {renderItem(
                            'fish',
                            fish.seed,
                            fish.rarity,
                            isEgg ? 'egg' : 'adult',
                            { size: 48 }
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]">
                              {isEgg ? '🥚 Trứng nổi trên hồ' : '🐟 Đang bơi trong hồ'}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--muted)]">
                              {RARITY_LABELS[fish.rarity]}
                            </span>
                          </div>
                          <h4 className="font-serif-title text-base font-bold text-[var(--text)] truncate mt-0.5">
                            {fish.name}
                          </h4>
                          <p className="text-[11px] text-[var(--muted)]">
                            {isEgg
                              ? `Đang ấp nở, còn ${formatCountdown(remainingMs)}`
                              : isFull
                              ? 'Đang no bụng & bơi lội vui vẻ ✨'
                              : 'Đang bơi chậm trong hồ'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFeedFish(fish)}
                          className="flex-1 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer bouncy-btn"
                        >
                          🐟 Cho ăn
                        </button>

                        <button
                          type="button"
                          disabled={isTakingOut}
                          onClick={() => handleTakeOutFish(fish)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[var(--text)] cursor-pointer disabled:opacity-50"
                          title="Nhấc cá khỏi hồ cất về Kho đồ"
                        >
                          {isTakingOut ? 'Đang nhấc...' : 'Nhấc lên'}
                        </button>

                        {(care?.pendingPetals || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => handleCollectFishPetals(fish)}
                            className="px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] cursor-pointer"
                          >
                            +{care?.pendingPetals} {currencyEmoji}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 4: KHU THÚ CƯNG & PHÒNG TRI KỶ (XƯNG HÔ & GIỌNG VĂN THEO CHAR)
         ===================================================================== */}
      {activeZone === 'companion' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Căn phòng của Char đồng hành */}
            <div className="lg:col-span-7 soft-card p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] flex items-center gap-2">
                    <Heart className="w-5 h-5 text-[var(--accent)]" />
                    <span>Phòng Tri Kỷ Của {companionChar?.name}</span>
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Chọn nhân vật đồng hành, tặng hoa/thức uống và trò chuyện để mở khóa thoại gắn bó mới.
                  </p>
                </div>

                <select
                  value={roomState.companionCharId}
                  onChange={(e) => handleSelectCompanionChar(e.target.value)}
                  className="px-3.5 py-2 rounded-full bg-[var(--bg)] border border-[var(--border)] text-xs font-bold text-[var(--text)] cursor-pointer"
                >
                  {characters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      Đồng hành: {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chỉ số Gắn bó & Vui vẻ + Vibe Tags của Char */}
              <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-serif-title font-bold text-white shrink-0"
                      style={{
                        backgroundColor:
                          companionChar?.avatarTint || '#3a2d38',
                      }}
                    >
                      {companionChar?.avatarSymbol}
                    </div>
                    <div>
                      <div className="font-serif-title text-lg font-bold text-[var(--text)]">
                        {companionChar?.name}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {companionChar?.tags.map((t) => (
                          <span
                            key={t}
                            className="sticker-chip text-[10px] py-0.2 px-2"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <span className="text-[var(--muted)]">Gắn bó: </span>
                      <strong className="text-[var(--text)]">
                        💗 {roomState.bondPoints} điểm
                      </strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <span className="text-[var(--muted)]">Vui vẻ: </span>
                      <strong className="text-[var(--text)]">
                        ✨ {roomState.happiness}%
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Thông tin Văn phong theo Tag & Cặp xưng hô từ resolveAddress(char) */}
                <div className="px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="text-[var(--muted)]">
                    <span className="font-bold text-[var(--text)]">
                      🎭 Giọng văn theo Tag:{' '}
                    </span>
                    <span className="text-[var(--accent)] font-bold">
                      {companionBlendedVoices.map((v) => v.tag).join(' + ')}
                    </span>
                    <span className="ml-1.5">
                      ({companionBlendedVoices[0]?.rhythm})
                    </span>
                  </div>
                  <span className="sticker-chip text-[10px] font-bold">
                    Xưng hô: {companionAddressPair.self} - {companionAddressPair.user}
                  </span>
                </div>

                {/* Khung thoại của Char */}
                <blockquote className="p-4 rounded-2xl bg-[var(--surface)] border-l-4 border-[var(--accent)] text-sm italic text-[var(--text)] leading-relaxed">
                  {activeDialogueText}
                </blockquote>

                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                    <span>
                      Mốc gắn bó:{' '}
                      <strong className="text-[var(--text)]">
                        {roomState.bondPoints >= 70
                          ? 'Mốc 3: Tri kỷ đêm khuya (Đã mở thoại gắn bó sâu ✨)'
                          : roomState.bondPoints >= 30
                          ? 'Mốc 2: Thân thiết (Đạt 70 điểm mở thoại Tri kỷ)'
                          : 'Mốc 1: Làm quen (Đạt 30 điểm mở thoại Thân thiết)'}
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleChatWithCompanion('greeting')}
                      className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] cursor-pointer"
                    >
                      👋 Chào hỏi
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChatWithCompanion('chat')}
                      className="px-4 py-2 rounded-full bg-[var(--accent)] text-[#3a2b30] text-xs font-bold bouncy-btn cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Trò chuyện (+4 Gắn bó)</span>
                    </button>

                    {roomState.bondPoints >= 70 && (
                      <button
                        type="button"
                        onClick={() => handleChatWithCompanion('high_bond')}
                        className="px-3.5 py-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent)]/20 text-xs font-bold text-[var(--text)] hover:bg-[var(--accent)] hover:text-[#3a2b30] cursor-pointer"
                      >
                        💗 Tâm sự gắn bó cao
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => triggerCompanionDialogue('farewell')}
                      className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-xs text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                    >
                      🌙 Tạm biệt
                    </button>
                  </div>
                </div>
              </div>

              {/* Tặng Hoa hoặc Thức uống nhanh trong phòng */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-[var(--muted)]">
                  🎁 Tặng Hoa hoặc Thức uống cho {companionChar?.name}:
                </h4>
                {ownedFlowers.length === 0 && barDrinks.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] italic">
                    Bạn chưa có Hoa hoặc Thức uống nào sẵn sàng. Hãy ghé Chợ nhỏ hoặc mở Gacha nhé!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...ownedFlowers, ...barDrinks].slice(0, 8).map((gift) => (
                      <button
                        key={gift.id}
                        type="button"
                        onClick={() => handleGiftItemToCompanion(gift)}
                        className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] text-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span>{CATEGORY_LABELS[gift.category].emoji}</span>
                        <span className="font-semibold text-[var(--text)]">
                          {gift.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Khu Thú cưng: hiển thị MỌI món kind = 'pet' trong inventory */}
            <div className="lg:col-span-5 soft-card p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                    <PawPrint className="w-5 h-5 text-[var(--accent)]" />
                    <span>Khu Thú Cưng ({ownedPets.length})</span>
                  </h3>

                  <button
                    type="button"
                    onClick={handleBuyPetFood}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
                  >
                    +3 Thức ăn thú (-8 {currencyEmoji})
                  </button>
                </div>

                {/* Lời nhận xét riêng của nhân vật đồng hành về thú cưng (dùng đúng cặp xưng-gọi, không tự xưng bằng tên riêng) */}
                {companionPetComment && (
                  <div className="p-3 rounded-2xl bg-[var(--bg)] border-l-4 border-[var(--accent)] text-xs italic text-[var(--text)] leading-relaxed">
                    <span className="font-bold not-italic text-[var(--accent)] mr-1">
                      💬 {companionChar?.name}:
                    </span>
                    {companionPetComment}
                  </div>
                )}

                {/* Sân nhỏ cho thú cưng đi lang thang */}
                <div className="relative h-48 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] overflow-hidden p-3">
                  {ownedPets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--muted)] text-center px-4 gap-2">
                      <span>Chưa có bé thú cưng nào trong khu chăm sóc 🐾</span>
                      <button
                        type="button"
                        onClick={() => setActiveZone('market')}
                        className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[11px] cursor-pointer"
                      >
                        🛒 Đón thú cưng ở Chợ
                      </button>
                    </div>
                  ) : (
                    ownedPets.map((pet, idx) => {
                      const behavior = pet.petBehaviorStyle || 'gentle_sway';
                      const speedDivisor =
                        behavior === 'calm_slow'
                          ? 2800
                          : behavior === 'playful_bouncy'
                          ? 950
                          : behavior === 'energetic_dash'
                          ? 1100
                          : 1700;
                      const stepTick = Math.floor(nowMs / speedDivisor);
                      const baseTop = 14 + ((idx * 27) % 52);
                      const bounceOffset =
                        behavior === 'playful_bouncy'
                          ? (stepTick + idx) % 2 === 0
                            ? -6
                            : 4
                          : behavior === 'energetic_dash'
                          ? (stepTick + idx) % 2 === 0
                            ? -4
                            : 2
                          : behavior === 'mystic_float'
                          ? Math.sin(nowMs / 1000 + idx) * 4
                          : 0;
                      const topPos = Math.max(8, Math.min(68, baseTop + bounceOffset));
                      const leftPos =
                        (idx * 23 +
                          stepTick *
                            (behavior === 'calm_slow'
                              ? 2
                              : behavior === 'playful_bouncy'
                              ? 5
                              : 3)) %
                        76;
                      const pStats = getPetStats(pet.id);
                      const isSpeaking =
                        activePetSpeech?.petId === pet.id ||
                        (stepTick + idx) % 5 === 0;

                      return (
                        <div
                          key={pet.id}
                          style={{
                            top: `${topPos}%`,
                            left: `${leftPos}%`,
                            transition:
                              behavior === 'calm_slow'
                                ? 'left 2.6s linear, top 2s ease'
                                : behavior === 'playful_bouncy'
                                ? 'left 0.9s ease-in-out, top 0.45s ease-out'
                                : 'left 1.6s ease-in-out, top 1.2s ease-in-out',
                          }}
                          onClick={() => handleStrokePet(pet.id)}
                          title="Bấm để vuốt ve & nghe tiếng kêu của bé thú cưng"
                          className="absolute flex flex-col items-center cursor-pointer hover:scale-110 transition-transform"
                        >
                          {isSpeaking && pet.petSound && (
                            <span className="mb-0.5 px-2 py-0.5 rounded-full bg-[var(--accent)]/90 text-[#3a2b30] text-[9px] font-bold whitespace-nowrap shadow-2xs">
                              {pet.petSound}
                            </span>
                          )}
                          {renderItem('pet', pet.seed, pet.rarity, 4, { size: 48 })}
                          <span className="px-2 py-0.5 rounded-full bg-[var(--surface)]/95 border border-[var(--border)] text-[10px] font-bold text-[var(--text)] whitespace-nowrap">
                            {pet.name} {pStats.fullness >= 70 ? '❤️' : '🥣'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Danh sách chi tiết từng bé thú cưng với Độ no, Niềm vui, Cho ăn & Vuốt ve */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {ownedPets.map((pet) => {
                    const pStats = getPetStats(pet.id);
                    const cleanPetNote = sanitizePetVibeNote(
                      pet.vibeReason || pet.description,
                      pet.matchedTag,
                      pet.petSpecies,
                      companionChar?.name
                    );
                    return (
                      <div
                        key={pet.id}
                        className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                              {renderItem('pet', pet.seed, pet.rarity, 4, {
                                size: 42,
                              })}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[var(--text)] truncate">
                                {pet.name}
                              </div>
                              <div className="text-[10px] text-[var(--muted)]">
                                {pet.petSpecies ? `${pet.petSpecies} · ` : ''}
                                {RARITY_LABELS[pet.rarity]}
                              </div>
                              <div className="flex items-center gap-2.5 mt-1 text-[10px] font-semibold">
                                <span className="text-amber-600 dark:text-amber-400">
                                  🥣 Độ no: {pStats.fullness}%
                                </span>
                                <span className="text-rose-500 dark:text-rose-400">
                                  💗 Niềm vui: {pStats.happiness}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStrokePet(pet.id)}
                              className="px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold text-[10px] cursor-pointer hover:border-[var(--accent)]"
                            >
                              🐾 Vuốt ve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedPet(pet.id)}
                              className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[10px] cursor-pointer bouncy-btn"
                            >
                              🍖 Cho ăn
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-[var(--muted)] bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)]">
                          ✨ {cleanPetNote}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bảng tra cứu Vibe Tag -> Thú cưng */}
              <div className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--muted)] space-y-1">
                <div className="font-bold text-[var(--text)]">
                  📖 Một số Vibe Tag &amp; Loài Thú Cưng Tiêu Biểu:
                </div>
                {effectiveTagPets.slice(0, 5).map((m) => (
                  <div key={m.id}>
                    • Tag <strong>{m.tag}</strong> → {m.speciesList.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 5: QUẦY PHA CHẾ (brew_start / brew_collect / brew_orders) & KỆ GỖ NHIỀU TẦNG
         ===================================================================== */}
      {activeZone === 'drinks' && (
        <div className="space-y-6">
          {/* A. QUẦY PHA CHẾ CÔNG THỨC RIÊNG (1 PHÚT) */}
          <div className="soft-card p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Coffee className="w-5 h-5 text-[var(--accent)]" />
                  <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
                    Quầy Pha Chế &amp; Kệ Trưng Bày
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent)]/25 text-[var(--text)]">
                    ☕ Còn {freeBrewsLeft} ly pha miễn phí hôm nay (làm mới 7 giờ sáng)
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Tự tay chọn nền đồ uống, hương phụ, topping và sắc màu ly. Mỗi mẻ pha mất <strong>1 phút</strong> — khi hoàn tất, thức uống sẽ <strong>tự động cất vào Kho đồ và đặt lên Kệ trưng bày</strong>!
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveZone('market')}
                className="px-4 py-2 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--accent)]/20 cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <Store className="w-4 h-4" />
                <span>🛒 Mua nước pha sẵn ở Chợ</span>
              </button>
            </div>

            {/* Cảnh báo thiếu Xu khi pha thêm */}
            {brewShortfallDiff !== null && brewShortfallDiff > 0 && (
              <div className="p-4 rounded-2xl border-2 border-rose-400 bg-rose-500/10 text-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                <div className="space-y-0.5">
                  <p className="font-extrabold text-rose-600 dark:text-rose-300">
                    ⚠️ Chưa đủ {coinCurrencyName}, còn thiếu {brewShortfallDiff} {coinCurrencyName} để pha thêm ly mới!
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Hoàn thành nhiệm vụ hằng ngày hoặc điểm danh ở Chợ nhỏ để nhận thêm {coinCurrencyName} nhé.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoToDailyQuests}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-xs cursor-pointer bouncy-btn"
                  >
                    📋 Đi làm nhiệm vụ
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrewShortfallDiff(null)}
                    className="px-2.5 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] text-xs cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}

            {/* Bàn chọn công thức pha chế + Xem trước ly SVG */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-4">
                {/* 1. Chọn nền (base) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text)]">
                    1. Chọn nền thức uống:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BREW_BASE_OPTIONS.map((opt) => {
                      const active = brewBase === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            setBrewBase(opt.label);
                            setBrewColor(opt.defaultColor);
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[var(--accent)] text-[#3a2b30] border-[var(--accent)] shadow-2xs'
                              : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Chọn hương phụ (flavor) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text)]">
                    2. Chọn hương phụ:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BREW_FLAVOR_OPTIONS.map((flav) => {
                      const active = brewFlavor === flav;
                      return (
                        <button
                          key={flav}
                          type="button"
                          onClick={() => setBrewFlavor(flav)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[var(--accent)]/30 border-[var(--accent)] text-[var(--text)] font-bold'
                              : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                          }`}
                        >
                          {flav}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Chọn topping */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text)]">
                    3. Chọn topping:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BREW_TOPPING_OPTIONS.map((top) => {
                      const active = brewTopping === top;
                      return (
                        <button
                          key={top}
                          type="button"
                          onClick={() => setBrewTopping(top)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer capitalize ${
                            active
                              ? 'bg-amber-400/30 border-amber-400 text-[var(--text)]'
                              : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                          }`}
                        >
                          ✨ {top}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Sắc màu nước */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text)]">
                    4. Sắc màu ly nước:
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {BREW_COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setBrewColor(hex)}
                        style={{ backgroundColor: hex }}
                        className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                          brewColor === hex
                            ? 'border-[var(--text)] scale-125 shadow-sm'
                            : 'border-white/70 hover:scale-110'
                        }`}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Khung xem trước ly chuẩn bị pha + Nút Bắt đầu pha */}
              <div className="lg:col-span-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col items-center text-center space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Công thức đang chọn
                </span>
                <div className="w-24 h-24 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-inner">
                  {renderItem(
                    'drink',
                    `${brewBase}_${brewFlavor}_${brewTopping}_${brewColor}`,
                    'rare',
                    4,
                    {
                      size: 74,
                      meta: {
                        base: brewBase,
                        flavor: brewFlavor,
                        topping: brewTopping,
                        color: brewColor,
                      },
                    }
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-serif-title text-base font-bold text-[var(--text)]">
                    {brewBase} {brewFlavor}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">
                    Topping: <strong>{brewTopping}</strong> · Thời gian pha: <strong>1 phút</strong>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isStartingBrew || brewOrders.length >= 3}
                  onClick={handleStartBrew}
                  className="w-full py-3 rounded-full text-xs font-extrabold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isStartingBrew ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Coffee className="w-4 h-4" />
                  )}
                  <span>
                    {brewOrders.length >= 3
                      ? 'Đang pha tối đa 3/3 ly'
                      : freeBrewsLeft > 0 || isOwner
                      ? '☕ Bắt đầu pha'
                      : `☕ Pha thêm (3 ${coinCurrencyName})`}
                  </span>
                </button>

                <p className="text-[10.5px] text-[var(--muted)]">
                  Còn {freeBrewsLeft} ly pha miễn phí hôm nay (làm mới 7 giờ sáng)
                </p>
              </div>
            </div>

            {/* Khay các ly đang pha (tối đa 3 ly cùng lúc, đếm ngược 1 phút theo ready_at từ server) */}
            {brewOrders.length > 0 && (
              <div className="pt-4 border-t border-[var(--border)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-[var(--text)] flex items-center gap-1.5">
                    <span>⏳ Quầy đang pha ({brewOrders.length}/3 ly):</span>
                  </h4>
                  <span className="text-[11px] text-[var(--muted)]">
                    Tự động thu thập &amp; treo lên kệ ngay khi đếm ngược về 00:00 ✨
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {brewOrders.map((ord) => {
                    const readyMs = ord.ready_at ? new Date(ord.ready_at).getTime() : 0;
                    const remainMs = Math.max(0, readyMs - nowMs);
                    const totalMs = 60 * 1000;
                    const fillPercent = Math.min(
                      100,
                      Math.max(8, Math.round(((totalMs - remainMs) / totalMs) * 100))
                    );
                    const rec = ord.recipe || {};
                    const title = `${rec.base || 'Thức uống'} ${rec.flavor || ''}`.trim();

                    return (
                      <div
                        key={ord.id}
                        className="p-4 rounded-2xl border-2 border-amber-400/60 bg-[var(--bg)] flex items-center gap-3.5 shadow-xs"
                      >
                        {/* Hình ly đang đầy dần */}
                        <div className="relative w-14 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden flex items-center justify-center shrink-0">
                          <div
                            className="absolute bottom-0 inset-x-0 transition-all duration-500 opacity-35"
                            style={{
                              height: `${fillPercent}%`,
                              backgroundColor: rec.color || '#d7b399',
                            }}
                          />
                          <div className="relative z-10">
                            {renderItem(
                              'drink',
                              `${rec.base}_${rec.flavor}_${rec.topping}_${ord.id}`,
                              'rare',
                              fillPercent >= 100 ? 4 : 2,
                              {
                                size: 44,
                                meta: rec as unknown as Record<string, unknown>,
                              }
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-[var(--text)] truncate">
                              {title}
                            </p>
                            <span className="font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
                              {formatCountdown(remainMs)}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-[var(--muted)] truncate">
                            Topping: {rec.topping || 'kem mây'} · Đang rót {fillPercent}%
                          </p>
                          <div className="w-full h-2 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${fillPercent}%`,
                                backgroundColor: rec.color || '#d7b399',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* B. KỆ TRƯNG BÀY GỖ NHIỀU TẦNG (HIỂN THỊ TẤT CẢ LY TRONG INVENTORY kind = 'drink', MỚI NHẤT TRƯỚC) */}
          <div className="soft-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h4 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                  <span>🪵 Kệ Trưng Bày Thức Uống ({ownedDrinks.length} ly)</span>
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Tất cả thức uống bạn đã pha hoặc sưu tầm trong Kho đồ được xếp trên kệ gỗ nhiều tầng (mới nhất trước). Rê chuột hoặc chạm vào từng ly để xem công thức và tặng cho người thương!
                </p>
              </div>

              {ownedDrinks.length > 12 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    disabled={shelfPage <= 0}
                    onClick={() => setShelfPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--bg)] font-bold text-[var(--text)] cursor-pointer disabled:opacity-40"
                  >
                    ← Trang trước
                  </button>
                  <span className="font-bold text-[var(--muted)]">
                    Trang {shelfPage + 1}/{Math.ceil(ownedDrinks.length / 12)}
                  </span>
                  <button
                    type="button"
                    disabled={(shelfPage + 1) * 12 >= ownedDrinks.length}
                    onClick={() =>
                      setShelfPage((p) =>
                        Math.min(Math.ceil(ownedDrinks.length / 12) - 1, p + 1)
                      )
                    }
                    className="px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--bg)] font-bold text-[var(--text)] cursor-pointer disabled:opacity-40"
                  >
                    Trang sau →
                  </button>
                </div>
              )}
            </div>

            {ownedDrinks.length === 0 ? (
              <div className="py-12 rounded-2xl border-2 border-dashed border-[#a67c52]/40 bg-[#a67c52]/5 text-center space-y-2">
                <p className="text-sm font-bold text-[var(--text)]">
                  Kệ gỗ trưng bày đang chờ những ly nước đầu tiên ☕
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Hãy chọn công thức phía trên và bấm &quot;Bắt đầu pha&quot; để ly nước thơm lừng tự động đáp lên kệ nhé!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Chia kệ gỗ thành các tầng (mỗi tầng tối đa 6 ly, có thanh cuộn ngang trên màn hình nhỏ) */}
                {[0, 1].map((tierIdx) => {
                  const pageDrinks = ownedDrinks.slice(
                    shelfPage * 12,
                    (shelfPage + 1) * 12
                  );
                  const tierDrinks = pageDrinks.slice(
                    tierIdx * 6,
                    (tierIdx + 1) * 6
                  );
                  if (tierDrinks.length === 0 && tierIdx > 0) return null;

                  return (
                    <div
                      key={`shelf-tier-${tierIdx}`}
                      className="rounded-3xl bg-gradient-to-b from-[#6d4c41]/10 via-[#8d6e63]/15 to-[#5d4037]/25 p-4 pt-5 border border-[#8d6e63]/35 shadow-inner"
                    >
                      <div className="flex items-end gap-4 overflow-x-auto pb-2 px-2">
                        {tierDrinks.map((drink) => {
                          const isJustLanded = newlyShelvedDrinkId === drink.id;
                          const isSelected = selectedShelfDrink?.id === drink.id;
                          const metaObj = (drink.meta || {}) as Record<
                            string,
                            unknown
                          >;
                          const recipeLabel =
                            metaObj.base || metaObj.flavor || metaObj.topping
                              ? `${metaObj.base || ''}${
                                  metaObj.flavor ? ` · ${metaObj.flavor}` : ''
                                }${
                                  metaObj.topping
                                    ? ` · Topping ${metaObj.topping}`
                                    : ''
                                }`
                              : drink.description;

                          return (
                            <div
                              key={drink.id}
                              onClick={() =>
                                setSelectedShelfDrink(
                                  isSelected ? null : drink
                                )
                              }
                              title={`${drink.name} — ${recipeLabel}`}
                              className={`group relative flex flex-col items-center min-w-[118px] p-2.5 rounded-2xl transition-all cursor-pointer ${
                                isJustLanded
                                  ? 'bg-amber-400/25 ring-2 ring-amber-400 animate-bounce'
                                  : isSelected
                                  ? 'bg-[var(--surface)] ring-2 ring-[var(--accent)] shadow-md'
                                  : 'hover:bg-[var(--surface)]/80 hover:-translate-y-1'
                              }`}
                            >
                              {isJustLanded && (
                                <span className="absolute -top-2 right-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black shadow-xs">
                                  Vừa lên kệ ✨
                                </span>
                              )}

                              <div className="w-16 h-16 flex items-center justify-center">
                                {renderItem(
                                  'drink',
                                  drink.seed,
                                  drink.rarity,
                                  4,
                                  {
                                    size: 58,
                                    meta: drink.meta,
                                  }
                                )}
                              </div>

                              <span className="mt-1 text-[11px] font-bold text-[var(--text)] text-center line-clamp-1 max-w-[110px]">
                                {drink.name}
                              </span>
                              <span className="text-[9.5px] text-[var(--muted)] line-clamp-1 max-w-[110px]">
                                {metaObj.topping
                                  ? `Topping: ${String(metaObj.topping)}`
                                  : RARITY_LABELS[drink.rarity]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Thanh gỗ đỡ kệ */}
                      <div className="h-3.5 w-full rounded-full bg-gradient-to-r from-[#5d4037] via-[#8d6e63] to-[#5d4037] shadow-md border-t border-white/20" />
                    </div>
                  );
                })}

                {/* Khung chi tiết khi chạm/bấm vào 1 ly trên kệ */}
                {selectedShelfDrink && (
                  <div className="p-4 rounded-2xl border-2 border-[var(--accent)] bg-[var(--bg)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-center gap-3.5">
                      <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                        {renderItem(
                          'drink',
                          selectedShelfDrink.seed,
                          selectedShelfDrink.rarity,
                          4,
                          {
                            size: 54,
                            meta: selectedShelfDrink.meta,
                          }
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-serif-title text-base font-bold text-[var(--text)]">
                            {selectedShelfDrink.name}
                          </h5>
                          <span className="sticker-chip text-[10px] font-bold">
                            {RARITY_LABELS[selectedShelfDrink.rarity]}
                          </span>
                        </div>
                        {selectedShelfDrink.meta &&
                        (selectedShelfDrink.meta.base ||
                          selectedShelfDrink.meta.flavor ||
                          selectedShelfDrink.meta.topping) ? (
                          <p className="text-xs text-[var(--muted)]">
                            Công thức:{' '}
                            <strong className="text-[var(--text)]">
                              {String(selectedShelfDrink.meta.base || 'Đặc chế')}
                            </strong>
                            {selectedShelfDrink.meta.flavor
                              ? ` · Hương ${String(selectedShelfDrink.meta.flavor)}`
                              : ''}
                            {selectedShelfDrink.meta.topping
                              ? ` · Topping ${String(selectedShelfDrink.meta.topping)}`
                              : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--muted)]">
                            {selectedShelfDrink.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleGiftItemToCompanion(selectedShelfDrink)}
                        className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer"
                      >
                        💝 Mời {companionChar?.name || 'người thương'} thưởng thức
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedShelfDrink(null)}
                        className="px-3 py-2 rounded-full border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hộp chọn Gieo hạt cho Ô trống trong Vườn hoa */}
      {plantingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !isPlantingSeed && setPlantingModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                  <span>🌱 Gieo Hạt Vào Ô Vườn #{plantingModal.slot + 1}</span>
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Chọn hạt giống có sẵn trong túi hoặc gieo hạt ngẫu nhiên (nở sau 30 phút).
                </p>
              </div>
              <button
                type="button"
                disabled={isPlantingSeed}
                onClick={() => setPlantingModal(null)}
                className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chọn ô trống nếu người chơi bấm "Gieo ngay" từ Kho đồ/Chợ/Gacha */}
            {emptySlots.length > 0 && (
              <div className="flex items-center justify-between gap-2 text-xs bg-[var(--bg)] px-3.5 py-2 rounded-2xl border border-[var(--border)]">
                <span className="font-bold text-[var(--muted)]">
                  Chọn ô trống để gieo:
                </span>
                <select
                  value={plantingModal.slot}
                  onChange={(e) =>
                    setPlantingModal((prev) =>
                      prev ? { ...prev, slot: Number(e.target.value) } : null
                    )
                  }
                  className="px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] font-bold text-xs text-[var(--text)] cursor-pointer"
                >
                  {emptySlots.map((s) => (
                    <option key={s} value={s}>
                      Ô vườn #{s + 1} (Trống)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cảnh báo thiếu Xu hoặc lỗi RPC */}
            {plantingModal.insufficientCoinsDiff && plantingModal.insufficientCoinsDiff > 0 ? (
              <div className="p-3.5 rounded-2xl border-2 border-rose-400 bg-rose-500/10 text-xs space-y-2">
                <p className="font-extrabold text-rose-600 dark:text-rose-300">
                  ⚠️ Chưa đủ {coinCurrencyName}, còn thiếu {plantingModal.insufficientCoinsDiff} {coinCurrencyName}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--muted)]">
                    Làm nhiệm vụ hằng ngày để nhận thêm {coinCurrencyName} nhé!
                  </span>
                  <button
                    type="button"
                    onClick={handleGoToDailyQuests}
                    className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[11px] cursor-pointer shrink-0 bouncy-btn"
                  >
                    📋 Đi làm nhiệm vụ
                  </button>
                </div>
              </div>
            ) : plantingModal.errorMsg ? (
              <div className="p-3 rounded-2xl border border-rose-400 bg-rose-500/10 text-xs font-bold text-rose-600 dark:text-rose-300">
                ⚠️ {plantingModal.errorMsg}
              </div>
            ) : null}

            {/* (a) Danh sách hạt giống trong túi (inventory kind='seed' chưa nằm trong garden_plots) */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-[140px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--text)]">
                  🎒 Hạt giống trong túi ({unplantedSeeds.length} hạt sẵn sàng):
                </span>
              </div>

              {unplantedSeeds.length === 0 ? (
                <div className="p-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)]/70 text-center space-y-2.5">
                  <p className="text-xs font-bold text-[var(--text)]">
                    Túi của bạn hiện chưa có hạt giống hoa nào chưa gieo 🌱
                  </p>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    Bạn có thể ghé <strong>Chợ nhỏ</strong> để mua Hạt giống hoa, mở <strong>Gacha</strong> mỗi ngày, hoặc bấm nút <strong>Gieo hạt ngẫu nhiên</strong> ngay bên dưới nhé!
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPlantingModal(null);
                        setActiveZone('market');
                      }}
                      className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] cursor-pointer"
                    >
                      🛒 Đến Chợ nhỏ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlantingModal(null);
                        setActiveZone('gacha_inv');
                      }}
                      className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] cursor-pointer"
                    >
                      🎁 Mở Gacha
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {unplantedSeeds.map((seed) => {
                    const isPreselected =
                      plantingModal.preselectedSeedId === seed.id;
                    return (
                      <div
                        key={seed.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all ${
                          isPreselected
                            ? 'border-2 border-[var(--accent)] bg-[var(--accent)]/15'
                            : 'border-[var(--border)] bg-[var(--bg)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                            {renderItem('seed', seed.seed, seed.rarity, 0, {
                              size: 40,
                            })}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text)] truncate">
                              {formatSeedName(seed.name)}
                            </p>
                            <span className="text-[10px] font-semibold text-[var(--muted)]">
                              Độ hiếm: {RARITY_LABELS[seed.rarity]}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isPlantingSeed}
                          onClick={() =>
                            handlePlantSeedInSlot(plantingModal.slot, seed.id)
                          }
                          className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-extrabold text-[11px] cursor-pointer shrink-0 bouncy-btn disabled:opacity-50"
                        >
                          🌱 Gieo
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* (b) Nút "🎲 Gieo hạt ngẫu nhiên (3 Xu)" gọi plant_seed(slot, null) */}
            <div className="pt-3 border-t border-[var(--border)] space-y-2">
              <button
                type="button"
                disabled={isPlantingSeed}
                onClick={() => handlePlantSeedInSlot(plantingModal.slot, null)}
                className="w-full py-3 rounded-full text-xs font-extrabold bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-stone-900 shadow-sm hover:brightness-105 cursor-pointer inline-flex items-center justify-center gap-2 bouncy-btn disabled:opacity-60"
              >
                {isPlantingSeed ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>🎲</span>
                )}
                <span>
                  {isOwner
                    ? 'Gieo hạt ngẫu nhiên (Miễn phí - Chủ web)'
                    : `Gieo hạt ngẫu nhiên (3 ${coinCurrencyName})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp kết quả sau khi Thu hoạch Hoa thành công */}
      {harvestResultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setHarvestResultModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl text-center"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                🌸 Thu hoạch thành công (Ô #{harvestResultModal.slot + 1})
              </span>
              <button
                type="button"
                onClick={() => setHarvestResultModal(null)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-24 h-24 mx-auto rounded-3xl bg-[var(--bg)] border-2 border-[var(--border)] flex items-center justify-center shadow-inner">
              {renderItem(
                'flower',
                harvestResultModal.flowerItem.seed,
                harvestResultModal.flowerItem.rarity,
                4,
                { size: 80 }
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="sticker-chip text-[11px] font-bold">
                  🌸 Hoa Đã Nở
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--accent)]/30 text-[var(--text)]">
                  Độ hiếm: {RARITY_LABELS[harvestResultModal.flowerItem.rarity]}
                </span>
              </div>

              <h4 className="font-serif-title text-2xl font-extrabold text-[var(--text)]">
                {harvestResultModal.flowerItem.name}
              </h4>

              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Đã cất vào Kho đồ ✨
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                Bông hoa này đã sẵn sàng dùng để mở khóa nhân vật hoặc tặng cho người thương. Ô vườn #{harvestResultModal.slot + 1} đã trống để bạn gieo hạt mới!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setHarvestResultModal(null);
                  setInvCategoryFilter('flower');
                  setActiveZone('gacha_inv');
                }}
                className="py-2.5 px-4 rounded-full font-bold text-xs border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
              >
                📦 Xem Kho đồ
              </button>

              <button
                type="button"
                onClick={() => {
                  const slotToReplant = harvestResultModal.slot;
                  setHarvestResultModal(null);
                  handleOpenPlantModalForSeed(null, slotToReplant);
                }}
                className="py-2.5 px-4 rounded-full font-bold text-xs bg-[var(--accent)] text-[#3a2b30] cursor-pointer shadow-sm bouncy-btn"
              >
                🌱 Gieo tiếp vào ô #{harvestResultModal.slot + 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp kết quả sau khi mua ở Chợ thành công */}
      {boughtItemModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setBoughtItemModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl text-center"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                🎉 Kết quả mua vật phẩm
              </span>
              <button
                type="button"
                onClick={() => setBoughtItemModal(null)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hình SVG riêng của đúng món vừa nhận (vẽ theo seed và độ hiếm) */}
            <div className="w-24 h-24 mx-auto rounded-3xl bg-[var(--bg)] border-2 border-[var(--border)] flex items-center justify-center shadow-inner">
              {renderItem(
                boughtItemModal.item.category,
                boughtItemModal.item.seed,
                boughtItemModal.item.rarity,
                boughtItemModal.item.category === 'seed'
                  ? 0
                  : boughtItemModal.item.category === 'flower'
                  ? 4
                  : 'adult',
                { size: 80 }
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="sticker-chip text-[11px] font-bold">
                  {CATEGORY_LABELS[boughtItemModal.item.category].emoji}{' '}
                  {CATEGORY_LABELS[boughtItemModal.item.category].name}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--accent)]/30 text-[var(--text)]">
                  Độ hiếm: {RARITY_LABELS[boughtItemModal.item.rarity]}
                </span>
              </div>

              <h4 className="font-serif-title text-xl font-extrabold text-[var(--text)]">
                {boughtItemModal.item.category === 'seed' ||
                boughtItemModal.kind === 'flower'
                  ? `Bạn nhận được ${formatSeedName(boughtItemModal.item.name)}`
                  : `Bạn nhận được ${boughtItemModal.item.name}`}
              </h4>

              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Đã cất vào Kho đồ ✨
              </p>
            </div>

            {boughtItemModal.item.category === 'seed' ||
            boughtItemModal.kind === 'flower' ? (
              <div className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] space-y-1">
                <p className="font-bold flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-300">
                  <span>🌱 Hạt giống sẵn sàng đem gieo ở Vườn hoa</span>
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Sau khi gieo vào ô vườn, cây sẽ lớn qua 5 giai đoạn và nở thành Hoa sau 30 phút để bạn thu hoạch!
                </p>
              </div>
            ) : boughtItemModal.item.readyAt ? (
              <div className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] space-y-1">
                <p className="font-bold flex items-center justify-center gap-1 text-amber-600 dark:text-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Đang phát triển (30 phút để lớn khôn)</span>
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Bạn có thể ghé chăm sóc ngay hoặc theo dõi đếm ngược trực tiếp trong Kho đồ.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const cat = boughtItemModal.item.category;
                  setBoughtItemModal(null);
                  setInvCategoryFilter(cat === 'seed' ? 'seed' : 'all');
                  setActiveZone('gacha_inv');
                }}
                className="py-2.5 px-4 rounded-full font-bold text-xs border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
              >
                📦 Xem Kho đồ
              </button>

              {boughtItemModal.item.category === 'seed' ||
              boughtItemModal.kind === 'flower' ? (
                <button
                  type="button"
                  onClick={() => {
                    const seedId = boughtItemModal.item.id;
                    setBoughtItemModal(null);
                    handleOpenPlantModalForSeed(seedId);
                  }}
                  className="py-2.5 px-4 rounded-full font-bold text-xs bg-[var(--accent)] text-[#3a2b30] cursor-pointer shadow-sm bouncy-btn"
                >
                  🌱 Gieo ngay
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const k = boughtItemModal.item.category;
                    setBoughtItemModal(null);
                    if (k === 'fish') setActiveZone('pond');
                    else if (k === 'pet') setActiveZone('companion');
                    else setActiveZone('drinks');
                  }}
                  className="py-2.5 px-4 rounded-full font-bold text-xs bg-[var(--accent)] text-[#3a2b30] cursor-pointer shadow-sm bouncy-btn"
                >
                  {boughtItemModal.item.category === 'fish'
                    ? '🐟 Đến chăm ngay (Hồ cá)'
                    : boughtItemModal.item.category === 'pet'
                    ? '🐾 Đến chăm ngay (Khu thú cưng)'
                    : '☕ Đến chăm ngay (Quầy thức uống)'}
                </button>
              )}
            </div>

            {(isOwner || coins >= boughtItemModal.buyPrice) && (
              <button
                type="button"
                disabled={Boolean(isBuyingKind)}
                onClick={() => handleBuyMarketItem(boughtItemModal.kind)}
                className="w-full py-2 rounded-full text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] border border-dashed border-[var(--border)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>
                  Mua tiếp 1{' '}
                  {boughtItemModal.kind === 'flower'
                    ? 'Hạt giống hoa'
                    : CATEGORY_LABELS[boughtItemModal.kind].name}{' '}
                  (-{boughtItemModal.buyPrice} {coinCurrencyName})
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal xác nhận bán lại */}
      {itemToSellConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setItemToSellConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center text-2xl">
              💰
            </div>
            <div className="space-y-1">
              <h4 className="font-serif-title text-lg font-bold text-[var(--text)]">
                Bán lại vật phẩm?
              </h4>
              <p className="text-xs text-[var(--muted)]">
                Bạn có chắc muốn bán &quot;<strong className="text-[var(--text)]">{itemToSellConfirm.item.name}</strong>&quot; với giá <strong className="text-amber-600 dark:text-amber-400 font-bold">{itemToSellConfirm.price} {coinCurrencyName}</strong> không?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToSellConfirm(null)}
                className="flex-1 py-2.5 rounded-full border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSellItem(itemToSellConfirm.item)}
                className="flex-1 py-2.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-xs cursor-pointer shadow-xs bouncy-btn"
              >
                Đồng ý bán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp xác nhận nhẹ nhàng khi câu thêm tốn 5 Xu */}
      {confirmPaidCastModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setConfirmPaidCastModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center text-2xl">
              🎣
            </div>
            <div className="space-y-1.5">
              <h4 className="font-serif-title text-lg font-bold text-[var(--text)]">
                Câu thêm lượt mới (5 {coinCurrencyName})?
              </h4>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Bạn đã dùng hết 5 lượt câu miễn phí hôm nay. Bạn có muốn dùng{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  5 {coinCurrencyName}
                </strong>{' '}
                để thả cần câu thêm một lượt không?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmPaidCastModal(false)}
                className="flex-1 py-2.5 rounded-full border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={executeFishingCast}
                className="flex-1 py-2.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-extrabold text-xs cursor-pointer shadow-xs bouncy-btn"
              >
                🎣 Đồng ý (5 {coinCurrencyName})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp kết quả khi bấm trúng hộp quà câu cá 🎁 */}
      {fishingResultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setFishingResultModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl text-center"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                🎁✨ Mở hộp quà câu cá thành công!
              </span>
              <button
                type="button"
                onClick={() => setFishingResultModal(null)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-24 h-24 mx-auto rounded-3xl bg-[var(--bg)] border-2 border-[var(--border)] flex items-center justify-center shadow-inner">
              {renderItem(
                fishingResultModal.item.category,
                fishingResultModal.item.seed,
                fishingResultModal.item.rarity,
                fishingResultModal.item.category === 'seed'
                  ? 0
                  : fishingResultModal.item.category === 'flower'
                  ? 4
                  : 'adult',
                { size: 80, meta: fishingResultModal.item.meta }
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="sticker-chip text-[11px] font-bold">
                  {CATEGORY_LABELS[fishingResultModal.item.category].emoji}{' '}
                  {CATEGORY_LABELS[fishingResultModal.item.category].name}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--accent)]/30 text-[var(--text)]">
                  Độ hiếm: {RARITY_LABELS[fishingResultModal.item.rarity]}
                </span>
              </div>

              <h4 className="font-serif-title text-2xl font-extrabold text-[var(--text)]">
                {fishingResultModal.item.category === 'seed'
                  ? formatSeedName(fishingResultModal.item.name)
                  : fishingResultModal.item.name}
              </h4>

              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Đã cất vào Kho đồ ✨
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const cat = fishingResultModal.item.category;
                  setFishingResultModal(null);
                  setInvCategoryFilter(cat);
                  setActiveZone('gacha_inv');
                }}
                className="py-2.5 px-4 rounded-full font-bold text-xs border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
              >
                📦 Xem Kho đồ
              </button>

              {fishingResultModal.item.category === 'fish' ? (
                <button
                  type="button"
                  disabled={isReleasingFish}
                  onClick={async () => {
                    const fId = fishingResultModal.item.id;
                    setFishingResultModal(null);
                    await handleReleaseSelectedFish([fId]);
                  }}
                  className="py-2.5 px-4 rounded-full font-bold text-xs bg-[var(--accent)] text-[#3a2b30] cursor-pointer shadow-sm bouncy-btn"
                >
                  🐟 Thả vào hồ ngay
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setFishingResultModal(null)}
                  className="py-2.5 px-4 rounded-full font-bold text-xs bg-[var(--accent)] text-[#3a2b30] cursor-pointer shadow-sm bouncy-btn"
                >
                  🎣 Câu tiếp
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hộp chọn cá trong Kho đồ để thả xuống Hồ cá đêm (release_fish) */}
      {releaseFishModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !isReleasingFish && setReleaseFishModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl max-h-[88vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-serif-title text-xl font-bold text-[var(--text)]">
                  ➕ Thả Cá Từ Kho Đồ Vào Hồ
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Chọn một hoặc nhiều chú cá đang ở trong Kho đồ để thả xuống Hồ cá đêm nhé.
                </p>
              </div>
              <button
                type="button"
                disabled={isReleasingFish}
                onClick={() => setReleaseFishModalOpen(false)}
                className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[160px]">
              {unreleasedFishItems.length === 0 ? (
                <div className="py-10 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)]/60 text-center space-y-3">
                  <p className="text-xs font-bold text-[var(--text)]">
                    Chưa có bé cá nào chờ thả. Đi câu cá hoặc ghé Chợ nhé 🐟
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReleaseFishModalOpen(false)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
                    >
                      🎣 Đi câu cá
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReleaseFishModalOpen(false);
                        setActiveZone('market');
                      }}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] cursor-pointer"
                    >
                      🛒 Ghé Chợ nhỏ
                    </button>
                  </div>
                </div>
              ) : (
                unreleasedFishItems.map((fish) => {
                  const checked = selectedFishIdsToRelease.includes(fish.id);
                  const readyMs = fish.readyAt ? new Date(fish.readyAt).getTime() : 0;
                  const isEgg = Boolean(
                    fish.readyAt && !Number.isNaN(readyMs) && readyMs > nowMs
                  );

                  return (
                    <label
                      key={fish.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        checked
                          ? 'border-2 border-[var(--accent)] bg-[var(--accent)]/15'
                          : 'border-[var(--border)] bg-[var(--bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFishIdsToRelease((prev) => [
                                ...prev,
                                fish.id,
                              ]);
                            } else {
                              setSelectedFishIdsToRelease((prev) =>
                                prev.filter((id) => id !== fish.id)
                              );
                            }
                          }}
                          className="w-4 h-4 accent-[var(--accent)] rounded cursor-pointer"
                        />
                        <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                          {renderItem(
                            'fish',
                            fish.seed,
                            fish.rarity,
                            isEgg ? 'egg' : 'adult',
                            { size: 40 }
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text)] truncate">
                            {fish.name}
                          </p>
                          <p className="text-[10.5px] text-[var(--muted)]">
                            Độ hiếm: {RARITY_LABELS[fish.rarity]}{' '}
                            {isEgg ? '· 🥚 Trứng cá' : '· 🐟 Đã nở'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isReleasingFish}
                        onClick={(e) => {
                          e.preventDefault();
                          handleReleaseSelectedFish([fish.id]);
                        }}
                        className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-extrabold text-[11px] cursor-pointer shrink-0 bouncy-btn"
                      >
                        💦 Thả ngay
                      </button>
                    </label>
                  );
                })
              )}
            </div>

            {unreleasedFishItems.length > 0 && (
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      selectedFishIdsToRelease.length ===
                      unreleasedFishItems.length
                    ) {
                      setSelectedFishIdsToRelease([]);
                    } else {
                      setSelectedFishIdsToRelease(
                        unreleasedFishItems.map((f) => f.id)
                      );
                    }
                  }}
                  className="text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  {selectedFishIdsToRelease.length ===
                  unreleasedFishItems.length
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả'}
                </button>

                <button
                  type="button"
                  disabled={
                    isReleasingFish || selectedFishIdsToRelease.length === 0
                  }
                  onClick={() =>
                    handleReleaseSelectedFish(selectedFishIdsToRelease)
                  }
                  className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-extrabold text-xs cursor-pointer shadow-sm bouncy-btn disabled:opacity-50"
                >
                  {isReleasingFish
                    ? 'Đang thả xuống hồ...'
                    : `💦 Thả (${selectedFishIdsToRelease.length} chú cá)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hộp kết quả khi pha chế thức uống hoàn tất (tự động thu thập & treo lên kệ) */}
      {brewResultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setBrewResultModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl text-center"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                ☕✨ Pha chế hoàn tất!
              </span>
              <button
                type="button"
                onClick={() => setBrewResultModal(null)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-24 h-24 mx-auto rounded-3xl bg-[var(--bg)] border-2 border-[var(--border)] flex items-center justify-center shadow-inner">
              {renderItem(
                'drink',
                brewResultModal.item.seed,
                brewResultModal.item.rarity,
                4,
                {
                  size: 80,
                  meta:
                    brewResultModal.item.meta ||
                    (brewResultModal.recipe as unknown as Record<string, unknown>),
                }
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="sticker-chip text-[11px] font-bold">
                  ☕ Thức Uống Pha Chế
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--accent)]/30 text-[var(--text)]">
                  Độ hiếm: {RARITY_LABELS[brewResultModal.item.rarity]}
                </span>
              </div>

              <h4 className="font-serif-title text-2xl font-extrabold text-[var(--text)]">
                {brewResultModal.item.name}
              </h4>

              <p className="text-xs text-[var(--muted)]">
                Công thức:{' '}
                <strong className="text-[var(--text)]">
                  {brewResultModal.recipe.base || 'Thức uống'}
                </strong>
                {brewResultModal.recipe.flavor
                  ? ` · Hương ${brewResultModal.recipe.flavor}`
                  : ''}
                {brewResultModal.recipe.topping
                  ? ` · Topping ${brewResultModal.recipe.topping}`
                  : ''}
              </p>

              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Đã cất vào Kho đồ và treo lên kệ ✨
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBrewResultModal(null);
                  setInvCategoryFilter('drink');
                  setActiveZone('gacha_inv');
                }}
                className="py-2.5 px-4 rounded-full font-bold text-xs border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
              >
                📦 Xem Kho đồ
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedShelfDrink(brewResultModal.item);
                  setBrewResultModal(null);
                  setActiveZone('drinks');
                }}
                className="py-2.5 px-4 rounded-full font-bold text-xs bg-[var(--accent)] text-[#3a2b30] cursor-pointer shadow-sm bouncy-btn"
              >
                🪵 Xem trên Kệ gỗ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
