import { CalendarClock, BadgeCheck, UserPlus, MapPin, Phone, PhoneCall, CalendarCheck2 } from 'lucide-react';

import { StatsCard } from '../../../components/ui/StatsCard';
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
      <div className="card">
        {title && <h3 className="font-bold text-secondary-900 mb-2">{title}</h3>}
        <p className="text-sm text-secondary-400 text-center py-4">لا توجد إحصائيات مسجّلة لهذه الفترة</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && <h3 className="font-bold text-secondary-900">{title}</h3>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatsCard
          label="أيام مسجّلة"
          value={a.entriesCount}
          icon={CalendarClock}
          tone="brand"
          borderClassName="border-r-4 border-r-primary-500"
          iconClassName="w-4 h-4"
        />
        <StatsCard
          label="الالتزام بالمواعيد والزي الرسمي"
          value={punctualityPct !== null ? `${punctualityPct}%` : '—'}
          icon={BadgeCheck}
          tone="success"
          borderClassName="border-r-4 border-r-success-500"
          iconClassName="w-4 h-4"
          valueClassName="font-bold text-success-600 mt-1.5"
        />
        <StatsCard
          label="عملاء جدد (طلبات تأمين)"
          value={a.newClients}
          icon={UserPlus}
          tone="info"
          borderClassName="border-r-4 border-r-info-500"
          iconClassName="w-4 h-4"
        />
        <StatsCard
          label="أيام عمل outdoor"
          value={a.outdoorDaysCount}
          icon={MapPin}
          tone="warning"
          borderClassName="border-r-4 border-r-warning-500"
          iconClassName="w-4 h-4"
          valueClassName="font-bold text-warning-600 mt-1.5"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatsCard
          label="إجمالي المكالمات"
          value={a.callsActual}
          icon={Phone}
          tone="brand"
          borderClassName="border-r-4 border-r-primary-500"
          iconClassName="w-4 h-4"
        />
        <StatsCard
          label="مكالمات نتج عنها مواعيد"
          value={a.callsToAppointments}
          icon={PhoneCall}
          tone="info"
          borderClassName="border-r-4 border-r-info-500"
          iconClassName="w-4 h-4"
        />
        <StatsCard
          label="إجمالي المواعيد الفعلية"
          value={a.appointmentsActual}
          icon={CalendarCheck2}
          tone="success"
          borderClassName="border-r-4 border-r-success-500"
          iconClassName="w-4 h-4"
          valueClassName="font-bold text-success-600 mt-1.5"
        />
      </div>

      <div className="card">
        <p className="input-label mb-1.5">جودة المواعيد بعد المراجعة</p>
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
