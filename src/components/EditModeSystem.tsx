import React, { useState, useEffect } from 'react';
import {
  Pencil,
  Settings,
  Undo2,
  RotateCcw,
  Download,
  Upload,
  HelpCircle,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Music,
  Sparkles,
  Palette,
  Crown,
  UserCheck,
  CheckCircle2,
  XCircle,
  DoorOpen,
  Users,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  AuthUser,
  can,
} from '../services/authLayer';
import {
  fetchAdminListUsersFromSupabase,
  AdminListedUser,
  fetchMarketPricesFromSupabase,
  updateMarketPriceOnSupabase,
  fetchQuestPoolFromSupabase,
  createQuestPoolRow,
  updateQuestPoolRow,
  deleteQuestPoolRow,
  MarketPriceRow,
  QuestPoolRow,
  DEFAULT_MARKET_PRICES,
  QUEST_ACTION_DEFINITIONS,
  QuestActionType,
} from '../services/supabaseService';
import {
  SiteConfig,
  NavTabConfig,
  DEFAULT_GACHA_DAILY_DESC,
  DEFAULT_MARKET_TEXTS,
  MarketTextsConfig,
} from '../services/siteSettings';
import {
  TagVoiceProfile,
  TagPetProfile,
  DialogueSituation,
  PetBehaviorStyle,
  DEFAULT_TAG_VOICES,
  DEFAULT_TAG_PETS,
  sanitizePetVibeNote,
  AddressKeywordRule,
  DEFAULT_ADDRESS_MAP,
  resolveAddress,
} from '../services/tagCompanionSystem';
import { CharacterItem } from '../data/sampleData';
import { ThemeConfig, ColorMode } from '../constants/themes';

interface EditModeSystemProps {
  currentUser: AuthUser;
  editMode: boolean;
  onToggleEditMode: () => void;
  drawerOpen: boolean;
  onSetDrawerOpen: (open: boolean) => void;
  siteConfig: SiteConfig;
  onUpdateSiteConfig: (patch: Partial<SiteConfig>, undoLabel?: string) => void;
  undoCount: number;
  lastUndoLabel: string | null;
  onUndo: () => void;
  onResetDefaults: () => void;
  onExportJson: () => void;
  onTriggerImportJson: () => void;
  onReopenGate: () => void;
  showGuideModal: boolean;
  onCloseGuideModal: () => void;
  onOpenGuideModal: () => void;
  onNotify: (msg: string) => void;
  characters?: CharacterItem[];
}

