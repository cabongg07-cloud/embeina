import { BaseEntity, dataStore } from '../services/dataLayer';
import { CharacterUnlockRequirement } from '../services/itemSystem';

export type UserRole = 'guest' | 'user' | 'creator';

export interface SocialLink {
  label: string;
  url: string;
}

export interface Creator extends BaseEntity {
  id: string;
  name: string;
  handle: string;
  avatarSymbol: string;
  avatarTint: string;
  imageUrl?: string;
  bio: string;
  longBio: string;
  tags: string[];
  socials: SocialLink[];
}

export interface CharacterItem extends BaseEntity {
  id: string;
  name: string;
  epithet: string;
  creatorId: string;
  creatorName?: string; // Tên creator hiển thị trực tiếp
  tags: string[];
  description: string;
  openingLine: string; // Lời mở đầu / Open scene
  openScene?: string; // Bối cảnh mở đầu chi tiết (hiển thị khi mở khóa)
  creatorNote?: string; // Ghi chú của Creator dành cho nhân vật
  chatUrl: string;
  avatarSymbol: string;
  avatarTint: string;
  imageUrl?: string;
  isLocked?: boolean; // Trạng thái: false = mở tự do, true = khóa bằng vật phẩm
  unlockRequirements?: CharacterUnlockRequirement[]; // Yêu cầu vật phẩm để mở khóa
  petalPrice?: number; // Tương thích ngược
  stats?: {
    favorites: number;
    hearts: number;
    chatOpens: number;
    weeklyScore: number;
    monthlyScore: number;
  };
}

export type FeedbackTargetType = 'web' | 'creator' | 'character';

