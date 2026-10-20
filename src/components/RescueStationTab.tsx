import React, { useState, useMemo, useEffect } from 'react';
import {
  LifeBuoy,
  Archive,
  HelpCircle,
  Search,
  Send,
  Copy,
  Check,
  Plus,
  Image as ImageIcon,
} from 'lucide-react';
import {
  RescueReport,
  RescueStatus,
  BackupEntry,
  FaqItem,
  INITIAL_FAQS,
  SAMPLE_RESCUE_REPORTS,
  SAMPLE_BACKUPS,
} from '../data/sampleData';
import { AuthUser, can } from '../services/authLayer';
import { EditableText, ItemEditControls } from './EditableText';

interface RescueStationTabProps {
  currentUser: AuthUser;
  onRequireAuth: (reason: string) => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string, fallback: string) => void;
  rescueFaqs?: FaqItem[];
  onUpdateFaqs?: (next: FaqItem[], label?: string) => void;
  rescueTickets?: RescueReport[];
  onUpdateRescueTickets?: (next: RescueReport[], label?: string) => void;
}

const RESCUE_STATUS_LABELS: Record<RescueStatus, string> = {
  received: 'Đã nhận',
  processing: 'Đang xử lý',
  resolved: 'Đã giải quyết',
};

export const RescueStationTab: React.FC<RescueStationTabProps> = ({
  currentUser,
  onRequireAuth,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
  rescueFaqs: propFaqs,
  onUpdateFaqs,
  rescueTickets: propTickets,
  onUpdateRescueTickets,
}) => {
  const [reports, setReports] = useState<RescueReport[]>(() =>
    propTickets && propTickets.length > 0 ? propTickets : SAMPLE_RESCUE_REPORTS
  );
  const [backups, setBackups] = useState<BackupEntry[]>(() => SAMPLE_BACKUPS);
  const [faqs, setFaqs] = useState<FaqItem[]>(() =>
    propFaqs && propFaqs.length > 0 ? propFaqs : INITIAL_FAQS
  );

  useEffect(() => {
    if (propTickets && propTickets.length > 0) {
      setReports(propTickets);
    }
  }, [propTickets]);

  useEffect(() => {
    if (propFaqs && propFaqs.length > 0) {
      setFaqs(propFaqs);
    }
  }, [propFaqs]);

  const syncFaqs = (next: FaqItem[], label = 'Cập nhật câu hỏi FAQ') => {
    setFaqs(next);
    onUpdateFaqs?.(next, label);
  };

  const syncReports = (
    next: RescueReport[],
    label = 'Cập nhật tín hiệu cứu hộ'
  ) => {
    setReports(next);
    onUpdateRescueTickets?.(next, label);
  };

  const [charName, setCharName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [brokenUrl, setBrokenUrl] = useState('');
  const [issueDesc, setIssueDesc] = useState('');

  const [bakCharName, setBakCharName] = useState('');
  const [bakCreatorName, setBakCreatorName] = useState('');
  const [bakLink, setBakLink] = useState('');
  const [bakDesc, setBakDesc] = useState('');
  const [bakPrompt, setBakPrompt] = useState('');
  const [searchBackup, setSearchBackup] = useState('');
  const [copiedBackupId, setCopiedBackupId] = useState<string | null>(null);

  // State cho Thêm / Sửa FAQ (có ô dán link ảnh)
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');
  const [faqImageUrl, setFaqImageUrl] = useState('');

  const canManageRescueStatus = can('manage_rescue_status', currentUser);
  const isEditor = editMode && can('edit', currentUser);

  const filteredBackups = useMemo(() => {
    const q = searchBackup.trim().toLowerCase();
    if (!q) return backups;
    return backups.filter(
      (b) =>
        b.characterName.toLowerCase().includes(q) ||
        b.creatorName.toLowerCase().includes(q) ||
        b.descriptionBackup.toLowerCase().includes(q)
    );
  }, [backups, searchBackup]);

  const handleAddFaqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQ.trim() || !faqA.trim()) return;
    const added: FaqItem = {
      id: `faq_${Date.now()}`,
      q: faqQ.trim(),
      a: faqA.trim(),
      imageUrl: faqImageUrl.trim() || undefined,
    };
    syncFaqs([...faqs, added], 'Thêm câu hỏi FAQ mới');
    setFaqQ('');
    setFaqA('');
    setFaqImageUrl('');
    setShowAddFaq(false);
  };

  const openEditFaqForm = (item: FaqItem) => {
    setEditingFaqId(item.id);
    setFaqQ(item.q);
    setFaqA(item.a);
    setFaqImageUrl(item.imageUrl || '');
  };

  const handleSaveEditFaq = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const next = faqs.map((f) =>
      f.id === id
        ? {
            ...f,
            q: faqQ.trim(),
            a: faqA.trim(),
            imageUrl: faqImageUrl.trim() || undefined,
          }
        : f
    );
    syncFaqs(next, 'Sửa câu hỏi FAQ');
    setEditingFaqId(null);
  };

  const handleDeleteFaq = (id: string) => {
    const next = faqs.filter((f) => f.id !== id);
    syncFaqs(next, 'Xóa câu hỏi FAQ');
  };

  const handleMoveFaq = (id: string, direction: 'up' | 'down') => {
    const idx = faqs.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= faqs.length) return;
    const next = [...faqs];
    const [item] = next.splice(idx, 1);
    next.splice(targetIdx, 0, item);
    syncFaqs(next, 'Đổi thứ tự câu hỏi FAQ');
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('submit_rescue_report', currentUser)) {
      onRequireAuth(
        'Mời bạn đăng nhập để gửi báo cáo link hỏng hoặc nhờ tìm lại char cũ nhé 🛟'
      );
      return;
    }
    if (!charName.trim() || !issueDesc.trim()) return;

    const added: RescueReport = {
      id: `res_${Date.now()}`,
      characterName: charName.trim(),
      creatorName: creatorName.trim() || 'Chưa rõ tên Creator',
      brokenUrl: brokenUrl.trim() || undefined,
      issueDescription: issueDesc.trim(),
      status: 'received',
      createdAt: new Date().toISOString(),
    };

    syncReports([added, ...reports], 'Gửi tín hiệu cứu hộ');
    setCharName('');
    setCreatorName('');
    setBrokenUrl('');
    setIssueDesc('');
  };

  const handleChangeReportStatus = (id: string, nextStatus: RescueStatus) => {
    if (!canManageRescueStatus) return;
    const next = reports.map((r) =>
      r.id === id ? { ...r, status: nextStatus } : r
    );
    syncReports(next, 'Đổi trạng thái tín hiệu cứu hộ');
  };

  const handleAddBackup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('save_backup_entry', currentUser)) {
      onRequireAuth(
        'Mời bạn đăng nhập để cất giữ bản sao dự phòng vào sổ tay nhé 🛟'
      );
      return;
    }
    if (!bakCharName.trim() || !bakDesc.trim()) return;

    const added: BackupEntry = {
      id: `bak_${Date.now()}`,
      characterName: bakCharName.trim(),
      creatorName: bakCreatorName.trim() || currentUser.displayName,
      backupLink: bakLink.trim() || 'Chưa đính kèm link',
      descriptionBackup: bakDesc.trim(),
      promptBackup: bakPrompt.trim() || 'Chưa có lời mở đầu dự phòng',
      savedAt: new Date().toLocaleDateString('vi-VN'),
    };

    setBackups((prev) => [added, ...prev]);
    setBakCharName('');
    setBakCreatorName('');
    setBakLink('');
    setBakDesc('');
    setBakPrompt('');
  };

  const handleCopyBackup = async (bak: BackupEntry) => {
    const fullText = `Nhân vật: ${bak.characterName}\nCreator: ${bak.creatorName}\nLink: ${bak.backupLink}\nMô tả: ${bak.descriptionBackup}\nLời mở đầu / Lệnh: ${bak.promptBackup}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
      }
      setCopiedBackupId(bak.id);
      setTimeout(() => setCopiedBackupId(null), 1800);
    } catch {
      setCopiedBackupId(bak.id);
      setTimeout(() => setCopiedBackupId(null), 1800);
    }
  };

  const rescueTitle =
    customTexts['rescue_tab_title'] || '🛟 Trạm Cứu Hộ & Lưu Trữ Dự Phòng';
  const rescueDesc =
    customTexts['rescue_tab_desc'] ||
    'Nơi giúp bạn báo cáo liên kết hỏng, tìm lại một người bạn AI cũ hoặc cất giữ bản sao mô tả và lời chào dự phòng.';

  return (
    <div className="space-y-12">
      <div className="border-b border-[var(--border)] pb-6">
        <h2 className="font-serif-title text-2xl sm:text-4xl font-bold text-[var(--text)]">
          <EditableText
            value={rescueTitle}
            editMode={isEditor}
            onSave={(val) =>
              onUpdateCustomText &&
              onUpdateCustomText(
                'rescue_tab_title',
                val,
                '🛟 Trạm Cứu Hộ & Lưu Trữ Dự Phòng'
              )
            }
          />
        </h2>
        <div className="text-sm text-[var(--muted)] leading-relaxed mt-1.5 max-w-2xl">
          <EditableText
            value={rescueDesc}
            editMode={isEditor}
            multiline
            onSave={(val) =>
              onUpdateCustomText &&
              onUpdateCustomText('rescue_tab_desc', val, rescueDesc)
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleSubmitReport}
          className="lg:col-span-5 soft-card p-6 space-y-4 h-fit"
        >
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
              1. Báo link chết / Tìm lại char cũ
            </h3>
          </div>

          <input
            type="text"
            required
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            placeholder="Tên nhân vật cần tìm hoặc bị lỗi link *"
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />

          <input
            type="text"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            placeholder="Tên Creator (nếu bạn còn nhớ)..."
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />

          <input
            type="text"
            value={brokenUrl}
            onChange={(e) => setBrokenUrl(e.target.value)}
            placeholder="Đường dẫn cũ bị hỏng (tùy chọn)..."
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />

          <textarea
            rows={3}
            required
            value={issueDesc}
            onChange={(e) => setIssueDesc(e.target.value)}
            placeholder="Mô tả tình trạng lỗi hoặc những chi tiết cốt truyện để mọi người tìm giúp..."
            className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none"
          />

          <button
            type="submit"
            className="w-full py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi tín hiệu cứu hộ</span>
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-3">
            <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
              Bảng theo dõi tín hiệu cứu hộ ({reports.length})
            </h3>
            <span className="text-xs text-[var(--muted)]">
              Đã nhận → Đang xử lý → Đã giải quyết
            </span>
          </div>

          <div className="space-y-4">
            {reports.map((rep) => (
              <article key={rep.id} className="soft-card p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
                  <div>
                    <h4 className="font-serif-title text-xl font-bold text-[var(--text)]">
                      {rep.characterName}
                    </h4>
                    <span className="text-xs text-[var(--muted)]">
                      Creator: {rep.creatorName}
                    </span>
                  </div>

                  <span className="sticker-chip text-xs">
                    {RESCUE_STATUS_LABELS[rep.status]}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text)]/90 leading-relaxed">
                  {rep.issueDescription}
                </p>

                {rep.resolutionNote && (
                  <p className="text-xs text-[var(--muted)] italic">
                    💡 Ghi chú xử lý: {rep.resolutionNote}
                  </p>
                )}

                {canManageRescueStatus && (
                  <div className="flex items-center gap-2 pt-2">
                    {(
                      ['received', 'processing', 'resolved'] as RescueStatus[]
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleChangeReportStatus(rep.id, st)}
                        className={`px-3 py-1 rounded-full text-[11px] border cursor-pointer ${
                          rep.status === st
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[#3a2b30] font-bold'
                            : 'border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >
                        {RESCUE_STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>

      <section className="pt-6 border-t border-[var(--border)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="font-serif-title text-2xl sm:text-3xl font-bold text-[var(--text)]">
                2. Góc Lưu Giữ Dự Phòng (Bản Sao Mô Tả / Lệnh / Link)
              </h3>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Cất giữ bản sao thiết lập nhân vật yêu thích để phòng khi nền tảng bên ngoài gặp sự cố.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchBackup}
              onChange={(e) => setSearchBackup(e.target.value)}
              placeholder="Tìm trong kho dự phòng..."
              className="w-full pl-9 pr-3.5 py-2 rounded-full text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleAddBackup}
            className="lg:col-span-4 soft-card p-5 space-y-3 h-fit"
          >
            <h4 className="font-serif-title text-xl font-bold text-[var(--text)]">
              ✨ Cất bản sao dự phòng mới
            </h4>
            <input
              type="text"
              required
              value={bakCharName}
              onChange={(e) => setBakCharName(e.target.value)}
              placeholder="Tên nhân vật & phiên bản *"
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="text"
              value={bakCreatorName}
              onChange={(e) => setBakCreatorName(e.target.value)}
              placeholder="Tên Creator..."
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="text"
              value={bakLink}
              onChange={(e) => setBakLink(e.target.value)}
              placeholder="Link dự phòng..."
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <textarea
              rows={3}
              required
              value={bakDesc}
              onChange={(e) => setBakDesc(e.target.value)}
              placeholder="Bản sao mô tả cốt lõi *"
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none"
            />
            <textarea
              rows={3}
              value={bakPrompt}
              onChange={(e) => setBakPrompt(e.target.value)}
              placeholder="Bản sao lời chào mở đầu / lệnh..."
              className="w-full px-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
            >
              Cất vào Tủ Dự Phòng
            </button>
          </form>

          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBackups.map((bak) => {
              const isCopied = copiedBackupId === bak.id;
              return (
                <article
                  key={bak.id}
                  className="soft-card p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2">
                      <div>
                        <h4 className="font-serif-title text-xl font-bold text-[var(--text)]">
                          {bak.characterName}
                        </h4>
                        <span className="text-xs text-[var(--muted)]">
                          {bak.creatorName} · Lưu ngày {bak.savedAt}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text)]/90 leading-relaxed">
                      {bak.descriptionBackup}
                    </p>
                    <p className="text-xs italic text-[var(--muted)]">
                      {bak.promptBackup}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <span className="text-[11px] text-[var(--muted)] truncate max-w-[180px]">
                      {bak.backupLink}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyBackup(bak)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer shrink-0"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Chép bản sao</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. FAQ có hỗ trợ ➕ Thêm, ✏️ Sửa, 🗑️ Xóa, ↕️ Sắp xếp & Sửa trực tiếp văn bản */}
      <section className="pt-6 border-t border-[var(--border)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-serif-title text-2xl font-bold text-[var(--text)]">
              3. Giải Đáp Thắc Mắc Thường Gặp (FAQ)
            </h3>
          </div>

          {isEditor && (
            <button
              type="button"
              onClick={() => {
                setEditingFaqId(null);
                setFaqQ('');
                setFaqA('');
                setFaqImageUrl('');
                setShowAddFaq((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddFaq ? 'Đóng form' : '➕ Thêm FAQ'}</span>
            </button>
          )}
        </div>

        {isEditor && showAddFaq && (
          <form
            onSubmit={handleAddFaqSubmit}
            className="soft-card p-5 space-y-3 border-2 border-dashed border-[var(--accent)] text-xs"
          >
            <h4 className="font-serif-title text-lg font-bold text-[var(--text)]">
              ➕ Thêm câu hỏi thường gặp (FAQ)
            </h4>
            <input
              type="text"
              required
              value={faqQ}
              onChange={(e) => setFaqQ(e.target.value)}
              placeholder="Câu hỏi *"
              className="w-full px-3.5 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <textarea
              rows={2}
              required
              value={faqA}
              onChange={(e) => setFaqA(e.target.value)}
              placeholder="Câu trả lời *"
              className="w-full px-3.5 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none"
            />
            <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
              <input
                type="url"
                value={faqImageUrl}
                onChange={(e) => setFaqImageUrl(e.target.value)}
                placeholder="Dán link ảnh minh họa FAQ (tùy chọn, https://...)"
                className="w-full px-3.5 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddFaq(false)}
                className="px-3.5 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer"
              >
                ✨ Thêm FAQ
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {faqs.map((item, idx) => (
            <div
              key={item.id}
              className={`soft-card p-5 space-y-2.5 ${
                isEditor ? 'border-2 border-dashed border-[var(--accent)]' : ''
              }`}
            >
              {isEditor && (
                <div className="pb-2 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[var(--muted)]">
                    FAQ #{idx + 1}
                  </span>
                  <ItemEditControls
                    canEdit={isEditor}
                    onEdit={() => openEditFaqForm(item)}
                    onDelete={() => handleDeleteFaq(item.id)}
                    onMoveUp={() => handleMoveFaq(item.id, 'up')}
                    onMoveDown={() => handleMoveFaq(item.id, 'down')}
                    disableUp={idx === 0}
                    disableDown={idx === faqs.length - 1}
                  />
                </div>
              )}

              {editingFaqId === item.id && isEditor ? (
                <form
                  onSubmit={(e) => handleSaveEditFaq(e, item.id)}
                  className="space-y-2 text-xs"
                >
                  <input
                    type="text"
                    value={faqQ}
                    onChange={(e) => setFaqQ(e.target.value)}
                    placeholder="Câu hỏi"
                    className="w-full px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                  />
                  <textarea
                    rows={3}
                    value={faqA}
                    onChange={(e) => setFaqA(e.target.value)}
                    placeholder="Câu trả lời"
                    className="w-full px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] resize-none"
                  />
                  <input
                    type="url"
                    value={faqImageUrl}
                    onChange={(e) => setFaqImageUrl(e.target.value)}
                    placeholder="Link ảnh minh họa (https://...)"
                    className="w-full px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingFaqId(null)}
                      className="px-3 py-1 rounded-full border border-[var(--border)] text-[var(--muted)] cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer"
                    >
                      Lưu
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.q}
                      className="w-full h-28 object-cover rounded-xl border border-[var(--border)]"
                    />
                  )}
                  <h4 className="font-serif-title text-lg font-bold text-[var(--text)]">
                    🌸{' '}
                    <EditableText
                      value={item.q}
                      editMode={isEditor}
                      onSave={(val) => {
                        const next = faqs.map((f) =>
                          f.id === item.id ? { ...f, q: val } : f
                        );
                        syncFaqs(next, 'Sửa câu hỏi FAQ');
                      }}
                    />
                  </h4>
                  <div className="text-xs text-[var(--text)]/85 leading-relaxed">
                    <EditableText
                      value={item.a}
                      editMode={isEditor}
                      multiline
                      onSave={(val) => {
                        const next = faqs.map((f) =>
                          f.id === item.id ? { ...f, a: val } : f
                        );
                        syncFaqs(next, 'Sửa câu trả lời FAQ');
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
