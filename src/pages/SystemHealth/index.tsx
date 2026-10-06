import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bot, CheckCircle2, Clock3, Database, DatabaseBackup, RefreshCw, ServerCog, AlertTriangle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { friendlyError } from '../../lib/errorMessages';

type RuntimeStats = {
  success_count: number;
  failure_count: number;
  consecutive_failures: number;
  avg_latency_ms: number | null;
  last_latency_ms: number | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  cooldown_until: string | null;
  last_error: string | null;
};

type ProviderHealth = {
  provider: string;
  display_name: string;
  provider_type: 'ai' | 'ocr';
  enabled: boolean;
  priority: number;
  status: string;
  default_model: string | null;
  last_tested_at: string | null;
  last_error: string | null;
  model_count: number;
  runtime: RuntimeStats;
};

type CronHealth = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: {
    status: string;
    start_time: string | null;
    end_time: string | null;
    return_message: string | null;
  } | null;
};

type UsageTotals = {
  requests: number;
  successes: number;
  failures: number;
  capacity_errors: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type ProviderUsage = UsageTotals & {
  provider: string;
  avg_latency_ms: number;
  last_used_at: string | null;
};

type ModelUsage = {
  provider: string;
  model: string;
  requests: number;
  successes: number;
  failures: number;
  capacity_errors: number;
  total_tokens: number;
  avg_latency_ms: number;
  last_used_at: string | null;
};

type AIUsageSummary = {
  from_date: string;
  to_date: string;
  today: UsageTotals;
  period: UsageTotals;
  providers: ProviderUsage[];
  models: ModelUsage[];
  daily: Array<{
    usage_date: string;
    requests: number;
    successes: number;
    failures: number;
    capacity_errors: number;
    total_tokens: number;
  }>;
};

type SystemHealth = {
  checked_at: string;
  database: { status: string; server_time: string; last_backup_export: string | null };
  ai: {
    enabled: boolean;
    models_updated_at: string | null;
    providers: ProviderHealth[];
    usage?: AIUsageSummary;
  };
  cron: CronHealth[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ar-EG');
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('ar-EG').format(Number(value || 0));
}

function formatCompact(value: number | null | undefined) {
  return new Intl.NumberFormat('ar-EG', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
}

function successRate(successes: number, requests: number) {
  if (!requests) return 0;
  return Math.round((successes / requests) * 100);
}

function statusBadge(ok: boolean, okText: string, badText: string) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
      ok ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'
    )}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {ok ? okText : badText}
    </span>
  );
}

