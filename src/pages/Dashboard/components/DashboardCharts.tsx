import { ArrowDownLeft, Banknote, CalendarDays, PieChart as PieChartIcon, TrendingUp, WalletCards } from 'lucide-react';
import { formatCurrency } from '../utils';
import type { DashboardStats } from '../types';

interface DashboardChartsProps {
  stats: DashboardStats | null;
  selectedMonth: Date;
  policyStatusData: { name: string; value: number; color: string }[];
}

const numberFormatter = new Intl.NumberFormat('ar-EG');
const percentage = (paid: number, total: number) => total > 0 ? Math.round((paid / total) * 100) : 0;
const percentLabel = (value: number) => `${numberFormatter.format(value)}٪`;
function ChartEmpty({ note }: { note: string }) {
  return <div className="chart-empty">
    <span className="chart-empty-icon" aria-hidden="true"><PieChartIcon className="w-4 h-4" /></span>
    <p className="chart-empty-title">لا توجد بيانات لعرضها</p>
    <p className="chart-empty-note">{note}</p>
  </div>;
}

export function DashboardCharts({ stats, selectedMonth, policyStatusData }: DashboardChartsProps) {
  if (!stats) return <p role="status" className="text-sm text-secondary-500">جارٍ تحميل مقارنة الإنتاج والتحصيل…</p>;
  const totalPolicies = stats.totalPolicies;
  const hasPolicyStatusData = policyStatusData.some(entry => entry.value > 0);
  const statusTotal = policyStatusData.reduce((sum, entry) => sum + entry.value, 0);
  let statusOffset = 0;
  const statusGradient = policyStatusData.map(entry => {
    const start = statusOffset;
    statusOffset += statusTotal > 0 ? entry.value / statusTotal * 100 : 0;
    return `${entry.color} ${start}% ${statusOffset}%`;
  }).join(', ');
  const sources = [
    { key: 'production', title: 'الإنتاج الجديد', note: 'أول قسط للوثيقة', icon: TrendingUp, paid: stats.newProduction, total: stats.newProductionTotal, count: stats.newProductionCount },
    { key: 'collection', title: 'التحصيل الدوري', note: 'الأقساط التالية خلال السنة الأولى', icon: WalletCards, paid: stats.periodicCollection, total: stats.periodicCollectionTotal, count: stats.periodicCollectionCount },
  ];
  const paidTotal = stats.newProduction + stats.periodicCollection;
  const productionShare = percentage(stats.newProduction, paidTotal);
  const shares = [productionShare, paidTotal > 0 ? 100 - productionShare : 0];
  const total = stats.newProductionTotal + stats.periodicCollectionTotal;
  const scale = Math.max(...sources.map(source => source.total), 1);
  const monthLabel = selectedMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  return <div className="payment-overview-grid">
    <section className="card payment-overview" aria-labelledby="payment-overview-title">
      <header className="payment-overview-head">
        <div>
          <span className="payment-overview-kicker"><Banknote className="w-4 h-4" aria-hidden="true" />حركة السداد · السنة الأولى</span>
          <h3 id="payment-overview-title">الإنتاج الجديد والتحصيل الدوري</h3>
          <p>الإجمالي والمسدد والمتبقي، في مقارنة واحدة.</p>
        </div>
        <span className="payment-overview-month"><CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />{monthLabel}</span>
      </header>

      <div className="payment-overview-summary">
        <span className="payment-overview-summary-icon" aria-hidden="true"><ArrowDownLeft className="w-5 h-5" /></span>
        <div><span>إجمالي المسدد خلال الشهر</span><strong>{formatCurrency(paidTotal)}</strong></div>
        <div className="payment-overview-base"><span>من إجمالي المقارنة</span><strong>{formatCurrency(total)}</strong></div>
      </div>

      <div className="payment-overview-rows">
        {sources.map(({ key, title, note, icon: Icon, paid, total: sourceTotal }) => {
          const remaining = Math.max(0, sourceTotal - paid);
          const rate = percentage(paid, sourceTotal);
          return <section className={`payment-source payment-source--${key}`} key={key} aria-label={title}>
            <div className="payment-source-heading">
              <span className="payment-source-icon" aria-hidden="true"><Icon className="w-4 h-4" /></span>
              <div><h4>{title}</h4><p>{note}</p></div>
              <span className="payment-source-rate">{sourceTotal > 0 ? `${percentLabel(rate)} مسدد` : 'لا توجد مبالغ'}</span>
            </div>
            <dl className="payment-source-values">
              <div><dt>الإجمالي</dt><dd>{formatCurrency(sourceTotal)}</dd></div>
              <div className="payment-source-paid"><dt>المسدد</dt><dd>{formatCurrency(paid)}</dd></div>
              <div className="payment-source-remaining"><dt>المتبقي</dt><dd>{formatCurrency(remaining)}</dd></div>
            </dl>
            <div className="payment-source-scale" aria-hidden="true">
              <div className="payment-source-track" style={{ width: `${(sourceTotal / scale) * 100}%` }}>
                <span className="payment-source-fill" style={{ width: `${Math.min(100, Math.max(0, sourceTotal > 0 ? paid / sourceTotal * 100 : 0))}%` }} />
              </div>
            </div>
          </section>;
        })}
      </div>
      <div className="payment-overview-key"><span><i className="payment-key-paid" />المسدد</span><span><i className="payment-key-remaining" />المتبقي</span><span>طول الشريط يوضح الإجمالي بنفس المقياس.</span></div>
      <p className="payment-overview-note">الإجمالي = المسدد خلال الشهر + المتبقي المستحق فيه. المتبقي لا يشمل متأخرات الشهور السابقة، وتحصيلات السنوات اللاحقة خارج هذه المقارنة.</p>

    </section>
    <div className="payment-overview-sidebar">
      <section className="card payment-sources" aria-labelledby="payment-sources-title">
        <div className="payment-sources-heading"><h4 id="payment-sources-title">مصادر المسدد</h4><span>من أين جاء إجمالي المسدد؟</span></div>
        {paidTotal > 0 ? <>
          <div className="payment-sources-bar" aria-hidden="true">{sources.map(source => <span key={source.key} className={`payment-source--${source.key}`} style={{ width: `${source.paid / paidTotal * 100}%` }} />)}</div>
          <div className="payment-sources-breakdown">{sources.map((source, index) => <div key={source.key} className={`payment-source--${source.key}`}>
            <span className="payment-source-caption"><i />{source.title}<b>{percentLabel(shares[index])}</b></span>
            <strong>{formatCurrency(source.paid)}</strong>
            <span className="payment-source-count">عمليات السداد: {numberFormatter.format(source.count)}</span>
          </div>)}</div>
        </> : <p className="payment-sources-empty">لم يُسجّل سداد خلال الشهر المختار؛ مبالغ الإجمالي والمتبقي موضحة بالأعلى.</p>}
      </section>
      <div className="card chart-panel">
        <div className="chart-panel-head">
          <div className="min-w-0">
            <h3 className="chart-panel-title">حالة الوثائق</h3>
            <p className="chart-panel-note">توزيع المحفظة حسب الحالة</p>
          </div>
          <div className="chart-panel-total">
            <span>الإجمالي</span>
            <strong>{totalPolicies || 0}</strong>
          </div>
        </div>

        {/* The legend exposes the same counts; keep the decorative ring silent. */}
        <div className="chart-canvas policy-status-canvas h-40 md:h-44" aria-hidden={hasPolicyStatusData || undefined}>
          {hasPolicyStatusData ? (
            <>
              <div className="policy-status-ring" style={{ background: `conic-gradient(${statusGradient})` }} />
              <div className="chart-center">
                <span className="chart-center-value">{totalPolicies || 0}</span>
                <span className="chart-center-label">وثيقة</span>
              </div>
            </>
          ) : (
            <ChartEmpty note="لم تُسجَّل وثائق بعد فى النطاق المحدد" />
          )}
        </div>

        <ul className="chart-legend">
          {policyStatusData.map((entry) => (
            <li key={entry.name} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: entry.color }} aria-hidden="true" />
              <span className="chart-legend-name">{entry.name}</span>
              <span className="chart-legend-value">{entry.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>;
}
