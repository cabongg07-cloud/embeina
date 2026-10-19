import React, { useState, useMemo } from 'react';
import {
  Heart,
  Link2,
  Check,
  ExternalLink,
  PenLine,
  User,
  Lock,
  Unlock,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Trash2,
  Pencil,
  BookOpen,
  StickyNote,
  Tag,
  X,
} from 'lucide-react';
import { CharacterItem, Creator } from '../data/sampleData';
import { EditableText, ItemEditControls } from './EditableText';
import {
  CharacterUnlockRequirement,
  ItemCategory,
  CATEGORY_LABELS,
  checkUnlockRequirements,
  consumeItemsForUnlock,
  getAllOwnedItemsForUnlock,
} from '../services/itemSystem';

interface CharacterCardProps {
  character: CharacterItem;
  creator?: Creator;
  isFavorite: boolean;
  personalNote: string;
  onToggleFavorite: (charId: string) => void;
  onSaveNote: (charId: string, note: string) => void;
  onClickCreator?: (creatorId: string) => void;
  onClickTag?: (tag: string) => void;
  isUnlocked?: boolean;
  petalsBalance?: number;
  onUnlockWithPetals?: (charId: string, price: number) => boolean;
  onUnlockWithItems?: (charId: string) => void;
  onRequireAuth?: (reason: string) => void;
  onGoToMiniGame?: () => void;
  isLoggedIn?: boolean;
  // Chế độ chỉnh sửa & quyền sở hữu của Creator
  editMode?: boolean;
  canEditChar?: boolean;
  onUpdateCharacter?: (charId: string, patch: Partial<CharacterItem>) => void;
  onDeleteCharacter?: (charId: string) => void;
  onMoveCharacter?: (charId: string, direction: 'up' | 'down') => void;
  isFirst?: boolean;
  isLast?: boolean;
  currencyName?: string;
  currencyEmoji?: string;
  allAvailableTags?: string[];
  onAddGlobalTag?: (tag: string) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  creator,
  isFavorite,
  personalNote,
  onToggleFavorite,
  onSaveNote,
  onClickCreator,
  onClickTag,
  isUnlocked = true,
  onUnlockWithItems,
  onRequireAuth,
  onGoToMiniGame,
  isLoggedIn = false,
  editMode = false,
  canEditChar = false,
  onUpdateCharacter,
  onDeleteCharacter,
  onMoveCharacter,
  isFirst = false,
  isLast = false,
  allAvailableTags = [],
  onAddGlobalTag,
}) => {
  const [copied, setCopied] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(personalNote);
  const [noteSavedToast, setNoteSavedToast] = useState(false);

  // Trạng thái gắn tag nhanh trực tiếp trên card cho Creator
  const [quickAddTagOpen, setQuickAddTagOpen] = useState(false);
  const [quickTagInput, setQuickTagInput] = useState('');

  // Hộp mở khóa bằng vật phẩm
  const [unlockPanelOpen, setUnlockPanelOpen] = useState(false);
  const [justUnlockedSparkle, setJustUnlockedSparkle] = useState(false);
  const [unlockFeedback, setUnlockFeedback] = useState<string | null>(null);

  // Trạng thái mở form chỉnh sửa đầy đủ của nhân vật
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(character.name);
  const [editEpithet, setEditEpithet] = useState(character.epithet);
  const [editCreatorName, setEditCreatorName] = useState(
    character.creatorName || creator?.name || ''
  );
  const [editImageUrl, setEditImageUrl] = useState(character.imageUrl || '');
  const [editAvatarSymbol, setEditAvatarSymbol] = useState(character.avatarSymbol);
  const [editTagsList, setEditTagsList] = useState<string[]>(character.tags);
  const [editTagInput, setEditTagInput] = useState('');
  const [editDesc, setEditDesc] = useState(character.description);
  const [editOpenScene, setEditOpenScene] = useState(
    character.openScene || character.openingLine || ''
  );
  const [editCreatorNote, setEditCreatorNote] = useState(
    character.creatorNote || ''
  );
  const [editChatUrl, setEditChatUrl] = useState(character.chatUrl);
  const [editIsLocked, setEditIsLocked] = useState<boolean>(
    Boolean(
      character.isLocked ||
        (character.unlockRequirements && character.unlockRequirements.length > 0)
    )
  );
  const [editRequirements, setEditRequirements] = useState<
    CharacterUnlockRequirement[]
  >(
    character.unlockRequirements && character.unlockRequirements.length > 0
      ? character.unlockRequirements
      : [{ id: 'req_default_1', category: 'flower', count: 2 }]
  );

  // Danh sách tên vật phẩm hiện có trong kho để gợi ý khi Creator muốn đòi đúng tên cụ thể
  const ownedItemsSuggestions = useMemo(() => {
    try {
      return getAllOwnedItemsForUnlock();
    } catch {
      return [];
    }
  }, [editModalOpen, unlockPanelOpen]);

  const effectiveRequirements: CharacterUnlockRequirement[] = useMemo(() => {
    if (character.unlockRequirements && character.unlockRequirements.length > 0) {
      return character.unlockRequirements;
    }
    if (character.isLocked || (character.petalPrice && character.petalPrice > 0)) {
      return [
        { id: 'fallback_req_1', category: 'flower', count: 2 },
        { id: 'fallback_req_2', category: 'drink', count: 1 },
      ];
    }
    return [];
  }, [character.unlockRequirements, character.isLocked, character.petalPrice]);

  const requiresUnlock =
    Boolean(
      character.isLocked ||
        (character.unlockRequirements && character.unlockRequirements.length > 0) ||
        (character.petalPrice && character.petalPrice > 0)
    ) && !isUnlocked;

  // Kiểm tra trạng thái đủ / thiếu của từng yêu cầu vật phẩm
  const requirementStatus = useMemo(() => {
    if (!requiresUnlock) {
      return { allMet: true, details: [] };
    }
    return checkUnlockRequirements(effectiveRequirements);
  }, [requiresUnlock, effectiveRequirements, unlockPanelOpen, justUnlockedSparkle]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(character.chatUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.createElement('input');
      input.value = character.chatUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleSaveNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveNote(character.id, draftNote);
    setNoteSavedToast(true);
    setTimeout(() => setNoteSavedToast(false), 1600);
  };

  const handleConfirmItemUnlock = () => {
    if (!isLoggedIn) {
      onRequireAuth?.(
        `Mời bạn đăng nhập để dùng vật phẩm mở khóa nhân vật "${character.name}" và lưu vĩnh viễn nhé 🌸`
      );
      return;
    }

    const latestCheck = checkUnlockRequirements(effectiveRequirements);
    if (!latestCheck.allMet) {
      setUnlockFeedback(
        'Bạn vẫn còn thiếu một vài vật phẩm nhỏ. Hãy ghé Vườn hoa, Hồ cá hoặc Quầy thức uống nhé 🌱'
      );
      return;
    }

    const consumed = consumeItemsForUnlock(effectiveRequirements);
    if (consumed) {
      setJustUnlockedSparkle(true);
      setUnlockPanelOpen(false);
      onUnlockWithItems?.(character.id);
      setTimeout(() => setJustUnlockedSparkle(false), 4500);
    }
  };

  const openEditForm = () => {
    setEditName(character.name);
    setEditEpithet(character.epithet);
    setEditCreatorName(character.creatorName || creator?.name || '');
    setEditImageUrl(character.imageUrl || '');
    setEditAvatarSymbol(character.avatarSymbol);
    setEditTagsList(character.tags);
    setEditTagInput('');
    setEditDesc(character.description);
    setEditOpenScene(character.openScene || character.openingLine || '');
    setEditCreatorNote(character.creatorNote || '');
    setEditChatUrl(character.chatUrl);
    const locked = Boolean(
      character.isLocked ||
        (character.unlockRequirements && character.unlockRequirements.length > 0)
    );
    setEditIsLocked(locked);
    setEditRequirements(
      character.unlockRequirements && character.unlockRequirements.length > 0
        ? character.unlockRequirements
        : [{ id: `req_${Date.now()}`, category: 'flower', count: 2 }]
    );
    setEditModalOpen(true);
  };

  const handleEditTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = editTagInput.replace(/,/g, '').trim();
      if (val && !editTagsList.includes(val)) {
        setEditTagsList([...editTagsList, val]);
      }
      setEditTagInput('');
    }
  };

  const handleSaveEditForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateCharacter || !editName.trim()) return;
    const pendingTag = editTagInput.replace(/,/g, '').trim();
    const finalTags =
      pendingTag && !editTagsList.includes(pendingTag)
        ? [...editTagsList, pendingTag]
        : editTagsList;

    const cleanReqs = editIsLocked
      ? editRequirements.map((r) => ({
          ...r,
          count: Math.max(1, Number(r.count) || 1),
          specificItemName: r.specificItemName?.trim() || undefined,
        }))
      : [];

    onUpdateCharacter(character.id, {
      name: editName.trim(),
      epithet: editEpithet.trim() || 'Nhân vật sổ tay',
      creatorName: editCreatorName.trim() || creator?.name || 'Creator',
      imageUrl: editImageUrl.trim() || undefined,
      avatarSymbol:
        editAvatarSymbol.trim() || editName.trim().slice(0, 2).toUpperCase(),
      tags: finalTags.length > 0 ? finalTags : ['Đời thường'],
      description: editDesc.trim(),
      openingLine: editOpenScene.trim(),
      openScene: editOpenScene.trim(),
      creatorNote: editCreatorNote.trim() || undefined,
      chatUrl: editChatUrl.trim() || 'https://character.ai',
      isLocked: editIsLocked,
      unlockRequirements: cleanReqs,
    });
    finalTags.forEach((t) => onAddGlobalTag?.(t));
    setEditModalOpen(false);
  };

  // Gắn tag trực tiếp trên thẻ nhân vật cho Creator
  const handleQuickAddTag = (tagToAdd: string) => {
    const cleaned = tagToAdd.replace(/^#+/, '').replace(/,/g, '').trim();
    if (!cleaned || character.tags.includes(cleaned)) return;
    const nextTags = [...character.tags, cleaned];
    onUpdateCharacter?.(character.id, { tags: nextTags });
    onAddGlobalTag?.(cleaned);
    setQuickTagInput('');
    setQuickAddTagOpen(false);
  };

  // Xóa tag trực tiếp trên thẻ nhân vật cho Creator
  const handleRemoveTagFromChar = (tagToRemove: string) => {
    if (!canEditChar || !onUpdateCharacter) return;
    const nextTags = character.tags.filter((t) => t !== tagToRemove);
    onUpdateCharacter(character.id, {
      tags: nextTags.length > 0 ? nextTags : ['Đời thường'],
    });
  };

  const displayCreatorName =
    character.creatorName || creator?.name || 'Creator ẩn danh';
  const displayOpenScene = character.openScene || character.openingLine;

  return (
    <article
      className={`group relative rounded-[22px] border bg-[var(--surface)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 soft-card ${
        editMode && canEditChar
          ? 'border-2 border-dashed border-[var(--accent)]'
          : 'border-[var(--border)]'
      }`}
    >
      {/* Thanh công cụ Sửa / Xóa / Sắp xếp cho Creator sở hữu char */}
      {canEditChar && (
        <div className="mb-3 pb-2.5 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[var(--muted)] inline-flex items-center gap-1">
            ✨ Nhân vật của bạn
          </span>
          {editMode ? (
            <ItemEditControls
              canEdit={canEditChar}
              onEdit={openEditForm}
              onDelete={() => onDeleteCharacter?.(character.id)}
              onMoveUp={
                onMoveCharacter
                  ? () => onMoveCharacter(character.id, 'up')
                  : undefined
              }
              onMoveDown={
                onMoveCharacter
                  ? () => onMoveCharacter(character.id, 'down')
                  : undefined
              }
              disableUp={isFirst}
              disableDown={isLast}
            />
          ) : (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={openEditForm}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                <span>Sửa</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteCharacter?.(character.id)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-rose-300/60 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white cursor-pointer inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hiệu ứng chúc mừng lấp lánh vừa mở khóa */}
      {justUnlockedSparkle && (
        <div className="mb-4 p-3 rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent)]/20 text-xs font-bold text-[var(--text)] flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>
            ✨ Mở khóa thành công! Link chat và Open Scene của {character.name} đã mở vĩnh viễn cho bạn!
          </span>
        </div>
      )}

      {/* Form chỉnh sửa nhanh nhân vật */}
      {editModalOpen && canEditChar && (
        <form
          onSubmit={handleSaveEditForm}
          className="mb-4 p-4 rounded-2xl border-2 border-[var(--accent)] bg-[var(--bg)] space-y-3 text-xs"
        >
          <div className="flex items-center justify-between font-bold text-[var(--text)]">
            <span>✏️ Chỉnh sửa nhân vật: {character.name}</span>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">
                Tên char *
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">
                Tên Creator
              </label>
              <input
                type="text"
                value={editCreatorName}
                onChange={(e) => setEditCreatorName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">
                Danh xưng / Phụ đề ngắn
              </label>
              <input
                type="text"
                value={editEpithet}
                onChange={(e) => setEditEpithet(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                <span>Ảnh đại diện (Dán link ảnh)</span>
              </label>
              <input
                type="url"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">
              Tag (Gõ rồi nhấn Enter, dấu phẩy hoặc nút Thêm)
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              {editTagsList.map((tg) => (
                <span
                  key={tg}
                  className="sticker-chip text-[11px] inline-flex items-center gap-1"
                >
                  <span>#{tg}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditTagsList(editTagsList.filter((x) => x !== tg))
                    }
                    className="hover:text-rose-500 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="flex-1 min-w-[140px] flex items-center gap-1">
                <input
                  type="text"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={handleEditTagKeyDown}
                  placeholder="Thêm tag mới..."
                  className="flex-1 bg-transparent text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = editTagInput.replace(/,/g, '').trim();
                    if (val && !editTagsList.includes(val)) {
                      setEditTagsList([...editTagsList, val]);
                      onAddGlobalTag?.(val);
                    }
                    setEditTagInput('');
                  }}
                  className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] text-[10px] font-bold cursor-pointer"
                >
                  + Thêm
                </button>
              </div>
            </div>

            {allAvailableTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1.5">
                <span className="text-[10px] text-[var(--muted)]">Gợi ý tag:</span>
                {allAvailableTags.slice(0, 15).map((t) => {
                  const hasTag = editTagsList.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (hasTag) {
                          setEditTagsList(editTagsList.filter((x) => x !== t));
                        } else {
                          setEditTagsList([...editTagsList, t]);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors cursor-pointer ${
                        hasTag
                          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)] font-bold'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">
              Link chat *
            </label>
            <input
              type="url"
              value={editChatUrl}
              onChange={(e) => setEditChatUrl(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">
              Mô tả nhân vật
            </label>
            <textarea
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">
              Open Scene (Lời mở đầu của cảnh)
            </label>
            <textarea
              rows={3}
              value={editOpenScene}
              onChange={(e) => setEditOpenScene(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">
              Ghi chú của Creator
            </label>
            <input
              type="text"
              value={editCreatorNote}
              onChange={(e) => setEditCreatorNote(e.target.value)}
              placeholder="Gợi ý cách trò chuyện, thiết lập..."
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          {/* Trạng thái Mở / Khóa & Yêu cầu mở khóa bằng vật phẩm */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text)]">
                Trạng thái nhân vật:
              </span>
              <div className="inline-flex rounded-full border border-[var(--border)] p-0.5 bg-[var(--bg)]">
                <button
                  type="button"
                  onClick={() => setEditIsLocked(false)}
                  className={`px-3 py-1 rounded-full text-[11px] cursor-pointer ${
                    !editIsLocked
                      ? 'bg-[var(--accent)] text-[#3a2b30] font-bold'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  🔓 Mở tự do
                </button>
                <button
                  type="button"
                  onClick={() => setEditIsLocked(true)}
                  className={`px-3 py-1 rounded-full text-[11px] cursor-pointer ${
                    editIsLocked
                      ? 'bg-[var(--accent)] text-[#3a2b30] font-bold'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  🔒 Khóa bằng vật phẩm
                </button>
              </div>
            </div>

            {editIsLocked && (
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[var(--muted)]">
                    Yêu cầu vật phẩm để mở khóa (tự chọn loại chung hoặc chỉ định đúng tên):
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditRequirements([
                        ...editRequirements,
                        {
                          id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                          category: 'flower',
                          count: 1,
                        },
                      ])
                    }
                    className="px-2.5 py-1 rounded-full bg-[var(--accent)]/20 text-[var(--text)] font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm điều kiện</span>
                  </button>
                </div>

                {editRequirements.map((req, idx) => (
                  <div
                    key={req.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[var(--bg)] p-2 rounded-xl border border-[var(--border)]"
                  >
                    <div className="sm:col-span-4">
                      <select
                        value={req.category}
                        onChange={(e) => {
                          const next = [...editRequirements];
                          next[idx] = {
                            ...req,
                            category: e.target.value as ItemCategory,
                          };
                          setEditRequirements(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
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
                          const next = [...editRequirements];
                          next[idx] = {
                            ...req,
                            count: Math.max(1, parseInt(e.target.value, 10) || 1),
                          };
                          setEditRequirements(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
                        title="Số lượng"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        list={`specific-items-${req.category}-${character.id}`}
                        value={req.specificItemName || ''}
                        onChange={(e) => {
                          const next = [...editRequirements];
                          next[idx] = {
                            ...req,
                            specificItemName: e.target.value,
                          };
                          setEditRequirements(next);
                        }}
                        placeholder="Để trống = Mọi loài, hoặc gõ đúng tên..."
                        className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                      <datalist id={`specific-items-${req.category}-${character.id}`}>
                        {ownedItemsSuggestions
                          .filter((it) => it.category === req.category)
                          .map((it) => (
                            <option key={it.id} value={it.name} />
                          ))}
                      </datalist>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {editRequirements.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditRequirements(
                              editRequirements.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
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
              onClick={() => setEditModalOpen(false)}
              className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {/* Header: Avatar + Tên + Danh xưng + Nút Yêu thích */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {character.imageUrl ? (
              <img
                src={character.imageUrl}
                alt={character.name}
                className="w-12 h-12 rounded-2xl shrink-0 object-cover border-2 border-[var(--border)] shadow-xs"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center border-2 border-[var(--border)] font-serif-title text-base font-bold text-[#efe6ea] select-none shadow-xs"
                style={{ backgroundColor: character.avatarTint }}
                aria-hidden="true"
              >
                {character.avatarSymbol}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif-title text-xl font-bold text-[var(--text)] leading-snug truncate">
                  <EditableText
                    value={character.name}
                    onSave={(val) =>
                      onUpdateCharacter?.(character.id, { name: val })
                    }
                    editMode={editMode && canEditChar}
                  />
                </h3>
                {requiresUnlock ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-400/40 inline-flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Khóa vật phẩm</span>
                  </span>
                ) : (character.isLocked ||
                    (character.unlockRequirements &&
                      character.unlockRequirements.length > 0)) &&
                  isUnlocked ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-400/40 inline-flex items-center gap-1">
                    <Unlock className="w-2.5 h-2.5" />
                    <span>Đã mở khóa</span>
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[var(--muted)] truncate mt-0.5">
                <EditableText
                  value={character.epithet}
                  onSave={(val) =>
                    onUpdateCharacter?.(character.id, { epithet: val })
                  }
                  editMode={editMode && canEditChar}
                />
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleFavorite(character.id)}
            aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            title={isFavorite ? 'Đã yêu thích' : 'Yêu thích nhân vật này'}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer shrink-0 bouncy-btn ${
              isFavorite
                ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]'
            }`}
          >
            <Heart
              className="w-4 h-4"
              fill={isFavorite ? 'var(--accent)' : 'none'}
            />
          </button>
        </div>

        {/* Creator badge (Bấm vào tên creator trên card thì lọc ra các char của creator đó) */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <User className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Creator:</span>
          <button
            type="button"
            onClick={() => onClickCreator?.(character.creatorId)}
            title={`Lọc xem tất cả nhân vật của ${displayCreatorName}`}
            className="text-[var(--text)] font-bold hover:text-[var(--accent)] underline decoration-[var(--border)] underline-offset-4 transition-colors cursor-pointer"
          >
            {displayCreatorName}
          </button>
        </div>

        {/* Tags dạng nhãn dán bo tròn kèm nút thêm tag & xóa tag cho Creator */}
        <div className="flex flex-wrap items-center gap-1.5">
          {character.tags.map((tag) => (
            <span
              key={tag}
              className="group/tag inline-flex items-center gap-1 sticker-chip text-[11px] hover:border-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
            >
              <button
                type="button"
                onClick={() => onClickTag?.(tag)}
                className="cursor-pointer"
              >
                #{tag}
              </button>
              {canEditChar && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTagFromChar(tag);
                  }}
                  title={`Xóa tag #${tag} khỏi nhân vật này`}
                  className="opacity-60 hover:opacity-100 hover:text-rose-500 cursor-pointer ml-0.5 text-xs font-bold transition-opacity"
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {/* Nút ➕ Thêm tag nhanh ngay trên card dành cho Creator */}
          {canEditChar && (
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setQuickAddTagOpen((prev) => !prev)}
                className="px-2 py-0.5 rounded-full border border-dashed border-[var(--accent)] bg-[var(--surface)] text-[10px] font-bold text-[var(--text)] hover:bg-[var(--accent)]/20 cursor-pointer inline-flex items-center gap-0.5"
                title="Gắn thêm tag cho nhân vật này"
              >
                <Plus className="w-2.5 h-2.5 text-[var(--accent)]" />
                <span>Thêm tag</span>
              </button>

              {quickAddTagOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-30 w-56 p-2.5 rounded-2xl bg-[var(--surface)] border-2 border-[var(--accent)] shadow-xl space-y-2 text-xs animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text)]">
                    <span>➕ Gắn tag cho char</span>
                    <button
                      type="button"
                      onClick={() => setQuickAddTagOpen(false)}
                      className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                    <input
                      type="text"
                      value={quickTagInput}
                      onChange={(e) => setQuickTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddTag(quickTagInput);
                        }
                      }}
                      placeholder="Gõ tag mới..."
                      className="w-full bg-transparent text-[11px] text-[var(--text)] px-1.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickAddTag(quickTagInput)}
                      className="px-2 py-0.5 rounded-lg bg-[var(--accent)] text-[#3a2b30] text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      Gắn
                    </button>
                  </div>

                  {/* Danh sách tag gợi ý chưa có trên char */}
                  {allAvailableTags.filter((t) => !character.tags.includes(t))
                    .length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[var(--border)] max-h-28 overflow-y-auto">
                      <div className="text-[10px] text-[var(--muted)] font-semibold">
                        Chọn nhanh tag có sẵn:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {allAvailableTags
                          .filter((t) => !character.tags.includes(t))
                          .slice(0, 12)
                          .map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleQuickAddTag(t)}
                              className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/15 cursor-pointer"
                            >
                              +{t}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mô tả */}
        <div className="text-sm text-[var(--text)]/90 leading-relaxed">
          <EditableText
            value={character.description}
            onSave={(val) =>
              onUpdateCharacter?.(character.id, { description: val })
            }
            editMode={editMode && canEditChar}
            multiline
          />
        </div>

        {/* Open Scene & Ghi chú của Creator: Chỉ hiện đầy đủ khi ĐÃ MỞ KHÓA */}
        {!requiresUnlock ? (
          <div className="space-y-2.5">
            <blockquote className="pl-3.5 py-2 pr-3 rounded-r-2xl bg-[var(--bg)]/80 border-l-3 border-[var(--accent)] text-xs italic text-[var(--muted)] leading-relaxed">
              <div className="not-italic font-bold text-[11px] text-[var(--text)] mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[var(--accent)]" />
                <span>Open Scene (Lời mở đầu của cảnh):</span>
              </div>
              <EditableText
                value={displayOpenScene}
                onSave={(val) =>
                  onUpdateCharacter?.(character.id, {
                    openingLine: val,
                    openScene: val,
                  })
                }
                editMode={editMode && canEditChar}
                multiline
              />
            </blockquote>

            {character.creatorNote && (
              <div className="px-3 py-2 rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] text-[11px] text-[var(--muted)] flex items-start gap-2">
                <StickyNote className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--text)]">Ghi chú Creator: </strong>
                  <span>{character.creatorNote}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-[var(--bg)] border border-dashed border-[var(--accent)] text-xs text-[var(--muted)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span>
                Open Scene & Link trò chuyện đang được khóa bằng vật phẩm kỷ niệm.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setUnlockPanelOpen((prev) => !prev)}
              className="px-3 py-1 rounded-full bg-[var(--accent)]/25 text-[var(--text)] font-bold text-[11px] shrink-0 cursor-pointer hover:bg-[var(--accent)]/40"
            >
              {unlockPanelOpen ? 'Thu gọn' : 'Xem yêu cầu'}
            </button>
          </div>
        )}

        {/* BẢNG YÊU CẦU MỞ KHÓA BẰNG VẬT PHẨM */}
        {requiresUnlock && unlockPanelOpen && (
          <div className="p-4 rounded-2xl border-2 border-[var(--accent)] bg-[var(--bg)] space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Yêu cầu vật phẩm mở khóa {character.name}</span>
              </span>
              <span className="text-[11px] text-[var(--muted)]">
                Mở khóa 1 lần, lưu vĩnh viễn
              </span>
            </div>

            <div className="space-y-2">
              {requirementStatus.details.map((detail) => {
                const catInfo = CATEGORY_LABELS[detail.req.category];
                return (
                  <div
                    key={detail.req.id}
                    className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
                      detail.isMet
                        ? 'border-emerald-400/50 bg-emerald-500/10'
                        : 'border-rose-300/50 bg-rose-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text)]">
                        {catInfo.emoji} {detail.req.count} {catInfo.name}{' '}
                        {detail.req.specificItemName ? (
                          <strong className="text-[var(--accent)]">
                            “{detail.req.specificItemName}”
                          </strong>
                        ) : (
                          <span className="text-[var(--muted)] font-normal">
                            (bất kỳ)
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-bold text-[11px] ${
                          detail.isMet ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'
                        }`}
                      >
                        {detail.isMet
                          ? `✅ Đã đủ (${detail.ownedCount}/${detail.req.count})`
                          : `❌ Còn thiếu (${detail.ownedCount}/${detail.req.count})`}
                      </span>
                    </div>
                    {!detail.isMet && detail.hintText && (
                      <div className="text-[11px] text-[var(--muted)] flex items-center justify-between gap-2 pt-0.5">
                        <span>{detail.hintText}</span>
                        {onGoToMiniGame && (
                          <button
                            type="button"
                            onClick={onGoToMiniGame}
                            className="underline font-bold text-[var(--text)] hover:text-[var(--accent)] shrink-0 cursor-pointer"
                          >
                            Đến ngay →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {unlockFeedback && (
              <p className="text-[11px] text-amber-600 dark:text-amber-300 font-semibold">
                {unlockFeedback}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-[var(--muted)]">
                {requirementStatus.allMet
                  ? '🎉 Bạn đã có đủ vật phẩm để mở khóa!'
                  : '🌸 Hãy thu thập đủ các mục đánh dấu ✅ để nút Mở khóa sáng lên nhé.'}
              </span>
              <button
                type="button"
                disabled={isLoggedIn && !requirementStatus.allMet}
                onClick={handleConfirmItemUnlock}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                  !isLoggedIn || requirementStatus.allMet
                    ? 'bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-sm'
                    : 'bg-[var(--border)] text-[var(--muted)] opacity-60 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {!isLoggedIn ? 'Đăng nhập để mở khóa' : '✨ Mở khóa ngay'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions: Chat link, Copy link, Ghi chú cá nhân */}
      <div className="mt-6 pt-4 border-t border-[var(--border)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {requiresUnlock ? (
            <button
              type="button"
              onClick={() => setUnlockPanelOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                Mở khóa bằng vật phẩm ({effectiveRequirements.length} yêu cầu)
              </span>
            </button>
          ) : (
            <a
              href={character.chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn shadow-xs"
            >
              <span>💬 Trò chuyện</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <div className="flex items-center gap-1.5">
            {!requiresUnlock && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                title="Sao chép liên kết trò chuyện"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span className="text-[var(--text)] font-semibold">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Copy link</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setDraftNote(personalNote);
                setNoteOpen((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                personalNote.trim()
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)] font-semibold'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]'
              }`}
              title="Ghi chú cá nhân về nhân vật này"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Ghi chú</span>
            </button>
          </div>
        </div>

        {/* Hiển thị ghi chú cá nhân nếu đã lưu */}
        {!noteOpen && personalNote.trim() && (
          <div
            onClick={() => {
              setDraftNote(personalNote);
              setNoteOpen(true);
            }}
            className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--muted)] cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            <span className="text-[var(--text)] font-bold">📒 Sổ tay: </span>
            {personalNote}
          </div>
        )}

        {/* Khung sửa ghi chú cá nhân */}
        {noteOpen && (
          <form
            onSubmit={handleSaveNoteSubmit}
            className="pt-2 space-y-2 text-xs"
          >
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              rows={2}
              placeholder="Viết vài dòng cảm nhận hoặc prompt riêng của bạn cho nhân vật này..."
              className="w-full p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/60 focus:outline-none focus:border-[var(--accent)] resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--muted)]">
                {noteSavedToast ? '✨ Đã lưu vào sổ tay của bạn' : 'Lưu trên trình duyệt'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNoteOpen(false)}
                  className="px-3 py-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold hover:opacity-90 cursor-pointer"
                >
                  Lưu ghi chú
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </article>
  );
};
