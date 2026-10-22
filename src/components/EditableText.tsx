import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  editMode: boolean;
  multiline?: boolean;
  allowEmpty?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4';
}

/**
 * Component sửa trực tiếp văn bản (Inline Text Edit):
 * - Khi `editMode === true`: hiển thị viền nét đứt nhẹ (`border-dashed`), bấm vào là gõ sửa ngay và tự lưu khi blur hoặc nhấn Enter.
 * - Khi `editMode === false`: hiển thị như văn bản bình thường, không có bất kỳ dấu hiệu chỉnh sửa nào.
 */
export const EditableText: React.FC<EditableTextProps> = ({
  value,
  onSave,
  editMode,
  multiline = false,
  allowEmpty = false,
  className = '',
  inputClassName = '',
  placeholder = 'Nhập nội dung...',
  as: Tag = 'span',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!editMode && isEditing) {
      setIsEditing(false);
    }
  }, [editMode, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  if (!editMode) {
    return <Tag className={className}>{value}</Tag>;
  }

  const commitChange = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (allowEmpty) {
      if (trimmed !== value) {
        onSave(trimmed);
      } else {
        setDraft(value);
      }
      return;
    }
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitChange}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(value);
              setIsEditing(false);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              commitChange();
            }
          }}
          placeholder={placeholder}
          onClick={(e) => e.stopPropagation()}
          className={`w-full px-2.5 py-1.5 rounded-xl border-2 border-dashed border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] focus:outline-none text-sm leading-relaxed ${inputClassName}`}
        />
      );
    }

    return (
      <input
        ref={(el) => {
          inputRef.current = el;
        }}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitChange();
          } else if (e.key === 'Escape') {
            setDraft(value);
            setIsEditing(false);
          }
        }}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        className={`px-2 py-0.5 rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] focus:outline-none min-w-[120px] ${className} ${inputClassName}`}
      />
    );
  }

  return (
    <Tag
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title="✏️ Bấm để gõ sửa trực tiếp (Tự động lưu)"
      className={`${className} border border-dashed border-[var(--accent)]/75 rounded-lg px-1.5 py-0.5 -mx-1 hover:bg-[var(--accent)]/15 transition-colors cursor-text inline-block`}
    >
      {value}
    </Tag>
  );
};

interface ItemEditControlsProps {
  canEdit: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
  label?: string;
}

/**
 * Cụm nút ✏️ Sửa, 🗑️ Xóa, ↕️ Sắp xếp xuất hiện trên từng thẻ dữ liệu khi bật Chế độ chỉnh sửa
 */
export const ItemEditControls: React.FC<ItemEditControlsProps> = ({
  canEdit,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  disableUp = false,
  disableDown = false,
  label,
}) => {
  if (!canEdit) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="inline-flex flex-wrap items-center gap-1 px-2 py-1 rounded-full border border-dashed border-[var(--accent)] bg-[var(--surface)]/95 text-[11px] shadow-xs"
    >
      {label && (
        <span className="text-[10px] font-bold text-[var(--muted)] px-1">
          {label}
        </span>
      )}
      {onMoveUp && (
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disableUp}
          title="↕️ Đưa lên trên"
          className="px-1.5 py-0.5 rounded-full hover:bg-[var(--accent)]/25 text-[var(--text)] disabled:opacity-35 cursor-pointer inline-flex items-center"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
      )}
      {onMoveDown && (
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disableDown}
          title="↕️ Đưa xuống dưới"
          className="px-1.5 py-0.5 rounded-full hover:bg-[var(--accent)]/25 text-[var(--text)] disabled:opacity-35 cursor-pointer inline-flex items-center"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="✏️ Sửa mục này"
          className="px-2 py-0.5 rounded-full hover:bg-[var(--accent)]/25 text-[var(--text)] font-semibold cursor-pointer inline-flex items-center gap-1"
        >
          <Pencil className="w-3 h-3 text-[var(--accent)]" />
          <span>Sửa</span>
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="🗑️ Xóa mục này"
          className="px-2 py-0.5 rounded-full hover:bg-red-500/15 text-[var(--muted)] hover:text-red-500 font-semibold cursor-pointer inline-flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          <span>Xóa</span>
        </button>
      )}
    </div>
  );
};
