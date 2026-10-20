import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  fetchMyInventoryFromSupabase,
  fetchMyDailyRollToday,
  rollGachaOnSupabase,
  updateInventoryItemReadyAt,
  insertCraftedDrinkToInventory,
  fetchMyCoinsFromSupabase,
  fetchMarketPricesFromSupabase,
  claimDailyCoinsViaRpc,
  getDailyQuestsViaRpc,
  completeQuestViaRpc,
  buyItemViaRpc,
  sellItemViaRpc,
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
  GardenPlotState,
  GardenStage,
  PondFishState,
  CompanionRoomState,
  RARITY_LABELS,
  CATEGORY_LABELS,
  STAGE_DURATIONS_MS,
  GARDEN_STAGE_NAMES,
  generateUniqueGameItem,
  getInventoryItems,
  saveInventoryItems,
  addItemToInventory,
  removeItemFromInventory,
  getGardenPlots,
  saveGardenPlots,
  getPondFishList,
  savePondFishList,
  getCompanionRoomState,
  saveCompanionRoomState,
} from '../services/itemSystem';
import {
  TagVoiceProfile,
  TagPetProfile,
  DialogueSituation,
  DEFAULT_TAG_VOICES,
  DEFAULT_TAG_PETS,
  generateCompanionDialogueByTags,
  resolveBlendedVoicesForCharacter,
  getPersistedTraitForPet,
  selectPetTraitForCompanionTags,
  persistTraitForPet,
  sanitizePetVibeNote,
} from '../services/tagCompanionSystem';
import {
  DEFAULT_GACHA_DAILY_DESC,
  getSiteConfig,
} from '../services/siteSettings';
import { ProceduralItemSvg } from './ProceduralItemSvg';

