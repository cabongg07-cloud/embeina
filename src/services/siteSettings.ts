/**
 * Quản lý Cấu hình Trang ("Cài đặt trang") & Nội dung chỉnh sửa trực tiếp trên SUPABASE (`site_settings`).
 *
 * GHI CHÚ QUAN TRỌNG:
 * - Đã chuyển toàn bộ "chỉnh sửa trang" từ localStorage sang bảng `site_settings` (key text, value jsonb) trên Supabase.
 * - Khi mở web, MỌI người (kể cả Khách) đều đọc từ `site_settings` để hiển thị đúng bản mới nhất.
 * - Tuyệt đối KHÔNG đọc nội dung hiển thị của trang từ localStorage nữa.
 * - Chỉ vai `owner` mới có quyền ghi (upsert) vào `site_settings`, mỗi nhóm một key:
 *   + "texts": tên web, slogan, lời ở cổng, tên đơn vị tiền, văn bản sửa trực tiếp (customTexts)
 *   + "tabs": tên tab, ẩn/hiện và thứ tự tab
 *   + "theme": bộ 5 màu nhấn, chế độ sáng/tối mặc định, hiệu ứng hạt lấp lánh
 *   + "custom_tags": danh sách tag tùy chỉnh của sổ tay
 *   + "web_playlist": danh sách link nhạc MP3 của playlist web (chỉ lưu link mp3, không lưu file tải từ máy)
 *   + "faqs": danh sách câu hỏi thường gặp (FAQ)
 *   + "presets": nội dung đăng sẵn (câu thoại Phòng tri kỷ, Giveaway, Góc yêu thương, Kho Docs, Trạm cứu hộ)
 */

import { supabase } from '../config/supabaseConfig';
import {
  APP_TITLE,
  THEMES,
  NAV_TABS,
  ThemeConfig,
  NavTab,
  ColorMode,
} from '../constants/themes';
import {
  FaqItem,
  PartnerDialogueItem,
  GiveawayItem,
  LoveMessage,
  DocItem,
  RescueReport,
  BackupEntry,
  INITIAL_FAQS,
  INITIAL_PARTNER_DIALOGUES,
  INITIAL_GIVEAWAYS,
  INITIAL_LOVE_MESSAGES,
  INITIAL_DOCS,
  INITIAL_RESCUE_REPORTS,
  INITIAL_BACKUPS,
} from '../data/sampleData';
import {
  MusicTrack,
  BUILTIN_SYNTH_TRACKS,
  inferTitleFromUrl,
} from './musicService';

export type SiteSettingsKey =
  | 'texts'
  | 'tabs'
  | 'theme'
  | 'custom_tags'
  | 'web_playlist'
  | 'faqs'
  | 'presets';

export interface NavTabConfig extends NavTab {
  visible: boolean;
}

export interface SitePresetsConfig {
  dialogues: PartnerDialogueItem[];
  giveaways: GiveawayItem[];
  loveMessages: LoveMessage[];
  docs: DocItem[];
  rescueReports: RescueReport[];
  backups: BackupEntry[];
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
  webPlaylistTracks: MusicTrack[];
  customTags: string[];
  faqs: FaqItem[];
  presets: SitePresetsConfig;
  customTexts: Record<string, string>;
}

export const SITE_CONFIG_KEY = 'site_settings_supabase_v1';