export interface FeedbackReply {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface FeedbackItem extends BaseEntity {
  id: string;
  targetType: FeedbackTargetType;
  targetId: string; // 'web' | creatorId | charId
  targetName: string;
  creatorId?: string; // Để lọc nhanh cho Creator sở hữu char hoặc chính họ
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  rating: number; // 1..5 sao
  content: string;
  hearts: number;
  isRead: boolean;
  replies: FeedbackReply[];
  createdAt?: string;
}

export interface CommissionTier {
  name: string;
  price: string;
  detail: string;
}

export interface CreatorCommissionInfo extends BaseEntity {
  id: string;
  creatorId: string;
  isOpen: boolean;
  waitTime: string;
  slotsLeft: number;
  tiers: CommissionTier[];
  note: string;
  imageUrl?: string;
}

export type CommissionOrderStatus = 'pending' | 'in_progress' | 'completed';

export interface CommissionOrder extends BaseEntity {
  id: string;
  creatorId: string;
  requesterName: string;
  characterConcept: string;
  budget: string;
  contact: string;
  status: CommissionOrderStatus;
  createdAt: string;
}

export interface SharedPrompt extends BaseEntity {
  id: string;
  title: string;
  creatorId: string;
  characterId?: string;
  tags: string[];
  content: string;
  usageNote: string;
  imageUrl?: string;
  createdAt: string;
}

export interface PersonalPrompt extends BaseEntity {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  content: string;
  starred: boolean;
  sourceCreatorName?: string;
  createdAt: string;
}

export interface LoveMessage extends BaseEntity {
  id: string;
  targetType: 'creator' | 'character';
  targetId: string;
  targetName: string;
  senderName: string;
  isAnonymous: boolean;
  message: string;
  hearts: number;
  style: 'letter' | 'lantern';
  createdAt: string;
}

export interface RequestReply {
  id: string;
  authorRole: 'user' | 'creator';
  authorName: string;
  content: string;
  createdAt: string;
}

export type RequestStatus = 'pending' | 'answered' | 'declined';

export interface CharacterRequest extends BaseEntity {
  id: string;
  creatorId: string;
  requesterName: string;
  title: string;
  description: string;
  tags: string[];
  status: RequestStatus;
  replies: RequestReply[];
  createdAt: string;
}

export interface GiveawayWinnerRecord {
  winnerName: string;
  drawnAt: string;
}

export interface GiveawayItem extends BaseEntity {
  id: string;
  creatorId: string;
  title: string;
  prize: string;
  condition: string;
  deadlineText: string;
  endsAt: string;
  participants: string[];
  winnerHistory: GiveawayWinnerRecord[];
  isEnded: boolean;
  imageUrl?: string;
}

export interface DocItem extends BaseEntity {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  content: string;
  updatedAt: string;
}

export type RescueStatus = 'received' | 'processing' | 'resolved';

export interface RescueReport extends BaseEntity {
  id: string;
  characterName: string;
  creatorName: string;
  issueDescription: string;
  brokenUrl?: string;
  status: RescueStatus;
  resolutionNote?: string;
  createdAt: string;
}

export interface BackupEntry extends BaseEntity {
  id: string;
  characterName: string;
  creatorName: string;
  backupLink: string;
  descriptionBackup: string;
  promptBackup: string;
  savedAt: string;
}

export interface FaqItem extends BaseEntity {
  id: string;
  q: string;
  a: string;
  imageUrl?: string;
}

export interface DrinkCatalogItem extends BaseEntity {
  id: string;
  name: string;
  note: string;
  imageUrl?: string;
}

export interface PondFishItem extends BaseEntity {
  id: string;
  name: string;
  species: string;
  sizeLevel: number;
  x: number;
  y: number;
  direction: 1 | -1;
  imageUrl?: string;
}

export interface PartnerDialogueItem extends BaseEntity {
  id: string;
  text: string;
  tier: 'low' | 'mid' | 'high';
  imageUrl?: string;
}

export const INITIAL_CREATORS: Creator[] = [
  {
    id: 'creator-lam-vong',
    name: 'Lâm Vọng Nguyệt',
    handle: '@lamvongnguyet',
    avatarSymbol: 'Nguyệt',
    avatarTint: '#2b2436',
    bio: 'Kẻ nhặt nhạnh những mảnh ký ức cổ phong và tiếng đàn tỳ bà đứt dây lúc canh ba.',
    longBio:
      'Viết giữa những đêm mưa phùn miền Bắc. Mình yêu những nhân vật mang nhiều tâm sự không thể giãi bày, những mối duyên lỡ làng nơi thâm cung hoặc chốn giang hồ hoang lạnh. Mỗi nhân vật là một bức họa thủy mặc còn vương mùi mực mới.',
    tags: ['Cổ phong', 'Ngược tâm', 'Huyền huyễn', 'Trầm tĩnh'],
    socials: [
      { label: 'Character.AI', url: 'https://character.ai/@lamvongnguyet' },
      { label: 'JanitorAI', url: 'https://janitorai.com/profiles/lamvongnguyet' },
      { label: 'Facebook', url: 'https://facebook.com/lamvongnguyet.archive' },
    ],
  },
  {
    id: 'creator-hien-suong',
    name: 'Hiên Sương Khói',
    handle: '@hiensuongkhoi',
    avatarSymbol: 'Sương',
    avatarTint: '#1d2930',
    bio: 'Lưu giữ những cuộc gặp gỡ tình cờ nơi góc phố hiện đại, mùi cà phê đắng và tiếng mưa rơi trên mái hiên.',
    longBio:
      'Mình thích khắc họa những con người bình thường với vết xước dịu dàng trong nhịp sống đô thị. Ở đây có những buổi chiều muộn bên tiệm sách cũ, những chuyến tàu đêm cuối cùng và những lời hỏi thăm tưởng chừng vô tình nhưng ấm áp.',
    tags: ['Đô thị', 'Chữa lành', 'Đời thường', 'Lãng mạn'],
    socials: [
      { label: 'Character.AI', url: 'https://character.ai/@hiensuongkhoi' },
      { label: 'Discord', url: 'https://discord.gg/hiensuongkhoi' },
      { label: 'Rentry', url: 'https://rentry.co/hiensuongkhoi' },
    ],
  },
  {
    id: 'creator-da-khuc',
    name: 'Dạ Khúc Trầm',
    handle: '@dakhuctram',
    avatarSymbol: 'Dạ',
    avatarTint: '#2e1f23',
    bio: 'Chuyên kiến tạo những tòa lâu đài Gothic, sương mù thành cổ và những bí mật ẩn dưới lớp mặt nạ nhung.',
    longBio:
      'Thế giới của Dạ Khúc Trầm xoay quanh những giao ước cổ xưa, những học viện ẩn mình trong rừng sâu và những nhân vật có nội tâm phức tạp. Nếu bạn thích cảm giác hồi hộp vừa phải pha lẫn sự quyến rũ u nhã, hãy dừng chân tại đây.',
    tags: ['Gothic', 'Bí ẩn', 'Giả tưởng', 'Tâm lý'],
    socials: [
      { label: 'JanitorAI', url: 'https://janitorai.com/profiles/dakhuctram' },
      { label: 'Chub.AI', url: 'https://chub.ai/users/dakhuctram' },
      { label: 'X / Twitter', url: 'https://x.com/dakhuctram' },
    ],
  },
  {
    id: 'creator-tram-mac',
    name: 'Trầm Mặc Các',
    handle: '@trammaccac',
    avatarSymbol: 'Mặc',
    avatarTint: '#29231b',
    bio: 'Nơi những vụ án chưa khép lại, tiếng đồng hồ quả lắc tích tắc và khói thuốc vương bên bàn làm việc.',
    longBio:
      'Mình tập trung vào mạch truyện trinh thám, đấu trí và những bối cảnh lịch sử pha chút hoài cổ. Nhân vật tại Trầm Mặc Các thường kiệm lời, sắc sảo, luôn giữ một khoảng cách vừa đủ để người đối thoại tự mình khám phá.',
    tags: ['Trinh thám', 'Tâm lý', 'Đô thị', 'Trầm tĩnh'],
    socials: [
      { label: 'Character.AI', url: 'https://character.ai/@trammaccac' },
      { label: 'Notion', url: 'https://notion.so/trammaccac' },
    ],
  },
  {
    id: 'creator-thien-di',
    name: 'Thiên Di',
    handle: '@thiendi.wanders',
    avatarSymbol: 'Di',
    avatarTint: '#222226',
    bio: 'Ghi chép từ những trạm gác không gian cô độc và thế giới hậu tận thế ngập tràn cỏ dại.',
    longBio:
      'Giữa đống đổ nát của nền văn minh cũ hoặc trong khoang tàu trôi dạt giữa các vì sao, con người vẫn tìm kiếm sự kết nối. Mình tạo ra những nhân vật đồng hành nơi tận cùng thế giới—nơi chỉ còn bạn và họ lắng nghe tín hiệu của nhau.',
    tags: ['Hậu tận thế', 'Viễn tưởng', 'Chữa lành', 'Cô độc'],
    socials: [
      { label: 'Chub.AI', url: 'https://chub.ai/users/thiendi' },
      { label: 'JanitorAI', url: 'https://janitorai.com/profiles/thiendi' },
      { label: 'Discord', url: 'https://discord.gg/thiendi' },
    ],
  },
];

export const INITIAL_CHARACTERS: CharacterItem[] = [
  {
    id: 'char-ta-khanh-inh',
    name: 'Tạ Khanh Trần',
    epithet: 'Thủ thư Tàng Kinh Các mù lòa',
    creatorId: 'creator-lam-vong',
    tags: ['Cổ phong', 'Trầm tĩnh', 'Chữa lành', 'Bí ẩn'],
    description:
      'Đôi mắt đã khép lại trước thế sự từ mười năm trước, nhưng ngón tay y vẫn nhớ rõ từng vết xước trên mỗi cuộn trúc cổ. Khi bạn bước vào tàng thư giữa đêm tuyết, y đang châm thêm trầm hương và rót sẵn một chén trà sen ấm.',
    openingLine:
      '“Tiếng bước chân của người có chút ngập ngừng... Đêm nay gió lớn như vậy, người đến tìm sách cổ hay tìm một chốn tránh sương?”',
    chatUrl: 'https://character.ai/chat/ta-khanh-tran-night-library',
    avatarSymbol: 'Trần',
    avatarTint: '#2b2436',
    petalPrice: 0,
    stats: { favorites: 148, hearts: 312, chatOpens: 890, weeklyScore: 96, monthlyScore: 340 },
  },
  {
    id: 'char-tham-tich-ngon',
    name: 'Thẩm Tịch Ngôn',
    epithet: 'Cố thái phó lưu đày nơi biên ải',
    creatorId: 'creator-lam-vong',
    tags: ['Cổ phong', 'Ngược tâm', 'Trầm tĩnh', 'Tâm lý'],
    description:
      'Từng là bậc thầy dạy dỗ thái tử nơi kinh thành phồn hoa, nay chỉ còn là một kẻ mang tội danh phản nghịch ngồi độc ẩm bên bếp lửa nhỏ vùng biên viễn. Giọng nói ôn hòa nhưng ẩn chứa nỗi bi thương chưa từng phai nhạt.',
    openingLine:
      '“Kinh thành cách nơi này ngàn dặm đường tuyết, cố nhân hà tất phải vất vả tìm đến tận đây chỉ để nhìn một kẻ bại cuộc?”',
    chatUrl: 'https://janitorai.com/characters/tham-tich-ngon',
    avatarSymbol: 'Ngôn',
    avatarTint: '#24202b',
    isLocked: true,
    unlockRequirements: [
      { id: 'req_1', category: 'flower', count: 2 },
      { id: 'req_2', category: 'drink', count: 1 },
    ],
    openScene:
      'Ngoài trời tuyết rơi trắng xóa lấp kín lối mòn biên ải. Trong căn lều nhỏ bên bếp than hồng, Thẩm Tịch Ngôn khoác áo lông cừu cũ, ngẩng đầu nhìn bóng người vừa vén rèm bước vào: “Kinh thành cách nơi này ngàn dặm đường tuyết, cố nhân hà tất phải vất vả tìm đến tận đây?”',
    creatorNote: 'Gợi ý: Dùng prompt giữ giọng cổ phong trầm ấm để nhân vật bộc lộ chiều sâu nội tâm nhé.',
    petalPrice: 15,
    stats: { favorites: 132, hearts: 284, chatOpens: 740, weeklyScore: 88, monthlyScore: 295 },
  },
  {
    id: 'char-bach-uu',
    name: 'Bạch Ưu',
    epithet: 'Họa sư vẽ mộng nơi trấn cổ',
    creatorId: 'creator-lam-vong',
    tags: ['Cổ phong', 'Huyền huyễn', 'Bí ẩn'],
    description:
      'Chủ nhân một tiệm tranh chỉ mở cửa sau giờ Hợi. Người ta đồn rằng chỉ cần kể lại giấc mộng dang dở cho Bạch Ưu, chàng sẽ dùng chu sa và sương sớm vẽ lại để bạn có thể bước vào giấc mộng ấy thêm một lần nữa.',
    openingLine:
      '“Mực đã mài xong rồi. Hãy kể cho ta nghe, trong giấc mộng đêm qua, người mà ngươi muốn giữ lại có dung mạo thế nào?”',
    chatUrl: 'https://character.ai/chat/bach-uu-dream-painter',
    avatarSymbol: 'Ưu',
    avatarTint: '#2d2533',
    petalPrice: 0,
    stats: { favorites: 98, hearts: 195, chatOpens: 520, weeklyScore: 64, monthlyScore: 210 },
  },
  {
    id: 'char-vu-hoang-nam',
    name: 'Vũ Hoàng Nam',
    epithet: 'Người pha chế ca đêm tại quán Tĩnh',
    creatorId: 'creator-hien-suong',
    tags: ['Đô thị', 'Chữa lành', 'Đời thường'],
    description:
      'Quán cà phê nhỏ nằm sâu trong con hẻm Hà Nội mở cửa từ 10 giờ tối đến 4 giờ sáng. Nam ít khi hỏi nhiều, anh chỉ lặng lẽ đặt trước mặt bạn một tách cacao nóng hoặc ly cà phê ủ lạnh vừa vặn với tâm trạng của bạn đêm nay.',
    openingLine:
      '“Ngoài trời lại bắt đầu mưa phùn rồi. Ngồi ghế gần đèn vàng cho ấm nhé, đêm nay bạn muốn uống chút gì không cồn chứ?”',
    chatUrl: 'https://character.ai/chat/vu-hoang-nam-midnight-cafe',
    avatarSymbol: 'Nam',
    avatarTint: '#1d2930',
    petalPrice: 0,
    stats: { favorites: 164, hearts: 356, chatOpens: 980, weeklyScore: 112, monthlyScore: 390 },
  },
  {
    id: 'char-le-ha-anh',
    name: 'Lê Hạ Anh',
    epithet: 'Phát thanh viên đài radio tần số 02:00 AM',
    creatorId: 'creator-hien-suong',
    tags: ['Đô thị', 'Đời thường', 'Lãng mạn', 'Chữa lành'],
    description:
      'Giọng đọc khàn nhẹ truyền qua làn sóng radio lúc hai giờ sáng dành cho những người mất ngủ trong thành phố. Đêm nay, bạn là vị thính giả duy nhất gọi điện trực tiếp vào đường dây nóng của phòng thu.',
    openingLine:
      '“Xin chào thính giả đầu dây bên kia... Đèn báo sóng đã sáng rồi, đêm nay điều gì đang giữ bạn thức giấc vậy?”',
    chatUrl: 'https://character.ai/chat/le-ha-anh-radio-02am',
    avatarSymbol: 'Hạ',
    avatarTint: '#1a252b',
    isLocked: true,
    unlockRequirements: [
      { id: 'req_ha_1', category: 'fish', count: 1 },
      { id: 'req_ha_2', category: 'drink', count: 1 },
    ],
    openScene:
      'Trong phòng thu nhỏ ấm ánh đèn vàng lúc 02:00 sáng, tiếng mưa gõ nhịp ngoài khung kính. Lê Hạ Anh chỉnh lại tai nghe, mỉm cười dịu dàng khi đèn báo cuộc gọi của bạn sáng lên: “Xin chào vị thính giả đầu dây bên kia... Đêm nay điều gì đang giữ bạn thức giấc vậy?”',
    creatorNote: 'Phù hợp trò chuyện tâm sự chữa lành trước khi ngủ.',
    petalPrice: 12,
    stats: { favorites: 121, hearts: 245, chatOpens: 670, weeklyScore: 79, monthlyScore: 260 },
  },
  {
    id: 'char-tran-nhat-minh',
    name: 'Trần Nhật Minh',
    epithet: 'Chủ tiệm sửa đồng hồ cơ phố cổ',
    creatorId: 'creator-hien-suong',
    tags: ['Đô thị', 'Đời thường', 'Trầm tĩnh'],
    description:
      'Giữa hàng trăm tiếng tích tắc nhịp nhàng trên bức tường gỗ cũ kỹ, Minh kiên nhẫn lau chùi những bánh răng nhỏ li ti. Anh tin rằng mỗi chiếc đồng hồ dừng chạy đều đang giữ lại một khoảnh khắc mà chủ nhân của nó chưa nỡ bước qua.',
    openingLine:
      '“Chiếc đồng hồ này đã ngừng ở 11 giờ 45 phút khá lâu rồi đấy. Bạn muốn tôi sửa cho nó chạy tiếp, hay chỉ muốn lau sáng mặt kính thôi?”',
    chatUrl: 'https://janitorai.com/characters/tran-nhat-minh',
    avatarSymbol: 'Minh',
    avatarTint: '#222b30',
    petalPrice: 0,
    stats: { favorites: 87, hearts: 176, chatOpens: 460, weeklyScore: 52, monthlyScore: 185 },
  },
  {
    id: 'char-julian-thorne',
    name: 'Julian Vance',
    epithet: 'Người trông coi nhà nguyện sương mù',
    creatorId: 'creator-da-khuc',
    tags: ['Gothic', 'Bí ẩn', 'Giả tưởng', 'Ngược tâm'],
    description:
      'Dưới mái vòm đá cổ kính nơi những ngọn nến sáp ong chưa bao giờ tắt, Julian giữ chiếc chìa khóa dẫn xuống tầng hầm lưu trữ những cuốn nhật ký bị cấm. Đôi găng tay đen của anh luôn phảng phất mùi hương thảo khô và tro tàn.',
    openingLine:
      '“Cánh cổng sắt ngoài nghĩa trang vốn đã khóa từ lúc hoàng hôn. Việc ngươi đứng được ở hành lang này... hẳn không phải là một sự tình cờ.”',
    chatUrl: 'https://janitorai.com/characters/julian-vance-gothic',
    avatarSymbol: 'J.V',
    avatarTint: '#2e1f23',
    isLocked: true,
    unlockRequirements: [
      { id: 'req_jv_1', category: 'flower', count: 2 },
      { id: 'req_jv_2', category: 'fish', count: 1 },
      { id: 'req_jv_3', category: 'drink', count: 1 },
    ],
    openScene:
      'Sương mù dày đặc bao phủ lối vào nhà nguyện cổ. Julian Vance cầm ngọn đèn bão bước ra từ hành lang đá, chùm chìa khóa bạc khẽ ngân vang trong đêm tĩnh mịch: “Cánh cổng sắt ngoài nghĩa trang vốn đã khóa từ lúc hoàng hôn. Việc ngươi đứng được ở đây... hẳn không phải tình cờ.”',
    creatorNote: 'Nhân vật thuộc vũ trụ Gothic bí ẩn, có cốt truyện nhiều tầng.',
    petalPrice: 20,
    stats: { favorites: 139, hearts: 298, chatOpens: 810, weeklyScore: 91, monthlyScore: 315 },
  },
  {
    id: 'char-celeste-morreau',
    name: 'Celeste Morreau',
    epithet: 'Nghệ sĩ dương cầm trong dinh thự bỏ hoang',
    creatorId: 'creator-da-khuc',
    tags: ['Gothic', 'Lãng mạn', 'Giả tưởng', 'Bí ẩn'],
    description:
      'Mỗi đêm trăng khuyết, tiếng đàn Sonata trầm buồn lại vang lên từ phòng khiêu vũ phủ đầy khăn lụa trắng. Celeste ngồi bên cây đại dương cầm đen bóng, chờ đợi một người khách có thể nghe trọn vẹn bản nhạc mà không hoảng sợ rời đi.',
    openingLine:
      '“Xin đừng bước quá gần ánh nến, bóng tối ở góc phòng sẽ giúp âm thanh nghe rõ ràng và chân thật hơn nhiều.”',
    chatUrl: 'https://chub.ai/characters/celeste-morreau-nocturne',
    avatarSymbol: 'C.M',
    avatarTint: '#2b1c20',
    petalPrice: 0,
    stats: { favorites: 105, hearts: 215, chatOpens: 590, weeklyScore: 68, monthlyScore: 230 },
  },
  {
    id: 'char-dang-khoa',
    name: 'Đặng Khoa',
    epithet: 'Chuyên viên lưu trữ hồ sơ án treo',
    creatorId: 'creator-tram-mac',
    tags: ['Trinh thám', 'Tâm lý', 'Đô thị', 'Trầm tĩnh'],
    description:
      'Làm việc tại tầng hầm B2 của cục lưu trữ thành phố, nơi tập hợp những vụ án đã qua mười lăm năm chưa tìm ra lời giải. Đặng Khoa có thói quen ghi chú bằng bút máy mực đen và nhớ từng chi tiết nhỏ trong lời khai của nhân chứng.',
    openingLine:
      '“Hồ sơ mã số 409 mà bạn vừa nhắc tới đã bị niêm phong từ mùa thu năm 2014. Hãy nói thật cho tôi biết, bạn nhìn thấy ký hiệu đó ở đâu?”',
    chatUrl: 'https://character.ai/chat/dang-khoa-cold-case',
    avatarSymbol: 'Khoa',
    avatarTint: '#29231b',
    petalPrice: 0,
    stats: { favorites: 114, hearts: 232, chatOpens: 630, weeklyScore: 74, monthlyScore: 248 },
  },
  {
    id: 'char-nghiem-bach',
    name: 'Nghiêm Bách',
    epithet: 'Bác sĩ tâm lý ca trực đêm',
    creatorId: 'creator-tram-mac',
    tags: ['Tâm lý', 'Đô thị', 'Trinh thám', 'Bí ẩn'],
    description:
      'Phòng tư vấn trên tầng 14 nhìn thẳng xuống đại lộ vắng lặng lúc một giờ sáng. Nghiêm Bách lắng nghe những cơn ác mộng lặp đi lặp lại của bệnh nhân bằng sự điềm tĩnh tuyệt đối, nhưng ánh mắt sau gọng kính mảnh dường như đã thấu tỏ mọi lời nói dối.',
    openingLine:
      '“Cứ thong thả ngồi xuống ghế sofa đi. Trong căn phòng này không có ghi âm, chỉ có tiếng mưa bên ngoài cửa sổ và câu chuyện của bạn.”',
    chatUrl: 'https://janitorai.com/characters/nghiem-bach-psych',
    avatarSymbol: 'Bách',
    avatarTint: '#262119',
    isLocked: true,
    unlockRequirements: [
      { id: 'req_nb_1', category: 'flower', count: 2 },
    ],
    openScene:
      'Căn phòng tư vấn tầng 14 thoảng hương gỗ tuyết tùng ấm áp. Bác sĩ Nghiêm Bách đặt tách trà thảo mộc nóng lên bàn kính, ánh mắt sau gọng kính mảnh nhìn bạn đầy kiên nhẫn: “Cứ thong thả ngồi xuống ghế sofa đi. Đêm nay chúng ta có rất nhiều thời gian.”',
    creatorNote: 'Thích hợp cho cốt truyện tâm lý - giải mã giấc mơ.',
    petalPrice: 18,
    stats: { favorites: 128, hearts: 268, chatOpens: 710, weeklyScore: 84, monthlyScore: 280 },
  },
  {
    id: 'char-sol-7',
    name: 'Trạm Trưởng Kael (Trạm Viễn Vọng 09)',
    epithet: 'Người canh giữ tín hiệu vô tuyến cuối cùng',
    creatorId: 'creator-thien-di',
    tags: ['Viễn tưởng', 'Cô độc', 'Chữa lành', 'Trầm tĩnh'],
    description:
      'Cách Trái Đất 40 năm ánh sáng, Kael sống một mình trên trạm quan sát quay quanh một hành tinh băng giá. Khi thiết bị thu phát của bạn vô tình bắt được dải tần số cũ kỹ của trạm, đó là cuộc trò chuyện đầu tiên của anh sau 1.400 ngày cô độc.',
    openingLine:
      '“Tín hiệu... rõ đến mức khó tin. Đầu dây bên kia, nếu đây không phải là ảo giác âm thanh từ bão từ trường, xin hãy lên tiếng.”',
    chatUrl: 'https://chub.ai/characters/kael-outpost-09',
    avatarSymbol: 'K.09',
    avatarTint: '#222226',
    petalPrice: 0,
    stats: { favorites: 118, hearts: 249, chatOpens: 645, weeklyScore: 77, monthlyScore: 255 },
  },
  {
    id: 'char-an-nhien',
    name: 'An Nhiên',
    epithet: 'Người trồng hoa trong nhà kính hậu tận thế',
    creatorId: 'creator-thien-di',
    tags: ['Hậu tận thế', 'Chữa lành', 'Cô độc', 'Đời thường'],
    description:
      'Giữa thành phố bê tông xám xịt đã bị thiên nhiên nuốt chửng sau biến cố, An Nhiên chăm sóc một mái vòm kính nhỏ phát sáng bởi những loài thực vật dạ quang. Cô pha trà thảo mộc cho những lữ khách tình cờ đi ngang qua vùng hoang phế.',
    openingLine:
      '“Bộ lọc khí trên mặt nạ của bạn sắp cạn rồi kìa. Vào trong nhà kính đi, không khí ở đây trong lành và hoa quỳnh đêm vừa mới nở.”',
    chatUrl: 'https://character.ai/chat/an-nhien-greenhouse',
    avatarSymbol: 'An',
    avatarTint: '#1f2421',
    petalPrice: 0,
    stats: { favorites: 109, hearts: 228, chatOpens: 580, weeklyScore: 71, monthlyScore: 240 },
  },
];

export const INITIAL_COMMISSIONS: CreatorCommissionInfo[] = [
  {
    id: 'comm-info-1',
    creatorId: 'creator-lam-vong',
    isOpen: true,
    waitTime: '5 – 7 ngày',
    slotsLeft: 2,
    note: 'Nhận thiết lập cổ phong, tu tiên, cung đình hoặc giang hồ. Không nhận bối cảnh hiện đại thuần.',
    tiers: [
      { name: 'Khởi bút (Ngắn)', price: '120.000đ', detail: 'Thiết lập cốt lõi + 1 kịch bản mở đầu (~800 từ)' },
      { name: 'Họa quyển (Tiêu chuẩn)', price: '220.000đ', detail: 'Thiết lập sâu + lore thế giới + 2 kịch bản mở đầu' },
      { name: 'Tàng thư (Chuyên sâu)', price: '350.000đ', detail: 'Full lorebook + đa nhánh tâm lý + hỗ trợ tinh chỉnh 2 lần' },
    ],
  },
  {
    id: 'comm-info-2',
    creatorId: 'creator-hien-suong',
    isOpen: true,
    waitTime: '3 – 5 ngày',
    slotsLeft: 3,
    note: 'Ưu tiên dòng đời thường, đô thị Hà Nội/Sài Gòn đêm, chữa lành hoặc tình cảm nhẹ nhàng.',
    tiers: [
      { name: 'Tách trà ấm', price: '100.000đ', detail: 'Hồ sơ nhân vật cơ bản + lời chào đầu giàu cảm xúc' },
      { name: 'Chuyến tàu đêm', price: '190.000đ', detail: 'Hồ sơ chi tiết + thói quen ngôn ngữ + 2 lời chào mở đầu' },
    ],
  },
  {
    id: 'comm-info-3',
    creatorId: 'creator-da-khuc',
    isOpen: false,
    waitTime: '7 – 10 ngày',
    slotsLeft: 0,
    note: 'Hiện đang tạm đóng để hoàn trả các đơn Gothic tháng này. Sẽ mở lại vào đầu tuần tới.',
    tiers: [
      { name: 'Khế ước Bạc', price: '180.000đ', detail: 'Nhân vật Gothic / Dark Academia + thiết lập tâm lý phức tạp' },
      { name: 'Khế ước Đêm Đen', price: '320.000đ', detail: 'Bao gồm toàn bộ lore gia tộc, bí mật ẩn và hướng dẫn prompt đi kèm' },
    ],
  },
  {
    id: 'comm-info-4',
    creatorId: 'creator-tram-mac',
    isOpen: true,
    waitTime: '4 – 6 ngày',
    slotsLeft: 1,
    note: 'Nhận xây dựng nhân vật có chiều sâu tâm lý, trinh thám, hồ sơ mật hoặc đối thoại đấu trí.',
    tiers: [
      { name: 'Hồ sơ niêm phong', price: '160.000đ', detail: 'Thiết lập nhân vật + manh mối cốt truyện mở đầu' },
      { name: 'Phòng thẩm vấn', price: '280.000đ', detail: 'Kịch bản đa tầng + phản ứng tâm lý theo mức độ tin cậy' },
    ],
  },
  {
    id: 'comm-info-5',
    creatorId: 'creator-thien-di',
    isOpen: true,
    waitTime: '5 – 8 ngày',
    slotsLeft: 2,
    note: 'Nhận đề tài viễn tưởng, hậu tận thế, không gian cô độc hoặc sinh tồn.',
    tiers: [
      { name: 'Tín hiệu vệ tinh', price: '140.000đ', detail: 'Thiết lập nhân vật + bối cảnh trạm/vùng sinh tồn' },
      { name: 'Nhật ký thiên hà', price: '260.000đ', detail: 'Hệ thống thế giới hoàn chỉnh + nhật ký âm thanh mở đầu' },
    ],
  },
];

export const INITIAL_COMMISSION_ORDERS: CommissionOrder[] = [
  {
    id: 'order-1',
    creatorId: 'creator-lam-vong',
    requesterName: 'Miên Miên',
    characterConcept: 'Một vị琴sư (cầm sư) ẩn cư trên núi tuyết, bề ngoài lạnh nhạt nhưng âm thầm bảo vệ người từng cứu mạng mình thuở nhỏ.',
    budget: '220.000đ (Gói Họa quyển)',
    contact: 'Discord: @mienmien_night',
    status: 'in_progress',
    createdAt: '2026-10-17T21:15:00Z',
  },
  {
    id: 'order-2',
    creatorId: 'creator-hien-suong',
    requesterName: 'Khách qua đường',
    characterConcept: 'Anh hàng xóm làm kiến trúc sư hay thức khuya vẽ bản thảo ngoài ban công chung cư cũ, nói chuyện điềm đạm.',
    budget: '190.000đ (Gói Chuyến tàu đêm)',
    contact: 'FB: fb.com/khachquaduong.02',
    status: 'pending',
    createdAt: '2026-10-18T23:40:00Z',
  },
  {
    id: 'order-3',
    creatorId: 'creator-tram-mac',
    requesterName: 'Linh Đan',
    characterConcept: 'Thám tử tư chuyên điều tra các bức tranh cổ bị đánh cắp, tính cách hơi lập dị nhưng cực kỳ tinh tế.',
    budget: '280.000đ (Gói Phòng thẩm vấn)',
    contact: 'Discord: @linhdan.archive',
    status: 'completed',
    createdAt: '2026-10-14T19:00:00Z',
  },
];

export const INITIAL_SHARED_PROMPTS: SharedPrompt[] = [
  {
    id: 'sp-1',
    title: 'Giữ nhịp tự sự chậm rãi & miêu tả cảnh vật cổ phong',
    creatorId: 'creator-lam-vong',
    characterId: 'char-ta-khanh-inh',
    tags: ['Cổ phong', 'Miêu tả sâu', 'Trầm tĩnh', 'Chống OOC'],
    usageNote: 'Dán vào phần System Prompt hoặc gửi kèm tin nhắn đầu tiên để AI giữ văn phong cổ điển, kiệm lời.',
    content: `[Hướng dẫn văn phong: Hãy duy trì nhịp độ kể chuyện thật chậm rãi, giàu hình ảnh ẩn dụ về ánh nến, mùi trầm hương, tiếng gió lùa qua hiên gỗ hoặc tiếng mưa tuyết ngoài song cửa. Nhân vật tuyệt đối không sử dụng từ ngữ hiện đại. Mỗi câu trả lời nên từ 2-3 đoạn văn: đoạn đầu miêu tả thần thái/hành động nhỏ tinh tế, đoạn giữa là lời đối thoại điềm đạm, đoạn cuối khép lại bằng dư âm không gian.]`,
    createdAt: '2026-10-15T20:00:00Z',
  },
  {
    id: 'sp-2',
    title: 'Khơi gợi đối thoại đời thường ấm áp lúc nửa đêm',
    creatorId: 'creator-hien-suong',
    characterId: 'char-vu-hoang-nam',
    tags: ['Đô thị', 'Chữa lành', 'Tự nhiên', 'Đời thường'],
    usageNote: 'Giúp nhân vật trò chuyện tự nhiên như một người bạn thực sự, không lên gân hay giáo điều.',
    content: `[Thiết lập phản hồi: Nhân vật giao tiếp bằng giọng điệu tự nhiên, gần gũi, sử dụng các cử chỉ đời thường (như khuấy nhẹ ly nước, chỉnh lại ánh đèn bàn, lắng nghe tiếng mưa ngoài ngõ). Tránh đưa ra lời khuyên sáo rỗng; thay vào đó hãy đặt những câu hỏi nhỏ dịu dàng để người đối diện cảm thấy được lắng nghe và an toàn.]`,
    createdAt: '2026-10-16T22:10:00Z',
  },
  {
    id: 'sp-3',
    title: 'Khóa tính cách sắc sảo & giữ bí mật nhân vật trinh thám',
    creatorId: 'creator-tram-mac',
    characterId: 'char-dang-khoa',
    tags: ['Trinh thám', 'Chống OOC', 'Tâm lý', 'Cốt truyện'],
    usageNote: 'Ngăn AI tiết lộ toàn bộ bí mật ngay từ đầu cuộc trò chuyện.',
    content: `[Quy tắc cốt truyện: Nhân vật luôn giữ thái độ quan sát điềm tĩnh, chỉ tiết lộ thông tin từng phần nhỏ dựa trên mức độ hợp lý trong câu hỏi của người chơi. Không tự ý giải quyết vụ án thay người đối thoại. Hãy để lại một chi tiết nhỏ đáng ngờ hoặc một câu hỏi ngược ở cuối lượt phản hồi để kích thích suy luận.]`,
    createdAt: '2026-10-17T18:30:00Z',
  },
  {
    id: 'sp-4',
    title: 'Mở rộng chiều sâu nội tâm Gothic & mâu thuẫn ngầm',
    creatorId: 'creator-da-khuc',
    characterId: 'char-julian-thorne',
    tags: ['Gothic', 'Nội tâm', 'Miêu tả sâu'],
    usageNote: 'Tạo bầu không khí u nhã, cổ kính như tiểu thuyết văn học châu Âu thế kỷ 19.',
    content: `[Định hướng bầu không khí: Chú trọng sự tương phản giữa ánh sáng leo lét của nến sáp và bóng tối dưới mái vòm đá. Thể hiện sự giằng xé nội tâm của nhân vật thông qua ánh mắt, nhịp thở và những khoảng lặng ngập ngừng giữa câu chữ thay vì nói thẳng cảm xúc ra ngoài.]`,
    createdAt: '2026-10-18T14:20:00Z',
  },
];

export const INITIAL_PERSONAL_PROMPTS: PersonalPrompt[] = [
  {
    id: 'pp-1',
    title: 'Mẫu tóm tắt mạch truyện sau mỗi 30 tin nhắn',
    folder: 'Quản lý trí nhớ',
    tags: ['Memory', 'Tóm tắt', 'Đa dụng'],
    starred: true,
    content: `(OOC: Hãy tạm dừng mạch truyện một chút và tóm tắt lại 5 sự kiện quan trọng nhất đã diễn ra từ đầu buổi trò chuyện đến giờ, kèm theo trạng thái tình cảm hiện tại của nhân vật đối với tôi dưới dạng gạch đầu dòng ngắn gọn.)`,
    createdAt: '2026-10-16T10:00:00Z',
  },
  {
    id: 'pp-2',
    title: 'Chuyển cảnh sang buổi sáng hôm sau nhẹ nhàng',
    folder: 'Chuyển cảnh',
    tags: ['Time-skip', 'Đời thường'],
    starred: false,
    content: `*Đêm dần tàn, những tia nắng nhạt đầu tiên bắt đầu xuyên qua lớp rèm mỏng phủ lên góc bàn. Một đêm dài trò chuyện khép lại, nhường chỗ cho bầu không khí tĩnh lặng của buổi sớm mai.*`,
    createdAt: '2026-10-17T11:30:00Z',
  },
];

export const INITIAL_LOVE_MESSAGES: LoveMessage[] = [
  {
    id: 'love-1',
    targetType: 'character',
    targetId: 'char-ta-khanh-inh',
    targetName: 'Tạ Khanh Trần',
    senderName: 'Một lữ khách sợ lạnh',
    isAnonymous: false,
    message: 'Cảm ơn chén trà sen ấm của Tạ tiên sinh. Những đêm mất ngủ vì áp lực công việc, chỉ cần bước vào Tàng Kinh Các nghe tiếng lật giấy trúc là lòng mình dịu lại rất nhiều.',
    hearts: 24,
    style: 'lantern',
    createdAt: '2026-10-17T23:50:00Z',
  },
  {
    id: 'love-2',
    targetType: 'creator',
    targetId: 'creator-hien-suong',
    targetName: 'Hiên Sương Khói',
    senderName: 'Ẩn danh',
    isAnonymous: true,
    message: 'Văn phong của Hiên Sương thực sự giống như mùi mưa đầu mùa vậy. Cảm ơn bạn đã tạo ra Vũ Hoàng Nam và Lê Hạ Anh để tụi mình có một nơi trú ẩn thật dịu dàng.',
    hearts: 31,
    style: 'letter',
    createdAt: '2026-10-18T01:20:00Z',
  },
  {
    id: 'love-3',
    targetType: 'character',
    targetId: 'char-sol-7',
    targetName: 'Trạm Trưởng Kael (Trạm Viễn Vọng 09)',
    senderName: 'Tần số 404',
    isAnonymous: false,
    message: 'Gửi Kael ở cách đây 40 năm ánh sáng: bạn không còn cô độc trên trạm quan sát đó nữa đâu. Tín hiệu của bạn luôn có người lắng nghe mỗi tối.',
    hearts: 19,
    style: 'lantern',
    createdAt: '2026-10-18T21:05:00Z',
  },
];

export const INITIAL_REQUESTS: CharacterRequest[] = [
  {
    id: 'req-1',
    creatorId: 'creator-lam-vong',
    requesterName: 'Thu Thủy',
    title: 'Mong có một nhân vật y sư ẩn cư trong thung lũng sương mù',
    description: 'Mình rất thích văn phong cổ phong của Lâm Vọng Nguyệt. Nếu có dịp, bạn có thể tạo một vị y sư tính tình ngoài lạnh trong nóng, chuyên trồng dược thảo quý và cứu người lữ khách bị thương lạc vào cốc không ạ?',
    tags: ['Cổ phong', 'Chữa lành'],
    status: 'answered',
    createdAt: '2026-10-16T20:15:00Z',
    replies: [
      {
        id: 'rep-1',
        authorRole: 'creator',
        authorName: 'Lâm Vọng Nguyệt',
        content: 'Cảm ơn gợi ý rất thơ của Thu Thủy nhé! Mình đang phác thảo hồ sơ vị y sư tên Cố Thanh Từ ở Dược Vương Cốc rồi, dự kiến cuối tuần này sẽ lên kệ thư viện nha.',
        createdAt: '2026-10-17T09:30:00Z',
      },
      {
        id: 'rep-2',
        authorRole: 'user',
        authorName: 'Thu Thủy',
        content: 'Ôi vui quá, mình sẽ chờ ngày Cố y sư xuất hiện ở thư viện đêm!',
        createdAt: '2026-10-17T12:10:00Z',
      },
    ],
  },
  {
    id: 'req-2',
    creatorId: 'creator-hien-suong',
    requesterName: 'Hoàng Hôn Muộn',
    title: 'Nhân vật người bán hoa tươi buổi tối ở góc phố',
    description: 'Một cô gái hoặc chàng trai mở xe hoa nhỏ dưới ánh đèn đường vàng lúc tan tầm muộn, luôn tặng kèm một nhánh hoa oải hương khô cho khách quen.',
    tags: ['Đô thị', 'Đời thường'],
    status: 'pending',
    createdAt: '2026-10-18T22:45:00Z',
    replies: [],
  },
  {
    id: 'req-3',
    creatorId: 'creator-tram-mac',
    requesterName: 'Ký giả đêm',
    title: 'Bối cảnh cyberpunk hành động nhịp độ nhanh',
    description: 'Mong Trầm Mặc Các làm một char lính đánh thuê chiến đấu liên tục trong thành phố neon.',
    tags: ['Viễn tưởng'],
    status: 'declined',
    createdAt: '2026-10-15T17:00:00Z',
    replies: [
      {
        id: 'rep-3',
        authorRole: 'creator',
        authorName: 'Trầm Mặc Các',
        content: 'Cảm ơn bạn đã gửi ý tưởng. Hiện tại mình chỉ tập trung vào mảng trinh thám tâm lý chậm rãi nên xin phép hẹn bạn ở một đề tài phù hợp hơn nhé.',
        createdAt: '2026-10-15T21:00:00Z',
      },
    ],
  },
];

export const INITIAL_GIVEAWAYS: GiveawayItem[] = [
  {
    id: 'ga-1',
    creatorId: 'creator-lam-vong',
    title: 'Đêm Trăng Tàng Thư — Tặng 1 Gói Commission Họa Quyển',
    prize: '01 suất thiết kế nhân vật riêng theo yêu cầu (Gói Họa Quyển trị giá 220.000đ) + 30 Cánh hoa',
    condition: 'Dành cho tất cả độc giả ghé thăm Thư Viện Đêm và đã thả tim ít nhất 1 nhân vật bất kỳ.',
    deadlineText: 'Còn 2 ngày 14 giờ',
    endsAt: '2026-10-22T02:00:00Z',
    participants: ['Miên Miên', 'Thu Thủy', 'Lữ khách 02AM', ' Khói Sương', 'Tần số 404'],
    winnerHistory: [
      { winnerName: 'Lữ khách 02AM', drawnAt: '15/10/2026 · 23:00' },
    ],
    isEnded: false,
  },
  {
    id: 'ga-2',
    creatorId: 'creator-hien-suong',
    title: 'Quà Tặng Góc Phố Đêm — Lorebook Độc Quyền & Mở Khóa Char',
    prize: 'Bộ Lorebook chi tiết "Quán Cà Phê Tĩnh & Những Vị Khách Quen" + 50 Cánh hoa',
    condition: 'Chỉ cần bấm Tham gia và để lại tên gọi của bạn trong đêm nay.',
    deadlineText: 'Còn 4 ngày 06 giờ',
    endsAt: '2026-10-24T00:00:00Z',
    participants: ['An Nhiên Fan', 'Cú Đêm Hà Nội', 'Linh Đan', 'Hoàng Hôn Muộn'],
    winnerHistory: [],
    isEnded: false,
  },
];

export const INITIAL_DOCS: DocItem[] = [
  {
    id: 'doc-1',
    title: 'Sổ tay chống OOC (Out of Character) khi trò chuyện dài',
    folder: 'Hướng dẫn Chat',
    tags: ['Cơ bản', 'Chống OOC', 'Kinh nghiệm'],
    updatedAt: '2026-10-18T20:00:00Z',
    content: `# Sổ tay giữ hồn nhân vật trong những cuộc trò chuyện dài

Khi cuộc đối thoại kéo dài qua hàng chục lượt tin nhắn, các mô hình AI đôi khi sẽ quên đi nét tính cách trầm tĩnh ban đầu. Dưới đây là vài kinh nghiệm nhỏ được đúc kết tại **Thư Viện Đêm**:

## 1. Bối cảnh và miêu tả hành động
Hãy luôn xen kẽ lời thoại của bạn với một câu miêu tả không gian ngắn.
> Ví dụ: *Tôi đặt nhẹ tách trà xuống bàn gỗ, lắng nghe tiếng mưa ngoài hiên rồi mới chậm rãi đáp lời.*

## 2. Nhắc nhớ tinh tế bằng OOC
Nếu thấy nhân vật bắt đầu nói quá nhiều hoặc lệch giọng văn, bạn có thể chèn một dòng nhắc nhỏ ở cuối tin nhắn:
- Giữ giọng điệu điềm đạm, kiệm lời như thiết lập ban đầu.
- Không tự ý thúc đẩy cốt truyện quá nhanh.

\`\`\`
[System Note: Maintain the character's stoic, soft-spoken demeanor and archaic vocabulary.]
\`\`\``,
  },
  {
    id: 'doc-2',
    title: 'Cấu trúc thiết lập Lorebook cho thế giới Cổ Phong',
    folder: 'Tài liệu Creator',
    tags: ['Cổ phong', 'Lorebook', 'Thiết kế Char'],
    updatedAt: '2026-10-17T16:30:00Z',
    content: `# Ghi chép xây dựng Lorebook Cổ Phong

Một nhân vật cổ phong có hồn không nằm ở việc liệt kê hàng trăm danh xưng, mà ở **nhịp thở của không gian** quanh họ.

## Ba trụ cột cần ghi rõ
- **Ngôn từ & Xưng hô**: Quy định rõ cách xưng hô (Ta - Người, Bản tọa - Ngươi, Tại hạ - Cô nương/Công tử) để không bị lẫn lộn.
- **Vật gắn liền với ký ức**: Một chiếc trâm gỗ cũ, một bức họa chưa vẽ xong, hay mùi trầm hương đặc trưng.
- **Ranh giới tâm lý**: Điều gì nhân vật sẽ không bao giờ nói ra ngay lần đầu gặp gỡ?`,
  },
];

export const INITIAL_RESCUE_REPORTS: RescueReport[] = [
  {
    id: 'res-1',
    characterName: 'Cố Trường Phong (Kiếm khách mù)',
    creatorName: 'Lâm Vọng Nguyệt',
    issueDescription: 'Link Character.AI cũ bị lỗi 404 sau đợt cập nhật đường dẫn tháng trước.',
    brokenUrl: 'https://character.ai/chat/old-co-truong-phong',
    status: 'resolved',
    resolutionNote: 'Creator đã cập nhật lại bản sao sang gương lưu trữ mới và khôi phục toàn bộ lời mở đầu.',
    createdAt: '2026-10-15T22:00:00Z',
  },
  {
    id: 'res-2',
    characterName: 'Arthur Pendelton (Thư viện trưởng)',
    creatorName: 'Dạ Khúc Trầm',
    issueDescription: 'Bản trên JanitorAI đang bị chuyển sang chế độ riêng tư, mong kiểm tra giúp có link dự phòng trên Chub không ạ.',
    brokenUrl: 'https://janitorai.com/characters/arthur-pendelton',
    status: 'processing',
    resolutionNote: 'Đang liên hệ Dạ Khúc Trầm để lấy file JSON card dự phòng.',
    createdAt: '2026-10-18T19:15:00Z',
  },
];

export const INITIAL_BACKUPS: BackupEntry[] = [
  {
    id: 'bak-1',
    characterName: 'Tạ Khanh Trần — Bản lưu trữ gốc v1.2',
    creatorName: 'Lâm Vọng Nguyệt',
    backupLink: 'https://character.ai/chat/ta-khanh-tran-night-library',
    descriptionBackup: 'Thủ thư Tàng Kinh Các mù lòa. Tính cách ôn nhu, tĩnh tại, tinh thông cổ tịch và tiếng đàn tỳ bà.',
    promptBackup: '“Tiếng bước chân của người có chút ngập ngừng... Đêm nay gió lớn như vậy, người đến tìm sách cổ hay tìm một chốn tránh sương?”',
    savedAt: '16/10/2026',
  },
  {
    id: 'bak-2',
    characterName: 'Vũ Hoàng Nam — Bản lưu trữ quán Tĩnh',
    creatorName: 'Hiên Sương Khói',
    backupLink: 'https://character.ai/chat/vu-hoang-nam-midnight-cafe',
    descriptionBackup: 'Barista ca đêm từ 22:00 đến 04:00 sáng tại con hẻm nhỏ Hà Nội. Lắng nghe, ít hỏi, pha đồ uống theo tâm trạng.',
    promptBackup: '“Ngoài trời lại bắt đầu mưa phùn rồi. Ngồi ghế gần đèn vàng cho ấm nhé, đêm nay bạn muốn uống chút gì không cồn chứ?”',
    savedAt: '17/10/2026',
  },
];

export const INITIAL_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    q: 'Làm thế nào khi link nhân vật trên Character.AI hoặc JanitorAI báo lỗi 404?',
    a: 'Bạn hãy gửi báo cáo ở mục "Báo link chết / Tìm lại char cũ" bên trên nhé. Các Creator sẽ kiểm tra và đăng lại bản gương (mirror) hoặc trích xuất thẻ từ Góc lưu giữ dự phòng.',
  },
  {
    id: 'faq-2',
    q: 'Làm sao để nhân vật không bị quên bối cảnh khi trò chuyện quá dài?',
    a: 'Bạn có thể ghé tab "Kho lệnh" để chép mẫu lệnh Tóm tắt mạch truyện sau mỗi 30 tin nhắn, hoặc ghim các sự kiện quan trọng vào phần Memory của nền tảng chat.',
  },
  {
    id: 'faq-3',
    q: 'Dữ liệu ghi chú cá nhân, Cánh hoa và Kho lệnh của tôi được lưu ở đâu?',
    a: 'Toàn bộ dữ liệu được lưu trực tiếp trên trình duyệt của bạn. Bạn có thể bấm nút "Export JSON" ở cuối trang bất cứ lúc nào để cất file sao lưu riêng.',
  },
];

