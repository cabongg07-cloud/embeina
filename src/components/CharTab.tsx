import React, { useMemo, useState } from 'react';
import {
  Search,
  RotateCcw,
  Heart,
  Plus,
  Image as ImageIcon,
  User,
  ExternalLink,
  Trash2,
  Sparkles,
  Lock,
  Unlock,
  Tag,
  X,
} from 'lucide-react';
import { CharacterItem, Creator } from '../data/sampleData';
import { CharacterCard } from './CharacterCard';
import { AuthUser, can, canEditItem } from '../services/authLayer';
import { EditableText } from './EditableText';
import { dataStore } from '../services/dataLayer';
import {
  CharacterUnlockRequirement,
  ItemCategory,
} from '../services/itemSystem';
import { SupabaseInventoryItem } from '../services/supabaseService';

interface CharTabProps {
  characters: CharacterItem[];
  creators: Creator[];
  favoriteIds: string[];
  notesMap: Record<string, string>;
  onToggleFavorite: (charId: string) => void;
  onSaveNote: (charId: string, note: string) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  selectedCreatorId: string;
  onSelectCreatorFilter: (creatorId: string) => void;
  onResetFilters: () => void;
  unlockedCharIds: string[];
  petalsBalance: number;
  onUnlockWithPetals: (charId: string, price: number) => boolean;
  onUnlockWithItems: (charId: string) => void;
  onRequireAuth: (reason: string) => void;
  onGoToMiniGame: (zone?: string, targetKind?: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  currentUser: AuthUser;
  editMode?: boolean;
  onAddCharacter: (newChar: Omit<CharacterItem, 'id'>) => void | Promise<void>;
  onUpdateCharacter: (
    charId: string,
    patch: Partial<CharacterItem> & {
      chatLink?: string;
      openSceneSecret?: string;
    }
  ) => void | Promise<void>;
  onDeleteCharacter: (charId: string) => void | Promise<void>;
  onMoveCharacter: (charId: string, direction: 'up' | 'down') => void;
  currencyName?: string;
  currencyEmoji?: string;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
  customTags?: string[];
  onUpdateCustomTags?: (tags: string[]) => void;
  supabaseInventory?: SupabaseInventoryItem[];
  isLoadingChars?: boolean;
}

export const CharTab: React.FC<CharTabProps> = ({
  characters,
  creators,
  favoriteIds,
  notesMap,
  onToggleFavorite,
  onSaveNote,
  selectedTags,
  onToggleTag,
  selectedCreatorId,
  onSelectCreatorFilter,
  onResetFilters,
  unlockedCharIds,
  petalsBalance,
  onUnlockWithPetals,
  onUnlockWithItems,
  onRequireAuth,
  onGoToMiniGame,
  searchInputRef,
  currentUser,
  editMode = false,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onMoveCharacter,
  currencyName = 'Cánh hoa',
  currencyEmoji = '🌸',
  customTexts = {},
  onUpdateCustomText,
  customTags = [],
  onUpdateCustomTags,
  supabaseInventory = [],
  isLoadingChars = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Kiểm tra quyền Chủ web bằng can() để hiện nút ➕ "Thêm char"
  const canCreateChar = can('manage_own_chars', currentUser);
  const canEditText = Boolean(editMode && can('edit', currentUser));

  // Tìm thông tin mặc định của Chủ web
  const defaultCreatorObj = useMemo(() => {
    const linkedId = currentUser.linkedCreatorId || 'creator-lam-vong';
    return creators.find((c) => c.id === linkedId) || creators[0];
  }, [creators, currentUser.linkedCreatorId]);

  // Trạng thái form ➕ "Thêm char" (mặc định Chủ web là người đăng)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEpithet, setNewEpithet] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newTagsList, setNewTagsList] = useState<string[]>(['Chữa lành']);
  const [newTagInput, setNewTagInput] = useState('');
  const [newChatUrl, setNewChatUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newOpenScene, setNewOpenScene] = useState('');
  const [newCreatorNote, setNewCreatorNote] = useState('');
  const [newIsLocked, setNewIsLocked] = useState(false);
  const [newUnlockReqs, setNewUnlockReqs] = useState<
    CharacterUnlockRequirement[]
  >([
    { id: 'init_req_1', category: 'flower', count: 2 },
    { id: 'init_req_2', category: 'drink', count: 1 },
  ]);

  const creatorMap = useMemo(() => {
    const map: Record<string, Creator> = {};
    creators.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [creators]);

  // Danh sách các tag tùy chỉnh được lưu trên bảng site_settings (key "custom_tags") của Supabase
  const creatorCustomTags = customTags;

  // State mở khung Thêm tag mới của Creator/Owner trong khu vực bộ lọc
  const [showAddTagBar, setShowAddTagBar] = useState(false);
  const [newCustomTagInput, setNewCustomTagInput] = useState('');
  const [tagToastMsg, setTagToastMsg] = useState<string | null>(null);

  const handleAddCustomTag = (rawTag: string) => {
    const cleaned = rawTag.replace(/^#+/, '').replace(/,/g, '').trim();
    if (!cleaned) return;
    if (!creatorCustomTags.includes(cleaned)) {
      const next = [...creatorCustomTags, cleaned];
      onUpdateCustomTags?.(next);
      setTagToastMsg(`✨ Đã thêm tag mới #${cleaned} vào sổ tay!`);
      setTimeout(() => setTagToastMsg(null), 3000);
    } else {
      setTagToastMsg(`Tag #${cleaned} đã có sẵn trong sổ tay 🌸`);
      setTimeout(() => setTagToastMsg(null), 2500);
    }
    setNewCustomTagInput('');
  };

  const handleDeleteCustomTag = (tagToDelete: string) => {
    const next = creatorCustomTags.filter((t) => t !== tagToDelete);
    onUpdateCustomTags?.(next);
    setTagToastMsg(`🗑️ Đã xóa tag #${tagToDelete}.`);
    setTimeout(() => setTagToastMsg(null), 2500);
  };

  // Đếm số lượng từng tag trong toàn bộ kho nhân vật + tag do Creator tự thêm
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Khởi tạo các tag tùy chỉnh do Creator thêm
    creatorCustomTags.forEach((t) => {
      counts[t] = 0;
    });
    // Đếm số lượng nhân vật thực tế có tag đó
    characters.forEach((char) => {
      char.tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
  }, [characters, creatorCustomTags]);

  const allKnownTagNames = useMemo(() => {
    const set = new Set<string>();
    creatorCustomTags.forEach((t) => set.add(t));
    characters.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [characters, creatorCustomTags]);

  // Danh sách vật phẩm hiện có trên Supabase để gợi ý khi Chủ web chỉ định đúng tên vật phẩm mở khóa
  const ownedItemsSuggestions = useMemo(() => {
    return supabaseInventory;
  }, [supabaseInventory]);

  const filteredCharacters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return characters.filter((char) => {
      if (q) {
        const matchName = char.name.toLowerCase().includes(q);
        const matchEpithet = char.epithet.toLowerCase().includes(q);
        const matchDesc = char.description.toLowerCase().includes(q);
        const matchTags = char.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchEpithet && !matchDesc && !matchTags) {
          return false;
        }
      }

      if (selectedTags.length > 0) {
        const hasAllSelectedTags = selectedTags.every((t) =>
          char.tags.includes(t)
        );
        if (!hasAllSelectedTags) return false;
      }

      if (onlyFavorites && !favoriteIds.includes(char.id)) {
        return false;
      }

      return true;
    });
  }, [characters, searchQuery, selectedTags, onlyFavorites, favoriteIds]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedTags.length > 0 || onlyFavorites;

  const handleClearAll = () => {
    setSearchQuery('');
    setOnlyFavorites(false);
    onResetFilters();
  };

  // Xử lý gõ tag bằng phím Enter hoặc dấu phẩy ","
  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const cleaned = newTagInput.replace(/,/g, '').trim();
      if (cleaned && !newTagsList.includes(cleaned)) {
        setNewTagsList([...newTagsList, cleaned]);
      }
      setNewTagInput('');
    }
  };

  const handleToggleSuggestedTag = (tag: string) => {
    if (newTagsList.includes(tag)) {
      setNewTagsList(newTagsList.filter((t) => t !== tag));
    } else {
      setNewTagsList([...newTagsList, tag]);
    }
  };

  const handleOpenAddModal = () => {
    setShowAddForm((prev) => !prev);
  };

  const handleCreateCharSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDesc.trim()) return;

