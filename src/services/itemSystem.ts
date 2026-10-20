/**
 * Hệ thống Vật phẩm Sinh tự động (Procedural Item Generator), Kho đồ, Gacha,
 * Vườn hoa, Hồ cá, Phòng tri kỷ & Mở khóa Char bằng vật phẩm cho "Góc Nhỏ Lấp Lánh".
 *
 * Tất cả dữ liệu được lưu qua `dataStore` (localStorage bọc try/catch), tách biệt ở data layer.
 * Đảm bảo MỖI VẬT PHẨM sinh ra có TÊN RIÊNG TUYỆT ĐỐI KHÔNG TRÙNG.
 */

import { dataStore } from './dataLayer';
import {
  PetBehaviorStyle,
  PersistedPetTrait,
  selectPetTraitForCompanionTags,
  persistTraitForPet,
  getPersistedTraitForPet,
  sanitizePetVibeNote,
} from './tagCompanionSystem';
import { getSiteConfig } from './siteSettings';

export type ItemCategory = 'flower' | 'fish' | 'pet' | 'drink';
export type ItemRarity = 'common' | 'rare' | 'legendary';

export interface ItemVisualSeed {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  shapeVariant: number; // 0..5
  patternVariant: number; // 0..4
  petalOrFinCount: number; // 5..10
  hasSparkle: boolean;
}

export interface GeneratedGameItem {
  id: string;
  name: string; // Tên riêng duy nhất không trùng
  category: ItemCategory;
  rarity: ItemRarity;
  visual: ItemVisualSeed;
  createdAt: string;
  description: string;
  // Thuộc tính riêng cho Thú cưng (khớp vibe tag của char, lưu cố định theo từng thú)
  petSpecies?: string;
  matchedTag?: string;
  vibeReason?: string;
  petPersonality?: string;
  petBehaviorStyle?: PetBehaviorStyle;
  petSound?: string;
  hungerFullUntil?: number; // timestamp ms khi thú cưng đang no
  // Thuộc tính riêng cho Hoa / Thức uống
  sweetnessNote?: string;
  readyAt?: string | null;
}

export type GardenStage = 0 | 1 | 2 | 3 | 4; // 0: Hạt, 1: Nảy mầm, 2: Cây con, 3: Nụ, 4: Nở

export interface GardenPlotState {
  id: string;
  seedItem: GeneratedGameItem | null; // Hạt giống mang tên loài hoa riêng
  stage: GardenStage;
  stageStartedAt: number; // timestamp ms
  stageDurationMs: number; // Thời gian chờ thật của mỗi giai đoạn (1-3 phút)
  wateredInCurrentStage: boolean;
}

export type FishGrowthStage = 'egg' | 'baby' | 'juvenile' | 'adult';

export interface PondFishState {
  id: string;
  item: GeneratedGameItem; // Cá mang tên riêng
  stage: FishGrowthStage;
  xp: number; // Tăng khi cho ăn & theo thời gian
  hatchedAt: number;
  fullUntil: number; // timestamp ms khi cá đang no
  lastPetalGeneratedAt: number; // timestamp ms lần cuối tiết ra Cánh hoa
  pendingPetals: number; // Cánh hoa cá tiết ra chờ thu hoạch
  swimSpeed: number; // 14..28s
  swimOffset: number; // 0..100
}

export interface CompanionRoomState {
  companionCharId: string;
  bondPoints: number;
  happiness: number; // 0..100
  fishFoodCount: number; // Hạt cá
  petFoodCount: number; // Thức ăn thú cưng
  lastFreeGachaDate: string; // YYYY-MM-DD
  completedDailyTasks: Record<string, string>; // taskKey -> YYYY-MM-DD
}

export interface CharacterUnlockRequirement {
  id: string;
  category: ItemCategory;
  count: number;
  specificItemName?: string; // Nếu để trống: chấp nhận mọi vật phẩm cùng loại; nếu có: đòi đúng tên vật phẩm
}

// ============================================================================
// BỘ TỪ VỰNG PHONG PHÚ (>= 32 từ mỗi bộ cho từng loại: Hoa, Cá, Thú cưng, Thức uống)
// ============================================================================