export function buildWebTracksFromUrls(
  urls: string[],
  existingTracks: MusicTrack[] = []
): MusicTrack[] {
  // Chỉ giữ lại các bài từ link MP3 ('url') hoặc hộp nhạc mặc định ('builtin-synth')
  // Tuyệt đối không lưu bài tải từ máy ('indexeddb') vào playlist web trên Supabase
  const validTracks = existingTracks.filter(
    (t) => t.sourceType === 'url' || t.sourceType === 'builtin-synth'
  );

  const baseList: MusicTrack[] =
    validTracks.length > 0 ? [...validTracks] : [...BUILTIN_SYNTH_TRACKS];

  const existingUrlSet = new Set(
    baseList.filter((t) => t.sourceType === 'url' && t.url).map((t) => t.url!)
  );
  const existingIdSet = new Set(baseList.map((t) => t.id));

  urls.forEach((rawUrl, index) => {
    const clean = rawUrl.trim();
    if (clean && !existingUrlSet.has(clean)) {
      const id = `web-url-${index}-${clean.slice(-10).replace(/[^a-zA-Z0-9]/g, '')}`;
      if (!existingIdSet.has(id)) {
        baseList.unshift({
          id,
          title: inferTitleFromUrl(clean),
          artist: 'Playlist của Web 🎵',
          sourceType: 'url',
          url: clean,
          isWebTrack: true,
          createdAt: new Date().toISOString(),
        });
        existingUrlSet.add(clean);
        existingIdSet.add(id);
      }
    }
  });

  return baseList;
}

export function getDefaultSiteConfig(initialMusicUrls: string[] = []): SiteConfig {
  const cleanUrls = initialMusicUrls.map((u) => u.trim()).filter(Boolean);
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
    musicUrls: cleanUrls,
    webPlaylistTracks: buildWebTracksFromUrls(cleanUrls, BUILTIN_SYNTH_TRACKS),
    customTags: [],
    faqs: [...INITIAL_FAQS],
    presets: {
      dialogues: [...INITIAL_PARTNER_DIALOGUES],
      giveaways: [...INITIAL_GIVEAWAYS],
      loveMessages: [...INITIAL_LOVE_MESSAGES],
      docs: [...INITIAL_DOCS],
      rescueReports: [...INITIAL_RESCUE_REPORTS],
      backups: [...INITIAL_BACKUPS],
    },
    customTexts: {},
  };
}

// ============================================================================
// BỘ NHỚ TRONG PHIÊN (IN-MEMORY STATE) — ĐỌC TỪ SUPABASE SITE_SETTINGS, KHÔNG DÙNG LOCALSTORAGE
// ============================================================================
let currentSiteConfigState: SiteConfig = getDefaultSiteConfig();

interface UndoEntry {
  label: string;
  snapshot: SiteConfig;
}

const undoStack: UndoEntry[] = [];
const MAX_UNDO_STEPS = 25;

type SiteSettingsListener = (config: SiteConfig) => void;
const listeners = new Set<SiteSettingsListener>();

function notifySiteSettingsListeners() {
  listeners.forEach((cb) => {
    try {
      cb(currentSiteConfigState);
    } catch {
      // Ignore listener error
    }
  });
}

