import { format } from 'date-fns';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LoadNotice } from '../../../components/feedback/LoadNotice';
import { fetchPerformanceTrend } from '../services/performanceTrendService';
import { formatCurrency } from '../business/reportsCalculator';

export function PerformanceTrend({ userId, branchId, selectedUserId }: { userId: string; branchId: string | null; selectedUserId: string }) {
  const month = format(new Date(), 'yyyy-MM');
  const query = useQuery({ queryKey: ['performance-trend', userId, branchId, selectedUserId, month], queryFn: () => fetchPerformanceTrend(userId, branchId, selectedUserId), staleTime: 60_000 });
  const available = query.data && !['error', 'offline-empty'].includes(query.data.status);
  const rows = available ? query.data!.rows : [];
  return <section className="card min-w-0 space-y-5" aria-labelledby="performance-trend-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><div className="mb-2 flex items-center gap-2 text-primary-700"><TrendingUp aria-hidden="true" className="h-4 w-4" /><span className="text-xs font-semibold">مقارنة شهرية · سنة أولى</span></div><h2 id="performance-trend-title" className="text-base sm:text-lg font-bold">اتجاه الأداء خلال آخر 6 شهور</h2></div>
      <button type="button" className="btn btn-secondary btn-sm" disabled={query.isFetching} onClick={() => void query.refetch()} aria-label="تحديث اتجاه الأداء"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />تحديث</button>
    </div>
    <p className="text-sm text-secondary-500 leading-relaxed">الإنتاج الجديد والتحصيل الدوري للسنة الأولى حسب شهر الاحتساب. الشهر الحالي غير مكتمل؛ التجديدات لا تدخل في هذا الرسم.</p>
    <LoadNotice message={query.isError ? 'تعذر تحميل اتجاه الأداء. أعد المحاولة.' : query.data?.message ?? null} loading={query.isFetching} onRetry={() => void query.refetch()} />
    {query.isPending ? <div role="status" className="space-y-3"><span className="text-sm text-secondary-500">جارِ تحميل بيانات الشهور…</span><div aria-hidden="true" className="h-64 rounded-xl bg-secondary-100/60 animate-pulse motion-reduce:animate-none" /></div> : !available ? <p>بيانات اتجاه الأداء غير متاحة حاليًا.</p> : <>
      {rows.some(row => row.production || row.collection) ? <div className="h-64 sm:h-80 rounded-xl border border-secondary-200/60 pt-3" dir="ltr" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 12, right: 28, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="label" tickFormatter={label => String(label).replace(/\s\d{4}$/, '')} minTickGap={12} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} /><YAxis width={65} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat('ar-EG', { notation: 'compact' }).format(value)} />
          <Tooltip formatter={value => formatCurrency(Number(value ?? 0))} contentStyle={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', direction: 'rtl' }} /><Legend />
          <Line type="linear" dataKey="production" name="الإنتاج الجديد" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
          <Line type="linear" dataKey="collection" name="التحصيل الدوري" stroke="#38bdf8" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div> : <p>لا توجد مدفوعات مسجلة في هذه الفترة ضمن النطاق المختار.</p>}
      <div className="overflow-x-auto rounded-xl border border-secondary-200/60"><table className="w-full text-sm text-right"><caption className="sr-only">القيم الشهرية لاتجاه الأداء بالجنيه المصري</caption><thead className="bg-secondary-50"><tr><th scope="col" className="px-3 py-3">الشهر</th><th scope="col" className="px-3 py-3"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 me-1.5" />الإنتاج الجديد</th><th scope="col" className="px-3 py-3"><span className="inline-block h-2 w-2 rounded-full bg-sky-400 me-1.5" />التحصيل الدوري</th></tr></thead><tbody>{rows.map(row => <tr key={row.month} className={`border-t border-secondary-200/60 ${row.month === month ? 'bg-primary-50/60' : ''}`}><th scope="row" className="px-3 py-3 font-medium">{row.label}{row.month === month && <span className="mt-1 block text-xs text-secondary-500">شهر جارٍ · غير مكتمل</span>}</th><td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatCurrency(row.production)}</td><td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatCurrency(row.collection)}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