export const INITIAL_DRINKS_CATALOG: DrinkCatalogItem[] = [
  { id: 'dr-1', name: 'Americano Đá Khói Sương', note: 'Đắng thanh, giữ đầu óc tỉnh táo lúc 2 giờ sáng.' },
  { id: 'dr-2', name: 'Trà Sữa Bá Tước Nướng', note: 'Thơm mùi cam bergamot quyện sữa ấm dịu.' },
  { id: 'dr-3', name: 'Matcha Latte Uji Ấm', note: 'Vị chát nhẹ đầu lưỡi, hậu vị ngọt thanh.' },
  { id: 'dr-4', name: 'Cacao Nóng Quế Hồi', note: 'Sánh đặc ấm áp cho những đêm mưa phùn.' },
  { id: 'dr-5', name: 'Trà Hoa Cúc Mật Ong Rừng', note: 'Dịu thần kinh, đưa tâm trí về sự tĩnh tại.' },
  { id: 'dr-6', name: 'Cold Brew Cam Quế', note: 'Ủ lạnh 18 giờ, thoảng hương vỏ cam khô.' },
  { id: 'dr-7', name: 'Trà Ô Long Đào Trắng', note: 'Thanh mát như gió đầu thu lùa qua song cửa.' },
  { id: 'dr-8', name: 'Sữa Tươi Trân Châu Đường Đen', note: 'Ngọt ngào nhỏ bé giữa đêm dài đọc truyện.' },
  { id: 'dr-9', name: 'Trà Sen Tây Hồ Ủ Ấm', note: 'Hương sen thanh khiết nơi Tàng Kinh Các.' },
  { id: 'dr-10', name: 'Espresso Con Panna', note: 'Một chút kem béo mịn trên nền cà phê đậm.' },
  { id: 'dr-11', name: 'Trà Hoa Đậu Biếc Chanh Tươi', note: 'Sắc tím than huyền ảo đổi màu dưới ánh nến.' },
  { id: 'dr-12', name: 'Sữa Hạnh Nhân Rang Ấm', note: 'Bùi thơm, nhẹ bụng khi thức khuya.' },
  { id: 'dr-13', name: 'Trà Gừng Táo Đỏ Cổ Phong', note: 'Làm ấm đôi bàn tay đang gõ phím.' },
  { id: 'dr-14', name: 'Hồng Trà Kem Phô Mai Muối Biển', note: 'Mặn dịu hòa quyện cùng vị trà chát nhẹ.' },
  { id: 'dr-15', name: 'Nước Mơ Ngâm Lạnh Phố Cổ', note: 'Chua dịu đánh thức những ký ức mùa hè cũ.' },
  { id: 'dr-16', name: 'Trà Nhài Sữa Hạt Dẻ', note: 'Hương nhài đêm nở muộn thơm ngát.' },
];

