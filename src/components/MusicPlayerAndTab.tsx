import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Music,
  Link2,
  Upload,
  Disc3,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  AlertCircle,
  HardDrive,
  RotateCcw,
  Palette,
} from 'lucide-react';
import {
  MusicTrack,
  PlayMode,
  MAX_AUDIO_FILE_SIZE_BYTES,
  ALLOWED_AUDIO_EXTENSIONS,
  validateAndNormalizeAudioUrl,
  musicIdbStorage,
  inferTitleFromUrl,
  formatAudioTime,
} from '../services/musicService';
import { ColorMode, ThemeConfig } from '../constants/themes';
import { EditableText } from './EditableText';

interface AddMusicPanelProps {
  onAddTrack: (
    track: MusicTrack,
    playImmediately?: boolean,
    targetPlaylist?: 'web' | 'personal'
  ) => void;
  onClose?: () => void;
  compact?: boolean;
  playlistSource?: 'web' | 'personal';
  canEditWebPlaylist?: boolean;
}

export const AddMusicPanel: React.FC<AddMusicPanelProps> = ({
  onAddTrack,
  onClose,
  compact = false,
  playlistSource = 'web',
  canEditWebPlaylist = false,
}) => {
  const [mode, setMode] = useState<'url' | 'file'>('url');

  // State cho Cách 2a: Dán link mp3 trực tiếp
  const [titleInput, setTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [coverInput, setCoverInput] = useState('');
  const [artistInput, setArtistInput] = useState('');
  const [validatingUrl, setValidatingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlHintNote, setUrlHintNote] = useState<string | null>(null);

  // State cho Cách 2b: Tải file từ máy lên (lưu bằng IndexedDB)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitleInput, setFileTitleInput] = useState('');
  const [fileCoverInput, setFileCoverInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    setUrlHintNote(null);

    if (!urlInput.trim()) {
      setUrlError('Bạn hãy dán link nhạc trực tiếp (.mp3, .m4a, .wav, .ogg) vào ô nhé 🌸');
      return;
    }

    setValidatingUrl(true);
    try {
      const result = await validateAndNormalizeAudioUrl(urlInput);
      if (!result.ok) {
        setUrlError(
          result.errorMessage ||
            'Không thể phát được link nhạc này. Bạn kiểm tra lại link trực tiếp nhé!'
        );
        if (result.wasConverted && result.normalizedUrl) {
          setUrlInput(result.normalizedUrl);
        }
        setValidatingUrl(false);
        return;
      }

      if (result.wasConverted && result.conversionNote) {
        setUrlHintNote(result.conversionNote);
      }

      const finalTitle =
        titleInput.trim() || inferTitleFromUrl(result.normalizedUrl);

      const targetSource: 'web' | 'personal' =
        playlistSource === 'web' && canEditWebPlaylist ? 'web' : 'personal';

      const newTrack: MusicTrack = {
        id: `track-url-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: finalTitle,
        artist: artistInput.trim() || 'Link MP3 trực tiếp 🔗',
        coverUrl: coverInput.trim() || undefined,
        sourceType: 'url',
        url: result.normalizedUrl,
        duration: result.duration,
        isWebTrack: targetSource === 'web',
        createdAt: new Date().toISOString(),
      };

      onAddTrack(newTrack, true, targetSource);
      setTitleInput('');
      setUrlInput('');
      setCoverInput('');
      setArtistInput('');
      if (onClose) onClose();
    } catch {
      setUrlError(
        'Có chút trục trặc khi kiểm tra link nhạc. Bạn thử lại với link .mp3 trực tiếp nhé 🌸'
      );
    } finally {
      setValidatingUrl(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isAllowedExt = ALLOWED_AUDIO_EXTENSIONS.includes(ext);
    const isAudioMime = file.type.startsWith('audio/');

    if (!isAllowedExt && !isAudioMime) {
      setFileError(
        'Định dạng chưa hỗ trợ 🌸 Bạn vui lòng chọn file âm thanh .mp3, .m4a, .wav hoặc .ogg nhé!'
      );
      e.target.value = '';
      return;
    }

    if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(
        `File này nặng ${sizeMb}MB (vượt mức tối đa 15MB mỗi file). Bạn hãy chọn file nhẹ hơn 15MB để lưu mượt mà nhé 💌`
      );
      e.target.value = '';
      return;
    }

      setSelectedFile(file);
      if (!fileTitleInput.trim()) {
        const cleanName = file.name
          .replace(/\.(mp3|m4a|wav|ogg)$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim();
        setFileTitleInput(cleanName || 'Bản Nhạc Từ Máy');
      }

      if (playlistSource === 'web' && canEditWebPlaylist) {
        setFileError(
          '⚠️ Playlist của web chỉ nhận link MP3 trực tiếp (vì file tải từ máy lên chỉ lưu trên trình duyệt của máy đó, người khác truy cập web sẽ không nghe được). Bạn hãy chuyển sang mục "a. Dán link MP3" để dán link .mp3 trực tiếp nhé!'
        );
      }
    };

    const handleSubmitFile = async (e: React.FormEvent) => {
      e.preventDefault();
      setFileError(null);

      if (playlistSource === 'web' && canEditWebPlaylist) {
        setFileError(
          '⚠️ Không thể thêm file từ máy vào Playlist của web vì file tải từ máy chỉ nghe được trên máy đó. Bạn hãy bấm sang mục "a. Dán link MP3" và dán link .mp3 trực tiếp để lưu lên site_settings cho mọi người cùng nghe nhé!'
        );
        return;
      }

      if (!selectedFile) {
        setFileError('Bạn hãy chọn một file nhạc (.mp3, .m4a, .wav, .ogg) từ máy trước nhé 🌸');
        return;
      }

      setUploadingFile(true);
      try {
        const idbKey = `idb-audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        // Đo thời lượng file trước khi lưu nếu có thể
        const tempObjUrl = URL.createObjectURL(selectedFile);
        const duration = await new Promise<number | undefined>((resolve) => {
          const tempAudio = new Audio();
          const timer = window.setTimeout(() => resolve(undefined), 3500);
          tempAudio.onloadedmetadata = () => {
            window.clearTimeout(timer);
            resolve(
              Number.isFinite(tempAudio.duration) && tempAudio.duration > 0
                ? Math.round(tempAudio.duration)
                : undefined
            );
          };
          tempAudio.onerror = () => {
            window.clearTimeout(timer);
            resolve(undefined);
          };
          tempAudio.src = tempObjUrl;
        });
        URL.revokeObjectURL(tempObjUrl);

        const saved = await musicIdbStorage.saveAudioFile(idbKey, selectedFile);
        if (!saved) {
          setFileError(
            'Trình duyệt không thể lưu file vào bộ nhớ IndexedDB. Bạn kiểm tra dung lượng trống trên trình duyệt nhé!'
          );
          setUploadingFile(false);
          return;
        }

        const ext = (selectedFile.name.split('.').pop() || 'mp3').toLowerCase();
        const newTrack: MusicTrack = {
          id: `track-idb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: fileTitleInput.trim() || selectedFile.name,
          artist: `Tải lên từ máy (.${ext}) · Chỉ nghe trên máy này 💾`,
          coverUrl: fileCoverInput.trim() || undefined,
          sourceType: 'indexeddb',
          idbKey,
          duration,
          fileSize: selectedFile.size,
          fileExt: ext,
          isWebTrack: false,
          createdAt: new Date().toISOString(),
        };

        onAddTrack(newTrack, true, 'personal');
        setSelectedFile(null);
        setFileTitleInput('');
        setFileCoverInput('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (onClose) onClose();
      } catch {
        setFileError('Có lỗi nhỏ khi đọc file nhạc từ máy. Bạn thử chọn lại file nhé!');
      } finally {
        setUploadingFile(false);
      }
    };

  return (
    <div
      className={`rounded-2xl border-2 border-[var(--accent)] bg-[var(--bg)] ${
        compact ? 'p-3.5 space-y-3' : 'p-5 space-y-4'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[var(--text)]">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          <span>
            ➕ Thêm nhạc vào{' '}
            {playlistSource === 'web' && canEditWebPlaylist
              ? '🌐 Playlist của Web'
              : '💖 Playlist của tôi'}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2 cách thêm nhạc: Dán link MP3 trực tiếp | Tải file từ máy lên */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => {
            setMode('url');
            setUrlError(null);
          }}
          className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mode === 'url'
              ? 'bg-[var(--accent)] text-[#3a2b30] shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>a. Dán link MP3</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('file');
            setFileError(null);
          }}
          className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mode === 'file'
              ? 'bg-[var(--accent)] text-[#3a2b30] shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>b. Tải file từ máy</span>
        </button>
      </div>

      {mode === 'url' ? (
        <form onSubmit={handleSubmitUrl} className="space-y-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
              Tên bài nhạc (để trống sẽ tự lấy theo link)
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="VD: Đêm Trăng Quán Trà..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
              Link nhạc MP3 trực tiếp *
            </label>
            <input
              type="url"
              required
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="https://.../bai-nhac.mp3"
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                Link ảnh bìa (tùy chọn)
              </label>
              <input
                type="url"
                value={coverInput}
                onChange={(e) => setCoverInput(e.target.value)}
                placeholder="https://.../bia-dia.jpg"
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                Nghệ sĩ / Ghi chú (tùy chọn)
              </label>
              <input
                type="text"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                placeholder="VD: Piano Acoustic"
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          </div>

          {/* Gợi ý nhanh về định dạng link */}
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[11px] text-[var(--muted)] space-y-1 leading-relaxed">
            <div className="font-semibold text-[var(--text)]">
              💡 Mẹo nhỏ khi dán link nhạc:
            </div>
            <div>
              • Cần dùng link file trực tiếp (<strong>.mp3, .m4a, .wav, .ogg</strong>).
            </div>
            <div>
              • <strong>Google Drive</strong>: Đổi thành dạng{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--bg)] text-[10px]">
                https://drive.google.com/uc?export=download&id=MÃ_FILE
              </code>
            </div>
            <div>
              • <strong>Dropbox</strong>: Đổi đuôi{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--bg)] text-[10px]">
                ?dl=0
              </code>{' '}
              thành{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--bg)] text-[10px]">
                ?raw=1
              </code>
            </div>
            <div>
              • <strong>Link YouTube</strong> không phát được bằng thẻ{' '}
              <code>&lt;audio&gt;</code> — bạn hãy tải file về máy rồi dùng tab{' '}
              <strong>"b. Tải file từ máy"</strong> nhé!
            </div>
          </div>

          {urlHintNote && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-700 dark:text-emerald-300">
              ✨ {urlHintNote}
            </div>
          )}

          {urlError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-[var(--text)] space-y-1 whitespace-pre-line leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Chưa phát được link này rồi</span>
              </div>
              <div>{urlError}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={validatingUrl}
            className="w-full py-2.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold bouncy-btn cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {validatingUrl ? (
              <span>⏳ Đang kiểm tra thử link nhạc...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Kiểm tra & Lưu vào Playlist</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmitFile} className="space-y-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
              Chọn file nhạc từ máy (.mp3, .m4a, .wav, .ogg — tối đa 15MB) *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/*"
              onChange={handleFileChange}
              className="w-full text-xs file:mr-3 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[var(--accent)] file:text-[#3a2b30] file:cursor-pointer bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1.5 text-[var(--text)]"
            />
            {selectedFile && (
              <div className="mt-1.5 text-[11px] text-[var(--accent)] font-semibold flex items-center justify-between">
                <span className="truncate">🎵 {selectedFile.name}</span>
                <span className="shrink-0 ml-2">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                Tên bài hiển thị
              </label>
              <input
                type="text"
                value={fileTitleInput}
                onChange={(e) => setFileTitleInput(e.target.value)}
                placeholder="Tên bài nhạc..."
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                Link ảnh bìa (tùy chọn)
              </label>
              <input
                type="url"
                value={fileCoverInput}
                onChange={(e) => setFileCoverInput(e.target.value)}
                placeholder="https://.../bia-dia.jpg"
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-[var(--text)] flex items-start gap-2 leading-relaxed">
            <HardDrive className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              {playlistSource === 'web' && canEditWebPlaylist ? (
                <>
                  <strong>Lưu ý cho Chủ web:</strong> Playlist của web{' '}
                  <strong>chỉ nhận link MP3 trực tiếp</strong> (vì file tải từ máy lên chỉ lưu cục bộ trên máy đó, người khác vào web không nghe được). Bạn hãy bấm nút bên dưới để chuyển sang dán link <code>.mp3</code> trực tiếp nhé!
                </>
              ) : (
                <>
                  <strong>Lưu ý quan trọng:</strong> File tải từ máy lên (lưu trên trình duyệt máy này) <strong>chỉ nghe được trên chính thiết bị của bạn</strong> và được lưu trong <strong>&quot;Playlist của tôi&quot;</strong> nhé!
                </>
              )}
            </span>
          </div>

          {playlistSource === 'web' && canEditWebPlaylist && (
            <button
              type="button"
              onClick={() => {
                setMode('url');
                setFileError(null);
              }}
              className="w-full py-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)] font-bold text-xs cursor-pointer hover:bg-[var(--accent)]/30"
            >
              👉 Chuyển sang dán link MP3 trực tiếp cho Playlist Web
            </button>
          )}

          {fileError && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-[var(--text)] flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{fileError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={
              uploadingFile ||
              !selectedFile ||
              (playlistSource === 'web' && canEditWebPlaylist)
            }
            className="w-full py-2.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold bouncy-btn cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {uploadingFile ? (
              <span>⏳ Đang lưu nhạc vào máy...</span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Lưu file vào Playlist của tôi &amp; Phát ngay</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};

// ============================================================================
// TRÌNH PHÁT NHẠC Ở GÓC (BẤM VÀO MỞ RỘNG THÀNH BẢNG "PLAYLIST" DỄ THƯƠNG)
// ============================================================================
interface CornerMusicWidgetProps {
  playlist: MusicTrack[];
  currentTrack: MusicTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  playlistSource: 'web' | 'personal';
  onSwitchPlaylistSource: (source: 'web' | 'personal') => void;
  canEditWebPlaylist: boolean;
  isLoggedIn?: boolean;
  onTogglePlay: () => void;
  onSelectTrack: (trackId: string) => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (newTime: number) => void;
  onVolumeChange: (newVol: number) => void;
  onToggleMute: () => void;
  onCyclePlayMode: () => void;
  onAddTrack: (
    track: MusicTrack,
    playImmediately?: boolean,
    targetPlaylist?: 'web' | 'personal'
  ) => void;
  onUpdateTrack: (trackId: string, patch: Partial<MusicTrack>) => void;
  onDeleteTrack: (trackId: string) => void;
  onMoveTrack: (trackId: string, direction: 'up' | 'down') => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  onRestoreBuiltinTracks: () => void;
  // Tích hợp cùng nút Sáng/Tối & 5 màu nhấn ở góc phải
  colorMode: ColorMode;
  onToggleColorMode: () => void;
  themes: ThemeConfig[];
  activeThemeId: string;
  currentTheme: ThemeConfig;
  onSelectTheme: (themeId: string) => void;
}

export const CornerMusicWidget: React.FC<CornerMusicWidgetProps> = ({
  playlist,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playMode,
  playlistSource,
  onSwitchPlaylistSource,
  canEditWebPlaylist,
  isLoggedIn = false,
  onTogglePlay,
  onSelectTrack,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onCyclePlayMode,
  onAddTrack,
  onUpdateTrack,
  onDeleteTrack,
  onMoveTrack,
  onReorderTracks,
  onRestoreBuiltinTracks,
  colorMode,
  onToggleColorMode,
  themes,
  activeThemeId,
  currentTheme,
  onSelectTheme,
}) => {
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [showAddMusic, setShowAddMusic] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [hoveredCornerTheme, setHoveredCornerTheme] = useState<string | null>(
    null
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const canModifyCurrentPlaylist =
    playlistSource === 'web'
      ? canEditWebPlaylist
      : Boolean(isLoggedIn && playlistSource === 'personal');

  // State sửa nhanh bài nhạc trong Playlist
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCover, setEditCover] = useState('');

  const startEditTrack = (track: MusicTrack) => {
    setEditingTrackId(track.id);
    setEditTitle(track.title);
    setEditCover(track.coverUrl || '');
  };

  const saveEditTrack = (trackId: string) => {
    if (editTitle.trim()) {
      onUpdateTrack(trackId, {
        title: editTitle.trim(),
        coverUrl: editCover.trim() || undefined,
      });
    }
    setEditingTrackId(null);
  };

  const playModeLabel =
    playMode === 'repeat-one'
      ? 'Lặp 1 bài'
      : playMode === 'shuffle'
      ? 'Ngẫu nhiên'
      : 'Lặp cả list';

  const effectiveDuration =
    duration > 0 ? duration : currentTrack.duration || 180;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 max-w-[calc(100vw-2rem)]">
      {/* Bảng chọn 5 màu nhấn khi mở */}
      {themeMenuOpen && (
        <div className="px-4 py-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md theme-transition accent-glow flex flex-col items-end gap-2 shadow-xl">
          <div className="flex items-center gap-3">
            {themes.map((theme) => {
              const isSelected = theme.id === activeThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onSelectTheme(theme.id)}
                  onMouseEnter={() =>
                    setHoveredCornerTheme(`${theme.emoji} ${theme.name}`)
                  }
                  onMouseLeave={() => setHoveredCornerTheme(null)}
                  aria-label={`Đổi sang màu ${theme.name}`}
                  style={{
                    backgroundColor: theme.accent,
                    boxShadow: isSelected
                      ? `0 0 12px ${theme.accent}`
                      : 'none',
                  }}
                  className={`w-4 h-4 rounded-full transition-all duration-300 cursor-pointer ${
                    isSelected
                      ? 'scale-125 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]'
                      : 'opacity-75 hover:opacity-100 hover:scale-110'
                  }`}
                />
              );
            })}
          </div>
          <span className="text-[11px] font-semibold text-[var(--text)]">
            {hoveredCornerTheme ?? `${currentTheme.emoji} ${currentTheme.name}`}
          </span>
        </div>
      )}

      {/* BẢNG "PLAYLIST" DỄ THƯƠNG KHI BẤM MỞ RỘNG */}
      {playlistOpen && (
        <div className="w-[340px] sm:w-[390px] max-h-[78vh] rounded-3xl border-2 border-[var(--border)] bg-[var(--surface)]/98 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden theme-transition accent-glow">
          {/* Header Bảng Playlist */}
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)]/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-[var(--accent)]/25 flex items-center justify-center text-sm shrink-0">
                🎵
              </div>
              <div className="min-w-0">
                <h3 className="font-serif-title text-base font-bold text-[var(--text)] leading-tight truncate">
                  Playlist Góc Nhỏ ({playlist.length})
                </h3>
                <p className="text-[10px] text-[var(--muted)] truncate">
                  Phím tắt M: Bật/tắt nhạc · Tự động nhớ vị trí đang nghe
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {canModifyCurrentPlaylist && (
                <button
                  type="button"
                  onClick={() => setShowAddMusic((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                    showAddMusic
                      ? 'bg-[var(--text)] text-[var(--bg)]'
                      : 'bg-[var(--accent)] text-[#3a2b30]'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm nhạc</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPlaylistOpen(false)}
                title="Thu gọn bảng Playlist"
                className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Khu vực cuộn bên trong Playlist */}
          <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
            {/* Thanh chuyển đổi giữa "Playlist của web" và "Playlist của tôi" (Khách chỉ nghe Playlist của web) */}
            {isLoggedIn ? (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPlaylistSource('web');
                    setShowAddMusic(false);
                  }}
                  className={`py-1.5 px-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                    playlistSource === 'web'
                      ? 'bg-[var(--accent)] text-[#3a2b30] shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  🌐 Playlist của web
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPlaylistSource('personal');
                    setShowAddMusic(false);
                  }}
                  className={`py-1.5 px-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                    playlistSource === 'personal'
                      ? 'bg-[var(--accent)] text-[#3a2b30] shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  💖 Playlist của tôi
                </button>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-xs font-bold text-[var(--text)] flex items-center justify-between">
                <span>🌐 Playlist của web</span>
                <span className="text-[10px] font-normal text-[var(--muted)]">
                  Nghe chung toàn trang
                </span>
              </div>
            )}

            {/* Khung Thêm Nhạc (chỉ hiện khi có quyền thêm vào playlist đang chọn) */}
            {showAddMusic && canModifyCurrentPlaylist && (
              <AddMusicPanel
                compact
                playlistSource={playlistSource}
                canEditWebPlaylist={canEditWebPlaylist}
                onAddTrack={(track, playNow, targetSource) => {
                  onAddTrack(track, playNow, targetSource);
                  setShowAddMusic(false);
                }}
                onClose={() => setShowAddMusic(false)}
              />
            )}

            {/* Thông tin bài đang phát + Đĩa xoay + Thanh tua + Nút điều khiển */}
            <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 space-y-3">
              <div className="flex items-center gap-3">
                {/* Ảnh bìa hoặc đĩa nhạc */}
                <div
                  className={`w-12 h-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center overflow-hidden shrink-0 shadow-xs ${
                    isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: '9s' }}
                >
                  {currentTrack.coverUrl ? (
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Disc3 className="w-6 h-6 text-[var(--accent)]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/25 text-[var(--text)] font-bold">
                      {currentTrack.sourceType === 'indexeddb'
                        ? '💾 Từ máy'
                        : currentTrack.sourceType === 'url'
                        ? '🔗 Link MP3'
                        : '🎐 Hộp nhạc'}
                    </span>
                    {isPlaying && (
                      <span className="text-[10px] text-[var(--accent)] font-bold">
                        ● Đang phát
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-[var(--text)] truncate mt-0.5">
                    {currentTrack.title}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] truncate">
                    {currentTrack.artist || 'Giai điệu dịu dàng'}
                  </div>
                </div>
              </div>

              {/* Thanh tua (Seek Bar) */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration}
                  step={1}
                  value={Math.min(currentTime, effectiveDuration)}
                  onChange={(e) => onSeek( parseFloat(e.target.value) )}
                  aria-label="Thanh tua bài nhạc"
                  style={{ accentColor: 'var(--accent)' }}
                  className="w-full h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--muted)]">
                  <span>{formatAudioTime(currentTime)}</span>
                  <span>{formatAudioTime(effectiveDuration)}</span>
                </div>
              </div>

              {/* Hàng nút điều khiển: Chế độ lặp/ngẫu nhiên | Trước | Phát/Tạm dừng | Sau */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onCyclePlayMode}
                  title={`Chế độ phát: ${playModeLabel} (Bấm để đổi)`}
                  className="px-2.5 py-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1"
                >
                  {playMode === 'repeat-one' ? (
                    <Repeat1 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  ) : playMode === 'shuffle' ? (
                    <Shuffle className="w-3.5 h-3.5 text-[var(--accent)]" />
                  ) : (
                    <Repeat className="w-3.5 h-3.5 text-[var(--accent)]" />
                  )}
                  <span>{playModeLabel}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onPrevTrack}
                    title="Bài trước"
                    className="p-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={onTogglePlay}
                    title={isPlaying ? 'Tạm dừng (M)' : 'Phát nhạc (M)'}
                    className="p-2.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold shadow-xs bouncy-btn cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onNextTrack}
                    title="Bài tiếp theo"
                    className="p-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Thanh âm lượng trong bảng Playlist */}
              <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]/60">
                <button
                  type="button"
                  onClick={onToggleMute}
                  title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                  className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  aria-label="Âm lượng"
                  style={{ accentColor: 'var(--accent)' }}
                  className="flex-1 h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer"
                />
                <span className="text-[10px] font-bold text-[var(--muted)] w-8 text-right">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>

            {/* Danh sách các bài trong Playlist */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)] px-1">
                <span>DANH SÁCH BÀI HÁT ({playlist.length})</span>
                {canModifyCurrentPlaylist && (
                  <button
                    type="button"
                    onClick={onRestoreBuiltinTracks}
                    title="Khôi phục 4 giai điệu hộp nhạc mặc định"
                    className="text-[10px] text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Khôi phục nhạc gốc</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {playlist.map((track, idx) => {
                  const isCurrent = track.id === currentTrack.id;
                  const isEditing = editingTrackId === track.id;

                  return (
                    <div
                      key={track.id}
                      draggable={canModifyCurrentPlaylist && !isEditing}
                      onDragStart={() => {
                        if (canModifyCurrentPlaylist) setDragIndex(idx);
                      }}
                      onDragOver={(e) => {
                        if (canModifyCurrentPlaylist) e.preventDefault();
                      }}
                      onDrop={() => {
                        if (
                          canModifyCurrentPlaylist &&
                          dragIndex !== null &&
                          dragIndex !== idx
                        ) {
                          onReorderTracks?.(dragIndex, idx);
                        }
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={`p-2 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15'
                          : 'border-[var(--border)] bg-[var(--bg)]/60 hover:border-[var(--accent)]/60'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2 text-xs">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Tên bài nhạc..."
                            className="w-full px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-semibold"
                          />
                          <input
                            type="url"
                            value={editCover}
                            onChange={(e) => setEditCover(e.target.value)}
                            placeholder="Link ảnh bìa (tùy chọn)..."
                            className="w-full px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingTrackId(null)}
                              className="px-2.5 py-1 rounded-lg border border-[var(--border)] text-[11px] text-[var(--muted)] cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditTrack(track.id)}
                              className="px-3 py-1 rounded-lg bg-[var(--accent)] text-[#3a2b30] text-[11px] font-bold cursor-pointer"
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectTrack(track.id)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center overflow-hidden shrink-0 text-xs font-bold">
                              {track.coverUrl ? (
                                <img
                                  src={track.coverUrl}
                                  alt={track.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : isCurrent && isPlaying ? (
                                <span className="text-[var(--accent)]">♫</span>
                              ) : (
                                <span className="text-[var(--muted)]">
                                  {idx + 1}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[var(--text)] truncate">
                                {track.title}
                              </div>
                              <div className="text-[10px] text-[var(--muted)] flex items-center gap-1.5 truncate">
                                <span>
                                  {track.sourceType === 'indexeddb'
                                    ? '💾 Máy cá nhân'
                                    : track.sourceType === 'url'
                                    ? '🔗 Link MP3'
                                    : '🎐 Hộp nhạc'}
                                </span>
                                {track.duration && (
                                  <span>· {formatAudioTime(track.duration)}</span>
                                )}
                              </div>
                            </div>
                          </button>

                          {canModifyCurrentPlaylist && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => onMoveTrack(track.id, 'up')}
                                title="Đưa lên (hoặc kéo thả bài)"
                                className="p-1 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === playlist.length - 1}
                                onClick={() => onMoveTrack(track.id, 'down')}
                                title="Đưa xuống (hoặc kéo thả bài)"
                                className="p-1 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditTrack(track)}
                                title="Sửa tên / ảnh bìa"
                                className="p-1 text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              {playlist.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteTrack(track.id)}
                                  title="Xóa bài này"
                                  className="p-1 text-[var(--muted)] hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THANH MINI Ở GÓC DƯỚI BÊN PHẢI (BẤM VÀO MỞ RỘNG PLAYLIST) */}
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-full border-2 border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md theme-transition accent-glow shadow-lg">
        {/* Nút Sáng / Tối */}
        <button
          type="button"
          onClick={onToggleColorMode}
          title={
            colorMode === 'light'
              ? 'Đang ở chế độ Sáng (Bấm để chuyển sang Tối dịu)'
              : 'Đang ở chế độ Tối dịu (Bấm để chuyển sang Sáng)'
          }
          aria-label="Chuyển chế độ sáng tối"
          className="px-1.5 py-1 rounded-full text-sm hover:scale-110 transition-transform cursor-pointer leading-none"
        >
          {colorMode === 'light' ? '🌞' : '🌙'}
        </button>

        <div className="w-[1px] h-4 bg-[var(--border)]" />

        {/* Nút 5 màu nhấn */}
        <button
          type="button"
          onClick={() => setThemeMenuOpen((prev) => !prev)}
          title={`Màu nhấn: ${currentTheme.name}`}
          aria-label="Đổi màu nhấn giao diện"
          className="flex items-center gap-1 px-1.5 py-1 text-xs text-[var(--text)] hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span
            className="w-3 h-3 rounded-full inline-block transition-colors duration-300"
            style={{ backgroundColor: currentTheme.accent }}
          />
          <Palette className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-[var(--border)]" />

        {/* Nút Phát / Tạm dừng nhanh (Phím M) */}
        <button
          type="button"
          onClick={onTogglePlay}
          title={isPlaying ? 'Tạm dừng nhạc (M)' : 'Phát nhạc (M)'}
          aria-label={isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc'}
          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
            isPlaying
              ? 'bg-[var(--accent)] text-[#3a2b30]'
              : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Bấm vào khu vực tên bài / nút Playlist để mở rộng bảng Playlist dễ thương */}
        <button
          type="button"
          onClick={() => setPlaylistOpen((prev) => !prev)}
          title="Bấm để mở rộng bảng Playlist & Thêm nhạc"
          className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-[var(--bg)] text-xs font-semibold text-[var(--text)] transition-colors cursor-pointer max-w-[165px] sm:max-w-[220px]"
        >
          <Disc3
            className={`w-3.5 h-3.5 shrink-0 ${
              isPlaying
                ? 'text-[var(--accent)] motion-safe:animate-spin'
                : 'text-[var(--muted)]'
            }`}
            style={{ animationDuration: '8s' }}
          />
          <span className="truncate">{currentTrack.title}</span>
          {isPlaying && (
            <span
              className="inline-flex items-end gap-0.5 h-3 shrink-0"
              aria-hidden="true"
            >
              <span className="w-0.5 h-2 bg-[var(--accent)] rounded-full motion-safe:animate-pulse" />
              <span className="w-0.5 h-3 bg-[var(--accent)] rounded-full motion-safe:animate-bounce" />
              <span className="w-0.5 h-1.5 bg-[var(--accent)] rounded-full motion-safe:animate-pulse" />
            </span>
          )}
          {playlistOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
          )}
        </button>

        {/* Thanh âm lượng nhỏ khi chưa mở bảng */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={isMuted ? 0 : volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label="Âm lượng nhạc nền"
          style={{ accentColor: 'var(--accent)' }}
          className="hidden sm:block w-14 h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer opacity-85 hover:opacity-100"
        />
      </div>
    </div>
  );
};

// ============================================================================
// KHU NHẠC (TAB "🎵 NHẠC") ĐẦY ĐỦ CHO NGƯỜI DÙNG & CREATOR
// ============================================================================
interface MusicTabProps {
  playlist: MusicTrack[];
  currentTrack: MusicTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  playlistSource: 'web' | 'personal';
  onSwitchPlaylistSource: (source: 'web' | 'personal') => void;
  canEditWebPlaylist: boolean;
  isLoggedIn?: boolean;
  onTogglePlay: () => void;
  onSelectTrack: (trackId: string) => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (newTime: number) => void;
  onVolumeChange: (newVol: number) => void;
  onToggleMute: () => void;
  onCyclePlayMode: () => void;
  onAddTrack: (
    track: MusicTrack,
    playImmediately?: boolean,
    targetPlaylist?: 'web' | 'personal'
  ) => void;
  onUpdateTrack: (trackId: string, patch: Partial<MusicTrack>) => void;
  onDeleteTrack: (trackId: string) => void;
  onMoveTrack: (trackId: string, direction: 'up' | 'down') => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  onRestoreBuiltinTracks: () => void;
  editMode?: boolean;
  customTexts?: Record<string, string>;
  onUpdateCustomText?: (key: string, val: string) => void;
}

export const MusicTab: React.FC<MusicTabProps> = ({
  playlist,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playMode,
  playlistSource,
  onSwitchPlaylistSource,
  canEditWebPlaylist,
  isLoggedIn = false,
  onTogglePlay,
  onSelectTrack,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onCyclePlayMode,
  onAddTrack,
  onUpdateTrack,
  onDeleteTrack,
  onMoveTrack,
  onReorderTracks,
  onRestoreBuiltinTracks,
  editMode = false,
  customTexts = {},
  onUpdateCustomText,
}) => {
  const [sourceFilter, setSourceFilter] = useState<
    'all' | 'builtin-synth' | 'url' | 'indexeddb'
  >('all');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editCover, setEditCover] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const canModifyCurrentPlaylist =
    playlistSource === 'web'
      ? canEditWebPlaylist
      : Boolean(isLoggedIn && playlistSource === 'personal');

  const filteredTracks =
    sourceFilter === 'all'
      ? playlist
      : playlist.filter((t) => t.sourceType === sourceFilter);

  const effectiveDuration =
    duration > 0 ? duration : currentTrack.duration || 180;

  const playModeLabel =
    playMode === 'repeat-one'
      ? 'Lặp 1 bài'
      : playMode === 'shuffle'
      ? 'Ngẫu nhiên'
      : 'Lặp cả list';

  const startEdit = (track: MusicTrack) => {
    setEditingTrackId(track.id);
    setEditTitle(track.title);
    setEditArtist(track.artist || '');
    setEditCover(track.coverUrl || '');
  };

  const saveEdit = (trackId: string) => {
    if (editTitle.trim()) {
      onUpdateTrack(trackId, {
        title: editTitle.trim(),
        artist: editArtist.trim() || undefined,
        coverUrl: editCover.trim() || undefined,
      });
    }
    setEditingTrackId(null);
  };

  return (
    <div className="space-y-8">
      {/* Tiêu đề Khu Nhạc */}
      <div className="soft-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <span className="sticker-chip text-xs inline-flex items-center gap-1.5">
            <span>🎵 Góc Đĩa Than & Hộp Nhạc</span>
          </span>
          <h1 className="font-serif-title text-2xl sm:text-3xl font-bold text-[var(--text)]">
            <EditableText
              value={
                customTexts['music_tab_title'] ||
                'Khu Nhạc & Playlist Của Góc Nhỏ'
              }
              onSave={(val) =>
                onUpdateCustomText?.('music_tab_title', val)
              }
              editMode={editMode}
            />
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] max-w-2xl leading-relaxed">
            <EditableText
              value={
                customTexts['music_tab_desc'] ||
                'Thưởng thức những giai điệu hộp nhạc êm dịu, dán link MP3 yêu thích hoặc tải file nhạc từ máy của bạn lên để vừa nghe vừa trò chuyện cùng các nhân vật nhé 🌸'
              }
              onSave={(val) =>
                onUpdateCustomText?.('music_tab_desc', val)
              }
              editMode={editMode}
              multiline
            />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isLoggedIn ? (
            <div className="inline-flex p-1 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => onSwitchPlaylistSource('web')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  playlistSource === 'web'
                    ? 'bg-[var(--accent)] text-[#3a2b30]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                🌐 Playlist của Web
              </button>
              <button
                type="button"
                onClick={() => onSwitchPlaylistSource('personal')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  playlistSource === 'personal'
                    ? 'bg-[var(--accent)] text-[#3a2b30]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                💖 Playlist của tôi
              </button>
            </div>
          ) : (
            <div className="px-3.5 py-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] font-bold text-[var(--text)]">
              🌐 Playlist của Web
            </div>
          )}
          <div className="px-3.5 py-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] font-semibold text-[var(--text)]">
            🎶 Tổng số bài: <strong>{playlist.length}</strong>
          </div>
          {canModifyCurrentPlaylist && (
            <button
              type="button"
              onClick={onRestoreBuiltinTracks}
              className="px-3.5 py-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục 4 bài hộp nhạc gốc</span>
            </button>
          )}
        </div>
      </div>

      {/* Bố cục 2 cột: Cột trái (Máy phát đĩa + Thêm nhạc) | Cột phải (Danh sách Playlist) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: Đĩa nhạc đang phát & Khung ➕ Thêm nhạc */}
        <div className="lg:col-span-5 space-y-6">
          {/* Thẻ Đĩa nhạc đang phát */}
          <div className="soft-card p-6 space-y-5 border-2 border-[var(--accent)]/60">
            <div className="flex items-center gap-4">
              <div
                className={`w-20 h-20 rounded-3xl border-2 border-[var(--accent)] bg-[var(--bg)] flex items-center justify-center overflow-hidden shrink-0 shadow-md ${
                  isPlaying ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '10s' }}
              >
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc3 className="w-10 h-10 text-[var(--accent)]" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--accent)]/25 text-[11px] font-bold text-[var(--text)]">
                  {currentTrack.sourceType === 'indexeddb'
                    ? '💾 File từ máy (IndexedDB)'
                    : currentTrack.sourceType === 'url'
                    ? '🔗 Link MP3 trực tiếp'
                    : '🎐 Hộp nhạc Web Audio'}
                </div>
                <h2 className="font-serif-title text-xl font-bold text-[var(--text)] truncate">
                  {currentTrack.title}
                </h2>
                <p className="text-xs text-[var(--muted)] truncate">
                  {currentTrack.artist || 'Giai điệu thư giãn'}
                </p>
              </div>
            </div>

            {/* Thanh tua */}
            <div className="space-y-1.5">
              <input
                type="range"
                min={0}
                max={effectiveDuration}
                step={1}
                value={Math.min(currentTime, effectiveDuration)}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                style={{ accentColor: 'var(--accent)' }}
                className="w-full h-2 bg-[var(--border)] rounded-full appearance-none cursor-pointer"
              />
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
                <span>{formatAudioTime(currentTime)}</span>
                <span>{formatAudioTime(effectiveDuration)}</span>
              </div>
            </div>

            {/* Nút điều khiển chính */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onCyclePlayMode}
                className="px-3 py-1.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] cursor-pointer inline-flex items-center gap-1.5"
              >
                {playMode === 'repeat-one' ? (
                  <Repeat1 className="w-4 h-4 text-[var(--accent)]" />
                ) : playMode === 'shuffle' ? (
                  <Shuffle className="w-4 h-4 text-[var(--accent)]" />
                ) : (
                  <Repeat className="w-4 h-4 text-[var(--accent)]" />
                )}
                <span>{playModeLabel}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPrevTrack}
                  title="Bài trước"
                  className="p-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onTogglePlay}
                  title={isPlaying ? 'Tạm dừng (Phím M)' : 'Phát nhạc (Phím M)'}
                  className="p-3.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold shadow-md bouncy-btn cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onNextTrack}
                  title="Bài sau"
                  className="p-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thanh âm lượng */}
            <div className="flex items-center gap-3 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={onToggleMute}
                className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                style={{ accentColor: 'var(--accent)' }}
                className="flex-1 h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer"
              />
              <span className="text-xs font-bold text-[var(--muted)] w-10 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>

          {/* Khung ➕ Thêm nhạc: Chỉ hiển thị cho Chủ web khi ở Playlist Web, hoặc cho Người dùng đã đăng nhập khi ở Playlist của tôi */}
          {canModifyCurrentPlaylist ? (
            <AddMusicPanel
              onAddTrack={onAddTrack}
              playlistSource={playlistSource}
              canEditWebPlaylist={canEditWebPlaylist}
            />
          ) : isLoggedIn ? (
            <div className="soft-card p-5 space-y-3 text-xs">
              <div className="font-bold text-sm text-[var(--text)] flex items-center gap-1.5">
                <Music className="w-4 h-4 text-[var(--accent)]" />
                <span>🌐 Đang nghe Playlist chung của Web</span>
              </div>
              <p className="text-[var(--muted)] leading-relaxed">
                Playlist của web do Chủ web tuyển chọn để mọi người cùng thưởng thức. Bạn có thể chuyển sang <strong>💖 Playlist của tôi</strong> để tự thêm nhạc yêu thích lưu trên máy của riêng bạn nhé!
              </p>
              <button
                type="button"
                onClick={() => onSwitchPlaylistSource('personal')}
                className="px-4 py-2 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>💖 Mở Playlist của tôi</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* CỘT PHẢI: Danh sách Playlist chi tiết */}
        <div className="lg:col-span-7 soft-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="font-serif-title text-xl font-bold text-[var(--text)]">
                Danh Sách Bài Hát Trong Playlist ({filteredTracks.length})
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {canModifyCurrentPlaylist
                  ? 'Bấm vào bài bất kỳ để phát ngay · Kéo thả hoặc bấm mũi tên để đổi thứ tự, sửa tên bài, ảnh bìa'
                  : 'Bấm vào bài bất kỳ để thưởng thức giai điệu'}
              </p>
            </div>

            {/* Bộ lọc nguồn nhạc */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'builtin-synth', label: '🎐 Hộp nhạc' },
                  { id: 'url', label: '🔗 Link MP3' },
                  ...(playlistSource === 'personal'
                    ? [{ id: 'indexeddb' as const, label: '💾 Từ máy' }]
                    : []),
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSourceFilter(tab.id)}
                  className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-all ${
                    sourceFilter === tab.id
                      ? 'bg-[var(--accent)] text-[#3a2b30]'
                      : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--muted)] space-y-2">
              <p>Chưa có bài nhạc nào trong mục lọc này 🌸</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTracks.map((track) => {
                const idxInFull = playlist.findIndex((t) => t.id === track.id);
                const isCurrent = track.id === currentTrack.id;
                const isEditing = editingTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    draggable={canModifyCurrentPlaylist && !isEditing}
                    onDragStart={() => {
                      if (canModifyCurrentPlaylist) setDragIndex(idxInFull);
                    }}
                    onDragOver={(e) => {
                      if (canModifyCurrentPlaylist) e.preventDefault();
                    }}
                    onDrop={() => {
                      if (
                        canModifyCurrentPlaylist &&
                        dragIndex !== null &&
                        dragIndex !== idxInFull
                      ) {
                        onReorderTracks?.(dragIndex, idxInFull);
                      }
                      setDragIndex(null);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'border-2 border-[var(--accent)] bg-[var(--accent)]/15'
                        : 'border-[var(--border)] bg-[var(--bg)]/60 hover:border-[var(--accent)]/60'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2.5 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                              Tên bài hát
                            </label>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                              Nghệ sĩ / Mô tả ngắn
                            </label>
                            <input
                              type="text"
                              value={editArtist}
                              onChange={(e) => setEditArtist(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                            Link ảnh bìa (tùy chọn)
                          </label>
                          <input
                            type="url"
                            value={editCover}
                            onChange={(e) => setEditCover(e.target.value)}
                            placeholder="https://.../anh-bia.jpg"
                            className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingTrackId(null)}
                            className="px-3.5 py-1.5 rounded-full border border-[var(--border)] text-xs text-[var(--muted)] cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(track.id)}
                            className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[#3a2b30] text-xs font-bold cursor-pointer"
                          >
                            Lưu thay đổi
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onSelectTrack(track.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <div className="w-11 h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center overflow-hidden shrink-0 font-bold text-xs">
                            {track.coverUrl ? (
                              <img
                                src={track.coverUrl}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                            ) : isCurrent && isPlaying ? (
                              <span className="text-base text-[var(--accent)]">
                                ♫
                              </span>
                            ) : (
                              <span className="text-[var(--muted)]">
                                {idxInFull + 1}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[var(--text)] truncate">
                                {track.title}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[#3a2b30] font-bold shrink-0">
                                  {isPlaying ? 'Đang phát' : 'Đang chọn'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--muted)] flex flex-wrap items-center gap-2 mt-0.5">
                              <span>{track.artist || 'Giai điệu Góc Nhỏ'}</span>
                              <span>·</span>
                              <span>
                                {track.sourceType === 'indexeddb'
                                  ? `💾 File từ máy${
                                      track.fileSize
                                        ? ` (${(
                                            track.fileSize /
                                            (1024 * 1024)
                                          ).toFixed(1)}MB)`
                                        : ''
                                    }`
                                  : track.sourceType === 'url'
                                  ? '🔗 Link MP3'
                                  : '🎐 Hộp nhạc mặc định'}
                              </span>
                              {track.duration && (
                                <>
                                  <span>·</span>
                                  <span>{formatAudioTime(track.duration)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>

                        {canModifyCurrentPlaylist && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idxInFull <= 0}
                              onClick={() => onMoveTrack(track.id, 'up')}
                              title="Đưa lên (hoặc kéo thả)"
                              className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idxInFull >= playlist.length - 1}
                              onClick={() => onMoveTrack(track.id, 'down')}
                              title="Đưa xuống (hoặc kéo thả)"
                              className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(track)}
                              title="Sửa tên bài & ảnh bìa"
                              className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {playlist.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onDeleteTrack(track.id)}
                                title="Xóa bài nhạc"
                                className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
