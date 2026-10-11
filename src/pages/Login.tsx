import { friendlyError } from '../lib/errorMessages';
import { useState } from 'react';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isPasskeySupported } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { Shield, Mail, Phone, Lock, Eye, EyeOff, Loader2, Fingerprint } from 'lucide-react';
import clsx from 'clsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const { signIn, signInWithPasskey } = useAuth();
  const { branding } = useSettings();
  const navigate = useNavigate();
  const passkeySupported = isPasskeySupported();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(emailOrPhone, password);

    if (error) {
      setLoading(false);
      if (error.message.includes('Invalid login credentials')) {
        setError('بيانات الدخول غير صحيحة');
      } else if (error.message.includes('User not found')) {
        setError('المستخدم غير موجود');
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول');
      }
    } else {
      navigate('/');
    }
  };

  const handlePasskeySignIn = async () => {
    setError('');
    setPasskeyLoading(true);

    const { error } = await signInWithPasskey();

    if (error) {
      setPasskeyLoading(false);
      setError(`لم يتم التعرف على البصمة: ${friendlyError(error)}`);
    } else {
      navigate('/');
    }
  };

  const isValid = () => {
    const value = emailOrPhone.trim();
    const looksLikeEmail = value.includes('@');
    const looksLikePhone = value.length >= 10 && !looksLikeEmail;
    return (looksLikeEmail || looksLikePhone) && password.length >= 6;
  };

  return (
    <div className="login-shell login-shell-premium relative min-h-screen overflow-hidden bg-secondary-50 flex items-center justify-center p-4 sm:p-6">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-success-100/70 blur-3xl" />
      <div className="login-brand-panel hidden lg:flex">
        <div>
          <div className="login-brand-mark"><Shield className="w-8 h-8" /></div>
          <span className="login-brand-label">CRM INSURANCE</span>
          <h2>إدارة التأمين<br />بوضوح وثقة.</h2>
          <p>مساحة عمل موحّدة لإدارة العملاء والوثائق والتحصيل والتقارير في تجربة هادئة وسريعة.</p>
        </div>
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div
          className={clsx(
            'login-card card border-secondary-100/80 bg-white/95 p-6 shadow-elevated backdrop-blur-sm sm:p-8 animate-fadeIn',
            (loading || googleLoading || passkeyLoading) && 'is-authenticating'
          )}
          aria-busy={loading || googleLoading || passkeyLoading}
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
              {branding.company_logo_url
                ? <img src={branding.company_logo_url} alt={branding.company_name} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                : <Shield className="w-8 h-8 text-primary-600" />}
            </div>
            <h1 className="text-2xl font-bold text-secondary-900 mb-1">
              {branding.company_name}
            </h1>
            <p className="text-secondary-500">سجل دخولك للوصول إلى النظام</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {passkeySupported && (
              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading || loading || googleLoading}
                className="glassy-action flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 transition-colors duration-200 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passkeyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    <span>البصمة</span>
                  </>
                )}
              </button>
            )}

            <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} disabled={googleLoading || loading || passkeyLoading} onBusyChange={setGoogleLoading} onError={setError} />
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-secondary-200"></div>
            <span className="text-xs text-secondary-400">أو</span>
            <div className="flex-1 h-px bg-secondary-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="input-label">البريد الإلكتروني أو رقم الهاتف</label>
              <div className="relative">
                <input
                  type="text"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="example@company.com أو 01xxxxxxxxx"
                  className="input-field pe-10"
                  dir="ltr"
                  required
                />
                {emailOrPhone.includes('@') ? (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                ) : (
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="input-label">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pe-10"
                  dir="ltr"
                  required
                  minLength={6}
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isValid() || loading || googleLoading || passkeyLoading}
              className="btn btn-primary glassy-action glassy-action-primary w-full py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-secondary-500 mt-6">
            نظام محمي بتقنيات أمان متقدمة
          </p>
        </div>

        <p className="text-center text-white/70 text-sm mt-4">
          جميع الحقوق محفوظة &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}