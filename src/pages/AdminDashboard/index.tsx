import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Bot, Building2, CheckCircle2, Clock3, CreditCard, History, RefreshCw, Settings2, ShieldCheck, Sparkles, UserCog, UsersRound } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../hooks/useAuth';
import { friendlyError } from '../../lib/errorMessages';
import { fetchAdminDashboard, type AdminDashboardData } from './adminDashboardService';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ar-EG');
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

const ACTION_LABELS: Record<string, string> = {
  login: 'تسجيل دخول', logout: 'تسجيل خروج', user_create: 'إنشاء مستخدم',
  user_update: 'تعديل مستخدم', user_delete: 'حذف مستخدم', user_transfer: 'نقل مستخدم',
  user_disable: 'تعطيل مستخدم', user_enable: 'تفعيل مستخدم', settings_update: 'تعديل إعدادات',
  role_update: 'تعديل صلاحية', target_update: 'تعديل هدف', policy_create: 'إصدار وثيقة',
  payment_create: 'تسجيل سداد', payment_cancel: 'إلغاء سداد', month_close: 'إقفال شهر', month_open: 'فتح شهر',
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);
    try { setData(await fetchAdminDashboard()); }
    catch (err) { setError(friendlyError(err, 'تعذر تحميل لوحة إدارة النظام')); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const aiProviders = data?.health?.ai.providers ?? [];
  const enabledAi = aiProviders.filter((p) => p.enabled);
  const healthyAi = enabledAi.filter((p) => p.status === 'active');
  const coolingAi = enabledAi.filter((p) => p.runtime.cooldown_until && new Date(p.runtime.cooldown_until).getTime() > Date.now());
  const failedCron = data?.health?.cron.filter((job) => job.active && job.last_run && job.last_run.status !== 'succeeded') ?? [];

  const systemStatus = useMemo(() => {
    if (!data) return { label: 'جاري الفحص', ok: true };
    const ok = !!data.health && data.health.database.status === 'healthy' && failedCron.length === 0 && healthyAi.length === enabledAi.length;
    return { label: ok ? 'النظام يعمل بصورة طبيعية' : 'يوجد عنصر يحتاج مراجعة', ok };
  }, [data, failedCron.length, healthyAi.length, enabledAi.length]);

  if (loading && !data) return (
    <div className="space-y-5">
      <div className="h-36 skeleton-bar rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <div key={i} className="h-32 skeleton-bar rounded-2xl" />)}
      </div>
      <div className="h-64 skeleton-bar rounded-2xl" />
    </div>
  );

  return (
    <div className="workspace-page admin-dashboard-page space-y-6 animate-fadeIn">
      <section className="admin-control-hero">
        <div className="admin-control-hero__glow" aria-hidden="true" />
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-[0.18em] text-primary-100/80">SYSTEM CONTROL CENTER</p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black text-white">إدارة المنظومة</h1>
            <p className="mt-2 max-w-2xl text-sm text-primary-50/80 leading-6">
              أهلاً {user?.name || 'مدير النظام'} — هذه اللوحة مخصصة لإدارة المنصة ومتابعة جاهزيتها، وليست لمتابعة العمليات التأمينية اليومية.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className={clsx('inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold backdrop-blur-md', systemStatus.ok ? 'border-success-300/20 bg-success-400/10 text-success-100' : 'border-warning-300/25 bg-warning-400/10 text-warning-100')}>
              {systemStatus.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {systemStatus.label}
            </div>
            <button onClick={() => load(true)} disabled={refreshing} className="admin-control-refresh">
              <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} /> {refreshing ? 'جاري التحديث...' : 'تحديث'}
            </button>
          </div>
        </div>
      </section>

      {error && <div className="card border-error-200 bg-error-50 text-error-700 flex items-start gap-2"><AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" /><span>{error}</span></div>}
      {data && data.warnings.length > 0 && (
        <div className="card border-warning-200 bg-warning-50/60 text-warning-800 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">تم تحميل لوحة الإدارة مع بعض البيانات غير المتاحة مؤقتًا</p>
            <p className="text-sm mt-1">الأجزاء المتأثرة: {data.warnings.join('، ')}</p>
          </div>
        </div>
      )}

      {data && <>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <button onClick={() => navigate('/users')} className="admin-overview-card text-right">
            <div className="flex items-center justify-between gap-3"><div className="admin-overview-icon"><UsersRound className="w-5 h-5" /></div><span className="admin-overview-link">إدارة المستخدمين</span></div>
            <p className="mt-5 text-3xl font-black text-secondary-900">{formatNumber(data.users.total)}</p>
            <p className="mt-1 text-sm text-secondary-500">{formatNumber(data.users.active)} نشط · {formatNumber(data.users.inactive)} غير نشط</p>
          </button>
          <button onClick={() => navigate('/branches')} className="admin-overview-card text-right">
            <div className="flex items-center justify-between gap-3"><div className="admin-overview-icon"><Building2 className="w-5 h-5" /></div><span className="admin-overview-link">إدارة الفروع</span></div>
            <p className="mt-5 text-3xl font-black text-secondary-900">{formatNumber(data.branches.total)}</p>
            <p className="mt-1 text-sm text-secondary-500">{formatNumber(data.branches.active)} فرع نشط</p>
          </button>
          <button onClick={() => navigate('/subscriptions-admin')} className="admin-overview-card text-right">
            <div className="flex items-center justify-between gap-3"><div className="admin-overview-icon"><CreditCard className="w-5 h-5" /></div><span className="admin-overview-link">الاشتراكات</span></div>
            <p className="mt-5 text-3xl font-black text-secondary-900">{formatNumber(data.subscriptions.active)}</p>
            <p className="mt-1 text-sm text-secondary-500">{formatNumber(data.subscriptions.pendingPayments)} طلب دفع ينتظر المراجعة</p>
          </button>
          <button onClick={() => navigate('/system-health')} className="admin-overview-card text-right">
            <div className="flex items-center justify-between gap-3"><div className="admin-overview-icon"><Bot className="w-5 h-5" /></div><span className="admin-overview-link">صحة الذكاء الاصطناعي</span></div>
            <p className="mt-5 text-3xl font-black text-secondary-900">{healthyAi.length}/{enabledAi.length}</p>
            <p className="mt-1 text-sm text-secondary-500">مزودون جاهزون {coolingAi.length > 0 ? '· ' + coolingAi.length + ' في Cooldown' : ''}</p>
          </button>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between gap-3"><div><p className="workspace-section-kicker">Administration</p><h2 className="text-lg font-black text-secondary-900">مركز التحكم السريع</h2></div><ShieldCheck className="w-6 h-6 text-primary-600" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'إدارة المستخدمين', desc: 'الحسابات، الأدوار، التفعيل والصلاحيات', path: '/users', icon: UserCog },
                { label: 'الاشتراكات', desc: 'طلبات الدفع، الحالات والأسعار', path: '/subscriptions-admin', icon: CreditCard },
                { label: 'إدارة الفروع', desc: 'الفروع وربط المستخدمين بها', path: '/branches', icon: Building2 },
                { label: 'إعدادات AI', desc: 'المزودون، النماذج والأولوية', path: '/ai-settings', icon: Sparkles },
                { label: 'صحة النظام', desc: 'AI، Cron وقاعدة البيانات', path: '/system-health', icon: Activity },
                { label: 'إعدادات النظام', desc: 'الهوية والإعدادات العامة', path: '/settings', icon: Settings2 },
              ].map((item) => { const Icon = item.icon; return (
                <button key={item.path} onClick={() => navigate(item.path)} className="admin-quick-action">
                  <span className="admin-quick-action__icon"><Icon className="w-5 h-5" /></span>
                  <span className="min-w-0 text-right"><strong className="block text-sm text-secondary-900">{item.label}</strong><span className="block mt-0.5 text-xs text-secondary-500">{item.desc}</span></span>
                </button>
              ); })}
            </div>
          </div>

          <div className="card space-y-4">
            <div><p className="workspace-section-kicker">System Signals</p><h2 className="text-lg font-black text-secondary-900">إشارات تحتاج انتباه</h2></div>
            <div className="space-y-2.5">
              <button onClick={() => navigate('/subscriptions-admin')} className="admin-signal-row"><span className="admin-signal-icon bg-warning-50 text-warning-700"><CreditCard className="w-4 h-4" /></span><span className="flex-1 text-right"><strong className="block text-sm text-secondary-900">طلبات الدفع المعلقة</strong><span className="text-xs text-secondary-500">{formatNumber(data.subscriptions.pendingPayments)} طلب ينتظر قرارك</span></span><span className="text-lg font-black text-warning-700">{formatNumber(data.subscriptions.pendingPayments)}</span></button>
              <button onClick={() => navigate('/system-health')} className="admin-signal-row"><span className="admin-signal-icon bg-primary-50 text-primary-700"><Bot className="w-4 h-4" /></span><span className="flex-1 text-right"><strong className="block text-sm text-secondary-900">مزودو الذكاء الاصطناعي</strong><span className="text-xs text-secondary-500">جاهزية المزودين المفعّلين</span></span><span className="text-sm font-black text-secondary-900">{data.health ? `${healthyAi.length}/${enabledAi.length}` : '—'}</span></button>
              <button onClick={() => navigate('/system-health')} className="admin-signal-row"><span className="admin-signal-icon bg-secondary-50 text-secondary-700"><Clock3 className="w-4 h-4" /></span><span className="flex-1 text-right"><strong className="block text-sm text-secondary-900">المهام المجدولة</strong><span className="text-xs text-secondary-500">Cron jobs التي تحتاج مراجعة</span></span><span className={clsx('text-sm font-black', failedCron.length ? 'text-error-600' : 'text-success-700')}>{failedCron.length ? failedCron.length + ' مشكلة' : 'سليمة'}</span></button>
              <div className="admin-signal-row cursor-default"><span className="admin-signal-icon bg-success-50 text-success-700"><ShieldCheck className="w-4 h-4" /></span><span className="flex-1 text-right"><strong className="block text-sm text-secondary-900">قاعدة البيانات</strong><span className="text-xs text-secondary-500">{data.health ? `آخر فحص ${formatDate(data.health.database.server_time)}` : 'تعذر تحميل حالة قاعدة البيانات'}</span></span><span className={clsx('text-sm font-black', data.health ? 'text-success-700' : 'text-warning-700')}>{data.health ? 'متاحة' : 'غير متاح'}</span></div>
            </div>
          </div>
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3"><div><p className="workspace-section-kicker">Audit</p><h2 className="text-lg font-black text-secondary-900">آخر النشاطات في النظام</h2></div><button onClick={() => navigate('/activity-log')} className="btn btn-secondary btn-sm"><History className="w-4 h-4" />فتح السجل الكامل</button></div>
          {data.recentActivity.length === 0 ? <p className="py-8 text-center text-sm text-secondary-400">لا توجد نشاطات مسجلة بعد.</p> : (
            <div className="divide-y divide-secondary-100">{data.recentActivity.map((log) => (
              <div key={log.id} className="py-3 flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-secondary-50 text-secondary-600 flex items-center justify-center shrink-0"><History className="w-4 h-4" /></span><div className="flex-1 min-w-0"><p className="text-sm font-bold text-secondary-900">{ACTION_LABELS[log.action_type] || log.action_type}</p><p className="text-xs text-secondary-500 truncate">{log.user?.name || 'النظام'} · {log.entity_type || 'system'}</p></div><time className="text-xs text-secondary-400 whitespace-nowrap">{formatDate(log.created_at)}</time></div>
            ))}</div>
          )}
        </section>
      </>}
    </div>
  );
}