export function SystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('الجلسة غير صالحة');

      const response = await fetch(`${supabaseUrl}/functions/v1/system-health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'تعذر تحميل حالة النظام');
      }
      setHealth(result.data as SystemHealth);
    } catch (err) {
      setError(friendlyError(err, 'تعذر تحميل حالة النظام'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => load(true), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const enabledProviders = useMemo(
    () => health?.ai.providers.filter((p) => p.enabled) ?? [],
    [health]
  );
  const healthyProviders = enabledProviders.filter((p) => p.status === 'active');
  const failedCron = health?.cron.filter((job) => job.active && job.last_run && job.last_run.status !== 'succeeded') ?? [];

  if (loading && !health) {
    return (
      <div className="space-y-4">
        <div className="h-24 skeleton-bar rounded-2xl" />
        <div className="h-56 skeleton-bar rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="workspace-page workspace-page-health space-y-6 animate-fadeIn">
      <div className="card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="workspace-section-kicker">مراقبة التشغيل</p>
          <h2 className="text-2xl font-extrabold text-secondary-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary-600" />
            صحة النظام
          </h2>
          <p className="text-sm text-secondary-500 mt-1">
            حالة قاعدة البيانات، مهام Cron، ومزودي الذكاء الاصطناعي في مكان واحد.
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="btn btn-secondary">
          <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
          {refreshing ? 'جاري التحديث...' : 'تحديث الآن'}
        </button>
      </div>

      {error && (
        <div className="card border-error-200 bg-error-50 text-error-700 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {health && (
        <>
          <div className="health-summary-grid grid grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-4">
            <div className="kpi-card">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-secondary-600">قاعدة البيانات</span>
                <Database className="w-5 h-5 text-primary-600" />
              </div>
              <div className="mt-4">{statusBadge(health.database.status === 'healthy', 'سليمة', 'تحتاج مراجعة')}</div>
              <p className="text-xs text-secondary-400 mt-3">{formatDate(health.database.server_time)}</p>
            </div>

            <div className="kpi-card">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-secondary-600">مزودو AI المفعّلون</span>
                <Bot className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-3xl font-extrabold text-secondary-900 mt-3">{healthyProviders.length}/{enabledProviders.length}</p>
              <p className="text-xs text-secondary-500 mt-1">متاحون الآن</p>
            </div>

            <div className="kpi-card">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-secondary-600">مهام Cron</span>
                <Clock3 className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-3xl font-extrabold text-secondary-900 mt-3">{health.cron.length - failedCron.length}/{health.cron.length}</p>
              <p className="text-xs text-secondary-500 mt-1">آخر تشغيل سليم</p>
            </div>

            <div className="kpi-card">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-secondary-600">آخر تحديث للنماذج</span>
                <ServerCog className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-sm font-bold text-secondary-900 mt-4">{formatDate(health.ai.models_updated_at)}</p>
              <p className="text-xs text-secondary-400 mt-2">فحص تلقائي كل 6 ساعات</p>
            </div>

            <div className="kpi-card">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-secondary-600">آخر نسخة احتياطية</span>
                <DatabaseBackup className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-sm font-bold text-secondary-900 mt-4">{formatDate(health.database.last_backup_export)}</p>
              <p className="text-xs text-secondary-400 mt-2">آخر Backup Export مسجل</p>
            </div>
          </div>

          {health.ai.usage && (
            <div className="card space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2">
                <div>
                  <p className="workspace-section-kicker">AI Usage · Actual</p>
                  <h3 className="text-lg font-bold text-secondary-900">الاستهلاك الفعلي للذكاء الاصطناعي</h3>
                  <p className="text-sm text-secondary-500 mt-1">
                    محسوب من الطلبات التي مرّت فعليًا عبر AI Gateway. التوكنز تظهر فقط عندما يرسل المزود Usage رسميًا.
                  </p>
                </div>
                <p className="text-xs text-secondary-400">
                  الفترة: {health.ai.usage.from_date} ← {health.ai.usage.to_date}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-secondary-200 bg-secondary-50/60 p-3">
                  <p className="text-xs text-secondary-500">طلبات اليوم</p>
                  <p className="text-2xl font-extrabold text-secondary-900 mt-1">{formatNumber(health.ai.usage.today.requests)}</p>
                  <p className="text-xs text-secondary-400 mt-1">
                    نجاح {successRate(health.ai.usage.today.successes, health.ai.usage.today.requests)}%
                  </p>
                </div>
                <div className="rounded-xl border border-secondary-200 bg-secondary-50/60 p-3">
                  <p className="text-xs text-secondary-500">طلبات 31 يوم</p>
                  <p className="text-2xl font-extrabold text-secondary-900 mt-1">{formatNumber(health.ai.usage.period.requests)}</p>
                  <p className="text-xs text-secondary-400 mt-1">
                    فشل {formatNumber(health.ai.usage.period.failures)}
                  </p>
                </div>
                <div className="rounded-xl border border-warning-200 bg-warning-50/60 p-3">
                  <p className="text-xs text-warning-700">Quota / 429 Hits</p>
                  <p className="text-2xl font-extrabold text-warning-700 mt-1">{formatNumber(health.ai.usage.period.capacity_errors)}</p>
                  <p className="text-xs text-warning-600 mt-1">محاولات وصلت لحد السعة</p>
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3">
                  <p className="text-xs text-primary-700">توكنز مسجلة</p>
                  <p className="text-2xl font-extrabold text-primary-700 mt-1">{formatCompact(health.ai.usage.period.total_tokens)}</p>
                  <p className="text-xs text-primary-600 mt-1">
                    In {formatCompact(health.ai.usage.period.prompt_tokens)} · Out {formatCompact(health.ai.usage.period.completion_tokens)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-secondary-200 text-secondary-500">
                      <th className="text-right p-3">المزود</th>
                      <th className="text-right p-3">الطلبات</th>
                      <th className="text-right p-3">النجاح</th>
                      <th className="text-right p-3">Quota/429</th>
                      <th className="text-right p-3">التوكنز</th>
                      <th className="text-right p-3">متوسط الزمن</th>
                      <th className="text-right p-3">آخر استخدام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.ai.usage.providers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-secondary-400">
                          لم تُسجل طلبات بعد منذ تفعيل عداد الاستخدام.
                        </td>
                      </tr>
                    ) : health.ai.usage.providers.map((u) => (
                      <tr key={u.provider} className="border-b border-secondary-100">
                        <td className="p-3 font-bold text-secondary-900">{u.provider}</td>
                        <td className="p-3">{formatNumber(u.requests)}</td>
                        <td className="p-3">
                          <span className="font-semibold text-success-700">{successRate(u.successes, u.requests)}%</span>
                          <span className="text-xs text-secondary-400"> · {formatNumber(u.successes)}/{formatNumber(u.failures)}</span>
                        </td>
                        <td className="p-3">
                          <span className={u.capacity_errors > 0 ? 'font-bold text-warning-700' : 'text-secondary-400'}>
                            {formatNumber(u.capacity_errors)}
                          </span>
                        </td>
                        <td className="p-3">{u.total_tokens > 0 ? formatCompact(u.total_tokens) : '—'}</td>
                        <td className="p-3">{u.avg_latency_ms > 0 ? `${formatNumber(u.avg_latency_ms)} ms` : '—'}</td>
                        <td className="p-3">{formatDate(u.last_used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {health.ai.usage.models.length > 0 && (
                <div className="rounded-xl border border-secondary-200 overflow-hidden">
                  <div className="px-4 py-3 bg-secondary-50 border-b border-secondary-200">
                    <h4 className="font-bold text-secondary-900">أكثر النماذج استخدامًا</h4>
                  </div>
                  <div className="divide-y divide-secondary-100">
                    {health.ai.usage.models.slice(0, 8).map((m) => (
                      <div key={`${m.provider}:${m.model}`} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-secondary-900 truncate" dir="ltr">{m.model}</p>
                          <p className="text-xs text-secondary-400">{m.provider}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-secondary-500">
                          <span>{formatNumber(m.requests)} طلب</span>
                          <span>{formatNumber(m.capacity_errors)} quota</span>
                          <span>{m.total_tokens > 0 ? `${formatCompact(m.total_tokens)} token` : 'token usage غير متاح'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card space-y-4">
            <div>
              <p className="workspace-section-kicker">AI Routing</p>
              <h3 className="text-lg font-bold text-secondary-900">حالة المزودين</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 text-secondary-500">
                    <th className="text-right p-3">المزود</th>
                    <th className="text-right p-3">الحالة</th>
                    <th className="text-right p-3">الأولوية</th>
                    <th className="text-right p-3">النماذج</th>
                    <th className="text-right p-3">متوسط الاستجابة</th>
                    <th className="text-right p-3">نجاح / فشل</th>
                    <th className="text-right p-3">Cooldown</th>
                    <th className="text-right p-3">آخر فحص</th>
                  </tr>
                </thead>
                <tbody>
                  {health.ai.providers.map((p) => {
                    const cooling = !!p.runtime.cooldown_until && new Date(p.runtime.cooldown_until).getTime() > Date.now();
                    return (
                      <tr key={p.provider} className="border-b border-secondary-100">
                        <td className="p-3">
                          <div className="font-bold text-secondary-900">{p.display_name}</div>
                          <div className="text-xs text-secondary-400">{p.provider_type.toUpperCase()} · {p.provider}</div>
                        </td>
                        <td className="p-3">{statusBadge(p.status === 'active', 'نشط', p.status || 'غير جاهز')}</td>
                        <td className="p-3">{p.priority}</td>
                        <td className="p-3">{p.model_count}</td>
                        <td className="p-3">{p.runtime.avg_latency_ms ? `${Math.round(p.runtime.avg_latency_ms)} ms` : '—'}</td>
                        <td className="p-3">
                          <span className="text-success-700 font-semibold">{p.runtime.success_count}</span>
                          {' / '}
                          <span className="text-error-600 font-semibold">{p.runtime.failure_count}</span>
                        </td>
                        <td className="p-3">
                          {cooling ? <span className="text-warning-700 font-semibold">حتى {formatDate(p.runtime.cooldown_until)}</span> : '—'}
                        </td>
                        <td className="p-3">{formatDate(p.last_tested_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card space-y-4">
            <div>
              <p className="workspace-section-kicker">Background Jobs</p>
              <h3 className="text-lg font-bold text-secondary-900">مهام التشغيل المجدولة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 text-secondary-500">
                    <th className="text-right p-3">المهمة</th>
                    <th className="text-right p-3">الجدول</th>
                    <th className="text-right p-3">الحالة</th>
                    <th className="text-right p-3">آخر تشغيل</th>
                  </tr>
                </thead>
                <tbody>
                  {health.cron.map((job) => {
                    const ok = job.active && (!job.last_run || job.last_run.status === 'succeeded');
                    return (
                      <tr key={job.jobid} className="border-b border-secondary-100">
                        <td className="p-3 font-semibold text-secondary-900">{job.jobname}</td>
                        <td className="p-3 font-mono text-xs" dir="ltr">{job.schedule}</td>
                        <td className="p-3">{statusBadge(ok, 'سليم', job.active ? 'آخر تشغيل فشل' : 'متوقف')}</td>
                        <td className="p-3">
                          <div>{formatDate(job.last_run?.start_time)}</div>
                          {job.last_run?.return_message && job.last_run.status !== 'succeeded' && (
                            <div className="text-xs text-error-600 mt-1 max-w-[420px]">{job.last_run.return_message}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-secondary-400 text-left">
            آخر تحديث للوحة: {formatDate(health.checked_at)} · تحديث تلقائي كل دقيقة.
          </p>
        </>
      )}
    </div>
  );
}
