import React, { useState, useEffect } from 'react';
import { ColorMode, ThemeConfig } from '../constants/themes';
import { SiteConfig } from '../services/siteSettings';
import { EditableText } from './EditableText';

interface GateOverlayProps {
  themes: ThemeConfig[];
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  colorMode: ColorMode;
  onToggleColorMode: () => void;
  onEnter: (withMusic: boolean) => void;
  isClosing: boolean;
  siteConfig: SiteConfig;
  editMode?: boolean;
  onUpdateSiteConfig?: (patch: Partial<SiteConfig>) => void;
}

export const GateOverlay: React.FC<GateOverlayProps> = ({
  themes,
  activeThemeId,
  onSelectTheme,
  colorMode,
  onToggleColorMode,
  onEnter,
  isClosing,
  siteConfig,
  editMode = false,
  onUpdateSiteConfig,
}) => {
  const [typedTitle, setTypedTitle] = useState('');
  const [hoveredThemeName, setHoveredThemeName] = useState<string | null>(null);

  useEffect(() => {
    const title = siteConfig.siteTitle || 'Góc Nhỏ Lấp Lánh';
    if (editMode) {
      setTypedTitle(title);
      return;
    }
    let index = 0;
    setTypedTitle('');
    const interval = setInterval(() => {
      index += 1;
      setTypedTitle(title.slice(0, index));
      if (index >= title.length) {
        clearInterval(interval);
      }
    }, 85);

    return () => clearInterval(interval);
  }, [siteConfig.siteTitle, editMode]);

  const currentTheme = themes.find((t) => t.id === activeThemeId) || themes[0];
  const displayThemeLabel =
    hoveredThemeName ?? `${currentTheme.emoji} ${currentTheme.name}`;

  return (
    <div
      style={{
        transition:
          'opacity 700ms ease, background-color 400ms ease, color 400ms ease',
        backgroundImage: `radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 24%, transparent) 0%, transparent 55%), radial-gradient(circle at 80% 80%, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 55%)`,
      }}
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center px-6 select-none bg-[var(--bg)] text-[var(--text)] ${
        isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Nút đổi Sáng / Tối (🌞/🌙) ở góc màn hình cổng */}
      <button
        type="button"
        onClick={onToggleColorMode}
        aria-label={
          colorMode === 'light'
            ? 'Chuyển sang chế độ tối dịu'
            : 'Chuyển sang chế độ sáng ấm'
        }
        className="fixed top-6 right-6 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/90 text-xs font-medium text-[var(--text)] shadow-sm bouncy-btn cursor-pointer flex items-center gap-2"
      >
        <span className="text-base leading-none">
          {colorMode === 'light' ? '🌞' : '🌙'}
        </span>
        <span>{colorMode === 'light' ? 'Nền sáng ấm' : 'Nền tối dịu'}</span>
      </button>

      {/* Khung sổ tay đáng yêu nơi cổng */}
      <div className="w-full max-w-xl py-12 px-8 sm:px-12 rounded-[28px] flex flex-col items-center text-center border-2 border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md theme-transition accent-glow-strong">
        <span className="sticker-chip text-xs mb-5 inline-flex items-center gap-1.5">
          <EditableText
            value={siteConfig.siteSlogan}
            editMode={editMode}
            onSave={(val) =>
              onUpdateSiteConfig && onUpdateSiteConfig({ siteSlogan: val })
            }
          />
        </span>

        {/* Tiêu đề gõ chữ dùng Quicksand (bấm sửa trực tiếp khi ở Chế độ chỉnh sửa) */}
        <h1 className="font-serif-title text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text)] min-h-[1.3em] flex items-center justify-center">
          {editMode ? (
            <EditableText
              value={siteConfig.siteTitle}
              editMode={editMode}
              onSave={(val) =>
                onUpdateSiteConfig && onUpdateSiteConfig({ siteTitle: val })
              }
            />
          ) : (
            <>
              <span>{typedTitle}</span>
              <span
                className="inline-block w-[2.5px] h-7 sm:h-10 ml-1.5 rounded-full bg-[var(--accent)] animate-pulse"
                aria-hidden="true"
              />
            </>
          )}
        </h1>

        {/* Một dòng tự sự ấm áp, đáng yêu */}
        <div className="mt-4 text-sm sm:text-base text-[var(--muted)] font-normal leading-relaxed max-w-md font-sans-ui">
          <EditableText
            value={siteConfig.gateGreeting}
            editMode={editMode}
            multiline
            onSave={(val) =>
              onUpdateSiteConfig && onUpdateSiteConfig({ gateGreeting: val })
            }
          />
        </div>

        {/* Đường kẻ ngăn cách pastel */}
        <div className="w-16 h-1 rounded-full bg-[var(--border)] my-7 theme-transition" />

        {/* Hàng 5 chấm tròn chọn màu nhấn ngay tại cổng */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-[var(--muted)] mb-3">
            Chọn sắc màu sổ tay bạn yêu thích:
          </span>
          <div
            className="flex items-center gap-4"
            role="radiogroup"
            aria-label="Chọn màu nhấn giao diện"
          >
            {themes.map((theme) => {
              const isSelected = theme.id === activeThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onSelectTheme(theme.id)}
                  onMouseEnter={() =>
                    setHoveredThemeName(`${theme.emoji} ${theme.name}`)
                  }
                  onMouseLeave={() => setHoveredThemeName(null)}
                  onFocus={() =>
                    setHoveredThemeName(`${theme.emoji} ${theme.name}`)
                  }
                  onBlur={() => setHoveredThemeName(null)}
                  aria-label={`Màu giao diện: ${theme.name}`}
                  aria-checked={isSelected}
                  role="radio"
                  style={{
                    backgroundColor: theme.accent,
                    boxShadow: isSelected
                      ? `0 0 16px ${theme.accent}`
                      : 'none',
                  }}
                  className={`w-6 h-6 rounded-full transition-all duration-300 cursor-pointer focus:outline-none ${
                    isSelected
                      ? 'scale-125 ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[var(--surface)]'
                      : 'opacity-75 hover:opacity-100 hover:scale-115'
                  }`}
                />
              );
            })}
          </div>

          {/* Rê chuột hiện tên màu */}
          <div className="h-6 mt-3 flex items-center justify-center">
            <span className="text-xs font-semibold tracking-wide text-[var(--text)] transition-opacity duration-300 font-sans-ui">
              {displayThemeLabel}
            </span>
          </div>
        </div>

        {/* Nút "Bước vào" và "Vào không nhạc" bo tròn đáng yêu */}
        <div className="mt-7 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto justify-center">
          <button
            type="button"
            onClick={() => onEnter(true)}
            className="w-full sm:w-auto px-8 py-3 rounded-full text-sm font-bold text-[#3a2b30] bg-[var(--accent)] border-2 border-[var(--accent)] shadow-md bouncy-btn cursor-pointer whitespace-nowrap"
          >
            {siteConfig.gateEnterMusicLabel || '✨ Bước vào góc nhỏ'}
          </button>

          <button
            type="button"
            onClick={() => onEnter(false)}
            className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-medium text-[var(--muted)] bg-[var(--bg)] border-2 border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--accent)] bouncy-btn cursor-pointer whitespace-nowrap"
          >
            {siteConfig.gateEnterSilentLabel || '🌸 Vào không nhạc'}
          </button>
        </div>
      </div>
    </div>
  );
};
