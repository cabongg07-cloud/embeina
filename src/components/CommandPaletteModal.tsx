import React, { useState, useEffect, useRef } from 'react';
import { Command, Search, ArrowRight, Volume2, Download } from 'lucide-react';
import { NAV_TABS, NavTab, ThemeConfig } from '../constants/themes';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  themes: ThemeConfig[];
  onSelectTheme: (themeId: string) => void;
  onToggleMusic: () => void;
  onExportJson: () => void;
  availableTabs?: NavTab[];
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  activeTabId,
  onSelectTab,
  themes,
  onSelectTheme,
  onToggleMusic,
  onExportJson,
  availableTabs = NAV_TABS,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const matchingTabs: NavTab[] = availableTabs.filter(
    (t) =>
      t.label.toLowerCase().includes(q) || t.whisper.toLowerCase().includes(q)
  );

  const matchingThemes = themes.filter((t) =>
    t.name.toLowerCase().includes(q)
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl border border-[var(--accent)]/60 bg-[var(--surface)] text-[var(--text)] shadow-2xl overflow-hidden accent-glow"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--bg)]/80">
          <Search className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gõ tên tab để di chuyển nhanh (Creator, Tìm char, Mini game, Kho Docs...)"
            className="w-full text-xs sm:text-sm bg-transparent text-[var(--text)] focus:outline-none font-light"
          />
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 text-[10px] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Danh sách các Tab */}
          <div className="space-y-1">
            <div className="px-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
              Chuyển ngăn thư viện ({matchingTabs.length})
            </div>
            {matchingTabs.map((tab) => {
              const isCurrent = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(tab.id);
                    onClose();
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-l-2 border-[var(--accent)]'
                      : 'hover:bg-[var(--bg)]/70 text-[var(--text)]'
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium">
                      {tab.label}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] font-light line-clamp-1">
                      {tab.whisper}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Hành động nhanh & Đổi màu */}
          <div className="pt-2 border-t border-[var(--border)]/60 space-y-1">
            <div className="px-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
              Lệnh nhanh & Màu giao diện
            </div>

            <button
              type="button"
              onClick={() => {
                onToggleMusic();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg)]/70 flex items-center justify-between cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                Bật / Tắt âm thanh đêm (Phím tắt: M)
              </span>
              <span className="text-[10px] text-[var(--muted)]">M</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onExportJson();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg)]/70 flex items-center justify-between cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                Xuất toàn bộ dữ liệu ra file JSON
              </span>
              <span className="text-[10px] text-[var(--muted)]">JSON</span>
            </button>

            <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
              {matchingThemes.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(th.id);
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1.5 cursor-pointer"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: th.vars['--accent'] }}
                  />
                  <span>{th.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]/90 flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Command className="w-3 h-3" />
            <span>Phím tắt: Ctrl+K mở bảng lệnh · / tìm kiếm · M bật/tắt nhạc</span>
          </span>
        </div>
      </div>
    </div>
  );
};