const FLOWER_PREFIXES: string[] = [
  'Hoa Trà', 'Hoa Linh Lan', 'Hoa Cúc Nhỏ', 'Hoa Hồng Phấn', 'Hoa Anh Đào',
  'Hoa Tử Đinh Hương', 'Hoa Chuông Nhỏ', 'Hoa Oải Hương', 'Hoa Nhài Trắng', 'Hoa Tường Vi',
  'Hoa Lưu Ly', 'Hoa Bồ Công Anh', 'Hoa Mẫu Đơn', 'Hoa Cẩm Tú Cầu', 'Hoa Hải Đường',
  'Hoa Mộc Lan', 'Hoa Sen Tuyết', 'Hoa Phong Lan', 'Hoa Bạch Trà', 'Hoa Dạ Hương',
  'Hoa Thược Dược', 'Hoa Đỗ Quyên', 'Hoa Mai Trắng', 'Hoa Cát Cánh', 'Hoa Thủy Tiên',
  'Hoa Diên Vĩ', 'Hoa Hướng Dương Nhỏ', 'Hoa Đậu Biếc', 'Hoa Mơ Rừng', 'Hoa Sao Đêm',
  'Hoa Tuyết Điểm', 'Hoa Thanh Anh', 'Hoa Bìm Bìm', 'Hoa Violet',
];

const FLOWER_ADJECTIVES: string[] = [
  'Sương Mai', 'Ánh Trăng', 'Mây Hồng', 'Nắng Ấm', 'Mơ Màng',
  'Ngọt Ngào', 'Tinh Khôi', 'Lấp Lánh', 'Dịu Êm', 'Tím Biếc',
  'Kem Bơ', 'Mật Ong', 'Gió Thu', ' Sao Băng', 'Bình Minh',
  'Chiều Tà', 'Khói Sương', 'Nhung Tuyết', 'Pha Lê', 'Hổ Phách',
  'Bạc Hà', 'Ngọc Trai', 'Thơ Ngây', 'Trong Veo', 'Mùa Xuân',
  'Đêm Hè', 'Ngân Hà', 'Rêu Xanh', 'Hồng Đào', ' Hạt Sương',
  'Nắng Mới', 'êm Đềm', 'Mộng Mơ', 'Thanh Khiết',
];

const FLOWER_SUFFIXES: string[] = [
  'Ngọt', 'Mơ', 'Dịu', 'Thơ', 'Xinh',
  'Ấm', 'Trong', 'Nhỏ', 'Hiền', 'Thơm',
  'Mềm', 'Sáng', 'Đêm', 'Sớm', 'Chiều',
  'Xuân', 'Thu', 'Đông', 'Hạ', 'Ngân',
  'Bạc', 'Vàng', 'Hồng', 'Biếc', 'Tím',
  'Kem', 'Sương', 'Mây', 'Nắng', 'Trăng',
  'Sao', 'Gió',
];

const FISH_PREFIXES: string[] = [
  'Cá Đuôi Mây', 'Cá Vảy Ngọc', 'Cá Vàng Nhỏ', 'Cá Chép Nhung', 'Cá Koi Mini',
  'Cá Betta Lụa', 'Cá Bảy Màu', 'Cá Thiên Thần', 'Cá Neon Nhỏ', 'Cá Đèn Lồng',
  'Cá Cánh Buồm', 'Cá Thủy Tinh', 'Cá Mắt Ngọc', 'Cá Vây Tơ', 'Cá Trân Châu',
  'Cá Ánh Sao', 'Cá Bống Hoa', 'Cá Hồ Điệp', 'Cá Phượng Hoàng', 'Cá Tuyết Nhỏ',
  'Cá Mây Trắng', 'Cá Sương Sớm', 'Cá Hổ Phách', 'Cá Pha Lê', 'Cá Hồng Đào',
  'Cá Bạc Hà', 'Cá Oải Hương', 'Cá Nắng Mai', 'Cá Trăng Non', 'Cá Ngân Hà',
  'Cá Đuôi Quạt', 'Cá Đuôi Tiên',
];

const FISH_ADJECTIVES: string[] = [
  'Bạc', 'Vàng', 'Hồng Phấn', 'Xanh Sương', 'Tím Khói',
  'Ánh Trăng', 'Lấp Lánh', 'Mơ Màng', 'Trong Suốt', 'Ngọc Bích',
  'Kem Sữa', 'Sao Đêm', 'Nắng Sớm', 'Mây Trôi', 'Dịu Dàng',
  'Nhung Mềm', 'Pha Lê', 'San Hô', 'Sương Mai', 'Bình Yên',
  'Thơ Thẩn', 'Rực Rỡ', 'Êm Đềm', 'Ngọt Ngào', 'Lung Linh',
  'Tinh Nghịch', 'Hiền Hòa', 'Mộng Mơ', 'Thanh Khiết', 'Hổ Phách',
  'Bích Ngọc', 'Ánh Kim',
];