    const pendingTag = newTagInput.replace(/,/g, '').trim();
    const finalTags =
      pendingTag && !newTagsList.includes(pendingTag)
        ? [...newTagsList, pendingTag]
        : newTagsList;

    const cleanUnlockReqs = newIsLocked
      ? newUnlockReqs.map((r) => ({
          ...r,
          count: Math.max(1, Number(r.count) || 1),
          specificItemName: r.specificItemName?.trim() || undefined,
        }))
      : [];

    onAddCharacter({
      name: newName.trim(),
      epithet: newEpithet.trim() || 'Người bạn mới nơi sổ tay',
      creatorId: currentUser.id || defaultCreatorObj?.id || 'owner',
      creatorName: currentUser.displayName || 'Chủ web',
      tags: finalTags.length > 0 ? finalTags : ['Đời thường'],
      description: newDesc.trim(),
      openingLine:
        newOpenScene.trim() || '“Chào bạn, rất vui được gặp bạn hôm nay.”',
      openScene:
        newOpenScene.trim() || '“Chào bạn, rất vui được gặp bạn hôm nay.”',
      creatorNote: newCreatorNote.trim() || undefined,
      chatUrl: newChatUrl.trim() || 'https://character.ai',
      avatarSymbol: newName.trim().slice(0, 2).toUpperCase(),
      avatarTint: defaultCreatorObj?.avatarTint || '#3a2d38',
      imageUrl: newImageUrl.trim() || undefined,
      isLocked: newIsLocked,
      unlockRequirements: cleanUnlockReqs,
      petalPrice: 0,
      stats: {
        favorites: 1,
        hearts: 1,
        chatOpens: 1,
        weeklyScore: 10,
        monthlyScore: 10,
      },
    });

