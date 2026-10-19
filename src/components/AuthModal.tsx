import React, { useState } from 'react';
import { Sparkles, X, Mail, Lock, User, KeyRound } from 'lucide-react';
import { authService, AuthUser } from '../services/authLayer';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptReason?: string | null;
  onAuthSuccess: (user: AuthUser, message: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  promptReason,
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot'>(
    'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState<'user' | 'creator'>('user');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    const res = await authService.signIn({ email, password });
    setPassword('');
    onAuthSuccess(res.user, res.message);
    onClose();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !displayName.trim()) return;
    const res = await authService.signUp({
      email,
      password,
      displayName,
      accountType,
    });
    setPassword('');
    onAuthSuccess(res.user, res.message);
    onClose();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const msg = await authService.requestPasswordReset(email);
    setFeedback(msg);
  };

  const handleContinueAsGuest = async () => {
    await authService.signOut();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-6 sm:p-8 space-y-5 accent-glow-strong relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp thoại"
          className="absolute top-5 right-5 p-2 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lời mời dễ thương khi Khách bấm vào tính năng cần tài khoản */}
        <div className="text-center space-y-2 pt-1">
          <span className="sticker-chip text-xs inline-flex items-center gap-1">
            <span>🌸 Góc Nhỏ Lấp Lánh</span>
          </span>
          <h2 className="font-serif-title text-2xl sm:text-3xl font-bold text-[var(--text)]">
            {promptReason
              ? 'Mời bạn đăng nhập nhé!'
              : activeTab === 'signin'
              ? 'Chào mừng bạn quay lại'
              : activeTab === 'signup'
              ? 'Tạo sổ tay mới'
              : 'Quên mật khẩu'}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            {promptReason ||
              'Đăng nhập để thả tim nhân vật, lưu ghi chú riêng, trồng hoa nhận quà và gửi lời yêu thương nhé 💌'}
          </p>
        </div>

        {/* Chuyển tab Đăng nhập / Đăng ký */}
        {activeTab !== 'forgot' && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-[var(--bg)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setFeedback(null);
              }}
              className={`py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-[var(--accent)] text-[#3a2b30] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              ✨ Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setFeedback(null);
              }}
              className={`py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-[var(--accent)] text-[#3a2b30] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              🌸 Đăng ký
            </button>
          </div>
        )}

        {/* Form Đăng nhập */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>Email của bạn</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban.nho@example.com"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Mật khẩu</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('forgot');
                    setFeedback(null);
                  }}
                  className="text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full text-xs sm:text-sm font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Bước vào tài khoản</span>
            </button>
          </form>
        )}

        {/* Form Đăng ký */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Tên hiển thị đáng yêu</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ví dụ: Miên Miên, Thỏ Ngọc..."
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban.nho@example.com"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Mật khẩu</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự..."
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Chọn vai trò khi đăng ký */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Bạn muốn tham gia với vai trò nào?
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAccountType('user')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    accountType === 'user'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)] font-bold'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]'
                  }`}
                >
                  <div className="text-xs">🌸 Tôi là người dùng</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Trò chuyện, sưu tầm & chơi mini game
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('creator')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    accountType === 'creator'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)] font-bold'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]'
                  }`}
                >
                  <div className="text-xs">✨ Tôi là creator</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Đăng char, mở comm (chờ duyệt)
                  </div>
                </button>
              </div>

              {accountType === 'creator' && (
                <p className="text-[11px] text-[var(--muted)] bg-[var(--bg)] p-2.5 rounded-xl border border-[var(--border)]">
                  💡 Tài khoản Creator mới sẽ ở trạng thái <strong>“Chờ duyệt”</strong> cho đến khi chủ web duyệt. Trong lúc chờ, bạn vẫn dùng được mọi tính năng như Người dùng nhé!
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full text-xs sm:text-sm font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Hoàn tất đăng ký</span>
            </button>
          </form>
        )}

        {/* Form Quên mật khẩu */}
        {activeTab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Nhập email đã đăng ký</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban.nho@example.com"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {feedback && (
              <p className="text-xs text-[var(--text)] bg-[var(--accent)]/20 p-3 rounded-2xl border border-[var(--accent)]">
                {feedback}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setFeedback(null);
                }}
                className="px-4 py-2.5 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                ← Quay lại
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer"
              >
                Gửi hướng dẫn đặt lại
              </button>
            </div>
          </form>
        )}

        {/* Nút Tiếp tục với tư cách khách & Ghi chú bảo mật bản thử */}
        <div className="pt-3 border-t border-[var(--border)] flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            onClick={handleContinueAsGuest}
            className="w-full py-2 rounded-full text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] bg-[var(--bg)] cursor-pointer"
          >
            🌱 Tiếp tục với tư cách khách (Chỉ xem)
          </button>

          <p className="text-[11px] text-[var(--muted)]/80">
            🔒 Lưu ý bản thử: Ứng dụng không bao giờ lưu mật khẩu dạng chữ thường trong localStorage (chỉ lưu tên hiển thị và vai trò giả lập).
          </p>
        </div>
      </div>
    </div>
  );
};