const FISH_SUFFIXES: string[] = [
  'Nhỏ', 'Xinh', 'Mơ', 'Hiền', 'Đêm',
  'Sớm', 'Trong', 'Mềm', 'Sáng', 'Ngoan',
  'Vui', 'Êm', 'Thơ', 'Bạc', 'Hồng',
  'Biếc', 'Tím', 'Kem', 'Sương', 'Mây',
  'Nắng', 'Trăng', 'Sao', 'Sóng', 'Suối',
  'Hồ', 'Mùa Thu', 'Mùa Xuân', 'Tinh Khôi', 'Lấp Lánh',
  'Ngọt', 'Ấm',
];

const PET_ADJECTIVES: string[] = [
  'Bông Xù', 'Kem Bơ', 'Sương Mai', 'Ánh Trăng', 'Mây Hồng',
  'Má Hồng', 'Tai Cụp', 'Mắt Ngọc', 'Đuôi Xù', 'Chân Ngắn',
  'Ngái Ngủ', 'Tinh Nghịch', 'Dịu Dàng', 'Quấn Quýt', 'Lém Lỉnh',
  'Tròn Xoe', 'Mềm Mại', 'Ngọt Ngào', 'Nhút Nhát', 'Thông Thái',
  'Lấp Lánh', 'Bình Yên', 'Mơ Màng', 'Ấm Áp', 'Hạt Dẻ',
  'Mật Ong', 'Bạc Hà', 'Oải Hương', 'Hồng Đào', 'Tuyết Trắng',
  'Nắng Ấm', 'Sao Đêm',
];

const PET_SUFFIXES: string[] = [
  'Mơ', 'Ngoan', 'Xinh', 'Nhỏ', 'Hiền',
  'Bông', 'Kem', 'Mềm', 'Ấm', 'Vui',
  'Ngọt', 'Thơ', 'Sương', 'Mây', 'Nắng',
  'Trăng', 'Sao', 'Tuyết', 'Gió', 'Hồng',
  'Bạc', 'Vàng', 'Tím', 'Biếc', 'Đêm',
  'Sớm', 'Chiều', 'Xuân', 'Thu', 'Đông',
  'Hạ', 'Cưng',
];

const DRINK_BASES: string[] = [
  'Americano', 'Matcha Latte', 'Trà Sữa Hoa Nhài', 'Cacao Nóng', 'Trà Đào Cam Sả',
  'Sữa Tươi Trân Châu', 'Trà Hoa Cúc', 'Cà Phê Sữa Hạnh Nhân', 'Latte Vani', 'Trà Ô Long Kem Phô Mai',
  'Soda Việt Quất', 'Trà Đậu Biếc Macchiato', 'Sữa Gạo Rang', 'Trà Bá Tước Sữa', 'Mocha Hạt Dẻ',
  'Trà Sen Vàng', 'Nước Ép Táo Quế', 'Sữa Dâu Tây', 'Trà Hoa Hồng Lạnh', 'Cappuccino Kem Bơ',
  'Trà Bạc Hà Mật Ong', 'Sữa Khoai Môn', 'Trà Lựu Đỏ', 'Cold Brew Cam Vàng', 'Trà Gừng Táo Đỏ',
  'Matcha Đậu Đỏ', 'Sữa Yến Mạch Quế', 'Trà Hoa Anh Đào', 'Sô-cô-la Trắng Nóng', 'Trà Vải Hoa Hồng',
  'Latte Oải Hương', 'Trà Xanh Sương Sớm',
];

const DRINK_TOPPINGS: string[] = [
  'Mật Ong', 'Mây Hồng', 'Kem Bơ', 'Sương Mai', 'Hạt Dẻ',
  'Thạch Đào', 'Kem Tuyết', 'Đường Nâu', 'Quế Thơm', 'Hoa Nhài',
  'Vani Ngọt', 'Trân Châu Trắng', 'Bọt Sữa Mềm', 'Ánh Trăng', 'Caramel Muối',
  'Hạnh Nhân Nướng', 'Dâu Rừng', 'Cốm Non', 'Phô Mai Tươi', 'Sương Sáo',
  'Bạc Hà Dịu', 'Oải Hương', 'Hoa Cúc Nhỏ', 'Táo Đỏ', 'Gừng Ấm',
  'Mè Đen', 'Kem Dừa', 'Mứt Cam', 'Hồng Đào', 'Lấp Lánh',
  'Ngọt Dịu', 'Ít Đá',
];