export const EditModeSystem: React.FC<EditModeSystemProps> = ({
  currentUser,
  editMode,
  onToggleEditMode,
  drawerOpen,
  onSetDrawerOpen: setDrawerOpen,
  siteConfig,
  onUpdateSiteConfig,
  undoCount,
  lastUndoLabel,
  onUndo,
  onResetDefaults,
  onExportJson,
  onTriggerImportJson,
  onReopenGate,
  showGuideModal,
  onCloseGuideModal,
  onOpenGuideModal,
  onNotify,
  characters = [],
}) => {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [newMp3Url, setNewMp3Url] = useState('');
  const [localFileWarning, setLocalFileWarning] = useState<string | null>(null);

  // Danh sách thành viên từ RPC admin_list_users() (chỉ giữ trong bộ nhớ, KHÔNG lưu vào localStorage)
  const [membersList, setMembersList] = useState<AdminListedUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersNotAllowed, setMembersNotAllowed] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSort, setMemberSort] = useState<'newest' | 'oldest'>('newest');

  // Quản lý mục "Giọng nói và thú cưng theo tag" (lưu vào site_settings: tag_voices & tag_pets)
  const tagVoicesList: TagVoiceProfile[] =
    Array.isArray(siteConfig.tagVoices) && siteConfig.tagVoices.length > 0
      ? siteConfig.tagVoices
      : DEFAULT_TAG_VOICES;
  const tagPetsList: TagPetProfile[] =
    Array.isArray(siteConfig.tagPets) && siteConfig.tagPets.length > 0
      ? siteConfig.tagPets
      : DEFAULT_TAG_PETS;

  const [selectedTagId, setSelectedTagId] = useState<string>(
    () => tagVoicesList[0]?.id || 'diu_dang'
  );
  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [activeDialogueTab, setActiveDialogueTab] =
    useState<DialogueSituation>('greeting');
  const [newDialogueLine, setNewDialogueLine] = useState('');
  const [newPetSpeciesInput, setNewPetSpeciesInput] = useState('');
  const [tagCompanionSavedMsg, setTagCompanionSavedMsg] = useState<string | null>(null);

  const normalizeTagSearch = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();

  const flashTagCompanionSaved = (msg: string) => {
    setTagCompanionSavedMsg(msg);
    setTimeout(() => {
      setTagCompanionSavedMsg((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  // 7. Quản lý Chợ nhỏ (market_prices) & Quản lý Nhiệm vụ (quest_pool) trên Supabase
  const [marketPricesList, setMarketPricesList] =
    useState<MarketPriceRow[]>(DEFAULT_MARKET_PRICES);
  const [questPoolList, setQuestPoolList] = useState<QuestPoolRow[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketFeedbackMsg, setMarketFeedbackMsg] = useState<string | null>(null);
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestAction, setNewQuestAction] = useState<QuestActionType>('water');
  const [newQuestTarget, setNewQuestTarget] = useState<number>(1);
  const [newQuestReward, setNewQuestReward] = useState<number>(5);

  // 8. Quản lý Xưng hô và giọng nói (address_map)
  const addressMapList: AddressKeywordRule[] =
    Array.isArray(siteConfig.addressMap) && siteConfig.addressMap.length > 0
      ? siteConfig.addressMap
      : DEFAULT_ADDRESS_MAP;
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  const [newRuleSelf, setNewRuleSelf] = useState('anh');
  const [newRuleUser, setNewRuleUser] = useState('em');
  const [newRuleNote, setNewRuleNote] = useState('');

  const marketTexts: MarketTextsConfig = {
    ...DEFAULT_MARKET_TEXTS,
    ...(siteConfig.marketTexts || {}),
  };

  const flashMarketFeedback = (msg: string) => {
    setMarketFeedbackMsg(msg);
    setTimeout(() => {
      setMarketFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const loadMarketAndQuests = async () => {
    setMarketLoading(true);
    try {
      const [prices, quests] = await Promise.all([
        fetchMarketPricesFromSupabase(),
        fetchQuestPoolFromSupabase(),
      ]);
      setMarketPricesList(prices);
      setQuestPoolList(quests);
    } catch {
      // Bỏ qua lỗi
    } finally {
      setMarketLoading(false);
    }
  };

  const handleSaveMarketPrice = async (row: MarketPriceRow) => {
    const res = await updateMarketPriceOnSupabase(row);
    flashMarketFeedback(res.message);
  };

  const handleToggleMarketItem = async (kind: string, enabled: boolean) => {
    const next = marketPricesList.map((p) =>
      p.kind === kind ? { ...p, enabled } : p
    );
    setMarketPricesList(next);
    const target = next.find((p) => p.kind === kind);
    if (target) {
      const res = await updateMarketPriceOnSupabase(target);
      flashMarketFeedback(res.message);
    }
  };

  const handleUpdateQuestField = async (
    id: string | number,
    patch: Partial<QuestPoolRow>
  ) => {
    const next = questPoolList.map((q) =>
      q.id === id ? { ...q, ...patch } : q
    );
    setQuestPoolList(next);
    const ok = await updateQuestPoolRow(id, patch);
    if (ok) flashMarketFeedback('Đã cập nhật nhiệm vụ thành công!');
    else flashMarketFeedback('Không thể cập nhật nhiệm vụ.');
  };

  const handleDeleteQuest = async (id: string | number) => {
    const next = questPoolList.filter((q) => q.id !== id);
    setQuestPoolList(next);
    const ok = await deleteQuestPoolRow(id);
    if (ok) flashMarketFeedback('Đã xóa nhiệm vụ khỏi kho nhiệm vụ!');
    else flashMarketFeedback('Không thể xóa nhiệm vụ.');
  };

  const handleCreateNewQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newQuestTitle.trim();
    if (!title) return;
    const ok = await createQuestPoolRow({
      title,
      reward: newQuestReward || 5,
      action: newQuestAction || 'water',
      target: newQuestTarget || 1,
      active: true,
    });
    if (ok) {
      setNewQuestTitle('');
      setNewQuestReward(5);
      setNewQuestTarget(1);
      flashMarketFeedback(`Đã thêm nhiệm vụ "${title}" (+${newQuestReward} Xu)!`);
      const refreshed = await fetchQuestPoolFromSupabase();
      setQuestPoolList(refreshed);
    } else {
      flashMarketFeedback('Không thể thêm nhiệm vụ mới.');
    }
  };

  // GHI CHÚ BẢO MẬT: Ẩn giao diện chỉ cho gọn, bảo mật thật nằm ở RLS trên Supabase.
  const canEdit = can('edit', currentUser);
  const canOpenSiteSettings = can('site_settings', currentUser);

  const loadMembersFromRpc = async () => {
    setMembersLoading(true);
    setMembersError(null);
    const res = await fetchAdminListUsersFromSupabase();
    setMembersLoading(false);
    if (res.notAllowed) {
      setMembersNotAllowed(true);
      return;
    }
    if (!res.ok) {
      setMembersError(res.error || 'Không thể tải danh sách thành viên.');
      return;
    }
    setMembersNotAllowed(false);
    setMembersList(res.users);
  };

  useEffect(() => {
    if (!canOpenSiteSettings && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [canOpenSiteSettings, drawerOpen]);

  useEffect(() => {
    if (drawerOpen && canOpenSiteSettings) {
      loadMembersFromRpc();
      loadMarketAndQuests();
    }
  }, [drawerOpen, canOpenSiteSettings, currentUser.id]);

  const filteredAndSortedMembers = React.useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const filtered = membersList.filter((m) => {
      if (!q) return true;
      return (
        m.username.toLowerCase().includes(q) ||
        m.display_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return memberSort === 'newest' ? tb - ta : ta - tb;
    });
  }, [membersList, memberSearch, memberSort]);

  const handleExportMembersCsv = () => {
    const headers = [
      'Tên tài khoản',
      'Tên hiển thị',
      'Email',
      'Vai trò',
      'Ngày đăng ký',
    ];
    const escapeCsv = (val: string) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = filteredAndSortedMembers.map((u) => {
      const roleVi = u.role === 'owner' ? 'Chủ web' : 'Người dùng';
      const dateStr = u.created_at
        ? new Date(u.created_at).toLocaleString('vi-VN')
        : '';
      return [
        escapeCsv(u.username),
        escapeCsv(u.display_name),
        escapeCsv(u.email),
        escapeCsv(roleVi),
        escapeCsv(dateStr),
      ].join(',');
    });

    const csvContent =
      '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thanh-vien-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!canEdit) {
    return null;
  }

  // Xử lý ẩn/hiện & sắp xếp tab trong "Cài đặt trang"
  const handleMoveTab = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siteConfig.tabs.length) return;
    const nextTabs = [...siteConfig.tabs];
    const [moved] = nextTabs.splice(index, 1);
    nextTabs.splice(targetIndex, 0, moved);
    onUpdateSiteConfig({ tabs: nextTabs }, 'Đổi thứ tự tab');
  };

  const handleToggleTabVisible = (tabId: string) => {
    const visibleCount = siteConfig.tabs.filter((t) => t.visible).length;
    const target = siteConfig.tabs.find((t) => t.id === tabId);
    if (target?.visible && visibleCount <= 1) {
      onNotify('🌸 Cần giữ lại ít nhất 1 tab hiển thị trên thanh điều hướng nhé!');
      return;
    }
    const nextTabs: NavTabConfig[] = siteConfig.tabs.map((t) =>
      t.id === tabId ? { ...t, visible: !t.visible } : t
    );
    onUpdateSiteConfig({ tabs: nextTabs }, 'Ẩn/hiện tab');
  };

  const handleUpdateTabField = (
    tabId: string,
    field: 'label' | 'emoji' | 'whisper',
    value: string
  ) => {
    const nextTabs: NavTabConfig[] = siteConfig.tabs.map((t) =>
      t.id === tabId ? { ...t, [field]: value } : t
    );
    onUpdateSiteConfig({ tabs: nextTabs }, 'Đổi tên tab');
  };

  // Xử lý đổi bộ 5 màu nhấn bằng color picker
  const handleUpdateThemeColor = (
    themeId: string,
    patch: Partial<ThemeConfig>
  ) => {
    const nextThemes = siteConfig.themes.map((th) => {
      if (th.id !== themeId) return th;
      const updatedAccent = patch.accent || th.accent;
      return {
        ...th,
        ...patch,
        accent: updatedAccent,
        vars: { '--accent': updatedAccent },
      };
    });
    onUpdateSiteConfig({ themes: nextThemes }, 'Đổi bảng màu nhấn');
  };

  // Xử lý thêm / xóa link nhạc MP3
  const handleAddMp3Url = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMp3Url.trim();
    if (!trimmed) return;
    if (siteConfig.musicUrls.includes(trimmed)) {
      setNewMp3Url('');
      return;
    }
    onUpdateSiteConfig(
      { musicUrls: [...siteConfig.musicUrls, trimmed] },
      'Thêm link nhạc MP3'
    );
    setNewMp3Url('');
    onNotify('🎵 Đã thêm link nhạc MP3 vào danh sách phát!');
  };

  const handleRemoveMp3Url = (urlToRemove: string) => {
    onUpdateSiteConfig(
      {
        musicUrls: siteConfig.musicUrls.filter((u) => u !== urlToRemove),
      },
      'Xóa link nhạc MP3'
    );
  };

  return (
    <>
      {/* 1. Nút ✏️ "Chỉnh sửa" cố định ở góc dưới bên trái (Chỉ hiện khi đã tải xong profile và role === 'owner') */}
      <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2 max-w-[calc(100vw-2rem)]">
        {editMode && (
          <div className="p-3 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--surface)]/95 backdrop-blur-md shadow-xl flex flex-wrap items-center gap-2 text-xs">
            {/* Nút mở lại màn hình cổng để sửa lời chào ở cổng trực tiếp */}
            <button
              type="button"
              onClick={onReopenGate}
              title="Mở màn hình cổng để sửa trực tiếp câu chào"
              className="px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1"
            >
              <DoorOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="hidden sm:inline">Sửa cổng</span>
            </button>

            {/* Nút Hoàn tác (Undo) */}
            <button
              type="button"
              onClick={onUndo}
              disabled={undoCount === 0}
              title={
                lastUndoLabel
                  ? `Hoàn tác: ${lastUndoLabel}`
                  : 'Chưa có thao tác nào để hoàn tác'
              }
              className="px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Hoàn tác ({undoCount})</span>
            </button>

            {/* Nút Khôi phục mặc định (hỏi lại nhẹ nhàng) */}
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Khôi phục mặc định</span>
            </button>

            {/* Xuất / Nhập file cấu hình JSON */}
            <button
              type="button"
              onClick={onExportJson}
              title="Xuất file cấu hình JSON"
              className="px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="hidden sm:inline">Xuất JSON</span>
            </button>

            <button
              type="button"
              onClick={onTriggerImportJson}
              title="Nhập file cấu hình JSON"
              className="px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="hidden sm:inline">Nhập JSON</span>
            </button>

            {/* Hướng dẫn nhanh 3 bước */}
            <button
              type="button"
              onClick={onOpenGuideModal}
              title="Xem hướng dẫn nhanh 3 bước"
              className="p-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleEditMode}
          className={`px-4 py-2.5 rounded-full text-xs font-bold border-2 shadow-md bouncy-btn cursor-pointer inline-flex items-center gap-2 ${
            editMode
              ? 'border-dashed border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
              : 'border-[var(--border)] bg-[var(--surface)]/95 text-[var(--text)] hover:border-[var(--accent)]'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>
            {editMode ? '✏️ Đang Chỉnh sửa (Bấm để tắt)' : '✏️ Chỉnh sửa'}
          </span>
        </button>
      </div>

      {/* 2. Hộp thoại Hướng dẫn nhanh lần đầu bật Chế độ chỉnh sửa (3 bước ngắn, đáng yêu) */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={onCloseGuideModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md soft-card p-6 sm:p-8 border-2 border-[var(--accent)] space-y-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="sticker-chip text-xs mb-2 inline-block">
                  ✨ Cẩm nang nhỏ cho Chủ web
                </span>
                <h2 className="font-serif-title text-2xl font-bold text-[var(--text)]">
                  3 Bước Chỉnh Sửa Góc Nhỏ 🌸
                </h2>
              </div>
              <button
                type="button"
                onClick={onCloseGuideModal}
                className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="p-3.5 rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-1">
                <div className="font-bold text-[var(--text)]">
                  1️⃣ Bấm vào chữ có viền nét đứt để gõ sửa ngay
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Tên web, câu chào ở cổng, tên tab, tiêu đề, mô tả, FAQ hay câu thoại trong game đều có thể bấm vào gõ sửa trực tiếp và tự động lưu lên Supabase!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-1">
                <div className="font-bold text-[var(--text)]">
                  2️⃣ Thêm ➕, Sửa ✏️, Xóa 🗑️ & Sắp xếp ↕️ kèm link ảnh
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Mỗi thẻ dữ liệu đều có cụm nút nhỏ để Chủ web sửa chi tiết, dán link ảnh minh họa hoặc đổi thứ tự.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-1">
                <div className="font-bold text-[var(--text)]">
                  3️⃣ Bảng "Cài đặt trang" ⚙️ & Hoàn tác ↩️ an toàn
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Chủ web có thể mở bảng <strong>Cài đặt trang</strong> để chọn 5 màu nhấn, thêm nhạc MP3, ẩn/hiện tab, đổi tên tiền tệ và xem danh sách thành viên.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseGuideModal}
              className="w-full py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer"
            >
              ✨ Đã hiểu, bắt đầu trang trí thôi!
            </button>
          </div>
        </div>
      )}

      {/* 3. Hộp thoại hỏi lại nhẹ nhàng khi bấm "Khôi phục mặc định" */}
      {confirmResetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setConfirmResetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md soft-card p-6 border-2 border-[var(--accent)] space-y-4 shadow-2xl text-center"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--accent)]/25 flex items-center justify-center mx-auto text-xl">
              🌸
            </div>
            <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
              Khôi phục góc nhỏ về mặc định?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              Các chỉnh sửa văn bản, màu sắc và mục dữ liệu tự thêm sẽ trở về trạng thái ban đầu của sổ tay. (Bạn vẫn có thể bấm <strong>Hoàn tác</strong> ngay sau đó nếu đổi ý nhé!).
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-5 py-2 rounded-full text-xs font-semibold border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Giữ nguyên hiện tại
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetOpen(false);
                  onResetDefaults();
                }}
                className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
              >
                🔄 Đồng ý khôi phục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bảng "Cài đặt trang" kéo ra từ cạnh phải (Chỉ dành cho Chủ web) */}
      {drawerOpen && canOpenSiteSettings && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl h-full bg-[var(--surface)] border-l-2 border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Đầu bảng Cài đặt trang */}
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--bg)]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[var(--accent)]/30 flex items-center justify-center text-base">
                  👑
                </div>
                <div>
                  <h2 className="font-serif-title text-xl font-bold text-[var(--text)]">
                    Cài Đặt Trang (Chủ Web)
                  </h2>
                  <p className="text-[11px] text-[var(--muted)]">
                    Tùy biến toàn bộ sổ tay · Lưu trực tiếp lên Supabase (site_settings)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nội dung cuộn của bảng Cài đặt trang */}
            <div className="flex-1 overflow-y-auto p-5 space-y-7 text-xs">
              {/* Mục 1: Tên web, Slogan, Lời ở cổng & Đơn vị tiền tệ */}
              <section className="space-y-3">
                <h3 className="font-serif-title text-lg font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  <span>1. Tên web, Slogan, Lời chào cổng & Tiền tệ</span>
                </h3>

                <div className="space-y-2.5 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      Tên trang web:
                    </label>
                    <input
                      type="text"
                      value={siteConfig.siteTitle}
                      onChange={(e) =>
                        onUpdateSiteConfig(
                          { siteTitle: e.target.value },
                          'Đổi tên web'
                        )
                      }
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      Slogan nhãn dán ở cổng:
                    </label>
                    <input
                      type="text"
                      value={siteConfig.siteSlogan}
                      onChange={(e) =>
                        onUpdateSiteConfig(
                          { siteSlogan: e.target.value },
                          'Đổi slogan'
                        )
                      }
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      Lời tự sự chào đón ở màn hình cổng:
                    </label>
                    <textarea
                      rows={3}
                      value={siteConfig.gateGreeting}
                      onChange={(e) =>
                        onUpdateSiteConfig(
                          { gateGreeting: e.target.value },
                          'Đổi lời chào ở cổng'
                        )
                      }
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Tên đơn vị tiền tệ:
                      </label>
                      <input
                        type="text"
                        value={siteConfig.currencyName}
                        onChange={(e) =>
                          onUpdateSiteConfig(
                            { currencyName: e.target.value || 'Cánh hoa' },
                            'Đổi tên đơn vị tiền'
                          )
                        }
                        placeholder="Cánh hoa"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Emoji đơn vị tiền:
                      </label>
                      <input
                        type="text"
                        value={siteConfig.currencyEmoji}
                        onChange={(e) =>
                          onUpdateSiteConfig(
                            { currencyEmoji: e.target.value || '🌸' },
                            'Đổi icon tiền tệ'
                          )
                        }
                        placeholder="🌸"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Tên tiền Xu (Chợ nhỏ):
                      </label>
                      <input
                        type="text"
                        value={siteConfig.coinCurrencyName || 'Xu'}
                        onChange={(e) =>
                          onUpdateSiteConfig(
                            { coinCurrencyName: e.target.value || 'Xu' },
                            'Đổi tên tiền Xu'
                          )
                        }
                        placeholder="Xu"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Emoji tiền Xu (Chợ nhỏ):
                      </label>
                      <input
                        type="text"
                        value={siteConfig.coinCurrencyEmoji || '🪙'}
                        onChange={(e) =>
                          onUpdateSiteConfig(
                            { coinCurrencyEmoji: e.target.value || '🪙' },
                            'Đổi emoji tiền Xu'
                          )
                        }
                        placeholder="🪙"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      Mô tả Gacha ở Mini game (lưu vào site_settings, không chứa tên char):
                    </label>
                    <textarea
                      rows={3}
                      value={
                        siteConfig.customTexts['gacha_daily_desc'] ??
                        DEFAULT_GACHA_DAILY_DESC
                      }
                      onChange={(e) =>
                        onUpdateSiteConfig(
                          {
                            customTexts: {
                              ...siteConfig.customTexts,
                              gacha_daily_desc: e.target.value,
                            },
                          },
                          'Sửa dòng mô tả Gacha ở Mini game'
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-[var(--muted)]">
                        Giữ nguyên emoji 🌱 🥚 🐾 ☕ và dùng từ &quot;người thương&quot; thay vì tên char.
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSiteConfig(
                            {
                              customTexts: {
                                ...siteConfig.customTexts,
                                gacha_daily_desc: DEFAULT_GACHA_DAILY_DESC,
                              },
                            },
                            'Khôi phục mô tả Gacha mặc định'
                          )
                        }
                        className="text-[10px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Khôi phục câu chuẩn
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Mục 2: Chọn bộ 5 màu nhấn bằng Color Picker & Chế độ Sáng/Tối mặc định */}
              <section className="space-y-3">
                <h3 className="font-serif-title text-lg font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-[var(--accent)]" />
                  <span>2. Bộ 5 Màu Nhấn & Chế Độ Sáng/Tối Mặc Định</span>
                </h3>

                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1.5">
                      Chế độ Sáng / Tối mặc định khi mới vào:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'system', label: '🖥️ Theo thiết bị' },
                          { id: 'light', label: '🌞 Sáng ấm' },
                          { id: 'dark', label: '🌙 Tối dịu' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onUpdateSiteConfig(
                              {
                                defaultColorMode: opt.id as
                                  | 'system'
                                  | ColorMode,
                              },
                              'Đổi chế độ sáng/tối mặc định'
                            )
                          }
                          className={`py-1.5 px-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                            siteConfig.defaultColorMode === opt.id
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
                              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <div className="text-[11px] font-semibold text-[var(--muted)]">
                      Tùy chỉnh 5 chấm màu nhấn (Color Picker):
                    </div>
                    {siteConfig.themes.map((th) => (
                      <div
                        key={th.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="color"
                            value={th.accent}
                            onChange={(e) =>
                              handleUpdateThemeColor(th.id, {
                                accent: e.target.value,
                              })
                            }
                            aria-label={`Chọn mã màu cho ${th.name}`}
                            className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={th.emoji}
                            onChange={(e) =>
                              handleUpdateThemeColor(th.id, {
                                emoji: e.target.value,
                              })
                            }
                            className="w-9 px-1.5 py-1 text-center bg-[var(--bg)] border border-[var(--border)] rounded-lg"
                          />
                          <input
                            type="text"
                            value={th.name}
                            onChange={(e) =>
                              handleUpdateThemeColor(th.id, {
                                name: e.target.value,
                              })
                            }
                            className="flex-1 px-2.5 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-semibold text-[var(--text)]"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[var(--muted)]">
                          {th.accent}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Mục 3: Ẩn/Hiện & Đổi thứ tự 12 Tab điều hướng */}
              <section className="space-y-3">
                <h3 className="font-serif-title text-lg font-bold text-[var(--text)]">
                  3. Ẩn / Hiện & Sắp Xếp Thứ Tự Các Tab
                </h3>

                <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] space-y-2 max-h-72 overflow-y-auto">
                  {siteConfig.tabs.map((tab, idx) => (
                    <div
                      key={tab.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                        tab.visible
                          ? 'border-[var(--border)] bg-[var(--surface)]'
                          : 'border-dashed border-[var(--border)] bg-[var(--bg)]/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="text"
                          value={tab.emoji}
                          onChange={(e) =>
                            handleUpdateTabField(
                              tab.id,
                              'emoji',
                              e.target.value
                            )
                          }
                          className="w-8 px-1 py-1 text-center bg-[var(--bg)] border border-[var(--border)] rounded-lg"
                        />
                        <input
                          type="text"
                          value={tab.label}
                          onChange={(e) =>
                            handleUpdateTabField(
                              tab.id,
                              'label',
                              e.target.value
                            )
                          }
                          className="flex-1 min-w-0 px-2.5 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-semibold text-[var(--text)]"
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveTab(idx, 'up')}
                          title="Đưa tab lên"
                          className="p-1 rounded-lg hover:bg-[var(--accent)]/20 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === siteConfig.tabs.length - 1}
                          onClick={() => handleMoveTab(idx, 'down')}
                          title="Đưa tab xuống"
                          className="p-1 rounded-lg hover:bg-[var(--accent)]/20 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTabVisible(tab.id)}
                          title={tab.visible ? 'Ẩn tab này' : 'Hiện tab này'}
                          className={`px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                            tab.visible
                              ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)]'
                              : 'border-[var(--border)] text-[var(--muted)]'
                          }`}
                        >
                          {tab.visible ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Hiện</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Ẩn</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Mục 4: Hiệu ứng lấp lánh, Hạt bay & Danh sách nhạc MP3 */}
              <section className="space-y-3">
                <h3 className="font-serif-title text-lg font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-[var(--accent)]" />
                  <span>4. Hiệu Ứng Hạt & Danh Sách Link Nhạc MP3</span>
                </h3>

                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] space-y-3">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="font-semibold text-[var(--text)]">
                      ✨ Hiệu ứng lấp lánh theo con trỏ chuột
                    </span>
                    <input
                      type="checkbox"
                      checked={siteConfig.sparkleEnabled}
                      onChange={(e) =>
                        onUpdateSiteConfig(
                          { sparkleEnabled: e.target.checked },
                          'Bật/tắt lấp lánh chuột'
                        )
                      }
                      style={{ accentColor: 'var(--accent)' }}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="font-semibold text-[var(--text)]">
                      🌸 Hạt pastel bay lơ lửng nền
                    </span>
                    <input
                      type="checkbox"
                      checked={siteConfig.floatingParticlesEnabled}
                      onChange={(e) =>
                        onUpdateSiteConfig(
                          { floatingParticlesEnabled: e.target.checked },
                          'Bật/tắt hạt bay nền'
                        )
                      }
                      style={{ accentColor: 'var(--accent)' }}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="font-semibold text-[var(--text)]">
                      🎵 Tự phát nhạc nền khi bấm "Bước vào"
                    </span>
                    <input
                      type="checkbox"
                      checked={siteConfig.defaultMusicEnabled}
                      onChange={(e) =>
                        onUpdateSiteConfig(
                          { defaultMusicEnabled: e.target.checked },
                          'Bật/tắt nhạc mặc định'
                        )
                      }
                      style={{ accentColor: 'var(--accent)' }}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <div className="pt-2 border-t border-[var(--border)] space-y-2">
                    <div className="text-[11px] font-semibold text-[var(--muted)]">
                      Danh sách link nhạc MP3 của Web (Lưu ở key <code>web_playlist</code>; nếu để trống sẽ phát tiếng hộp nhạc ambient mặc định):
                    </div>

                    <form onSubmit={handleAddMp3Url} className="flex gap-2">
                      <input
                        type="url"
                        value={newMp3Url}
                        onChange={(e) => {
                          setNewMp3Url(e.target.value);
                          if (localFileWarning) setLocalFileWarning(null);
                        }}
                        placeholder="Dán link file .mp3 trực tiếp (https://.../nhac.mp3)"
                        className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer shrink-0 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm link MP3</span>
                      </button>
                    </form>

                    {/* Kiểm tra nếu Chủ web thử chọn file từ máy cho Playlist Web -> Báo rõ lý do & gợi ý dán link MP3 */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] text-[var(--muted)]">
                        Chỉ nhận link <code>.mp3</code> trực tiếp để mọi người truy cập web đều nghe được.
                      </span>
                      <label className="text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] underline cursor-pointer shrink-0">
                        <span>Thử tải file từ máy?</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setLocalFileWarning(
                                '⚠️ Playlist của web chỉ nhận link MP3 trực tiếp! File tải từ máy lên chỉ lưu trên trình duyệt của chính máy đó nên người khác vào web sẽ không nghe được. Bạn hãy tải file lên host và dán link .mp3 trực tiếp vào ô bên trên nhé 🌸'
                              );
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {localFileWarning && (
                      <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-[var(--text)] leading-relaxed">
                        {localFileWarning}
                      </div>
                    )}

                    {siteConfig.musicUrls.length === 0 ? (
                      <p className="text-[11px] text-[var(--muted)] italic">
                        Chưa có link MP3 nào — đang dùng bộ tổng hợp âm thanh Hộp nhạc & Chuông nhẹ mặc định.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {siteConfig.musicUrls.map((url, i) => (
                          <div
                            key={`${url}-${i}`}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                          >
                            <span className="truncate text-[11px] text-[var(--text)]">
                              🎵 {url}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMp3Url(url)}
                              className="p-1 text-[var(--muted)] hover:text-red-500 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Mục 5: 👥 Thành viên (gọi supabase.rpc("admin_list_users")) — ẩn nếu rpc báo lỗi not_allowed */}
              {!membersNotAllowed && (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-serif-title text-lg font-bold text-[var(--text)] flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[var(--accent)]" />
                      <span>
                        5. 👥 Thành viên ({membersList.length} thành viên)
                      </span>
                    </h3>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={loadMembersFromRpc}
                        disabled={membersLoading}
                        className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-bold hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            membersLoading ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Làm mới</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportMembersCsv}
                        disabled={filteredAndSortedMembers.length === 0}
                        className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất CSV</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] space-y-3">
                    {/* Ô tìm kiếm & sắp xếp mới nhất / cũ nhất */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-8 relative">
                        <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          placeholder="Tìm theo tên tài khoản, tên hiển thị, email..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <select
                          value={memberSort}
                          onChange={(e) =>
                            setMemberSort(
                              e.target.value as 'newest' | 'oldest'
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                        >
                          <option value="newest">Mới nhất trước</option>
                          <option value="oldest">Cũ nhất trước</option>
                        </select>
                      </div>
                    </div>

                    {membersError && (
                      <div className="p-2.5 rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300 font-semibold text-[11px]">
                        ⚠️ {membersError}
                      </div>
                    )}

                    {/* Bảng thành viên */}
                    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] max-h-80 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)] text-[var(--muted)] font-bold">
                          <tr>
                            <th className="py-2.5 px-2.5">Tên tài khoản</th>
                            <th className="py-2.5 px-2.5">Tên hiển thị</th>
                            <th className="py-2.5 px-2.5">Email</th>
                            <th className="py-2.5 px-2.5">Vai trò</th>
                            <th className="py-2.5 px-2.5">Ngày đăng ký</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {membersLoading ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-6 text-center text-[var(--muted)] animate-pulse"
                              >
                                Đang tải danh sách thành viên...
                              </td>
                            </tr>
                          ) : filteredAndSortedMembers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-6 text-center text-[var(--muted)]"
                              >
                                Chưa có thành viên nào khớp với tìm kiếm.
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedMembers.map((m) => {
                              const isOwnerRole = m.role === 'owner';
                              return (
                                <tr
                                  key={m.id}
                                  className="hover:bg-[var(--bg)]/60 transition-colors"
                                >
                                  <td className="py-2 px-2.5 font-mono font-bold text-[var(--text)]">
                                    @{m.username || '—'}
                                  </td>
                                  <td className="py-2 px-2.5 font-semibold text-[var(--text)]">
                                    {m.display_name || m.username || '—'}
                                  </td>
                                  <td className="py-2 px-2.5 text-[var(--muted)]">
                                    {m.email || '—'}
                                  </td>
                                  <td className="py-2 px-2.5">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                        isOwnerRole
                                          ? 'border-amber-400/50 bg-amber-400/20 text-amber-700 dark:text-amber-300'
                                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)]'
                                      }`}
                                    >
                                      {isOwnerRole
                                        ? '👑 Chủ web'
                                        : '🌸 Người dùng'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 text-[var(--muted)] tabular-nums">
                                    {m.created_at
                                      ? new Date(
                                          m.created_at
                                        ).toLocaleDateString('vi-VN')
                                      : '—'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {/* Mục 6: Giọng nói và thú cưng theo tag (Chỉ Owner, lưu vào site_settings key "tag_voices" và "tag_pets") */}
              <section className="space-y-3 pt-2 border-t border-[var(--border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif-title text-lg font-bold text-[var(--text)] flex items-center gap-1.5">
                      <span>🎭 Giọng nói và thú cưng theo tag</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/25 text-[var(--text)] border border-[var(--border)]">
                        {tagVoicesList.length} tag
                      </span>
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Tùy chỉnh bảng map Tag → Giọng nói (<code>tag_voices</code>) &amp; Tag → Thú cưng (<code>tag_pets</code>) lưu trên bảng <code>site_settings</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSiteConfig(
                        {
                          tagVoices: DEFAULT_TAG_VOICES,
                          tagPets: DEFAULT_TAG_PETS,
                        },
                        'Khôi phục bảng Giọng nói & Thú cưng mặc định'
                      );
                      flashTagCompanionSaved('Đã khôi phục bộ 25+ tag mặc định!');
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Mặc định 25+ tag</span>
                  </button>
                </div>

                {tagCompanionSavedMsg && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{tagCompanionSavedMsg}</span>
                  </div>
                )}

                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] space-y-4">
                  {/* Thanh tìm chọn Tag & Thêm Tag mới */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Tìm kiếm hoặc chọn Tag để chỉnh:
                      </label>
                      <div className="relative mb-1.5">
                        <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={tagFilterQuery}
                          onChange={(e) => setTagFilterQuery(e.target.value)}
                          placeholder="Lọc nhanh tên tag..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <select
                        value={selectedTagId}
                        onChange={(e) => setSelectedTagId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      >
                        {tagVoicesList
                          .filter((tv) => {
                            if (!tagFilterQuery.trim()) return true;
                            const q = normalizeTagSearch(tagFilterQuery);
                            return (
                              normalizeTagSearch(tv.tag).includes(q) ||
                              normalizeTagSearch(tv.rhythm).includes(q)
                            );
                          })
                          .map((tv) => (
                            <option key={tv.id} value={tv.id}>
                              #{tv.tag} — ({tv.pronouns})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Thêm Tag mới vào bảng:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder="VD: Ngọt ngào, Quân nhân, Ma cà rồng..."
                          className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const rawTag = newTagInput.trim();
                            const tKey = normalizeTagSearch(rawTag).replace(/\s+/g, '_');
                            if (!rawTag || !tKey) return;
                            const existing = tagVoicesList.find(
                              (v) =>
                                v.id === tKey ||
                                normalizeTagSearch(v.tag) === normalizeTagSearch(rawTag)
                            );
                            if (existing) {
                              setSelectedTagId(existing.id);
                              setNewTagInput('');
                              flashTagCompanionSaved(
                                `Tag #${rawTag} đã có sẵn, đã chuyển tới tag này.`
                              );
                              return;
                            }
                            const newVoice: TagVoiceProfile = {
                              id: tKey,
                              tag: rawTag,
                              keywords: [normalizeTagSearch(rawTag), rawTag.toLowerCase()],
                              pronouns: 'mình - bạn',
                              rhythm: `Phong thái mang đậm sắc thái ${rawTag.toLowerCase()}, chân thành và giàu cảm xúc`,
                              sentenceEnding: 'nhé, nha, đó',
                              emojis: ['✨', '🌸', '💫'],
                              lengthStyle: 'medium',
                              dialogues: {
                                greeting: [
                                  `Chào bạn nhé, không gian mang sắc thái ${rawTag.toLowerCase()} hôm nay thật dễ chịu ✨`,
                                  `Mừng bạn ghé thăm phòng tri kỷ, mình vừa pha trà đợi bạn nè 🌸`,
                                  `Gặp được bạn là ngày hôm nay thêm trọn vẹn rồi đó 💫`,
                                ],
                                gift_flower: [
                                  `Cảm ơn bạn vì đóa {item} tuyệt đẹp này nhé 🌸`,
                                  `Hương hoa {item} làm căn phòng bừng sáng hẳn lên ✨`,
                                ],
                                gift_drink: [
                                  `Ly {item} vừa miệng lắm, cảm ơn sự chu đáo của bạn nha ☕`,
                                  `Thưởng thức {item} cùng bạn thật sự rất tuyệt 💫`,
                                ],
                                chat: [
                                  `Kể cho mình nghe hôm nay của bạn có điều gì thú vị không? ✨`,
                                  `Ở bên cạnh bạn trong bầu không khí này làm mình thấy rất bình yên 🌸`,
                                ],
                                farewell: [
                                  `Tạm biệt bạn nhé, hẹn sớm gặp lại tại góc nhỏ này nha ✨`,
                                  `Đi đường cẩn thận nhé, mình vẫn luôn ở đây chờ bạn 🌸`,
                                ],
                                high_bond: [
                                  `Sự gắn kết giữa chúng mình đã trở thành điều quý giá nhất nơi đây 💖`,
                                  `Cảm ơn bạn vì đã luôn đồng hành và thấu hiểu mình sâu sắc đến vậy ✨`,
                                ],
                              },
                            };
                            const newPet: TagPetProfile = {
                              id: tKey,
                              tag: rawTag,
                              keywords: [normalizeTagSearch(rawTag), rawTag.toLowerCase()],
                              speciesList: ['Mèo bông', 'Thỏ trắng'],
                              personality: `điềm đạm, mang hơi thở ${rawTag.toLowerCase()}`,
                              behaviorStyle: 'gentle_sway',
                              sounds: ['Meow~ ✨', 'Pưn pưn~ 🌸'],
                              vibeNote: `Bé này có tính cách đáng yêu, rất hòa hợp với bầu không khí ${rawTag.toLowerCase()} nơi đây.`,
                            };
                            onUpdateSiteConfig(
                              {
                                tagVoices: [...tagVoicesList, newVoice],
                                tagPets: [...tagPetsList, newPet],
                              },
                              `Thêm tag mới: ${rawTag}`
                            );
                            setSelectedTagId(tKey);
                            setNewTagInput('');
                            flashTagCompanionSaved(
                              `Đã thêm tag #${rawTag} vào site_settings!`
                            );
                          }}
                          className="px-3 py-2 rounded-xl bg-[var(--accent)] text-[#3a2b30] text-xs font-bold cursor-pointer inline-flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm Tag</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--muted)] mt-1">
                        Tag mới sẽ tự tạo khung giọng nói &amp; thú cưng để bạn tùy chỉnh ngay bên dưới.
                      </p>
                    </div>
                  </div>

                  {/* Khung chỉnh sửa chi tiết cho Tag đang chọn */}
                  {(() => {
                    const currentVoice =
                      tagVoicesList.find((v) => v.id === selectedTagId) ||
                      tagVoicesList[0];
                    if (!currentVoice) return null;

                    const currentPet: TagPetProfile =
                      tagPetsList.find(
                        (p) =>
                          p.id === currentVoice.id ||
                          normalizeTagSearch(p.tag) ===
                            normalizeTagSearch(currentVoice.tag)
                      ) || {
                        id: currentVoice.id,
                        tag: currentVoice.tag,
                        keywords: currentVoice.keywords,
                        speciesList: ['Mèo bông', 'Thỏ ngọc'],
                        personality: 'điềm đạm, ấm áp',
                        behaviorStyle: 'gentle_sway',
                        sounds: ['Meow~ 🌸'],
                        vibeNote:
                          'Bé này có tính điềm đạm, hợp với không khí dịu dàng nơi đây.',
                      };

                    const updateCurrentVoice = (
                      patch: Partial<TagVoiceProfile>,
                      label = `Sửa giọng tag #${currentVoice.tag}`
                    ) => {
                      const nextVoices = tagVoicesList.map((v) =>
                        v.id === currentVoice.id ? { ...v, ...patch } : v
                      );
                      onUpdateSiteConfig({ tagVoices: nextVoices }, label);
                    };

                    const updateCurrentPet = (
                      patch: Partial<TagPetProfile>,
                      label = `Sửa thú cưng tag #${currentVoice.tag}`
                    ) => {
                      const exists = tagPetsList.some(
                        (p) =>
                          p.id === currentVoice.id ||
                          normalizeTagSearch(p.tag) ===
                            normalizeTagSearch(currentVoice.tag)
                      );
                      const nextPets = exists
                        ? tagPetsList.map((p) =>
                            p.id === currentVoice.id ||
                            normalizeTagSearch(p.tag) ===
                              normalizeTagSearch(currentVoice.tag)
                              ? { ...p, ...patch }
                              : p
                          )
                        : [...tagPetsList, { ...currentPet, ...patch }];
                      onUpdateSiteConfig({ tagPets: nextPets }, label);
                    };

                    const situationLabels: Record<DialogueSituation, string> = {
                      greeting: '👋 Chào hỏi',
                      gift_flower: '🌸 Tặng hoa',
                      gift_drink: '☕ Tặng nước',
                      chat: '💬 Trò chuyện',
                      farewell: '🌙 Tạm biệt',
                      high_bond: '💖 Gắn bó cao',
                    };

                    const currentLines: string[] =
                      currentVoice.dialogues[activeDialogueTab] || [];

                    return (
                      <div className="space-y-4 pt-2 border-t border-[var(--border)]">
                        {/* Phần A: Thông tin Giọng nói (tag_voices) */}
                        <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[var(--text)]">
                              🗣️ A. Văn phong &amp; Câu thoại của Tag #{currentVoice.tag}
                            </span>
                            <span className="text-[10px] text-[var(--muted)]">
                              Key: <code>tag_voices</code>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Cách xưng hô:
                              </label>
                              <input
                                type="text"
                                value={currentVoice.pronouns}
                                onChange={(e) =>
                                  updateCurrentVoice({ pronouns: e.target.value })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Đuôi câu đặc trưng:
                              </label>
                              <input
                                type="text"
                                value={currentVoice.sentenceEnding}
                                onChange={(e) =>
                                  updateCurrentVoice({
                                    sentenceEnding: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Nhịp câu &amp; phong thái:
                              </label>
                              <input
                                type="text"
                                value={currentVoice.rhythm}
                                onChange={(e) =>
                                  updateCurrentVoice({ rhythm: e.target.value })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Từ khóa nhận diện (phân cách dấu phẩy):
                              </label>
                              <input
                                type="text"
                                value={currentVoice.keywords.join(', ')}
                                onChange={(e) =>
                                  updateCurrentVoice({
                                    keywords: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Emoji đặc trưng (phân cách dấu phẩy):
                              </label>
                              <input
                                type="text"
                                value={currentVoice.emojis.join(', ')}
                                onChange={(e) =>
                                  updateCurrentVoice({
                                    emojis: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                            </div>
                          </div>

                          {/* Chọn tình huống thoại */}
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap gap-1.5">
                              {(
                                Object.keys(
                                  situationLabels
                                ) as DialogueSituation[]
                              ).map((sitKey) => (
                                <button
                                  key={sitKey}
                                  type="button"
                                  onClick={() => setActiveDialogueTab(sitKey)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-all ${
                                    activeDialogueTab === sitKey
                                      ? 'bg-[var(--accent)] text-[#3a2b30] border-[var(--accent)]'
                                      : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
                                  }`}
                                >
                                  {situationLabels[sitKey]} (
                                  {(currentVoice.dialogues[sitKey] || []).length})
                                </button>
                              ))}
                            </div>

                            {/* Danh sách câu thoại trong tình huống đang chọn */}
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {currentLines.map((line: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5"
                                >
                                  <input
                                    type="text"
                                    value={line}
                                    onChange={(e) => {
                                      const updated = [...currentLines];
                                      updated[idx] = e.target.value;
                                      updateCurrentVoice({
                                        dialogues: {
                                          ...currentVoice.dialogues,
                                          [activeDialogueTab]: updated,
                                        },
                                      });
                                    }}
                                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--text)]"
                                  />
                                  <button
                                    type="button"
                                    title="Xóa câu thoại này"
                                    onClick={() => {
                                      const updated = currentLines.filter(
                                        (_: string, i: number) => i !== idx
                                      );
                                      updateCurrentVoice({
                                        dialogues: {
                                          ...currentVoice.dialogues,
                                          [activeDialogueTab]: updated,
                                        },
                                      });
                                    }}
                                    className="p-1.5 rounded-lg border border-[var(--border)] text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Thêm câu thoại mới */}
                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                value={newDialogueLine}
                                onChange={(e) =>
                                  setNewDialogueLine(e.target.value)
                                }
                                placeholder={`Thêm câu thoại cho "${situationLabels[activeDialogueTab]}" (có thể dùng {item} cho tên quà)...`}
                                className="flex-1 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const trimmed = newDialogueLine.trim();
                                  if (!trimmed) return;
                                  updateCurrentVoice(
                                    {
                                      dialogues: {
                                        ...currentVoice.dialogues,
                                        [activeDialogueTab]: [
                                          ...currentLines,
                                          trimmed,
                                        ],
                                      },
                                    },
                                    `Thêm câu thoại vào tag #${currentVoice.tag}`
                                  );
                                  setNewDialogueLine('');
                                  flashTagCompanionSaved(
                                    `Đã thêm câu thoại mới cho #${currentVoice.tag}!`
                                  );
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[#3a2b30] text-xs font-bold cursor-pointer inline-flex items-center gap-1 shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm câu</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Phần B: Thông tin Thú cưng theo Tag (tag_pets) */}
                        <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[var(--text)]">
                              🐾 B. Thú cưng &amp; Hành vi của Tag #{currentVoice.tag}
                            </span>
                            <span className="text-[10px] text-[var(--muted)]">
                              Key: <code>tag_pets</code>
                            </span>
                          </div>

                          {/* Danh sách loài thú */}
                          <div>
                            <label className="block text-[10px] font-semibold text-[var(--muted)] mb-1">
                              Các loài thú gắn với Tag #{currentVoice.tag}:
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {currentPet.speciesList.map((sp, spIdx) => (
                                <span
                                  key={spIdx}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text)]"
                                >
                                  <span>🐾 {sp}</span>
                                  {currentPet.speciesList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextSp =
                                          currentPet.speciesList.filter(
                                            (_, i) => i !== spIdx
                                          );
                                        updateCurrentPet({
                                          speciesList: nextSp,
                                        });
                                      }}
                                      className="text-rose-500 hover:text-rose-700 cursor-pointer ml-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={newPetSpeciesInput}
                                onChange={(e) =>
                                  setNewPetSpeciesInput(e.target.value)
                                }
                                placeholder="Thêm loài thú mới (VD: Mèo bông, Cáo tuyết, Thỏ ngọc...)"
                                className="flex-1 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const sp = newPetSpeciesInput.trim();
                                  if (!sp) return;
                                  if (!currentPet.speciesList.includes(sp)) {
                                    updateCurrentPet({
                                      speciesList: [
                                        ...currentPet.speciesList,
                                        sp,
                                      ],
                                    });
                                    flashTagCompanionSaved(
                                      `Đã thêm loài "${sp}" cho tag #${currentVoice.tag}!`
                                    );
                                  }
                                  setNewPetSpeciesInput('');
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[#3a2b30] text-xs font-bold cursor-pointer inline-flex items-center gap-1 shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm loài</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Tính cách thú:
                              </label>
                              <input
                                type="text"
                                value={currentPet.personality}
                                onChange={(e) =>
                                  updateCurrentPet({
                                    personality: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Hành vi đi lang thang:
                              </label>
                              <select
                                value={currentPet.behaviorStyle}
                                onChange={(e) =>
                                  updateCurrentPet({
                                    behaviorStyle: e.target
                                      .value as PetBehaviorStyle,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              >
                                <option value="gentle_sway">
                                  Đung đưa êm dịu (Dịu dàng / Chữa lành)
                                </option>
                                <option value="calm_slow">
                                  Đi chậm rãi, ít nhảy (Lạnh lùng / Điềm tĩnh)
                                </option>
                                <option value="playful_bouncy">
                                  Nhún nhảy tinh nghịch (Hài hước / Năng động)
                                </option>
                                <option value="mystic_float">
                                  Lướt nhẹ huyền ảo (Bí ẩn / Cổ trang)
                                </option>
                                <option value="energetic_dash">
                                  Chạy lon ton hào hứng (Tsundere / Nhiệt huyết)
                                </option>
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-[var(--muted)] mb-0.5">
                                Lời kêu của thú (phân cách dấu phẩy):
                              </label>
                              <input
                                type="text"
                                value={currentPet.sounds.join(', ')}
                                onChange={(e) =>
                                  updateCurrentPet({
                                    sounds: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                              />
                            </div>
                          </div>

                          {/* Ghi chú Vibe dưới thú cưng (Không bao giờ hiện tên char) */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-semibold text-[var(--muted)]">
                              Ghi chú Vibe &amp; Tính cách dưới thú cưng (chỉ nói về vibe/tính cách, TUYỆT ĐỐI KHÔNG nhắc tên char):
                            </label>
                            <textarea
                              rows={2}
                              value={currentPet.vibeNote}
                              onChange={(e) =>
                                updateCurrentPet({
                                  vibeNote: sanitizePetVibeNote(
                                    e.target.value,
                                    currentVoice.tag,
                                    currentPet.speciesList[0]
                                  ),
                                })
                              }
                              placeholder="VD: Bé này có tính điềm đạm, hợp với không khí dịu dàng nơi đây."
                              className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--text)]"
                            />
                            <p className="text-[10px] text-[var(--muted)]">
                              Hệ thống tự động lọc bỏ mọi cụm &quot;hợp với [tên char]&quot; để chỉ giữ lại mô tả về vibe và tính cách của thú.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* Mục 7: Quản lý Chợ nhỏ & Nhiệm vụ Xu (Chỉ Owner, lưu vào market_prices & quest_pool trên Supabase) */}
              <section className="space-y-4 pt-4 border-t border-[var(--border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif-title text-lg font-bold text-[var(--text)] flex items-center gap-1.5">
                      <span>🛒 7. Giá Chợ nhỏ & Quản lý Nhiệm vụ Xu</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/25 text-[var(--text)] border border-[var(--border)]">
                        Supabase Realtime
                      </span>
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Điều chỉnh giá mua/bán, bật tắt từng món trong bảng <code>market_prices</code> và quản lý kho nhiệm vụ <code>quest_pool</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadMarketAndQuests}
                    disabled={marketLoading}
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${marketLoading ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                </div>

                {marketFeedbackMsg && (
                  <div className="p-2.5 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/15 text-xs font-bold text-[var(--text)] animate-fade-in flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>{marketFeedbackMsg}</span>
                  </div>
                )}

                {/* 7.1. Bảng giá Chợ nhỏ (market_prices) */}
                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                      <span>🏪 Bảng giá các mặt hàng trong Chợ (market_prices)</span>
                    </h4>
                    <span className="text-[10px] text-[var(--muted)]">
                      Giá tính bằng {siteConfig.coinCurrencyName || 'Xu'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {marketPricesList.map((row) => {
                      const labelMap: Record<string, { name: string; emoji: string }> = {
                        flower: { name: 'Đóa Hoa', emoji: '🌸' },
                        fish: { name: 'Chú Cá', emoji: '🐟' },
                        drink: { name: 'Thức Uống', emoji: '☕' },
                        pet: { name: 'Thú Cưng', emoji: '🐾' },
                      };
                      const info = labelMap[row.kind] || { name: row.kind, emoji: '📦' };

                      return (
                        <div
                          key={row.kind}
                          className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                            row.enabled
                              ? 'border-[var(--border)] bg-[var(--surface)]'
                              : 'border-dashed border-[var(--border)]/60 bg-[var(--bg)] opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                              <span className="text-base">{info.emoji}</span>
                              <span>{info.name}</span>
                            </span>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-[var(--muted)]">
                              <input
                                type="checkbox"
                                checked={row.enabled}
                                onChange={(e) =>
                                  handleToggleMarketItem(row.kind, e.target.checked)
                                }
                                className="rounded text-[var(--accent)] focus:ring-0"
                              />
                              <span>{row.enabled ? 'Đang bán' : 'Tạm ngưng'}</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <label className="block text-[10px] text-[var(--muted)] mb-0.5">
                                Giá mua vào:
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={row.buy_price}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setMarketPricesList((prev) =>
                                      prev.map((p) =>
                                        p.kind === row.kind ? { ...p, buy_price: val } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] font-bold text-center"
                                />
                                <span className="text-[10px] text-[var(--muted)]">Xu</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] text-[var(--muted)] mb-0.5">
                                Giá bán lại:
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={row.sell_price}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setMarketPricesList((prev) =>
                                      prev.map((p) =>
                                        p.kind === row.kind ? { ...p, sell_price: val } : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] font-bold text-center"
                                />
                                <span className="text-[10px] text-[var(--muted)]">Xu</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSaveMarketPrice(row)}
                            className="w-full py-1.5 rounded-lg bg-[var(--accent)] text-[#3a2b30] font-bold text-[11px] cursor-pointer hover:opacity-90 transition-all flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <Check className="w-3 h-3" />
                            <span>Lưu giá {info.name}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 7.1b. Lời chào thân mật từng nhóm hàng ở Chợ nhỏ (market_texts trong site_settings) */}
                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                        <span>💬 Lời nhắn thân mật từng nhóm hàng ở Chợ nhỏ (market_texts)</span>
                      </h4>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        Mỗi nhóm hàng hiển thị lời chào riêng biệt. Tự động lưu vào <code>site_settings</code> (key <code>market_texts</code>).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSiteConfig(
                          { marketTexts: { ...DEFAULT_MARKET_TEXTS } },
                          'Khôi phục lời chào Chợ nhỏ mặc định'
                        );
                        flashMarketFeedback('Đã khôi phục lời chào Chợ nhỏ mặc định!');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                    >
                      Khôi phục mặc định
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {(
                      [
                        { key: 'seed', label: '🌱 Hạt giống', placeholder: DEFAULT_MARKET_TEXTS.seed },
                        { key: 'drink', label: '☕ Thức uống', placeholder: DEFAULT_MARKET_TEXTS.drink },
                        { key: 'fish', label: '🐟 Cá', placeholder: DEFAULT_MARKET_TEXTS.fish },
                        { key: 'pet', label: '🐾 Thú cưng', placeholder: DEFAULT_MARKET_TEXTS.pet },
                        { key: 'plot', label: '🌷 Ô vườn', placeholder: DEFAULT_MARKET_TEXTS.plot },
                      ] as const
                    ).map((field) => (
                      <div key={field.key} className="space-y-1">
                        <label className="block text-[11px] font-bold text-[var(--text)]">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={marketTexts[field.key] || ''}
                          onChange={(e) => {
                            const nextTexts: MarketTextsConfig = {
                              ...marketTexts,
                              [field.key]: e.target.value,
                            };
                            onUpdateSiteConfig(
                              { marketTexts: nextTexts },
                              `Đổi lời chào ${field.label}`
                            );
                          }}
                          placeholder={field.placeholder}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 7.2. Kho nhiệm vụ nhận Xu (quest_pool) */}
                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                        <span>📋 Kho nhiệm vụ ngẫu nhiên mỗi ngày (quest_pool)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]">
                          {questPoolList.length} nhiệm vụ
                        </span>
                      </h4>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        Hệ thống sẽ bốc ngẫu nhiên 3 nhiệm vụ active từ kho này cho người chơi mỗi ngày.
                      </p>
                    </div>
                  </div>

                  {/* Danh sách nhiệm vụ trong pool */}
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {questPoolList.length === 0 ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-[11px] text-[var(--muted)] italic">
                          Chưa có nhiệm vụ nào trong kho quest_pool.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            const templates: {
                              title: string;
                              action: QuestActionType;
                              target: number;
                              reward: number;
                            }[] = [
                              { title: 'Tưới nước cho Vườn hoa ban mai', action: 'water', target: 2, reward: 6 },
                              { title: 'Thu hoạch hoa tươi đã nở rộ', action: 'harvest', target: 1, reward: 8 },
                              { title: 'Cho đàn cá trong hồ ăn no bụng', action: 'feed_fish', target: 2, reward: 6 },
                              { title: 'Thả cần câu tìm niềm vui ở Hồ cá', action: 'fish_cast', target: 1, reward: 5 },
                              { title: 'Tặng ly nước ấm cho người thương', action: 'gift_drink', target: 1, reward: 8 },
                              { title: 'Vuốt ve âu yếm bé thú cưng', action: 'pet_stroke', target: 2, reward: 5 },
                              { title: 'Cho bé thú cưng ăn bữa ngon', action: 'feed_pet', target: 1, reward: 7 },
                              { title: 'Trò chuyện tâm tình với tri kỷ', action: 'chat_companion', target: 2, reward: 6 },
                              { title: 'Ghé thăm Phòng tri kỷ ấm cúng', action: 'visit_room', target: 1, reward: 5 },
                              { title: 'Ghé Quầy thức uống ngắm trà hoa', action: 'visit_drinks', target: 1, reward: 5 },
                              { title: 'Gửi một lá thư ở Góc yêu thương', action: 'love_letter', target: 1, reward: 10 },
                              { title: 'Thả tim yêu mến một nhân vật', action: 'like_char', target: 1, reward: 5 },
                              { title: 'Mở Bảng xếp hạng ngắm top nhân vật', action: 'view_ranking', target: 1, reward: 5 },
                              { title: 'Lưu một ghi chép mới tại Kho Docs', action: 'write_doc', target: 1, reward: 7 },
                              { title: 'Lắng nghe trọn vẹn một bản nhạc êm', action: 'listen_song', target: 1, reward: 8 },
                            ];
                            for (const t of templates) {
                              await createQuestPoolRow({
                                title: t.title,
                                action: t.action,
                                target: t.target,
                                reward: t.reward,
                                active: true,
                              });
                            }
                            const fresh = await fetchQuestPoolFromSupabase();
                            setQuestPoolList(fresh);
                            flashMarketFeedback('Đã nạp 15 nhiệm vụ mẫu cho 15 hành động!');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[#3a2b30] text-xs font-bold cursor-pointer hover:opacity-90 shadow-2xs"
                        >
                          ⚡ Nạp 15 nhiệm vụ mẫu chuẩn hành động
                        </button>
                      </div>
                    ) : (
                      questPoolList.map((quest) => (
                        <div
                          key={quest.id}
                          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <input
                              type="text"
                              value={quest.title}
                              onChange={(e) => {
                                const nextTitle = e.target.value;
                                setQuestPoolList((prev) =>
                                  prev.map((q) =>
                                    q.id === quest.id ? { ...q, title: nextTitle } : q
                                  )
                                );
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] font-medium"
                              placeholder="Tiêu đề nhiệm vụ..."
                            />

                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--muted)] shrink-0 self-end sm:self-auto">
                              <input
                                type="checkbox"
                                checked={quest.active}
                                onChange={(e) => {
                                  handleUpdateQuestField(quest.id, { active: e.target.checked });
                                }}
                                className="rounded text-[var(--accent)]"
                              />
                              <span className={quest.active ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                                {quest.active ? 'Bật' : 'Tắt'}
                              </span>
                            </label>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 justify-between pt-1 border-t border-[var(--border)]/40">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[var(--muted)] font-bold">Hành động:</span>
                                <select
                                  value={quest.action || 'water'}
                                  onChange={(e) => {
                                    const nextAction = e.target.value as QuestActionType;
                                    setQuestPoolList((prev) =>
                                      prev.map((q) =>
                                        q.id === quest.id ? { ...q, action: nextAction } : q
                                      )
                                    );
                                  }}
                                  className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--text)] font-medium"
                                >
                                  {QUEST_ACTION_DEFINITIONS.map((def) => (
                                    <option key={def.action} value={def.action}>
                                      {def.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-[var(--muted)] font-bold">Số lần:</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={quest.target || 1}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setQuestPoolList((prev) =>
                                      prev.map((q) =>
                                        q.id === quest.id ? { ...q, target: val } : q
                                      )
                                    );
                                  }}
                                  className="w-12 px-1.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--text)] font-bold text-center"
                                />
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-[var(--muted)] font-bold">Thưởng:</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={quest.reward}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setQuestPoolList((prev) =>
                                      prev.map((q) =>
                                        q.id === quest.id ? { ...q, reward: val } : q
                                      )
                                    );
                                  }}
                                  className="w-12 px-1.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--text)] font-bold text-center"
                                />
                                <span className="text-[10px] text-[var(--muted)]">Xu</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateQuestField(quest.id, {
                                    title: quest.title,
                                    reward: quest.reward,
                                    action: quest.action || 'water',
                                    target: quest.target || 1,
                                    active: quest.active,
                                  })
                                }
                                className="px-3 py-1 rounded-lg bg-[var(--accent)] text-[#3a2b30] text-[11px] font-bold cursor-pointer hover:opacity-90"
                                title="Lưu nhiệm vụ này"
                              >
                                Lưu
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteQuest(quest.id)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                title="Xóa nhiệm vụ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Form thêm nhiệm vụ mới */}
                  <form
                    onSubmit={handleCreateNewQuest}
                    className="pt-3 border-t border-[var(--border)]/60 space-y-2.5"
                  >
                    <div className="text-[11px] font-bold text-[var(--text)]">
                      ➕ Thêm nhiệm vụ mới vào kho:
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={newQuestTitle}
                        onChange={(e) => setNewQuestTitle(e.target.value)}
                        placeholder="Tiêu đề nhiệm vụ (VD: Tưới nước cho vườn hoa, Cho thú cưng ăn ngon...)"
                        className="flex-1 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--muted)] font-bold">Hành động:</span>
                          <select
                            value={newQuestAction}
                            onChange={(e) => setNewQuestAction(e.target.value as QuestActionType)}
                            className="px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] font-medium"
                          >
                            {QUEST_ACTION_DEFINITIONS.map((def) => (
                              <option key={def.action} value={def.action}>
                                {def.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--muted)] font-bold">Số lần:</span>
                          <input
                            type="number"
                            min={1}
                            value={newQuestTarget}
                            onChange={(e) =>
                              setNewQuestTarget(Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-14 px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] font-bold text-center"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--muted)] font-bold">Thưởng:</span>
                          <input
                            type="number"
                            min={1}
                            value={newQuestReward}
                            onChange={(e) =>
                              setNewQuestReward(Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-16 px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] font-bold text-center"
                          />
                          <span className="text-[10px] text-[var(--muted)]">Xu</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!newQuestTitle.trim()}
                        className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-[#3a2b30] font-bold text-xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50 shadow-2xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm nhiệm vụ</span>
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              {/* Mục 8: Xưng hô và giọng nói (address_map trong site_settings) */}
              <section className="space-y-4 pt-4 border-t border-[var(--border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif-title text-lg font-bold text-[var(--text)] flex items-center gap-1.5">
                      <span>🗣️ 8. Xưng hô và giọng nói</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/25 text-[var(--text)] border border-[var(--border)]">
                        address_map
                      </span>
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Xem cặp xưng hô <code>(xưng - gọi)</code> đang dùng của từng nhân vật và tùy chỉnh bảng từ khóa xưng hô theo danh xưng/tag.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSiteConfig(
                        { addressMap: DEFAULT_ADDRESS_MAP },
                        'Khôi phục bảng xưng hô mặc định'
                      );
                      flashTagCompanionSaved('Đã khôi phục bảng từ khóa xưng hô mặc định!');
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Khôi phục bảng mặc định</span>
                  </button>
                </div>

                {/* 8.1. Bảng xem nhanh cặp xưng hô đang dùng của từng char */}
                <div className="space-y-2.5 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[var(--text)]">
                      👥 Cặp xưng hô đang áp dụng của từng nhân vật ({characters.length})
                    </h4>
                    <span className="text-[10px] text-[var(--muted)]">
                      Ưu tiên: Cách xưng hô riêng → Open Scene → Danh xưng & Tag → mình - bạn
                    </span>
                  </div>

                  {characters.length === 0 ? (
                    <p className="text-[11px] text-[var(--muted)] italic py-2">
                      Chưa có nhân vật nào trong danh sách.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {characters.map((ch) => {
                        const resolved = resolveAddress(ch, {
                          addressMap: addressMapList,
                        });
                        const sourceLabelMap: Record<string, string> = {
                          address_terms: 'Ghi riêng trên thẻ',
                          open_scene: 'Đoán từ Open Scene',
                          epithet_tags: 'Từ Danh xưng / Tag',
                          default: 'Mặc định thân thiện',
                        };
                        return (
                          <div
                            key={ch.id}
                            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-[var(--text)] truncate">
                                {ch.name}
                              </div>
                              <div className="text-[10px] text-[var(--muted)] truncate">
                                {ch.subtitle ? `${ch.subtitle} · ` : ''}
                                {sourceLabelMap[resolved.source] || resolved.source}
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-[var(--accent)]/25 border border-[var(--border)] font-bold text-[11px] text-[var(--text)] shrink-0">
                              {resolved.self} - {resolved.user}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 8.2. Bảng từ khóa ánh xạ danh xưng & tag -> cặp xưng hô */}
                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div>
                    <h4 className="font-bold text-xs text-[var(--text)]">
                      🔑 Bảng từ khóa danh xưng & tag (site_settings: address_map)
                    </h4>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">
                      Khi nhân vật không điền sẵn ô "Cách xưng hô" và không tìm thấy trong Open Scene, hệ thống dò các từ khóa bên dưới trong Danh xưng và Tag.
                    </p>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {addressMapList.map((rule, idx) => (
                      <div
                        key={rule.id || idx}
                        className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[var(--muted)] font-bold">
                              Xưng:
                            </span>
                            <input
                              type="text"
                              value={rule.self}
                              onChange={(e) => {
                                const next = addressMapList.map((r, i) =>
                                  i === idx ? { ...r, self: e.target.value } : r
                                );
                                onUpdateSiteConfig(
                                  { addressMap: next },
                                  'Sửa từ xưng trong address_map'
                                );
                              }}
                              className="w-20 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-bold text-[var(--text)] text-center"
                            />
                            <span className="text-xs text-[var(--muted)] font-bold">-</span>
                            <span className="text-[10px] text-[var(--muted)] font-bold">
                              Gọi:
                            </span>
                            <input
                              type="text"
                              value={rule.user}
                              onChange={(e) => {
                                const next = addressMapList.map((r, i) =>
                                  i === idx ? { ...r, user: e.target.value } : r
                                );
                                onUpdateSiteConfig(
                                  { addressMap: next },
                                  'Sửa từ gọi trong address_map'
                                );
                              }}
                              className="w-20 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-bold text-[var(--text)] text-center"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={rule.note || ''}
                              onChange={(e) => {
                                const next = addressMapList.map((r, i) =>
                                  i === idx ? { ...r, note: e.target.value } : r
                                );
                                onUpdateSiteConfig(
                                  { addressMap: next },
                                  'Sửa ghi chú quy tắc xưng hô'
                                );
                              }}
                              placeholder="Ghi chú nhóm..."
                              className="w-36 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[11px] text-[var(--muted)]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = addressMapList.filter((_, i) => i !== idx);
                                onUpdateSiteConfig(
                                  { addressMap: next },
                                  'Xóa quy tắc xưng hô'
                                );
                              }}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-[var(--muted)] mb-0.5">
                            Từ khóa nhận diện (phân cách bằng dấu phẩy):
                          </label>
                          <input
                            type="text"
                            value={rule.keywords.join(', ')}
                            onChange={(e) => {
                              const kw = e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                              const next = addressMapList.map((r, i) =>
                                i === idx ? { ...r, keywords: kw } : r
                              );
                              onUpdateSiteConfig(
                                { addressMap: next },
                                'Cập nhật từ khóa xưng hô'
                              );
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Thêm quy tắc xưng hô mới */}
                  <div className="pt-3 border-t border-[var(--border)]/60 space-y-2">
                    <div className="text-[11px] font-bold text-[var(--text)]">
                      ➕ Thêm quy tắc từ khóa xưng hô mới:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={newRuleKeywords}
                        onChange={(e) => setNewRuleKeywords(e.target.value)}
                        placeholder="Từ khóa (VD: tiền bối, học trưởng)"
                        className="sm:col-span-2 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
                      />
                      <input
                        type="text"
                        value={newRuleNote}
                        onChange={(e) => setNewRuleNote(e.target.value)}
                        placeholder="Ghi chú (tùy chọn)"
                        className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[10px] text-[var(--muted)] font-bold">Xưng:</span>
                        <input
                          type="text"
                          value={newRuleSelf}
                          onChange={(e) => setNewRuleSelf(e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--text)] text-center"
                        />
                        <span className="text-[var(--muted)]">-</span>
                        <span className="text-[10px] text-[var(--muted)] font-bold">Gọi:</span>
                        <input
                          type="text"
                          value={newRuleUser}
                          onChange={(e) => setNewRuleUser(e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--text)] text-center"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={!newRuleKeywords.trim() || !newRuleSelf.trim() || !newRuleUser.trim()}
                        onClick={() => {
                          const kw = newRuleKeywords
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          if (kw.length === 0) return;
                          const nextRule: AddressKeywordRule = {
                            id: `rule_${Date.now()}`,
                            keywords: kw,
                            self: newRuleSelf.trim().toLowerCase(),
                            user: newRuleUser.trim().toLowerCase(),
                            note: newRuleNote.trim() || undefined,
                          };
                          onUpdateSiteConfig(
                            { addressMap: [...addressMapList, nextRule] },
                            'Thêm quy tắc xưng hô mới'
                          );
                          setNewRuleKeywords('');
                          setNewRuleNote('');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-[#3a2b30] font-bold text-xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm quy tắc</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Chân bảng Cài đặt trang */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--bg)]/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={undoCount === 0}
                  className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Hoàn tác ({undoCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Mặc định</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Hoàn tất</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
