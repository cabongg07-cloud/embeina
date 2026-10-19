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
} from 'lucide-react';
import {
  AuthUser,
  can,
  authService,
  StoredSafeAccount,
} from '../services/authLayer';
import { SiteConfig, NavTabConfig } from '../services/siteSettings';
import { ThemeConfig, ColorMode } from '../constants/themes';

interface EditModeSystemProps {
  currentUser: AuthUser;
  editMode: boolean;
  onToggleEditMode: () => void;
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
}

export const EditModeSystem: React.FC<EditModeSystemProps> = ({
  currentUser,
  editMode,
  onToggleEditMode,
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
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [newMp3Url, setNewMp3Url] = useState('');
  const [creatorApps, setCreatorApps] = useState<StoredSafeAccount[]>(() =>
    authService.listCreatorApplications()
  );

  // Kiểm tra quyền nghiêm ngặt bằng can("edit", currentUser).
  // Khách và Người dùng tuyệt đối không thấy nút và không kích hoạt được.
  const canEdit = can('edit', currentUser);
  const canOpenSiteSettings = can('site_settings', currentUser);

  useEffect(() => {
    if (!canOpenSiteSettings && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [canOpenSiteSettings, drawerOpen]);

  useEffect(() => {
    if (drawerOpen) {
      setCreatorApps(authService.listCreatorApplications());
    }
  }, [drawerOpen]);

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
      {/* 1. Nút ✏️ "Chỉnh sửa" cố định ở góc dưới bên trái (Chỉ hiện với vai Creator) */}
      <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2 max-w-[calc(100vw-2rem)]">
        {editMode && (
          <div className="p-3 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--surface)]/95 backdrop-blur-md shadow-xl flex flex-wrap items-center gap-2 text-xs">
            {/* Chuyển nhanh giữa Chủ web & Creator thường để kiểm thử phân quyền */}
            <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg)] p-0.5">
              <button
                type="button"
                onClick={() => {
                  authService.setCreatorOwnerMode(true, 'creator-lam-vong');
                  onNotify(
                    '👑 Đang ở chế độ Chủ web: Có thể mở "Cài đặt trang" và sửa mọi mục.'
                  );
                }}
                title="Chủ web: Sửa toàn trang & mở bảng Cài đặt trang"
                className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer inline-flex items-center gap-1 ${
                  currentUser.isSiteOwner
                    ? 'bg-[var(--accent)] text-[#3a2b30] font-bold'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Crown className="w-3 h-3" />
                <span>Chủ web</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  authService.setCreatorOwnerMode(false, 'creator-lam-vong');
                  onNotify(
                    '🎨 Đang ở chế độ Creator thường (Lâm Vọng Nguyệt): Chỉ sửa nội dung của chính mình.'
                  );
                }}
                title="Creator thường: Chỉ sửa char, lệnh, giveaway, commission của chính mình"
                className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer inline-flex items-center gap-1 ${
                  !currentUser.isSiteOwner
                    ? 'bg-[var(--accent)] text-[#3a2b30] font-bold'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <UserCheck className="w-3 h-3" />
                <span>Creator thường</span>
              </button>
            </div>

            {/* Nút mở bảng "Cài đặt trang" (Chỉ hiện cho Chủ web) */}
            {canOpenSiteSettings && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="px-3 py-1.5 rounded-full font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>⚙️ Cài đặt trang</span>
              </button>
            )}

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
                  ✨ Cẩm nang nhỏ cho Creator
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
                  Tên web, câu chào ở cổng, tên tab, tiêu đề, mô tả, FAQ hay câu thoại trong game đều có thể bấm vào gõ sửa trực tiếp và tự động lưu!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-1">
                <div className="font-bold text-[var(--text)]">
                  2️⃣ Thêm ➕, Sửa ✏️, Xóa 🗑️ & Sắp xếp ↕️ kèm link ảnh
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Mỗi thẻ dữ liệu đều có cụm nút nhỏ để bạn sửa chi tiết, dán link ảnh minh họa hoặc đổi thứ tự. Creator thường chỉ sửa nội dung của riêng mình.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--bg)] space-y-1">
                <div className="font-bold text-[var(--text)]">
                  3️⃣ Bảng "Cài đặt trang" ⚙️ & Hoàn tác ↩️ an toàn
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Chủ web có thể mở bảng <strong>Cài đặt trang</strong> để chọn 5 màu nhấn, thêm nhạc MP3, ẩn/hiện tab, đổi tên tiền tệ và duyệt Creator. Lưu ý nhỏ: chỉnh sửa hiện lưu trên trình duyệt của bạn, nhớ bấm <strong>Xuất JSON</strong> để cất bản sao nhé!
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

      {/* 4. Bảng "Cài đặt trang" kéo ra từ cạnh phải (Chỉ dành cho Creator Chủ web) */}
      {drawerOpen && canOpenSiteSettings && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg h-full bg-[var(--surface)] border-l-2 border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
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
                    Tùy biến toàn bộ sổ tay · Tự động lưu trên trình duyệt
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
                      Danh sách link nhạc MP3 (Nếu để trống sẽ phát tiếng hộp nhạc Web Audio):
                    </div>

                    <form onSubmit={handleAddMp3Url} className="flex gap-2">
                      <input
                        type="url"
                        value={newMp3Url}
                        onChange={(e) => setNewMp3Url(e.target.value)}
                        placeholder="Dán link file .mp3 (https://.../nhac.mp3)"
                        className="flex-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer shrink-0 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm</span>
                      </button>
                    </form>

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

              {/* Mục 5: Duyệt hoặc Từ chối tài khoản Creator đang chờ */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif-title text-lg font-bold text-[var(--text)]">
                    5. Duyệt Tài Khoản Creator Đang Chờ ({creatorApps.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const next = authService.addSamplePendingCreator();
                      setCreatorApps(next);
                      onNotify('✨ Đã tạo thêm 1 hồ sơ Creator chờ duyệt để bạn thử nghiệm!');
                    }}
                    className="text-[11px] font-bold text-[var(--text)] underline cursor-pointer"
                  >
                    + Tạo thử hồ sơ chờ
                  </button>
                </div>

                <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] space-y-2.5">
                  {creatorApps.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] text-center py-3">
                      Hiện chưa có hồ sơ đăng ký Creator nào.
                    </p>
                  ) : (
                    creatorApps.map((app) => (
                      <div
                        key={app.id}
                        className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                            <span>{app.avatarEmoji}</span>
                            <span className="truncate">{app.displayName}</span>
                          </div>
                          <div className="text-[11px] text-[var(--muted)] truncate">
                            {app.email} ·{' '}
                            {app.creatorStatus === 'pending' ? (
                              <span className="font-bold text-[var(--text)]">
                                ⏳ Đang chờ duyệt
                              </span>
                            ) : app.creatorStatus === 'approved' ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                ✅ Đã duyệt
                              </span>
                            ) : (
                              <span className="text-red-500">Đã từ chối</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {app.creatorStatus !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = authService.approveCreatorById(
                                  app.id
                                );
                                setCreatorApps(next);
                                onNotify(
                                  `🎉 Đã duyệt ${app.displayName} lên quyền Creator!`
                                );
                              }}
                              className="px-3 py-1 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Duyệt</span>
                            </button>
                          )}
                          {app.creatorStatus !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = authService.rejectCreatorById(
                                  app.id
                                );
                                setCreatorApps(next);
                                onNotify(
                                  `Đã từ chối yêu cầu Creator của ${app.displayName}.`
                                );
                              }}
                              className="px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-red-500 cursor-pointer inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Từ chối</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
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