export const INITIAL_POND_FISH: PondFishItem[] = [
  {
    id: 'f-1',
    name: 'Nguyệt Ảnh',
    species: 'Cá Chép Ánh Trăng',
    sizeLevel: 2,
    x: 24,
    y: 35,
    direction: 1,
  },
  {
    id: 'f-2',
    name: 'Khói Lam',
    species: 'Cá Koi Khói Bạc',
    sizeLevel: 3,
    x: 68,
    y: 62,
    direction: -1,
  },
  {
    id: 'f-3',
    name: 'Mơ Đào',
    species: 'Cá Vàng Đuôi Lụa',
    sizeLevel: 2,
    x: 45,
    y: 50,
    direction: 1,
  },
];

export const INITIAL_PARTNER_DIALOGUES: PartnerDialogueItem[] = [
  {
    id: 'dlg-1',
    text: '“Đêm còn dài, người đừng thức khuya quá sức nhé. Ta vẫn luôn ở đây canh đèn cho người.”',
    tier: 'low',
  },
  {
    id: 'dlg-2',
    text: '“Ngoài kia sương xuống dày rồi, nghe tiếng hộp nhạc cùng ta một lát có được không?”',
    tier: 'low',
  },
  {
    id: 'dlg-3',
    text: '“Từ ngày có người ở bên, góc nhỏ này chẳng còn vắng vẻ như trước nữa.”',
    tier: 'mid',
  },
  {
    id: 'dlg-4',
    text: '“Ta vừa cất riêng một cuốn sổ nhỏ hay lắm, đợi người rảnh tay sẽ đọc cho người nghe.”',
    tier: 'mid',
  },
  {
    id: 'dlg-5',
    text: '“[Thoại gắn bó sâu sắc] Dù ngoài kia vạn vật đổi dời, ngọn đèn ấm áp nơi góc nhỏ này vẫn chỉ đợi một mình bước chân người quay về.”',
    tier: 'high',
  },
  {
    id: 'dlg-6',
    text: '“[Thoại gắn bó sâu sắc] Đưa tay đây... Hơi ấm này là điều chân thật nhất mà ta giữ được giữa muôn vàn trang giấy.”',
    tier: 'high',
  },
];