const DRINK_SUFFIXES: string[] = [
  'Ấm Áp', 'Dịu Ngọt', 'Mơ Màng', 'Đêm Khuya', 'Buổi Sớm',
  'Chiều Thu', 'Nắng Ấm', 'Mây Trôi', 'Thư Giãn', 'Ngọt Lành',
  'Thanh Mát', 'Thơm Lừng', 'Êm Đềm', 'Nhỏ Xinh', 'Hương Xuân',
  'Tĩnh Lặng', 'Bình Yên', 'Mềm Mại', 'Trong Veo', 'Tinh Khôi',
  'Mộng Mơ', 'Dịu Êm', 'Ngân Hà', 'Sao Đêm', 'Sương Khói',
  'Mùa Đông', 'Mùa Hạ', 'Hạnh Phúc', 'Thơ Ngây', 'Lấp Lánh',
  'Cổ Điển', 'Đặc Biệt',
];

// ============================================================================
// BẢNG MAP GIỮA VIBE TAG CỦA CHAR VÀ LOÀI THÚ CƯNG / TÍNH CÁCH
// ============================================================================

export interface PetVibeMapping {
  tagKeywords: string[];
  speciesList: string[];
  personality: string;
}

export const TAG_TO_PET_VIBE_MAP: PetVibeMapping[] = [
  {
    tagKeywords: ['Dịu dàng', 'Chữa lành', 'Đời thường', 'Bình yên', 'Ấm áp'],
    speciesList: ['Mèo Bông', 'Thỏ Tai Cụp', 'Cún Kem Sữa', 'Cừu Bông Nhỏ'],
    personality: 'hiền lành, thích cuộn tròn bên cạnh lắng nghe và sưởi ấm tâm hồn',
  },
  {
    tagKeywords: ['Lạnh lùng', 'Bí ẩn', 'Trầm lặng', 'U buồn', 'Nội tâm'],
    speciesList: ['Cú Tuyết', 'Cáo Tuyết', 'Mèo Đen Mắt Ngọc', 'Sói Nhỏ Sương Đêm'],
    personality: 'điềm tĩnh, đôi mắt trong veo tinh anh, luôn âm thầm bầu bạn trong đêm tĩnh mịch',
  },
  {
    tagKeywords: ['Hài hước', 'Năng động', 'Hiện đại', 'Tinh nghịch', 'Vui vẻ'],
    speciesList: ['Chồn Sương', 'Vẹt Má Hồng', 'Rái Cá Nhỏ', 'Chuột Hamster Phúng Phính'],
    personality: 'lém lỉnh, hay làm trò đáng yêu khiến căn phòng luôn tràn ngập tiếng cười',
  },
  {
    tagKeywords: ['Cổ trang', 'Kỳ ảo', 'Học giả', 'Tiên hiệp', 'Tri thức'],
    speciesList: ['Hươu Sao Nhỏ', 'Hồ Ly Chín Đuôi Mini', 'Hạc Giấy Nhỏ', 'Rồng Bông Pastel'],
    personality: 'thanh tao, mang hơi thở cổ tích và rất thích nằm cạnh kệ sách cổ',
  },
  {
    tagKeywords: ['Lãng mạn', 'Ngọt ngào', 'Tình cảm', 'Thơ mộng'],
    speciesList: ['Sóc Bay Hạt Dẻ', 'Chim Sẻ Mây Hồng', 'Thiên Nga Nhỏ', 'Nhím Bông Hoa Hồng'],
    personality: 'ngọt ngào, quấn quýt và hay mang những cánh hoa nhỏ về tặng chủ nhân',
  },
];

const DEFAULT_PET_SPECIES = [
  'Mèo Bông', 'Thỏ Tai Cụp', 'Cáo Tuyết', 'Cú Tuyết', 'Chồn Sương', 'Sóc Bay Hạt Dẻ',
];

// ============================================================================
// STORAGE KEYS
// ============================================================================

const USED_NAMES_KEY = 'item_sys_used_names_v1';
const INVENTORY_COLLECTION = 'item_sys_inventory_v1';
const GARDEN_PLOTS_KEY = 'item_sys_garden_plots_v1';
const POND_FISH_KEY = 'item_sys_pond_fish_v1';
const COMPANION_ROOM_KEY = 'item_sys_companion_room_v1';

// ============================================================================
// HÀM BĂM SEED & SINH MÀU / HÌNH SVG THEO TÊN
// ============================================================================

