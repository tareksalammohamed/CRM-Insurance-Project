import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { friendlyError } from '../../lib/errorMessages';
import {
  deleteAppJob,
  listAppJobs,
  type AppJob,
  type AppJobStatus,
} from '../../features/jobs/jobService';

const STATUS_META: Record<AppJobStatus, { label: string; className: string }> = {
  queued: { label: 'في الانتظار', className: 'bg-secondary-100 text-secondary-700' },
  running: { label: 'جارية', className: 'bg-primary-50 text-primary-700' },
  completed: { label: 'مكتملة', className: 'bg-success-50 text-success-700' },
  partial: { label: 'مكتملة جزئيًا', className: 'bg-warning-50 text-warning-700' },
  failed: { label: 'فشلت', className: 'bg-error-50 text-error-700' },
  cancelled: { label: 'ملغاة', className: 'bg-secondary-100 text-secondary-600' },
  interrupted: { label: 'انقطعت', className: 'bg-warning-50 text-warning-700' },
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ar-EG');
}

function jobProgress(job: AppJob) {
  if (!job.progress_total) return job.status === 'completed' ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((job.progress_current / job.progress_total) * 100)));
}

function sourcePath(job: AppJob) {
  if (job.job_type.startsWith('data_import') || job.job_type === 'ai_document_extract') {
    return '/data-import';
  }
  return null;
}

export function JobCenter() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<AppJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'attention' | 'done'>('all');

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setJobs(await listAppJobs());
    } catch (err) {
      setError(friendlyError(err, 'تعذر تحميل مركز المهام'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => load(true), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const counts = useMemo(() => ({
    active: jobs.filter((j) => j.status === 'running' || j.status === 'queued').length,
    attention: jobs.filter((j) => ['partial', 'failed', 'interrupted'].includes(j.status)).length,
    done: jobs.filter((j) => j.status === 'completed').length,
  }), [jobs]);

  const visibleJobs = useMemo(() => jobs.filter((job) => {
    if (filter === 'active') return job.status === 'running' || job.status === 'queued';
    if (filter === 'attention') return ['partial', 'failed', 'interrupted'].includes(job.status);
    if (filter === 'done') return job.status === 'completed';
    return true;
  }), [jobs, filter]);

  const remove = async (job: AppJob) => {
    try {
      await deleteAppJob(job.id);
      setJobs((prev) => prev.filter((item) => item.id !== job.id));
    } catch (err) {
      setError(friendlyError(err, 'تعذر حذف المهمة'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 skeleton-bar rounded-2xl" />
        <div className="h-52 skeleton-bar rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="workspace-page space-y-6 animate-fadeIn">
      <div className="card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="workspace-section-kicker">Operations</p>
          <h2 className="text-2xl font-extrabold text-secondary-900 flex items-center gap-2">
            <Clock3 className="w-6 h-6 text-primary-600" />
            مركز المهام
          </h2>
          <p className="text-sm text-secondary-500 mt-1">
            حالة العمليات الطويلة وآخر نقطة وصلت لها، حتى لو انتقلت بين الصفحات.
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

      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setFilter('active')} className="kpi-card text-right">
          <p className="text-xs text-secondary-500">جارية الآن</p>
          <p className="text-2xl font-extrabold text-primary-700 mt-1">{counts.active}</p>
        </button>
        <button onClick={() => setFilter('attention')} className="kpi-card text-right">
          <p className="text-xs text-secondary-500">تحتاج انتباه</p>
          <p className="text-2xl font-extrabold text-warning-700 mt-1">{counts.attention}</p>
        </button>
        <button onClick={() => setFilter('done')} className="kpi-card text-right">
          <p className="text-xs text-secondary-500">مكتملة</p>
          <p className="text-2xl font-extrabold text-success-700 mt-1">{counts.done}</p>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {([
          ['all', 'الكل'],
          ['active', 'الجارية'],
          ['attention', 'تحتاج انتباه'],
          ['done', 'المكتملة'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx('btn btn-sm', filter === value ? 'btn-primary' : 'btn-secondary')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleJobs.length === 0 ? (
          <div className="card empty-state-card text-center py-12">
            <CheckCircle2 className="w-10 h-10 text-success-500 mx-auto mb-3" />
            <p className="font-bold text-secondary-900">لا توجد مهام في هذا القسم</p>
            <p className="text-sm text-secondary-500 mt-1">ستظهر هنا العمليات الطويلة بمجرد بدء تنفيذها.</p>
          </div>
        ) : visibleJobs.map((job) => {
          const meta = STATUS_META[job.status];
          const progress = jobProgress(job);
          const source = sourcePath(job);
          const terminal = ['completed', 'partial', 'failed', 'cancelled', 'interrupted'].includes(job.status);
          return (
            <div key={job.id} className="card space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                    {job.status === 'running' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                      job.status === 'failed' ? <XCircle className="w-5 h-5" /> :
                      <FileUp className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-secondary-900">{job.title}</h3>
                    <p className="text-xs text-secondary-400 mt-0.5">
                      {job.stage || job.job_type} · آخر تحديث {formatDate(job.updated_at)}
                    </p>
                  </div>
                </div>

                <span className={clsx('inline-flex self-start rounded-full px-2.5 py-1 text-xs font-bold', meta.className)}>
                  {meta.label}
                </span>
              </div>

              {(job.progress_total > 0 || job.status === 'running') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-secondary-500">
                    <span>{job.progress_total > 0 ? \`\${job.progress_current} / \${job.progress_total}\` : 'جاري التنفيذ'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary-100 overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-300',
                        job.status === 'failed' || job.status === 'interrupted' ? 'bg-warning-500' : 'bg-primary-600'
                      )}
                      style={{ width: \`\${progress}%\` }}
                    />
                  </div>
                </div>
              )}

              {job.message && (
                <p className="text-sm text-secondary-600">{job.message}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {source && (
                  <button onClick={() => navigate(source)} className="btn btn-secondary btn-sm">
                    فتح الصفحة المرتبطة
                  </button>
                )}
                {terminal && (
                  <button onClick={() => remove(job)} className="btn btn-ghost btn-sm text-error-600">
                    <Trash2 className="w-4 h-4" />
                    حذف من السجل
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-secondary-400">
        ملاحظة: المهام التي تعتمد على المتصفح لا تدّعي الاستمرار بعد إغلاق التطبيق؛ إذا انقطع التنفيذ ستظهر كـ«انقطعت» بدل حالة جارية وهمية.
      </p>
    </div>
  );
}
