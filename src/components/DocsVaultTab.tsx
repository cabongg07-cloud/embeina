import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Folder,
  Plus,
  Download,
  Search,
  Bold,
  Italic,
  Heading2,
  List,
  Quote,
  Code,
  Trash2,
} from 'lucide-react';
import { DocItem, SAMPLE_DOCS } from '../data/sampleData';
import { EditableText } from './EditableText';

interface DocsVaultTabProps {
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
  docArticles?: DocItem[];
  onUpdateDocArticles?: (next: DocItem[], label?: string) => void;
}

export const DocsVaultTab: React.FC<DocsVaultTabProps> = ({
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
  docArticles: propDocs,
  onUpdateDocArticles,
}) => {
  const [docs, setDocs] = useState<DocItem[]>(() =>
    propDocs && propDocs.length > 0 ? propDocs : SAMPLE_DOCS
  );

  useEffect(() => {
    if (propDocs && propDocs.length > 0) {
      setDocs(propDocs);
    }
  }, [propDocs]);

  const syncDocs = (next: DocItem[], label = 'Cập nhật tài liệu Kho Docs') => {
    setDocs(next);
    onUpdateDocArticles?.(next, label);
  };

  const [activeDocId, setActiveDocId] = useState<string>(
    docs[0]?.id || ''
  );
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('Đã lưu tự động');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const folders = useMemo(() => {
    const set = new Set<string>(['Hướng dẫn Chat', 'Tài liệu Chủ web', 'Ghi chép riêng']);
    docs.forEach((d) => {
      if (d.folder) set.add(d.folder);
    });
    return Array.from(set);
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return docs.filter((d) => {
      if (selectedFolder !== 'all' && d.folder !== selectedFolder) return false;
      if (q) {
        return (
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [docs, selectedFolder, searchQuery]);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeDocId) || filteredDocs[0] || null,
    [docs, activeDocId, filteredDocs]
  );

  const handleUpdateDocField = (patch: Partial<DocItem>) => {
    if (!activeDoc) return;
    setAutoSaveStatus('Đang lưu...');
    const nowStr = new Date().toISOString().slice(0, 10);
    const next = docs.map((d) =>
      d.id === activeDoc.id ? { ...d, ...patch, updatedAt: nowStr } : d
    );
    syncDocs(next, `Cập nhật tài liệu "${activeDoc.title}"`);
    setTimeout(() => setAutoSaveStatus('Đã lưu tự động'), 400);
  };

  const handleCreateNewDoc = () => {
    const nowStr = new Date().toISOString().slice(0, 10);
    const added: DocItem = {
      id: `doc_${Date.now()}`,
      title: 'Bản ghi chép đêm mới',
      folder: selectedFolder === 'all' ? 'Ghi chép riêng' : selectedFolder,
      tags: ['Bản nháp'],
      content: '# Tiêu đề tài liệu\n\nViết những dòng ghi chép của bạn tại đây...',
      updatedAt: nowStr,
    };
    const updatedList = [added, ...docs];
    syncDocs(updatedList, 'Tạo tài liệu mới trong Kho Docs');
    setActiveDocId(added.id);
  };

  const handleDeleteDoc = (id: string) => {
    const next = docs.filter((d) => d.id !== id);
    syncDocs(next, 'Xóa tài liệu Kho Docs');
    if (activeDocId === id) {
      setActiveDocId(next[0]?.id || '');
    }
  };

  const insertFormatting = (prefix: string, suffix = '') => {
    if (!activeDoc || !textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentText = activeDoc.content;
    const selected = currentText.slice(start, end) || 'văn bản';
    const nextContent =
      currentText.slice(0, start) +
      prefix +
      selected +
      suffix +
      currentText.slice(end);
    handleUpdateDocField({ content: nextContent });
  };

  const handleExportFile = (ext: 'md' | 'txt') => {
    if (!activeDoc) return;
    const blob = new Blob([activeDoc.content], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = activeDoc.title
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, '-');
    a.download = `${safeTitle || 'tai-lieu-dem'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border)] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="font-serif-title text-3xl sm:text-4xl font-bold text-[var(--text)] tracking-wide">
            <EditableText
              value={
                customTexts['docs_tab_title'] ||
                '📒 Kho Docs & Sổ Tay Lưu Trữ'
              }
              onSave={(val) => onUpdateCustomText?.('docs_tab_title', val)}
              editMode={editMode}
            />
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            <EditableText
              value={
                customTexts['docs_tab_desc'] ||
                'Trình soạn thảo văn bản tối giản dành cho lorebook, hướng dẫn thiết lập và những trang bản thảo sổ tay.'
              }
              onSave={(val) => onUpdateCustomText?.('docs_tab_desc', val)}
              editMode={editMode}
              multiline
            />
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNewDoc}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-[var(--accent)] text-[var(--bg)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo tài liệu mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cột trái: Thư mục & Danh sách tài liệu */}
        <div className="lg:col-span-4 space-y-5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tài liệu, tag..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--surface)]/50 border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedFolder('all')}
              className={`px-2.5 py-1 text-xs border cursor-pointer ${
                selectedFolder === 'all'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                  : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              Tất cả ({docs.length})
            </button>
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFolder(f)}
                className={`px-2.5 py-1 text-xs border inline-flex items-center gap-1 cursor-pointer ${
                  selectedFolder === f
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                <Folder className="w-3 h-3" />
                <span>{f}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {filteredDocs.map((doc) => {
              const isSelected = activeDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  className={`p-4 border transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--surface)]/85'
                      : 'border-[var(--border)] bg-[var(--surface)]/35 hover:border-[var(--muted)]'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-serif-title text-[var(--text)] truncate">
                      <FileText className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate">
                      {doc.folder} · {doc.tags.join(' / ')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoc(doc.id);
                    }}
                    aria-label="Xóa tài liệu"
                    className="p-1 text-[var(--muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cột phải: Trình soạn thảo văn bản */}
        <div className="lg:col-span-8">
          {!activeDoc ? (
            <div className="border border-[var(--border)]/60 bg-[var(--surface)]/25 py-20 px-6 text-center space-y-2">
              <p className="font-serif-title text-2xl text-[var(--text)]">
                Chưa chọn trang bản thảo nào
              </p>
              <p className="text-xs text-[var(--muted)] font-light">
                Hãy chọn một tài liệu bên cột trái hoặc tạo trang mới để bắt đầu viết.
              </p>
            </div>
          ) : (
            <div className="border border-[var(--border)] bg-[var(--surface)]/50 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)]/60 pb-4">
                <input
                  type="text"
                  value={activeDoc.title}
                  onChange={(e) =>
                    handleUpdateDocField({ title: e.target.value })
                  }
                  className="font-serif-title text-2xl sm:text-3xl text-[var(--text)] bg-transparent focus:outline-none border-b border-transparent focus:border-[var(--accent)] flex-1"
                />

                <span className="text-[11px] text-[var(--accent)] font-light shrink-0">
                  {autoSaveStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={activeDoc.folder}
                  onChange={(e) =>
                    handleUpdateDocField({ folder: e.target.value })
                  }
                  placeholder="Thư mục..."
                  className="px-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                />
                <input
                  type="text"
                  value={activeDoc.tags.join(', ')}
                  onChange={(e) =>
                    handleUpdateDocField({
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Tags (phân cách bằng dấu phẩy)..."
                  className="px-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>

              {/* Thanh công cụ định dạng văn bản */}
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 border border-[var(--border)] bg-[var(--bg)]/70">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => insertFormatting('## ')}
                    title="Tiêu đề"
                    className="p-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('**', '**')}
                    title="Chữ đậm"
                    className="p-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('*', '*')}
                    title="Chữ nghiêng"
                    className="p-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('\n- ')}
                    title="Danh sách"
                    className="p-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('\n> ')}
                    title="Trích dẫn"
                    className="p-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('\n```\n', '\n```\n')}
                    title="Code block"
                    className="p-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportFile('md')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export .MD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportFile('txt')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export .TXT</span>
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                rows={15}
                value={activeDoc.content}
                onChange={(e) =>
                  handleUpdateDocField({ content: e.target.value })
                }
                className="w-full p-4 text-xs sm:text-sm bg-[var(--bg)]/90 border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-sans-ui leading-relaxed resize-y"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
