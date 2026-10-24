import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBranchContext } from '../../lib/branchContext';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { useReconnectRefetch } from '../../hooks/useReconnectRefetch';
import { LoadNotice } from '../../components/feedback/LoadNotice';
import { followupError } from './errors';
import { closeFollowup, fetchFollowups, type FollowupFilter } from './service';
import { cairoToday, followupOutcomeLabel, followupStatusLabel, type FollowupRow } from './model';
function CloseFollowup({ row, onSaved }: { row: FollowupRow; onSaved: () => void }) {
  const [open, setOpen] = useState(false); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const guard = useRef(false);
  if (row.closed_at || !row.next_date) return null;
  if (!open) return <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>{row.kind === 'promise' ? 'إغلاق الوعد مع ذكر السبب' : 'تسجيل نتيجة وإغلاق المتابعة'}</button>;
  return <form className="space-y-2 mt-2" onSubmit={async event => {
    event.preventDefault(); if (guard.current) return;
    guard.current = true; setBusy(true); setError('');
    try { await closeFollowup(row.id, note); setOpen(false); onSaved(); }
    catch (error) { setError(followupError(error, 'تعذّر إغلاق المتابعة؛ أعد المحاولة.')); }
    finally { guard.current = false; setBusy(false); }
  }}>
    <p className="text-xs text-secondary-600">إغلاق المتابعة لا يسجل سدادًا ولا يغيّر حالة الوثيقة.</p>
    <label className="input-label">{row.kind === 'promise' ? 'سبب إغلاق الوعد' : 'نتيجة المتابعة'}<textarea className="input mt-1" value={note} onChange={e => setNote(e.target.value)} required maxLength={500} disabled={busy} /></label>
    {error && <p role="alert" className="text-error-600 text-sm">{error}</p>}
    <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'جاري الحفظ...' : 'تأكيد الإغلاق'}</button><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setOpen(false)}>رجوع</button></div>
  </form>;
}
export function FollowupList({ customerId, policyId, installmentId, revision = 0, onNavigate }: { customerId?: string; policyId?: string; installmentId?: string; revision?: number; onNavigate?: () => void }) {
  const { user } = useAuth(); const { currentBranchId } = useBranchContext();
  const [filter, setFilter] = useState<FollowupFilter>(customerId ? 'all' : 'due');
  const [page, setPage] = useState(1); const [rows, setRows] = useState<FollowupRow[]>([]);
  const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null); const guard = useRequestGuard();
  const userId = user?.id;
  const load = useCallback(async () => {
    if (!userId) return;
    const request = guard.start(); setLoading(true);
    try {
      const result = await fetchFollowups({ userId, customerId, branchId: currentBranchId, page, filter, policyId, installmentId });
      if (!guard.isCurrent(request)) return;
      if (page > 1 && result.status === 'online' && result.total <= (page - 1) * 10) { setPage(Math.max(1, Math.ceil(result.total / 10))); return; }
      setRows(result.rows); setTotal(result.total); setMessage(result.message);
    } catch (error) { if (guard.isCurrent(request)) setMessage(followupError(error, 'تعذّر تحميل المتابعات.')); }
    finally { if (guard.isCurrent(request)) setLoading(false); }
  }, [userId, customerId, currentBranchId, page, filter, policyId, installmentId, guard]);
  useEffect(() => { setRows([]); setTotal(0); void load(); return () => guard.invalidate(); }, [load, revision, guard]);
  useReconnectRefetch(load);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    let day = cairoToday();
    const timer = window.setInterval(() => {
      const nextDay = cairoToday();
      if (day !== nextDay) { day = nextDay; refresh(); }
    }, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer); };
  }, [load]);
  return <div className="space-y-3" aria-busy={loading}>
    <div className="flex flex-wrap gap-2 items-center">
      <label className="sr-only" htmlFor={`followup-filter-${customerId || 'all'}`}>عرض المتابعات</label>
      <select id={`followup-filter-${customerId || 'all'}`} className="input !w-auto flex-1" value={filter} onChange={e => { setFilter(e.target.value as FollowupFilter); setPage(1); }}>
        <option value="due">اليوم والمتأخرة</option><option value="upcoming">المواعيد القادمة</option><option value="all">كل السجل</option>
      </select>
      <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => void load()}><RefreshCw className="w-4 h-4" />تحديث</button>
    </div>
    <LoadNotice message={message} loading={loading} onRetry={() => void load()} />
    {loading && <p className="text-sm text-secondary-500" role="status">جاري تحميل المتابعات...</p>}
    {!loading && !message && !rows.length && <p className="text-sm text-secondary-500 py-3">لا توجد متابعات ضمن هذا الاختيار.</p>}
    {rows.map(row => <article key={row.id} className="rounded-xl border border-secondary-200 p-3 bg-white space-y-2">
      {!customerId && <div className="flex flex-wrap items-center gap-2"><Link to={`/customers?open=${row.customer_id}`} onClick={onNavigate} className="font-bold text-primary-700">{row.customer_name}</Link>{row.customer_phone && <a className="btn btn-secondary btn-sm" href={`tel:${row.customer_phone}`}>اتصال</a>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-secondary-900">{followupOutcomeLabel(row)}</strong><span className={`badge ${row.followup_status === 'overdue' ? 'badge-warning' : row.followup_status === 'paid' ? 'badge-success' : 'badge-secondary'}`}>{followupStatusLabel(row)}</span></div>
      {row.policy_number && <p className="text-xs text-secondary-600">وثيقة {row.policy_number}{row.installment_number ? ` · القسط ${row.installment_number}` : ` · تحصيل شهر ${row.payment_month?.slice(0, 7)}`}</p>}
      <p className="text-sm text-secondary-700 whitespace-pre-wrap break-words">{row.notes}</p>
      {row.next_action && <p className="text-sm text-secondary-700">الخطوة القادمة: {row.next_action}</p>}
      {row.next_date && <p className="text-xs font-semibold text-secondary-700">الموعد: <bdi>{row.next_date}</bdi></p>}
      {row.close_note && <p className="text-sm text-secondary-600">نتيجة الإغلاق: {row.close_note}</p>}
      <p className="text-xs text-secondary-500">{row.author_name || 'اسم المستخدم غير متاح'} · {new Date(row.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'short', timeStyle: 'short' })}</p>
      <CloseFollowup row={row} onSaved={() => void load()} />
    </article>)}
    {total > 10 && <div className="flex items-center justify-between gap-2 text-sm text-secondary-700"><button type="button" className="btn btn-secondary btn-sm" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>السابق</button><span>{page} / {Math.ceil(total / 10)}</span><button type="button" className="btn btn-secondary btn-sm" disabled={page * 10 >= total || loading} onClick={() => setPage(p => p + 1)}>التالي</button></div>}
  </div>;
}