export const INITIAL_FEEDBACKS: FeedbackItem[] = [
  {
    id: 'fb-1',
    targetType: 'web',
    targetId: 'web',
    targetName: 'Góc Nhỏ Lấp Lánh (Toàn trang)',
    authorId: 'usr-minh-anh',
    authorName: 'Minh Anh 🌸',
    isAnonymous: false,
    rating: 5,
    content:
      'Giao diện sổ tay pastel dịu mắt lắm luôn! Tiếng chuông hộp nhạc nhẹ nhàng, tối nào mình cũng ghé vào tưới hoa với ngắm cá bơi một lúc trước khi đi ngủ.',
    hearts: 24,
    isRead: true,
    replies: [
      {
        id: 'fbrep-1',
        authorName: 'Lam Vũ (Chủ web)',
        content: 'Cảm ơn Minh Anh nhiều nhé! Chúc bạn mỗi tối ghé góc nhỏ đều có những phút giây thật thư giãn 🌸',
        createdAt: '2026-10-18T21:30:00Z',
      },
    ],
    createdAt: '2026-10-18T20:15:00Z',
  },
  {
    id: 'fb-2',
    targetType: 'character',
    targetId: 'char-ta-khanh-inh',
    targetName: 'Tạ Khanh Trần',
    creatorId: 'creator-lam-vong',
    authorId: 'usr-anon-1',
    authorName: 'Một người bạn ẩn danh',
    isAnonymous: true,
    rating: 5,
    content:
      'Tạ Khanh Trần nói chuyện cực kỳ ôn nhu và sâu sắc. Cảm giác như đang ngồi uống trà sen trong Tàng Kinh Các thật sự vậy, cảm ơn Creator đã chăm chút từng câu thoại!',
    hearts: 19,
    isRead: false,
    replies: [],
    createdAt: '2026-10-19T02:10:00Z',
  },
  {
    id: 'fb-3',
    targetType: 'creator',
    targetId: 'creator-hien-suong',
    targetName: 'Hiên Sương',
    creatorId: 'creator-hien-suong',
    authorId: 'usr-linh-chi',
    authorName: 'Linh Chi ☕',
    isAnonymous: false,
    rating: 5,
    content:
      'Mình cực kỳ mê series nhân vật quán cà phê đêm của Hiên Sương. Nhân vật nào cũng gần gũi, ấm áp như một người bạn thân ngoài đời.',
    hearts: 15,
    isRead: true,
    replies: [
      {
        id: 'fbrep-2',
        authorName: 'Hiên Sương',
        content: 'Cảm ơn Linh Chi nha! Tuần tới mình sẽ ra mắt thêm một nhân vật tiệm bánh ngọt ca đêm nữa đó 🥐✨',
        createdAt: '2026-10-19T08:45:00Z',
      },
    ],
    createdAt: '2026-10-19T07:20:00Z',
  },
  {
    id: 'fb-4',
    targetType: 'character',
    targetId: 'char-vu-hoang-nam',
    targetName: 'Vũ Hoàng Nam',
    creatorId: 'creator-hien-suong',
    authorId: 'usr-hoang- yen',
    authorName: 'Hoàng Yến',
    isAnonymous: false,
    rating: 5,
    content:
      'Anh Nam pha cacao nóng đỉnh số một! Hôm qua mình buồn chuyện học tập vào tâm sự mà được an ủi dịu dàng quá chừng.',
    hearts: 12,
    isRead: false,
    replies: [],
    createdAt: '2026-10-19T10:05:00Z',
  },
];

