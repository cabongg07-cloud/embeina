import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Heart,
  Send,
  Sparkles,
  MessageSquare,
  Check,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  Creator,
  CharacterItem,
  LoveMessage,
  CharacterRequest,
  RequestStatus,
  SAMPLE_LOVE_MESSAGES,
} from '../data/sampleData';
import {
  fetchRequestsFromSupabase,
  insertRequestOnSupabase,
  updateRequestOnSupabase,
  emitGameQuestAction,
} from '../services/supabaseService';
import { AuthUser, can } from '../services/authLayer';
import { EditableText } from './EditableText';

interface LoveCornerTabProps {
  creators: Creator[];
  characters: CharacterItem[];
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
  loveMessages?: LoveMessage[];
  onUpdateLoveMessages?: (next: LoveMessage[], label?: string) => void;
}

export const LoveCornerTab: React.FC<LoveCornerTabProps> = ({
  creators,
  characters,
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
  loveMessages,
  onUpdateLoveMessages,
}) => {
  const canEdit = Boolean(editMode && can('edit', currentUser));
  const [messages, setMessages] = useState<LoveMessage[]>(() =>
    loveMessages && loveMessages.length > 0 ? loveMessages : SAMPLE_LOVE_MESSAGES
  );

  useEffect(() => {
    if (loveMessages && loveMessages.length > 0) {
      setMessages(loveMessages);
    }
  }, [loveMessages]);

  const [displayMode, setDisplayMode] = useState<'all' | 'letter' | 'lantern'>(
    'all'
  );
  const [filterTargetId, setFilterTargetId] = useState<string>('all');

  const [targetValue, setTargetValue] = useState<string>(
    `character:${characters[0]?.id || ''}`
  );
  useEffect(() => {
    if (targetValue === 'character:' && characters[0]?.id) {
      setTargetValue(`character:${characters[0].id}`);
    }
  }, [characters, targetValue]);

  const [senderName, setSenderName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [styleChoice, setStyleChoice] = useState<'letter' | 'lantern'>('lantern');
  const [messageText, setMessageText] = useState('');

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (displayMode !== 'all' && m.style !== displayMode) return false;
      if (filterTargetId !== 'all' && m.targetId !== filterTargetId)
        return false;
      return true;
    });
  }, [messages, displayMode, filterTargetId]);

  const handleSendLove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('send_love_message', currentUser)) {
      onRequireAuth(
        'Mời bạn đăng nhập để gửi lá thư yêu thương hoặc thả đèn lồng tới Chủ web & Nhân vật nhé 💌'
      );
      return;
    }
    if (!messageText.trim()) return;

    const [tType, tId] = targetValue.split(':') as ['creator' | 'character', string];
    const targetName =
      tType === 'creator'
        ? 'Chủ web'
        : characters.find((c) => c.id === tId)?.name || 'Nhân vật';

    const newItem: LoveMessage = {
      id: `love_${Date.now()}`,
      targetType: tType,
      targetId: tId,
      targetName,
      senderName: isAnonymous
        ? 'Một người bạn ẩn danh'
        : senderName.trim() || currentUser.displayName || 'Bạn Nhỏ',
      isAnonymous,
      message: messageText.trim(),
      hearts: 1,
      style: styleChoice,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const next = [newItem, ...messages];
    setMessages(next);
    onUpdateLoveMessages?.(next, 'Thêm lời nhắn Góc yêu thương');
    setMessageText('');
    emitGameQuestAction('love_letter');
  };

  const handleHeartLove = (id: string) => {
    if (!can('heart_love_message', currentUser)) {
      onRequireAuth('Mời bạn đăng nhập để thả tim cho bức thư dễ thương này nhé 🌸');
      return;
    }
    const next = messages.map((m) =>
      m.id === id ? { ...m, hearts: (m.hearts || 0) + 1 } : m
    );
    setMessages(next);
    onUpdateLoveMessages?.(next, 'Thả tim lời nhắn');
  };

  return (
    <div className="space-y-10">
      <div className="border-b border-[var(--border)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
            <EditableText
              value={
                customTexts['love_tab_title'] ||
                '💌 Góc Yêu Thương & Đèn Lồng Pastel'
              }
              onSave={(val) => onUpdateCustomText?.('love_tab_title', val)}
              editMode={canEdit}
            />
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            <EditableText
              value={
                customTexts['love_tab_desc'] ||
                'Những bức thư tay xinh xắn và những chiếc đèn lồng thả trôi gửi trao lời cảm ơn ngọt ngào tới Chủ web cùng các nhân vật AI.'
              }
              onSave={(val) => onUpdateCustomText?.('love_tab_desc', val)}
              editMode={canEdit}
              multiline
            />
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: '✨ Tất cả' },
              { id: 'lantern', label: '🏮 Đèn lồng trôi' },
              { id: 'letter', label: '💌 Tường thư nhỏ' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setDisplayMode(mode.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                displayMode === mode.id
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleSendLove}
          className="lg:col-span-4 soft-card p-6 space-y-4 h-fit"
        >
          <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
            🌸 Gửi một lời nhắn mới
          </h3>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--muted)]">
              Gửi đến Chủ web hoặc Nhân vật
            </label>
            <select
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            >
              <optgroup label="Nhân vật AI">
                {characters.map((ch) => (
                  <option key={ch.id} value={`character:${ch.id}`}>
                    Char: {ch.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Chủ web">
                <option value={`creator:${creators[0]?.id || 'owner'}`}>
                  Chủ web
                </option>
              </optgroup>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--muted)]">
                Người gửi
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                <span>Gửi ẩn danh</span>
              </label>
            </div>
            {!isAnonymous && (
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder={currentUser.displayName || 'Tên của bạn...'}
                className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--muted)]">
              Hình thức hiển thị
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStyleChoice('lantern')}
                className={`py-2 rounded-full text-xs border cursor-pointer ${
                  styleChoice === 'lantern'
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                🏮 Đèn lồng trôi
              </button>
              <button
                type="button"
                onClick={() => setStyleChoice('letter')}
                className={`py-2 rounded-full text-xs border cursor-pointer ${
                  styleChoice === 'letter'
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                💌 Lá thư nhỏ
              </button>
            </div>
          </div>

          <textarea
            rows={4}
            required
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Viết đôi dòng tâm sự hoặc lời cảm ơn dịu dàng..."
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none leading-relaxed"
          />

          <button
            type="submit"
            className="w-full py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gửi lời yêu thương</span>
          </button>
        </form>

        <div className="lg:col-span-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <span className="text-xs text-[var(--muted)]">
              Lọc theo người nhận:
            </span>
            <select
              value={filterTargetId}
              onChange={(e) => setFilterTargetId(e.target.value)}
              className="px-3.5 py-1.5 rounded-full text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            >
              <option value="all">Tất cả Chủ web & Nhân vật</option>
              {characters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  Char: {ch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMessages.map((item) => {
              const isLantern = item.style === 'lantern';
              return (
                <article
                  key={item.id}
                  className={`soft-card p-6 flex flex-col justify-between gap-4 ${
                    isLantern ? 'lantern-float border-[var(--accent)]' : ''
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--muted)] border-b border-[var(--border)] pb-2.5">
                      <span>
                        Gửi tới:{' '}
                        <strong className="text-[var(--text)]">
                          {item.targetName}
                        </strong>
                      </span>
                      <span className="sticker-chip text-[11px]">
                        {isLantern ? '🏮 Đèn lồng' : '💌 Thư tay'}
                      </span>
                    </div>

                    <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
                      “{item.message}”
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs text-[var(--muted)]">
                    <span>
                      — {item.isAnonymous ? 'Ẩn danh' : item.senderName}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleHeartLove(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)] font-bold cursor-pointer tabular-nums"
                    >
                      <Heart className="w-3.5 h-3.5" fill="var(--accent)" />
                      <span>{item.hearts}</span>
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

interface RequestTabProps {
  creators: Creator[];
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
}

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Đang chờ',
  answered: 'Đã trả lời',
  declined: 'Từ chối nhẹ nhàng',
};

export const RequestTab: React.FC<RequestTabProps> = ({
  creators,
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
}) => {
  const canEdit = Boolean(editMode && can('edit', currentUser));
  const [requests, setRequests] = useState<CharacterRequest[]>([]);
  const [creatorId, setCreatorId] = useState(creators[0]?.id || '');
  const [requesterName, setRequesterName] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqTags, setReqTags] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const reloadRequests = useCallback(async () => {
    const list = await fetchRequestsFromSupabase();
    setRequests(list);
  }, []);

  useEffect(() => {
    reloadRequests();
  }, [reloadRequests]);

  useEffect(() => {
    if (!creatorId && creators[0]?.id) {
      setCreatorId(creators[0].id);
    }
  }, [creators, creatorId]);

  const canManageInbox = can('manage_requests_inbox', currentUser);

  const creatorMap = useMemo(() => {
    const map: Record<string, Creator> = {};
    creators.forEach((c) => (map[c.id] = c));
    return map;
  }, [creators]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('create_request', currentUser)) {
      onRequireAuth(
        'Mời bạn đăng nhập để gửi ý tưởng Request cho Chủ web nhé 📮'
      );
      return;
    }
    if (!reqTitle.trim() || !reqDesc.trim()) return;

    const tags = reqTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await insertRequestOnSupabase({
      creatorId,
      requesterName:
        requesterName.trim() || currentUser.displayName || 'Bạn Nhỏ',
      title: reqTitle.trim(),
      description: reqDesc.trim(),
      tags: tags.length > 0 ? tags : ['Ý tưởng mới'],
      status: 'pending',
    });

    if (res.ok) {
      await reloadRequests();
      setReqTitle('');
      setReqDesc('');
      setReqTags('');
    }
  };

  const handleAddReply = async (reqId: string) => {
    if (!can('reply_request', currentUser)) {
      onRequireAuth('Mời bạn đăng nhập để nhắn phản hồi trong hộp thư Request nhé 💬');
      return;
    }
    const text = (replyDrafts[reqId] || '').trim();
    if (!text) return;

    const item = requests.find((r) => r.id === reqId);
    if (!item) return;

    const creatorName = currentUser.displayName || 'Chủ web';
    const isCreator = canManageInbox;
    const newReply = {
      id: `rep_${Date.now()}`,
      authorRole: (isCreator ? 'creator' : 'user') as 'creator' | 'user',
      authorName: isCreator
        ? creatorName
        : currentUser.displayName || item.requesterName,
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextStatus: RequestStatus =
      isCreator && item.status === 'pending' ? 'answered' : item.status;

    const ok = await updateRequestOnSupabase({
      ...item,
      replies: [...item.replies, newReply],
      status: nextStatus,
    });

    if (ok) {
      await reloadRequests();
      setReplyDrafts((prev) => ({ ...prev, [reqId]: '' }));
    }
  };

  const handleChangeStatus = async (reqId: string, nextStatus: RequestStatus) => {
    if (!canManageInbox) return;
    const item = requests.find((r) => r.id === reqId);
    if (!item) return;
    const ok = await updateRequestOnSupabase({
      ...item,
      status: nextStatus,
    });
    if (ok) {
      await reloadRequests();
    }
  };

  return (
    <div className="space-y-10">
      <div className="border-b border-[var(--border)] pb-6">
        <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
          <EditableText
            value={
              customTexts['request_tab_title'] ||
              '📮 Hộp Thư Request Ý Tưởng Nhân Vật'
            }
            onSave={(val) => onUpdateCustomText?.('request_tab_title', val)}
            editMode={canEdit}
          />
        </h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed mt-1.5 max-w-2xl">
          <EditableText
            value={
              customTexts['request_tab_desc'] ||
              'Gửi những mong ước về một nhân vật bạn hằng mong đợi. Chủ web có thể trả lời trực tiếp ngay dưới mỗi bức thư.'
            }
            onSave={(val) => onUpdateCustomText?.('request_tab_desc', val)}
            editMode={canEdit}
            multiline
          />
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleSubmitRequest}
          className="lg:col-span-4 soft-card p-6 space-y-4 h-fit"
        >
          <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
            ✨ Gửi Request cho Chủ web
          </h3>

          <input
            type="text"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            placeholder={currentUser.displayName || 'Tên của bạn...'}
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />

          <input
            type="text"
            required
            value={reqTitle}
            onChange={(e) => setReqTitle(e.target.value)}
            placeholder="Tiêu đề ý tưởng nhân vật *"
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />

          <input
            type="text"
            value={reqTags}
            onChange={(e) => setReqTags(e.target.value)}
            placeholder="Tag thể loại (VD: Đô thị, Chữa lành)"
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />

          <textarea
            rows={4}
            required
            value={reqDesc}
            onChange={(e) => setReqDesc(e.target.value)}
            placeholder="Mô tả chi tiết hình tượng, hoàn cảnh gặp gỡ hoặc nét tính cách bạn mong mỏi..."
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none leading-relaxed"
          />

          <button
            type="submit"
            className="w-full py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi vào Hộp thư Request</span>
          </button>
        </form>

        <div className="lg:col-span-8 space-y-5">
          {requests.map((req) => {
            const creator = creatorMap[req.creatorId];
            return (
              <article
                key={req.id}
                className="soft-card p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <h4 className="font-serif-title text-xl sm:text-2xl font-bold text-[var(--text)]">
                      {req.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)] mt-1">
                      <span>Người gửi: {req.requesterName}</span>
                      {req.tags.map((t) => (
                        <span key={t} className="sticker-chip text-[11px]">
                          ✨ {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <span className="sticker-chip text-xs inline-flex items-center gap-1">
                    {req.status === 'pending' && <Clock className="w-3 h-3" />}
                    {req.status === 'answered' && <Check className="w-3 h-3" />}
                    {req.status === 'declined' && (
                      <XCircle className="w-3 h-3 text-[var(--muted)]" />
                    )}
                    {REQUEST_STATUS_LABELS[req.status]}
                  </span>
                </div>

                <p className="text-sm text-[var(--text)]/90 leading-relaxed">
                  {req.description}
                </p>

                {canManageInbox && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      Quyền Chủ web:
                    </span>
                    {(
                      ['pending', 'answered', 'declined'] as RequestStatus[]
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleChangeStatus(req.id, st)}
                        className={`px-3 py-1 rounded-full text-[11px] border cursor-pointer ${
                          req.status === st
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                            : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {REQUEST_STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  {req.replies.length > 0 && (
                    <div className="space-y-2.5">
                      {req.replies.map((rep) => (
                        <div
                          key={rep.id}
                          className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                            rep.authorRole === 'creator'
                              ? 'border-[var(--accent)] bg-[var(--accent)]/15'
                              : 'border-[var(--border)] bg-[var(--bg)]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text)]">
                            <span>
                              {rep.authorName}{' '}
                              {rep.authorRole === 'creator'
                                ? '✨ (Chủ web)'
                                : '🌸 (Người gửi)'}
                            </span>
                          </div>
                          <p className="text-[var(--text)]/90 leading-relaxed">
                            {rep.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyDrafts[req.id] || ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [req.id]: e.target.value,
                        }))
                      }
                      placeholder={
                        canManageInbox
                          ? 'Viết câu trả lời của Chủ web cho request này...'
                          : 'Nhắn thêm vào cuộc trò chuyện nhỏ...'
                      }
                      className="flex-1 px-4 py-2 rounded-full text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddReply(req.id)}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Phản hồi</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};
