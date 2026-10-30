import { BadgeCheck, UserPlus, MapPin, Phone, PhoneCall, CalendarCheck2 } from 'lucide-react';

import type { StatsAggregate } from '../types';
import { APPOINTMENTS_QUALITY_LABELS } from '../types';

interface StatsSummaryCardProps {
  aggregate: StatsAggregate;
  title?: string;
}

/** بطاقة ملخص لإجمالي إحصائيات مجمّعة (فرد أو فريق) خلال فترة معيّنة — بنفس
 * شكل بطاقات الـKPI المستخدمة فى لوحة التحكم والعملاء والتحصيل */
export function StatsSummaryCard({ aggregate, title }: StatsSummaryCardProps) {
  const a = aggregate;
  const punctualityPct = a.entriesCount > 0 ? Math.round((a.punctualityOkCount / a.entriesCount) * 100) : null;

  if (a.entriesCount === 0) {
    return (
      <div className="card daily-quality-card">
        {title && <h3 className="font-bold text-secondary-900 mb-2">{title}</h3>}
        <p className="text-sm text-secondary-400 text-center py-4">لا توجد إحصائيات مسجّلة لهذه الفترة</p>
      </div>
    );
  }

  return (
    <div className="daily-stats-summary space-y-2">
      {title && <h3 className="font-bold text-secondary-900">{title}</h3>}

      <section className="daily-activity-overview" aria-label="ملخص النشاط">
        <div className="daily-activity-heading"><h4>النشاط خلال الفترة</h4><span>{a.entriesCount} تقرير يومي مسجل</span></div>
        <div className="daily-activity-primary">
          {[
            { label: 'إجمالي المكالمات', value: a.callsActual, icon: Phone, tone: 'brand' },
            { label: 'مكالمات نتج عنها مواعيد', value: a.callsToAppointments, icon: PhoneCall, tone: 'info' },
            { label: 'إجمالي المواعيد الفعلية', value: a.appointmentsActual, icon: CalendarCheck2, tone: 'success' },
          ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="daily-activity-metric">
            <span className={`kpi-icon-tile kpi-icon-tile--${tone}`}><Icon aria-hidden="true" className="w-5 h-5" /></span>
            <p>{label}</p><strong>{value}</strong>
          </div>)}
        </div>
        <dl className="daily-activity-secondary">
          <div><dt><UserPlus aria-hidden="true" />طلبات تأمين جديدة</dt><dd>{a.newClients}</dd></div>
          <div><dt><MapPin aria-hidden="true" />تقارير عمل ميداني</dt><dd>{a.outdoorDaysCount}</dd></div>
          <div><dt><BadgeCheck aria-hidden="true" />الالتزام بالمواعيد والزي</dt><dd>{punctualityPct !== null ? `${punctualityPct}%` : '—'}</dd></div>
        </dl>
      </section>

      <div className="card daily-quality-card">
        <p className="input-label mb-1.5">جودة المواعيد بعد المراجعة</p>
        <p className="mb-2 text-xs text-secondary-500">عدد التقارير اليومية لكل تقييم</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(APPOINTMENTS_QUALITY_LABELS) as (keyof typeof APPOINTMENTS_QUALITY_LABELS)[]).map((q) => (
            <span key={q} className="badge badge-secondary">
              {APPOINTMENTS_QUALITY_LABELS[q]}: {a.appointmentsQualityCounts[q]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
