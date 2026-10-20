import React, { useState, useMemo, useEffect } from 'react';
import {
  Star,
  Heart,
  Send,
  MessageSquare,
  CheckCircle2,
  Eye,
  PenLine,
  Inbox,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import {
  Creator,
  CharacterItem,
  FeedbackItem,
  FeedbackTargetType,
} from '../data/sampleData';
import {
  fetchFeedbacksFromSupabase,
  insertFeedbackOnSupabase,
  updateFeedbackEnvelopeOnSupabase,
} from '../services/supabaseService';
import { AuthUser, can } from '../services/authLayer';
import { EditableText } from './EditableText';

interface FeedbackTabProps {
  creators: Creator[];
  characters: CharacterItem[];
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = ({
  creators,
  characters,
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
}) => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState<boolean>(true);

  const reloadFeedbacks = async () => {
    try {
      const rows = await fetchFeedbacksFromSupabase();
      setFeedbacks(rows);
    } catch {
      // Ignore error
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  useEffect(() => {
    reloadFeedbacks();
  }, []);

  const canWrite = can('write_feedback', currentUser);
  const canManage = can('manage_feedback', currentUser);
  const canEdit = Boolean(editMode && can('edit', currentUser));

  // Chế độ xem: 'public' (Tất cả công khai), 'mine' (Feedback của tôi), 'creator_inbox' (Hộp thư Chủ web)
  const [viewMode, setViewMode] = useState<'public' | 'mine' | 'creator_inbox'>(
    'public'
  );
  const [targetFilter, setTargetFilter] = useState<'all' | 'web' | 'character'>(
    'all'
  );

  // Trạng thái form viết feedback (chỉ gửi cho web hoặc một char)
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [targetType, setTargetType] = useState<'web' | 'character'>('web');
  const [selectedCharId, setSelectedCharId] = useState<string>(
    characters[0]?.id || ''
  );
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [content, setContent] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [submitToast, setSubmitToast] = useState<string | null>(null);

  // Trả lời ngắn của Chủ web
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Lọc danh sách hiển thị theo chế độ xem
  const displayedFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      if (viewMode === 'mine') {
        return fb.authorId === currentUser.id;
      }
      if (viewMode === 'creator_inbox') {
        return true;
      }
      if (targetFilter !== 'all' && fb.targetType !== targetFilter) {
        return false;
      }
      return true;
    });
  }, [feedbacks, viewMode, targetFilter, currentUser]);

  // Đếm số feedback chưa đọc trong hộp thư của Chủ web
  const unreadCreatorCount = useMemo(() => {
    if (!canManage) return 0;
    return feedbacks.filter((fb) => !fb.isRead).length;
  }, [feedbacks, canManage]);

  const handleClickWriteFeedback = () => {
    if (!canWrite) {
      onRequireAuth(
        'Mời bạn đăng nhập để viết Feedback đánh giá sao cho Web hoặc Nhân vật yêu thích nhé ⭐💌'
      );
      return;
    }
    setShowWriteForm((prev) => !prev);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) {
      onRequireAuth(
        'Mời bạn đăng nhập để gửi Feedback đánh giá 5 sao nhé ⭐'
      );
      return;
    }
    if (!content.trim()) return;

    let targetId = 'web';
    let targetName = 'Góc Nhỏ Lấp Lánh (Toàn trang)';
    let creatorId: string | undefined = undefined;

    if (targetType === 'character') {
      const ch =
        characters.find((c) => c.id === selectedCharId) || characters[0];
      targetId = ch?.id || 'character';
      targetName = ch?.name || 'Nhân vật';
      creatorId = ch?.creatorId;
    }

    try {
      await insertFeedbackOnSupabase({
        authorId: currentUser.id,
        authorName: currentUser.displayName || 'Bạn Nhỏ',
        rating: Math.max(1, Math.min(5, rating)),
        content: content.trim(),
        anonymous: isAnonymous,
        targetType,
        targetId,
        targetName,
        creatorId,
      });

      await reloadFeedbacks();
      setContent('');
      setRating(5);
      setIsAnonymous(false);
      setShowWriteForm(false);
      setSubmitToast('✨ Cảm ơn bạn đã gửi Feedback ấm áp lên Supabase!');
      setTimeout(() => setSubmitToast(null), 3500);
    } catch (err) {
      setSubmitToast(
        err instanceof Error
          ? err.message
          : 'Không thể gửi Feedback lúc này, bạn thử lại nhé 🌸'
      );
      setTimeout(() => setSubmitToast(null), 4000);
    }
  };

  const handleHeartFeedback = async (fbId: string) => {
    if (!can('heart_love_message', currentUser)) {
      onRequireAuth('Mời bạn đăng nhập để thả tim cho Feedback này nhé 🌸');
      return;
    }
    const target = feedbacks.find((f) => f.id === fbId);
    if (!target) return;
    const updatedItem: FeedbackItem = {
      ...target,
      hearts: (target.hearts || 0) + 1,
    };
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === fbId ? updatedItem : f))
    );
    try {
      await updateFeedbackEnvelopeOnSupabase(fbId, updatedItem);
    } catch {
      // Ignore if RLS restricts non-owner update
    }
  };

  const handleToggleRead = async (fbId: string) => {
    if (!canManage) return;
    const target = feedbacks.find((f) => f.id === fbId);
    if (!target) return;
    const updatedItem: FeedbackItem = {
      ...target,
      isRead: !target.isRead,
    };
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === fbId ? updatedItem : f))
    );
    try {
      await updateFeedbackEnvelopeOnSupabase(fbId, updatedItem);
    } catch {
      // Ignore error
    }
  };

  const handleCreatorReply = async (fbId: string) => {
    if (!canManage) return;
    const text = (replyDrafts[fbId] || '').trim();
    if (!text) return;
    const target = feedbacks.find((f) => f.id === fbId);
    if (!target) return;

    const newReply = {
      id: `fbrep_${Date.now()}`,
      authorName: currentUser.displayName || 'Chủ web',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const updatedItem: FeedbackItem = {
      ...target,
      replies: [...(target.replies || []), newReply],
      isRead: true,
    };

    setFeedbacks((prev) =>
      prev.map((f) => (f.id === fbId ? updatedItem : f))
    );
    setReplyDrafts((prev) => ({ ...prev, [fbId]: '' }));

    try {
      await updateFeedbackEnvelopeOnSupabase(fbId, updatedItem);
    } catch {
      // Ignore error
    }
  };

  const averageRating = useMemo(() => {
    if (feedbacks.length === 0) return '5.0';
    const sum = feedbacks.reduce((acc, f) => acc + (f.rating || 5), 0);
    return (sum / feedbacks.length).toFixed(1);
  }, [feedbacks]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={
                customTexts['feedback_tab_title'] ||
                '💬 Góc Feedback & Đánh Giá Sao'
              }
              onSave={(val) => onUpdateCustomText?.('feedback_tab_title', val)}
              editMode={canEdit}
            />
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            <EditableText
              value={
                customTexts['feedback_tab_desc'] ||
                'Nơi lắng nghe những cảm nhận, góp ý và đánh giá 1–5 ⭐ dành cho Góc Nhỏ Lấp Lánh và từng nhân vật AI.'
              }
              onSave={(val) => onUpdateCustomText?.('feedback_tab_desc', val)}
              editMode={canEdit}
              multiline
            />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="sticker-chip text-xs inline-flex items-center gap-1.5 font-bold">
            <Star className="w-3.5 h-3.5 text-amber-400" fill="#fbbf24" />
            <span>
              Trung bình {averageRating} / 5.0 ({feedbacks.length} đánh giá)
            </span>
          </div>

          <button
            type="button"
            onClick={handleClickWriteFeedback}
            className="px-4 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>✍️ Viết Feedback</span>
          </button>
        </div>
      </div>

      {submitToast && (
        <div className="p-3.5 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] text-xs font-bold text-[var(--text)] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          <span>{submitToast}</span>
        </div>
      )}

      {/* FORM VIẾT FEEDBACK (Dành cho Người dùng đã đăng nhập & Creator) */}
      {showWriteForm && canWrite && (
        <form
          onSubmit={handleSubmitFeedback}
          className="soft-card p-6 border-2 border-[var(--accent)] space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h3 className="font-serif-title text-xl font-bold text-[var(--text)]">
              ⭐ Gửi Feedback mới
            </h3>
            <button
              type="button"
              onClick={() => setShowWriteForm(false)}
              className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chọn đối tượng nhận feedback: chỉ gửi cho Web hoặc một Char */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1.5">
                Bạn muốn gửi Feedback cho:
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                {(
                  [
                    { id: 'web', label: '🌐 Trang web' },
                    { id: 'character', label: '🌸 Nhân vật' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTargetType(opt.id)}
                    className={`py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      targetType === opt.id
                        ? 'bg-[var(--accent)] text-[#3a2b30]'
                        : 'text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn Char cụ thể nếu có */}
            <div>
              {targetType === 'character' && (
                <>
                  <label className="block text-[11px] font-bold text-[var(--muted)] mb-1.5">
                    Chọn Nhân vật (Char) nhận:
                  </label>
                  <select
                    value={selectedCharId}
                    onChange={(e) => setSelectedCharId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
                  >
                    {characters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name} — {ch.epithet}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {targetType === 'web' && (
                <div className="h-full flex items-center text-[var(--muted)] pt-4">
                  <span>
                    💌 Gửi lời góp ý hoặc động viên chung cho toàn bộ Góc Nhỏ Lấp Lánh.
                  </span>
                </div>
              )}
            </div>

            {/* Chọn số sao 1 - 5 ⭐ */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] mb-1.5">
                Đánh giá mức độ hài lòng ({rating} ⭐):
              </label>
              <div className="flex items-center gap-1.5 py-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                      aria-label={`Chấm ${star} sao`}
                    >
                      <Star
                        className="w-6 h-6"
                        stroke={active ? '#f59e0b' : 'var(--muted)'}
                        fill={active ? '#fbbf24' : 'none'}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1.5">
              Nội dung Feedback *
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder="Chia sẻ trải nghiệm, lời khen hoặc góp ý nhẹ nhàng của bạn..."
              className="w-full p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--text)]">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded accent-[var(--accent)]"
              />
              <span>Gửi ẩn danh (Ẩn tên hiển thị của tôi)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowWriteForm(false)}
                className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--muted)] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gửi Feedback</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Thanh chuyển chế độ xem & lọc đối tượng */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('public')}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              viewMode === 'public'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Tất cả Feedback công khai ({feedbacks.length})</span>
          </button>

          {canWrite && (
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                viewMode === 'mine'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                Feedback của tôi (
                {feedbacks.filter((f) => f.authorId === currentUser.id).length})
              </span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => setViewMode('creator_inbox')}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                viewMode === 'creator_inbox'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Hộp thư Chủ web</span>
              {unreadCreatorCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                  {unreadCreatorCount} mới
                </span>
              )}
            </button>
          )}
        </div>

        {viewMode === 'public' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'web', label: '🌐 Web' },
                { id: 'character', label: '🌸 Char' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTargetFilter(f.id)}
                className={`px-3 py-1 rounded-full text-xs border cursor-pointer ${
                  targetFilter === f.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/25 text-[var(--text)] font-bold'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Danh sách các thẻ Feedback */}
      {displayedFeedbacks.length === 0 ? (
        <div className="soft-card py-14 text-center space-y-2">
          <p className="font-serif-title text-lg font-bold text-[var(--text)]">
            Chưa có feedback nào trong mục này 🌸
          </p>
          <p className="text-xs text-[var(--muted)]">
            Hãy là người đầu tiên gửi lời nhắn đánh giá ấm áp nhé!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedFeedbacks.map((fb) => {
            const typeBadge =
              fb.targetType === 'character'
                ? '🌸 Gửi cho Char'
                : '🌐 Gửi cho Web';

            return (
              <article
                key={fb.id}
                className="soft-card p-5 sm:p-6 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="sticker-chip text-[11px] font-bold">
                          {typeBadge}: {fb.targetName}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleToggleRead(fb.id)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer inline-flex items-center gap-1 ${
                              fb.isRead
                                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : 'border-amber-400/60 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                            }`}
                          >
                            {fb.isRead ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Đã đọc</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-2.5 h-2.5" />
                                <span>Đánh dấu đã đọc</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Bởi{' '}
                        <strong className="text-[var(--text)]">
                          {fb.isAnonymous ? 'Ẩn danh' : fb.authorName}
                        </strong>
                      </div>
                    </div>

                    {/* Hiển thị số sao */}
                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      aria-label={`${fb.rating} sao`}
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className="w-4 h-4"
                          stroke={s <= fb.rating ? '#f59e0b' : 'var(--border)'}
                          fill={s <= fb.rating ? '#fbbf24' : 'none'}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-sm text-[var(--text)] leading-relaxed">
                    “{fb.content}”
                  </p>

                  {/* Phản hồi từ Chủ web */}
                  {fb.replies && fb.replies.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {fb.replies.map((rep) => (
                        <div
                          key={rep.id}
                          className="p-3 rounded-2xl bg-[var(--bg)] border-l-3 border-[var(--accent)] text-xs space-y-1"
                        >
                          <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                            <span>💌 Phản hồi từ {rep.authorName.replace(/Creator/g, 'Chủ web')}:</span>
                          </div>
                          <p className="text-[var(--muted)] leading-relaxed">
                            {rep.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[var(--muted)]">
                      {fb.createdAt
                        ? new Date(fb.createdAt).toLocaleDateString('vi-VN')
                        : 'Hôm nay'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleHeartFeedback(fb.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)] font-bold cursor-pointer tabular-nums"
                    >
                      <Heart className="w-3.5 h-3.5" fill="var(--accent)" />
                      <span>{fb.hearts || 0}</span>
                    </button>
                  </div>

                  {/* Ô trả lời ngắn dành cho Creator */}
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={replyDrafts[fb.id] || ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [fb.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreatorReply(fb.id);
                          }
                        }}
                        placeholder="Trả lời ngắn cho feedback này..."
                        className="flex-1 px-3 py-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreatorReply(fb.id)}
                        className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] text-xs font-bold cursor-pointer shrink-0"
                      >
                        Trả lời
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
