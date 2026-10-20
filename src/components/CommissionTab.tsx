import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Clock,
  CheckCircle2,
  Sparkles,
  Plus,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Creator,
  CreatorCommissionInfo,
  CommissionOrder,
  CommissionOrderStatus,
  CommissionTier,
} from '../data/sampleData';
import {
  fetchCommissionsFromSupabase,
  saveCommissionBoardOnSupabase,
  deleteCommissionBoardOnSupabase,
  insertCommissionOrderOnSupabase,
  updateCommissionOrderStatusOnSupabase,
} from '../services/supabaseService';
import { AuthUser, can, canEditItem } from '../services/authLayer';
import { EditableText, ItemEditControls } from './EditableText';

interface CommissionTabProps {
  creators: Creator[];
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string, fallback: string) => void;
}

const STATUS_LABELS: Record<CommissionOrderStatus, string> = {
  pending: 'Chờ nhận',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
};

export const CommissionTab: React.FC<CommissionTabProps> = ({
  creators,
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
}) => {
  const [commInfos, setCommInfos] = useState<CreatorCommissionInfo[]>([]);
  const [orders, setOrders] = useState<CommissionOrder[]>([]);

  const reloadCommissions = useCallback(async () => {
    const data = await fetchCommissionsFromSupabase();
    setCommInfos(data.boards);
    setOrders(data.orders);
  }, []);

  useEffect(() => {
    reloadCommissions();
  }, [reloadCommissions]);

  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(
    creators[0]?.id || ''
  );
  useEffect(() => {
    if (!selectedCreatorId && creators[0]?.id) {
      setSelectedCreatorId(creators[0].id);
    }
  }, [creators, selectedCreatorId]);

  const [requesterName, setRequesterName] = useState('');
  const [characterConcept, setCharacterConcept] = useState('');
  const [budget, setBudget] = useState('');
  const [contact, setContact] = useState('');
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  // State cho Thêm / Sửa bảng giá Commission (có ô dán link ảnh)
  const [showAddBoardForm, setShowAddBoardForm] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [boardCreatorId, setBoardCreatorId] = useState(
    currentUser.id || currentUser.linkedCreatorId || creators[0]?.id || ''
  );
  const [boardWaitTime, setBoardWaitTime] = useState('3 – 5 ngày');
  const [boardNote, setBoardNote] = useState('');
  const [boardImageUrl, setBoardImageUrl] = useState('');
  const [boardTiersText, setBoardTiersText] = useState(
    'Gói Cơ Bản | 120.000đ | Mở đầu + Tính cách cốt lõi\nGói Chi Tiết | 220.000đ | Kèm Lorebook & 3 bối cảnh'
  );

  const canManageCommission = can('manage_commission_board', currentUser);
  const isEditor = editMode && can('edit', currentUser);

  const creatorMap = React.useMemo(() => {
    const map: Record<string, Creator> = {};
    creators.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [creators]);

  const parseTiers = (raw: string): CommissionTier[] => {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      return {
        name: parts[0] || 'Gói Commission',
        price: parts[1] || '150.000đ',
        detail: parts[2] || 'Thiết lập nhân vật theo yêu cầu',
      };
    });
    return parsed.length > 0
      ? parsed
      : [
          {
            name: 'Gói Cơ Bản',
            price: '120.000đ',
            detail: 'Thiết lập nhân vật & lời mở đầu',
          },
        ];
  };

  const openEditBoardForm = (info: CreatorCommissionInfo) => {
    setEditingBoardId(info.id);
    setBoardCreatorId(info.creatorId);
    setBoardWaitTime(info.waitTime);
    setBoardNote(info.note);
    setBoardImageUrl(info.imageUrl || '');
    setBoardTiersText(
      info.tiers.map((t) => `${t.name} | ${t.price} | ${t.detail}`).join('\n')
    );
  };

  const handleSaveEditBoard = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const target = commInfos.find((c) => c.id === id);
    if (!target) return;
    const updated: CreatorCommissionInfo = {
      ...target,
      waitTime: boardWaitTime.trim() || '3 – 5 ngày',
      note: boardNote.trim(),
      imageUrl: boardImageUrl.trim() || undefined,
      tiers: parseTiers(boardTiersText),
    };
    const res = await saveCommissionBoardOnSupabase(updated, false);
    if (res.ok) {
      await reloadCommissions();
      setEditingBoardId(null);
    } else {
      setSubmitNotice(res.message);
    }
  };

  const handleAddBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCreatorId = currentUser.isSiteOwner
      ? boardCreatorId || currentUser.id
      : currentUser.id || currentUser.linkedCreatorId || boardCreatorId;
    const res = await saveCommissionBoardOnSupabase(
      {
        id: '',
        creatorId: targetCreatorId,
        isOpen: true,
        waitTime: boardWaitTime.trim() || '3 – 5 ngày',
        slotsLeft: 3,
        note:
          boardNote.trim() ||
          'Nhận thiết kế nhân vật theo ý tưởng riêng với sự chăm chút tỉ mỉ.',
        imageUrl: boardImageUrl.trim() || undefined,
        tiers: parseTiers(boardTiersText),
      },
      true
    );
    if (res.ok) {
      await reloadCommissions();
      setShowAddBoardForm(false);
    } else {
      setSubmitNotice(res.message);
    }
  };

  const handleDeleteBoard = async (id: string) => {
    const ok = await deleteCommissionBoardOnSupabase(id);
    if (ok) {
      await reloadCommissions();
    }
  };

  const handleMoveBoard = (id: string, direction: 'up' | 'down') => {
    setCommInfos((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
  };

  const handleToggleCreatorOpen = async (infoId: string, creatorId: string) => {
    if (!can('manage_commission_board', currentUser)) {
      onRequireAuth('Chỉ Creator mới có thể mở hoặc đóng bảng Commission.');
      return;
    }
    if (
      !currentUser.isSiteOwner &&
      currentUser.id !== creatorId &&
      currentUser.linkedCreatorId !== creatorId
    ) {
      return;
    }
    const target = commInfos.find((c) => c.id === infoId);
    if (!target) return;
    const res = await saveCommissionBoardOnSupabase(
      { ...target, isOpen: !target.isOpen },
      false
    );
    if (res.ok) {
      await reloadCommissions();
    }
  };

  const handleOrderStatusChange = async (
    orderId: string,
    nextStatus: CommissionOrderStatus
  ) => {
    if (!can('manage_commission_board', currentUser)) return;
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    const ok = await updateCommissionOrderStatusOnSupabase(target, nextStatus);
    if (ok) {
      await reloadCommissions();
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('order_commission', currentUser)) {
      onRequireAuth(
        'Bạn hãy đăng nhập tài khoản để gửi yêu cầu đặt Commission cho Creator nhé 🎀'
      );
      return;
    }
    if (!characterConcept.trim() || !contact.trim()) {
      setSubmitNotice('🌸 Bạn nhớ điền ý tưởng nhân vật và phương thức liên hệ nhé!');
      return;
    }

    const res = await insertCommissionOrderOnSupabase({
      creatorId: selectedCreatorId,
      requesterName:
        requesterName.trim() || currentUser.displayName || 'Bạn Nhỏ',
      characterConcept: characterConcept.trim(),
      budget: budget.trim() || 'Thỏa thuận theo gói',
      contact: contact.trim(),
      status: 'pending',
    });

    if (res.ok) {
      await reloadCommissions();
      setRequesterName('');
      setCharacterConcept('');
      setBudget('');
      setContact('');
      setSubmitNotice(
        '✨ Đã gửi đơn đặt Commission lên Supabase! Bạn có thể theo dõi tiến độ ngay bên dưới nhé.'
      );
      setTimeout(() => setSubmitNotice(null), 4000);
    } else {
      setSubmitNotice(`🌸 ${res.message}`);
    }
  };

  const headerTitle =
    customTexts['commission_title'] || '🎀 Bàn Đặt Commission Nhân Vật';
  const headerDesc =
    customTexts['commission_desc'] ||
    'Gửi gắm ý tưởng riêng của bạn để các Creator chăm chút thành một nhân vật AI hoàn chỉnh.';

  return (
    <div className="space-y-12">
      <div className="border-b border-[var(--border)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={headerTitle}
              editMode={isEditor}
              onSave={(val) =>
                onUpdateCustomText &&
                onUpdateCustomText(
                  'commission_title',
                  val,
                  '🎀 Bàn Đặt Commission Nhân Vật'
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
                onUpdateCustomText('commission_desc', val, headerDesc)
              }
            />
          </div>
        </div>

        {isEditor && (
          <button
            type="button"
            onClick={() => {
              setBoardNote('');
              setBoardImageUrl('');
              setShowAddBoardForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {showAddBoardForm ? 'Đóng form' : '➕ Thêm bảng giá Commission'}
            </span>
          </button>
        )}
      </div>

      {/* Form Thêm Bảng Giá Commission (có ô dán link ảnh) */}
      {isEditor && showAddBoardForm && (
        <form
          onSubmit={handleAddBoardSubmit}
          className="soft-card p-6 space-y-4 border-2 border-dashed border-[var(--accent)]"
        >
          <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
            ➕ Thêm Bảng Giá Commission Mới
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {currentUser.isSiteOwner ? (
              <select
                value={boardCreatorId}
                onChange={(e) => setBoardCreatorId(e.target.value)}
                className="px-4 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              >
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    Creator: {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-4 py-2 text-xs rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] flex items-center">
                Creator của bạn:{' '}
                <strong className="text-[var(--text)] ml-1">
                  {creatorMap[currentUser.linkedCreatorId || '']?.name ||
                    'Lâm Vọng Nguyệt'}
                </strong>
              </div>
            )}
            <input
              type="text"
              value={boardWaitTime}
              onChange={(e) => setBoardWaitTime(e.target.value)}
              placeholder="Thời gian chờ (VD: 3 – 5 ngày)"
              className="px-4 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="url"
              value={boardImageUrl}
              onChange={(e) => setBoardImageUrl(e.target.value)}
              placeholder="Dán link ảnh minh họa bảng giá (https://...)"
              className="px-4 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
          <input
            type="text"
            value={boardNote}
            onChange={(e) => setBoardNote(e.target.value)}
            placeholder="Ghi chú sở trường nhận Commission..."
            className="w-full px-4 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
          <div>
            <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
              Các gói giá (Mỗi dòng: Tên gói | Giá | Chi tiết):
            </label>
            <textarea
              rows={3}
              value={boardTiersText}
              onChange={(e) => setBoardTiersText(e.target.value)}
              className="w-full px-4 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddBoardForm(false)}
              className="px-4 py-2 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
            >
              ✨ Tạo bảng giá
            </button>
          </div>
        </form>
      )}

      {/* Bảng Commission từng Creator */}
      <section className="space-y-5">
        <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
          1. Bảng giá & Trạng thái của từng Creator
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {commInfos.map((info, idx) => {
            const creator = creatorMap[info.creatorId];
            if (!creator) return null;
            const canEditBoard = canEditItem(
              currentUser,
              info.creatorId,
              isEditor
            );
            const canToggleOpen =
              canManageCommission &&
              (currentUser.isSiteOwner ||
                currentUser.linkedCreatorId === info.creatorId);

            return (
              <article
                key={info.id}
                className={`soft-card p-6 flex flex-col justify-between gap-5 ${
                  canEditBoard
                    ? 'border-2 border-dashed border-[var(--accent)]'
                    : ''
                }`}
              >
                <div className="space-y-4">
                  {/* Thanh ✏️ Sửa, 🗑️ Xóa, ↕️ Sắp xếp */}
                  {isEditor && canEditBoard && (
                    <div className="pb-2 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[var(--muted)]">
                        ✏️ Bảng giá của {creator.name}
                      </span>
                      <ItemEditControls
                        canEdit={canEditBoard}
                        onEdit={() => openEditBoardForm(info)}
                        onDelete={() => handleDeleteBoard(info.id)}
                        onMoveUp={() => handleMoveBoard(info.id, 'up')}
                        onMoveDown={() => handleMoveBoard(info.id, 'down')}
                        disableUp={idx === 0}
                        disableDown={idx === commInfos.length - 1}
                      />
                    </div>
                  )}

                  {/* Form sửa bảng giá Commission (có ô dán link ảnh) */}
                  {editingBoardId === info.id && canEditBoard && (
                    <form
                      onSubmit={(e) => handleSaveEditBoard(e, info.id)}
                      className="p-4 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-2.5 text-xs"
                    >
                      <div className="font-bold text-[var(--text)] flex items-center justify-between">
                        <span>✏️ Sửa bảng giá Commission</span>
                        <button
                          type="button"
                          onClick={() => setEditingBoardId(null)}
                          className="text-[var(--muted)] cursor-pointer"
                        >
                          Đóng
                        </button>
                      </div>
                      <input
                        type="text"
                        value={boardWaitTime}
                        onChange={(e) => setBoardWaitTime(e.target.value)}
                        placeholder="Thời gian chờ..."
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                        <input
                          type="url"
                          value={boardImageUrl}
                          onChange={(e) => setBoardImageUrl(e.target.value)}
                          placeholder="Dán link ảnh minh họa bảng giá (https://...)"
                          className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                        />
                      </div>
                      <input
                        type="text"
                        value={boardNote}
                        onChange={(e) => setBoardNote(e.target.value)}
                        placeholder="Ghi chú..."
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                      <textarea
                        rows={3}
                        value={boardTiersText}
                        onChange={(e) => setBoardTiersText(e.target.value)}
                        placeholder="Tên gói | Giá | Chi tiết (mỗi gói 1 dòng)"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingBoardId(null)}
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

                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
                    <div className="flex items-center gap-3.5">
                      {creator.imageUrl ? (
                        <img
                          src={creator.imageUrl}
                          alt={creator.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-[var(--accent)]"
                        />
                      ) : (
                        <div
                          style={{
                            backgroundColor:
                              'color-mix(in srgb, var(--accent) 26%, var(--surface))',
                          }}
                          className="w-11 h-11 rounded-2xl border border-[var(--accent)] flex items-center justify-center font-serif-title text-base font-bold text-[var(--text)]"
                        >
                          {creator.avatarSymbol}
                        </div>
                      )}
                      <div>
                        <h4 className="font-serif-title text-xl font-bold text-[var(--text)]">
                          {creator.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Chờ:{' '}
                            <EditableText
                              value={info.waitTime}
                              editMode={canEditBoard}
                              onSave={async (val) => {
                                await saveCommissionBoardOnSupabase(
                                  { ...info, waitTime: val },
                                  false
                                );
                                await reloadCommissions();
                              }}
                            />
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              info.isOpen
                                ? 'text-[var(--text)] font-bold'
                                : 'text-[var(--muted)]'
                            }
                          >
                            {info.isOpen ? '🌸 Đang mở nhận đơn' : '🌙 Tạm đóng'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canToggleOpen ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleCreatorOpen(info.id, info.creatorId)
                        }
                        className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer whitespace-nowrap"
                      >
                        {info.isOpen ? 'Đóng Commission' : 'Mở Commission'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!info.isOpen}
                        onClick={() => {
                          if (!can('order_commission', currentUser)) {
                            onRequireAuth(
                              'Mời bạn đăng nhập để đặt Commission cùng Creator nhé 🎀'
                            );
                            return;
                          }
                          setSelectedCreatorId(creator.id);
                          document
                            .getElementById('commission-order-form')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
                          info.isOpen
                            ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)] hover:bg-[var(--accent)] hover:text-[#3a2b30] cursor-pointer'
                            : 'border-[var(--border)] text-[var(--muted)]/50 cursor-not-allowed'
                        }`}
                      >
                        {info.isOpen ? 'Chọn đặt đơn' : 'Đang kín lịch'}
                      </button>
                    )}
                  </div>

                  {info.imageUrl && (
                    <img
                      src={info.imageUrl}
                      alt={`Bảng giá ${creator.name}`}
                      className="w-full h-36 object-cover rounded-2xl border border-[var(--border)]"
                    />
                  )}

                  <div className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                    <EditableText
                      value={info.note}
                      editMode={canEditBoard}
                      multiline
                      onSave={async (val) => {
                        await saveCommissionBoardOnSupabase(
                          { ...info, note: val },
                          false
                        );
                        await reloadCommissions();
                      }}
                    />
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {info.tiers.map((tier, tIdx) => (
                      <div
                        key={`${tier.name}-${tIdx}`}
                        className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                      >
                        <div>
                          <div className="text-xs font-bold text-[var(--text)]">
                            <EditableText
                              value={tier.name}
                              editMode={canEditBoard}
                              onSave={async (val) => {
                                const nextTiers = info.tiers.map((t, i) =>
                                  i === tIdx ? { ...t, name: val } : t
                                );
                                await saveCommissionBoardOnSupabase(
                                  { ...info, tiers: nextTiers },
                                  false
                                );
                                await reloadCommissions();
                              }}
                            />
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            <EditableText
                              value={tier.detail}
                              editMode={canEditBoard}
                              onSave={async (val) => {
                                const nextTiers = info.tiers.map((t, i) =>
                                  i === tIdx ? { ...t, detail: val } : t
                                );
                                await saveCommissionBoardOnSupabase(
                                  { ...info, tiers: nextTiers },
                                  false
                                );
                                await reloadCommissions();
                              }}
                            />
                          </div>
                        </div>
                        <span className="sticker-chip text-xs tabular-nums shrink-0">
                          <EditableText
                            value={tier.price}
                            editMode={canEditBoard}
                            onSave={async (val) => {
                              const nextTiers = info.tiers.map((t, i) =>
                                i === tIdx ? { ...t, price: val } : t
                              );
                              await saveCommissionBoardOnSupabase(
                                { ...info, tiers: nextTiers },
                                false
                              );
                              await reloadCommissions();
                            }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Form đặt Commission & Theo dõi trạng thái đơn */}
      <div
        id="commission-order-form"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 border-t border-[var(--border)]"
      >
        <section className="lg:col-span-5 soft-card p-6 space-y-5 h-fit">
          <div className="space-y-1">
            <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
              2. Gửi yêu cầu đặt Commission
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Điền phác thảo nhân vật bạn mong muốn, Creator sẽ liên hệ lại để trao đổi chi tiết nhé!
            </p>
          </div>

          <form onSubmit={handleSubmitOrder} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Chọn Creator nhận ủy thác
              </label>
              <select
                value={selectedCreatorId}
                onChange={(e) => setSelectedCreatorId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.handle})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Tên hoặc biệt danh của bạn
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder={currentUser.displayName || 'Ví dụ: Miên Miên...'}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Yêu cầu chi tiết về nhân vật / bối cảnh *
              </label>
              <textarea
                rows={4}
                required
                value={characterConcept}
                onChange={(e) => setCharacterConcept(e.target.value)}
                placeholder="Mô tả tính cách, mối quan hệ với người chơi, bối cảnh mở đầu..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--muted)]">
                  Ngân sách / Gói dự kiến
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Ví dụ: 220.000đ"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--muted)]">
                  Liên hệ (Discord / FB) *
                </label>
                <input
                  type="text"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Ví dụ: Discord @tenban"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {submitNotice && (
              <p className="text-xs font-semibold text-[var(--text)] bg-[var(--accent)]/20 p-3 rounded-2xl">
                {submitNotice}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi đơn đặt Commission</span>
            </button>
          </form>
        </section>

        {/* Theo dõi trạng thái đơn */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-3">
            <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
              3. Sổ theo dõi tiến độ đơn ({orders.length})
            </h3>
            <span className="text-xs text-[var(--muted)]">
              Chờ nhận → Đang làm → Hoàn thành
            </span>
          </div>

          <div className="space-y-4">
            {orders.map((order) => {
              const creator = creatorMap[order.creatorId];
              return (
                <article key={order.id} className="soft-card p-5 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--text)] font-bold">
                        Khách đặt: {order.requesterName}
                      </span>
                      <span aria-hidden="true" className="text-[var(--muted)]">
                        ·
                      </span>
                      <span className="text-[var(--muted)]">
                        Creator: {creator?.name || 'Góc Nhỏ'}
                      </span>
                    </div>

                    <span className="sticker-chip text-xs inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  <p className="text-sm text-[var(--text)]/90 leading-relaxed">
                    {order.characterConcept}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-[var(--muted)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Ngân sách: {order.budget}</span>
                      <span aria-hidden="true">·</span>
                      <span>Liên hệ: {order.contact}</span>
                    </div>

                    {canManageCommission ? (
                      <div className="flex items-center gap-1.5">
                        {(
                          [
                            'pending',
                            'in_progress',
                            'completed',
                          ] as CommissionOrderStatus[]
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleOrderStatusChange(order.id, st)}
                            className={`px-3 py-1 rounded-full text-[11px] border transition-colors cursor-pointer ${
                              order.status === st
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                            }`}
                          >
                            {STATUS_LABELS[st]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={
                            order.status === 'pending'
                              ? 'text-[var(--text)] font-bold underline underline-offset-4'
                              : 'text-[var(--muted)]'
                          }
                        >
                          1. Chờ nhận
                        </span>
                        <span>→</span>
                        <span
                          className={
                            order.status === 'in_progress'
                              ? 'text-[var(--text)] font-bold underline underline-offset-4'
                              : 'text-[var(--muted)]'
                          }
                        >
                          2. Đang làm
                        </span>
                        <span>→</span>
                        <span
                          className={
                            order.status === 'completed'
                              ? 'text-[var(--text)] font-bold underline underline-offset-4 inline-flex items-center gap-1'
                              : 'text-[var(--muted)]'
                          }
                        >
                          {order.status === 'completed' && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          3. Hoàn thành
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
