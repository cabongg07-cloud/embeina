/**
 * Hệ thống Nhạc & Playlist cho "Góc Nhỏ Lấp Lánh"
 * - Quản lý danh sách bài hát (Hộp nhạc Web Audio mặc định + Link MP3 trực tiếp + File tải từ máy).
 * - Kiểm tra link MP3 có phát được không trước khi lưu (kèm gợi ý chuyển đổi Google Drive, Dropbox, báo rõ link YouTube không hỗ trợ thẻ <audio>).
 * - Lưu file âm thanh tải từ máy (mp3, m4a, wav, ogg, tối đa ~15MB/file) vào IndexedDB.
 * - Nhớ bài đang phát, vị trí (currentTime), âm lượng (volume) và chế độ phát (repeat-one / repeat-all / shuffle) bằng localStorage (bọc try/catch).
 *
 * GHI CHÚ QUAN TRỌNG VỀ FILE TẢI LÊN:
 * File nhạc tải lên từ máy được lưu bằng IndexedDB (không dùng localStorage vì quá nặng).
 * File tải lên chỉ nằm trên trình duyệt của người đó; sau này khi nâng cấp backend sẽ chuyển sang
 * Supabase Storage / Firebase Storage / Cloud Storage (S3).
 */

import { dataStore } from './dataLayer';

export type PlayMode = 'repeat-all' | 'repeat-one' | 'shuffle';

export type TrackSourceType = 'builtin-synth' | 'url' | 'indexeddb' | 'youtube' | 'spotify';

export type SynthPresetId =
  | 'starlight-box'
  | 'rainy-veranda'
  | 'morning-piano'
  | 'cloud-lullaby';

export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  sourceType: TrackSourceType;
  /** Đường dẫn trực tiếp cho bài nhạc dạng 'url' */
  url?: string;
  /** YouTube video ID */
  youtubeId?: string;
  /** Spotify embed URL */
  spotifyEmbedUrl?: string;
  /** Khóa lưu trữ trong IndexedDB cho bài nhạc tải từ máy ('indexeddb') */
  idbKey?: string;
  /** Giai điệu Web Audio API cho bài nhạc hộp nhạc mặc định ('builtin-synth') */
  synthPreset?: SynthPresetId;
  /** Thời lượng bài hát (giây) */
  duration?: number;
  /** Kích thước file (bytes) nếu tải từ máy */
  fileSize?: number;
  /** Định dạng file (mp3, m4a, wav, ogg) */
  fileExt?: string;
  /** Đánh dấu bài nhạc mặc định của web hay bài cá nhân thêm vào */
  isWebTrack?: boolean;
  createdAt: string;
}

export function parseYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  const shortsMatch = url.match(/\/shorts\/([\w-]{11})/);
  if (shortsMatch && shortsMatch[1]) {
    return shortsMatch[1];
  }
  return null;
}