    setNewName('');
    setNewEpithet('');
    setNewImageUrl('');
    setNewTagsList(['Chữa lành']);
    setNewTagInput('');
    setNewChatUrl('');
    setNewDesc('');
    setNewOpenScene('');
    setNewCreatorNote('');
    setNewIsLocked(false);
    setShowAddForm(false);
  };

  // Kiểm tra Chủ web có quyền sửa/xóa nhân vật không
  const checkCanManageChar = (_char: CharacterItem): boolean => {
    return can('manage_own_chars', currentUser);
  };

  return (
    <div className="space-y-8">
      {/* Tiêu đề & Nút ➕ "Thêm char" (chỉ Chủ web thấy) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={
                customTexts['char_tab_title'] ||
                '✨ Kho Nhân Vật (Char)'
              }
              onSave={(val) => onUpdateCustomText?.('char_tab_title', val)}
              editMode={canEditText}
            />
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            <EditableText
              value={
                customTexts['char_tab_desc'] ||
                'Tìm kiếm nhân vật theo tên, danh xưng, bối cảnh hoặc kết hợp nhiều nhãn dán tag để gặp người bạn tâm giao.'
              }
              onSave={(val) => onUpdateCustomText?.('char_tab_desc', val)}
              editMode={canEditText}
              multiline
            />
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-[var(--muted)] tabular-nums">
            Hiển thị{' '}
            <span className="text-[var(--text)] font-bold">
              {filteredCharacters.length}
            </span>{' '}
            / {characters.length} nhân vật
          </div>

          {canCreateChar && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>➕ Thêm char</span>
            </button>
          )}
        </div>
      </div>

      {/* FORM ➕ THÊM CHAR DÀNH CHO CREATOR */}
      {showAddForm && canCreateChar && (
        <form
          onSubmit={handleCreateCharSubmit}
          className="soft-card p-6 border-2 border-[var(--accent)] space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h3 className="font-serif-title text-xl font-bold text-[var(--text)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              <span>➕ Thêm nhân vật (Char) mới lên kệ</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer font-semibold"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                1. Tên char *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="VD: Tô Mộc Nhiên"
                className="w-full px-3.5 py-2 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>2. Ảnh nhân vật (Dán link ảnh)</span>
              </label>
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3.5 py-2 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                Danh xưng / Phụ đề ngắn
              </label>
              <input
                type="text"
                value={newEpithet}
                onChange={(e) => setNewEpithet(e.target.value)}
                placeholder="VD: Chủ tiệm trà chiều mưa"
                className="w-full px-3.5 py-2 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                3. Link chat *
              </label>
              <input
                type="url"
                value={newChatUrl}
                onChange={(e) => setNewChatUrl(e.target.value)}
                required
                placeholder="https://character.ai/chat/..."
                className="w-full px-3.5 py-2 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* 4. Tag (nhiều tag, Enter hoặc dấu phẩy, gợi ý tag đã dùng) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-[var(--muted)]">
              4. Tag (Nhập nhiều tag bằng phím Enter hoặc dấu phẩy, bấm nút Thêm, hoặc bấm chọn tag gợi ý bên dưới)
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-2xl bg-[var(--bg)] border border-[var(--border)] focus-within:border-[var(--accent)]">
              {newTagsList.map((tg) => (
                <span
                  key={tg}
                  className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[11px] inline-flex items-center gap-1.5"
                >
                  <span>#{tg}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewTagsList(newTagsList.filter((x) => x !== tg))
                    }
                    className="hover:opacity-75 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="flex-1 min-w-[200px] flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Gõ tag mới rồi nhấn Enter, dấu phẩy (,)..."
                  className="flex-1 bg-transparent text-xs text-[var(--text)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleaned = newTagInput.replace(/,/g, '').trim();
                    if (cleaned && !newTagsList.includes(cleaned)) {
                      setNewTagsList([...newTagsList, cleaned]);
                      handleAddCustomTag(cleaned);
                    }
                    setNewTagInput('');
                  }}
                  className="px-3 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] text-[10px] font-bold cursor-pointer shrink-0"
                >
                  + Thêm tag
                </button>
              </div>
            </div>

            {allKnownTagNames.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[var(--muted)]">
                  Gợi ý tag (Bấm để gắn / bỏ):
                </span>
                {allKnownTagNames.slice(0, 18).map((tag) => {
                  const selected = newTagsList.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleSuggestedTag(tag)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[var(--accent)] bg-[var(--accent)]/25 text-[var(--text)] font-bold'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                5. Mô tả nhân vật *
              </label>
              <textarea
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                required
                placeholder="Giới thiệu bối cảnh, tính cách của nhân vật..."
                className="w-full p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                6. Open Scene (Lời mở đầu của cảnh) *
              </label>
              <textarea
                rows={3}
                value={newOpenScene}
                onChange={(e) => setNewOpenScene(e.target.value)}
                required
                placeholder="“Ngoài trời mưa phùn lất phất, người vừa đẩy cửa bước vào tiệm...”"
                className="w-full p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
              7. Ghi chú (Gợi ý cách roleplay, lưu ý của Chủ web...)
            </label>
            <input
              type="text"
              value={newCreatorNote}
              onChange={(e) => setNewCreatorNote(e.target.value)}
              placeholder="VD: Nhân vật hợp với cốt truyện chậm rãi, chữa lành..."
              className="w-full px-3.5 py-2 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* 8. Trạng thái (Mở / Khóa) & Yêu cầu mở khóa bằng vật phẩm */}
          <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-[var(--text)] block">
                  8. Trạng thái nhân vật (Mở / Khóa bằng vật phẩm):
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  Khi chọn Khóa, người dùng cần thu thập đủ Hoa, Cá, Thức uống hoặc Thú cưng từ Mini game để mở khóa Link chat & Open Scene.
                </span>
              </div>

              <div className="inline-flex rounded-full border border-[var(--border)] p-1 bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() => setNewIsLocked(false)}
                  className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer inline-flex items-center gap-1 ${
                    !newIsLocked
                      ? 'bg-[var(--accent)] text-[#3a2b30] font-bold'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Mở tự do</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewIsLocked(true)}
                  className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer inline-flex items-center gap-1 ${
                    newIsLocked
                      ? 'bg-[var(--accent)] text-[#3a2b30] font-bold'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Khóa bằng vật phẩm</span>
                </button>
              </div>
            </div>

            {newIsLocked && (
              <div className="space-y-2.5 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--text)]">
                    Thiết lập Yêu cầu mở khóa (VD: 2 Cá + 1 Thức uống + 4 Hoa):
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewUnlockReqs([
                        ...newUnlockReqs,
                        {
                          id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                          category: 'flower',
                          count: 1,
                        },
                      ])
                    }
                    className="px-3 py-1 rounded-full bg-[var(--accent)]/25 text-[var(--text)] font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm vật phẩm yêu cầu</span>
                  </button>
                </div>

                {newUnlockReqs.map((req, idx) => (
                  <div
                    key={req.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]"
                  >
                    <div className="sm:col-span-3">
                      <select
                        value={req.category}
                        onChange={(e) => {
                          const next = [...newUnlockReqs];
                          next[idx] = {
                            ...req,
                            category: e.target.value as ItemCategory,
                          };
                          setNewUnlockReqs(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
                      >
                        <option value="flower">🌸 Hoa</option>
                        <option value="fish">🐟 Cá</option>
                        <option value="drink">☕ Thức uống</option>
                        <option value="pet">🐾 Thú cưng</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={req.count}
                        onChange={(e) => {
                          const next = [...newUnlockReqs];
                          next[idx] = {
                            ...req,
                            count: Math.max(1, parseInt(e.target.value, 10) || 1),
                          };
                          setNewUnlockReqs(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
                        placeholder="Số lượng"
                      />
                    </div>
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        list={`add-char-specific-${req.category}`}
                        value={req.specificItemName || ''}
                        onChange={(e) => {
                          const next = [...newUnlockReqs];
                          next[idx] = {
                            ...req,
                            specificItemName: e.target.value,
                          };
                          setNewUnlockReqs(next);
                        }}
                        placeholder="Để trống = Mọi loài thuộc loại này, hoặc nhập ĐÚNG TÊN cụ thể..."
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                      <datalist id={`add-char-specific-${req.category}`}>
                        {ownedItemsSuggestions
                          .filter((it) => it.category === req.category)
                          .map((it) => (
                            <option key={it.id} value={it.name} />
                          ))}
                      </datalist>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {newUnlockReqs.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewUnlockReqs(
                              newUnlockReqs.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--muted)] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer shadow-xs"
            >
              ✨ Đăng nhân vật lên kệ
            </button>
          </div>
        </form>
      )}

      {/* Khung công cụ Tìm kiếm theo tên & Lọc nhiều Tag */}
      <div className="soft-card p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Ô tìm theo tên / mô tả */}
          <div className="md:col-span-9 relative">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên nhân vật, danh xưng, tag hoặc bối cảnh..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--muted)]/60 focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Lọc Yêu thích */}
          <div className="md:col-span-3 flex items-center">
            <button
              type="button"
              onClick={() => setOnlyFavorites((prev) => !prev)}
              className={`w-full py-2.5 px-3 rounded-full border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                onlyFavorites
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
                  : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]'
              }`}
            >
              <Heart
                className="w-3.5 h-3.5"
                fill={onlyFavorites ? '#3a2b30' : 'none'}
              />
              <span>Yêu thích ({favoriteIds.length})</span>
            </button>
          </div>
        </div>

        {/* Bộ lọc nhiều Tag kèm số lượng & Chỗ thêm tag mới dành cho Chủ web */}
        <div className="space-y-2.5 pt-2 border-t border-[var(--border)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--muted)] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>🏷️ Lọc kết hợp nhiều Tag ({selectedTags.length} đang chọn)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Nút ➕ Thêm tag mới cho Creator */}
              {canCreateChar && (
                <button
                  type="button"
                  onClick={() => setShowAddTagBar((prev) => !prev)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    showAddTagBar
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] shadow-xs'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]'
                  }`}
                  title="Thêm tag mới vào danh sách của sổ tay"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>➕ Thêm tag mới</span>
                </button>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text)] hover:opacity-80 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xóa bộ lọc</span>
                </button>
              )}
            </div>
          </div>

          {/* Khung nhập tag mới của Creator khi mở */}
          {showAddTagBar && canCreateChar && (
            <div className="p-3 rounded-2xl bg-[var(--surface)] border-2 border-dashed border-[var(--accent)] flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px] flex items-center gap-1.5 bg-[var(--bg)] px-3 py-1.5 rounded-full border border-[var(--border)] focus-within:border-[var(--accent)]">
                <Tag className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <input
                  type="text"
                  value={newCustomTagInput}
                  onChange={(e) => setNewCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag(newCustomTagInput);
                    }
                  }}
                  placeholder="Nhập tên tag mới (VD: Tsundere, Ma pháp, Học đường, Lạnh lùng...)"
                  className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddCustomTag(newCustomTagInput)}
                className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] text-xs font-bold cursor-pointer hover:opacity-90 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm tag</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddTagBar(false)}
                className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {tagToastMsg && (
            <div className="text-[11px] font-semibold text-[var(--accent)] animate-fadeIn">
              {tagToastMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {tagCounts.map(([tag, count]) => {
              const isSelected = selectedTags.includes(tag);
              const isCustom = creatorCustomTags.includes(tag);

              return (
                <div key={tag} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold shadow-xs'
                        : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <span>#{tag}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                        isSelected
                          ? 'bg-white/40 text-[#3a2b30]'
                          : count === 0
                          ? 'bg-[var(--accent)]/20 text-[var(--text)] font-bold'
                          : 'bg-[var(--surface)] text-[var(--muted)]'
                      }`}
                    >
                      {count === 0 ? 'Mới ✨' : count}
                    </span>
                  </button>

                  {/* Nút xóa tag tùy chỉnh do Creator thêm nếu char count === 0 */}
                  {canCreateChar && isCustom && count === 0 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomTag(tag)}
                      title={`Xóa tag tùy chỉnh #${tag}`}
                      className="ml-0.5 p-1 text-[var(--muted)] hover:text-rose-500 cursor-pointer text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Danh sách Card Nhân vật */}
      {isLoadingChars ? (
        <div className="soft-card py-16 text-center space-y-3">
          <p className="font-serif-title text-xl font-bold text-[var(--text)] animate-pulse">
            ✨ Đang tải danh sách nhân vật từ Supabase...
          </p>
          <p className="text-xs text-[var(--muted)]">
            Sổ tay đang mở trang mới, bạn đợi một chút nhé 🌸
          </p>
        </div>
      ) : filteredCharacters.length === 0 ? (
        <div className="soft-card py-16 text-center space-y-3">
          <p className="font-serif-title text-xl font-bold text-[var(--text)]">
            Không tìm thấy nhân vật nào khớp với bộ lọc hiện tại 🌸
          </p>
          <p className="text-xs text-[var(--muted)]">
            Hãy thử bớt một vài tag hoặc xóa bộ lọc để xem toàn bộ nhân vật nhé.
          </p>
          <button
            type="button"
            onClick={handleClearAll}
            className="mt-2 px-5 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCharacters.map((char, idx) => (
            <CharacterCard
              key={char.id}
              character={char}
              creator={creatorMap[char.creatorId]}
              isFavorite={favoriteIds.includes(char.id)}
              personalNote={notesMap[char.id] || ''}
              onToggleFavorite={onToggleFavorite}
              onSaveNote={onSaveNote}
              onClickCreator={(creatorId) => onSelectCreatorFilter(creatorId)}
              onClickTag={onToggleTag}
              isUnlocked={unlockedCharIds.includes(char.id)}
              petalsBalance={petalsBalance}
              onUnlockWithPetals={onUnlockWithPetals}
              onUnlockWithItems={onUnlockWithItems}
              onRequireAuth={onRequireAuth}
              onGoToMiniGame={onGoToMiniGame}
              isLoggedIn={currentUser.role !== 'guest'}
              editMode={editMode}
              canEditChar={checkCanManageChar(char)}
              onUpdateCharacter={onUpdateCharacter}
              onDeleteCharacter={onDeleteCharacter}
              onMoveCharacter={onMoveCharacter}
              isFirst={idx === 0}
              isLast={idx === filteredCharacters.length - 1}
              currencyName={currencyName}
              currencyEmoji={currencyEmoji}
              allAvailableTags={allKnownTagNames}
              onAddGlobalTag={handleAddCustomTag}
              supabaseInventory={supabaseInventory}
            />
          ))}
        </div>
      )}
    </div>
  );
};
