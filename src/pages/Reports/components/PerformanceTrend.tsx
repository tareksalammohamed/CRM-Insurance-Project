import { format } from 'date-fns';
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
  return <section className="card space-y-4" aria-labelledby="performance-trend-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="performance-trend-title" className="text-lg font-bold">اتجاه الأداء خلال آخر 6 شهور</h2><p className="text-sm text-secondary-500 mt-1">الإنتاج الجديد والتحصيل الدوري للسنة الأولى حسب شهر السداد. الشهر الحالي غير مكتمل؛ التجديدات لا تدخل في هذا الرسم.</p></div>
      <button type="button" className="btn btn-secondary btn-sm" disabled={query.isFetching} onClick={() => void query.refetch()}>تحديث</button>
    </div>
    <LoadNotice message={query.isError ? 'تعذر تحميل اتجاه الأداء. أعد المحاولة.' : query.data?.message ?? null} loading={query.isFetching} onRetry={() => void query.refetch()} />
    {query.isPending ? <p role="status">جارِ تحميل بيانات الشهور…</p> : !available ? <p>بيانات اتجاه الأداء غير متاحة حاليًا.</p> : <>
      {rows.some(row => row.production || row.collection) ? <div className="h-64 sm:h-80" dir="ltr" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 12, right: 15, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="label" tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} /><YAxis width={65} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat('ar-EG', { notation: 'compact' }).format(value)} />
          <Tooltip formatter={value => formatCurrency(Number(value ?? 0))} contentStyle={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', direction: 'rtl' }} /><Legend />
          <Line type="linear" dataKey="production" name="الإنتاج الجديد" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
          <Line type="linear" dataKey="collection" name="التحصيل الدوري" stroke="#38bdf8" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div> : <p>لا توجد مدفوعات مسجلة في هذه الفترة ضمن النطاق المختار.</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm text-right"><caption className="sr-only">القيم الشهرية لاتجاه الأداء بالجنيه المصري</caption><thead><tr><th className="p-2">الشهر</th><th className="p-2">الإنتاج الجديد</th><th className="p-2">التحصيل الدوري</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.month} className="border-t border-secondary-200"><th className="p-2 font-medium">{row.label}{index === 5 && <span className="block text-xs text-secondary-500">شهر جارٍ</span>}</th><td className="p-2 whitespace-nowrap">{formatCurrency(row.production)}</td><td className="p-2 whitespace-nowrap">{formatCurrency(row.collection)}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
