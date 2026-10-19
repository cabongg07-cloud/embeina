import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import {
  CharacterItem,
  PartnerDialogueItem,
  DIALOGUES_COLLECTION,
  INITIAL_PARTNER_DIALOGUES,
} from '../data/sampleData';
import { dataStore } from '../services/dataLayer';
import { AuthUser, can } from '../services/authLayer';
import { EditableText } from './EditableText';
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
  TAG_TO_PET_VIBE_MAP,
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
import { ProceduralItemSvg } from './ProceduralItemSvg';

interface MiniGameTabProps {
  characters: CharacterItem[];
  petalsBalance: number;
  onAddPetals: (amount: number) => void;
  currentUser?: AuthUser;
  editMode?: boolean;
  currencyName?: string;
  currencyEmoji?: string;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
}

type MiniZone = 'gacha_inv' | 'garden' | 'pond' | 'companion' | 'drinks';

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
  editMode = false,
  currencyName = 'Cánh hoa',
  currencyEmoji = '🌸',
  customTexts = {},
  onUpdateCustomText,
}) => {
  const canEdit = Boolean(editMode && can('edit', currentUser));

  // Điều hướng 5 khu vực trong Mini Game
  const [activeZone, setActiveZone] = useState<MiniZone>('gacha_inv');

  // Đồng hồ thời gian thực (cập nhật mỗi giây cho Vườn hoa & Hồ cá)
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // State chính từ itemSystem (dataLayer)
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

  // Danh sách câu thoại dựng sẵn trong Phòng tri kỷ
  const [dialogues, setDialogues] = useState<PartnerDialogueItem[]>(() => {
    const list = dataStore.list<PartnerDialogueItem>(DIALOGUES_COLLECTION);
    return list.length > 0 ? list : INITIAL_PARTNER_DIALOGUES;
  });

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
  const [activeDialogueText, setActiveDialogueText] = useState<string>(
    '“Hôm nay bạn ghé chơi làm căn phòng nhỏ ấm hẳn lên. Chúng mình cùng ngắm hoa và trò chuyện nhé!”'
  );

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

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasFreeGachaToday = roomState.lastFreeGachaDate !== todayStr;

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
  // 1. XỬ LÝ GACHA MỖI NGÀY & MUA LƯỢT ROLL
  // ============================================================================
  const handleRollGacha = (useFreeRoll: boolean) => {
    if (isRollingGacha) return;
    const rollCost = 15;

    if (useFreeRoll) {
      if (!hasFreeGachaToday) return;
    } else {
      if (petalsBalance < rollCost) {
        showToast(
          `Bạn cần ${rollCost} ${currencyName} để mở thêm hộp quà Gacha nhé 🌸`
        );
        return;
      }
      onAddPetals(-rollCost);
    }

    setIsRollingGacha(true);
    setLastGachaResult(null);

    if (useFreeRoll) {
      const nextRoom = {
        ...roomState,
        lastFreeGachaDate: todayStr,
      };
      setRoomState(nextRoom);
      saveCompanionRoomState(nextRoom);
    }

    markDailyTaskReady('gacha');

    setTimeout(() => {
      const categories: ItemCategory[] = ['flower', 'fish', 'pet', 'drink'];
      const chosenCategory =
        categories[Math.floor(Math.random() * categories.length)];

      const newItem = generateUniqueGameItem(chosenCategory, {
        companionCharName: companionChar?.name || 'Tri kỷ',
        companionCharTags: companionChar?.tags || ['Dịu dàng'],
      });

      let destinationNote = '';

      if (chosenCategory === 'flower') {
        // Nhận hạt giống đưa vào Vườn hoa
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
          '🌱 Đã gieo hạt giống vào Vườn hoa! Hãy sang Vườn hoa tưới nước và chờ cây nở nhé.';
      } else if (chosenCategory === 'fish') {
        // Nhận trứng cá đưa vào Hồ cá
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
          '🥚 Trứng cá đã được thả vào Hồ cá! Hãy ghé Hồ cá cho ăn để bé cá mau nở và lớn nhé.';
      } else if (chosenCategory === 'pet') {
        // Nhận thú cưng về Phòng tri kỷ (và lưu trong Kho đồ)
        const nextInv = addItemToInventory(newItem);
        setInventory(nextInv);
        destinationNote = `🐾 Bé thú cưng đã chạy về Phòng tri kỷ của ${
          companionChar?.name || 'bạn'
        }! ${newItem.vibeReason || ''}`;
      } else {
        // Nhận thức uống cất vào Quầy thức uống & Kho đồ
        const nextInv = addItemToInventory(newItem);
        setInventory(nextInv);
        destinationNote =
          '☕ Đã cất ly thức uống thơm lừng vào Quầy thức uống & Kho đồ!';
      }

      setIsRollingGacha(false);
      setLastGachaResult({ item: newItem, destinationNote });
    }, 1050);
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

  const handleHarvestFlower = (plotId: string, sellForPetals: boolean) => {
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

    if (sellForPetals) {
      const price =
        harvestedFlower.rarity === 'legendary'
          ? 25
          : harvestedFlower.rarity === 'rare'
          ? 16
          : 10;
      onAddPetals(price);
      showToast(
        `🌸 Đã bán đóa "${harvestedFlower.name}" và nhận +${price} ${currencyName}!`
      );
    } else {
      const nextInv = addItemToInventory(harvestedFlower);
      setInventory(nextInv);
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
    if (petalsBalance < cost) {
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
    showToast('🐟 Đã thả Hạt cá! Cá no bụng đang vui vẻ tiết ra thêm Cánh hoa!');
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
    showToast(
      `✨ Đã thu hoạch +${amount} ${currencyName} từ chú cá "${target.item.name}"!`
    );
  };

  const handleHatchNewFishEgg = () => {
    const cost = 12;
    if (petalsBalance < cost) {
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

  const handleSelectCompanionChar = (charId: string) => {
    const next = { ...roomState, companionCharId: charId };
    setRoomState(next);
    saveCompanionRoomState(next);
    const found = characters.find((c) => c.id === charId);
    if (found) {
      setActiveDialogueText(found.openingLine);
    }
  };

  const handleChatWithCompanion = () => {
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

    // Lọc câu thoại đã mở khóa theo mức độ gắn bó
    const unlockedDialogues = dialogues.filter((d) => {
      if (d.tier === 'low') return true;
      if (d.tier === 'mid') return nextBond >= 30;
      if (d.tier === 'high') return nextBond >= 70;
      return true;
    });

    const chosen =
      unlockedDialogues[Math.floor(Math.random() * unlockedDialogues.length)] ||
      dialogues[0];
    if (chosen) {
      setActiveDialogueText(chosen.text);
    }
  };

  const handleGiftItemToCompanion = (item: GeneratedGameItem) => {
    const bondGain =
      item.rarity === 'legendary' ? 18 : item.rarity === 'rare' ? 12 : 8;
    const nextInv = removeItemFromInventory(item.id);
    setInventory(nextInv);

    const nextRoom = {
      ...roomState,
      bondPoints: roomState.bondPoints + bondGain,
      happiness: Math.min(100, roomState.happiness + 10),
    };
    setRoomState(nextRoom);
    saveCompanionRoomState(nextRoom);

    if (item.category === 'flower') {
      setActiveDialogueText(
        `“Đóa ${item.name} này thơm dịu quá... Cảm ơn người đã tự tay chăm sóc và mang đến tặng ta nhé 🌸 (+${bondGain} Gắn bó)”`
      );
    } else {
      setActiveDialogueText(
        `“Một ly ${item.name} vừa vặn cho buổi tối êm đềm. Thưởng thức cùng người làm lòng ta ấm áp hơn nhiều ☕ (+${bondGain} Gắn bó)”`
      );
    }
    showToast(
      `💝 Đã tặng "${item.name}" cho ${companionChar?.name}! (+${bondGain} Gắn bó)`
    );
  };

  const handleBuyPetFood = () => {
    const cost = 8;
    if (petalsBalance < cost) {
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

  const handleFeedPet = (petId: string) => {
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
    showToast('🐾 Thú cưng đã ăn no nê, chạy nhảy vui vẻ khắp căn phòng!');
  };

  const handleBrewNewDrinkAtBar = () => {
    const cost = 10;
    if (petalsBalance < cost) {
      showToast(
        `Cần ${cost} ${currencyName} để pha chế một ly thức uống mới tại quầy nhé ☕`
      );
      return;
    }
    onAddPetals(-cost);
    const newDrink = generateUniqueGameItem('drink');
    const nextInv = addItemToInventory(newDrink);
    setInventory(nextInv);
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
  const dailyQuests = [
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
          <div className="px-4 py-2 rounded-full border-2 border-[var(--accent)] bg-[var(--surface)] font-bold text-[var(--text)] shadow-xs">
            {currencyEmoji} Số dư: {petalsBalance} {currencyName}
          </div>
          <div className="sticker-chip font-bold">
            🐟 Hạt cá: {roomState.fishFoodCount}
          </div>
          <div className="sticker-chip font-bold">
            🐾 Thức ăn thú: {roomState.petFoodCount}
          </div>
        </div>
      </div>

      {/* Thanh chuyển đổi 5 khu vực trong Mini Game */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
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
              onClick={() => setActiveZone(tab.id)}
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
        <div className="p-3.5 rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] text-xs font-bold text-[var(--text)] flex items-center justify-between shadow-sm">
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
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Mỗi ngày bạn có 1 lượt mở quà miễn phí (không phạt nếu bỏ lỡ ngày). Quà mở ra ngẫu nhiên 1 trong 4 loại:
                  <strong> 🌱 Hạt giống Hoa</strong> (đưa về Vườn hoa),
                  <strong> 🥚 Trứng Cá</strong> (thả vào Hồ cá),
                  <strong> 🐾 Thú cưng</strong> (khớp vibe tag với {companionChar?.name} ở Phòng tri kỷ), hoặc
                  <strong> ☕ Thức uống</strong> (cất vào Quầy thức uống).
                </p>
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
                {dailyQuests.map((q) => {
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
                      {item.vibeReason || item.description}
                    </p>

                    {(item.category === 'flower' ||
                      item.category === 'drink') && (
                      <button
                        type="button"
                        onClick={() => handleGiftItemToCompanion(item)}
                        className="w-full py-1.5 rounded-full text-[11px] font-bold bg-[var(--accent)]/25 text-[var(--text)] hover:bg-[var(--accent)] hover:text-[#3a2b30] transition-colors cursor-pointer"
                      >
                        💝 Tặng cho {companionChar?.name}
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

                {/* Khung thoại của Char */}
                <blockquote className="p-4 rounded-2xl bg-[var(--surface)] border-l-4 border-[var(--accent)] text-sm italic text-[var(--text)] leading-relaxed">
                  {activeDialogueText}
                </blockquote>

                {/* Tiến độ mở khóa thoại theo Gắn bó */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                  <span>
                    Mốc thoại đã mở:{' '}
                    <strong className="text-[var(--text)]">
                      {roomState.bondPoints >= 70
                        ? 'Mốc 3: Tri kỷ đêm khuya (Tất cả thoại)'
                        : roomState.bondPoints >= 30
                        ? 'Mốc 2: Thân thiết (Đạt 70 điểm mở Mốc 3)'
                        : 'Mốc 1: Làm quen (Đạt 30 điểm mở Mốc 2)'}
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={handleChatWithCompanion}
                    className="px-4 py-2 rounded-full bg-[var(--accent)] text-[#3a2b30] text-xs font-bold bouncy-btn cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Trò chuyện cùng {companionChar?.name} (+4 Gắn bó)</span>
                  </button>
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
                  Thú cưng nhận từ Gacha sẽ tự động ưu tiên loài hợp với <strong>Vibe Tag</strong> của {companionChar?.name} ({companionChar?.tags.join(', ')}). Bạn có thể nuôi không giới hạn số lượng thú cưng!
                </p>

                {/* Sân nhỏ cho thú cưng đi lang thang */}
                <div className="relative h-44 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] overflow-hidden p-3">
                  {ownedPets.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[var(--muted)] text-center px-4">
                      Chưa có bé thú cưng nào trong phòng. Hãy mở Gacha để đón thú cưng hợp vibe với {companionChar?.name} nhé!
                    </div>
                  ) : (
                    ownedPets.map((pet, idx) => {
                      const topPos = 10 + ((idx * 27) % 55);
                      const leftPos =
                        (idx * 23 + Math.floor(nowMs / 1400) * 3) % 78;
                      const isFull = (pet.hungerFullUntil || 0) > nowMs;
                      return (
                        <div
                          key={pet.id}
                          style={{
                            top: `${topPos}%`,
                            left: `${leftPos}%`,
                            transition: 'left 1.4s ease-in-out',
                          }}
                          onClick={() => handleFeedPet(pet.id)}
                          title="Bấm để cho thú cưng ăn"
                          className="absolute flex flex-col items-center cursor-pointer hover:scale-110 transition-transform"
                        >
                          <ProceduralItemSvg item={pet} size={50} />
                          <span className="px-2 py-0.5 rounded-full bg-[var(--surface)]/95 border border-[var(--border)] text-[10px] font-bold text-[var(--text)] whitespace-nowrap">
                            {pet.name} {isFull ? '❤️' : '🥣'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Danh sách thú cưng & giải thích Vibe Tag */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {ownedPets.map((pet) => {
                    const isFull = (pet.hungerFullUntil || 0) > nowMs;
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
                                {RARITY_LABELS[pet.rarity]} ·{' '}
                                {isFull ? 'Đang no & vui vẻ ❤️' : 'Đang đói bụng'}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleFeedPet(pet.id)}
                            className="px-3 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[11px] shrink-0 cursor-pointer"
                          >
                            Cho ăn (-1)
                          </button>
                        </div>

                        {pet.vibeReason && (
                          <p className="text-[11px] text-[var(--muted)] bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)]">
                            ✨ {pet.vibeReason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bảng tra cứu Vibe Tag -> Thú cưng */}
              <div className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--muted)] space-y-1">
                <div className="font-bold text-[var(--text)]">
                  📖 Bảng Vibe Tag & Thú Cưng Đồng Hành:
                </div>
                {TAG_TO_PET_VIBE_MAP.slice(0, 3).map((m, i) => (
                  <div key={i}>
                    • Tag <strong>{m.tagKeywords.slice(0, 2).join(', ')}</strong> →{' '}
                    {m.speciesList.slice(0, 2).join(', ')}
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
    </div>
  );
};
