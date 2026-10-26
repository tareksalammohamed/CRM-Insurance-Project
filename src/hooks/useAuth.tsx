import { confirmQueuedSignOut } from '../lib/confirmQueuedSignOut';
import { useNotify } from '../lib/notify';
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { supabase, User, WEBAUTHN_FUNCTIONS_URL } from '../lib/supabase';
import { clearAllDataCache, setDataCacheIdentity } from '../lib/dataCache';
import { clearAllQueueItems } from '../lib/offlineQueue';
import { dalRead } from '../lib/dataAccessLayer';
import { getErrorName } from '../lib/errorMessages';
import { queryClient } from '../lib/queryClient';
import { stopOfflineSync } from '../lib/offlineSync';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  authUser: AuthUser | null;
  loading: boolean;
  authError: string | null;
  signIn: (emailOrPhone: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  registerPasskey: () => Promise<{ error: Error | null }>;
  signInWithPasskey: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const signingOut = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // مرجع حي لهوية المستخدم الحالي — بيتحدّث فوراً (بعكس الـ state) عشان
  // onAuthStateChange (اللي بيتسجل مرة واحدة بس عند mount) يقدر يعرف هل
  // الحدث ده لنفس المستخدم أو لمستخدم مختلف فعلاً
  const currentUserIdRef = useRef<string | null>(null);
  const authRevision = useRef(0);

  // ملحوظة: هذه القراءة تمر من DAL عمداً (بعكس ما كانت عليه قبل الإصلاح) —
  // بدونها، أي إعادة فتح للتطبيق أثناء انقطاع الإنترنت كانت ترجّع "null"
  // بصمت (فشل شبكة)، فيعتبر App.tsx المستخدم غير مسجل دخوله ويعرض شاشة
  // تسجيل الدخول رغم وجود جلسة صالحة فعلاً (وبالتالي توقف المزامنة كمان
  // لأنها بتعتمد على وجود user.id). دلوقتي: لو فيه نسخة محفوظة من نفس
  // البروفايل، بيتم استخدامها بدل ما يُعتبر المستخدم خرج من النظام.
  const fetchUserProfile = async (userId: string) => {
    const result = await dalRead<User | null>(
      `auth:profile:${userId}`,
      async () => {
        const { data, error } = await supabase.rpc('get_my_profile');

        if (error) throw error;
        return ((data as User[] | null) ?? [])[0] ?? null;
      },
      { emptyValue: null as User | null },
    );
    if (result.errorMessage && result.status === 'error') {
      console.error('Error fetching user profile:', result.errorMessage);
    }
    return result.data;
  };

  const refreshUser = async () => {
    const userId = currentUserIdRef.current;
    const revision = authRevision.current;
    if (!userId) return;
    if (!user) setLoading(true);
    try {
      const profile = await fetchUserProfile(userId);
      if (revision !== authRevision.current || currentUserIdRef.current !== userId) return;
      setUser(profile);
      setAuthError(profile ? null : 'تعذر تحميل بيانات حسابك. تحقق من الاتصال ثم أعد المحاولة.');
    } catch {
      if (revision === authRevision.current) setAuthError('تعذر تحميل بيانات حسابك. أعد المحاولة.');
    } finally { if (revision === authRevision.current) setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let lastLoginUpdatedFor: string | null = null;

    const adoptSession = (next: Session | null) => {
      const nextId = next?.user.id ?? null;
      if (nextId !== currentUserIdRef.current) {
        stopOfflineSync();
        queryClient.clear();
        setUser(null);
        setLoading(!!nextId);
      }
      setAuthError(null);
      currentUserIdRef.current = nextId;
      setDataCacheIdentity(nextId);
      setSession(next);
      setAuthUser(next?.user ?? null);
    };
    const loadProfile = async (next: Session | null, revision: number) => {
      try {
        if (!next?.user) return;
        const profile = await fetchUserProfile(next.user.id);
        if (!active || revision !== authRevision.current) return;
        setUser(profile);
        setAuthError(profile ? null : 'تعذر تحميل بيانات حسابك. تحقق من الاتصال ثم أعد المحاولة.');
        if (profile && lastLoginUpdatedFor !== next.user.id) {
          lastLoginUpdatedFor = next.user.id;
          // Secondary write never blocks entering the application.
          void supabase.from('users').update({ last_login: new Date().toISOString() })
            .eq('id', next.user.id).then(({ error }) => {
              if (error) console.error('Error updating last_login:', error);
            });
        }
      } catch (error) {
        console.error('Error loading auth profile:', error);
        if (active && revision === authRevision.current) setAuthError('تعذر تحميل بيانات حسابك. أعد المحاولة.');
      }
      finally { if (active && revision === authRevision.current) setLoading(false); }
    };

    // INITIAL_SESSION normally wins. The getSession fallback is discarded if
    // any newer auth event arrived, so sign-out cannot resurrect an old profile.
    const bootstrapRevision = authRevision.current;
    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!active || bootstrapRevision !== authRevision.current) return;
      const revision = ++authRevision.current;
      adoptSession(initial);
      void loadProfile(initial, revision);
    }).catch((error: unknown) => {
      if (active && bootstrapRevision === authRevision.current) setLoading(false);
      console.error('Error bootstrapping auth session:', error);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      const sameIdentity = (next?.user.id ?? null) === currentUserIdRef.current;
      if (event === 'TOKEN_REFRESHED' && sameIdentity) {
        setSession(next);
        setAuthUser(next?.user ?? null);
        return;
      }
      const revision = ++authRevision.current;
      adoptSession(next);
      // Keep database calls outside Supabase's internal auth lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (active && revision === authRevision.current) void loadProfile(next, revision);
      }, 0);
      timers.add(timer);
    });
    return () => {
      active = false;
      authRevision.current += 1;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (emailOrPhone: string, password: string) => {
    const trimmed = emailOrPhone.trim();
    const isEmail = trimmed.includes('@');

    let emailToUse = trimmed;

    if (!isEmail) {
      // إدخال رقم هاتف: نبحث عن البريد الإلكتروني المرتبط به عبر دالة آمنة في قاعدة البيانات،
      // ثم نكمل تسجيل الدخول بالبريد الإلكتروني كالمعتاد (بدون OTP وبدون تغيير نظام المصادقة)
      const { data: resolvedEmail, error: lookupError } = await supabase
        .rpc('get_email_by_phone', { p_phone: trimmed });

      if (lookupError || !resolvedEmail) {
        return { error: new Error('Invalid login credentials') };
      }
      emailToUse = resolvedEmail as string;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password
    });

    return { error };
  };

  // تسجيل بصمة/بيانات جهاز جديدة للمستخدم الحالي (لازم يكون مسجل دخول الأول
  // بكلمة السر مرة واحدة قبل ما يقدر يضيف بصمة)
  const registerPasskey = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        return { error: new Error('لازم تسجل دخول الأول') };
      }

      // 1) نجيب options التسجيل من الـ Edge Function
      const optionsRes = await fetch(`${WEBAUTHN_FUNCTIONS_URL}/webauthn-register-options`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        // التفاصيل التقنية تتسجل هنا فقط للمطور، والمستخدم يشوف رسالة عربية واضحة
        console.error('[registerPasskey/OPTIONS]', options);
        return { error: new Error('تعذر بدء تسجيل البصمة') };
      }

      // 2) نطلب من المتصفح إنشاء بيانات اعتماد WebAuthn (بصمة/Face ID)
      let attestationResponse;
      try {
        attestationResponse = await startRegistration({ optionsJSON: options });
      } catch (startErr: unknown) {
        console.error('startRegistration failed. options was:', options, startErr);
        return { error: new Error('تعذر إنشاء بيانات البصمة على هذا الجهاز') };
      }

      // 3) نبعت النتيجة للـ Edge Function عشان تتحقق منها وتحفظها
      const verifyRes = await fetch(`${WEBAUTHN_FUNCTIONS_URL}/webauthn-register-verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attestationResponse,
          deviceLabel: navigator.userAgent
        })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        console.error('[registerPasskey/VERIFY]', verifyData);
        return { error: new Error('تعذر تسجيل البصمة، حاول مرة أخرى') };
      }

      return { error: null };
    } catch (err: unknown) {
      if (getErrorName(err) === 'NotAllowedError') {
        return { error: new Error('تم إلغاء العملية أو رفض الإذن') };
      }
      console.error('[registerPasskey/OTHER]', err);
      return { error: new Error('حدث خطأ غير متوقع أثناء تسجيل البصمة') };
    }
  };

  // تسجيل الدخول بالبصمة (Face ID / Touch ID / بصمة الجهاز) بدون إيميل أو باسورد
  const signInWithPasskey = async () => {
    try {
      // 1) نجيب options الدخول من الـ Edge Function (بدون الحاجة لمعرفة هوية المستخدم مسبقًا)
      const optionsRes = await fetch(`${WEBAUTHN_FUNCTIONS_URL}/webauthn-auth-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        console.error('[signInWithPasskey/OPTIONS]', options);
        return { error: new Error('تعذر بدء الدخول بالبصمة') };
      }

      // 2) نطلب من المتصفح تأكيد الهوية عبر البصمة/Face ID
      let assertionResponse;
      try {
        assertionResponse = await startAuthentication({ optionsJSON: options });
      } catch (startErr: unknown) {
        if (getErrorName(startErr) === 'NotAllowedError') {
          return { error: new Error('تم إلغاء العملية أو رفض الإذن') };
        }
        console.error('[signInWithPasskey/START]', startErr);
        return { error: new Error('تعذر تأكيد الهوية عبر البصمة') };
      }

      // 3) نبعت النتيجة للـ Edge Function عشان تتحقق وتنشئ جلسة دخول حقيقية
      const verifyRes = await fetch(`${WEBAUTHN_FUNCTIONS_URL}/webauthn-auth-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assertionResponse })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        console.error('[signInWithPasskey/VERIFY]', verifyData);
        return { error: new Error('لم يتم التعرف على البصمة، حاول مرة أخرى') };
      }

      // 4) نكمل تسجيل الدخول فعليًا في العميل باستخدام الـ token اللي رجع من السيرفر
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: verifyData.token_hash,
        type: 'email'
      });

      if (otpError) {
        console.error('[signInWithPasskey/OTP]', otpError);
        return { error: new Error('تعذر إتمام تسجيل الدخول بالبصمة') };
      }

      return { error: null };
    } catch (err: unknown) {
      if (getErrorName(err) === 'NotAllowedError') {
        return { error: new Error('تم إلغاء العملية أو رفض الإذن') };
      }
      console.error('[signInWithPasskey/OTHER]', err);
      return { error: new Error('حدث خطأ غير متوقع أثناء الدخول بالبصمة') };
    }
  };

  const signOut = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    const identity = currentUserIdRef.current;
    try {
      if (identity && !await confirmQueuedSignOut(identity, notify.confirm)) return;
      if (identity !== currentUserIdRef.current) return;
    } catch {
      notify.error('تعذر فحص العمليات غير المتزامنة؛ أعد المحاولة قبل تسجيل الخروج.');
      return;
    } finally {
      signingOut.current = false;
    }
    signingOut.current = true;
    // Invalidate pending profile reads before awaiting network sign-out.
    authRevision.current += 1;
    stopOfflineSync();
    setDataCacheIdentity(null);
    queryClient.clear();
    currentUserIdRef.current = null;
    setSession(null);
    setAuthUser(null);
    setUser(null);
    setLoading(false);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Error signing out:', error);
    } finally {
      try { await Promise.all([clearAllDataCache(), clearAllQueueItems()]); } finally { signingOut.current = false; }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        authUser,
        loading,
        authError,
        signIn,
        signOut,
        refreshUser,
        registerPasskey,
        signInWithPasskey
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
