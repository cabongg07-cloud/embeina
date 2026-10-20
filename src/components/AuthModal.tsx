import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Mail,
  Lock,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
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

  // Đăng nhập
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Đăng ký
  const [signupEmail, setSignupEmail] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Kiểm tra username_available realtime khi gõ
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    valid: boolean;
    available: boolean;
    reason?: string;
  } | null>(null);

  // Quên mật khẩu
  const [forgotInput, setForgotInput] = useState('');

  // Trạng thái chung
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Debounce kiểm tra username_available trên Supabase khi gõ ở tab Đăng ký
  useEffect(() => {
    if (activeTab !== 'signup') return;
    const raw = signupUsername.trim().toLowerCase();
    if (!raw) {
      setUsernameStatus(null);
      setCheckingUsername(false);
      return;
    }

    if (!/^[a-z0-9_.]{3,20}$/.test(raw)) {
      setCheckingUsername(false);
      setUsernameStatus({
        valid: false,
        available: false,
        reason:
          'Tên tài khoản cần từ 3–20 ký tự, chỉ gồm a-z, 0-9, dấu _ hoặc dấu .',
      });
      return;
    }

    let cancelled = false;
    setCheckingUsername(true);
    const timer = window.setTimeout(async () => {
      const res = await authService.checkUsernameAvailable(raw);
      if (!cancelled) {
        setCheckingUsername(false);
        setUsernameStatus(res);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signupUsername, activeTab]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Tên tài khoản hoặc mật khẩu chưa đúng nhé');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.signIn({
        identifier: loginIdentifier,
        password: loginPassword,
      });
      setLoginPassword('');
      onAuthSuccess(res.user, res.message);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Tên tài khoản hoặc mật khẩu chưa đúng nhé'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    const cleanMail = signupEmail.trim().toLowerCase();
    const cleanUser = signupUsername.trim().toLowerCase();

    if (!cleanMail.endsWith('@gmail.com') || cleanMail.length <= 10) {
      setErrorMsg('Gmail đăng ký phải có đuôi @gmail.com nhé 🌸');
      return;
    }
    if (!/^[a-z0-9_.]{3,20}$/.test(cleanUser)) {
      setErrorMsg(
        'Tên tài khoản phải từ 3–20 ký tự (chỉ dùng a-z, 0-9, _ hoặc .) nhé 🌸'
      );
      return;
    }
    if (signupPassword.length < 8) {
      setErrorMsg('Mật khẩu phải có từ 8 ký tự trở lên nhé 🔒');
      return;
    }
    if (usernameStatus && !usernameStatus.available) {
      setErrorMsg(
        usernameStatus.reason || 'Tên tài khoản này đã có người dùng rồi nhé 🌸'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.signUp({
        email: cleanMail,
        username: cleanUser,
        password: signupPassword,
      });
      setSignupPassword('');
      onAuthSuccess(res.user, res.message);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể đăng ký lúc này, bạn vui lòng thử lại nhé.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);
    if (!forgotInput.trim()) return;

    setSubmitting(true);
    try {
      const msg = await authService.requestPasswordReset(forgotInput);
      setFeedback(msg);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể gửi yêu cầu khôi phục mật khẩu lúc này.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueAsGuest = async () => {
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-6 sm:p-8 space-y-5 accent-glow-strong relative max-h-[92vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp thoại"
          className="absolute top-5 right-5 p-2 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tiêu đề & lời mời dễ thương */}
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
              ? 'Tạo tài khoản mới'
              : 'Quên mật khẩu'}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            {promptReason ||
              'Đăng nhập để mở Gacha mỗi ngày, mở khóa nhân vật, lưu ghi chú riêng và gửi lời yêu thương nhé 💌'}
          </p>
        </div>

        {/* Chuyển tab Đăng nhập / Đăng ký */}
        {activeTab !== 'forgot' && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-[var(--bg)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setErrorMsg(null);
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
                setErrorMsg(null);
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

        {errorMsg && (
          <div className="p-3 rounded-2xl border border-rose-400/50 bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {feedback && (
          <div className="p-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/20 text-xs font-semibold text-[var(--text)]">
            {feedback}
          </div>
        )}

        {/* Form Đăng nhập */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Tên tài khoản (hoặc Gmail)</span>
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Nhập tên tài khoản hoặc Gmail..."
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
                    setErrorMsg(null);
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
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-full text-xs sm:text-sm font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{submitting ? 'Đang đăng nhập...' : 'Bước vào tài khoản'}</span>
            </button>
          </form>
        )}

        {/* Form Đăng ký */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>Gmail của bạn (bắt buộc @gmail.com)</span>
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="ten.cua.ban@gmail.com"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Tên tài khoản (3–20 ký tự a-z, 0-9, _ hoặc .)</span>
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={signupUsername}
                onChange={(e) =>
                  setSignupUsername(e.target.value.toLowerCase())
                }
                placeholder="vd: mien_mien.07"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              {checkingUsername && (
                <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 pt-0.5">
                  <Loader2 className="w-3 h-3 animate-spin text-[var(--accent)]" />
                  <span>Đang kiểm tra tên tài khoản...</span>
                </div>
              )}
              {!checkingUsername && usernameStatus && (
                <div
                  className={`text-[11px] flex items-center gap-1.5 pt-0.5 font-semibold ${
                    usernameStatus.available
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-300'
                  }`}
                >
                  {usernameStatus.available ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{usernameStatus.reason}</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Mật khẩu (tối thiểu 8 ký tự)</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự..."
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || checkingUsername}
              className="w-full py-3 rounded-full text-xs sm:text-sm font-bold bg-[var(--accent)] text-[#3a2b30] bouncy-btn cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{submitting ? 'Đang tạo tài khoản...' : 'Hoàn tất đăng ký'}</span>
            </button>
          </form>
        )}

        {/* Form Quên mật khẩu */}
        {activeTab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Nhập Gmail hoặc Tên tài khoản đã đăng ký</span>
              </label>
              <input
                type="text"
                required
                value={forgotInput}
                onChange={(e) => setForgotInput(e.target.value)}
                placeholder="ten.cua.ban@gmail.com hoặc username"
                className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setErrorMsg(null);
                  setFeedback(null);
                }}
                className="px-4 py-2.5 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                ← Quay lại
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[#3a2b30] cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Đang gửi...' : 'Gửi hướng dẫn đặt lại'}
              </button>
            </div>
          </form>
        )}

        {/* Nút Tiếp tục với tư cách khách */}
        <div className="pt-3 border-t border-[var(--border)] flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            onClick={handleContinueAsGuest}
            className="w-full py-2 rounded-full text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] bg-[var(--bg)] cursor-pointer"
          >
            🌱 Tiếp tục với tư cách khách (Chỉ xem)
          </button>
        </div>
      </div>
    </div>
  );
};