function mapDbInvRowToGameItem(
  row: DbInventoryRow,
  companionCharTags: string[] = ['Dịu dàng'],
  customPets: TagPetProfile[] = DEFAULT_TAG_PETS
): GeneratedGameItem {
  const rawType = String(row.item_type || 'flower').toLowerCase();
  const category: ItemCategory =
    rawType === 'fish' || rawType === 'ca' || rawType === 'cá'
      ? 'fish'
      : rawType === 'pet' || rawType === 'thu_cung' || rawType === 'thú cưng'
      ? 'pet'
      : rawType === 'drink' || rawType === 'thuc_uong' || rawType === 'thức uống'
      ? 'drink'
      : 'flower';
  const rawRarity = String(row.rarity || 'common').toLowerCase();
  const rarity: ItemRarity =
    rawRarity === 'legendary' || rawRarity === 'hiếm' || rawRarity === 'hiem'
      ? 'legendary'
      : rawRarity === 'rare' || rawRarity === 'quý' || rawRarity === 'quy'
      ? 'rare'
      : 'common';

  let h = 2166136261;
  const seedStr = row.item_name || row.id;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
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

  if (category === 'pet') {
    let petTrait = getPersistedTraitForPet(row.id, row.item_name, customPets);
    if (!petTrait) {
      petTrait = selectPetTraitForCompanionTags(companionCharTags, customPets);
      persistTraitForPet(row.id, row.item_name, petTrait);
    }
    const cleanVibe = sanitizePetVibeNote(
      petTrait.vibeReason,
      petTrait.matchedTag,
      petTrait.petSpecies
    );
    return {
      id: row.id,
      name: row.item_name,
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
    };
  }

  return {
    id: row.id,
    name: row.item_name,
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
    description: `Vật phẩm ${CATEGORY_LABELS[category].name} thuộc phẩm cấp ${RARITY_LABELS[rarity]} được lưu trữ trong Kho đồ.`,
    readyAt: row.ready_at || null,
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
  tagVoices?: TagVoiceProfile[];
  tagPets?: TagPetProfile[];
  initialSubZone?: string;
  initialTargetKind?: string;
}

type MiniZone = 'market' | 'gacha_inv' | 'garden' | 'pond' | 'companion' | 'drinks';

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return 'Sẵn sàng!';
  const totalSec = Math.ceil(msRemaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
  onInventoryChange,
  tagVoices,
  tagPets,
  initialSubZone,
  initialTargetKind,
}) => {
  const canEdit = Boolean(editMode && can('edit', currentUser));
  const isOwner = Boolean(currentUser?.profileRole === 'owner');

  // Điều hướng 6 khu vực trong Mini Game (bao gồm Chợ Nhỏ)
  const [activeZone, setActiveZone] = useState<MiniZone>(() =>
    initialSubZone === 'market' ? 'market' : 'gacha_inv'
  );

  useEffect(() => {
    if (isOwner) {
      ownerRefillViaRpc().then((res) => {
        if (res.ok && typeof res.coins === 'number') {
          setCoins(res.coins);
        }
      }).catch(() => {});
    }
  }, [isOwner, activeZone]);

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
  // STATE CHỢ NHỎ: TIỀN XU (profiles.coins), BẢNG GIÁ & NHIỆM VỤ NGÀY
  // ============================================================================
  const [coins, setCoins] = useState<number>(0);
  const [marketPrices, setMarketPrices] = useState<MarketPriceRow[]>(DEFAULT_MARKET_PRICES);
  const [dailyQuests, setDailyQuests] = useState<DailyQuestItem[]>([]);
  const [resetsAtIso, setResetsAtIso] = useState<string>('');
  const [questCountdownStr, setQuestCountdownStr] = useState<string>('00:00:00');
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [isBuyingKind, setIsBuyingKind] = useState<string | null>(null);
  const [isSellingItemId, setIsSellingItemId] = useState<string | null>(null);
  const [boughtItemModal, setBoughtItemModal] = useState<{
    item: DbInventoryRow;
    message: string;
  } | null>(null);
  const [itemToSellConfirm, setItemToSellConfirm] = useState<{
    item: GeneratedGameItem;
    price: number;
  } | null>(null);
  const [questSparkleEffect, setQuestSparkleEffect] = useState<{
    questTitle: string;
    reward: number;
  } | null>(null);

  // Đồng hồ thời gian thực (cập nhật mỗi giây cho Vườn hoa & Hồ cá)
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // State chính: Kho đồ đọc từ bảng inventory trên Supabase
  const [inventory, setInventory] = useState<GeneratedGameItem[]>(() =>
    getInventoryItems()
  );
  const [gardenPlots, setGardenPlots] = useState<GardenPlotState[]>(() =>
    getGardenPlots()
  );
  const [pondFish, setPondFish] = useState<PondFishState[]>(() =>
    getPondFishList()
  );
  const [roomState, setRoomState] = useState<CompanionRoomState>(() =>
    getCompanionRoomState(characters[0]?.id || 'char-ta-khanh-inh')
  );

  // Trạng thái Gacha & Kho đồ
  const [isRollingGacha, setIsRollingGacha] = useState(false);
  const [lastGachaResult, setLastGachaResult] = useState<{
    item: GeneratedGameItem;
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

  // Nhân vật đồng hành hiện tại ở Phòng tri kỷ
  const companionChar = useMemo(
    () =>
      characters.find((c) => c.id === roomState.companionCharId) ||
      characters[0],
    [characters, roomState.companionCharId]
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
    return generateCompanionDialogueByTags({
      charTags: firstChar?.tags || ['Dịu dàng'],
      situation: 'greeting',
      bondPoints: roomState.bondPoints,
      customVoices: effectiveTagVoices,
    }).text;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasFreeGachaToday = roomState.lastFreeGachaDate !== todayStr;

  const refreshSupabaseInventoryAndRoll = useCallback(async () => {
    if (!currentUser || currentUser.role === 'guest' || !currentUser.id) return;
    const [invRows, rolledToday] = await Promise.all([
      fetchMyInventoryFromSupabase(),
      fetchMyDailyRollToday(),
    ]);
    onInventoryChange?.(invRows);
    const charTagsForPet = companionChar?.tags || ['Dịu dàng'];
    const mapped = invRows.map((r) =>
      mapDbInvRowToGameItem(r, charTagsForPet, effectiveTagPets)
    );
    setInventory(mapped);
    saveInventoryItems(mapped);

    if (rolledToday) {
      setRoomState((prev) => {
        if (prev.lastFreeGachaDate === todayStr) return prev;
        const next = { ...prev, lastFreeGachaDate: todayStr };
        saveCompanionRoomState(next);
        return next;
      });
    }
  }, [
    currentUser,
    onInventoryChange,
    todayStr,
    companionChar?.tags,
    effectiveTagPets,
  ]);

  useEffect(() => {
    refreshSupabaseInventoryAndRoll();
  }, [refreshSupabaseInventoryAndRoll]);

  const loadMarketDataAndCoins = useCallback(async () => {
    const [prices, currentCoins] = await Promise.all([
      fetchMarketPricesFromSupabase(),
      fetchMyCoinsFromSupabase(),
    ]);
    setMarketPrices(prices);
    setCoins(currentCoins);

    if (currentUser && currentUser.role !== 'guest' && currentUser.id) {
      const qRes = await getDailyQuestsViaRpc();
      if (qRes.ok) {
        setDailyQuests(qRes.quests);
        setResetsAtIso(qRes.resetsAt);
        if (typeof qRes.coins === 'number') {
          setCoins(qRes.coins);
        }
      }
    } else {
      // Khách: nhiệm vụ xem trước mẫu
      setDailyQuests([
        { index: 0, id: 1, title: 'Tưới nước cho Vườn hoa ban mai', reward: 6, completed: false, action: 'water', target: 2, progress: 0 },
        { index: 1, id: 2, title: 'Mở Phòng tri kỷ ghé thăm người thương', reward: 5, completed: false, action: 'visit_room', target: 1, progress: 0 },
        { index: 2, id: 3, title: 'Lắng nghe trọn vẹn một bản nhạc êm', reward: 8, completed: false, action: 'listen_song', target: 1, progress: 0 },
      ]);
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      setResetsAtIso(tomorrow.toISOString());
    }
  }, [currentUser]);

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

  // Làm mới tiến độ khi mở tab Chợ nhỏ
  useEffect(() => {
    if (activeZone === 'market') {
      loadMarketDataAndCoins();
    }
  }, [activeZone, loadMarketDataAndCoins]);

  // Làm mới tiến độ sau mỗi hành động trong game (qua log_action)
  useEffect(() => {
    const unsub = onQuestActionLogged(() => {
      loadDailyQuests();
    });
    return unsub;
  }, [loadDailyQuests]);

  // Làm mới tiến độ mỗi 30 giây khi tab Chợ nhỏ đang mở
  useEffect(() => {
    if (activeZone !== 'market') return;
    if (!currentUser || currentUser.role === 'guest' || !currentUser.id) return;
    const interval = setInterval(() => {
      loadDailyQuests();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeZone, currentUser, loadDailyQuests]);

  // Đồng hồ đếm ngược đến resets_at (khi về 0 tự động đổi bộ mới qua loadMarketDataAndCoins)
  useEffect(() => {
    if (!resetsAtIso) return;

    const tickCountdown = () => {
      const diff = new Date(resetsAtIso).getTime() - Date.now();
      if (diff <= 0) {
        setQuestCountdownStr('00:00:00');
        loadMarketDataAndCoins();
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
  }, [resetsAtIso, loadMarketDataAndCoins]);

  // Xử lý chuyển zone và cuộn nhanh từ CharTab
  useEffect(() => {
    if (initialSubZone === 'market') {
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

  // Handlers cho Chợ nhỏ
  const handleClaimDailyCoins = async () => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.(`Mời bạn đăng nhập để nhận quà 10 ${coinCurrencyName} mỗi ngày nhé 🌸`);
      return;
    }
    if (isClaimingDaily) return;
    setIsClaimingDaily(true);
    try {
      const res = await claimDailyCoinsViaRpc();
      if (res.ok) {
        if (typeof res.coins === 'number') {
          setCoins(res.coins);
        } else {
          const c = await fetchMyCoinsFromSupabase();
          setCoins(c);
        }
        showToast(res.message);
      } else {
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

  const handleBuyMarketItem = async (kind: ItemCategory) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.(`Mời bạn đăng nhập để mua vật phẩm tại Chợ nhỏ nhé 🌸`);
      return;
    }
    if (isBuyingKind) return;
    setIsBuyingKind(kind);
    try {
      const res = await buyItemViaRpc(kind);
      if (res.ok && res.item) {
        if (typeof res.coins === 'number') {
          setCoins(res.coins);
        } else {
          const c = await fetchMyCoinsFromSupabase();
          setCoins(c);
        }
        setBoughtItemModal({
          item: res.item,
          message: res.message,
        });
        emitGameQuestAction('buy_market');
        await refreshSupabaseInventoryAndRoll();
      } else {
        showToast(res.message);
      }
    } finally {
      setIsBuyingKind(null);
    }
  };

  const handleSellItem = async (item: GeneratedGameItem) => {
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

  // Cập nhật đồng hồ thời gian thực & sự phát triển tự nhiên của Cá trong hồ
  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      // Cá đang no sẽ lớn dần và tiết ra thêm Cánh hoa theo thời gian (mỗi 45 giây tiết 2 Cánh hoa)
      setPondFish((prevFish) => {
        let changed = false;
        const nextFish = prevFish.map((f) => {
          let nextStage = f.stage;
          let nextXp = f.xp;
          let nextPending = f.pendingPetals;
          let nextLastPetal = f.lastPetalGeneratedAt;

          // Tự nở từ trứng sau 60 giây hoặc khi được chăm
          if (f.stage === 'egg' && currentNow - f.hatchedAt >= 60 * 1000) {
            nextStage = 'baby';
            nextXp = Math.max(nextXp, 20);
            changed = true;
          }

          // Nếu cá đang no, tiết ra Cánh hoa mỗi 45 giây
          if (
            f.fullUntil > currentNow &&
            currentNow - f.lastPetalGeneratedAt >= 45 * 1000
          ) {
            nextPending = Math.min(25, f.pendingPetals + 2);
            nextLastPetal = currentNow;
            nextXp = f.xp + 5;
            if (nextXp >= 80 && nextStage !== 'adult') {
              nextStage = 'adult';
            } else if (nextXp >= 40 && nextStage === 'baby') {
              nextStage = 'juvenile';
            }
            changed = true;
          }

          if (!changed) return f;
          return {
            ...f,
            stage: nextStage,
            xp: nextXp,
            pendingPetals: nextPending,
            lastPetalGeneratedAt: nextLastPetal,
          };
        });

        if (changed) {
          savePondFishList(nextFish);
        }
        return changed ? nextFish : prevFish;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

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
  // 1. XỬ LÝ GACHA MỖI NGÀY: Gọi rpc roll_gacha trên Supabase
  //    Lỗi already_rolled -> báo "Hôm nay bạn đã nhận rồi, mai quay lại nhé"
  // ============================================================================
  const handleRollGacha = async (useFreeRoll: boolean) => {
    if (!currentUser || currentUser.role === 'guest') {
      onRequireAuth?.('Mời bạn đăng nhập để mở Gacha và nhận quà mỗi ngày nhé 🌸');
      return;
    }
    if (isRollingGacha) return;
    const rollCost = 15;

    if (useFreeRoll) {
      if (!hasFreeGachaToday) {
        showToast('Hôm nay bạn đã nhận rồi, mai quay lại nhé');
        return;
      }
      setIsRollingGacha(true);
      setLastGachaResult(null);

      try {
        const res = await rollGachaOnSupabase();
        if (!res.ok) {
          if (res.errorCode === 'already_rolled') {
            const nextRoom = {
              ...roomState,
              lastFreeGachaDate: todayStr,
            };
            setRoomState(nextRoom);
            saveCompanionRoomState(nextRoom);
            showToast('Hôm nay bạn đã nhận rồi, mai quay lại nhé');
          } else {
            showToast(res.message);
          }
          return;
        }

        const nextRoom = {
          ...roomState,
          lastFreeGachaDate: todayStr,
        };
        setRoomState(nextRoom);
        saveCompanionRoomState(nextRoom);
        markDailyTaskReady('gacha');

        await refreshSupabaseInventoryAndRoll();

        if (res.item) {
          const newItem = mapDbInvRowToGameItem(
            res.item,
            companionChar?.tags || ['Dịu dàng'],
            effectiveTagPets
          );
          let destinationNote =
            '✨ Đã cất vật phẩm vào Kho đồ!';
          if (newItem.category === 'flower') {
            // Đưa hạt giống vào Vườn hoa
            const currentPlots = [...gardenPlots];
            const emptyIdx = currentPlots.findIndex((p) => p.seedItem === null);
            const now = Date.now();
            const newPlotData: GardenPlotState = {
              id:
                emptyIdx !== -1
                  ? currentPlots[emptyIdx].id
                  : `plot_${now}_${Math.random().toString(36).slice(2, 5)}`,
              seedItem: newItem,
              stage: 0,
              stageStartedAt: now,
              stageDurationMs: STAGE_DURATIONS_MS[0],
              wateredInCurrentStage: false,
            };
            if (emptyIdx !== -1) {
              currentPlots[emptyIdx] = newPlotData;
            } else {
              currentPlots.push(newPlotData);
            }
            setGardenPlots(currentPlots);
            saveGardenPlots(currentPlots);
            destinationNote =
              '🌱 Đã nhận vào Kho đồ & gieo hạt giống vào Vườn hoa!';
          } else if (newItem.category === 'fish') {
            const now = Date.now();
            const newFishState: PondFishState = {
              id: newItem.id,
              item: newItem,
              stage: 'egg',
              xp: 0,
              hatchedAt: now,
              fullUntil: now + 90 * 1000,
              lastPetalGeneratedAt: now,
              pendingPetals: 0,
              swimSpeed: 16 + Math.floor(Math.random() * 10),
              swimOffset: Math.floor(Math.random() * 85),
            };
            const nextFish = [newFishState, ...pondFish];
            setPondFish(nextFish);
            savePondFishList(nextFish);
            destinationNote =
              '🥚 Đã nhận vào Kho đồ & thả trứng cá vào Hồ cá!';
          } else if (newItem.category === 'pet') {
            destinationNote = `🐾 Đã đón thú cưng (${newItem.petSpecies || 'Thú nhỏ'}) về chăm bẵm cùng người thương!`;
          } else if (newItem.category === 'drink') {
            destinationNote = '☕ Đã cất thức uống thơm lành vào Quầy thức uống!';
          }
          setLastGachaResult({ item: newItem, destinationNote });
          emitGameQuestAction('gacha');
          showToast(
            `🎉 Chúc mừng! Bạn đã nhận được [${RARITY_LABELS[newItem.rarity]}] "${newItem.name}"!`
          );
        } else {
          showToast(`🎉 ${res.message}`);
        }
      } finally {
        setIsRollingGacha(false);
      }
      return;
    }

    // Mở thêm bằng Cánh hoa
    if (!isOwner && petalsBalance < rollCost) {
      showToast(
        `Bạn cần ${rollCost} ${currencyName} để mở thêm hộp quà Gacha nhé 🌸`
      );
      return;
    }
    onAddPetals(-rollCost);
    setIsRollingGacha(true);
    setLastGachaResult(null);
    markDailyTaskReady('gacha');

    setTimeout(async () => {
      const categories: ItemCategory[] = ['flower', 'fish', 'pet', 'drink'];
      const chosenCategory =
        categories[Math.floor(Math.random() * categories.length)];

      const newItem = generateUniqueGameItem(chosenCategory, {
        companionCharTags: companionChar?.tags || ['Dịu dàng'],
      });

      const inserted = await insertCraftedDrinkToInventory({
        item_type: newItem.category,
        item_name: newItem.name,
        rarity: newItem.rarity,
        color: newItem.visual.primaryColor,
      });
      if (inserted && newItem.category === 'pet') {
        persistTraitForPet(newItem.id, newItem.name, {
          petSpecies: newItem.petSpecies || 'Mèo Bông',
          matchedTag: newItem.matchedTag || 'Dịu dàng',
          personality: newItem.petPersonality || 'hiền lành, điềm đạm',
          behaviorStyle: newItem.petBehaviorStyle || 'gentle_sway',
          sound: newItem.petSound || 'Meo~ 🌸',
          vibeReason: sanitizePetVibeNote(
            newItem.vibeReason,
            newItem.matchedTag,
            newItem.petSpecies
          ),
        });
      }
      await refreshSupabaseInventoryAndRoll();
      emitGameQuestAction('gacha');

      const destinationNote =
        newItem.category === 'pet'
          ? `🐾 Đã đón "${newItem.name}" về chăm bẵm cùng người thương!`
          : `✨ Đã thêm "${newItem.name}" vào Kho đồ!`;
      setIsRollingGacha(false);
      setLastGachaResult({ item: newItem, destinationNote });
    }, 850);
  };

  // ============================================================================
  // 2. XỬ LÝ VƯỜN HOA (5 GIAI ĐOẠN, ĐẾM NGƯỢC THẬT, KHÔNG GIỚI HẠN Ô VƯỜN)
  // ============================================================================
  const handleSowNewSeedInPlot = (plotId: string) => {
    const newSeed = generateUniqueGameItem('flower');
    const now = Date.now();
    const nextPlots = gardenPlots.map((p) =>
      p.id === plotId
        ? {
            ...p,
            seedItem: newSeed,
            stage: 0 as GardenStage,
            stageStartedAt: now,
            stageDurationMs: STAGE_DURATIONS_MS[0],
            wateredInCurrentStage: false,
          }
        : p
    );
    setGardenPlots(nextPlots);
    saveGardenPlots(nextPlots);
    emitGameQuestAction('water');
    showToast(`🌱 Đã gieo hạt giống "${newSeed.name}" vào ô vườn!`);
  };

  const handleWaterPlot = (plotId: string) => {
    const now = Date.now();
    let stageAdvancedName: string | null = null;

    const nextPlots = gardenPlots.map((plot) => {
      if (plot.id !== plotId || !plot.seedItem || plot.stage === 4) {
        return plot;
      }

      const elapsed = now - plot.stageStartedAt;
      const timerDone = elapsed >= plot.stageDurationMs;

      // Nếu đã hết thời gian chờ của giai đoạn hiện tại -> tưới nước chuyển ngay sang giai đoạn tiếp theo!
      if (timerDone) {
        const nextStage = Math.min(4, plot.stage + 1) as GardenStage;
        stageAdvancedName = `${plot.seedItem.name} đã lớn lên giai đoạn: ${GARDEN_STAGE_NAMES[nextStage]}!`;
        return {
          ...plot,
          stage: nextStage,
          stageStartedAt: now,
          stageDurationMs: STAGE_DURATIONS_MS[nextStage],
          wateredInCurrentStage: false,
        };
      }

      // Nếu đang trong thời gian chờ mà chưa tưới -> tưới nước giúp rút ngắn 50% thời gian chờ còn lại!
      if (!plot.wateredInCurrentStage) {
        const remaining = Math.max(0, plot.stageDurationMs - elapsed);
        const reducedDuration = elapsed + Math.floor(remaining * 0.45);
        stageAdvancedName = `💧 Đã tưới nước mát lành cho "${plot.seedItem.name}" (tăng tốc phát triển)!`;
        return {
          ...plot,
          stageDurationMs: reducedDuration,
          wateredInCurrentStage: true,
        };
      }

      return plot;
    });

    setGardenPlots(nextPlots);
    saveGardenPlots(nextPlots);
    markDailyTaskReady('water');
    emitGameQuestAction('water');
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('water');
    }
    if (stageAdvancedName) {
      showToast(stageAdvancedName);
    }
  };

  // Tự động kiểm tra nếu cây đã được tưới ở giai đoạn hiện tại VÀ hết giờ chờ thì lên giai đoạn mới
  useEffect(() => {
    let updated = false;
    const nextPlots = gardenPlots.map((plot) => {
      if (
        plot.seedItem &&
        plot.stage < 4 &&
        plot.wateredInCurrentStage &&
        nowMs - plot.stageStartedAt >= plot.stageDurationMs
      ) {
        updated = true;
        const nextStage = (plot.stage + 1) as GardenStage;
        return {
          ...plot,
          stage: nextStage,
          stageStartedAt: nowMs,
          stageDurationMs: STAGE_DURATIONS_MS[nextStage],
          wateredInCurrentStage: false,
        };
      }
      return plot;
    });

    if (updated) {
      setGardenPlots(nextPlots);
      saveGardenPlots(nextPlots);
    }
  }, [nowMs, gardenPlots]);

  const handleHarvestFlower = async (plotId: string, sellForPetals: boolean) => {
    const target = gardenPlots.find((p) => p.id === plotId);
    if (!target || !target.seedItem || target.stage < 4) return;

    const harvestedFlower = target.seedItem;
    const nextPlots = gardenPlots.map((p) =>
      p.id === plotId
        ? {
            ...p,
            seedItem: null,
            stage: 0 as GardenStage,
            stageStartedAt: Date.now(),
            stageDurationMs: STAGE_DURATIONS_MS[0],
            wateredInCurrentStage: false,
          }
        : p
    );
    setGardenPlots(nextPlots);
    saveGardenPlots(nextPlots);

    // Đánh dấu ready_at = null (đã thu hoạch xong, sẵn sàng dùng để mở khóa Char)
    await updateInventoryItemReadyAt(harvestedFlower.id, null);

    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('harvest');
    }

    if (sellForPetals) {
      const price =
        harvestedFlower.rarity === 'legendary'
          ? 25
          : harvestedFlower.rarity === 'rare'
          ? 16
          : 10;
      onAddPetals(price);
      emitGameQuestAction('water');
      showToast(
        `🌸 Đã bán đóa "${harvestedFlower.name}" và nhận +${price} ${currencyName}!`
      );
    } else {
      const readyFlower = { ...harvestedFlower, readyAt: null };
      const nextInv = addItemToInventory(readyFlower);
      setInventory(nextInv);
      await refreshSupabaseInventoryAndRoll();
      emitGameQuestAction('water');
      showToast(
        `✨ Đã thu hoạch "${harvestedFlower.name}" vào Kho đồ (có thể tặng Char hoặc dùng mở khóa Char)!`
      );
    }
  };

  const handleAddGardenPlot = () => {
    const newPlot: GardenPlotState = {
      id: `plot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      seedItem: null,
      stage: 0,
      stageStartedAt: Date.now(),
      stageDurationMs: STAGE_DURATIONS_MS[0],
      wateredInCurrentStage: false,
    };
    const next = [...gardenPlots, newPlot];
    setGardenPlots(next);
    saveGardenPlots(next);
    showToast('🌱 Đã mở thêm một ô đất mới trong Vườn hoa!');
  };

  // ============================================================================
  // 3. XỬ LÝ HỒ CÁ (CHO CÁ ĂN BẰNG HẠT CÁ, CÁ LỚN DẦN & TIẾT RA CÁNH HOA)
  // ============================================================================
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

  const handleFeedFish = (fishId: string) => {
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

    const nextFish = pondFish.map((f) => {
      if (f.id !== fishId) return f;
      const nextXp = f.xp + 25;
      let nextStage: PondFishState['stage'] = f.stage;
      if (f.stage === 'egg') nextStage = 'baby';
      else if (f.stage === 'baby' && nextXp >= 45) nextStage = 'juvenile';
      else if (nextXp >= 85) nextStage = 'adult';

      return {
        ...f,
        stage: nextStage,
        xp: nextXp,
        fullUntil: now + 3 * 60 * 1000, // Cá no trong 3 phút và liên tục tiết ra Cánh hoa
        lastPetalGeneratedAt: now,
        pendingPetals: f.pendingPetals + 2,
      };
    });

    setPondFish(nextFish);
    savePondFishList(nextFish);
    markDailyTaskReady('feed_fish');
    emitGameQuestAction('fish');
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('feed_fish');
    }
    showToast('🐟 Đã thả Hạt cá! Cá no bụng đang vui vẻ tiết ra thêm Cánh hoa!');
  };

  const [isCastingRod, setIsCastingRod] = useState(false);

  const handleFishCast = () => {
    if (isCastingRod) return;
    setIsCastingRod(true);
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('fish_cast');
    }
    showToast('🎣 Bạn vung nhẹ cần câu xuống mặt hồ êm đềm... Đàn cá tò mò quẫy đuôi!');
    setTimeout(() => {
      setIsCastingRod(false);
      showToast('✨ Một làn gợn sóng lấp lánh xuất hiện trên mặt hồ!');
    }, 1800);
  };

  const handleCollectFishPetals = (fishId: string) => {
    const target = pondFish.find((f) => f.id === fishId);
    if (!target || target.pendingPetals <= 0) return;

    const amount = target.pendingPetals;
    onAddPetals(amount);
    const nextFish = pondFish.map((f) =>
      f.id === fishId ? { ...f, pendingPetals: 0 } : f
    );
    setPondFish(nextFish);
    savePondFishList(nextFish);
    emitGameQuestAction('fish');
    showToast(
      `✨ Đã thu hoạch +${amount} ${currencyName} từ chú cá "${target.item.name}"!`
    );
  };

  const handleHatchNewFishEgg = () => {
    const cost = 12;
    if (!isOwner && petalsBalance < cost) {
      showToast(`Cần ${cost} ${currencyName} để thả thêm trứng cá mới vào hồ 🌸`);
      return;
    }
    onAddPetals(-cost);
    const newFishItem = generateUniqueGameItem('fish');
    const now = Date.now();
    const newFishState: PondFishState = {
      id: newFishItem.id,
      item: newFishItem,
      stage: 'egg',
      xp: 0,
      hatchedAt: now,
      fullUntil: now + 90 * 1000,
      lastPetalGeneratedAt: now,
      pendingPetals: 0,
      swimSpeed: 15 + Math.floor(Math.random() * 12),
      swimOffset: Math.floor(Math.random() * 85),
    };
    const next = [newFishState, ...pondFish];
    setPondFish(next);
    savePondFishList(next);
    emitGameQuestAction('fish');
    showToast(`🥚 Đã thả trứng "${newFishItem.name}" xuống Hồ cá!`);
  };

  // ============================================================================
  // 4. XỬ LÝ PHÒNG TRI KỶ & THÚ CƯNG + QUẦY THỨC UỐNG
  // ============================================================================
  const ownedFlowers = useMemo(
    () => inventory.filter((i) => i.category === 'flower'),
    [inventory]
  );
  const ownedDrinks = useMemo(
    () => inventory.filter((i) => i.category === 'drink'),
    [inventory]
  );
  const ownedPets = useMemo(
    () => inventory.filter((i) => i.category === 'pet'),
    [inventory]
  );

  const triggerCompanionDialogue = useCallback(
    (
      situation: DialogueSituation,
      options?: {
        charTagsOverride?: string[];
        bondOverride?: number;
        itemName?: string;
      }
    ) => {
      const tagsToUse =
        options?.charTagsOverride || companionChar?.tags || ['Dịu dàng'];
      const bondToUse =
        options?.bondOverride !== undefined
          ? options.bondOverride
          : roomState.bondPoints;

      const generated = generateCompanionDialogueByTags({
        charTags: tagsToUse,
        situation,
        bondPoints: bondToUse,
        itemName: options?.itemName,
        customVoices: effectiveTagVoices,
        previousText: activeDialogueText,
      });
      setActiveDialogueText(generated.text);
    },
    [
      companionChar?.tags,
      roomState.bondPoints,
      effectiveTagVoices,
      activeDialogueText,
    ]
  );

  const handleSelectCompanionChar = (charId: string) => {
    const next = { ...roomState, companionCharId: charId };
    setRoomState(next);
    saveCompanionRoomState(next);
    const found = characters.find((c) => c.id === charId);
    if (found) {
      triggerCompanionDialogue('greeting', {
        charTagsOverride: found.tags,
        bondOverride: next.bondPoints,
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

  const handleGiftItemToCompanion = (item: GeneratedGameItem) => {
    const bondGain =
      item.rarity === 'legendary' ? 18 : item.rarity === 'rare' ? 12 : 8;
    const nextInv = removeItemFromInventory(item.id);
    setInventory(nextInv);

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
      `💝 Đã tặng "${item.name}" cho người thương! (+${bondGain} Gắn bó)`
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

    const nextRoom = {
      ...roomState,
      happiness: Math.min(100, roomState.happiness + 4),
      bondPoints: roomState.bondPoints + 2,
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);

    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('pet_stroke');
    }
    showToast(
      `🐾 Bạn nhẹ nhàng vuốt ve ${targetPet?.name || 'bé thú cưng'}, bé rúc vào tay kêu "${sound}"!`
    );
  };

  const handleFeedPet = (petId: string) => {
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

    const now = Date.now();
    const nextRoom = {
      ...roomState,
      petFoodCount: roomState.petFoodCount - 1,
      happiness: Math.min(100, roomState.happiness + 6),
      bondPoints: roomState.bondPoints + 3,
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);

    const nextInv = inventory.map((it) =>
      it.id === petId ? { ...it, hungerFullUntil: now + 15 * 60 * 1000 } : it
    );
    setInventory(nextInv);
    saveInventoryItems(nextInv);
    emitGameQuestAction('feed_pet');
    if (currentUser && currentUser.role !== 'guest') {
      logGameActionViaRpc('feed_pet');
    }
    showToast(
      `🐾 ${targetPet?.name || 'Thú cưng'} kêu "${
        targetPet?.petSound || 'Meo~'
      }" và ăn no nê vui vẻ!`
    );
  };

  const handleBrewNewDrinkAtBar = async () => {
    const cost = 10;
    if (!isOwner && petalsBalance < cost) {
      showToast(
        `Cần ${cost} ${currencyName} để pha chế một ly thức uống mới tại quầy nhé ☕`
      );
      return;
    }
    onAddPetals(-cost);
    const newDrink = generateUniqueGameItem('drink');
    const nextInv = addItemToInventory(newDrink);
    setInventory(nextInv);
    await insertCraftedDrinkToInventory({
      item_type: 'drink',
      item_name: newDrink.name,
      rarity: newDrink.rarity,
      color: newDrink.visual.primaryColor,
    });
    await refreshSupabaseInventoryAndRoll();
    emitGameQuestAction('gift_drink');
    showToast(`☕ Đã pha chế thành công ly "${newDrink.name}" độc nhất!`);
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
                'Mỗi bông hoa, chú cá, thú cưng và ly thức uống đều mang một cái tên và hình dáng riêng biệt không trùng lặp. Chăm sóc nhịp chậm để tặng tri kỷ hoặc mở khóa nhân vật mới.'
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
              badge: `${gardenPlots.length} ô vườn`,
            },
            {
              id: 'pond',
              label: '🐟 Hồ Cá Đêm',
              badge: `${pondFish.length} chú cá`,
            },
            {
              id: 'companion',
              label: '🏡 Phòng Tri Kỷ & Thú Cưng',
              badge: `${ownedPets.length} thú cưng`,
            },
            {
              id: 'drinks',
              label: '☕ Quầy Thức Uống',
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
                Nơi trao đổi những thức quà dịu dàng, hạt giống mầm hoa, cá bơi đêm và thức uống thơm lành. Hoàn thành nhiệm vụ mỗi ngày để tích lũy thêm {coinCurrencyName}!
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
            {/* 2. ĐIỂM DANH NHẬN XU */}
            <div className="soft-card p-5 border border-[var(--border)] flex flex-col justify-between gap-4 bg-gradient-to-b from-[var(--surface)] to-[var(--bg)]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent)] uppercase tracking-wider">
                  <Gift className="w-4 h-4" />
                  <span>Điểm danh mỗi ngày</span>
                </div>
                <h4 className="font-serif-title text-lg font-bold text-[var(--text)]">
                  Món Quà Ban Mai 🎁
                </h4>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Mỗi ngày ghé thăm Chợ nhỏ, bạn sẽ được trao tặng 10 {coinCurrencyName} ngọt ngào để bắt đầu ngày mới tràn đầy niềm vui.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isClaimingDaily}
                  onClick={handleClaimDailyCoins}
                  className="w-full py-3 rounded-2xl font-extrabold text-xs bg-[var(--accent)] text-[#3a2b30] bouncy-btn shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isClaimingDaily ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>🎁</span>
                  )}
                  <span>Nhận quà mỗi ngày (+10 {coinCurrencyName})</span>
                </button>
                <p className="text-[10px] text-[var(--muted)] text-center mt-2">
                  Làm mới tự động sau 00:00 mỗi đêm
                </p>
              </div>
            </div>

            {/* 3. NHIỆM VỤ HÔM NAY (ĐỒNG HỒ ĐẾM NGƯỢC & 3 THẺ NHIỆM VỤ) */}
            <div className="lg:col-span-2 soft-card p-5 border border-[var(--border)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <div>
                    <h4 className="font-serif-title text-base font-bold text-[var(--text)]">
                      Nhiệm Vụ Hôm Nay
                    </h4>
                    <p className="text-[11px] text-[var(--muted)]">
                      Làm hành động trong game để tự động nhận thưởng (hoặc bấm &quot;Mình đã làm xong&quot;).
                    </p>
                  </div>
                </div>

                {/* Đồng hồ đếm ngược resets_at */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[11px] font-bold text-[var(--text)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>
                    Nhiệm vụ mới sau:{' '}
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

                        {/* Gợi ý nhẹ nhàng nơi để làm khi chưa xong */}
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

          {/* 4. CỬA HÀNG CHỢ NHỎ */}
          <div className="soft-card p-6 space-y-4 border border-[var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                  <Store className="w-5 h-5 text-[var(--accent)]" />
                  <span>Cửa Hàng Vật Phẩm</span>
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Hoa và cá mới mua cần 30 phút để nở hoa/lớn khôn trong Kho đồ trước khi sẵn sàng mở khóa nhân vật ⏳
                </p>
              </div>
              <span className="text-xs text-[var(--muted)] italic">
                🌸 Tên mỗi vật phẩm do server cấp ngẫu nhiên độc nhất
              </span>
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
                      desc: string;
                      needGrow: boolean;
                    }
                  > = {
                    flower: {
                      name: 'Hoa Tươi',
                      emoji: '🌸',
                      desc: 'Mầm hoa thơm ngát, nở hoa rực rỡ sau 30 phút.',
                      needGrow: true,
                    },
                    fish: {
                      name: 'Cá Bơi',
                      emoji: '🐟',
                      desc: 'Chú cá lấp lánh, cần 30 phút để lớn khôn trong hồ.',
                      needGrow: true,
                    },
                    drink: {
                      name: 'Thức Uống',
                      emoji: '☕',
                      desc: 'Ly nước pha sẵn ngọt lành, dùng được ngay lập tức.',
                      needGrow: false,
                    },
                    pet: {
                      name: 'Thú Cưng',
                      emoji: '🐾',
                      desc: 'Người bạn thú đáng yêu mang tính cách và vibe độc nhất.',
                      needGrow: false,
                    },
                  };
                  const meta = labelMap[row.kind] || {
                    name: row.kind,
                    emoji: '📦',
                    desc: 'Vật phẩm kỳ diệu tại Chợ nhỏ.',
                    needGrow: false,
                  };

                  return (
                    <div
                      key={row.kind}
                      id={`market-card-${row.kind}`}
                      className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{meta.emoji}</span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <span>{row.buy_price}</span>
                            <span>{coinCurrencyEmoji}</span>
                          </span>
                        </div>
                        <h5 className="font-serif-title text-base font-bold text-[var(--text)]">
                          {row.buy_price} {coinCurrencyName} → 1 {meta.emoji} {meta.name}
                        </h5>
                        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                          {meta.desc}
                        </p>
                        {meta.needGrow && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg)] text-[10px] font-semibold text-[var(--muted)]">
                            <Clock className="w-3 h-3 text-[var(--accent)]" />
                            <span>Cần 30 phút lớn khôn</span>
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
                        <span>Mua ({row.buy_price} {coinCurrencyName})</span>
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
                  Trao đổi các vật phẩm bạn đã thu hoạch hoặc dư thừa trong Kho đồ để thu về {coinCurrencyName}.
                </p>
              </div>
              <span className="text-xs font-bold text-[var(--muted)]">
                Trong kho: {inventory.length} món
              </span>
            </div>

            {inventory.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--muted)]">
                Kho đồ của bạn đang trống. Hãy mở Gacha, trồng hoa hoặc câu cá để có vật phẩm bán nhé!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
                {inventory.map((item) => {
                  const priceRow = marketPrices.find((p) => p.kind === item.category);
                  const sellPrice = priceRow?.sell_price || 0;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                          <ProceduralItemSvg item={item} size={32} />
                        </div>
                        <div className="min-w-0">
                          <h6 className="font-bold text-xs text-[var(--text)] truncate">
                            {item.name}
                          </h6>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                            <span>{CATEGORY_LABELS[item.category].emoji}</span>
                            <span>{RARITY_LABELS[item.rarity]}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/40">
                        <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                          +{sellPrice} {coinCurrencyName}
                        </span>
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
                    ✨ Tên riêng độc nhất 100% không trùng
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
                      <strong> 🌱 Hạt giống Hoa</strong> (đưa về Vườn hoa),
                      <strong> 🥚 Trứng Cá</strong> (thả vào Hồ cá),
                      <strong> 🐾 Thú cưng</strong> (chăm bẵm cùng người thương), hoặc
                      <strong> ☕ Thức uống</strong> (cất vào Quầy thức uống).
                    </>
                  )}
                </div>
              </div>

              {/* Khu hiển thị hiệu ứng mở quà hoặc kết quả vừa mở */}
              <div className="min-h-[175px] rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)]/80 p-5 flex flex-col items-center justify-center text-center">
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
                      <ProceduralItemSvg
                        item={lastGachaResult.item}
                        size={76}
                        gardenStage={
                          lastGachaResult.item.category === 'flower' ? 4 : undefined
                        }
                      />
                    </div>
                    <div className="space-y-1">
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
                        {lastGachaResult.item.name}
                      </h4>
                      <p className="text-xs text-[var(--muted)] leading-relaxed">
                        {lastGachaResult.destinationNote}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-4 text-[var(--muted)]">
                    <Sparkles className="w-7 h-7 text-[var(--accent)] mx-auto" />
                    <p className="text-xs">
                      Bấm nút mở quà bên dưới để đón một vật phẩm có tên riêng duy nhất nhé!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!hasFreeGachaToday || isRollingGacha}
                  onClick={() => handleRollGacha(true)}
                  className={`flex-1 py-3 px-4 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                    hasFreeGachaToday
                      ? 'bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-sm'
                      : 'bg-[var(--border)] text-[var(--muted)] opacity-60 cursor-not-allowed'
                  }`}
                >
                  <Gift className="w-4 h-4" />
                  <span>
                    {hasFreeGachaToday
                      ? '🎁 Mở quà Miễn Phí hôm nay (1/1)'
                      : 'Đã nhận lượt miễn phí hôm nay'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isRollingGacha}
                  onClick={() => handleRollGacha(false)}
                  className="py-3 px-5 rounded-full text-xs font-bold border-2 border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--accent)]/20 bouncy-btn cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Roll thêm (-15 {currencyName})</span>
                </button>
              </div>
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

          {/* KHO ĐỒ VẬT PHẨM (INVENTORY) */}
          <div className="soft-card p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] flex items-center gap-2">
                  <Package className="w-5 h-5 text-[var(--accent)]" />
                  <span>Kho Đồ Của Bạn ({inventory.length} vật phẩm)</span>
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Tất cả Hoa đã thu hoạch, Thú cưng và Thức uống đang cất giữ (Cá đang bơi ở Hồ cá cũng được tính khi mở khóa Char).
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

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: `Tất cả (${inventory.length})` },
                  {
                    id: 'flower',
                    label: `🌸 Hoa (${ownedFlowers.length})`,
                  },
                  {
                    id: 'drink',
                    label: `☕ Thức uống (${ownedDrinks.length})`,
                  },
                  {
                    id: 'pet',
                    label: `🐾 Thú cưng (${ownedPets.length})`,
                  },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setInvCategoryFilter(c.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${
                    invCategoryFilter === c.id
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {filteredInventory.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--muted)]">
                Chưa có vật phẩm nào khớp với bộ lọc trong Kho đồ 🌸
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredInventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col justify-between gap-3 hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                        <ProceduralItemSvg item={item} size={48} />
                      </div>
                      <div className="min-w-0 space-y-1">
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
                          {item.name}
                        </h4>
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                      {item.category === 'pet'
                        ? sanitizePetVibeNote(
                            item.vibeReason || item.description,
                            item.matchedTag,
                            item.petSpecies
                          )
                        : item.description}
                    </p>

                    {(item.category === 'flower' ||
                      item.category === 'drink') && (
                      <button
                        type="button"
                        onClick={() => handleGiftItemToCompanion(item)}
                        className="w-full py-1.5 rounded-full text-[11px] font-bold bg-[var(--accent)]/25 text-[var(--text)] hover:bg-[var(--accent)] hover:text-[#3a2b30] transition-colors cursor-pointer"
                      >
                        💝 Tặng cho người thương
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 2: VƯỜN HOA (5 GIAI ĐOẠN PHÁT TRIỂN, ĐẾM NGƯỢC THẬT, KHÔNG GIỚI HẠN Ô)
         ===================================================================== */}
      {activeZone === 'garden' && (
        <div className="soft-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div className="space-y-1">
              <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] flex items-center gap-2">
                <Flower2 className="w-5 h-5 text-[var(--accent)]" />
                <span>Vườn Hoa Đêm ({gardenPlots.length} ô vườn)</span>
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Mỗi hạt giống phát triển qua 5 giai đoạn: <strong>Hạt → Nảy mầm → Cây con → Nụ → Nở</strong>. Mỗi giai đoạn có đếm ngược thời gian thật, hãy tưới nước đúng lúc để cây lớn nhé (cây không bao giờ héo hay chết).
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddGardenPlot}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>➕ Mở thêm ô vườn</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {gardenPlots.map((plot, idx) => {
              if (!plot.seedItem) {
                return (
                  <div
                    key={plot.id}
                    className="p-5 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)]/60 flex flex-col items-center justify-center text-center gap-3 min-h-[260px]"
                  >
                    <span className="text-xs font-bold text-[var(--muted)]">
                      Ô vườn #{idx + 1} (Đang trống)
                    </span>
                    <p className="text-[11px] text-[var(--muted)]">
                      Gieo một hạt giống mới hoặc mở Gacha để nhận hạt giống hiếm.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSowNewSeedInPlot(plot.id)}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Flower2 className="w-3.5 h-3.5" />
                      <span>🌱 Gieo hạt giống mới</span>
                    </button>
                  </div>
                );
              }

              const elapsed = nowMs - plot.stageStartedAt;
              const remainingMs = Math.max(0, plot.stageDurationMs - elapsed);
              const isStageReady = plot.stage < 4 && remainingMs === 0;
              const isBloomed = plot.stage === 4;

              return (
                <div
                  key={plot.id}
                  className={`p-5 rounded-2xl border bg-[var(--bg)] flex flex-col justify-between gap-4 transition-all ${
                    isBloomed
                      ? 'border-2 border-[var(--accent)] shadow-sm'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--muted)] font-semibold">
                        Ô vườn #{idx + 1}
                      </span>
                      <span className="sticker-chip text-[10px] font-bold">
                        {RARITY_LABELS[plot.seedItem.rarity]}
                      </span>
                    </div>

                    <h4 className="font-serif-title text-base font-bold text-[var(--text)] leading-snug">
                      {plot.seedItem.name}
                    </h4>

                    <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>
                        Giai đoạn ({plot.stage + 1}/5):{' '}
                        <strong className="text-[var(--text)]">
                          {GARDEN_STAGE_NAMES[plot.stage]}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Hình SVG phát triển theo từng giai đoạn */}
                  <div className="py-2 flex flex-col items-center justify-center">
                    <ProceduralItemSvg
                      item={plot.seedItem}
                      size={92}
                      gardenStage={plot.stage}
                    />
                  </div>

                  {/* Đồng hồ đếm ngược thật & Nút Tưới nước / Thu hoạch */}
                  {!isBloomed ? (
                    <div className="space-y-2.5">
                      <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs">
                        <span className="text-[var(--muted)] inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>Đếm ngược:</span>
                        </span>
                        <span className="font-bold text-[var(--text)] tabular-nums">
                          {formatCountdown(remainingMs)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleWaterPlot(plot.id)}
                        className={`w-full py-2 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                          isStageReady
                            ? 'bg-[var(--accent)] text-[#3a2b30] bouncy-btn shadow-xs'
                            : plot.wateredInCurrentStage
                            ? 'bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]'
                            : 'bg-[var(--accent)]/25 text-[var(--text)] hover:bg-[var(--accent)] hover:text-[#3a2b30]'
                        }`}
                      >
                        <Droplets className="w-3.5 h-3.5" />
                        <span>
                          {isStageReady
                            ? '💧 Tưới nước lên giai đoạn kế!'
                            : plot.wateredInCurrentStage
                            ? 'Đã tưới (Đang chờ lớn...)'
                            : '💧 Tưới nước chăm cây'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handleHarvestFlower(plot.id, false)}
                        className="w-full py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs"
                      >
                        ✨ Thu hoạch vào Kho đồ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHarvestFlower(plot.id, true)}
                        className="w-full py-1.5 rounded-full text-[11px] font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        Bán bớt hoa (+
                        {plot.seedItem.rarity === 'legendary'
                          ? 25
                          : plot.seedItem.rarity === 'rare'
                          ? 16
                          : 10}{' '}
                        {currencyEmoji})
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 3: HỒ CÁ (CÁ NỞ TỪ TRỨNG, BƠI CHẬM, CHO ĂN BẰNG HẠT CÁ & TIẾT CÁNH HOA)
         ===================================================================== */}
      {activeZone === 'pond' && (
        <div className="space-y-6">
          <div className="soft-card p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] flex items-center gap-2">
                  <Fish className="w-5 h-5 text-[var(--accent)]" />
                  <span>Hồ Cá Đêm ({pondFish.length} chú cá)</span>
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Cá nở từ trứng, bơi chậm và lớn dần khi được cho ăn bằng <strong>Hạt cá</strong>. Khi cá no bụng, chúng sẽ tiết ra thêm {currencyName} theo thời gian!
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="sticker-chip text-xs font-bold">
                  🐟 Hạt cá hiện có: {roomState.fishFoodCount}
                </span>
                <button
                  type="button"
                  onClick={handleBuyFishFood}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Mua +3 Hạt cá (-8 {currencyEmoji})</span>
                </button>
                <button
                  type="button"
                  onClick={handleFishCast}
                  disabled={isCastingRod}
                  className="px-4 py-2 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1.5"
                  title="Thả cần câu tìm niềm vui ở mặt hồ"
                >
                  <span>{isCastingRod ? '🎣 Đang thả câu...' : '🎣 Thả cần câu'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleHatchNewFishEgg}
                  className="px-4 py-2 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--accent)]/20 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thả thêm trứng cá (-12 {currencyEmoji})</span>
                </button>
              </div>
            </div>

            {/* Mặt hồ SVG trực quan có cá bơi chậm */}
            <div className="relative h-64 rounded-2xl border-2 border-[var(--border)] bg-gradient-to-b from-[#9cc7ee]/20 to-[#8fcfbf]/25 overflow-hidden p-4">
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="w-32 h-32 rounded-full border border-[var(--accent)] absolute top-6 left-12 animate-ping" style={{ animationDuration: '6s' }} />
                <div className="w-40 h-40 rounded-full border border-[var(--accent)] absolute bottom-4 right-16 animate-ping" style={{ animationDuration: '8s' }} />
              </div>

              {pondFish.map((f, idx) => {
                const topPercent = 12 + ((idx * 23) % 68);
                const leftPercent = (f.swimOffset + Math.floor(nowMs / 1000) * 2) % 84;
                const isFull = f.fullUntil > nowMs;
                return (
                  <div
                    key={f.id}
                    style={{
                      top: `${topPercent}%`,
                      left: `${leftPercent}%`,
                      transition: 'left 1.2s linear, top 1s ease',
                    }}
                    className="absolute flex flex-col items-center group"
                  >
                    {f.pendingPetals > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCollectFishPetals(f.id)}
                        className="mb-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-[#3a2b30] text-[10px] font-bold shadow-sm animate-bounce cursor-pointer"
                      >
                        +{f.pendingPetals} {currencyEmoji}
                      </button>
                    )}
                    <div
                      onClick={() => handleFeedFish(f.id)}
                      title={`Bấm để cho "${f.item.name}" ăn Hạt cá`}
                      className="cursor-pointer hover:scale-110 transition-transform"
                    >
                      <ProceduralItemSvg
                        item={f.item}
                        size={f.stage === 'egg' ? 40 : f.stage === 'baby' ? 48 : 62}
                        fishStage={f.stage}
                      />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--surface)]/90 border border-[var(--border)] text-[10px] font-bold text-[var(--text)] whitespace-nowrap shadow-2xs">
                      {f.item.name} {isFull ? '💛' : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Danh sách chi tiết từng chú cá trong hồ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pondFish.map((f) => {
                const isFull = f.fullUntil > nowMs;
                const stageLabel =
                  f.stage === 'egg'
                    ? '🥚 Trứng cá'
                    : f.stage === 'baby'
                    ? '🐟 Cá con'
                    : f.stage === 'juvenile'
                    ? '🐠 Cá nhỡ'
                    : '👑 Cá trưởng thành';

                return (
                  <div
                    key={f.id}
                    className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                        <ProceduralItemSvg
                          item={f.item}
                          size={48}
                          fishStage={f.stage}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]">
                            {stageLabel}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--muted)]">
                            {RARITY_LABELS[f.item.rarity]}
                          </span>
                        </div>
                        <h4 className="font-serif-title text-base font-bold text-[var(--text)] truncate mt-0.5">
                          {f.item.name}
                        </h4>
                        <p className="text-[11px] text-[var(--muted)]">
                          Độ lớn (XP): {f.xp} ·{' '}
                          {isFull
                            ? 'Đang no bụng (Đang tiết Cánh hoa ✨)'
                            : 'Đang đợi Hạt cá'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFeedFish(f.id)}
                        className="flex-1 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer bouncy-btn"
                      >
                        🐟 Cho ăn (-1 Hạt cá)
                      </button>

                      {f.pendingPetals > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCollectFishPetals(f.id)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] cursor-pointer"
                        >
                          Nhận +{f.pendingPetals} {currencyEmoji}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          KHU 4: PHÒNG TRI KỶ & THÚ CƯNG (KHỚP VIBE TAG CHAR, NUÔI KHÔNG GIỚI HẠN)
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

                {/* Thông tin Văn phong theo Tag của nhân vật đồng hành */}
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
                  <span className="sticker-chip text-[10px]">
                    Xưng hô: {companionBlendedVoices[0]?.pronouns}
                  </span>
                </div>

                {/* Khung thoại của Char */}
                <blockquote className="p-4 rounded-2xl bg-[var(--surface)] border-l-4 border-[var(--accent)] text-sm italic text-[var(--text)] leading-relaxed">
                  {activeDialogueText}
                </blockquote>

                {/* Các nút tương tác theo từng tình huống (chào, trò chuyện, tạm biệt, gắn bó cao) */}
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
                  🎁 Tặng Hoa hoặc Thức uống trong Kho đồ cho {companionChar?.name}:
                </h4>
                {ownedFlowers.length === 0 && ownedDrinks.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] italic">
                    Bạn chưa có Hoa hoặc Thức uống nào trong Kho đồ. Hãy thu hoạch ở Vườn hoa hoặc ghé Quầy thức uống nhé!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...ownedFlowers, ...ownedDrinks].slice(0, 8).map((gift) => (
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

            {/* Khu Thú cưng đi lang thang trong phòng & Cho thú ăn */}
            <div className="lg:col-span-5 soft-card p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
                    <PawPrint className="w-5 h-5 text-[var(--accent)]" />
                    <span>Thú Cưng Trong Phòng ({ownedPets.length})</span>
                  </h3>

                  <button
                    type="button"
                    onClick={handleBuyPetFood}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
                  >
                    +3 Thức ăn thú (-8 {currencyEmoji})
                  </button>
                </div>

                <p className="text-xs text-[var(--muted)]">
                  Mỗi bé thú cưng có dáng vẻ, nhịp bước đi và tiếng kêu theo tính cách riêng. Bạn có thể bấm vào thú cưng để nghe tiếng kêu hoặc cho ăn nhé!
                </p>

                {/* Sân nhỏ cho thú cưng đi lang thang theo tính cách */}
                <div className="relative h-48 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] overflow-hidden p-3">
                  {ownedPets.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[var(--muted)] text-center px-4">
                      Chưa có bé thú cưng nào trong phòng. Hãy mở Gacha mỗi ngày để đón thú cưng về chăm bẵm cùng người thương nhé!
                    </div>
                  ) : (
                    ownedPets.map((pet, idx) => {
                      const behavior = pet.petBehaviorStyle || 'gentle_sway';
                      // Tốc độ và kiểu di chuyển theo tính cách:
                      // - calm_slow (lạnh lùng/trầm lặng): đi rất chậm, ít nhảy
                      // - playful_bouncy (hài hước/tinh nghịch): chạy nhanh, nhún nhảy vui nhộn
                      // - mystic_float (bí ẩn/kỳ ảo): lướt êm nhẹ nhàng
                      // - energetic_dash (tsundere/năng động): chạy lon ton
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
                      const isFull = (pet.hungerFullUntil || 0) > nowMs;
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
                          <ProceduralItemSvg item={pet} size={48} />
                          <span className="px-2 py-0.5 rounded-full bg-[var(--surface)]/95 border border-[var(--border)] text-[10px] font-bold text-[var(--text)] whitespace-nowrap">
                            {pet.name} {isFull ? '❤️' : '🥣'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Danh sách thú cưng & ghi chú Vibe/Tính cách (TUYỆT ĐỐI KHÔNG HIỆN TÊN CHAR) */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {ownedPets.map((pet) => {
                    const isFull = (pet.hungerFullUntil || 0) > nowMs;
                    const cleanPetNote = sanitizePetVibeNote(
                      pet.vibeReason || pet.description,
                      pet.matchedTag,
                      pet.petSpecies
                    );
                    return (
                      <div
                        key={pet.id}
                        className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ProceduralItemSvg item={pet} size={38} />
                            <div className="min-w-0">
                              <div className="font-bold text-[var(--text)] truncate">
                                {pet.name}
                              </div>
                              <div className="text-[10px] text-[var(--muted)]">
                                {pet.petSpecies ? `${pet.petSpecies} · ` : ''}
                                {RARITY_LABELS[pet.rarity]} ·{' '}
                                {isFull ? 'Đang no & vui vẻ ❤️' : 'Đang đói bụng'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStrokePet(pet.id)}
                              className="px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold text-[10px] cursor-pointer hover:border-[var(--accent)]"
                            >
                              🐾 Vuốt ve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedPet(pet.id)}
                              className="px-3 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[11px] cursor-pointer"
                            >
                              Cho ăn (-1)
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
                  📖 Một số Vibe Tag & Loài Thú Cưng Tiêu Biểu:
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
          KHU 5: QUẦY THỨC UỐNG (SỐ LOẠI KHÔNG GIỚI HẠN, TÊN RIÊNG, TẶNG CHAR)
         ===================================================================== */}
      {activeZone === 'drinks' && (
        <div className="soft-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div className="space-y-1">
              <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[var(--accent)]" />
                <span>Quầy Thức Uống Đêm ({ownedDrinks.length} ly trong bộ sưu tập)</span>
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Mỗi ly thức uống pha ra đều có công thức và tên riêng độc nhất (Americano mật ong, Matcha latte mây...). Dùng để tặng cho {companionChar?.name} hoặc làm điều kiện mở khóa Char.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBrewNewDrinkAtBar}
              className="px-4 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>☕ Pha chế / Roll thức uống mới (-10 {currencyEmoji})</span>
            </button>
          </div>

          {ownedDrinks.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-bold text-[var(--text)]">
                Quầy thức uống của bạn đang trống ☕
              </p>
              <p className="text-xs text-[var(--muted)]">
                Hãy bấm nút Pha chế ở góc trên hoặc mở Gacha mỗi ngày để nhận những ly nước thơm lừng nhé!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ownedDrinks.map((drink) => (
                <div
                  key={drink.id}
                  className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                      <ProceduralItemSvg item={drink} size={48} />
                    </div>
                    <div className="min-w-0">
                      <span className="sticker-chip text-[10px] font-bold">
                        {RARITY_LABELS[drink.rarity]}
                      </span>
                      <h4 className="font-serif-title text-base font-bold text-[var(--text)] leading-snug mt-1">
                        {drink.name}
                      </h4>
                    </div>
                  </div>

                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    {drink.description}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleGiftItemToCompanion(drink)}
                    className="w-full py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer"
                  >
                    💝 Mời {companionChar?.name} thưởng thức
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hộp quà chúc mừng mua hàng thành công */}
      {boughtItemModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setBoughtItemModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl text-center"
          >
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[var(--accent)]/30 flex items-center justify-center text-3xl animate-bounce">
              🎁
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Hộp quà Chợ nhỏ
              </span>
              <h4 className="font-serif-title text-xl font-extrabold text-[var(--text)]">
                {boughtItemModal.item.item_name}
              </h4>
              <p className="text-xs text-[var(--muted)]">
                {boughtItemModal.message}
              </p>
            </div>

            {boughtItemModal.item.ready_at && (
              <div className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] space-y-1">
                <p className="font-bold flex items-center justify-center gap-1 text-amber-600 dark:text-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Cần 30 phút lớn khôn trong Kho đồ</span>
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Thời gian đếm ngược đang diễn ra trực tiếp trên Kho đồ &amp; Nhân vật.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setBoughtItemModal(null)}
              className="w-full py-2.5 rounded-full font-bold text-xs bg-[var(--accent)] text-[#3a2b30] cursor-pointer shadow-sm bouncy-btn"
            >
              ✨ Cất vào Kho đồ
            </button>
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
    </div>
  );
};
