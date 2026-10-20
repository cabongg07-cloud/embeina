export const APP_TITLE = 'Góc Nhỏ Lấp Lánh';

export type ColorMode = 'light' | 'dark';

export interface ModePalette {
  '--bg': string;
  '--surface': string;
  '--border': string;
  '--text': string;
  '--muted': string;
}

export const MODE_PALETTES: Record<ColorMode, ModePalette> = {
  light: {
    '--bg': '#fbf6f1',
    '--surface': '#fffdfa',
    '--border': '#eadfd6',
    '--text': '#4a4046',
    '--muted': '#9a8c92',
  },
  dark: {
    '--bg': '#1f1b22',
    '--surface': '#2a252e',
    '--border': '#3a3440',
    '--text': '#efe6ea',
    '--muted': '#a99ca4',
  },
};

export interface ThemeConfig {
  id: string;
  name: string;
  emoji: string;
  description: string;
  accent: string;
  vars: {
    '--accent': string;
  };
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'hong-dao',
    name: 'Hồng đào',
    emoji: '🌸',
    description: 'Ngọt ngào như cánh hoa đào buổi sớm mai',
    accent: '#f4a3b0',
    vars: {
      '--accent': '#f4a3b0',
    },
  },
  {
    id: 'bac-ha',
    name: 'Bạc hà',
    emoji: '🌿',
    description: 'Mát lành như làn gió nhẹ qua ô cửa sổ',
    accent: '#8fcfbf',
    vars: {
      '--accent': '#8fcfbf',
    },
  },
  {
    id: 'oai-huong',
    name: 'Oải hương',
    emoji: '💜',
    description: 'Mộng mơ như bó hoa khô thơm dịu trên bàn học',
    accent: '#b8a6e0',
    vars: {
      '--accent': '#b8a6e0',
    },
  },
  {
    id: 'vang-bo',
    name: 'Vàng bơ',
    emoji: '🧈',
    description: 'Ấm áp như chiếc bánh nướng mới ra lò',
    accent: '#f2cf7a',
    vars: {
      '--accent': '#f2cf7a',
    },
  },
  {
    id: 'xanh-troi',
    name: 'Xanh trời',
    emoji: '☁️',
    description: 'Trong trẻo như đám mây bông lững lờ trôi',
    accent: '#9cc7ee',
    vars: {
      '--accent': '#9cc7ee',
    },
  },
];

export interface NavTab {
  id: string;
  label: string;
  emoji: string;
  whisper: string;
  creatorOnly?: boolean; // Chỉ hiện với vai Chủ web (Commission, Request, Kho lệnh)
}

export const NAV_TABS: NavTab[] = [
  {
    id: 'char',
    label: 'Char',
    emoji: '✨',
    whisper: 'Lật mở cuốn sổ nhỏ tìm kiếm nhân vật theo tên và lọc kết hợp nhiều tag yêu thích.',
  },
  {
    id: 'mini-game',
    label: 'Mini game',
    emoji: '🐟',
    whisper: 'Gacha vật phẩm, trồng hoa, nuôi cá, chăm thú cưng ở phòng tri kỷ và pha chế thức uống.',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    emoji: '💬',
    whisper: 'Gửi đánh giá 5 sao và lời nhắn yêu thương đến Web hoặc các nhân vật AI.',
  },
  {
    id: 'nhac',
    label: 'Nhạc',
    emoji: '🎵',
    whisper: 'Góc đĩa than, hộp nhạc dịu êm và Playlist cho phép dán link MP3 hoặc tải file từ máy lên.',
  },
  {
    id: 'lenh',
    label: 'Lệnh',
    emoji: '🪄',
    whisper: 'Những câu thần chú nhỏ giúp cuộc trò chuyện thêm tự nhiên và cuốn hút.',
  },
  {
    id: 'goc-yeu-thuong',
    label: 'Góc yêu thương',
    emoji: '💌',
    whisper: 'Tường thư tay và đèn lồng pastel gửi trao ngàn lời nhắn nhủ ngọt ngào.',
  },
  {
    id: 'giveaway',
    label: 'Giveaway',
    emoji: '🎁',
    whisper: 'Những món quà xinh xắn đang chờ tìm được chủ nhân may mắn.',
  },
  {
    id: 'xep-hang',
    label: 'Xếp hạng',
    emoji: '👑',
    whisper: 'Những gương mặt được yêu mến và thả tim nhiều nhất trong sổ tay.',
  },
  {
    id: 'kho-docs',
    label: 'Kho Docs',
    emoji: '📒',
    whisper: 'Sổ tay ghi chép hướng dẫn, mẹo chat và những trang bản thảo xinh xắn.',
  },
  {
    id: 'tram-cuu-ho',
    label: 'Trạm cứu hộ',
    emoji: '🛟',
    whisper: 'Nơi giúp bạn tìm lại nhân vật thất lạc hoặc cất giữ bản sao an toàn.',
  },
  {
    id: 'commission',
    label: 'Commission',
    emoji: '🎀',
    whisper: 'Bảng quản lý giá và trạng thái đơn Commission dành cho Chủ web.',
    creatorOnly: true,
  },
  {
    id: 'request',
    label: 'Request',
    emoji: '📮',
    whisper: 'Hộp thư tiếp nhận và trả lời ý tưởng nhân vật dành cho Chủ web.',
    creatorOnly: true,
  },
  {
    id: 'kho-lenh',
    label: 'Kho lệnh',
    emoji: '🔖',
    whisper: 'Ngăn kéo riêng cất giữ những mẫu câu lệnh yêu thích của Chủ web.',
    creatorOnly: true,
  },
];