export function parseSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes('open.spotify.com/embed/')) {
    return url;
  }
  const match = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
  if (match && match[1] && match[2]) {
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`;
  }
  return null;
}

export async function fetchYouTubeTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.title === 'string') {
        return data.title;
      }
    }
  } catch {}
  return `YouTube Video (${videoId})`;
}


export interface PersistedPlayerState {
  currentTrackId: string;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
}

export const PLAYLIST_STORAGE_KEY = 'music_playlist_tracks_v1';
export const PLAYER_STATE_STORAGE_KEY = 'music_player_state_v1';

// Giới hạn kích thước file tải lên: 15MB
export const MAX_AUDIO_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg'];

// Danh sách giai điệu Hộp nhạc Web Audio mặc định để góc nhỏ luôn có nhạc dịu dàng ngay cả khi chưa thêm file MP3 ngoài
export const BUILTIN_SYNTH_TRACKS: MusicTrack[] = [
  {
    id: 'builtin-starlight-box',
    title: 'Hộp Nhạc Đêm Sao',
    artist: 'Hộp nhạc Góc Nhỏ ✨',
    sourceType: 'builtin-synth',
    synthPreset: 'starlight-box',
    duration: 180,
    isWebTrack: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'builtin-rainy-veranda',
    title: 'Hiên Trà Ngày Mưa Nhỏ',
    artist: 'Tiếng mưa & Chuông gió 🌧️',
    sourceType: 'builtin-synth',
    synthPreset: 'rainy-veranda',
    duration: 210,
    isWebTrack: true,
    createdAt: '2026-10-01T00:01:00.000Z',
  },
  {
    id: 'builtin-morning-piano',
    title: 'Khúc Dương Cầm Sớm Mai',
    artist: 'Nắng ấm qua rèm cửa 🌸',
    sourceType: 'builtin-synth',
    synthPreset: 'morning-piano',
    duration: 165,
    isWebTrack: true,
    createdAt: '2026-10-01T00:02:00.000Z',
  },
  {
    id: 'builtin-cloud-lullaby',
    title: 'Lời Ru Giấc Mơ Mây Hồng',
    artist: 'Điệu ru êm dịu 🌙',
    sourceType: 'builtin-synth',
    synthPreset: 'cloud-lullaby',
    duration: 195,
    isWebTrack: true,
    createdAt: '2026-10-01T00:03:00.000Z',
  },
];

// ============================================================================
// LỚP LƯU TRỮ FILE NHẠC TRONG INDEXEDDB (KHÔNG DÙNG LOCALSTORAGE VÌ QUÁ NẶNG)
// GHI CHÚ: File tải lên chỉ nằm trên trình duyệt của người đó, sau này sẽ chuyển
// sang Supabase Storage / Firebase Storage / S3 khi nối backend thật.
// ============================================================================
const IDB_NAME = 'goc_nho_lap_lanh_music_db';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'uploaded_audio_files';

interface StoredAudioRecord {
  idbKey: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

const memoryObjectUrls = new Map<string, string>();

function openMusicDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));
        return;
      }
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME, { keyPath: 'idbKey' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error('Không thể mở IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

export const musicIdbStorage = {
  /**
   * Lưu file nhạc người dùng tải từ máy vào IndexedDB.
   * GHI CHÚ: File tải lên chỉ nằm trên trình duyệt của người đó, sau này sẽ chuyển sang Supabase Storage / Firebase Storage.
   */
  async saveAudioFile(idbKey: string, file: File): Promise<boolean> {
    try {
      const db = await openMusicDatabase();
      return await new Promise<boolean>((resolve) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const record: StoredAudioRecord = {
          idbKey,
          blob: file,
          fileName: file.name,
          mimeType: file.type || 'audio/mpeg',
          size: file.size,
          createdAt: new Date().toISOString(),
        };
        const req = store.put(record);
        req.onsuccess = () => {
          // Tạo sẵn Object URL trong bộ nhớ phiên làm việc
          const prevUrl = memoryObjectUrls.get(idbKey);
          if (prevUrl) {
            URL.revokeObjectURL(prevUrl);
          }
          memoryObjectUrls.set(idbKey, URL.createObjectURL(file));
          resolve(true);
        };
        req.onerror = () => resolve(false);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return false;
    }
  },

  /**
   * Lấy Object URL từ Blob đã lưu trong IndexedDB để gắn vào thẻ <audio>.
   */
  async getAudioObjectUrl(idbKey: string): Promise<string | null> {
    try {
      const cached = memoryObjectUrls.get(idbKey);
      if (cached) {
        return cached;
      }
      const db = await openMusicDatabase();
      return await new Promise<string | null>((resolve) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.get(idbKey);
        req.onsuccess = () => {
          const result = req.result as StoredAudioRecord | undefined;
          if (result && result.blob) {
            const objUrl = URL.createObjectURL(result.blob);
            memoryObjectUrls.set(idbKey, objUrl);
            resolve(objUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return null;
    }
  },

  /**
   * Xóa file nhạc khỏi IndexedDB khi người dùng xóa bài hát khỏi Playlist.
   */
  async deleteAudioFile(idbKey: string): Promise<boolean> {
    try {
      const cached = memoryObjectUrls.get(idbKey);
      if (cached) {
        URL.revokeObjectURL(cached);
        memoryObjectUrls.delete(idbKey);
      }
      const db = await openMusicDatabase();
      return await new Promise<boolean>((resolve) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.delete(idbKey);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return false;
    }
  },
};

// ============================================================================
// KIỂM TRA & CHUẨN HÓA LINK NHẠC MP3 TRỰC TIẾP TRƯỚC KHI LƯU
// ============================================================================
export interface UrlValidationResult {
  ok: boolean;
  normalizedUrl: string;
  duration?: number;
  wasConverted?: boolean;
  conversionNote?: string;
  isYouTube?: boolean;
  errorMessage?: string;
}

/**
 * Tự động nhận diện link YouTube, chuyển đổi hộ link Google Drive / Dropbox nếu cần,
 * và kiểm tra thực tế bằng thẻ Audio xem trình duyệt có phát được không trước khi lưu.
 */
export async function validateAndNormalizeAudioUrl(
  rawUrl: string
): Promise<UrlValidationResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      ok: false,
      normalizedUrl: '',
      errorMessage: 'Bạn ơi, hãy dán đường dẫn (link) bài nhạc vào ô nhé 🌸',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      normalizedUrl: trimmed,
      errorMessage:
        'Đường dẫn chưa đúng định dạng URL (cần bắt đầu bằng https:// hoặc http://).',
    };
  }

  const host = parsed.hostname.toLowerCase();

  // 1. Báo rõ nếu là link YouTube (không phát được bằng thẻ <audio>)
  if (
    host.includes('youtube.com') ||
    host.includes('youtu.be') ||
    host.includes('youtube-nocookie.com')
  ) {
    return {
      ok: false,
      normalizedUrl: trimmed,
      isYouTube: true,
      errorMessage:
        'Link YouTube không phải là file âm thanh trực tiếp nên không thể phát bằng thẻ <audio> của trình duyệt. Bạn hãy tải file .mp3 về máy rồi chọn mục "Tải file từ máy lên", hoặc dán link file .mp3 trực tiếp nhé!',
    };
  }

  let normalizedUrl = trimmed;
  let wasConverted = false;
  let conversionNote: string | undefined;

  // 2. Hỗ trợ chuyển đổi link chia sẻ Google Drive sang dạng uc?export=download&id=...
  if (host.includes('drive.google.com')) {
    const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idParam = parsed.searchParams.get('id');
    const fileId = fileMatch ? fileMatch[1] : idParam;
    if (
      fileId &&
      !trimmed.includes('uc?export=download') &&
      !trimmed.includes('uc?id=')
    ) {
      normalizedUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      wasConverted = true;
      conversionNote =
        'Đã tự động chuyển link Google Drive sang dạng trực tiếp (uc?export=download&id=...)';
    }
  }

  // 3. Hỗ trợ chuyển đổi link Dropbox (?dl=0 -> ?raw=1)
  if (host.includes('dropbox.com')) {
    if (trimmed.includes('?dl=0')) {
      normalizedUrl = trimmed.replace('?dl=0', '?raw=1');
      wasConverted = true;
      conversionNote =
        'Đã tự động đổi đuôi link Dropbox từ ?dl=0 sang ?raw=1 để phát trực tiếp';
    } else if (!trimmed.includes('raw=1') && !trimmed.includes('dl=1')) {
      const sep = trimmed.includes('?') ? '&' : '?';
      normalizedUrl = `${trimmed}${sep}raw=1`;
      wasConverted = true;
      conversionNote = 'Đã thêm ?raw=1 vào link Dropbox để phát trực tiếp';
    }
  }

  // 4. Kiểm tra thực tế xem thẻ <audio> có tải được metadata / phát được không
  const testResult = await testAudioPlayable(normalizedUrl);
  if (!testResult.playable) {
    return {
      ok: false,
      normalizedUrl,
      wasConverted,
      conversionNote,
      errorMessage:
        'Ôi, trình duyệt chưa phát được link này rồi 💌 Gợi ý nhỏ cho bạn:\n' +
        '• Link cần trỏ trực tiếp tới file âm thanh (.mp3, .m4a, .wav, .ogg).\n' +
        '• Google Drive: Mở quyền "Bất kỳ ai có liên kết" và đổi thành dạng https://drive.google.com/uc?export=download&id=MÃ_FILE\n' +
        '• Dropbox: Đổi đuôi ?dl=0 ở cuối link thành ?raw=1\n' +
        '• Link YouTube không phát được bằng thẻ audio (hãy dùng mục Tải file từ máy lên nhé!).',
    };
  }

  return {
    ok: true,
    normalizedUrl,
    duration: testResult.duration,
    wasConverted,
    conversionNote,
  };
}

function testAudioPlayable(
  url: string,
  timeoutMs = 7500
): Promise<{ playable: boolean; duration?: number }> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      let settled = false;

      const finish = (playable: boolean, duration?: number) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        try {
          audio.onloadedmetadata = null;
          audio.oncanplay = null;
          audio.onerror = null;
          audio.src = '';
          audio.load();
        } catch {
          // Ignore cleanup errors
        }
        resolve({ playable, duration });
      };

      const timer = window.setTimeout(() => {
        finish(false);
      }, timeoutMs);

      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        const dur =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration)
            : undefined;
        finish(true, dur);
      };

      audio.oncanplay = () => {
        const dur =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration)
            : undefined;
        finish(true, dur);
      };

      audio.onerror = () => {
        finish(false);
      };

      audio.src = url;
      audio.load();
    } catch {
      resolve({ playable: false });
    }
  });
}

// ============================================================================
// QUẢN LÝ DANH SÁCH PLAYLIST & TRẠNG THÁI TRÌNH PHÁT TRONG LOCALSTORAGE (TRY/CATCH)
// ============================================================================
export function inferTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    const cleaned = lastSegment
      .replace(/\.(mp3|m4a|wav|ogg)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return cleaned || 'Giai Điệu Mới';
  } catch {
    return 'Giai Điệu Mới';
  }
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getSavedPlaylist(
  externalUrls: string[] = []
): MusicTrack[] {
  try {
    const saved = dataStore.get<MusicTrack[] | null>(
      PLAYLIST_STORAGE_KEY,
      null
    );
    let list: MusicTrack[] =
      Array.isArray(saved) && saved.length > 0
        ? [...saved]
        : [...BUILTIN_SYNTH_TRACKS];

    // Đảm bảo các giai điệu hộp nhạc mặc định luôn có mặt nếu người dùng chưa xóa hết
    const existingIds = new Set(list.map((t) => t.id));
    if (list.length === 0) {
      list = [...BUILTIN_SYNTH_TRACKS];
    }

    // Đồng bộ các URL từ hằng số MUSIC_URLS hoặc siteConfig.musicUrls
    const existingUrls = new Set(
      list.filter((t) => t.sourceType === 'url' && t.url).map((t) => t.url!)
    );

    let changed = false;
    externalUrls.forEach((rawUrl, index) => {
      const clean = rawUrl.trim();
      if (clean && !existingUrls.has(clean)) {
        const id = `url-sync-${index}-${ clean.slice(-10).replace(/[^a-zA-Z0-9]/g, '') }`;
        if (!existingIds.has(id)) {
          list.unshift({
            id,
            title: inferTitleFromUrl(clean),
            artist: 'Nhạc nền Góc Nhỏ 🎵',
            sourceType: 'url',
            url: clean,
            isWebTrack: true,
            createdAt: new Date().toISOString(),
          });
          existingUrls.add(clean);
          changed = true;
        }
      }
    });

    if (!saved || changed) {
      dataStore.set(PLAYLIST_STORAGE_KEY, list);
    }
    return list;
  } catch {
    return [...BUILTIN_SYNTH_TRACKS];
  }
}

export function savePlaylist(tracks: MusicTrack[]): void {
  try {
    dataStore.set(PLAYLIST_STORAGE_KEY, tracks);
  } catch {
    // Ignore storage error
  }
}

export function getSavedPlayerState(
  defaultTrackId = BUILTIN_SYNTH_TRACKS[0].id
): PersistedPlayerState {
  const fallback: PersistedPlayerState = {
    currentTrackId: defaultTrackId,
    currentTime: 0,
    volume: 0.45,
    isMuted: false,
    playMode: 'repeat-all',
  };
  try {
    const saved = dataStore.get<Partial<PersistedPlayerState> | null>(
      PLAYER_STATE_STORAGE_KEY,
      null
    );
    if (!saved || typeof saved !== 'object') {
      return fallback;
    }
    return {
      currentTrackId:
        typeof saved.currentTrackId === 'string' && saved.currentTrackId
          ? saved.currentTrackId
          : fallback.currentTrackId,
      currentTime:
        typeof saved.currentTime === 'number' &&
        Number.isFinite(saved.currentTime) &&
        saved.currentTime >= 0
          ? saved.currentTime
          : 0,
      volume:
        typeof saved.volume === 'number' &&
        Number.isFinite(saved.volume) &&
        saved.volume >= 0 &&
        saved.volume <= 1
          ? saved.volume
          : fallback.volume,
      isMuted: Boolean(saved.isMuted),
      playMode:
        saved.playMode === 'repeat-one' ||
        saved.playMode === 'repeat-all' ||
        saved.playMode === 'shuffle'
          ? saved.playMode
          : 'repeat-all',
    };
  } catch {
    return fallback;
  }
}

export function savePlayerState(patch: Partial<PersistedPlayerState>): void {
  try {
    const current = getSavedPlayerState();
    const next: PersistedPlayerState = {
      ...current,
      ...patch,
    };
    dataStore.set(PLAYER_STATE_STORAGE_KEY, next);
  } catch {
    // Ignore storage error
  }
}

declare global {
  interface Window {
    YT?: any;
    ytPlayerInstance?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

