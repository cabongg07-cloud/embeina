/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Hằng số để điền các đường dẫn file .mp3 mặc định trong code (ngoài ra Chủ web có thể thêm/xóa trực tiếp trong bảng "Cài đặt trang" lưu lên site_settings của Supabase):
export const MUSIC_URLS: string[] = [];

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Download,
  Upload,
  LogOut,
  LogIn,
  Lock,
  Crown,
} from 'lucide-react';
import {
  THEMES,
  MODE_PALETTES,
  ColorMode,
  ThemeConfig,
} from './constants/themes';
import { dataStore } from './services/dataLayer';
import {
  authService,
  AuthUser,
  can,
  canEditItem,
} from './services/authLayer';
import {
  SiteConfig,
  getSiteConfig,
  fetchSiteSettingsFromSupabase,
  upsertSiteSettingsOnSupabase,
  updateCustomText,
  undoSiteSettingsOnSupabase,
  resetSiteSettingsToDefaultsOnSupabase,
  getSiteSettingsUndoCount,
  getSiteSettingsLastUndoLabel,
  onSiteSettingsChange,
} from './services/siteSettings';
import {
  fetchCharsAndCreatorsFromSupabase,
  createCharOnSupabase,
  updateCharOnSupabase,
  deleteCharOnSupabase,
  fetchInventoryFromSupabase,
  fetchUnlockedCharIdsFromSupabase,
  SupabaseInventoryItem,
  logGameActionViaRpc,
  claimWelcomeGiftViaRpc,
  ownerRefillViaRpc,
} from './services/supabaseService';
import { SparkleCanvas } from './components/SparkleCanvas';
import { GateOverlay } from './components/GateOverlay';
import { AuthModal } from './components/AuthModal';
import { EditableText } from './components/EditableText';
import { EditModeSystem } from './components/EditModeSystem';
import {
  Creator,
  CharacterItem,
  UserRole,
} from './data/sampleData';
import { CharTab } from './components/CharTab';
import { FeedbackTab } from './components/FeedbackTab';
import { CommissionTab } from './components/CommissionTab';
import {
  SharedPromptsTab,
  PersonalPromptVaultTab,
} from './components/PromptsTabs';
import { LoveCornerTab, RequestTab } from './components/CommunityTabs';
import {
  GiveawayTab,
  RankingTab,
} from './components/GiveawayAndRankingTabs';
import { MiniGameTab } from './components/MiniGameTab';
import { DocsVaultTab } from './components/DocsVaultTab';
import { RescueStationTab } from './components/RescueStationTab';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import {
  CornerMusicWidget,
  MusicTab,
} from './components/MusicPlayerAndTab';
import {
  MusicTrack,
  PlayMode,
  BUILTIN_SYNTH_TRACKS,
  getSavedPlaylist,
  savePlaylist,
  getSavedPlayerState,
  savePlayerState,
  musicIdbStorage,
} from './services/musicService';

// GHI CHÚ: Chỉ giữ localStorage cho sở thích riêng từng người (sáng/tối, âm lượng, màu nhấn đã chọn, ghi chú/yêu thích cá nhân)
const THEME_STORAGE_KEY = 'selected_theme_id';
const COLOR_MODE_STORAGE_KEY = 'selected_color_mode';
const VOLUME_STORAGE_KEY = 'ambient_volume';
const FAVORITES_STORAGE_KEY = 'favorite_char_ids';
const NOTES_STORAGE_KEY = 'personal_char_notes';
const PETALS_STORAGE_KEY = 'petals_balance';
const LAST_DAILY_VISIT_KEY = 'last_daily_visit_date';
const EDIT_GUIDE_SEEN_KEY = 'edit_mode_guide_seen_v1';

interface WebAudioSynthNodes {
  ctx: AudioContext;
  masterGain: GainNode;
  cleanup: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  guest: 'Khách',
  user: 'Người dùng',
  creator: 'Chủ web',
};

