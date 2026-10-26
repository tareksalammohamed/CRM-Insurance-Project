import { firstYearScheduleSummary } from './firstYearSummaryModel';
import type { Installment } from '../../lib/supabase';
import { formatCurrency } from './installmentHelpers';

export function FirstYearSummary({ installments, loading = false }: { installments: Installment[]; loading?: boolean }) {
  if (loading) return <p className="text-sm text-secondary-500" role="status">جاري تحميل ملخص أقساط السنة الأولى...</p>;
  if (!installments.length) return <p className="text-sm text-secondary-500">لا توجد أقساط سنة أولى محمّلة لعرض مجموعها.</p>;
  const summary = firstYearScheduleSummary(installments);
  const cards = [
    { label: 'إجمالي أقساط السنة الأولى', count: summary.total, amount: summary.amount, tone: 'text-secondary-900' },
    { label: 'المسدد — سنة أولى', count: summary.paid, amount: summary.paidAmount, tone: 'text-success-600' },
    { label: 'غير المسدد دون المتأخر — سنة أولى', count: summary.pending, amount: summary.pendingAmount, tone: 'text-warning-600' },
    { label: 'المتأخر — سنة أولى', count: summary.overdue, amount: summary.overdueAmount, tone: 'text-error-600' },
  ];
  return <section className="space-y-2" aria-label="ملخص أقساط السنة الأولى">
    <h3 className="text-sm font-bold text-secondary-900">ملخص أقساط السنة الأولى</h3>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{cards.map(card => <div key={card.label} className="kpi-card kpi-card--summary">
      <p className="text-xs text-secondary-600 leading-5">{card.label}</p>
      <p className={`text-figure font-bold ${card.tone}`}>{card.count} <span className="text-xs font-normal">قسط</span></p>
      <p className={`text-sm font-semibold break-words ${card.tone}`}>القيمة: {formatCurrency(card.amount)}</p>
    </div>)}</div>
    <p className="text-xs text-secondary-600">المتبقي غير المسدد شامل المتأخر: <strong>{formatCurrency(summary.pendingAmount + summary.overdueAmount)}</strong>. المتأخر جزء من المتبقي وليس مبلغًا إضافيًا.</p>
    <p className="text-xs text-secondary-500">حسب جدول السنة الأولى المحمّل وحالة أقساطه المسجلة، لا حسب حركة النقدية. لا يشمل تحصيلات السنة الثانية وما بعدها، ولا يمثل إجمالي تكلفة الوثيقة طوال مدتها.</p>
  </section>;
}