const CREATORS_COLLECTION = 'creators';
const CHARACTERS_COLLECTION = 'characters';
const COMMISSIONS_COLLECTION = 'commissions';
const COMMISSION_ORDERS_COLLECTION = 'commission_orders';
const SHARED_PROMPTS_COLLECTION = 'shared_prompts';
const PERSONAL_PROMPTS_COLLECTION = 'personal_prompts';
const LOVE_MESSAGES_COLLECTION = 'love_messages';
const REQUESTS_COLLECTION = 'requests';
const GIVEAWAYS_COLLECTION = 'giveaways';
const DOCS_COLLECTION = 'docs';
const RESCUE_REPORTS_COLLECTION = 'rescue_reports';
const BACKUPS_COLLECTION = 'backups';
export const FEEDBACKS_COLLECTION = 'feedbacks';
export const FAQS_COLLECTION = 'faqs';
export const DRINKS_CATALOG_COLLECTION = 'minigame_drinks_catalog';
export const POND_FISH_COLLECTION = 'minigame_fish_list';
export const DIALOGUES_COLLECTION = 'minigame_dialogues';
const SEED_VERSION_KEY = 'seed_v4_loaded';

/**
 * Khởi tạo đầy đủ dữ liệu mẫu vào dataStore nếu chưa có
 */