export function onSiteSettingsChange(cb: SiteSettingsListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSiteSettingsUndoCount(): number {
  return undoStack.length;
}

export function getSiteSettingsLastUndoLabel(): string | null {
  return undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null;
}

function pushUndoSnapshot(label: string) {
  try {
    const clone = JSON.parse(JSON.stringify(currentSiteConfigState)) as SiteConfig;
    undoStack.push({ label, snapshot: clone });
    if (undoStack.length > MAX_UNDO_STEPS) {
      undoStack.shift();
    }
  } catch {
    // Ignore clone error
  }
}

function normalizeMergedTabs(rawTabs: unknown): NavTabConfig[] {
  const savedTabs = Array.isArray(rawTabs) ? (rawTabs as Partial<NavTabConfig>[]) : [];
  const mergedTabs: NavTabConfig[] = [];
  const seenIds = new Set<string>();

  savedTabs.forEach((st) => {
    if (!st || !st.id) return;
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

  return mergedTabs;
}

function normalizeThemes(rawThemes: unknown, defaults: ThemeConfig[]): ThemeConfig[] {
  if (Array.isArray(rawThemes) && rawThemes.length === 5) {
    return (rawThemes as ThemeConfig[]).map((t, idx) => {
      const fallback = defaults[idx] || defaults[0];
      const accent = t?.accent || fallback.accent;
      return {
        ...fallback,
        ...t,
        accent,
        vars: { '--accent': accent },
      };
    });
  }
  return defaults;
}

/**
 * Lấy cấu hình hiện tại đang giữ trong bộ nhớ (đã đồng bộ từ bảng `site_settings` của Supabase)
 */
export function getSiteConfig(initialMusicUrls: string[] = []): SiteConfig {
  if (
    initialMusicUrls.length > 0 &&
    currentSiteConfigState.musicUrls.length === 0
  ) {
    const mergedUrls = Array.from(
      new Set([...initialMusicUrls, ...currentSiteConfigState.musicUrls])
    );
    currentSiteConfigState = {
      ...currentSiteConfigState,
      musicUrls: mergedUrls,
      webPlaylistTracks: buildWebTracksFromUrls(
        mergedUrls,
        currentSiteConfigState.webPlaylistTracks
      ),
    };
  }
  return currentSiteConfigState;
}

/**
 * Đọc toàn bộ các dòng trong bảng `site_settings` từ Supabase khi mở trang.
 * Mọi người (kể cả Khách) đều gọi hàm này để hiển thị đúng bản mới nhất.
 */
export async function fetchSiteSettingsFromSupabase(
  initialMusicUrls: string[] = []
): Promise<SiteConfig> {
  const defaults = getDefaultSiteConfig(initialMusicUrls);

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (error || !Array.isArray(data)) {
      currentSiteConfigState = defaults;
      notifySiteSettingsListeners();
      return currentSiteConfigState;
    }

    const rowMap = new Map<string, Record<string, unknown>>();
    data.forEach((row: { key: string; value: unknown }) => {
      if (row && typeof row.key === 'string' && row.value && typeof row.value === 'object') {
        rowMap.set(row.key, row.value as Record<string, unknown>);
      }
    });

    const textsVal = rowMap.get('texts') || {};
    const tabsVal = rowMap.get('tabs') || {};
    const themeVal = rowMap.get('theme') || {};
    const customTagsVal = rowMap.get('custom_tags') || {};
    const webPlaylistVal = rowMap.get('web_playlist') || {};
    const faqsVal = rowMap.get('faqs') || {};
    const presetsVal = rowMap.get('presets') || {};

    const rawMusicUrls = Array.isArray(webPlaylistVal.musicUrls)
      ? (webPlaylistVal.musicUrls as string[]).map((u) => String(u).trim()).filter(Boolean)
      : defaults.musicUrls;

    const combinedUrls = Array.from(new Set([...initialMusicUrls, ...rawMusicUrls]));

    const rawWebTracks = Array.isArray(webPlaylistVal.tracks)
      ? (webPlaylistVal.tracks as MusicTrack[]).filter(
          (t) =>
            t &&
            (t.sourceType === 'url' || t.sourceType === 'builtin-synth')
        )
      : [];

    const webPlaylistTracks = buildWebTracksFromUrls(
      combinedUrls,
      rawWebTracks.length > 0 ? rawWebTracks : BUILTIN_SYNTH_TRACKS
    );

    const nextConfig: SiteConfig = {
      siteTitle:
        typeof textsVal.siteTitle === 'string' && textsVal.siteTitle.trim()
          ? textsVal.siteTitle
          : defaults.siteTitle,
      siteSlogan:
        typeof textsVal.siteSlogan === 'string' && textsVal.siteSlogan.trim()
          ? textsVal.siteSlogan
          : defaults.siteSlogan,
      gateGreeting:
        typeof textsVal.gateGreeting === 'string' && textsVal.gateGreeting.trim()
          ? textsVal.gateGreeting
          : defaults.gateGreeting,
      gateEnterMusicLabel:
        typeof textsVal.gateEnterMusicLabel === 'string' &&
        textsVal.gateEnterMusicLabel.trim()
          ? textsVal.gateEnterMusicLabel
          : defaults.gateEnterMusicLabel,
      gateEnterSilentLabel:
        typeof textsVal.gateEnterSilentLabel === 'string' &&
        textsVal.gateEnterSilentLabel.trim()
          ? textsVal.gateEnterSilentLabel
          : defaults.gateEnterSilentLabel,
      footerText:
        typeof textsVal.footerText === 'string' && textsVal.footerText.trim()
          ? textsVal.footerText
          : defaults.footerText,
      currencyName:
        typeof textsVal.currencyName === 'string' && textsVal.currencyName.trim()
          ? textsVal.currencyName
          : defaults.currencyName,
      currencyEmoji:
        typeof textsVal.currencyEmoji === 'string' && textsVal.currencyEmoji.trim()
          ? textsVal.currencyEmoji
          : defaults.currencyEmoji,
      customTexts:
        textsVal.customTexts && typeof textsVal.customTexts === 'object'
          ? (textsVal.customTexts as Record<string, string>)
          : {},
      tabs: normalizeMergedTabs(tabsVal.tabs),
      themes: normalizeThemes(themeVal.themes, defaults.themes),
      defaultColorMode:
        themeVal.defaultColorMode === 'light' ||
        themeVal.defaultColorMode === 'dark' ||
        themeVal.defaultColorMode === 'system'
          ? themeVal.defaultColorMode
          : defaults.defaultColorMode,
      sparkleEnabled:
        themeVal.sparkleEnabled !== undefined
          ? Boolean(themeVal.sparkleEnabled)
          : defaults.sparkleEnabled,
      floatingParticlesEnabled:
        themeVal.floatingParticlesEnabled !== undefined
          ? Boolean(themeVal.floatingParticlesEnabled)
          : defaults.floatingParticlesEnabled,
      defaultMusicEnabled:
        themeVal.defaultMusicEnabled !== undefined
          ? Boolean(themeVal.defaultMusicEnabled)
          : defaults.defaultMusicEnabled,
      musicUrls: combinedUrls,
      webPlaylistTracks,
      customTags: Array.isArray(customTagsVal.tags)
        ? (customTagsVal.tags as string[]).map((t) => String(t).trim()).filter(Boolean)
        : [],
      faqs:
        Array.isArray(faqsVal.items) && faqsVal.items.length > 0
          ? (faqsVal.items as FaqItem[])
          : defaults.faqs,
      presets: {
        dialogues:
          Array.isArray(presetsVal.dialogues) && presetsVal.dialogues.length > 0
            ? (presetsVal.dialogues as PartnerDialogueItem[])
            : defaults.presets.dialogues,
        giveaways:
          Array.isArray(presetsVal.giveaways) && presetsVal.giveaways.length > 0
            ? (presetsVal.giveaways as GiveawayItem[])
            : defaults.presets.giveaways,
        loveMessages:
          Array.isArray(presetsVal.loveMessages) &&
          presetsVal.loveMessages.length > 0
            ? (presetsVal.loveMessages as LoveMessage[])
            : defaults.presets.loveMessages,
        docs:
          Array.isArray(presetsVal.docs) && presetsVal.docs.length > 0
            ? (presetsVal.docs as DocItem[])
            : defaults.presets.docs,
        rescueReports:
          Array.isArray(presetsVal.rescueReports) &&
          presetsVal.rescueReports.length > 0
            ? (presetsVal.rescueReports as RescueReport[])
            : defaults.presets.rescueReports,
        backups:
          Array.isArray(presetsVal.backups) && presetsVal.backups.length > 0
            ? (presetsVal.backups as BackupEntry[])
            : defaults.presets.backups,
      },
    };

    currentSiteConfigState = nextConfig;
    notifySiteSettingsListeners();
    return currentSiteConfigState;
  } catch {
    currentSiteConfigState = defaults;
    notifySiteSettingsListeners();
    return currentSiteConfigState;
  }
}

/**
 * Tách một `SiteConfig` thành các nhóm key tương ứng để upsert vào bảng `site_settings`.
 */
function buildSiteSettingsPayloadForKeys(
  cfg: SiteConfig,
  keys: SiteSettingsKey[]
): { key: SiteSettingsKey; value: Record<string, unknown> }[] {
  const rows: { key: SiteSettingsKey; value: Record<string, unknown> }[] = [];

  keys.forEach((key) => {
    if (key === 'texts') {
      rows.push({
        key: 'texts',
        value: {
          siteTitle: cfg.siteTitle,
          siteSlogan: cfg.siteSlogan,
          gateGreeting: cfg.gateGreeting,
          gateEnterMusicLabel: cfg.gateEnterMusicLabel,
          gateEnterSilentLabel: cfg.gateEnterSilentLabel,
          footerText: cfg.footerText,
          currencyName: cfg.currencyName,
          currencyEmoji: cfg.currencyEmoji,
          customTexts: cfg.customTexts,
        },
      });
    } else if (key === 'tabs') {
      rows.push({
        key: 'tabs',
        value: {
          tabs: cfg.tabs,
        },
      });
    } else if (key === 'theme') {
      rows.push({
        key: 'theme',
        value: {
          themes: cfg.themes,
          defaultColorMode: cfg.defaultColorMode,
          sparkleEnabled: cfg.sparkleEnabled,
          floatingParticlesEnabled: cfg.floatingParticlesEnabled,
          defaultMusicEnabled: cfg.defaultMusicEnabled,
        },
      });
    } else if (key === 'custom_tags') {
      rows.push({
        key: 'custom_tags',
        value: {
          tags: cfg.customTags,
        },
      });
    } else if (key === 'web_playlist') {
      // Chỉ lưu các bài nhạc URL mp3 trực tiếp hoặc hộp nhạc mặc định, tuyệt đối không lưu file tải từ máy
      const cleanWebTracks = cfg.webPlaylistTracks.filter(
        (t) => t.sourceType === 'url' || t.sourceType === 'builtin-synth'
      );
      const urlListFromTracks = cleanWebTracks
        .filter((t) => t.sourceType === 'url' && t.url)
        .map((t) => t.url!.trim())
        .filter(Boolean);
      const mergedMusicUrls = Array.from(
        new Set([...cfg.musicUrls, ...urlListFromTracks])
      );
      rows.push({
        key: 'web_playlist',
        value: {
          musicUrls: mergedMusicUrls,
          tracks: cleanWebTracks,
        },
      });
    } else if (key === 'faqs') {
      rows.push({
        key: 'faqs',
        value: {
          items: cfg.faqs,
        },
      });
    } else if (key === 'presets') {
      rows.push({
        key: 'presets',
        value: {
          dialogues: cfg.presets.dialogues,
          giveaways: cfg.presets.giveaways,
          loveMessages: cfg.presets.loveMessages,
          docs: cfg.presets.docs,
          rescueReports: cfg.presets.rescueReports,
          backups: cfg.presets.backups,
        },
      });
    }
  });

  return rows;
}

/**
 * Xác định những key nào trong `site_settings` bị thay đổi bởi `patch`
 */
function detectChangedKeys(patch: Partial<SiteConfig>): SiteSettingsKey[] {
  const keys = new Set<SiteSettingsKey>();

  if (
    'siteTitle' in patch ||
    'siteSlogan' in patch ||
    'gateGreeting' in patch ||
    'gateEnterMusicLabel' in patch ||
    'gateEnterSilentLabel' in patch ||
    'footerText' in patch ||
    'currencyName' in patch ||
    'currencyEmoji' in patch ||
    'customTexts' in patch
  ) {
    keys.add('texts');
  }

  if ('tabs' in patch) {
    keys.add('tabs');
  }

  if (
    'themes' in patch ||
    'defaultColorMode' in patch ||
    'sparkleEnabled' in patch ||
    'floatingParticlesEnabled' in patch ||
    'defaultMusicEnabled' in patch
  ) {
    keys.add('theme');
  }

  if ('customTags' in patch) {
    keys.add('custom_tags');
  }

  if ('musicUrls' in patch || 'webPlaylistTracks' in patch) {
    keys.add('web_playlist');
  }

  if ('faqs' in patch) {
    keys.add('faqs');
  }

  if ('presets' in patch) {
    keys.add('presets');
  }

  return Array.from(keys);
}

/**
 * Ghi (upsert) một hoặc nhiều nhóm cài đặt vào bảng `site_settings` trên Supabase.
 * Chỉ vai `owner` mới được phép ghi (RLS trên Supabase sẽ kiểm tra).
 */
export async function upsertSiteSettingsOnSupabase(
  patch: Partial<SiteConfig>,
  undoLabel = 'Cập nhật Cài đặt trang'
): Promise<{
  ok: boolean;
  config: SiteConfig;
  message: string;
}> {
  pushUndoSnapshot(undoLabel);

  const prevConfig = currentSiteConfigState;
  let nextWebTracks = patch.webPlaylistTracks ?? prevConfig.webPlaylistTracks;
  let nextMusicUrls = patch.musicUrls ?? prevConfig.musicUrls;

  if (patch.musicUrls && !patch.webPlaylistTracks) {
    // Đồng bộ danh sách bài hát của playlist web khi sửa musicUrls ở Cài đặt trang
    const keptTracks = prevConfig.webPlaylistTracks.filter(
      (t) =>
        t.sourceType === 'builtin-synth' ||
        (t.sourceType === 'url' && t.url && patch.musicUrls!.includes(t.url))
    );
    nextWebTracks = buildWebTracksFromUrls(patch.musicUrls, keptTracks);
  } else if (patch.webPlaylistTracks) {
    nextWebTracks = patch.webPlaylistTracks.filter(
      (t) => t.sourceType === 'url' || t.sourceType === 'builtin-synth'
    );
    nextMusicUrls = Array.from(
      new Set(
        nextWebTracks
          .filter((t) => t.sourceType === 'url' && t.url)
          .map((t) => t.url!.trim())
          .filter(Boolean)
      )
    );
  }

  const nextConfig: SiteConfig = {
    ...prevConfig,
    ...patch,
    musicUrls: nextMusicUrls,
    webPlaylistTracks: nextWebTracks,
    presets: patch.presets
      ? {
          ...prevConfig.presets,
          ...patch.presets,
        }
      : prevConfig.presets,
  };

  currentSiteConfigState = nextConfig;
  notifySiteSettingsListeners();

  const changedKeys = detectChangedKeys(patch);
  if (changedKeys.length === 0) {
    return {
      ok: true,
      config: nextConfig,
      message: 'Đã lưu',
    };
  }

  const rows = buildSiteSettingsPayloadForKeys(nextConfig, changedKeys);

  try {
    const { error } = await supabase
      .from('site_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      return {
        ok: false,
        config: nextConfig,
        message: `Lỗi lưu cài đặt lên Supabase: ${error.message || 'Chỉ Chủ web (owner) mới có quyền lưu cài đặt trang.'}`,
      };
    }

    return {
      ok: true,
      config: nextConfig,
      message: 'Đã lưu',
    };
  } catch (err) {
    return {
      ok: false,
      config: nextConfig,
      message:
        err instanceof Error
          ? `Lỗi lưu cài đặt: ${err.message}`
          : 'Không thể kết nối tới bảng site_settings trên Supabase.',
    };
  }
}

/**
 * Hàm tương thích đồng bộ trả về state ngay và gọi upsert ngầm (kèm callback kết quả)
 */
export function saveSiteConfig(
  patch: Partial<SiteConfig>,
  undoLabel = 'Cập nhật Cài đặt trang',
  onResult?: (res: { ok: boolean; message: string }) => void
): SiteConfig {
  upsertSiteSettingsOnSupabase(patch, undoLabel).then((res) => {
    if (onResult) onResult({ ok: res.ok, message: res.message });
  });
  return currentSiteConfigState;
}

/**
 * Cập nhật văn bản sửa trực tiếp (EditableText) và upsert vào key `"texts"` của `site_settings`
 */
export function updateCustomText(
  textKey: string,
  newValue: string,
  fallbackValue: string,
  onResult?: (res: { ok: boolean; message: string }) => void
): SiteConfig {
  const current = getSiteConfig();
  const clean = newValue.trim();
  const finalVal = clean.length > 0 ? clean : fallbackValue;
  if ((current.customTexts[textKey] ?? fallbackValue) === finalVal) {
    return current;
  }

  const nextCustomTexts = {
    ...current.customTexts,
    [textKey]: finalVal,
  };

  upsertSiteSettingsOnSupabase(
    { customTexts: nextCustomTexts },
    'Sửa văn bản trực tiếp'
  ).then((res) => {
    if (onResult) onResult({ ok: res.ok, message: res.message });
  });

  return currentSiteConfigState;
}

/**
 * Hoàn tác (Undo) thao tác chỉnh sửa trang gần nhất và lưu lại lên `site_settings`
 */
export async function undoSiteSettingsOnSupabase(): Promise<{
  ok: boolean;
  label: string | null;
  config: SiteConfig;
  message: string;
}> {
  if (undoStack.length === 0) {
    return {
      ok: false,
      label: null,
      config: currentSiteConfigState,
      message: 'Chưa có thao tác nào để hoàn tác.',
    };
  }

  const popped = undoStack.pop()!;
  currentSiteConfigState = popped.snapshot;
  notifySiteSettingsListeners();

  const allKeys: SiteSettingsKey[] = [
    'texts',
    'tabs',
    'theme',
    'custom_tags',
    'web_playlist',
    'faqs',
    'presets',
  ];
  const rows = buildSiteSettingsPayloadForKeys(currentSiteConfigState, allKeys);

  try {
    const { error } = await supabase
      .from('site_settings')
      .upsert(rows, { onConflict: 'key' });
    if (error) {
      return {
        ok: false,
        label: popped.label,
        config: currentSiteConfigState,
        message: `Không thể lưu hoàn tác lên Supabase: ${error.message}`,
      };
    }
    return {
      ok: true,
      label: popped.label,
      config: currentSiteConfigState,
      message: `Đã lưu (Hoàn tác: ${popped.label})`,
    };
  } catch (err) {
    return {
      ok: false,
      label: popped.label,
      config: currentSiteConfigState,
      message:
        err instanceof Error
          ? err.message
          : 'Lỗi khi lưu hoàn tác lên site_settings.',
    };
  }
}

/**
 * Khôi phục mặc định toàn bộ cấu hình trang và ghi đè lên `site_settings`
 */
export async function resetSiteSettingsToDefaultsOnSupabase(
  initialMusicUrls: string[] = []
): Promise<{
  ok: boolean;
  config: SiteConfig;
  message: string;
}> {
  pushUndoSnapshot('Khôi phục mặc định');
  const defaults = getDefaultSiteConfig(initialMusicUrls);
  currentSiteConfigState = defaults;
  notifySiteSettingsListeners();

  const allKeys: SiteSettingsKey[] = [
    'texts',
    'tabs',
    'theme',
    'custom_tags',
    'web_playlist',
    'faqs',
    'presets',
  ];
  const rows = buildSiteSettingsPayloadForKeys(defaults, allKeys);

  try {
    const { error } = await supabase
      .from('site_settings')
      .upsert(rows, { onConflict: 'key' });
    if (error) {
      return {
        ok: false,
        config: defaults,
        message: `Không thể khôi phục mặc định trên Supabase: ${error.message}`,
      };
    }
    return {
      ok: true,
      config: defaults,
      message: 'Đã lưu (Khôi phục mặc định trên Supabase)',
    };
  } catch (err) {
    return {
      ok: false,
      config: defaults,
      message:
        err instanceof Error
          ? err.message
          : 'Lỗi khi khôi phục mặc định trên site_settings.',
    };
  }
}
