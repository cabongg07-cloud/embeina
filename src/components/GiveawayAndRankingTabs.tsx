import React, { useState, useMemo, useEffect } from 'react';
import {
  Gift,
  Sparkles,
  Users,
  Clock,
  Plus,
  Heart,
  MessageCircle,
  Award,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Creator,
  CharacterItem,
  GiveawayItem,
  SAMPLE_GIVEAWAYS,
} from '../data/sampleData';
import { AuthUser, can, canEditItem } from '../services/authLayer';
import { EditableText, ItemEditControls } from './EditableText';

interface GiveawayTabProps {
  creators: Creator[];
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string, fallback: string) => void;
  giveaways?: GiveawayItem[];
  onUpdateGiveaways?: (next: GiveawayItem[], label?: string) => void;
}

export const GiveawayTab: React.FC<GiveawayTabProps> = ({
  creators,
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
  giveaways: propGiveaways,
  onUpdateGiveaways,
}) => {
  const [giveaways, setGiveaways] = useState<GiveawayItem[]>(() =>
    propGiveaways && propGiveaways.length > 0 ? propGiveaways : SAMPLE_GIVEAWAYS
  );

  useEffect(() => {
    if (propGiveaways && propGiveaways.length > 0) {
      setGiveaways(propGiveaways);
    }
  }, [propGiveaways]);

  const syncGiveaways = (next: GiveawayItem[], label = 'Cập nhật Giveaway') => {
    setGiveaways(next);
    onUpdateGiveaways?.(next, label);
  };

  const [joinNameMap, setJoinNameMap] = useState<Record<string, string>>({});
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [shuffleName, setShuffleName] = useState<string>('');
  const [sparkleWinner, setSparkleWinner] = useState<Record<string, string>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [editingGaId, setEditingGaId] = useState<string | null>(null);

  const [newCreatorId, setNewCreatorId] = useState(
    currentUser.id || currentUser.linkedCreatorId || creators[0]?.id || ''
  );
  const [newTitle, setNewTitle] = useState('');
  const [newPrize, setNewPrize] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [newDeadline, setNewDeadline] = useState('Còn 3 ngày 00 giờ');
  const [newImageUrl, setNewImageUrl] = useState('');

  const canCreateGiveaway = can('create_giveaway', currentUser);
  const canDrawWinner = can('draw_giveaway_winner', currentUser);
  const isEditor = editMode && can('edit', currentUser);

  const creatorMap = useMemo(() => {
    const map: Record<string, Creator> = {};
    creators.forEach((c) => (map[c.id] = c));
    return map;
  }, [creators]);

  const openEditGiveawayForm = (ga: GiveawayItem) => {
    setEditingGaId(ga.id);
    setNewTitle(ga.title);
    setNewPrize(ga.prize);
    setNewCondition(ga.condition);
    setNewDeadline(ga.deadlineText);
    setNewImageUrl(ga.imageUrl || '');
  };

  const handleSaveEditGiveaway = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const next = giveaways.map((g) =>
      g.id === id
        ? {
            ...g,
            title: newTitle.trim() || 'Giveaway',
            prize: newPrize.trim(),
            condition: newCondition.trim(),
            deadlineText: newDeadline.trim() || 'Còn 3 ngày',
            imageUrl: newImageUrl.trim() || undefined,
          }
        : g
    );
    syncGiveaways(next, 'Sửa thông tin Giveaway');
    setEditingGaId(null);
  };

  const handleDeleteGiveaway = (id: string) => {
    const next = giveaways.filter((g) => g.id !== id);
    syncGiveaways(next, 'Xóa kỳ Giveaway');
  };

  const handleMoveGiveaway = (id: string, direction: 'up' | 'down') => {
    const idx = giveaways.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= giveaways.length) return;
    const next = [...giveaways];
    const [item] = next.splice(idx, 1);
    next.splice(targetIdx, 0, item);
    syncGiveaways(next, 'Đổi thứ tự Giveaway');
  };

  const handleJoinGiveaway = (gaId: string) => {
    if (!can('join_giveaway', currentUser)) {
      onRequireAuth(
        'Mời bạn đăng nhập để ghi danh tham gia nhận quà Giveaway nhé 🎁'
      );
      return;
    }
    const ga = giveaways.find((g) => g.id === gaId);
    if (!ga) return;
    const participantName =
      (joinNameMap[gaId] || '').trim() ||
      currentUser.displayName ||
      'Bạn Nhỏ';
    if (ga.participants.includes(participantName)) return;

    const next = giveaways.map((g) =>
      g.id === gaId
        ? { ...g, participants: [...g.participants, participantName] }
        : g
    );
    syncGiveaways(next, 'Ghi danh tham gia Giveaway');
    setJoinNameMap((prev) => ({ ...prev, [gaId]: '' }));
  };

  const handleDrawWinner = (gaId: string) => {
    if (!canDrawWinner) {
      onRequireAuth('Chỉ Creator mới có quyền quay bốc thăm người thắng cuộc.');
      return;
    }
    const ga = giveaways.find((g) => g.id === gaId);
    if (!ga || ga.participants.length === 0 || drawingId) return;

    setDrawingId(gaId);
    let step = 0;
    const totalSteps = 16;

    const runStep = () => {
      step += 1;
      const randomCandidate =
        ga.participants[Math.floor(Math.random() * ga.participants.length)];
      setShuffleName(randomCandidate);

      if (step < totalSteps) {
        setTimeout(runStep, 90 + step * 22);
      } else {
        const finalWinner =
          ga.participants[Math.floor(Math.random() * ga.participants.length)];
        const nowStr = new Date().toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const next = giveaways.map((g) =>
          g.id === gaId
            ? {
                ...g,
                winnerHistory: [
                  { winnerName: finalWinner, drawnAt: nowStr },
                  ...g.winnerHistory,
                ],
              }
            : g
        );
        syncGiveaways(next, `Bốc thăm người thắng: ${finalWinner}`);
        setSparkleWinner((prev) => ({ ...prev, [gaId]: finalWinner }));
        setDrawingId(null);
      }
    };

    runStep();
  };

  const handleCreateGiveaway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateGiveaway) return;
    if (!newTitle.trim() || !newPrize.trim()) return;

    const targetCreatorId = currentUser.isSiteOwner
      ? newCreatorId || currentUser.id
      : currentUser.id || currentUser.linkedCreatorId || newCreatorId;

    const created: GiveawayItem = {
      id: `ga_${Date.now()}`,
      creatorId: targetCreatorId,
      title: newTitle.trim(),
      prize: newPrize.trim(),
      condition: newCondition.trim() || 'Tham gia tự do tại Góc Nhỏ Lấp Lánh.',
      deadlineText: newDeadline.trim() || 'Còn 3 ngày',
      endsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      participants: ['Bạn nhỏ đầu tiên'],
      winnerHistory: [],
      isEnded: false,
      imageUrl: newImageUrl.trim() || undefined,
    };

    syncGiveaways([created, ...giveaways], `Tạo Giveaway "${created.title}"`);
    setNewTitle('');
    setNewPrize('');
    setNewCondition('');
    setNewImageUrl('');
    setShowCreate(false);
  };

  const headerTitle =
    customTexts['giveaway_tab_title'] || '🎁 Góc Quà Tặng (Giveaway)';
  const headerDesc =
    customTexts['giveaway_tab_desc'] ||
    'Những món quà xinh xắn gửi trao như lời cảm ơn dịu dàng.';

  return (
    <div className="space-y-10">
      <div className="border-b border-[var(--border)] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={headerTitle}
              editMode={isEditor}
              onSave={(val) =>
                onUpdateCustomText &&
                onUpdateCustomText(
                  'giveaway_tab_title',
                  val,
                  '🎁 Góc Quà Tặng (Giveaway)'
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
                onUpdateCustomText('giveaway_tab_desc', val, headerDesc)
              }
            />
          </div>
        </div>

        {canCreateGiveaway && (
          <button
            type="button"
            onClick={() => {
              setEditingGaId(null);
              setNewTitle('');
              setNewPrize('');
              setNewCondition('');
              setNewImageUrl('');
              setShowCreate((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreate ? 'Đóng khung tạo' : '➕ Tạo Giveaway mới'}</span>
          </button>
        )}
      </div>

      {showCreate && canCreateGiveaway && (
        <form
          onSubmit={handleCreateGiveaway}
          className="soft-card p-6 space-y-4 border-2 border-dashed border-[var(--accent)]"
        >
          <h3 className="font-serif-title text-2xl text-[var(--text)] font-bold">
            ➕ Khởi tạo kỳ Giveaway mới
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tên sự kiện Giveaway *"
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
                    Creator tài trợ: {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3.5 py-2 text-xs rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] flex items-center">
                Creator tài trợ:{' '}
                <strong className="text-[var(--text)] ml-1">
                  {creatorMap[currentUser.linkedCreatorId || '']?.name ||
                    'Lâm Vọng Nguyệt'}
                </strong>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              value={newPrize}
              onChange={(e) => setNewPrize(e.target.value)}
              placeholder="Phần thưởng *"
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="text"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              placeholder="Thời hạn đếm ngược (VD: Còn 3 ngày)..."
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="Dán link ảnh phần thưởng (https://...)"
              className="px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
          <input
            type="text"
            value={newCondition}
            onChange={(e) => setNewCondition(e.target.value)}
            placeholder="Điều kiện tham gia..."
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
            >
              ✨ Mở Giveaway
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {giveaways.map((ga, idx) => {
          const creator = creatorMap[ga.creatorId];
          const isDrawing = drawingId === ga.id;
          const recentWinner = sparkleWinner[ga.id];
          const canEditGa = canEditItem(currentUser, ga.creatorId, isEditor);
          const canCreatorDraw =
            canDrawWinner &&
            (currentUser.isSiteOwner ||
              currentUser.linkedCreatorId === ga.creatorId);

          return (
            <article
              key={ga.id}
              className={`soft-card p-6 flex flex-col justify-between gap-6 ${
                canEditGa
                  ? 'border-2 border-dashed border-[var(--accent)]'
                  : ''
              }`}
            >
              <div className="space-y-4">
                {/* Thanh ✏️ Sửa, 🗑️ Xóa, ↕️ Sắp xếp */}
                {isEditor && canEditGa && (
                  <div className="pb-2 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      ✏️ Giveaway của {creator?.name || 'Creator'}
                    </span>
                    <ItemEditControls
                      canEdit={canEditGa}
                      onEdit={() => openEditGiveawayForm(ga)}
                      onDelete={() => handleDeleteGiveaway(ga.id)}
                      onMoveUp={() => handleMoveGiveaway(ga.id, 'up')}
                      onMoveDown={() => handleMoveGiveaway(ga.id, 'down')}
                      disableUp={idx === 0}
                      disableDown={idx === giveaways.length - 1}
                    />
                  </div>
                )}

                {/* Form sửa Giveaway (có ô dán link ảnh) */}
                {editingGaId === ga.id && canEditGa && (
                  <form
                    onSubmit={(e) => handleSaveEditGiveaway(e, ga.id)}
                    className="p-4 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-2.5 text-xs"
                  >
                    <div className="font-bold text-[var(--text)] flex items-center justify-between">
                      <span>✏️ Sửa thông tin Giveaway</span>
                      <button
                        type="button"
                        onClick={() => setEditingGaId(null)}
                        className="text-[var(--muted)] cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tên Giveaway"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={newPrize}
                      onChange={(e) => setNewPrize(e.target.value)}
                      placeholder="Phần thưởng"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                      <input
                        type="url"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="Dán link ảnh phần thưởng (https://...)"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                    </div>
                    <input
                      type="text"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      placeholder="Thời hạn"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      placeholder="Điều kiện"
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingGaId(null)}
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

                <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
                      <EditableText
                        value={ga.title}
                        editMode={canEditGa}
                        onSave={(val) => {
                          const next = giveaways.map((g) =>
                            g.id === ga.id ? { ...g, title: val } : g
                          );
                          syncGiveaways(next, 'Đổi tên Giveaway');
                        }}
                      />
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-1">
                      <span>Tài trợ bởi: {creator?.name || 'Góc Nhỏ'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="sticker-chip text-[11px] inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        <EditableText
                          value={ga.deadlineText}
                          editMode={canEditGa}
                          onSave={(val) => {
                            const next = giveaways.map((g) =>
                              g.id === ga.id ? { ...g, deadlineText: val } : g
                            );
                            syncGiveaways(next, 'Đổi hạn Giveaway');
                          }}
                        />
                      </span>
                    </div>
                  </div>
                  <Gift className="w-5 h-5 text-[var(--accent)] shrink-0" />
                </div>

                {ga.imageUrl && (
                  <img
                    src={ga.imageUrl}
                    alt={ga.title}
                    className="w-full h-36 object-cover rounded-2xl border border-[var(--border)]"
                  />
                )}

                <div className="space-y-2 text-xs sm:text-sm">
                  <div>
                    <span className="text-[var(--muted)]">🎁 Phần thưởng: </span>
                    <span className="text-[var(--text)] font-bold">
                      <EditableText
                        value={ga.prize}
                        editMode={canEditGa}
                        onSave={(val) => {
                          const next = giveaways.map((g) =>
                            g.id === ga.id ? { ...g, prize: val } : g
                          );
                          syncGiveaways(next, 'Đổi phần thưởng Giveaway');
                        }}
                      />
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted)]">🌸 Điều kiện: </span>
                    <span className="text-[var(--text)]/90">
                      <EditableText
                        value={ga.condition}
                        editMode={canEditGa}
                        onSave={(val) => {
                          const next = giveaways.map((g) =>
                            g.id === ga.id ? { ...g, condition: val } : g
                          );
                          syncGiveaways(next, 'Đổi điều kiện Giveaway');
                        }}
                      />
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Users className="w-3.5 h-3.5" />
                      Người đã ghi danh ({ga.participants.length})
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text)]/85 leading-relaxed">
                    {ga.participants.join(' · ')}
                  </div>
                </div>

                {(isDrawing || recentWinner) && (
                  <div className="p-4 rounded-2xl border-2 border-[var(--accent)] bg-[var(--bg)] text-center space-y-1.5 accent-glow-strong">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
                      <span>
                        {isDrawing
                          ? 'Đang xáo thăm may mắn...'
                          : '🎉 Chúc mừng bạn nhỏ may mắn'}
                      </span>
                    </div>
                    <div className="font-serif-title text-2xl sm:text-3xl font-bold text-[var(--text)]">
                      {isDrawing ? shuffleName : recentWinner}
                    </div>
                  </div>
                )}

                {ga.winnerHistory.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                    <div className="text-xs font-semibold text-[var(--muted)]">
                      Lịch sử người thắng các đợt quay:
                    </div>
                    {ga.winnerHistory.map((w, i) => (
                      <div
                        key={`${w.winnerName}-${i}`}
                        className="text-xs flex items-center justify-between text-[var(--text)]/90"
                      >
                        <span className="font-bold">✨ {w.winnerName}</span>
                        <span className="text-[var(--muted)] tabular-nums">
                          {w.drawnAt}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  value={joinNameMap[ga.id] || ''}
                  onChange={(e) =>
                    setJoinNameMap((prev) => ({
                      ...prev,
                      [ga.id]: e.target.value,
                    }))
                  }
                  placeholder={
                    currentUser.role === 'guest'
                      ? 'Đăng nhập để tham gia...'
                      : `Ghi danh (${currentUser.displayName})...`
                  }
                  className="flex-1 px-3.5 py-2 rounded-full text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                />
                <button
                  type="button"
                  onClick={() => handleJoinGiveaway(ga.id)}
                  className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer whitespace-nowrap"
                >
                  🎁 Tham gia
                </button>
                {canCreatorDraw && (
                  <button
                    type="button"
                    disabled={isDrawing}
                    onClick={() => handleDrawWinner(ga.id)}
                    className="px-4 py-2 rounded-full text-xs font-bold border border-[var(--accent)] text-[var(--text)] hover:bg-[var(--accent)] hover:text-[#3a2b30] transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bốc thăm</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

interface RankingTabProps {
  characters: CharacterItem[];
  creators: Creator[];
  favoriteIds: string[];
  onOpenCreatorProfile: (creatorId: string) => void;
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string, fallback: string) => void;
}

export const RankingTab: React.FC<RankingTabProps> = ({
  characters,
  creators,
  favoriteIds,
  onOpenCreatorProfile,
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
}) => {
  const [metric, setMetric] = useState<'favorites' | 'hearts' | 'chatOpens'>(
    'hearts'
  );
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'alltime'>(
    'alltime'
  );
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const [dailyVotes, setDailyVotes] = useState<Record<string, number>>({});
  const [votedTodayIds, setVotedTodayIds] = useState<string[]>([]);

  const isEditor = editMode && can('edit', currentUser);

  const creatorMap = useMemo(() => {
    const map: Record<string, Creator> = {};
    creators.forEach((c) => (map[c.id] = c));
    return map;
  }, [creators]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [characters]);

  const rankedCharacters = useMemo(() => {
    const filtered =
      selectedTag === 'all'
        ? characters
        : characters.filter((c) => c.tags.includes(selectedTag));

    return [...filtered]
      .map((c) => {
        const baseStats = c.stats || {
          favorites: 90,
          hearts: 180,
          chatOpens: 450,
          weeklyScore: 60,
          monthlyScore: 200,
        };
        const extraVotes = dailyVotes[c.id] || 0;
        const isFav = favoriteIds.includes(c.id) ? 1 : 0;

        let score = 0;
        if (metric === 'favorites') {
          score = baseStats.favorites + isFav + extraVotes;
        } else if (metric === 'hearts') {
          score = baseStats.hearts + extraVotes * 2 + isFav;
        } else {
          score = baseStats.chatOpens + extraVotes * 3;
        }

        if (timeframe === 'weekly') {
          score = Math.round(score * 0.28) + extraVotes * 2;
        } else if (timeframe === 'monthly') {
          score = Math.round(score * 0.62) + extraVotes * 2;
        }

        return { char: c, score, extraVotes };
      })
      .sort((a, b) => b.score - a.score);
  }, [characters, selectedTag, metric, timeframe, dailyVotes, favoriteIds]);

  const handleVoteToday = (charId: string) => {
    if (!can('vote_ranking', currentUser)) {
      onRequireAuth(
        'Mời bạn đăng nhập để trao phiếu bình chọn hàng ngày cho nhân vật yêu thích nhé 👑'
      );
      return;
    }
    if (votedTodayIds.includes(charId)) return;
    const nextVotes = {
      ...dailyVotes,
      [charId]: (dailyVotes[charId] || 0) + 1,
    };
    const nextVotedToday = [...votedTodayIds, charId];
    setDailyVotes(nextVotes);
    setVotedTodayIds(nextVotedToday);
  };

  const rankTitle =
    customTexts['ranking_tab_title'] ||
    '👑 Bảng Xếp Hạng Nhân Vật Được Yêu Mến';
  const rankDesc =
    customTexts['ranking_tab_desc'] ||
    'Những người bạn AI được ghé thăm và thả tim nhiều nhất. Mỗi ngày bạn có thể trao 1 phiếu bình chọn cho mỗi nhân vật.';

  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={rankTitle}
              editMode={isEditor}
              onSave={(val) =>
                onUpdateCustomText &&
                onUpdateCustomText(
                  'ranking_tab_title',
                  val,
                  '👑 Bảng Xếp Hạng Nhân Vật Được Yêu Mến'
                )
              }
            />
          </h2>
          <div className="text-sm text-[var(--muted)] leading-relaxed">
            <EditableText
              value={rankDesc}
              editMode={isEditor}
              multiline
              onSave={(val) =>
                onUpdateCustomText &&
                onUpdateCustomText('ranking_tab_desc', val, rankDesc)
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'weekly', label: 'Tuần này' },
              { id: 'monthly', label: 'Tháng này' },
              { id: 'alltime', label: 'Mọi thời đại' },
            ] as const
          ).map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTimeframe(tf.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                timeframe === tf.id
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="soft-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)] mr-1">
            Xếp theo:
          </span>
          <button
            type="button"
            onClick={() => setMetric('hearts')}
            className={`px-3.5 py-1.5 rounded-full text-xs border inline-flex items-center gap-1.5 cursor-pointer ${
              metric === 'hearts'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Lượt thả tim</span>
          </button>
          <button
            type="button"
            onClick={() => setMetric('favorites')}
            className={`px-3.5 py-1.5 rounded-full text-xs border inline-flex items-center gap-1.5 cursor-pointer ${
              metric === 'favorites'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Lượt yêu thích</span>
          </button>
          <button
            type="button"
            onClick={() => setMetric('chatOpens')}
            className={`px-3.5 py-1.5 rounded-full text-xs border inline-flex items-center gap-1.5 cursor-pointer ${
              metric === 'chatOpens'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Lượt mở trò chuyện</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">
            Thể loại:
          </span>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3.5 py-1.5 rounded-full text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          >
            <option value="all">Tất cả tag</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {rankedCharacters.map((entry, idx) => {
          const rank = idx + 1;
          const isTop3 = rank <= 3;
          const creator = creatorMap[entry.char.creatorId];
          const hasVotedToday = votedTodayIds.includes(entry.char.id);

          return (
            <article
              key={entry.char.id}
              className={`soft-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isTop3 ? 'border-2 border-[var(--accent)] accent-glow' : ''
              }`}
            >
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-2xl shrink-0 border flex items-center justify-center font-serif-title text-lg font-bold tabular-nums ${
                    isTop3
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]'
                  }`}
                >
                  {String(rank).padStart(2, '0')}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif-title text-xl sm:text-2xl font-bold text-[var(--text)]">
                      {entry.char.name}
                    </h3>
                    {isTop3 && (
                      <span className="sticker-chip text-[11px]">
                        ✨ Top {rank} yêu thích
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span>{entry.char.epithet}</span>
                    {creator && (
                      <>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => onOpenCreatorProfile(creator.id)}
                          className="font-semibold text-[var(--text)] hover:underline cursor-pointer"
                        >
                          {creator.name}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
                <div className="text-right">
                  <div className="text-lg font-serif-title font-bold text-[var(--text)] tabular-nums">
                    {entry.score.toLocaleString('vi-VN')}
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {metric === 'hearts'
                      ? 'lượt tim'
                      : metric === 'favorites'
                      ? 'yêu thích'
                      : 'lượt mở chat'}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={hasVotedToday}
                  onClick={() => handleVoteToday(entry.char.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                    hasVotedToday
                      ? 'border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] cursor-default'
                      : 'bg-[var(--accent)] text-[#3a2b30] cursor-pointer'
                  }`}
                >
                  {hasVotedToday ? '🌸 Đã vote hôm nay' : '✨ +1 Vote hôm nay'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