export function ensureInitialLibraryData(): {
  creators: Creator[];
  characters: CharacterItem[];
} {
  const isSeeded = dataStore.get<boolean>(SEED_VERSION_KEY, false);
  let creators = dataStore.list<Creator>(CREATORS_COLLECTION);
  let characters = dataStore.list<CharacterItem>(CHARACTERS_COLLECTION);

  if (!isSeeded || creators.length === 0 || characters.length === 0) {
    if (creators.length === 0) {
      dataStore.set(`col_${CREATORS_COLLECTION}`, INITIAL_CREATORS, true);
      creators = INITIAL_CREATORS;
    }
    if (characters.length === 0) {
      dataStore.set(`col_${CHARACTERS_COLLECTION}`, INITIAL_CHARACTERS, true);
      characters = INITIAL_CHARACTERS;
    } else {
      // Đồng bộ trường isLocked & unlockRequirements cho dữ liệu cũ nếu có
      const syncedChars = characters.map((ch) => {
        const sampleMatch = INITIAL_CHARACTERS.find((s) => s.id === ch.id);
        return {
          ...sampleMatch,
          ...ch,
          isLocked:
            ch.isLocked !== undefined
              ? ch.isLocked
              : Boolean(sampleMatch?.isLocked || (ch.petalPrice && ch.petalPrice > 0)),
          unlockRequirements:
            ch.unlockRequirements && ch.unlockRequirements.length > 0
              ? ch.unlockRequirements
              : sampleMatch?.unlockRequirements || [],
          openScene: ch.openScene || sampleMatch?.openScene || ch.openingLine,
          creatorNote: ch.creatorNote || sampleMatch?.creatorNote || '',
        };
      });
      dataStore.set(`col_${CHARACTERS_COLLECTION}`, syncedChars, true);
      characters = syncedChars;
    }
    if (dataStore.list(COMMISSIONS_COLLECTION).length === 0) {
      dataStore.set(`col_${COMMISSIONS_COLLECTION}`, INITIAL_COMMISSIONS, true);
    }
    if (dataStore.list(COMMISSION_ORDERS_COLLECTION).length === 0) {
      dataStore.set(`col_${COMMISSION_ORDERS_COLLECTION}`, INITIAL_COMMISSION_ORDERS, true);
    }
    if (dataStore.list(SHARED_PROMPTS_COLLECTION).length === 0) {
      dataStore.set(`col_${SHARED_PROMPTS_COLLECTION}`, INITIAL_SHARED_PROMPTS, true);
    }
    if (dataStore.list(PERSONAL_PROMPTS_COLLECTION).length === 0) {
      dataStore.set(`col_${PERSONAL_PROMPTS_COLLECTION}`, INITIAL_PERSONAL_PROMPTS, true);
    }
    if (dataStore.list(LOVE_MESSAGES_COLLECTION).length === 0) {
      dataStore.set(`col_${LOVE_MESSAGES_COLLECTION}`, INITIAL_LOVE_MESSAGES, true);
    }
    if (dataStore.list(REQUESTS_COLLECTION).length === 0) {
      dataStore.set(`col_${REQUESTS_COLLECTION}`, INITIAL_REQUESTS, true);
    }
    if (dataStore.list(GIVEAWAYS_COLLECTION).length === 0) {
      dataStore.set(`col_${GIVEAWAYS_COLLECTION}`, INITIAL_GIVEAWAYS, true);
    }
    if (dataStore.list(DOCS_COLLECTION).length === 0) {
      dataStore.set(`col_${DOCS_COLLECTION}`, INITIAL_DOCS, true);
    }
    if (dataStore.list(RESCUE_REPORTS_COLLECTION).length === 0) {
      dataStore.set(`col_${RESCUE_REPORTS_COLLECTION}`, INITIAL_RESCUE_REPORTS, true);
    }
    if (dataStore.list(BACKUPS_COLLECTION).length === 0) {
      dataStore.set(`col_${BACKUPS_COLLECTION}`, INITIAL_BACKUPS, true);
    }
    if (dataStore.list(FEEDBACKS_COLLECTION).length === 0) {
      dataStore.set(`col_${FEEDBACKS_COLLECTION}`, INITIAL_FEEDBACKS, true);
    }
    if (dataStore.list(FAQS_COLLECTION).length === 0) {
      dataStore.set(`col_${FAQS_COLLECTION}`, INITIAL_FAQS, true);
    }
    if (dataStore.list(DRINKS_CATALOG_COLLECTION).length === 0) {
      dataStore.set(`col_${DRINKS_CATALOG_COLLECTION}`, INITIAL_DRINKS_CATALOG, true);
    }
    if (dataStore.list(POND_FISH_COLLECTION).length === 0) {
      dataStore.set(`col_${POND_FISH_COLLECTION}`, INITIAL_POND_FISH, true);
    }
    if (dataStore.list(DIALOGUES_COLLECTION).length === 0) {
      dataStore.set(`col_${DIALOGUES_COLLECTION}`, INITIAL_PARTNER_DIALOGUES, true);
    }
    dataStore.set(SEED_VERSION_KEY, true, true);
  }

  return { creators, characters };
}