export function hashStringToSeed(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

const PASTEL_PALETTES: Array<[string, string, string]> = [
  ['#f4a3b0', '#fde2e6', '#d97b8c'], // Hồng đào
  ['#8fcfbf', '#dcf5ee', '#5fa896'], // Bạc hà
  ['#b8a6e0', '#ebe4fa', '#8e78bf'], // Oải hương
  ['#f2cf7a', '#fcf0cf', '#d4aa4a'], // Vàng bơ
  ['#9cc7ee', '#e1f0fc', '#6a9fd1'], // Xanh trời
  ['#f7b299', '#fce6de', '#d98668'], // Cam san hô
  ['#e8a5d3', '#faeaf5', '#bf73a7'], // Hồng tím phấn
  ['#a8d8a0', '#e6f7e3', '#75ad6c'], // Xanh lá non
  ['#f5c18c', '#fceddc', '#cc9258'], // Hổ phách dịu
  ['#9ad4d6', '#e1f6f7', '#63a6a8'], // Xanh ngọc lam
];

export function generateVisualFromSeedName(
  name: string,
  rarity: ItemRarity
): ItemVisualSeed {
  const seed = hashStringToSeed(name);
  const palette = PASTEL_PALETTES[seed % PASTEL_PALETTES.length];
  return {
    primaryColor: palette[0],
    secondaryColor: palette[1],
    accentColor: palette[2],
    shapeVariant: (seed >> 3) % 6,
    patternVariant: (seed >> 7) % 5,
    petalOrFinCount: 5 + ((seed >> 11) % 6),
    hasSparkle: rarity !== 'common',
  };
}

// ============================================================================
// SINH TÊN VẬT PHẨM ĐỘC NHẤT (TUYỆT ĐỐI KHÔNG TRÙNG)
// ============================================================================

function getUsedNamesSet(): Set<string> {
  const list = dataStore.get<string[]>(USED_NAMES_KEY, []);
  return new Set(list.map((n) => n.toLowerCase()));
}

function registerUsedName(name: string): void {
  const list = dataStore.get<string[]>(USED_NAMES_KEY, []);
  if (!list.some((n) => n.toLowerCase() === name.toLowerCase())) {
    list.push(name);
    dataStore.set(USED_NAMES_KEY, list, true);
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollRarity(): ItemRarity {
  const r = Math.random();
  if (r < 0.14) return 'legendary';
  if (r < 0.45) return 'rare';
  return 'common';
}

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'Thường',
  rare: 'Quý',
  legendary: 'Hiếm ✨',
};

export const CATEGORY_LABELS: Record<ItemCategory, { name: string; emoji: string }> = {
  flower: { name: 'Hoa', emoji: '🌸' },
  fish: { name: 'Cá', emoji: '🐟' },
  pet: { name: 'Thú cưng', emoji: '🐾' },
  drink: { name: 'Thức uống', emoji: '☕' },
};

/**
 * Tìm loài thú cưng, tính cách, hành vi và ghi chú vibe khớp với Tag của nhân vật đang đồng hành.
 * TUYỆT ĐỐI KHÔNG nhắc tên nhân vật trong ghi chú dưới thú cưng.
 */
export function resolvePetVibeForCharacter(
  _charName: string,
  charTags: string[]
): PersistedPetTrait {
  const customPets = getSiteConfig().tagPets;
  return selectPetTraitForCompanionTags(charTags, customPets);
}

/**
 * Sinh một vật phẩm mới hoàn toàn với tên riêng tuyệt đối không trùng
 */
export function generateUniqueGameItem(
  category: ItemCategory,
  options?: {
    companionCharName?: string;
    companionCharTags?: string[];
    forceRarity?: ItemRarity;
  }
): GeneratedGameItem {
  const used = getUsedNamesSet();
  const rarity = options?.forceRarity || rollRarity();

  let petInfo: PersistedPetTrait | null = null;
  if (category === 'pet') {
    petInfo = resolvePetVibeForCharacter(
      options?.companionCharName || '',
      options?.companionCharTags || ['Dịu dàng']
    );
  }

  let candidateName = '';
  let attempts = 0;

  while (attempts < 150) {
    attempts++;
    if (category === 'flower') {
      candidateName = `${pickRandom(FLOWER_PREFIXES)} ${pickRandom(
        FLOWER_ADJECTIVES
      )} ${pickRandom(FLOWER_SUFFIXES)}`;
    } else if (category === 'fish') {
      candidateName = `${pickRandom(FISH_PREFIXES)} ${pickRandom(
        FISH_ADJECTIVES
      )} ${pickRandom(FISH_SUFFIXES)}`;
    } else if (category === 'pet') {
      const sp = petInfo?.petSpecies || pickRandom(DEFAULT_PET_SPECIES);
      candidateName = `${sp} ${pickRandom(PET_ADJECTIVES)} ${pickRandom(
        PET_SUFFIXES
      )}`;
    } else {
      candidateName = `${pickRandom(DRINK_BASES)} ${pickRandom(
        DRINK_TOPPINGS
      )} ${pickRandom(DRINK_SUFFIXES)}`;
    }

    candidateName = candidateName.replace(/\s+/g, ' ').trim();
    if (!used.has(candidateName.toLowerCase())) {
      break;
    }
  }

  // Nếu hy hữu sau 150 lần vẫn trùng thì thêm hậu tố số hiệu duy nhất
  if (used.has(candidateName.toLowerCase())) {
    let serial = used.size + 1;
    while (used.has(`${candidateName} #${serial}`.toLowerCase())) {
      serial++;
    }
    candidateName = `${candidateName} #${serial}`;
  }

  registerUsedName(candidateName);

  const visual = generateVisualFromSeedName(candidateName, rarity);

  let description = '';
  if (category === 'flower') {
    description = `Đóa hoa mang sắc ${visual.primaryColor} dịu ngọt, tỏa hương thơm thanh khiết trong khu vườn nhỏ.`;
  } else if (category === 'fish') {
    description = `Chú cá nhỏ bơi lượn êm đềm với chiếc vây óng ánh sắc ${visual.primaryColor}.`;
  } else if (category === 'pet') {
    description =
      petInfo?.vibeReason ||
      'Bé thú cưng có tính cách điềm đạm, đáng yêu, hợp với không khí ấm áp nơi đây.';
  } else {
    description = `Ly thức uống pha chế thủ công thơm dịu, rất hợp để nhâm nhi hoặc gửi tặng người thương.`;
  }

  const itemId = `gitem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (category === 'pet' && petInfo) {
    persistTraitForPet(itemId, candidateName, petInfo);
  }

  return {
    id: itemId,
    name: candidateName,
    category,
    rarity,
    visual,
    createdAt: new Date().toISOString(),
    description,
    petSpecies: petInfo?.petSpecies,
    matchedTag: petInfo?.matchedTag,
    vibeReason: petInfo?.vibeReason,
    petPersonality: petInfo?.personality,
    petBehaviorStyle: petInfo?.behaviorStyle,
    petSound: petInfo?.sound,
    hungerFullUntil: category === 'pet' ? Date.now() + 1000 * 60 * 10 : undefined,
  };
}

// ============================================================================
// QUẢN LÝ KHO ĐỒ (INVENTORY), VƯỜN HOA, HỒ CÁ, PHÒNG TRI KỶ
// ============================================================================

export function getInventoryItems(): GeneratedGameItem[] {
  const existing = dataStore.get<GeneratedGameItem[] | null>(
    INVENTORY_COLLECTION,
    null
  );
  if (existing && Array.isArray(existing)) {
    const customPets = getSiteConfig().tagPets;
    return existing.map((item) => {
      if (item.category !== 'pet') return item;
      const savedTrait = getPersistedTraitForPet(item.id, item.name, customPets);
      const cleanNote = sanitizePetVibeNote(
        savedTrait?.vibeReason || item.vibeReason || item.description,
        savedTrait?.matchedTag || item.matchedTag,
        savedTrait?.petSpecies || item.petSpecies
      );
      return {
        ...item,
        petSpecies: savedTrait?.petSpecies || item.petSpecies || 'Mèo Bông',
        matchedTag: savedTrait?.matchedTag || item.matchedTag || 'Dịu dàng',
        vibeReason: cleanNote,
        description: cleanNote,
        petPersonality:
          savedTrait?.personality ||
          item.petPersonality ||
          'hiền lành, điềm đạm, thích cuộn tròn bên cạnh lắng nghe',
        petBehaviorStyle:
          savedTrait?.behaviorStyle || item.petBehaviorStyle || 'gentle_sway',
        petSound: savedTrait?.sound || item.petSound || 'Meo~ 🌸',
      };
    });
  }

  // Khởi tạo vài vật phẩm mẫu đầu tiên (đăng ký tên vào danh sách đã dùng)
  const initialItems: GeneratedGameItem[] = [
    generateUniqueGameItem('flower', { forceRarity: 'common' }),
    generateUniqueGameItem('flower', { forceRarity: 'rare' }),
    generateUniqueGameItem('drink', { forceRarity: 'common' }),
    generateUniqueGameItem('drink', { forceRarity: 'rare' }),
    generateUniqueGameItem('pet', {
      companionCharTags: ['Cổ trang', 'Chữa lành', 'Trầm lặng'],
      forceRarity: 'rare',
    }),
  ];

  dataStore.set(INVENTORY_COLLECTION, initialItems, true);
  return initialItems;
}

export function saveInventoryItems(items: GeneratedGameItem[]): void {
  dataStore.set(INVENTORY_COLLECTION, items);
}

export function addItemToInventory(item: GeneratedGameItem): GeneratedGameItem[] {
  const current = getInventoryItems();
  const next = [item, ...current];
  saveInventoryItems(next);
  return next;
}

export function removeItemFromInventory(itemId: string): GeneratedGameItem[] {
  const current = getInventoryItems();
  const next = current.filter((i) => i.id !== itemId);
  saveInventoryItems(next);
  return next;
}

// Thời gian chờ thật cho từng giai đoạn hoa (từ 60 giây đến 120 giây mỗi giai đoạn)
export const STAGE_DURATIONS_MS: Record<GardenStage, number> = {
  0: 60 * 1000, // Hạt -> Nảy mầm: 1 phút
  1: 75 * 1000, // Nảy mầm -> Cây con: 1 phút 15 giây
  2: 90 * 1000, // Cây con -> Nụ: 1 phút 30 giây
  3: 105 * 1000, // Nụ -> Nở: 1 phút 45 giây
  4: 0, // Đã nở
};

export const GARDEN_STAGE_NAMES: Record<GardenStage, string> = {
  0: 'Hạt giống',
  1: 'Nảy mầm',
  2: 'Cây con',
  3: 'Kết nụ',
  4: 'Nở rộ ✨',
};

export function getGardenPlots(): GardenPlotState[] {
  const saved = dataStore.get<GardenPlotState[] | null>(GARDEN_PLOTS_KEY, null);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    return saved;
  }

  const now = Date.now();
  const f1 = generateUniqueGameItem('flower', { forceRarity: 'rare' });
  const f2 = generateUniqueGameItem('flower', { forceRarity: 'common' });
  const f3 = generateUniqueGameItem('flower', { forceRarity: 'legendary' });

  const initialPlots: GardenPlotState[] = [
    {
      id: 'plot_1',
      seedItem: f1,
      stage: 4, // Đã nở sẵn 1 bông để người chơi thử thu hoạch
      stageStartedAt: now - 120000,
      stageDurationMs: 0,
      wateredInCurrentStage: true,
    },
    {
      id: 'plot_2',
      seedItem: f2,
      stage: 2, // Cây con đang lớn
      stageStartedAt: now - 40000,
      stageDurationMs: STAGE_DURATIONS_MS[2],
      wateredInCurrentStage: false,
    },
    {
      id: 'plot_3',
      seedItem: f3,
      stage: 0, // Hạt giống mới gieo
      stageStartedAt: now - 15000,
      stageDurationMs: STAGE_DURATIONS_MS[0],
      wateredInCurrentStage: false,
    },
    {
      id: 'plot_4',
      seedItem: null,
      stage: 0,
      stageStartedAt: now,
      stageDurationMs: STAGE_DURATIONS_MS[0],
      wateredInCurrentStage: false,
    },
  ];

  dataStore.set(GARDEN_PLOTS_KEY, initialPlots, true);
  return initialPlots;
}

export function saveGardenPlots(plots: GardenPlotState[]): void {
  dataStore.set(GARDEN_PLOTS_KEY, plots);
}

export function getPondFishList(): PondFishState[] {
  const saved = dataStore.get<PondFishState[] | null>(POND_FISH_KEY, null);
  if (saved && Array.isArray(saved)) {
    return saved;
  }

  const now = Date.now();
  const fish1 = generateUniqueGameItem('fish', { forceRarity: 'rare' });
  const fish2 = generateUniqueGameItem('fish', { forceRarity: 'common' });

  const initialFish: PondFishState[] = [
    {
      id: fish1.id,
      item: fish1,
      stage: 'adult',
      xp: 100,
      hatchedAt: now - 3600 * 1000,
      fullUntil: now + 180 * 1000,
      lastPetalGeneratedAt: now - 60 * 1000,
      pendingPetals: 3,
      swimSpeed: 18,
      swimOffset: 15,
    },
    {
      id: fish2.id,
      item: fish2,
      stage: 'baby',
      xp: 25,
      hatchedAt: now - 600 * 1000,
      fullUntil: 0,
      lastPetalGeneratedAt: now,
      pendingPetals: 0,
      swimSpeed: 22,
      swimOffset: 62,
    },
  ];

  dataStore.set(POND_FISH_KEY, initialFish, true);
  return initialFish;
}

export function savePondFishList(list: PondFishState[]): void {
  dataStore.set(POND_FISH_KEY, list);
}

export function getCompanionRoomState(defaultCharId = 'char-1'): CompanionRoomState {
  const saved = dataStore.get<CompanionRoomState | null>(COMPANION_ROOM_KEY, null);
  if (saved && typeof saved === 'object') {
    return {
      companionCharId: saved.companionCharId || defaultCharId,
      bondPoints: typeof saved.bondPoints === 'number' ? saved.bondPoints : 35,
      happiness: typeof saved.happiness === 'number' ? saved.happiness : 85,
      fishFoodCount: typeof saved.fishFoodCount === 'number' ? saved.fishFoodCount : 4,
      petFoodCount: typeof saved.petFoodCount === 'number' ? saved.petFoodCount : 3,
      lastFreeGachaDate: saved.lastFreeGachaDate || '',
      completedDailyTasks: saved.completedDailyTasks || {},
    };
  }

  const initial: CompanionRoomState = {
    companionCharId: defaultCharId,
    bondPoints: 35,
    happiness: 85,
    fishFoodCount: 4,
    petFoodCount: 3,
    lastFreeGachaDate: '',
    completedDailyTasks: {},
  };
  dataStore.set(COMPANION_ROOM_KEY, initial, true);
  return initial;
}

export function saveCompanionRoomState(state: CompanionRoomState): void {
  dataStore.set(COMPANION_ROOM_KEY, state);
}

/**
 * Tổng hợp tất cả vật phẩm mà người chơi hiện đang sở hữu (trong Kho đồ + Cá đang bơi trong Hồ cá)
 * để kiểm tra điều kiện mở khóa Char.
 */
export function getAllOwnedItemsForUnlock(): GeneratedGameItem[] {
  const inv = getInventoryItems();
  const pondFish = getPondFishList().map((f) => f.item);
  return [...inv, ...pondFish];
}

export interface RequirementCheckResult {
  req: CharacterUnlockRequirement;
  ownedCount: number;
  isMet: boolean;
  matchingItemIds: string[];
  hintText: string;
}

export function checkUnlockRequirements(
  requirements: CharacterUnlockRequirement[]
): {
  allMet: boolean;
  details: RequirementCheckResult[];
} {
  const allOwned = getAllOwnedItemsForUnlock();
  const usedIds = new Set<string>();

  const details: RequirementCheckResult[] = requirements.map((req) => {
    const specific = req.specificItemName?.trim().toLowerCase();
    const candidates = allOwned.filter((item) => {
      if (usedIds.has(item.id)) return false;
      if (item.category !== req.category) return false;
      if (specific && item.name.toLowerCase() !== specific) return false;
      return true;
    });

    const selected = candidates.slice(0, req.count);
    selected.forEach((s) => usedIds.add(s.id));

    const isMet = selected.length >= req.count;
    let hintText = '';
    if (!isMet) {
      if (req.category === 'flower') {
        hintText =
          'Gợi ý: Hãy ghé Vườn hoa (tab Mini game) để gieo hạt, tưới nước và thu hoạch hoa nở nhé 🌱';
      } else if (req.category === 'fish') {
        hintText =
          'Gợi ý: Hãy ghé Gacha mỗi ngày hoặc Hồ cá (tab Mini game) để ấp trứng và chăm cá nhé 🐟';
      } else if (req.category === 'drink') {
        hintText =
          'Gợi ý: Hãy ghé Quầy thức uống hoặc Gacha mỗi ngày (tab Mini game) để pha chế ly nước mới nhé ☕';
      } else {
        hintText =
          'Gợi ý: Hãy mở Gacha mỗi ngày (tab Mini game) để đón thêm thú cưng về Phòng tri kỷ nhé 🐾';
      }
    }

    return {
      req,
      ownedCount: candidates.length,
      isMet,
      matchingItemIds: selected.map((s) => s.id),
      hintText,
    };
  });

  return {
    allMet: details.every((d) => d.isMet),
    details,
  };
}

/**
 * Trừ các vật phẩm khỏi Kho đồ / Hồ cá khi người dùng bấm "Mở khóa" nhân vật
 */
export function consumeItemsForUnlock(
  requirements: CharacterUnlockRequirement[]
): boolean {
  const check = checkUnlockRequirements(requirements);
  if (!check.allMet) return false;

  const idsToRemove = new Set<string>();
  check.details.forEach((d) => {
    d.matchingItemIds.forEach((id) => idsToRemove.add(id));
  });

  // Trừ trong Inventory
  const inv = getInventoryItems();
  const nextInv = inv.filter((item) => !idsToRemove.has(item.id));
  saveInventoryItems(nextInv);

  // Trừ trong Hồ cá (nếu điều kiện yêu cầu Cá)
  const pond = getPondFishList();
  const nextPond = pond.filter((f) => !idsToRemove.has(f.item.id));
  if (nextPond.length !== pond.length) {
    savePondFishList(nextPond);
  }

  return true;
}
