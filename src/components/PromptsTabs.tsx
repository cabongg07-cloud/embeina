import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Check,
  Plus,
  BookmarkPlus,
  Star,
  Trash2,
  Folder,
  Search,
  Lock,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Creator,
  CharacterItem,
  SharedPrompt,
  PersonalPrompt,
} from '../data/sampleData';
import { dataStore } from '../services/dataLayer';
import { AuthUser, can, canEditItem } from '../services/authLayer';
import { EditableText, ItemEditControls } from './EditableText';

const SHARED_PROMPTS_COLLECTION = 'shared_prompts';
const PERSONAL_PROMPTS_COLLECTION = 'personal_prompts';

interface SharedPromptsTabProps {
  creators: Creator[];
  characters: CharacterItem[];
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string, fallback: string) => void;
}

export const SharedPromptsTab: React.FC<SharedPromptsTabProps> = ({
  creators,
  characters,
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
}) => {
  const [prompts, setPrompts] = useState<SharedPrompt[]>(() =>
    dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION)
  );

  useEffect(() => {
    return dataStore.onChange(() => {
      setPrompts(dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION));
    });
  }, []);

  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newCreatorId, setNewCreatorId] = useState(
    currentUser.linkedCreatorId || creators[0]?.id || ''
  );
  const [newCharId, setNewCharId] = useState<string>('');
  const [newTags, setNewTags] = useState('');
  const [newUsageNote, setNewUsageNote] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  const canPublishPrompt = can('publish_shared_prompt', currentUser);
  const isEditor = editMode && can('edit', currentUser);

  const creatorMap = useMemo(() => {
    const map: Record<string, Creator> = {};
    creators.forEach((c) => (map[c.id] = c));
    return map;
  }, [creators]);

  const charMap = useMemo(() => {
    const map: Record<string, CharacterItem> = {};
    characters.forEach((c) => (map[c.id] = c));
    return map;
  }, [characters]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return prompts.filter((p) => {
      if (selectedTag !== 'all' && !p.tags.includes(selectedTag)) return false;
      if (q) {
        return (
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [prompts, selectedTag, searchQuery]);

  const openEditPromptForm = (item: SharedPrompt) => {
    setEditingPromptId(item.id);
    setNewTitle(item.title);
    setNewCreatorId(item.creatorId);
    setNewCharId(item.characterId || '');
    setNewTags(item.tags.join(', '));
    setNewUsageNote(item.usageNote);
    setNewContent(item.content);
    setNewImageUrl(item.imageUrl || '');
  };

  const handleSaveEditPrompt = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const tagsArr = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    dataStore.update<SharedPrompt>(SHARED_PROMPTS_COLLECTION, id, {
      title: newTitle.trim() || 'Lệnh chia sẻ',
      characterId: newCharId || undefined,
      tags: tagsArr.length > 0 ? tagsArr : ['Đa dụng'],
      usageNote: newUsageNote.trim(),
      content: newContent.trim(),
      imageUrl: newImageUrl.trim() || undefined,
    });
    setPrompts(dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION));
    setEditingPromptId(null);
  };

  const handleDeletePrompt = (id: string) => {
    dataStore.remove(SHARED_PROMPTS_COLLECTION, id);
    setPrompts(dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION));
  };

  const handleMovePrompt = (id: string, direction: 'up' | 'down') => {
    const next = dataStore.moveItem<SharedPrompt>(
      SHARED_PROMPTS_COLLECTION,
      id,
      direction
    );
    setPrompts(next);
  };

  const handleCopyPrompt = async (id: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleSaveToPersonalVault = (prompt: SharedPrompt) => {
    if (!can('use_personal_prompt_vault', currentUser)) {
      onRequireAuth(
        'Mời bạn đăng nhập để lưu lệnh này vào Kho lệnh cá nhân của bạn nhé 🔖'
      );
      return;
    }
    const creatorName = creatorMap[prompt.creatorId]?.name || 'Creator';
    dataStore.add<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION, {
      title: prompt.title,
      folder: 'Nhập từ Creator',
      tags: prompt.tags,
      content: prompt.content,
      starred: true,
      sourceCreatorName: creatorName,
    });
    setImportedId(prompt.id);
    setTimeout(() => setImportedId(null), 2000);
  };

  const handleCreateSharedPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublishPrompt) return;
    if (!newTitle.trim() || !newContent.trim()) return;
    const tagsArr = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const targetCreatorId = currentUser.isSiteOwner
      ? newCreatorId
      : currentUser.linkedCreatorId || newCreatorId;

    const added = dataStore.add<SharedPrompt>(SHARED_PROMPTS_COLLECTION, {
      title: newTitle.trim(),
      creatorId: targetCreatorId,
      characterId: newCharId || undefined,
      tags: tagsArr.length > 0 ? tagsArr : ['Đa dụng'],
      usageNote:
        newUsageNote.trim() ||
        'Dán trực tiếp vào ô trò chuyện hoặc phần ghi nhớ của nhân vật.',
      content: newContent.trim(),
      imageUrl: newImageUrl.trim() || undefined,
    });

    if (added) {
      setPrompts(dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION));
      setNewTitle('');
      setNewTags('');
      setNewUsageNote('');
      setNewContent('');
      setNewImageUrl('');
      setShowAddForm(false);
    }
  };

  const headerTitle =
    customTexts['prompts_tab_title'] || '🪄 Lệnh & Prompt Chia Sẻ Từ Creator';
  const headerDesc =
    customTexts['prompts_tab_desc'] ||
    'Những câu thần chú ngôn từ được các tác giả chắt lọc để giữ hồn nhân vật và dẫn dắt mạch truyện thật mượt mà.';

  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border)] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={headerTitle}
              editMode={isEditor}
              onSave={(val) =>
                onUpdateCustomText &&
                onUpdateCustomText(
                  'prompts_tab_title',
                  val,
                  '🪄 Lệnh & Prompt Chia Sẻ Từ Creator'
                )
              }
            />
          </h2>
          <div className="text-sm text-[var(--muted)] leading-relaxed">
            <EditableText
              value={headerDesc}
              editMode={isEditor}
              multiline
              onSave={(val) =>
                onUpdateCustomText &&
                onUpdateCustomText('prompts_tab_desc', val, headerDesc)
              }
            />
          </div>
        </div>

        {canPublishPrompt && (
          <button
            type="button"
            onClick={() => {
              setEditingPromptId(null);
              setNewTitle('');
              setNewTags('');
              setNewUsageNote('');
              setNewContent('');
              setNewImageUrl('');
              setShowAddForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {showAddForm ? 'Đóng khung đăng' : '➕ Đăng lệnh chia sẻ'}
            </span>
          </button>
        )}
      </div>

      {showAddForm && canPublishPrompt && (
        <form
          onSubmit={handleCreateSharedPrompt}
          className="soft-card p-6 space-y-4 border-2 border-dashed border-[var(--accent)]"
        >
          <h3 className="font-serif-title text-2xl text-[var(--text)] font-bold">
            ➕ Chia sẻ lệnh / prompt mới lên thư viện
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tiêu đề lệnh *"
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            {currentUser.isSiteOwner ? (
              <select
                value={newCreatorId}
                onChange={(e) => setNewCreatorId(e.target.value)}
                className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              >
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    Creator: {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3.5 py-2 text-xs rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] flex items-center">
                Tác giả:{' '}
                <strong className="text-[var(--text)] ml-1">
                  {creatorMap[currentUser.linkedCreatorId || '']?.name ||
                    'Lâm Vọng Nguyệt'}
                </strong>
              </div>
            )}
            <select
              value={newCharId}
              onChange={(e) => setNewCharId(e.target.value)}
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            >
              <option value="">Gắn với nhân vật (Tùy chọn)</option>
              {characters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  Char: {ch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Các tag cách nhau dấu phẩy..."
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="text"
              value={newUsageNote}
              onChange={(e) => setNewUsageNote(e.target.value)}
              placeholder="Ghi chú cách dùng ngắn gọn..."
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="Dán link ảnh minh họa (https://...)"
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          <textarea
            rows={4}
            required
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Nội dung câu lệnh / prompt *"
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none leading-relaxed"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
            >
              ✨ Đăng lên kệ Lệnh
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 soft-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedTag('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
              selectedTag === 'all'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            Tất cả ({prompts.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                selectedTag === tag
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              ✨ {tag}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm trong lệnh chia sẻ..."
            className="w-full pl-9 pr-3.5 py-2 rounded-full text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredPrompts.map((item, idx) => {
          const creator = creatorMap[item.creatorId];
          const char = item.characterId ? charMap[item.characterId] : undefined;
          const isCopied = copiedId === item.id;
          const isImported = importedId === item.id;
          const canEditPrompt = canEditItem(
            currentUser,
            item.creatorId,
            isEditor
          );

          return (
            <article
              key={item.id}
              className={`soft-card p-6 flex flex-col justify-between gap-4 ${
                canEditPrompt
                  ? 'border-2 border-dashed border-[var(--accent)]'
                  : ''
              }`}
            >
              <div className="space-y-3">
                {/* Thanh ✏️ Sửa, 🗑️ Xóa, ↕️ Sắp xếp */}
                {isEditor && canEditPrompt && (
                  <div className="pb-2 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      ✏️ Lệnh của {creator?.name || 'Creator'}
                    </span>
                    <ItemEditControls
                      canEdit={canEditPrompt}
                      onEdit={() => openEditPromptForm(item)}
                      onDelete={() => handleDeletePrompt(item.id)}
                      onMoveUp={() => handleMovePrompt(item.id, 'up')}
                      onMoveDown={() => handleMovePrompt(item.id, 'down')}
                      disableUp={idx === 0}
                      disableDown={idx === filteredPrompts.length - 1}
                    />
                  </div>
                )}

                {/* Form sửa lệnh trực tiếp (có ô dán link ảnh) */}
                {editingPromptId === item.id && canEditPrompt && (
                  <form
                    onSubmit={(e) => handleSaveEditPrompt(e, item.id)}
                    className="p-4 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-2.5 text-xs"
                  >
                    <div className="font-bold text-[var(--text)] flex items-center justify-between">
                      <span>✏️ Sửa lệnh chia sẻ</span>
                      <button
                        type="button"
                        onClick={() => setEditingPromptId(null)}
                        className="text-[var(--muted)] cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tiêu đề lệnh"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="Tags (cách nhau dấu phẩy)"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                      <input
                        type="url"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="Dán link ảnh minh họa (https://...)"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                    </div>
                    <input
                      type="text"
                      value={newUsageNote}
                      onChange={(e) => setNewUsageNote(e.target.value)}
                      placeholder="Ghi chú cách dùng"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <textarea
                      rows={3}
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Nội dung prompt"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPromptId(null)}
                        className="px-3 py-1 rounded-full border border-[var(--border)] text-[var(--muted)] cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer"
                      >
                        Lưu
                      </button>
                    </div>
                  </form>
                )}

                <h3 className="font-serif-title text-xl sm:text-2xl font-bold text-[var(--text)] leading-snug">
                  <EditableText
                    value={item.title}
                    editMode={canEditPrompt}
                    onSave={(val) => {
                      dataStore.update<SharedPrompt>(
                        SHARED_PROMPTS_COLLECTION,
                        item.id,
                        { title: val }
                      );
                      setPrompts(
                        dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION)
                      );
                    }}
                  />
                </h3>

                <div className="flex flex-wrap items-center gap-2 text-xs border-b border-[var(--border)] pb-3">
                  {creator && (
                    <span className="sticker-chip">🌸 {creator.name}</span>
                  )}
                  {char && (
                    <span className="sticker-chip">💬 {char.name}</span>
                  )}
                  {item.tags.map((t) => (
                    <span key={t} className="sticker-chip">
                      ✨ {t}
                    </span>
                  ))}
                </div>

                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-36 object-cover rounded-2xl border border-[var(--border)]"
                  />
                )}

                <div className="text-xs text-[var(--muted)] italic">
                  <EditableText
                    value={item.usageNote}
                    editMode={canEditPrompt}
                    onSave={(val) => {
                      dataStore.update<SharedPrompt>(
                        SHARED_PROMPTS_COLLECTION,
                        item.id,
                        { usageNote: val }
                      );
                      setPrompts(
                        dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION)
                      );
                    }}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]/90 font-sans-ui whitespace-pre-wrap leading-relaxed">
                  <EditableText
                    value={item.content}
                    editMode={canEditPrompt}
                    multiline
                    onSave={(val) => {
                      dataStore.update<SharedPrompt>(
                        SHARED_PROMPTS_COLLECTION,
                        item.id,
                        { content: val }
                      );
                      setPrompts(
                        dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION)
                      );
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveToPersonalVault(item)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>
                    {isImported
                      ? '✨ Đã lưu vào Kho lệnh!'
                      : 'Lưu vào Kho lệnh cá nhân'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyPrompt(item.id, item.content)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép một chạm</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

interface PersonalPromptVaultTabProps {
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string, fallback: string) => void;
}

export const PersonalPromptVaultTab: React.FC<PersonalPromptVaultTabProps> = ({
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
}) => {
  const [personalPrompts, setPersonalPrompts] = useState<PersonalPrompt[]>(() =>
    dataStore.list<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION)
  );
  const [sharedPrompts] = useState<SharedPrompt[]>(() =>
    dataStore.list<SharedPrompt>(SHARED_PROMPTS_COLLECTION)
  );

  useEffect(() => {
    return dataStore.onChange(() => {
      setPersonalPrompts(
        dataStore.list<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION)
      );
    });
  }, []);

  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('Mặc định');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const hasAccess = can('use_personal_prompt_vault', currentUser);
  const isEditor = editMode && can('edit', currentUser);

  const folders = useMemo(() => {
    const set = new Set<string>([
      'Mặc định',
      'Quản lý trí nhớ',
      'Chuyển cảnh',
      'Nhập từ Creator',
    ]);
    personalPrompts.forEach((p) => {
      if (p.folder) set.add(p.folder);
    });
    return Array.from(set);
  }, [personalPrompts]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return personalPrompts.filter((p) => {
      if (selectedFolder !== 'all' && p.folder !== selectedFolder) return false;
      if (onlyStarred && !p.starred) return false;
      if (q) {
        return (
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [personalPrompts, selectedFolder, onlyStarred, searchQuery]);

  if (!hasAccess) {
    return (
      <div className="soft-card py-16 px-6 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-[var(--accent)]/25 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-[var(--text)]" />
        </div>
        <h2 className="font-serif-title text-2xl sm:text-3xl font-bold text-[var(--text)]">
          🔖 Kho Lệnh Cá Nhân
        </h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Mời bạn đăng nhập tài khoản để lưu trữ các mẫu câu lệnh riêng, sắp xếp theo thư mục và đánh dấu sao nhé 🌸
        </p>
        <button
          type="button"
          onClick={() =>
            onRequireAuth(
              'Mời bạn đăng nhập để mở và sử dụng Kho lệnh cá nhân nhé 🔖'
            )
          }
          className="px-6 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer"
        >
          ✨ Đăng nhập / Đăng ký ngay
        </button>
      </div>
    );
  }

  const handleAddPersonalPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const tagArr = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const added = dataStore.add<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION, {
      title: title.trim(),
      folder: folder.trim() || 'Mặc định',
      tags: tagArr.length > 0 ? tagArr : ['Cá nhân'],
      content: content.trim(),
      starred: false,
    });

    if (added) {
      setPersonalPrompts(
        dataStore.list<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION)
      );
      setTitle('');
      setTags('');
      setContent('');
    }
  };

  const handleToggleStar = (id: string) => {
    const target = personalPrompts.find((p) => p.id === id);
    if (!target) return;
    dataStore.update<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION, id, {
      starred: !target.starred,
    });
    setPersonalPrompts(
      dataStore.list<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION)
    );
  };

  const handleDelete = (id: string) => {
    dataStore.remove(PERSONAL_PROMPTS_COLLECTION, id);
    setPersonalPrompts(
      dataStore.list<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION)
    );
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleImportShared = (sp: SharedPrompt) => {
    dataStore.add<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION, {
      title: sp.title,
      folder: 'Nhập từ Creator',
      tags: sp.tags,
      content: sp.content,
      starred: true,
    });
    setPersonalPrompts(
      dataStore.list<PersonalPrompt>(PERSONAL_PROMPTS_COLLECTION)
    );
    setShowImportModal(false);
  };

  const vaultTitle =
    customTexts['vault_tab_title'] || '🔖 Kho Lệnh Cá Nhân Của Bạn';

  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border)] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={vaultTitle}
              editMode={isEditor}
              onSave={(val) =>
                onUpdateCustomText &&
                onUpdateCustomText(
                  'vault_tab_title',
                  val,
                  '🔖 Kho Lệnh Cá Nhân Của Bạn'
                )
              }
            />
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Ngăn kéo riêng lưu trên trình duyệt của bạn. Sắp xếp prompt theo thư mục, đánh dấu sao những câu lệnh hay dùng và chép nhanh một chạm.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowImportModal((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)] cursor-pointer whitespace-nowrap"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span>Nhập nhanh từ lệnh Creator</span>
        </button>
      </div>

      {showImportModal && (
        <div className="soft-card p-6 space-y-4 border-2 border-[var(--accent)]">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-title text-xl font-bold text-[var(--text)]">
              Chọn lệnh Creator đã chia sẻ để nhập vào Kho cá nhân
            </h3>
            <button
              type="button"
              onClick={() => setShowImportModal(false)}
              className="text-xs text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
            >
              Đóng
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sharedPrompts.map((sp) => (
              <div
                key={sp.id}
                className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text)] truncate">
                    {sp.title}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] truncate">
                    {sp.tags.join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleImportShared(sp)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer shrink-0"
                >
                  + Nhập
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleAddPersonalPrompt}
          className="lg:col-span-4 soft-card p-6 space-y-4 h-fit"
        >
          <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
            ✨ Lưu prompt cá nhân mới
          </h3>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[var(--muted)]">
              Tên gợi nhớ *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Thiết lập nhân vật chính của tôi..."
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Thư mục
              </label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="Mặc định"
                className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Tag (phẩy)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Cổ phong, Persona"
                className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[var(--muted)]">
              Nội dung câu lệnh *
            </label>
            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập câu lệnh bạn muốn lưu trữ riêng..."
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cất vào Kho lệnh</span>
          </button>
        </form>

        <div className="lg:col-span-8 space-y-5">
          <div className="soft-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedFolder('all')}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                  selectedFolder === 'all'
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                Tất cả thư mục
              </button>
              {folders.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFolder(f)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                    selectedFolder === f
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                      : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span>{f}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyStarred((prev) => !prev)}
                className={`px-3 py-1.5 rounded-full text-xs border inline-flex items-center gap-1 cursor-pointer ${
                  onlyStarred
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                <Star
                  className="w-3 h-3"
                  fill={onlyStarred ? 'currentColor' : 'none'}
                />
                <span>Đánh dấu sao</span>
              </button>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm lệnh riêng..."
                className="px-3.5 py-1.5 rounded-full text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] w-40"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredList.map((item) => {
              const isCopied = copiedId === item.id;
              return (
                <article key={item.id} className="soft-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-serif-title text-xl font-bold text-[var(--text)]">
                          {item.title}
                        </h4>
                        <span className="sticker-chip text-[11px] inline-flex items-center gap-1">
                          <Folder className="w-2.5 h-2.5" />
                          {item.folder}
                        </span>
                        {item.tags.map((t) => (
                          <span key={t} className="sticker-chip text-[11px]">
                            ✨ {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStar(item.id)}
                        title="Đánh dấu sao"
                        className="p-2 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        <Star
                          className="w-3.5 h-3.5"
                          fill={item.starred ? 'var(--accent)' : 'none'}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        title="Xóa khỏi kho"
                        className="p-2 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <pre className="p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]/90 font-sans-ui whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </pre>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.content)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép một chạm</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
