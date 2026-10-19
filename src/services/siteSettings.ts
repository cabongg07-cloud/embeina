/**
 * Quản lý Cấu hình Trang ("Cài đặt trang") & Văn bản Sửa trực tiếp cho "Góc Nhỏ Lấp Lánh".
 *
 * GHI CHÚ:
 * Toàn bộ cấu hình trang và văn bản sửa trực tiếp được lưu qua `dataStore` (localStorage bọc try/catch).
 * Hiện tại chỉnh sửa chỉ lưu trên trình duyệt của người sửa.
 */

import { dataStore } from './dataLayer';
import {
  APP_TITLE,
  THEMES,
  NAV_TABS,
  ThemeConfig,
  NavTab,
  ColorMode,
} from '../constants/themes';

export interface NavTabConfig extends NavTab {
  visible: boolean;
}

export interface SiteConfig {
  siteTitle: string;
  siteSlogan: string;
  gateGreeting: string;
  gateEnterMusicLabel: string;
  gateEnterSilentLabel: string;
  footerText: string;
  currencyName: string;
  currencyEmoji: string;
  tabs: NavTabConfig[];
  themes: ThemeConfig[];
  defaultColorMode: 'system' | ColorMode;
  sparkleEnabled: boolean;
  floatingParticlesEnabled: boolean;
  defaultMusicEnabled: boolean;
  musicUrls: string[];
  customTexts: Record<string, string>;
}

export const SITE_CONFIG_KEY = 'site_config_v1';

export function getDefaultSiteConfig(initialMusicUrls: string[] = []): SiteConfig {
  return {
    siteTitle: APP_TITLE,
    siteSlogan: '✨ Cuốn sổ tay nhân vật & câu chuyện nhỏ',
    gateGreeting:
      'Chào mừng bạn ghé thăm góc nhỏ đầy nắng ấm, hương trà thơm và những người bạn AI luôn sẵn sàng lắng nghe bạn mỗi ngày 🌸💌',
    gateEnterMusicLabel: '✨ Bước vào góc nhỏ',
    gateEnterSilentLabel: '🌸 Vào không nhạc',
    footerText:
      'Cảm ơn bạn đã ghé thăm — chúc bạn luôn có những cuộc trò chuyện thật vui và ấm áp!',
    currencyName: 'Cánh hoa',
    currencyEmoji: '🌸',
    tabs: NAV_TABS.map((t) => ({ ...t, visible: true })),
    themes: THEMES.map((t) => ({
      ...t,
      vars: { '--accent': t.accent },
    })),
    defaultColorMode: 'system',
    sparkleEnabled: true,
    floatingParticlesEnabled: true,
    defaultMusicEnabled: true,
    musicUrls: [...initialMusicUrls],
    customTexts: {},
  };
}

export function getSiteConfig(initialMusicUrls: string[] = []): SiteConfig {
  const defaults = getDefaultSiteConfig(initialMusicUrls);
  const saved = dataStore.get<Partial<SiteConfig> | null>(SITE_CONFIG_KEY, null);
  if (!saved || typeof saved !== 'object') {
    return defaults;
  }

  // Đồng bộ danh sách tab để đảm bảo đủ 12 tab ngay cả khi có cấu hình cũ
  const savedTabs = Array.isArray(saved.tabs) ? saved.tabs : [];
  const mergedTabs: NavTabConfig[] = [];
  const seenIds = new Set<string>();

  savedTabs.forEach((st) => {
    const base = NAV_TABS.find((n) => n.id === st.id);
    if (base) {
      mergedTabs.push({
        ...base,
        ...st,
        creatorOnly: base.creatorOnly,
        visible: st.visible !== undefined ? Boolean(st.visible) : true,
      });
      seenIds.add(st.id);
    }
  });

  NAV_TABS.forEach((base) => {
    if (!seenIds.has(base.id)) {
      mergedTabs.push({ ...base, visible: true });
    }
  });

  const savedThemes =
    Array.isArray(saved.themes) && saved.themes.length === 5
      ? saved.themes.map((t) => ({
          ...t,
          vars: { '--accent': t.accent },
        }))
      : defaults.themes;

  return {
    ...defaults,
    ...saved,
    tabs: mergedTabs,
    themes: savedThemes,
    musicUrls: Array.isArray(saved.musicUrls)
      ? saved.musicUrls
      : defaults.musicUrls,
    customTexts:
      saved.customTexts && typeof saved.customTexts === 'object'
        ? saved.customTexts
        : {},
  };
}

export function saveSiteConfig(
  patch: Partial<SiteConfig>,
  undoLabel = 'Cập nhật Cài đặt trang'
): SiteConfig {
  dataStore.pushUndoSnapshot(undoLabel);
  const current = getSiteConfig();
  const next: SiteConfig = {
    ...current,
    ...patch,
  };
  dataStore.set(SITE_CONFIG_KEY, next);
  return next;
}

export function updateCustomText(
  textKey: string,
  newValue: string,
  fallbackValue: string
): SiteConfig {
  const current = getSiteConfig();
  const clean = newValue.trim();
  const finalVal = clean.length > 0 ? clean : fallbackValue;
  if ((current.customTexts[textKey] ?? fallbackValue) === finalVal) {
    return current;
  }
  dataStore.pushUndoSnapshot('Sửa văn bản trực tiếp');
  const next: SiteConfig = {
    ...current,
    customTexts: {
      ...current.customTexts,
      [textKey]: finalVal,
    },
  };
  dataStore.set(SITE_CONFIG_KEY, next);
  return next;
}
