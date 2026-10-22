import React, { useState, useMemo, useEffect } from 'react';
import {
  Heart,
  Link2,
  Check,
  ExternalLink,
  PenLine,
  Lock,
  Unlock,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Trash2,
  Pencil,
  BookOpen,
  StickyNote,
  X,
  Loader2,
} from 'lucide-react';
import { CharacterItem, Creator } from '../data/sampleData';
import { EditableText, ItemEditControls } from './EditableText';
import { OpenSceneBox } from './OpenSceneBox';
import {
  CharacterUnlockRequirement,
  ItemCategory,
  CATEGORY_LABELS,
} from '../services/itemSystem';
import {
  SupabaseInventoryItem,
  checkSupabaseUnlockRequirements,
  fetchCharSecretOnDemand,
  unlockCharViaRpc,
} from '../services/supabaseService';

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
  isOwner?: boolean;
  batchSecret?: { chatLink: string; openScene: string } | null;
  isLoadingSecret?: boolean;
  secretError?: string | null;
  onRetryLoadSecret?: () => void;
  onSecretUpdated?: (
    charId: string,
    secret: { chatLink: string; openScene: string }
  ) => void;
  petalsBalance?: number;
  onUnlockWithPetals?: (charId: string, price: number) => boolean;
  onUnlockWithItems?: (charId: string) => void;
  onRequireAuth?: (reason: string) => void;
  onGoToMiniGame?: (zone?: string, targetKind?: string) => void;
  isLoggedIn?: boolean;
  editMode?: boolean;
  canEditChar?: boolean;
  onUpdateCharacter?: (
    charId: string,
    patch: Partial<CharacterItem> & {
      chatLink?: string;
      openSceneSecret?: string;
    }
  ) => void | Promise<void>;
  onDeleteCharacter?: (charId: string) => void | Promise<void>;
  onMoveCharacter?: (charId: string, direction: 'up' | 'down') => void;
  isFirst?: boolean;
  isLast?: boolean;
  currencyName?: string;
  currencyEmoji?: string;
  allAvailableTags?: string[];
  onAddGlobalTag?: (tag: string) => void;
  supabaseInventory?: SupabaseInventoryItem[];
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  creator,
  isFavorite,
  personalNote,
  onToggleFavorite,
  onSaveNote,
  onClickTag,
  isUnlocked = false,
  isOwner = false,
  batchSecret = null,
  isLoadingSecret = false,
  secretError = null,
  onRetryLoadSecret,
  onSecretUpdated,
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
  supabaseInventory = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(personalNote);
  const [noteSavedToast, setNoteSavedToast] = useState(false);

  // Xử lý lỗi tải ảnh đại diện (luôn giữ khung 72x72px và hiện chữ cái đầu tên nhân vật)
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  useEffect(() => {
    setAvatarLoadError(false);
  }, [character.imageUrl]);

  // Trạng thái gắn tag nhanh trực tiếp trên card cho Creator (hiển thị inline, không dùng position: absolute)
  const [quickAddTagOpen, setQuickAddTagOpen] = useState(false);
  const [quickTagInput, setQuickTagInput] = useState('');

  // Dữ liệu secret cục bộ khi vừa mở khóa hoặc vừa chỉnh sửa
  const [localSecret, setLocalSecret] = useState<{
    chatLink: string;
    openScene: string;
  } | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Hộp mở khóa bằng vật phẩm
  const [unlockPanelOpen, setUnlockPanelOpen] = useState(false);
  const [justUnlockedSparkle, setJustUnlockedSparkle] = useState(false);
  const [unlockFeedback, setUnlockFeedback] = useState<string | null>(null);

  // Trạng thái mở form chỉnh sửa đầy đủ & trang chi tiết nhân vật
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editName, setEditName] = useState(character.name);
  const [editCaption, setEditCaption] = useState(character.caption || '');
  const [editEpithet, setEditEpithet] = useState(character.epithet || '');
  const [editAddressTerms, setEditAddressTerms] = useState(
    character.addressTerms || ''
  );
  const [editImageUrl, setEditImageUrl] = useState(character.imageUrl || '');
  const [editAvatarSymbol, setEditAvatarSymbol] = useState(
    character.avatarSymbol
  );
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
        (character.unlockRequirements &&
          character.unlockRequirements.length > 0)
    )
  );
  const [editRequirements, setEditRequirements] = useState<
    CharacterUnlockRequirement[]
  >(
    character.unlockRequirements && character.unlockRequirements.length > 0
      ? character.unlockRequirements
      : [{ id: 'req_default_1', category: 'flower', count: 2 }]
  );

  const ownedItemsSuggestions = useMemo(() => {
    return supabaseInventory;
  }, [supabaseInventory]);

  const effectiveRequirements: CharacterUnlockRequirement[] = useMemo(() => {
    if (
      character.unlockRequirements &&
      character.unlockRequirements.length > 0
    ) {
      return character.unlockRequirements;
    }
    return [];
  }, [character.unlockRequirements]);

  const isCharLocked = Boolean(
    character.isLocked ||
      (character.unlockRequirements && character.unlockRequirements.length > 0)
  );

  // Quyền xem Open Scene & Link chat:
  // - Chủ web (isOwner / canEditChar): luôn có quyền xem mọi char
  // - Khách & Người dùng: chỉ xem được khi char mở tự do (!isCharLocked) hoặc đã mở khóa (isUnlocked / localSecret)
  const canViewSecret = Boolean(
    isOwner || canEditChar || !isCharLocked || isUnlocked || localSecret
  );

  const requiresUnlock = isCharLocked && !canViewSecret;

  const effectiveSecret = localSecret || batchSecret;

  // Đồng hồ cập nhật đếm ngược nếu có vật phẩm đang lớn trong kho đồ
  const [cardNowMs, setCardNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (
      !requiresUnlock ||
      !supabaseInventory ||
      supabaseInventory.length === 0
    )
      return;
    const hasGrowing = supabaseInventory.some(
      (it) => it.readyAt && new Date(it.readyAt).getTime() > cardNowMs
    );
    if (!hasGrowing) return;

    const interval = setInterval(() => {
      setCardNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [requiresUnlock, supabaseInventory, cardNowMs]);

  // Kiểm tra trạng thái đủ / thiếu của từng yêu cầu vật phẩm trên bảng inventory
  const requirementStatus = useMemo(() => {
    if (!requiresUnlock) {
      return {
        allMet: true,
        details: [],
        selectedItems: [] as SupabaseInventoryItem[],
      };
    }
    return checkSupabaseUnlockRequirements(
      effectiveRequirements,
      supabaseInventory,
      cardNowMs
    );
  }, [requiresUnlock, effectiveRequirements, supabaseInventory, cardNowMs]);

  const handleCopyLink = async () => {
    const linkToCopy = effectiveSecret?.chatLink || '';
    if (!linkToCopy) return;
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.createElement('input');
      input.value = linkToCopy;
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

  /**
   * Mở khóa nhân vật bằng hàm RPC `unlock_char(p_char_id)`, xong đọc `char_secrets`.
   */
  const handleConfirmItemUnlock = async () => {
    if (!isLoggedIn) {
      onRequireAuth?.(
        `Mời bạn đăng nhập để dùng vật phẩm mở khóa nhân vật "${character.name}" và lưu vĩnh viễn nhé 🌸`
      );
      return;
    }

    if (unlocking) return;
    setUnlocking(true);
    setUnlockFeedback(null);

    try {
      const { secret } = await unlockCharViaRpc(character.id);
      if (secret) {
        setLocalSecret(secret);
        onSecretUpdated?.(character.id, secret);
      }
      setJustUnlockedSparkle(true);
      setUnlockPanelOpen(false);
      onUnlockWithItems?.(character.id);
      setTimeout(() => setJustUnlockedSparkle(false), 4500);
    } catch (err) {
      setUnlockFeedback(
        err instanceof Error
          ? err.message
          : '🌸 Chưa thể mở khóa nhân vật lúc này, bạn kiểm tra lại Kho đồ nhé!'
      );
    } finally {
      setUnlocking(false);
    }
  };

  const [loadingEditSecret, setLoadingEditSecret] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Sửa nhanh Cap đầu thẻ (caption) ngay trên thẻ dành cho Chủ web
  const [localCaption, setLocalCaption] = useState<string>(
    character.caption || ''
  );
  const [quickCaptionEditing, setQuickCaptionEditing] = useState(false);
  const [quickCaptionDraft, setQuickCaptionDraft] = useState('');
  const [savingQuickCaption, setSavingQuickCaption] = useState(false);
  const [quickCaptionSaved, setQuickCaptionSaved] = useState(false);
  const [quickCaptionError, setQuickCaptionError] = useState<string | null>(
    null
  );

  useEffect(() => {
    setLocalCaption(character.caption || '');
  }, [character.caption]);

  const openQuickCaptionEdit = () => {
    if (!canEditChar) return;
    setQuickCaptionDraft(localCaption);
    setQuickCaptionError(null);
    setQuickCaptionSaved(false);
    setQuickCaptionEditing(true);
  };

  const handleSaveQuickCaption = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEditChar || !onUpdateCharacter || savingQuickCaption) return;
    const trimmed = quickCaptionDraft.trim().slice(0, 60);
    setSavingQuickCaption(true);
    setQuickCaptionError(null);
    try {
      await onUpdateCharacter(character.id, { caption: trimmed });
      setLocalCaption(trimmed);
      setQuickCaptionEditing(false);
      setQuickCaptionSaved(true);
      setTimeout(() => setQuickCaptionSaved(false), 2500);
    } catch (err) {
      setQuickCaptionError(
        err instanceof Error && err.message
          ? err.message
          : 'Không thể lưu Cap đầu thẻ. Vui lòng thử lại.'
      );
    } finally {
      setSavingQuickCaption(false);
    }
  };

  const openEditForm = async () => {
    setEditName(character.name);
    setEditCaption(localCaption);
    setEditEpithet(character.epithet || '');
    setEditAddressTerms(character.addressTerms || '');
    setEditImageUrl(character.imageUrl || '');
    setEditAvatarSymbol(character.avatarSymbol);
    setEditTagsList(character.tags);
    setEditTagInput('');
    setEditDesc(character.description);
    setEditCreatorNote(character.creatorNote || '');
    const locked = Boolean(
      character.isLocked ||
        (character.unlockRequirements &&
          character.unlockRequirements.length > 0)
    );
    setEditIsLocked(locked);
    setEditRequirements(
      character.unlockRequirements && character.unlockRequirements.length > 0
        ? character.unlockRequirements
        : [{ id: `req_${Date.now()}`, category: 'flower', count: 2 }]
    );

    setEditChatUrl('');
    setEditOpenScene('');
    setEditSaveError(null);
    setEditModalOpen(true);

    if (
      effectiveSecret &&
      (effectiveSecret.chatLink || effectiveSecret.openScene)
    ) {
      setEditChatUrl(effectiveSecret.chatLink || '');
      setEditOpenScene(effectiveSecret.openScene || '');
      setLoadingEditSecret(false);
      return;
    }

    setLoadingEditSecret(true);
    try {
      const sec = await fetchCharSecretOnDemand(character.id);
      if (sec) {
        setEditChatUrl(sec.chatLink || '');
        setEditOpenScene(sec.openScene || '');
        setLocalSecret(sec);
        onSecretUpdated?.(character.id, sec);
      }
    } catch {
      // ignore
    } finally {
      setLoadingEditSecret(false);
    }
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

  const handleSaveEditForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !onUpdateCharacter ||
      !editName.trim() ||
      loadingEditSecret ||
      savingEdit
    )
      return;
    setEditSaveError(null);

    let rawChatLink = editChatUrl.trim();
    if (
      rawChatLink &&
      !rawChatLink.startsWith('http://') &&
      !rawChatLink.startsWith('https://')
    ) {
      rawChatLink = `https://${rawChatLink}`;
    }
    const rawOpenScene = editOpenScene.trim();

    const updatedSecret = {
      chatLink: rawChatLink,
      openScene: rawOpenScene,
    };

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

    const trimmedCaption = editCaption.trim().slice(0, 60);

    setSavingEdit(true);
    try {
      await onUpdateCharacter(character.id, {
        name: editName.trim(),
        caption: trimmedCaption,
        epithet: editEpithet.trim().slice(0, 80),
        addressTerms: editAddressTerms.trim(),
        creatorName: character.creatorName || creator?.name || 'Chủ web',
        imageUrl: editImageUrl.trim() || undefined,
        avatarSymbol:
          editAvatarSymbol.trim() || editName.trim().slice(0, 2).toUpperCase(),
        tags: finalTags.length > 0 ? finalTags : ['Đời thường'],
        description: editDesc.trim(),
        creatorNote: editCreatorNote.trim() || undefined,
        isLocked: editIsLocked,
        unlockRequirements: cleanReqs,
        chatLink: rawChatLink,
        openSceneSecret: rawOpenScene,
      });

      setLocalCaption(trimmedCaption);
      setLocalSecret(updatedSecret);
      onSecretUpdated?.(character.id, updatedSecret);

      finalTags.forEach((t) => onAddGlobalTag?.(t));
      setEditModalOpen(false);
    } catch (err) {
      setEditSaveError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu thay đổi. Vui lòng thử lại.'
      );
    } finally {
      setSavingEdit(false);
    }
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

  const avatarInitial = useMemo(() => {
    const raw = (character.name || character.avatarSymbol || '?').trim();
    return raw.charAt(0).toUpperCase() || '?';
  }, [character.name, character.avatarSymbol]);

  const effectiveCaption = localCaption.trim();
  const hasCaption = effectiveCaption !== '';
  const showTopRow = hasCaption || canEditChar || quickCaptionSaved;

  const hasEpithet = Boolean(
    character.epithet && character.epithet.trim() !== ''
  );
  const hasDescription = Boolean(
    character.description && character.description.trim() !== ''
  );
  const hasTagsBlock = Boolean(
    (character.tags && character.tags.length > 0) || canEditChar
  );
  const hasCreatorNote = Boolean(
    canViewSecret &&
      character.creatorNote &&
      character.creatorNote.trim() !== ''
  );

  return (
    <article
      className={`group relative min-w-0 rounded-[22px] border bg-[var(--surface)] p-5 flex flex-col justify-start gap-3.5 transition-colors duration-300 soft-card ${
        editMode && canEditChar
          ? 'border-2 border-dashed border-[var(--accent)]'
          : 'border-[var(--border)]'
      }`}
    >
      {/* 1. Hàng đầu thẻ: Cap đầu thẻ (nếu có) bên trái + nút Sửa/Xóa của Chủ web bên phải */}
      {showTopRow && (
        <div className="pb-2.5 border-b border-dashed border-[var(--border)] flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {canEditChar && quickCaptionEditing ? (
                <form
                  onSubmit={handleSaveQuickCaption}
                  className="flex flex-wrap items-center gap-1.5 min-w-0 w-full"
                >
                  <div className="flex items-center gap-1 bg-[var(--bg)] border border-[var(--accent)] rounded-full px-2.5 py-1 min-w-0 flex-1">
                    <input
                      type="text"
                      value={quickCaptionDraft}
                      maxLength={60}
                      autoFocus
                      disabled={savingQuickCaption}
                      onChange={(e) =>
                        setQuickCaptionDraft(e.target.value.slice(0, 60))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setQuickCaptionEditing(false);
                          setQuickCaptionError(null);
                        }
                      }}
                      placeholder="Ví dụ: ✨ Bác sĩ nhà em, đêm nay trực..."
                      className="bg-transparent text-[11px] text-[var(--text)] placeholder:text-[var(--muted)]/55 focus:outline-none min-w-[140px] flex-1"
                    />
                    <span className="text-[10px] text-[var(--muted)] tabular-nums shrink-0">
                      {quickCaptionDraft.length}/60
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={savingQuickCaption}
                    className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] text-[10px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {savingQuickCaption ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    disabled={savingQuickCaption}
                    onClick={() => {
                      setQuickCaptionEditing(false);
                      setQuickCaptionError(null);
                    }}
                    className="px-2 py-1 rounded-full border border-[var(--border)] text-[10px] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
                  >
                    Hủy
                  </button>
                </form>
              ) : hasCaption ? (
                <div className="inline-flex items-center gap-1 min-w-0">
                  {canEditChar ? (
                    <button
                      type="button"
                      onClick={openQuickCaptionEdit}
                      title="Bấm để sửa nhanh Cap đầu thẻ"
                      className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/45 text-[11px] font-semibold text-[var(--text)] hover:bg-[var(--accent)]/30 transition-colors cursor-pointer text-left break-words min-w-0"
                    >
                      {effectiveCaption}
                    </button>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/45 text-[11px] font-semibold text-[var(--text)] break-words min-w-0">
                      {effectiveCaption}
                    </span>
                  )}
                  {canEditChar && (
                    <button
                      type="button"
                      onClick={openQuickCaptionEdit}
                      title="Sửa nhanh Cap đầu thẻ"
                      aria-label="Sửa nhanh Cap đầu thẻ"
                      className="p-1 rounded-full text-[11px] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--accent)]/20 transition-colors cursor-pointer shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              ) : canEditChar && editMode ? (
                <button
                  type="button"
                  onClick={openQuickCaptionEdit}
                  title="Thêm Cap đầu thẻ"
                  className="px-2.5 py-0.5 rounded-full border border-dashed border-[var(--accent)] bg-[var(--bg)] text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--accent)]/15 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span>✏️</span>
                  <span>Đặt cap đầu thẻ...</span>
                </button>
              ) : null}

              {quickCaptionSaved && !quickCaptionEditing && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5 shrink-0">
                  <Check className="w-3 h-3" />
                  <span>Đã lưu</span>
                </span>
              )}
            </div>

            {canEditChar && (
              <div className="inline-flex items-center gap-1.5 shrink-0 ml-auto">
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
                  <>
                    <button
                      type="button"
                      onClick={openEditForm}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      <Pencil className="w-3 h-3 shrink-0" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCharacter?.(character.id)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-rose-300/60 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      <Trash2 className="w-3 h-3 shrink-0" />
                      <span>Xóa</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {quickCaptionError && (
            <div className="text-[11px] text-rose-500 font-semibold">
              ⚠️ {quickCaptionError}
            </div>
          )}
        </div>
      )}

      {/* 2. Hàng ảnh (cố định 72x72px, kể cả khi lỗi ảnh) + tên + nút tim */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          {character.imageUrl && !avatarLoadError ? (
            <img
              src={character.imageUrl}
              alt={character.name}
              width={72}
              height={72}
              onError={() => setAvatarLoadError(true)}
              onClick={() => setDetailModalOpen(true)}
              className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-2xl shrink-0 object-cover border-2 border-[var(--border)] shadow-xs cursor-pointer"
            />
          ) : (
            <div
              onClick={() => setDetailModalOpen(true)}
              className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-2xl shrink-0 flex items-center justify-center border-2 border-[var(--border)] font-serif-title text-2xl font-bold text-[#efe6ea] select-none shadow-xs cursor-pointer"
              style={{ backgroundColor: character.avatarTint || '#f4a3b0' }}
              aria-hidden="true"
            >
              {avatarInitial}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                onClick={() => {
                  if (!(editMode && canEditChar)) {
                    setDetailModalOpen(true);
                  }
                }}
                className="font-serif-title text-xl font-bold text-[var(--text)] leading-snug break-words cursor-pointer hover:text-[var(--accent)] transition-colors"
              >
                <EditableText
                  value={character.name}
                  onSave={(val) =>
                    onUpdateCharacter?.(character.id, { name: val })
                  }
                  editMode={editMode && canEditChar}
                />
              </h3>
              {isCharLocked && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                    requiresUnlock
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-400/40'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-400/40'
                  }`}
                >
                  {requiresUnlock ? (
                    <>
                      <Lock className="w-2.5 h-2.5" />
                      <span>Khóa vật phẩm</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-2.5 h-2.5" />
                      <span>Đã mở khóa</span>
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleFavorite(character.id)}
          aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          title={isFavorite ? 'Đã yêu thích' : 'Yêu thích nhân vật này'}
          className={`p-2 rounded-full border transition-colors duration-200 cursor-pointer shrink-0 bouncy-btn ${
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

      {/* 3. Danh xưng (chỉ hiện nếu có, rỗng thì không render) */}
      {hasEpithet && (
        <div className="text-xs font-semibold text-[var(--muted)] leading-snug break-words min-w-0">
          <EditableText
            value={character.epithet}
            allowEmpty
            onSave={(val) =>
              onUpdateCharacter?.(character.id, {
                epithet: val.trim().slice(0, 80),
              })
            }
            editMode={editMode && canEditChar}
          />
        </div>
      )}

      {/* 4. Mô tả (chỉ hiện nếu có) */}
      {hasDescription && (
        <div className="text-sm text-[var(--text)]/90 leading-relaxed break-words min-w-0">
          <EditableText
            value={character.description}
            onSave={(val) =>
              onUpdateCharacter?.(character.id, { description: val })
            }
            editMode={editMode && canEditChar}
            multiline
          />
        </div>
      )}

      {/* 5. Tag (chỉ hiện nếu có tag hoặc Chủ web quản lý) */}
      {hasTagsBlock && (
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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

            {canEditChar && (
              <button
                type="button"
                onClick={() => setQuickAddTagOpen((prev) => !prev)}
                className="px-2 py-0.5 rounded-full border border-dashed border-[var(--accent)] bg-[var(--surface)] text-[10px] font-bold text-[var(--text)] hover:bg-[var(--accent)]/20 cursor-pointer inline-flex items-center gap-0.5"
                title="Gắn thêm tag cho nhân vật này"
              >
                <Plus className="w-2.5 h-2.5 text-[var(--accent)]" />
                <span>Thêm tag</span>
              </button>
            )}
          </div>

          {canEditChar && quickAddTagOpen && (
            <div className="p-2.5 rounded-2xl bg-[var(--bg)] border border-[var(--accent)] flex flex-col gap-2 text-xs">
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

              <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)]">
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
                  className="px-2.5 py-0.5 rounded-lg bg-[var(--accent)] text-[#3a2b30] text-[10px] font-bold cursor-pointer shrink-0"
                >
                  Gắn
                </button>
              </div>

              {allAvailableTags.filter((t) => !character.tags.includes(t))
                .length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--border)] max-h-24 overflow-y-auto">
                  {allAvailableTags
                    .filter((t) => !character.tags.includes(t))
                    .slice(0, 12)
                    .map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleQuickAddTag(t)}
                        className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/15 cursor-pointer"
                      >
                        +{t}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. Khối Open Scene đồng nhất cho mọi thẻ (đúng MỘT khối Open Scene) */}
      {canViewSecret ? (
        <OpenSceneBox
          content={effectiveSecret?.openScene || ''}
          placeholder="(Chưa có lời mở đầu)"
          loading={Boolean(isLoadingSecret && !effectiveSecret)}
          error={!effectiveSecret ? secretError : null}
          onRetry={onRetryLoadSecret}
          editable={
            Boolean(editMode && canEditChar && !isLoadingSecret && !secretError)
          }
          onSave={async (val) => {
            await onUpdateCharacter?.(character.id, {
              openSceneSecret: val,
            });
            const nextSec = {
              chatLink: effectiveSecret?.chatLink || '',
              openScene: val,
            };
            setLocalSecret(nextSec);
            onSecretUpdated?.(character.id, nextSec);
          }}
        />
      ) : (
        <div className="w-full rounded-2xl bg-[var(--bg)]/85 border border-dashed border-[var(--accent)] px-3.5 py-3 text-xs text-[var(--muted)] flex items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span className="leading-snug font-medium text-[var(--text)]/90 break-words">
              🔒 Open Scene và link chat đang được khóa
            </span>
          </div>
          <button
            type="button"
            onClick={() => setUnlockPanelOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-full bg-[var(--accent)]/25 text-[var(--text)] font-bold text-[11px] shrink-0 cursor-pointer hover:bg-[var(--accent)]/40 transition-colors"
          >
            {unlockPanelOpen ? 'Thu gọn' : 'Xem chi tiết'}
          </button>
        </div>
      )}

      {/* Ghi chú Chủ web (chỉ hiện khi có dữ liệu và đã có quyền xem) */}
      {hasCreatorNote && (
        <div className="px-3 py-2 rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] text-[11px] text-[var(--muted)] flex items-start gap-2 min-w-0">
          <StickyNote className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="break-words min-w-0">
            <strong className="text-[var(--text)]">Ghi chú Chủ web: </strong>
            <span>{character.creatorNote}</span>
          </div>
        </div>
      )}

      {/* Bảng yêu cầu mở khóa bằng vật phẩm khi người dùng bấm Xem chi tiết trên char đang khóa */}
      {unlockPanelOpen && requiresUnlock && (
        <div className="p-4 rounded-2xl border-2 border-[var(--accent)] bg-[var(--bg)] flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[var(--text)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
              <span>Yêu cầu vật phẩm mở khóa {character.name}</span>
            </span>
            <span className="text-[11px] text-[var(--muted)]">
              Chỉ tính hoa đã nở / cá đã lớn
            </span>
          </div>

          {effectiveRequirements.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Nhân vật này đang khóa. Hãy bấm Mở khóa ngay bên dưới nhé!
            </p>
          ) : (
            <div className="flex flex-col gap-2">
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
                          detail.isMet
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-rose-500'
                        }`}
                      >
                        {detail.isMet
                          ? `✅ Đã đủ (${detail.ownedReadyCount}/${detail.req.count})`
                          : `❌ Còn thiếu (${detail.ownedReadyCount}/${detail.req.count})`}
                      </span>
                    </div>
                    {detail.matchedItemNames &&
                      detail.matchedItemNames.length > 0 && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium pt-1 border-t border-[var(--border)]/40">
                          Sẽ dùng trong kho:{' '}
                          <span className="font-bold">
                            {detail.matchedItemNames.join(', ')}
                          </span>
                        </div>
                      )}
                    {!detail.isMet && (
                      <div className="text-[11px] text-[var(--muted)] flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border)]/40">
                        <span>{detail.hintText}</span>
                        {onGoToMiniGame && (
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {detail.req.category === 'flower' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onGoToMiniGame('garden', 'flower')
                                }
                                className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-800 dark:text-emerald-200 font-bold text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                              >
                                <span>🌱 Đến Vườn hoa</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onGoToMiniGame('market', detail.req.category)
                              }
                              className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                            >
                              <span>🛒 Mua nhanh ở Chợ</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {requirementStatus.selectedItems.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-[11px] text-[var(--text)]">
              <p className="font-bold mb-1">
                📦 Vật phẩm trong Kho đồ sẽ dùng để mở khóa (
                {requirementStatus.selectedItems.length} món):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {requirementStatus.selectedItems.map((it) => {
                  const catInfo =
                    CATEGORY_LABELS[it.kind] || CATEGORY_LABELS[it.category];
                  return (
                    <span
                      key={it.id}
                      className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] font-semibold text-[10px]"
                    >
                      {catInfo?.emoji || '✨'} {it.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {unlockFeedback && (
            <p className="text-[11px] text-amber-600 dark:text-amber-300 font-semibold">
              {unlockFeedback}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-[var(--muted)]">
              {requirementStatus.allMet
                ? '🎉 Xác nhận dùng các vật phẩm trên để mở khóa nhé!'
                : '🌸 Chỉ tính hoa đã nở / cá đã lớn trong Kho đồ.'}
            </span>
            <button
              type="button"
              disabled={unlocking}
              onClick={handleConfirmItemUnlock}
              className="px-4 py-2 rounded-full text-xs font-bold transition-colors inline-flex items-center gap-1.5 bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-sm disabled:opacity-60 shrink-0"
            >
              {unlocking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                {!isLoggedIn
                  ? 'Đăng nhập để mở khóa'
                  : unlocking
                  ? 'Đang mở khóa...'
                  : '✨ Mở khóa'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Thông báo vừa mở khóa thành công */}
      {justUnlockedSparkle && (
        <div className="p-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/20 text-xs font-bold text-[var(--text)] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>
            ✨ Mở khóa thành công! Link chat và Open Scene của {character.name}{' '}
            đã mở vĩnh viễn cho bạn!
          </span>
        </div>
      )}

      {/* Hàng nút hành động dưới thẻ */}
      <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canViewSecret ? (
            effectiveSecret?.chatLink ? (
              <a
                href={effectiveSecret.chatLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn shadow-xs"
              >
                <span>💬 Trò chuyện</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setDetailModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Xem chi tiết</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setUnlockPanelOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {unlockPanelOpen
                  ? 'Ẩn yêu cầu mở khóa'
                  : `Mở khóa nhân vật (${effectiveRequirements.length} yêu cầu)`}
              </span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            {canViewSecret && effectiveSecret?.chatLink && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                title="Sao chép liên kết trò chuyện"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span className="text-[var(--text)] font-semibold">
                      Đã chép
                    </span>
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
            className="p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--muted)] cursor-pointer hover:border-[var(--accent)] transition-colors break-words"
          >
            <span className="text-[var(--text)] font-bold">📒 Sổ tay: </span>
            {personalNote}
          </div>
        )}

        {/* Khung sửa ghi chú cá nhân */}
        {noteOpen && (
          <form
            onSubmit={handleSaveNoteSubmit}
            className="pt-1 flex flex-col gap-2 text-xs"
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
                {noteSavedToast
                  ? '✨ Đã lưu vào sổ tay của bạn'
                  : 'Lưu trên trình duyệt'}
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

      {/* Modal Chỉnh sửa nhân vật dành cho Chủ web (không đẩy bố cục thẻ) */}
      {editModalOpen && canEditChar && (
        <div
          onClick={() => setEditModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveEditForm}
            className="w-full max-w-2xl rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-2.5">
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
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
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
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] text-[var(--muted)]">
                    Cap đầu thẻ (tùy chọn)
                  </label>
                  <span className="text-[10px] font-medium text-[var(--muted)] tabular-nums">
                    {editCaption.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  value={editCaption}
                  maxLength={60}
                  onChange={(e) => setEditCaption(e.target.value.slice(0, 60))}
                  placeholder="Ví dụ: ✨ Bác sĩ nhà em, đêm nay trực..."
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/55 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--muted)] mb-1">
                  Danh xưng / Phụ đề ngắn
                </label>
                <input
                  type="text"
                  value={editEpithet}
                  maxLength={80}
                  onChange={(e) => setEditEpithet(e.target.value.slice(0, 80))}
                  placeholder="Ví dụ: Anh hàng xóm, Cô giáo chủ nhiệm..."
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/55 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-[var(--muted)]">
                Cách xưng hô (tùy chọn)
              </label>
              <input
                type="text"
                value={editAddressTerms}
                maxLength={50}
                onChange={(e) => setEditAddressTerms(e.target.value)}
                placeholder="Ví dụ: anh - em"
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/55 focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] text-[var(--muted)]">
                  Gợi ý nhanh:
                </span>
                {[
                  'anh - em',
                  'anh - bé',
                  'anh - vợ',
                  'em - anh',
                  'chị - em',
                  'cậu - tớ',
                  'mình - cậu',
                  'tôi - em',
                ].map((pair) => (
                  <button
                    key={pair}
                    type="button"
                    onClick={() => setEditAddressTerms(pair)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors cursor-pointer ${
                      editAddressTerms.trim().toLowerCase() === pair
                        ? 'border-[var(--accent)] bg-[var(--accent)]/25 text-[var(--text)] font-bold'
                        : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {pair}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">
                Tag (Gõ rồi nhấn Enter, dấu phẩy hoặc nút Thêm)
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
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
                  <span className="text-[10px] text-[var(--muted)]">
                    Gợi ý tag:
                  </span>
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
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
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
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-[var(--muted)] mb-1">
                Open Scene (Lời mở đầu của cảnh)
              </label>
              <textarea
                rows={4}
                value={editOpenScene}
                onChange={(e) => setEditOpenScene(e.target.value)}
                placeholder="Nhập nội dung Open Scene..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              <OpenSceneBox
                content={editOpenScene}
                label="Xem trước khung Open Scene:"
                placeholder="(Nhập nội dung Open Scene ở trên để xem trước khung hiển thị...)"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">
                Ghi chú của Chủ web
              </label>
              <input
                type="text"
                value={editCreatorNote}
                onChange={(e) => setEditCreatorNote(e.target.value)}
                placeholder="Gợi ý cách trò chuyện, thiết lập..."
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            {/* Trạng thái Mở / Khóa & Yêu cầu mở khóa bằng vật phẩm */}
            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--text)]">
                  Trạng thái nhân vật:
                </span>
                <div className="inline-flex rounded-full border border-[var(--border)] p-0.5 bg-[var(--surface)]">
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
                      Yêu cầu vật phẩm để mở khóa:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditRequirements([
                          ...editRequirements,
                          {
                            id: `req_${Date.now()}_${Math.random()
                              .toString(36)
                              .slice(2, 5)}`,
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
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)]"
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
                          className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
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
                              count: Math.max(
                                1,
                                parseInt(e.target.value, 10) || 1
                              ),
                            };
                            setEditRequirements(next);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
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
                          className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                        <datalist
                          id={`specific-items-${req.category}-${character.id}`}
                        >
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

            {loadingEditSecret && (
              <div className="p-2 rounded-xl bg-[var(--bg)] text-center text-xs text-[var(--muted)] animate-pulse">
                ⏳ Đang tải link chat và open scene từ máy chủ...
              </div>
            )}

            {editSaveError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-semibold">
                ⚠️ {editSaveError}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-[var(--muted)]">
                {loadingEditSecret ? 'Đang đồng bộ dữ liệu...' : 'Sẵn sàng lưu'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loadingEditSecret || savingEdit}
                  className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Hộp / Trang chi tiết nhân vật */}
      {detailModalOpen && (
        <div
          onClick={() => setDetailModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border-2 border-[var(--accent)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                {character.imageUrl && !avatarLoadError ? (
                  <img
                    src={character.imageUrl}
                    alt={character.name}
                    width={72}
                    height={72}
                    onError={() => setAvatarLoadError(true)}
                    className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-2xl shrink-0 object-cover border-2 border-[var(--border)] shadow-xs"
                  />
                ) : (
                  <div
                    className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-2xl shrink-0 flex items-center justify-center border-2 border-[var(--border)] font-serif-title text-2xl font-bold text-[#efe6ea] select-none shadow-xs"
                    style={{
                      backgroundColor: character.avatarTint || '#f4a3b0',
                    }}
                    aria-hidden="true"
                  >
                    {avatarInitial}
                  </div>
                )}

                <div className="min-w-0">
                  {hasCaption && (
                    <span className="inline-block mb-1 px-2.5 py-0.5 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/45 text-[11px] font-semibold text-[var(--text)] break-words">
                      {effectiveCaption}
                    </span>
                  )}
                  <h3 className="font-serif-title text-2xl font-bold text-[var(--text)] leading-snug break-words">
                    {character.name}
                  </h3>
                  {hasEpithet && (
                    <p className="text-xs font-semibold text-[var(--muted)] break-words mt-0.5">
                      {character.epithet}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
                aria-label="Đóng chi tiết"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {hasDescription && (
              <div className="text-sm text-[var(--text)]/90 leading-relaxed whitespace-pre-wrap break-words">
                {character.description}
              </div>
            )}

            {character.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {character.tags.map((tag) => (
                  <span key={tag} className="sticker-chip text-[11px]">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {canViewSecret ? (
              <div className="space-y-2.5 min-w-0">
                <OpenSceneBox
                  content={effectiveSecret?.openScene || ''}
                  placeholder="(Chưa có lời mở đầu)"
                  loading={Boolean(isLoadingSecret && !effectiveSecret)}
                  error={!effectiveSecret ? secretError : null}
                  onRetry={onRetryLoadSecret}
                  editable={
                    Boolean(
                      editMode &&
                        canEditChar &&
                        !isLoadingSecret &&
                        !secretError
                    )
                  }
                  onSave={async (val) => {
                    await onUpdateCharacter?.(character.id, {
                      openSceneSecret: val,
                    });
                    const nextSec = {
                      chatLink: effectiveSecret?.chatLink || '',
                      openScene: val,
                    };
                    setLocalSecret(nextSec);
                    onSecretUpdated?.(character.id, nextSec);
                  }}
                />
                {hasCreatorNote && (
                  <div className="px-3 py-2 rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] text-[11px] text-[var(--muted)] flex items-start gap-2">
                    <StickyNote className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="break-words min-w-0">
                      <strong className="text-[var(--text)]">
                        Ghi chú Chủ web:{' '}
                      </strong>
                      <span>{character.creatorNote}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[var(--bg)] border border-dashed border-[var(--accent)] text-xs text-[var(--muted)] flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--text)]/90">
                  🔒 Open Scene và link chat đang được khóa
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    setUnlockPanelOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[var(--accent)]/25 text-[var(--text)] font-bold text-[11px] shrink-0 cursor-pointer hover:bg-[var(--accent)]/40"
                >
                  Xem điều kiện mở khóa
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
              {canViewSecret && effectiveSecret?.chatLink ? (
                <a
                  href={effectiveSecret.chatLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn shadow-xs"
                >
                  <span>💬 Trò chuyện</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : !canViewSecret ? (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    setUnlockPanelOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Mở khóa bằng vật phẩm</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-1.5 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
