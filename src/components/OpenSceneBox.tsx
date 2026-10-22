import React, { useRef, useState, useEffect, useCallback } from 'react';
import { BookOpen, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { EditableText } from './EditableText';

interface OpenSceneBoxProps {
  content: string;
  label?: string;
  editable?: boolean;
  onSave?: (newValue: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Khung hiển thị Open Scene dùng chung ở mọi nơi (thẻ trong danh sách, trang chi tiết char, hộp xem trước trong form Thêm/Sửa):
 * - Chiều cao cố định: max-height 200px trên máy tính (sm:max-h-[200px]), 180px trên điện thoại (max-h-[180px]).
 * - Nội dung dài tự cuộn dọc bên trong khung (overflow-y: auto), không kéo dài thẻ char.
 * - Chiều rộng bằng thẻ, không tràn ngang (overflow-x: hidden), tự xuống dòng (break-words), giữ nguyên xuống dòng & đoạn văn (whitespace-pre-wrap).
 * - Thanh cuộn mảnh, bo tròn, màu pastel (.open-scene-scroll).
 * - Bóng mờ nhẹ ở mép trên/dưới khi còn nội dung chưa đọc hết.
 * - Hỗ trợ cuộn bằng chuột, vuốt cảm ứng trên điện thoại và bàn phím khi focus (tabIndex={0}).
 */
export const OpenSceneBox: React.FC<OpenSceneBoxProps> = ({
  content,
  label = 'Open Scene (Lời mở đầu của cảnh):',
  editable = false,
  onSave,
  placeholder = '(Chưa có lời mở đầu)',
  className = '',
  loading = false,
  error = null,
  onRetry,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollShadows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const top = el.scrollTop > 3;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight > 3;
    setCanScrollUp(top);
    setCanScrollDown(bottom);
  }, []);

  useEffect(() => {
    updateScrollShadows();
    const el = scrollRef.current;
    if (!el) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateScrollShadows();
      });
      ro.observe(el);
    }

    const handleWindowResize = () => updateScrollShadows();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [content, loading, error, updateScrollShadows]);

  return (
    <div
      className={`w-full max-w-full min-w-0 rounded-2xl bg-[var(--bg)]/85 border border-[var(--border)] border-l-3 border-l-[var(--accent)] overflow-hidden flex flex-col ${className}`}
    >
      <div className="px-3.5 pt-2.5 pb-1.5 flex items-center justify-between gap-2 border-b border-[var(--border)]/50 shrink-0">
        <div className="font-bold text-[11px] text-[var(--text)] flex items-center gap-1.5 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        {!loading && !error && (canScrollUp || canScrollDown) && (
          <span className="text-[10px] text-[var(--muted)] shrink-0 select-none">
            Cuộn đọc ↕
          </span>
        )}
      </div>

      <div className="relative w-full max-w-full min-w-0">
        {/* Bóng mờ nhẹ ở mép trên khi còn nội dung phía trên */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-0 left-0 right-0 h-5 z-10 transition-opacity duration-200 ${
            !loading && !error && canScrollUp ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background:
              'linear-gradient(to bottom, color-mix(in srgb, var(--accent) 18%, var(--bg)) 0%, color-mix(in srgb, var(--bg) 75%, transparent) 65%, transparent 100%)',
            boxShadow: 'inset 0 5px 6px -5px rgba(74, 64, 70, 0.16)',
          }}
        />

        {/* Vùng cuộn cố định max-height 180px (mobile) / 200px (desktop) */}
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label={label}
          onScroll={updateScrollShadows}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className="open-scene-scroll max-h-[180px] sm:max-h-[200px] w-full max-w-full overflow-y-auto overflow-x-hidden px-3.5 py-2.5 text-xs italic text-[var(--muted)] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)]/55"
        >
          {loading ? (
            <div className="not-italic flex items-center gap-2 text-xs text-[var(--muted)] py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)] shrink-0" />
              <span>Đang tải...</span>
            </div>
          ) : error ? (
            <div className="not-italic flex items-center justify-between gap-2 text-xs text-rose-500 py-0.5">
              <span className="inline-flex items-center gap-1.5 min-w-0 break-words">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 font-bold text-[11px] shrink-0 cursor-pointer hover:bg-rose-500/25 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Thử lại</span>
                </button>
              )}
            </div>
          ) : editable && onSave ? (
            <EditableText
              value={content || placeholder}
              onSave={onSave}
              editMode={true}
              multiline
              as="div"
              className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] w-full"
            />
          ) : (
            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] w-full">
              {content || placeholder}
            </div>
          )}
        </div>

        {/* Bóng mờ nhẹ ở mép dưới khi còn nội dung chưa đọc hết */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-0 left-0 right-0 h-6 z-10 transition-opacity duration-200 ${
            !loading && !error && canScrollDown ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background:
              'linear-gradient(to top, color-mix(in srgb, var(--accent) 20%, var(--bg)) 0%, color-mix(in srgb, var(--bg) 80%, transparent) 65%, transparent 100%)',
            boxShadow: 'inset 0 -5px 6px -5px rgba(74, 64, 70, 0.16)',
          }}
        />
      </div>
    </div>
  );
};