function getInitialColorMode(defaultModeSetting?: ColorMode | 'system'): ColorMode {
  try {
    const saved = dataStore.get<string | null>(COLOR_MODE_STORAGE_KEY, null);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (defaultModeSetting === 'light' || defaultModeSetting === 'dark') {
      return defaultModeSetting;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  // Cấu hình toàn trang ("Cài đặt trang") đọc trực tiếp từ bảng `site_settings` trên Supabase cho MỌI người (kể cả Khách).
  // Tuyệt đối không đọc nội dung hiển thị từ localStorage nữa.
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() =>
    getSiteConfig(MUSIC_URLS)
  );

  // Khởi tạo màu nhấn (5 màu pastel từ siteConfig.themes; sở thích chọn màu của từng người lưu ở localStorage)
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    const initialCfg = getSiteConfig(MUSIC_URLS);
    const saved = dataStore.get<string>(
      THEME_STORAGE_KEY,
      initialCfg.themes[0]?.id || THEMES[0].id
    );
    return initialCfg.themes.some((t) => t.id === saved)
      ? saved
      : initialCfg.themes[0]?.id || THEMES[0].id;
  });

  // Khởi tạo chế độ Sáng / Tối (sở thích riêng từng người lưu ở localStorage)
  const [colorMode, setColorMode] = useState<ColorMode>(() =>
    getInitialColorMode(getSiteConfig(MUSIC_URLS).defaultColorMode)
  );

  // Trạng thái cổng fullscreen
  const [gateClosing, setGateClosing] = useState(false);
  const [gateClosed, setGateClosed] = useState(false);

  // Người dùng hiện tại từ lớp authService (Supabase Auth thật)
  const [currentUser, setCurrentUser] = useState<AuthUser>(() =>
    authService.getCurrentUser()
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Tiền tệ phụ trợ trong mini game & danh sách char đã mở khóa đọc từ bảng `unlocks` của Supabase
  const [petalsBalance, setPetalsBalance] = useState<number>(() =>
    dataStore.get<number>(PETALS_STORAGE_KEY, 45)
  );
  const [unlockedCharIds, setUnlockedCharIds] = useState<string[]>([]);
  const [supabaseInventory, setSupabaseInventory] = useState<
    SupabaseInventoryItem[]
  >([]);
  const [activeTabId, setActiveTabId] = useState<string>('char');

  // Khi người dùng đăng nhập / đổi phiên, tải `inventory` và `unlocks` từ Supabase
  const refreshUserInventoryAndUnlocks = useCallback(async () => {
    if (!currentUser || currentUser.profileRole === 'guest') {
      setUnlockedCharIds([]);
      setSupabaseInventory([]);
      return;
    }
    const [inv, unl] = await Promise.all([
      fetchInventoryFromSupabase(),
      fetchUnlockedCharIdsFromSupabase(),
    ]);
    setSupabaseInventory(inv);
    setUnlockedCharIds(unl);
  }, [currentUser]);

  // Trạng thái CHẾ ĐỘ CHỈNH SỬA & Ngăn kéo Cài đặt trang (Chỉ dành cho vai `owner` qua can("edit", currentUser))
  const [editMode, setEditMode] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [showEditGuideModal, setShowEditGuideModal] = useState(false);

  // Trạng thái Undo của site_settings
  const [undoCount, setUndoCount] = useState<number>(() =>
    getSiteSettingsUndoCount()
  );
  const [lastUndoLabel, setLastUndoLabel] = useState<string | null>(() =>
    getSiteSettingsLastUndoLabel()
  );
  const [dataRevision, setDataRevision] = useState<number>(0);

  // Lắng nghe thay đổi xác thực qua onAuthChange
  useEffect(() => {
    const unsubscribe = authService.onAuthChange((user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Bảo vệ nghiêm ngặt: Chỉ khi đã đăng nhập, profiles đã tải xong và role === 'owner' mới có quyền chỉnh sửa & mở Cài đặt trang
  const hasEditPermission = Boolean(
    currentUser.profileLoaded &&
      currentUser.profileRole === 'owner' &&
      can('edit', currentUser)
  );
  useEffect(() => {
    if (!hasEditPermission) {
      if (editMode) setEditMode(false);
      if (settingsDrawerOpen) setSettingsDrawerOpen(false);
      if (showEditGuideModal) setShowEditGuideModal(false);
    }
  }, [hasEditPermission, editMode, settingsDrawerOpen, showEditGuideModal]);

  const isEditActive = Boolean(editMode && hasEditPermission);

  // Lắng nghe thay đổi trên siteSettings (in-memory)
  useEffect(() => {
    const unsubscribe = onSiteSettingsChange((cfg) => {
      setSiteConfig(cfg);
      setUndoCount(getSiteSettingsUndoCount());
      setLastUndoLabel(getSiteSettingsLastUndoLabel());
    });
    return unsubscribe;
  }, []);

  // Mở hộp thoại mời đăng nhập dễ thương khi Khách bấm vào tính năng cần tài khoản
  const handleRequireAuth = useCallback((reason: string) => {
    setAuthPromptReason(reason);
    setAuthModalOpen(true);
  }, []);

  const isOwner = Boolean(currentUser.profileLoaded && currentUser.profileRole === 'owner');

  // Quà chào mừng khi đăng nhập thành công
  const [welcomeGiftModalData, setWelcomeGiftModalData] = useState<{
    flowers: number;
    coins: number;
  } | null>(null);
  const welcomeCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentUser.profileLoaded && currentUser.profileRole !== 'guest' && currentUser.id) {
      if (welcomeCheckedRef.current !== currentUser.id) {
        welcomeCheckedRef.current = currentUser.id;
        claimWelcomeGiftViaRpc().then((res) => {
          if (res.ok && res.claimed) {
            setWelcomeGiftModalData({
              flowers: res.flowers ?? 15,
              coins: res.coins ?? 10,
            });
            refreshUserInventoryAndUnlocks();
          }
        }).catch(() => {});
      }
    } else {
      welcomeCheckedRef.current = null;
    }
  }, [currentUser, refreshUserInventoryAndUnlocks]);

  // Chủ web luôn đầy
  useEffect(() => {
    if (isOwner) {
      ownerRefillViaRpc().catch(() => {});
    }
  }, [isOwner]);

  useEffect(() => {
    if (activeTabId === 'mini-game' && isOwner) {
      ownerRefillViaRpc().catch(() => {});
    }
  }, [activeTabId, isOwner]);


  const [isLoadingChars, setIsLoadingChars] = useState<boolean>(true);
  const [dailyToast, setDailyToast] = useState<string | null>(null);

  const notifyToast = useCallback((msg: string, duration = 3800) => {
    setDailyToast(msg);
    setTimeout(() => {
      setDailyToast((prev) => (prev === msg ? null : prev));
    }, duration);
  }, []);

  // Khi mở web, MỌI người (kể cả Khách) đọc `site_settings` từ Supabase để hiển thị đúng bản mới nhất
  useEffect(() => {
    let active = true;
    fetchSiteSettingsFromSupabase(MUSIC_URLS).then((loadedCfg) => {
      if (!active) return;
      setSiteConfig(loadedCfg);
      const savedUserColor = dataStore.get<string | null>(
        COLOR_MODE_STORAGE_KEY,
        null
      );
      if (
        !savedUserColor &&
        (loadedCfg.defaultColorMode === 'light' ||
          loadedCfg.defaultColorMode === 'dark')
      ) {
        setColorMode(loadedCfg.defaultColorMode);
      }
    });
    return () => {
      active = false;
    };
  }, []);


  // Danh sách tab hiển thị theo cấu hình trang & phân quyền:
  // Ba tab Commission, Request, Kho lệnh chỉ hiện với vai Creator (kiểm tra bằng can('view_creator_tabs', currentUser))
  const canViewCreatorTabs = can('view_creator_tabs', currentUser);
  const visibleTabs = useMemo(
    () =>
      siteConfig.tabs.filter((t) => {
        if (!t.visible) return false;
        if (
          t.creatorOnly ||
          t.id === 'commission' ||
          t.id === 'request' ||
          t.id === 'kho-lenh'
        ) {
          return canViewCreatorTabs;
        }
        return true;
      }),
    [siteConfig.tabs, canViewCreatorTabs]
  );


  const handleSelectTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      if (tabId === 'xep-hang' && currentUser && currentUser.role !== 'guest') {
        logGameActionViaRpc('view_ranking');
      }
    },
    [currentUser]
  );

  useEffect(() => {
    if (
      visibleTabs.length > 0 &&
      !visibleTabs.some((t) => t.id === activeTabId)
    ) {
      setActiveTabId(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTabId]);

  // Dữ liệu Creator & Character đọc từ bảng `chars` và view `public_profiles` trên Supabase
  const [libraryData, setLibraryData] = useState<{
    creators: Creator[];
    characters: CharacterItem[];
  }>({ creators: [], characters: [] });

  const refreshLibraryData = useCallback(async () => {
    setIsLoadingChars(true);
    try {
      const res = await fetchCharsAndCreatorsFromSupabase();
      setLibraryData(res);
    } finally {
      setIsLoadingChars(false);
    }
  }, []);

  useEffect(() => {
    refreshLibraryData();
  }, [refreshLibraryData]);

  useEffect(() => {
    refreshUserInventoryAndUnlocks();
  }, [refreshUserInventoryAndUnlocks]);

  // Danh sách yêu thích & ghi chú cá nhân
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    dataStore.get<string[]>(FAVORITES_STORAGE_KEY, [])
  );
  const [notesMap, setNotesMap] = useState<Record<string, string>>(() =>
    dataStore.get<Record<string, string>>(NOTES_STORAGE_KEY, {})
  );

  // Trạng thái bộ lọc trong tab Char
  const [searchSelectedTags, setSearchSelectedTags] = useState<string[]>([]);
  const [searchCreatorFilter, setSearchCreatorFilter] = useState<string>('all');

  // Trạng thái Command Palette (Ctrl+K) & JSON Import
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileImportRef = useRef<HTMLInputElement | null>(null);

  // ============================================================================
  // HỆ THỐNG NHẠC & 2 PLAYLIST ("Playlist của web" trên site_settings & "Playlist của tôi")
  // ============================================================================
  const [playlistSource, setPlaylistSource] = useState<'web' | 'personal'>('web');
  const [personalPlaylist, setPersonalPlaylist] = useState<MusicTrack[]>(() =>
    getSavedPlaylist([])
  );

  // Khách (chưa đăng nhập) chỉ nghe Playlist của web
  const isLoggedInUser = currentUser.profileRole !== 'guest';
  useEffect(() => {
    if (!isLoggedInUser && playlistSource !== 'web') {
      setPlaylistSource('web');
    }
  }, [isLoggedInUser, playlistSource]);

  const webPlaylist = useMemo(() => {
    return siteConfig.webPlaylistTracks && siteConfig.webPlaylistTracks.length > 0
      ? siteConfig.webPlaylistTracks
      : BUILTIN_SYNTH_TRACKS;
  }, [siteConfig.webPlaylistTracks]);

  const playlist = useMemo(() => {
    return playlistSource === 'web' || !isLoggedInUser
      ? webPlaylist
      : personalPlaylist;
  }, [playlistSource, isLoggedInUser, webPlaylist, personalPlaylist]);

  const canEditWebPlaylist = hasEditPermission;

  const initialPlayerState = useMemo(
    () => getSavedPlayerState(playlist[0]?.id || BUILTIN_SYNTH_TRACKS[0].id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [currentTrackId, setCurrentTrackId] = useState<string>(
    initialPlayerState.currentTrackId
  );
  const [currentTime, setCurrentTime] = useState<number>(
    initialPlayerState.currentTime
  );
  const [duration, setDuration] = useState<number>(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(initialPlayerState.volume);
  const [isMuted, setIsMuted] = useState<boolean>(initialPlayerState.isMuted);
  const [playMode, setPlayMode] = useState<PlayMode>(
    initialPlayerState.playMode
  );

  const synthRef = useRef<WebAudioSynthNodes | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const currentTimeRef = useRef<number>(initialPlayerState.currentTime);
  const loadedTrackIdRef = useRef<string | null>(null);

  const currentTrack = useMemo(() => {
    return (
      playlist.find((t) => t.id === currentTrackId) ||
      playlist[0] ||
      BUILTIN_SYNTH_TRACKS[0]
    );
  }, [playlist, currentTrackId]);

  const applyAppearanceVariables = useCallback(
    (mode: ColorMode, theme: ThemeConfig) => {
      const root = document.documentElement;
      const modeVars = MODE_PALETTES[mode];
      Object.entries(modeVars).forEach(([key, val]) => {
        root.style.setProperty(key, val);
      });
      root.style.setProperty('--accent', theme.accent);
    },
    []
  );

  useEffect(() => {
    const availableThemes =
      siteConfig.themes?.length > 0 ? siteConfig.themes : THEMES;
    const foundTheme =
      availableThemes.find((t) => t.id === activeThemeId) || availableThemes[0];
    applyAppearanceVariables(colorMode, foundTheme);
    dataStore.set(THEME_STORAGE_KEY, foundTheme.id, true);
    dataStore.set(COLOR_MODE_STORAGE_KEY, colorMode, true);
  }, [activeThemeId, colorMode, siteConfig.themes, applyAppearanceVariables]);

  // Đồng bộ title trang trình duyệt theo tên web trong siteConfig
  useEffect(() => {
    try {
      if (siteConfig.siteTitle) {
        document.title = `${siteConfig.siteTitle} — ${siteConfig.siteSlogan}`;
      }
    } catch {
      // Ignore document title error
    }
  }, [siteConfig.siteTitle, siteConfig.siteSlogan]);

  const handleToggleColorMode = useCallback(() => {
    setColorMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Bật / tắt Chế độ chỉnh sửa (Chỉ hoạt động khi can("edit", currentUser) === true — tức là vai `owner`)
  const handleToggleEditMode = useCallback(() => {
    if (!can('edit', currentUser)) return;
    setEditMode((prev) => {
      const next = !prev;
      if (next) {
        const seenGuide = dataStore.get<boolean>(EDIT_GUIDE_SEEN_KEY, false);
        if (!seenGuide) {
          dataStore.set(EDIT_GUIDE_SEEN_KEY, true, true);
          setShowEditGuideModal(true);
        }
      }
      return next;
    });
  }, [currentUser]);

  // Cập nhật cấu hình trang (SiteConfig) -> Lưu bằng upsert vào bảng `site_settings` trên Supabase
  const handleUpdateSiteConfig = useCallback(
    async (patch: Partial<SiteConfig>, undoLabel = 'Cập nhật cài đặt trang') => {
      if (!can('edit', currentUser)) {
        notifyToast('🔒 Chỉ Chủ web (owner) mới có quyền chỉnh sửa cài đặt trang.');
        return;
      }
      if (patch.defaultColorMode === 'light' || patch.defaultColorMode === 'dark') {
        setColorMode(patch.defaultColorMode);
      }
      const res = await upsertSiteSettingsOnSupabase(patch, undoLabel);
      setSiteConfig(res.config);
      if (res.ok) {
        notifyToast('✨ Đã lưu');
      } else {
        notifyToast(`⚠️ ${res.message}`, 5000);
      }
    },
    [currentUser, notifyToast]
  );

  // Cập nhật văn bản sửa trực tiếp trên giao diện (tự lưu ngay lên key "texts" của site_settings)
  const handleUpdateCustomText = useCallback(
    (key: string, value: string, fallback = '') => {
      if (!can('edit', currentUser)) return;
      const next = updateCustomText(key, value, fallback, (res) => {
        if (res.ok) {
          notifyToast('✨ Đã lưu');
        } else {
          notifyToast(`⚠️ ${res.message}`, 5000);
        }
      });
      setSiteConfig(next);
    },
    [currentUser, notifyToast]
  );

  // Hoàn tác (Undo) thao tác chỉnh sửa gần nhất trên `site_settings`
  const handleUndo = useCallback(async () => {
    if (!can('edit', currentUser)) return;
    const res = await undoSiteSettingsOnSupabase();
    setSiteConfig(res.config);
    setDataRevision((r) => r + 1);
    if (res.ok) {
      notifyToast(`↩️ ${res.message}`);
    } else {
      notifyToast(`⚠️ ${res.message}`, 5000);
    }
  }, [currentUser, notifyToast]);

  // Khôi phục mặc định toàn bộ cấu hình trang trên `site_settings`
  const handleResetDefaults = useCallback(async () => {
    if (!can('edit', currentUser)) return;
    const res = await resetSiteSettingsToDefaultsOnSupabase(MUSIC_URLS);
    setSiteConfig(res.config);
    setDataRevision((r) => r + 1);
    if (res.ok) {
      notifyToast('🌸 Đã lưu (Khôi phục mặc định trên Supabase)!');
    } else {
      notifyToast(`⚠️ ${res.message}`, 5000);
    }
  }, [currentUser, notifyToast]);

  // Thưởng tiền tệ khi ghé thăm mỗi ngày
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const lastVisit = dataStore.get<string>(LAST_DAILY_VISIT_KEY, '');
    if (lastVisit !== today) {
      dataStore.set(LAST_DAILY_VISIT_KEY, today, true);
      setPetalsBalance((prev) => {
        const next = prev + 15;
        dataStore.set(PETALS_STORAGE_KEY, next, true);
        return next;
      });
    }
  }, []);

  const handleAddPetals = useCallback((amount: number) => {
    setPetalsBalance((prev) => {
      const next = Math.max(0, prev + amount);
      dataStore.set(PETALS_STORAGE_KEY, next, true);
      return next;
    });
  }, []);

  const handleUnlockCharWithPetals = useCallback(
    (charId: string, price: number): boolean => {
      if (!can('unlock_char', currentUser)) {
        handleRequireAuth(
          `Mời bạn đăng nhập để mở khóa liên kết trò chuyện của nhân vật nhé ${siteConfig.currencyEmoji}`
        );
        return false;
      }
      if (petalsBalance < price) return false;
      setPetalsBalance((prev) => {
        const next = prev - price;
        dataStore.set(PETALS_STORAGE_KEY, next, true);
        return next;
      });
      setUnlockedCharIds((prev) => (prev.includes(charId) ? prev : [...prev, charId]));
      return true;
    },
    [currentUser, petalsBalance, handleRequireAuth, siteConfig.currencyEmoji]
  );

  // Mở khóa nhân vật vĩnh viễn bằng vật phẩm từ bảng `inventory` qua RPC `unlock_char`
  const handleUnlockCharWithItems = useCallback(
    async (charId: string) => {
      setUnlockedCharIds((prev) =>
        prev.includes(charId) ? prev : [...prev, charId]
      );
      await refreshUserInventoryAndUnlocks();
      const target = libraryData.characters.find((c) => c.id === charId);
      notifyToast(
        `✨ Đã mở khóa vĩnh viễn nhân vật "${target?.name || 'Char'}"! Link chat và Open Scene đã sẵn sàng.`,
        5000
      );
    },
    [libraryData.characters, notifyToast, refreshUserInventoryAndUnlocks]
  );

  // Lưu âm lượng, bài đang chọn & chế độ phát vào localStorage (try/catch)
  useEffect(() => {
    const effectiveVol = isMuted ? 0 : volume;
    dataStore.set(VOLUME_STORAGE_KEY, volume, true);
    savePlayerState({
      currentTrackId: currentTrack.id,
      volume,
      isMuted,
      playMode,
    });
    try {
      if (synthRef.current) {
        const { ctx, masterGain } = synthRef.current;
        masterGain.gain.setTargetAtTime(
          Math.max(0.0001, effectiveVol),
          ctx.currentTime,
          0.08
        );
      }
      if (audioElRef.current) {
        audioElRef.current.volume = Math.max(0, Math.min(1, effectiveVol));
        audioElRef.current.muted = isMuted;
      }
    } catch {
      // Ignore audio errors
    }
  }, [volume, isMuted, currentTrack.id, playMode]);

  // Kiểm tra quyền qua can() cho Yêu thích & Ghi chú cá nhân
  const handleToggleFavorite = useCallback(
    (charId: string) => {
      if (!can('favorite_char', currentUser)) {
        handleRequireAuth(
          'Mời bạn đăng nhập để thả tim lưu nhân vật vào danh sách yêu thích nhé 💌'
        );
        return;
      }
      setFavoriteIds((prev) => {
        const isAdding = !prev.includes(charId);
        const next = isAdding
          ? [...prev, charId]
          : prev.filter((id) => id !== charId);
        dataStore.set(FAVORITES_STORAGE_KEY, next, true);
        if (isAdding && currentUser && currentUser.role !== 'guest') {
          logGameActionViaRpc('like_char');
        }
        return next;
      });
    },
    [currentUser, handleRequireAuth]
  );

  const handleSaveNote = useCallback(
    (charId: string, note: string) => {
      if (!can('personal_note', currentUser)) {
        handleRequireAuth(
          'Mời bạn đăng nhập để lưu ghi chú sổ tay cá nhân cho nhân vật này nhé 📒'
        );
        return;
      }
      setNotesMap((prev) => {
        const next = { ...prev };
        if (note.trim()) {
          next[charId] = note.trim();
        } else {
          delete next[charId];
        }
        dataStore.set(NOTES_STORAGE_KEY, next, true);
        return next;
      });
    },
    [currentUser, handleRequireAuth]
  );

  // ============================================================================
  // CRUD Nhân vật trên bảng `chars` và `char_secrets` của Supabase
  // ============================================================================
  const handleAddCharacterByCreator = useCallback(
    async (newChar: Omit<CharacterItem, 'id'>) => {
      if (!can('manage_own_chars', currentUser)) {
        handleRequireAuth('Chỉ Chủ web mới có quyền thêm nhân vật mới.');
        return;
      }
      try {
        await createCharOnSupabase({
          creatorId: currentUser.id,
          name: String(newChar.name || ''),
          imageUrl: newChar.imageUrl ? String(newChar.imageUrl) : undefined,
          tags: Array.isArray(newChar.tags) ? (newChar.tags as string[]) : [],
          description: String(newChar.description || ''),
          locked: Boolean(newChar.isLocked),
          requirements: Array.isArray(newChar.unlockRequirements)
            ? newChar.unlockRequirements
            : [],
          chatLink: String(newChar.chatUrl || ''),
          openScene: String(newChar.openScene || newChar.openingLine || ''),
        });
        await refreshLibraryData();
        notifyToast(`✨ Đã thêm nhân vật "${newChar.name}" lên Supabase!`);
      } catch (err) {
        notifyToast(
          err instanceof Error
            ? `⚠️ ${err.message}`
            : '⚠️ Không thể thêm nhân vật lên Supabase.',
          5000
        );
      }
    },
    [currentUser, handleRequireAuth, refreshLibraryData, notifyToast]
  );

  const handleUpdateCharacter = useCallback(
    async (
      charId: string,
      patch: Partial<CharacterItem> & {
        chatLink?: string;
        openSceneSecret?: string;
      }
    ) => {
      const target = libraryData.characters.find((c) => c.id === charId);
      if (!target) return;
      if (!canEditItem(currentUser, target.creatorId)) return;
      try {
        await updateCharOnSupabase(charId, patch);
        await refreshLibraryData();
        notifyToast('✨ Đã lưu cập nhật nhân vật lên Supabase!');
      } catch (err) {
        notifyToast(
          err instanceof Error
            ? `⚠️ ${err.message}`
            : '⚠️ Không thể cập nhật nhân vật.',
          5000
        );
      }
    },
    [currentUser, libraryData.characters, refreshLibraryData, notifyToast]
  );

  const handleDeleteCharacter = useCallback(
    async (charId: string) => {
      const target = libraryData.characters.find((c) => c.id === charId);
      if (!target) return;
      if (!canEditItem(currentUser, target.creatorId)) return;
      try {
        await deleteCharOnSupabase(charId);
        await refreshLibraryData();
        notifyToast(`🗑️ Đã xóa nhân vật "${target.name}" khỏi Supabase.`);
      } catch (err) {
        notifyToast(
          err instanceof Error
            ? `⚠️ ${err.message}`
            : '⚠️ Không thể xóa nhân vật.',
          5000
        );
      }
    },
    [currentUser, libraryData.characters, refreshLibraryData, notifyToast]
  );

  const handleMoveCharacter = useCallback(
    (charId: string, direction: 'up' | 'down') => {
      if (!can('edit', currentUser)) return;
      setLibraryData((prev) => {
        const idx = prev.characters.findIndex((c) => c.id === charId);
        if (idx < 0) return prev;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.characters.length) return prev;
        const copy = [...prev.characters];
        const [moved] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, moved);
        return { ...prev, characters: copy };
      });
    },
    [currentUser]
  );

  const handleToggleSearchTag = useCallback((tag: string) => {
    setSearchSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleResetSearchFilters = useCallback(() => {
    setSearchSelectedTags([]);
    setSearchCreatorFilter('all');
  }, []);

  const handleOpenCreatorProfile = useCallback((creatorId: string) => {
    setSearchCreatorFilter(creatorId);
    setActiveTabId('char');
  }, []);

  /**
   * Khởi tạo bộ tổng hợp âm thanh Web Audio API:
   * Hộp nhạc / Chuông nhẹ (Music Box Chimes) trên nền Pad êm dịu
   */
  const startWebAudioAmbient = useCallback((initialVol: number) => {
    if (synthRef.current) {
      const { ctx, masterGain } = synthRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      masterGain.gain.setTargetAtTime(initialVol, ctx.currentTime, 0.4);
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(initialVol, ctx.currentTime + 1.5);
    masterGain.connect(ctx.destination);

    const padGain = ctx.createGain();
    padGain.gain.value = 0.22;

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 420;

    const padFreqs = [174.61, 220.0, 261.63, 329.63];
    const oscillators: OscillatorNode[] = [];

    padFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (idx - 1.5) * 3;
      oscGain.gain.value = 0.18 / padFreqs.length;
      osc.connect(oscGain);
      oscGain.connect(padFilter);
      osc.start();
      oscillators.push(osc);
    });

    padFilter.connect(padGain);
    padGain.connect(masterGain);

    const chimeNotes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 1046.5];

    const playChimeNote = () => {
      if (ctx.state !== 'running') return;
      try {
        const now = ctx.currentTime;
        const freq =
          chimeNotes[Math.floor(Math.random() * chimeNotes.length)];

        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, now);

        const overtoneGain = ctx.createGain();
        overtoneGain.gain.setValueAtTime(0.06, now);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0008, now + 2.8);

        osc.connect(noteGain);
        overtone.connect(overtoneGain);
        overtoneGain.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now);
        overtone.start(now);
        osc.stop(now + 2.9);
        overtone.stop(now + 0.9);
      } catch {
        // Ignore single chime error
      }
    };

    setTimeout(playChimeNote, 400);

    const chimeInterval = window.setInterval(() => {
      playChimeNote();
      if (Math.random() < 0.45) {
        setTimeout(playChimeNote, 450);
      }
    }, 2200);

    const cleanup = () => {
      try {
        window.clearInterval(chimeInterval);
        oscillators.forEach((o) => o.stop());
        ctx.close();
      } catch {
        // Ignore cleanup errors
      }
    };

    synthRef.current = { ctx, masterGain, cleanup };
  }, []);

  const stopWebAudioSynth = useCallback(() => {
    try {
      if (synthRef.current) {
        const { ctx, masterGain } = synthRef.current;
        masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
        setTimeout(() => {
          try {
            if (synthRef.current && synthRef.current.ctx.state === 'running') {
              synthRef.current.ctx.suspend();
            }
          } catch {
            // Ignore suspend error
          }
        }, 200);
      }
    } catch {
      // Ignore synth stop error
    }
  }, []);

  // Chọn bài tiếp theo dựa trên chế độ phát (repeat-one / repeat-all / shuffle)
  const getNextTrackId = useCallback(
    (direction: 'next' | 'prev' | 'ended'): string => {
      if (playlist.length === 0) return BUILTIN_SYNTH_TRACKS[0].id;
      if (direction === 'ended' && playMode === 'repeat-one') {
        return currentTrack.id;
      }
      if (playMode === 'shuffle' && playlist.length > 1) {
        const others = playlist.filter((t) => t.id !== currentTrack.id);
        const picked =
          others[Math.floor(Math.random() * others.length)] || playlist[0];
        return picked.id;
      }
      const curIdx = playlist.findIndex((t) => t.id === currentTrack.id);
      const safeIdx = curIdx >= 0 ? curIdx : 0;
      const nextIdx =
        direction === 'prev'
          ? (safeIdx - 1 + playlist.length) % playlist.length
          : (safeIdx + 1) % playlist.length;
      return playlist[nextIdx].id;
    },
    [playlist, playMode, currentTrack.id]
  );

  // Phát một bài nhạc cụ thể (Hỗ trợ cả 3 nguồn: builtin-synth, url trực tiếp, và file trong IndexedDB)
  const playTrack = useCallback(
    async (trackToPlay: MusicTrack, startFromTime?: number) => {
      const effectiveVol = isMuted ? 0 : volume;
      try {
        // Trường hợp YouTube
        if (trackToPlay.sourceType === 'youtube' && trackToPlay.youtubeId) {
          if (audioElRef.current) audioElRef.current.pause();
          stopWebAudioSynth();
          if (window.ytPlayerInstance && typeof window.ytPlayerInstance.loadVideoById === 'function') {
            window.ytPlayerInstance.loadVideoById(trackToPlay.youtubeId);
            window.ytPlayerInstance.playVideo();
          }
          loadedTrackIdRef.current = trackToPlay.id;
          setDuration(trackToPlay.duration || 180);
          setIsPlaying(true);
          return;
        }

        // Trường hợp Spotify
        if (trackToPlay.sourceType === 'spotify') {
          if (audioElRef.current) audioElRef.current.pause();
          stopWebAudioSynth();
          if (window.ytPlayerInstance && typeof window.ytPlayerInstance.pauseVideo === 'function') {
            window.ytPlayerInstance.pauseVideo();
          }
          loadedTrackIdRef.current = trackToPlay.id;
          setDuration(trackToPlay.duration || 180);
          setIsPlaying(true);
          return;
        }

        // Trường hợp 1: Giai điệu Hộp nhạc Web Audio mặc định
        if (trackToPlay.sourceType === 'builtin-synth') {
          if (audioElRef.current) {
            audioElRef.current.pause();
          }
          loadedTrackIdRef.current = trackToPlay.id;
          const dur = trackToPlay.duration || 180;
          setDuration(dur);
          if (typeof startFromTime === 'number') {
            setCurrentTime(startFromTime);
            currentTimeRef.current = startFromTime;
          }
          startWebAudioAmbient(effectiveVol);
          setIsPlaying(true);
          return;
        }

        // Trường hợp 2 & 3: Bài nhạc từ Link MP3 trực tiếp hoặc File tải lên trong IndexedDB
        stopWebAudioSynth();

        let audioSrc = trackToPlay.url || '';
        if (trackToPlay.sourceType === 'indexeddb' && trackToPlay.idbKey) {
          const blobUrl = await musicIdbStorage.getAudioObjectUrl(
            trackToPlay.idbKey
          );
          if (!blobUrl) {
            notifyToast(
              '🌸 Không tìm thấy file nhạc trong trình duyệt, góc nhỏ phát giai điệu Hộp nhạc thay thế nhé!'
            );
            startWebAudioAmbient(effectiveVol);
            setIsPlaying(true);
            return;
          }
          audioSrc = blobUrl;
        }

        if (!audioSrc) {
          startWebAudioAmbient(effectiveVol);
          setIsPlaying(true);
          return;
        }

        if (!audioElRef.current) {
          audioElRef.current = new Audio();
        }

        const audio = audioElRef.current;
        const isSameTrack = loadedTrackIdRef.current === trackToPlay.id;

        if (!isSameTrack || audio.src !== audioSrc) {
          audio.src = audioSrc;
          loadedTrackIdRef.current = trackToPlay.id;
          audio.load();
        }

        audio.volume = Math.max(0, Math.min(1, effectiveVol));
        audio.muted = isMuted;

        if (typeof startFromTime === 'number' && startFromTime > 0) {
          try {
            audio.currentTime = startFromTime;
          } catch {
            // Sẽ áp dụng sau khi loadedmetadata
          }
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              // Nếu link lỗi không phát được, chuyển nhẹ sang Hộp nhạc để không bao giờ kẹt
              notifyToast(
                `🌸 Không phát được "${trackToPlay.title}", góc nhỏ tạm mở tiếng Hộp nhạc dịu êm nhé!`
              );
              startWebAudioAmbient(effectiveVol);
              setIsPlaying(true);
            });
        } else {
          setIsPlaying(true);
        }
      } catch {
        setIsPlaying(false);
      }
    },
    [isMuted, volume, startWebAudioAmbient, stopWebAudioSynth, notifyToast]
  );

  const stopAmbientMusic = useCallback(() => {
    try {
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      stopWebAudioSynth();
      if (window.ytPlayerInstance && typeof window.ytPlayerInstance.pauseVideo === 'function') {
        window.ytPlayerInstance.pauseVideo();
      }
      setIsPlaying(false);
    } catch {
      setIsPlaying(false);
    }
  }, [stopWebAudioSynth]);

  const toggleMusic = useCallback(() => {
    if (isPlaying) {
      stopAmbientMusic();
    } else {
      playTrack(currentTrack, currentTimeRef.current);
    }
  }, [isPlaying, stopAmbientMusic, playTrack, currentTrack]);

  // Gắn sự kiện timeupdate, loadedmetadata, ended, error cho thẻ <audio>
  useEffect(() => {
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
    }
    const audio = audioElRef.current;

    const handleTimeUpdate = () => {
      const nowSec = Math.floor(audio.currentTime || 0);
      setCurrentTime(nowSec);
      currentTimeRef.current = nowSec;
      savePlayerState({ currentTime: nowSec });
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      }
      // Khôi phục vị trí đã lưu nếu vừa tải bài
      if (
        currentTimeRef.current > 0 &&
        Math.abs(audio.currentTime - currentTimeRef.current) > 2 &&
        currentTimeRef.current < (audio.duration || 9999)
      ) {
        try {
          audio.currentTime = currentTimeRef.current;
        } catch {
          // Ignore seek error
        }
      }
    };

    const handleEnded = () => {
      if (currentUser && currentUser.role !== 'guest') {
        logGameActionViaRpc('listen_song');
      }
      if (playMode === 'repeat-one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      const nextId = getNextTrackId('ended');
      setCurrentTrackId(nextId);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      savePlayerState({ currentTrackId: nextId, currentTime: 0 });
      const nextTrack =
        playlist.find((t) => t.id === nextId) || BUILTIN_SYNTH_TRACKS[0];
      playTrack(nextTrack, 0);
    };

    const handleError = () => {
      if (currentTrack.sourceType !== 'builtin-synth' && isPlaying) {
        notifyToast(
          `🌸 Bài "${currentTrack.title}" đang gặp lỗi kết nối, chuyển sang giai điệu tiếp theo nhé!`
        );
        startWebAudioAmbient(isMuted ? 0 : volume);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [
    playMode,
    getNextTrackId,
    playlist,
    playTrack,
    currentTrack,
    isPlaying,
    notifyToast,
    startWebAudioAmbient,
    isMuted,
    volume,
  ]);

  // Bộ đếm thời gian cho các bài Hộp nhạc Web Audio mặc định (để thanh tua hoạt động mượt mà)
  useEffect(() => {
    if (!isPlaying || currentTrack.sourceType !== 'builtin-synth') return;
    const targetDur = currentTrack.duration || 180;
    setDuration(targetDur);

    const timer = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next >= targetDur) {
          if (playMode === 'repeat-one') {
            currentTimeRef.current = 0;
            savePlayerState({ currentTime: 0 });
            return 0;
          }
          const nextId = getNextTrackId('ended');
          setCurrentTrackId(nextId);
          currentTimeRef.current = 0;
          savePlayerState({ currentTrackId: nextId, currentTime: 0 });
          const nextTrack =
            playlist.find((t) => t.id === nextId) || BUILTIN_SYNTH_TRACKS[0];
          playTrack(nextTrack, 0);
          return 0;
        }
        currentTimeRef.current = next;
        savePlayerState({ currentTime: next });
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    isPlaying,
    currentTrack,
    playMode,
    getNextTrackId,
    playlist,
    playTrack,
  ]);

  // Các hàm điều khiển Playlist (Chọn bài, Trước, Sau, Tua, Đổi chế độ, Thêm/Sửa/Xóa/Sắp xếp)
  const handleSelectTrack = useCallback(
    (trackId: string) => {
      const found = playlist.find((t) => t.id === trackId);
      if (!found) return;
      setCurrentTrackId(found.id);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      setDuration(found.duration || 180);
      savePlayerState({ currentTrackId: found.id, currentTime: 0 });
      playTrack(found, 0);
    },
    [playlist, playTrack]
  );

  const handlePrevTrack = useCallback(() => {
    if (currentTimeRef.current > 5) {
      // Nếu đã nghe quá 5 giây thì tua về đầu bài
      setCurrentTime(0);
      currentTimeRef.current = 0;
      savePlayerState({ currentTime: 0 });
      if (
        currentTrack.sourceType !== 'builtin-synth' &&
        audioElRef.current
      ) {
        try {
          audioElRef.current.currentTime = 0;
        } catch {
          // Ignore
        }
      }
      return;
    }
    const prevId = getNextTrackId('prev');
    handleSelectTrack(prevId);
  }, [currentTrack.sourceType, getNextTrackId, handleSelectTrack]);

  const handleNextTrack = useCallback(() => {
    const nextId = getNextTrackId('next');
    handleSelectTrack(nextId);
  }, [getNextTrackId, handleSelectTrack]);

  const handleSeekTrack = useCallback(
    (newTime: number) => {
      const clamped = Math.max(0, Math.floor(newTime));
      setCurrentTime(clamped);
      currentTimeRef.current = clamped;
      savePlayerState({ currentTime: clamped });
      if (
        currentTrack.sourceType !== 'builtin-synth' &&
        audioElRef.current
      ) {
        try {
          audioElRef.current.currentTime = clamped;
        } catch {
          // Ignore seek error
        }
      }
    },
    [currentTrack.sourceType]
  );

  const handleCyclePlayMode = useCallback(() => {
    setPlayMode((prev) => {
      const next: PlayMode =
        prev === 'repeat-all'
          ? 'repeat-one'
          : prev === 'repeat-one'
          ? 'shuffle'
          : 'repeat-all';
      savePlayerState({ playMode: next });
      return next;
    });
  }, []);

  const handleAddMusicTrack = useCallback(
    (
      newTrack: MusicTrack,
      playImmediately = true,
      targetPlaylist: 'web' | 'personal' = playlistSource
    ) => {
      // Quy tắc 5: Playlist web chỉ lưu được các link MP3 trực tiếp; file tải từ máy lên chỉ nghe được trên máy đó
      if (newTrack.sourceType === 'indexeddb') {
        setPersonalPlaylist((prev) => {
          const next = [newTrack, ...prev];
          savePlaylist(next);
          return next;
        });
        setPlaylistSource('personal');
        notifyToast(
          `🎵 Đã lưu "${newTrack.title}" vào "Playlist của tôi" (File tải từ máy chỉ nghe được trên máy này nhé)!`,
          5000
        );
      } else if (targetPlaylist === 'web' && can('edit', currentUser)) {
        const nextWebTracks = [newTrack, ...webPlaylist];
        const nextUrls = Array.from(
          new Set(
            nextWebTracks
              .filter((t) => t.sourceType === 'url' && t.url)
              .map((t) => t.url!.trim())
              .filter(Boolean)
          )
        );
        handleUpdateSiteConfig(
          {
            musicUrls: nextUrls,
            webPlaylistTracks: nextWebTracks,
          },
          `Thêm bài nhạc "${newTrack.title}" vào Playlist Web`
        );
      } else {
        setPersonalPlaylist((prev) => {
          const next = [newTrack, ...prev];
          savePlaylist(next);
          return next;
        });
        setPlaylistSource('personal');
        notifyToast(`🎵 Đã thêm "${newTrack.title}" vào Playlist của tôi!`);
      }

      if (playImmediately) {
        setCurrentTrackId(newTrack.id);
        setCurrentTime(0);
        currentTimeRef.current = 0;
        setDuration(newTrack.duration || 180);
        savePlayerState({ currentTrackId: newTrack.id, currentTime: 0 });
        playTrack(newTrack, 0);
      }
    },
    [playlistSource, currentUser, webPlaylist, handleUpdateSiteConfig, notifyToast, playTrack]
  );

  const handleUpdateMusicTrack = useCallback(
    (trackId: string, patch: Partial<MusicTrack>) => {
      if (playlistSource === 'web') {
        if (!can('edit', currentUser)) return;
        const nextWeb = webPlaylist.map((t) =>
          t.id === trackId ? { ...t, ...patch } : t
        );
        handleUpdateSiteConfig(
          { webPlaylistTracks: nextWeb },
          'Sửa thông tin bài nhạc trong Playlist Web'
        );
      } else {
        setPersonalPlaylist((prev) => {
          const next = prev.map((t) =>
            t.id === trackId ? { ...t, ...patch } : t
          );
          savePlaylist(next);
          return next;
        });
        notifyToast('✨ Đã cập nhật thông tin bài nhạc!');
      }
    },
    [playlistSource, currentUser, webPlaylist, handleUpdateSiteConfig, notifyToast]
  );

  const handleDeleteMusicTrack = useCallback(
    (trackId: string) => {
      const target = playlist.find((t) => t.id === trackId);
      if (!target) return;
      if (target.sourceType === 'indexeddb' && target.idbKey) {
        musicIdbStorage.deleteAudioFile(target.idbKey);
      }
      if (playlistSource === 'web') {
        if (!can('edit', currentUser)) return;
        const filtered = webPlaylist.filter((t) => t.id !== trackId);
        const finalList =
          filtered.length > 0 ? filtered : [...BUILTIN_SYNTH_TRACKS];
        const nextUrls = finalList
          .filter((t) => t.sourceType === 'url' && t.url)
          .map((t) => t.url!.trim())
          .filter(Boolean);
        handleUpdateSiteConfig(
          {
            musicUrls: nextUrls,
            webPlaylistTracks: finalList,
          },
          `Xóa bài "${target.title}" khỏi Playlist Web`
        );
      } else {
        setPersonalPlaylist((prev) => {
          const filtered = prev.filter((t) => t.id !== trackId);
          const finalList =
            filtered.length > 0 ? filtered : [...BUILTIN_SYNTH_TRACKS];
          savePlaylist(finalList);
          return finalList;
        });
        notifyToast(`🗑️ Đã xóa "${target.title}" khỏi Playlist của tôi.`);
      }
    },
    [
      playlist,
      playlistSource,
      currentUser,
      webPlaylist,
      handleUpdateSiteConfig,
      notifyToast,
    ]
  );

  const handleMoveMusicTrack = useCallback(
    (trackId: string, direction: 'up' | 'down') => {
      if (playlistSource === 'web') {
        if (!can('edit', currentUser)) return;
        const idx = webPlaylist.findIndex((t) => t.id === trackId);
        if (idx < 0) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= webPlaylist.length) return;
        const copy = [...webPlaylist];
        const [item] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, item);
        handleUpdateSiteConfig(
          { webPlaylistTracks: copy },
          'Đổi thứ tự bài trong Playlist Web'
        );
      } else {
        setPersonalPlaylist((prev) => {
          const idx = prev.findIndex((t) => t.id === trackId);
          if (idx < 0) return prev;
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= prev.length) return prev;
          const copy = [...prev];
          const [item] = copy.splice(idx, 1);
          copy.splice(targetIdx, 0, item);
          savePlaylist(copy);
          return copy;
        });
      }
    },
    [playlistSource, currentUser, webPlaylist, handleUpdateSiteConfig]
  );

  const handleReorderMusicTracks = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (playlistSource === 'web') {
        if (!can('edit', currentUser)) return;
        if (
          fromIndex < 0 ||
          fromIndex >= webPlaylist.length ||
          toIndex < 0 ||
          toIndex >= webPlaylist.length
        ) {
          return;
        }
        const copy = [...webPlaylist];
        const [moved] = copy.splice(fromIndex, 1);
        copy.splice(toIndex, 0, moved);
        handleUpdateSiteConfig(
          { webPlaylistTracks: copy },
          'Kéo thả sắp xếp Playlist Web'
        );
      } else {
        setPersonalPlaylist((prev) => {
          if (
            fromIndex < 0 ||
            fromIndex >= prev.length ||
            toIndex < 0 ||
            toIndex >= prev.length
          ) {
            return prev;
          }
          const copy = [...prev];
          const [moved] = copy.splice(fromIndex, 1);
          copy.splice(toIndex, 0, moved);
          savePlaylist(copy);
          return copy;
        });
      }
    },
    [playlistSource, currentUser, webPlaylist, handleUpdateSiteConfig]
  );

  const handleRestoreBuiltinTracks = useCallback(() => {
    if (playlistSource === 'web' && can('edit', currentUser)) {
      const existingIds = new Set(webPlaylist.map((t) => t.id));
      const missing = BUILTIN_SYNTH_TRACKS.filter(
        (b) => !existingIds.has(b.id)
      );
      if (missing.length === 0) {
        notifyToast('🎐 Cả 4 giai điệu hộp nhạc gốc đều đang có sẵn trong Playlist Web!');
        return;
      }
      handleUpdateSiteConfig(
        { webPlaylistTracks: [...webPlaylist, ...missing] },
        'Khôi phục 4 giai điệu hộp nhạc gốc'
      );
    } else {
      setPersonalPlaylist((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const missing = BUILTIN_SYNTH_TRACKS.filter(
          (b) => !existingIds.has(b.id)
        );
        if (missing.length === 0) {
          notifyToast('🎐 Cả 4 giai điệu hộp nhạc gốc đều đang có sẵn trong Playlist!');
          return prev;
        }
        const next = [...prev, ...missing];
        savePlaylist(next);
        notifyToast('✨ Đã khôi phục đầy đủ 4 giai điệu hộp nhạc gốc!');
        return next;
      });
    }
  }, [playlistSource, currentUser, webPlaylist, handleUpdateSiteConfig, notifyToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
        return;
      }

      if (isTyping) return;

      if (e.key === '/') {
        e.preventDefault();
        setActiveTabId('char');
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 60);
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMusic();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen, toggleMusic]);

  const handleExportAllJson = useCallback(() => {
    const dump = {
      exportedAt: new Date().toISOString(),
      siteConfig,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goc-nho-lap-lanh-site-settings-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notifyToast('✨ Đã xuất cấu hình trang (site_settings) ra file JSON!');
  }, [siteConfig, notifyToast]);

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const cfgToImport = (parsed?.siteConfig || parsed) as Partial<SiteConfig>;
        if (cfgToImport && typeof cfgToImport === 'object') {
          await handleUpdateSiteConfig(
            cfgToImport,
            'Nhập cấu hình từ file JSON'
          );
          setDataRevision((r) => r + 1);
        }
      } catch {
        notifyToast('File JSON chưa đúng định dạng rồi.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleEnterFromGate = (withMusic: boolean) => {
    setGateClosing(true);
    setTimeout(() => {
      setGateClosed(true);
    }, 700);

    if (withMusic) {
      setTimeout(() => {
        try {
          playTrack(currentTrack, currentTimeRef.current);
        } catch {
          // Lỗi nhạc không làm kẹt cổng
        }
      }, 60);
    }
  };

  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cleanup();
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
    };
  }, []);

  const activeThemesList =
    siteConfig.themes?.length > 0 ? siteConfig.themes : THEMES;
  const currentTheme =
    activeThemesList.find((t) => t.id === activeThemeId) || activeThemesList[0];
  const currentTabInfo =
    siteConfig.tabs.find((t) => t.id === activeTabId) || siteConfig.tabs[0];

  const renderGuestGatePrompt = (title: string, desc: string) => (
    <div className="soft-card py-16 px-6 text-center space-y-4 max-w-xl mx-auto">
      <div className="w-12 h-12 rounded-full bg-[var(--accent)]/25 flex items-center justify-center mx-auto">
        <Lock className="w-5 h-5 text-[var(--text)]" />
      </div>
      <h2 className="font-serif-title text-2xl sm:text-3xl font-bold text-[var(--text)]">
        {title}
      </h2>
      <p className="text-sm text-[var(--muted)] leading-relaxed">{desc}</p>
      <button
        type="button"
        onClick={() => handleRequireAuth(desc)}
        className="px-6 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer"
      >
        ✨ Đăng nhập / Đăng ký ngay
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] theme-transition selection:bg-[var(--accent)] selection:text-[#3a2b30]">
      {/* Hiệu ứng lấp lánh pastel rải theo con trỏ chuột & hạt bay nền (pointer-events: none) */}
      <SparkleCanvas
        sparkleEnabled={siteConfig.sparkleEnabled}
        floatingParticlesEnabled={siteConfig.floatingParticlesEnabled}
      />

      {/* Hệ thống Chế độ chỉnh sửa (Chỉ hiển thị khi đã đăng nhập, profiles tải xong và role === 'owner') */}
      <EditModeSystem
        currentUser={currentUser}
        editMode={isEditActive}
        onToggleEditMode={handleToggleEditMode}
        drawerOpen={settingsDrawerOpen}
        onSetDrawerOpen={setSettingsDrawerOpen}
        siteConfig={siteConfig}
        onUpdateSiteConfig={handleUpdateSiteConfig}
        undoCount={undoCount}
        lastUndoLabel={lastUndoLabel}
        onUndo={handleUndo}
        onResetDefaults={handleResetDefaults}
        onExportJson={handleExportAllJson}
        onTriggerImportJson={() => fileImportRef.current?.click()}
        onReopenGate={() => {
          setGateClosing(false);
          setGateClosed(false);
        }}
        showGuideModal={showEditGuideModal}
        onCloseGuideModal={() => setShowEditGuideModal(false)}
        onOpenGuideModal={() => setShowEditGuideModal(true)}
        onNotify={notifyToast}
      />

      {/* Hộp thoại Đăng nhập / Đăng ký */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthPromptReason(null);
        }}
        promptReason={authPromptReason}
        onAuthSuccess={(user, msg) => {
          setCurrentUser(user);
          notifyToast(msg, 4500);
        }}
      />

      {/* Command Palette (Phím tắt Ctrl + K chạy ngầm) */}
      <CommandPaletteModal
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        themes={activeThemesList}
        onSelectTheme={setActiveThemeId}
        onToggleMusic={toggleMusic}
        onExportJson={handleExportAllJson}
        availableTabs={visibleTabs}
      />

      {/* Màn hình cổng Fullscreen */}
      {!gateClosed && (
        <GateOverlay
          themes={activeThemesList}
          activeThemeId={activeThemeId}
          onSelectTheme={setActiveThemeId}
          colorMode={colorMode}
          onToggleColorMode={handleToggleColorMode}
          onEnter={handleEnterFromGate}
          isClosing={gateClosing}
          siteConfig={siteConfig}
          editMode={isEditActive}
          onUpdateSiteConfig={handleUpdateSiteConfig}
        />
      )}

      {/* Không gian chính của Góc Nhỏ Lấp Lánh */}
      <header className="w-full border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md sticky top-0 z-20 theme-transition">
        <div className="w-full px-3 sm:px-6 pt-3.5 pb-3 flex flex-col gap-3">
          {/* Hàng trên cùng: Tên web bên trái — Cụm công cụ dồn sát MÉP PHẢI của màn hình */}
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="font-serif-title text-xl sm:text-3xl font-bold text-[var(--text)] flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="shrink-0">✨</span>
                <EditableText
                  value={siteConfig.siteTitle}
                  onSave={(val) =>
                    handleUpdateSiteConfig({ siteTitle: val }, 'Đổi tên web')
                  }
                  editMode={isEditActive}
                />
              </h1>
              {currentTabInfo && (
                <span className="text-xs text-[var(--muted)] hidden xl:inline-flex items-center gap-1 truncate">
                  <span>·</span>
                  <EditableText
                    value={currentTabInfo.whisper}
                    onSave={(val) => {
                      const nextTabs = siteConfig.tabs.map((t) =>
                        t.id === currentTabInfo.id ? { ...t, whisper: val } : t
                      );
                      handleUpdateSiteConfig(
                        { tabs: nextTabs },
                        'Đổi câu dẫn tab'
                      );
                    }}
                    editMode={isEditActive}
                  />
                </span>
              )}
            </div>

            {/* Cụm công cụ trên cùng luôn dồn sát MÉP PHẢI màn hình */}
            <div className="ml-auto flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
              {/* Số dư Tiền tệ (Cánh hoa hoặc đơn vị tùy chỉnh) */}
              <button
                type="button"
                onClick={() => setActiveTabId('mini-game')}
                title={`Số dư ${siteConfig.currencyName}`}
                className="sticker-chip text-xs inline-flex items-center gap-1 cursor-pointer tabular-nums shrink-0"
              >
                <span>{siteConfig.currencyEmoji}</span>
                <span>{isOwner ? 'Đầy' : petalsBalance}</span>
                <span className="hidden sm:inline">
                  {siteConfig.currencyName}
                </span>
              </button>

              {/* Menu Tài khoản kèm huy hiệu vai trò (Khách / Người dùng / Chủ web) */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] text-xs cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--accent)]/30 flex items-center justify-center text-xs shrink-0">
                    {currentUser.avatarEmoji}
                  </span>
                  <span className="font-bold text-[var(--text)] max-w-[110px] truncate hidden sm:inline">
                    {currentUser.displayName}
                  </span>
                  <span className="sticker-chip text-[10px] py-0.5 px-2 inline-flex items-center gap-1 shrink-0">
                    {currentUser.profileLoaded &&
                      currentUser.profileRole === 'owner' && (
                        <Crown className="w-2.5 h-2.5" />
                      )}
                    {currentUser.profileLoaded &&
                    currentUser.profileRole === 'owner'
                      ? 'Chủ web'
                      : currentUser.role === 'guest'
                      ? 'Khách'
                      : 'Người dùng'}
                  </span>
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl z-40 space-y-3">
                    <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
                      <div className="w-10 h-10 rounded-2xl bg-[var(--accent)]/30 flex items-center justify-center text-lg shrink-0">
                        {currentUser.avatarEmoji}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--text)] truncate">
                          {currentUser.displayName}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] truncate">
                          {currentUser.email || 'Chưa đăng nhập tài khoản'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--muted)]">Vai trò:</span>
                      <span className="sticker-chip text-[11px]">
                        {currentUser.profileLoaded &&
                        currentUser.profileRole === 'owner'
                          ? '👑 Chủ web'
                          : currentUser.role === 'guest'
                          ? '🌱 Khách'
                          : '🌸 Người dùng'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                      {hasEditPermission && (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            setSettingsDrawerOpen(true);
                          }}
                          className="w-full py-2 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)] hover:bg-[var(--accent)]/35 cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <span>⚙️ Cài đặt trang</span>
                        </button>
                      )}

                      {currentUser.role === 'guest' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            setAuthPromptReason(null);
                            setAuthModalOpen(true);
                          }}
                          className="w-full py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Đăng nhập / Đăng ký</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await authService.signOut();
                            setAccountMenuOpen(false);
                            notifyToast('🌱 Đã đăng xuất về chế độ Khách.');
                          }}
                          className="w-full py-2 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Đăng xuất</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Nút "⚙️ Cài đặt trang" đặt đúng vị trí Ctrl+K cũ — CHỈ render khi đã đăng nhập, profiles đã tải xong và role === 'owner' */}
              {hasEditPermission && (
                <button
                  type="button"
                  onClick={() => setSettingsDrawerOpen(true)}
                  title="Mở bảng Cài đặt trang dành cho Chủ web"
                  className="px-3 py-1.5 rounded-full text-xs border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                >
                  <span>⚙️</span>
                  <span className="hidden sm:inline">Cài đặt trang</span>
                </button>
              )}
            </div>
          </div>

          {/* Thanh điều hướng các tab hiển thị (Cho phép bấm sửa trực tiếp tên tab khi đang bật Chế độ chỉnh sửa của Owner) */}
          <nav
            aria-label="Điều hướng sổ tay"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
          >
            {visibleTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    handleSelectTab(tab.id);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] whitespace-nowrap shrink-0 bouncy-btn cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[var(--accent)] text-[#3a2b30] font-bold shadow-xs'
                      : 'bg-[var(--bg)]/70 text-[var(--muted)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--accent)] font-medium'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  {isEditActive && isActive ? (
                    <EditableText
                      value={tab.label}
                      onSave={(newLabel) => {
                        const nextTabs = siteConfig.tabs.map((t) =>
                          t.id === tab.id ? { ...t, label: newLabel } : t
                        );
                        handleUpdateSiteConfig(
                          { tabs: nextTabs },
                          `Đổi tên tab "${tab.label}"`
                        );
                      }}
                      editMode={true}
                    />
                  ) : (
                    <span>{tab.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Thông báo nhỏ */}
      {dailyToast && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="px-4 py-2.5 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] flex items-center justify-between shadow-sm">
            <span>{dailyToast}</span>
            <button
              type="button"
              onClick={() => setDailyToast(null)}
              className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Khu vực nội dung từng tab */}
      <main
        key={dataRevision}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-28"
        aria-live="polite"
      >
        {activeTabId === 'char' && (
          <CharTab
            characters={libraryData.characters}
            creators={libraryData.creators}
            favoriteIds={favoriteIds}
            notesMap={notesMap}
            onToggleFavorite={handleToggleFavorite}
            onSaveNote={handleSaveNote}
            selectedTags={searchSelectedTags}
            onToggleTag={handleToggleSearchTag}
            selectedCreatorId={searchCreatorFilter}
            onSelectCreatorFilter={setSearchCreatorFilter}
            onResetFilters={handleResetSearchFilters}
            unlockedCharIds={unlockedCharIds}
            petalsBalance={petalsBalance}
            onUnlockWithPetals={handleUnlockCharWithPetals}
            onUnlockWithItems={handleUnlockCharWithItems}
            onRequireAuth={handleRequireAuth}
            onGoToMiniGame={() => setActiveTabId('mini-game')}
            searchInputRef={searchInputRef}
            currentUser={currentUser}
            editMode={isEditActive}
            onAddCharacter={handleAddCharacterByCreator}
            onUpdateCharacter={handleUpdateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onMoveCharacter={handleMoveCharacter}
            currencyName={siteConfig.currencyName}
            currencyEmoji={siteConfig.currencyEmoji}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
            customTags={siteConfig.customTags}
            onUpdateCustomTags={(nextTags) =>
              handleUpdateSiteConfig(
                { customTags: nextTags },
                'Cập nhật tag tùy chỉnh'
              )
            }
            supabaseInventory={supabaseInventory}
            isLoadingChars={isLoadingChars}
          />
        )}

        {activeTabId === 'feedback' && (
          <FeedbackTab
            creators={libraryData.creators}
            characters={libraryData.characters}
            currentUser={currentUser}
            onRequireAuth={handleRequireAuth}
            editMode={isEditActive}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
          />
        )}

        {activeTabId === 'nhac' && (
          <MusicTab
            playlist={playlist}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            playMode={playMode}
            playlistSource={playlistSource}
            onSwitchPlaylistSource={setPlaylistSource}
            canEditWebPlaylist={canEditWebPlaylist}
            isLoggedIn={isLoggedInUser}
            onTogglePlay={toggleMusic}
            onSelectTrack={handleSelectTrack}
            onPrevTrack={handlePrevTrack}
            onNextTrack={handleNextTrack}
            onSeek={handleSeekTrack}
            onVolumeChange={(v) => {
              setIsMuted(false);
              setVolume(v);
            }}
            onToggleMute={() => setIsMuted((m) => !m)}
            onCyclePlayMode={handleCyclePlayMode}
            onAddTrack={handleAddMusicTrack}
            onUpdateTrack={handleUpdateMusicTrack}
            onDeleteTrack={handleDeleteMusicTrack}
            onMoveTrack={handleMoveMusicTrack}
            onReorderTracks={handleReorderMusicTracks}
            onRestoreBuiltinTracks={handleRestoreBuiltinTracks}
            editMode={isEditActive}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
          />
        )}

        {activeTabId === 'commission' &&
          canViewCreatorTabs && (
            <CommissionTab
              creators={libraryData.creators}
              currentUser={currentUser}
              onRequireAuth={handleRequireAuth}
              editMode={isEditActive}
              customTexts={siteConfig.customTexts}
              onUpdateCustomText={handleUpdateCustomText}
            />
          )}

        {activeTabId === 'lenh' && (
          <SharedPromptsTab
            creators={libraryData.creators}
            characters={libraryData.characters}
            currentUser={currentUser}
            onRequireAuth={handleRequireAuth}
            editMode={isEditActive}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
          />
        )}

        {activeTabId === 'goc-yeu-thuong' && (
          <LoveCornerTab
            creators={libraryData.creators}
            characters={libraryData.characters}
            currentUser={currentUser}
            onRequireAuth={handleRequireAuth}
            editMode={isEditActive}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
            loveMessages={siteConfig.presets.loveMessages}
            onUpdateLoveMessages={(nextMsgs, label) =>
              handleUpdateSiteConfig(
                {
                  presets: {
                    ...siteConfig.presets,
                    loveMessages: nextMsgs,
                  },
                },
                label || 'Cập nhật Góc yêu thương'
              )
            }
          />
        )}

        {activeTabId === 'request' &&
          canViewCreatorTabs && (
            <RequestTab
              creators={libraryData.creators}
              currentUser={currentUser}
              onRequireAuth={handleRequireAuth}
              editMode={isEditActive}
              customTexts={siteConfig.customTexts}
              onUpdateCustomText={handleUpdateCustomText}
            />
          )}

        {activeTabId === 'mini-game' &&
          (can('play_minigame', currentUser) ? (
            <MiniGameTab
              characters={libraryData.characters}
              petalsBalance={petalsBalance}
              onAddPetals={handleAddPetals}
              currentUser={currentUser}
              editMode={isEditActive}
              currencyName={siteConfig.currencyName}
              currencyEmoji={siteConfig.currencyEmoji}
              customTexts={siteConfig.customTexts}
              onUpdateCustomText={handleUpdateCustomText}
              onInventoryChange={() => {
                refreshUserInventoryAndUnlocks();
              }}
            />
          ) : (
            renderGuestGatePrompt(
              '🐟 Khu Vườn, Hồ Cá & Phòng Tri Kỷ',
              'Mời bạn đăng nhập để mở Gacha mỗi ngày, trồng hoa, nuôi cá, chăm sóc thú cưng ở phòng tri kỷ và pha chế thức uống nhé 🌸'
            )
          ))}

        {activeTabId === 'giveaway' && (
          <GiveawayTab
            creators={libraryData.creators}
            currentUser={currentUser}
            onRequireAuth={handleRequireAuth}
            editMode={isEditActive}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
            giveaways={siteConfig.presets.giveaways}
            onUpdateGiveaways={(nextGiveaways, label) =>
              handleUpdateSiteConfig(
                {
                  presets: {
                    ...siteConfig.presets,
                    giveaways: nextGiveaways,
                  },
                },
                label || 'Cập nhật Giveaway'
              )
            }
          />
        )}

        {activeTabId === 'xep-hang' && (
          <RankingTab
            characters={libraryData.characters}
            creators={libraryData.creators}
            favoriteIds={favoriteIds}
            onOpenCreatorProfile={handleOpenCreatorProfile}
            currentUser={currentUser}
            onRequireAuth={handleRequireAuth}
            editMode={isEditActive}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
          />
        )}

        {activeTabId === 'kho-docs' &&
          (can('use_docs_vault', currentUser) ? (
            <DocsVaultTab
              editMode={isEditActive}
              customTexts={siteConfig.customTexts}
              onUpdateCustomText={handleUpdateCustomText}
              docArticles={siteConfig.presets.docs}
              onUpdateDocArticles={(nextDocs, label) =>
                handleUpdateSiteConfig(
                  {
                    presets: {
                      ...siteConfig.presets,
                      docs: nextDocs,
                    },
                  },
                  label || 'Cập nhật Kho Docs'
                )
              }
            />
          ) : (
            renderGuestGatePrompt(
              '📒 Kho Docs & Sổ Tay Cá Nhân',
              'Mời bạn đăng nhập để mở trình soạn thảo tài liệu, lưu trữ hướng dẫn và xuất file Markdown/TXT nhé 💌'
            )
          ))}

        {activeTabId === 'kho-lenh' &&
          canViewCreatorTabs && (
            <PersonalPromptVaultTab
              currentUser={currentUser}
              onRequireAuth={handleRequireAuth}
              editMode={isEditActive}
              customTexts={siteConfig.customTexts}
              onUpdateCustomText={handleUpdateCustomText}
            />
          )}

        {activeTabId === 'tram-cuu-ho' && (
          <RescueStationTab
            currentUser={currentUser}
            onRequireAuth={handleRequireAuth}
            editMode={isEditActive}
            customTexts={siteConfig.customTexts}
            onUpdateCustomText={handleUpdateCustomText}
            rescueFaqs={siteConfig.faqs}
            onUpdateFaqs={(nextFaqs, label) =>
              handleUpdateSiteConfig(
                { faqs: nextFaqs },
                label || 'Cập nhật câu hỏi FAQ'
              )
            }
            rescueTickets={siteConfig.presets.rescueReports}
            onUpdateRescueTickets={(nextTickets, label) =>
              handleUpdateSiteConfig(
                {
                  presets: {
                    ...siteConfig.presets,
                    rescueReports: nextTickets,
                  },
                },
                label || 'Cập nhật Trạm cứu hộ'
              )
            }
            backupEntries={siteConfig.presets.backups}
            onUpdateBackups={(nextBackups, label) =>
              handleUpdateSiteConfig(
                {
                  presets: {
                    ...siteConfig.presets,
                    backups: nextBackups,
                  },
                },
                label || 'Cập nhật Sổ lưu trữ dự phòng'
              )
            }
          />
        )}
      </main>

      {/* Chân trang ấm áp kèm nút Export / Import JSON toàn bộ dữ liệu */}
      <footer className="w-full border-t border-[var(--border)] bg-[var(--surface)]/70 py-6 px-4 sm:px-6 text-xs text-[var(--muted)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-serif-title text-sm text-[var(--text)]/80">
            <EditableText
              value={siteConfig.footerText}
              onSave={(val) =>
                handleUpdateSiteConfig({ footerText: val }, 'Đổi lời chân trang')
              }
              editMode={isEditActive}
            />
          </div>

          {hasEditPermission && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportAllJson}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] text-[var(--text)] transition-colors cursor-pointer font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] text-[var(--text)] transition-colors cursor-pointer font-semibold">
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
                <input
                  ref={fileImportRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </footer>

      {/* Cụm điều khiển ở góc dưới bên phải: Bật/tắt Sáng/Tối + 5 màu nhấn + Trình phát nhạc mở rộng thành bảng "Playlist" dễ thương */}
      <CornerMusicWidget
        playlist={playlist}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        playMode={playMode}
        playlistSource={playlistSource}
        onSwitchPlaylistSource={setPlaylistSource}
        canEditWebPlaylist={canEditWebPlaylist}
        isLoggedIn={isLoggedInUser}
        onTogglePlay={toggleMusic}
        onSelectTrack={handleSelectTrack}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onSeek={handleSeekTrack}
        onVolumeChange={(v) => {
          setIsMuted(false);
          setVolume(v);
        }}
        onToggleMute={() => setIsMuted((m) => !m)}
        onCyclePlayMode={handleCyclePlayMode}
        onAddTrack={handleAddMusicTrack}
        onUpdateTrack={handleUpdateMusicTrack}
        onDeleteTrack={handleDeleteMusicTrack}
        onMoveTrack={handleMoveMusicTrack}
        onReorderTracks={handleReorderMusicTracks}
        onRestoreBuiltinTracks={handleRestoreBuiltinTracks}
        colorMode={colorMode}
        onToggleColorMode={handleToggleColorMode}
        themes={activeThemesList}
        activeThemeId={activeThemeId}
        currentTheme={currentTheme}
        onSelectTheme={setActiveThemeId}
      />

      {welcomeGiftModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--card)] border-2 border-[var(--accent)] rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative">
            <div className="text-4xl mb-2">🎁✨</div>
            <h3 className="text-lg font-bold text-[var(--text)] mb-2">Quà Chào Mừng</h3>
            <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">
              Chào mừng bạn mới! Tặng bạn {welcomeGiftModalData.flowers} 🌸 Hoa và {welcomeGiftModalData.coins} 🪙 Xu.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  setWelcomeGiftModalData(null);
                  setActiveTabId('mini-game');
                }}
                className="px-4 py-2 bg-[var(--accent)] text-[#3a2b30] font-bold rounded-xl text-xs hover:opacity-90 shadow-2xs cursor-pointer"
              >
                Xem Kho đồ ✨
              </button>
              <button
                type="button"
                onClick={() => {
                  setWelcomeGiftModalData(null);
                  setActiveTabId('mini-game');
                }}
                className="px-4 py-2 bg-[var(--border)] text-[var(--text)] font-bold rounded-xl text-xs hover:opacity-80 shadow-2xs cursor-pointer"
              >
                Đi mua sắm 🛍️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
