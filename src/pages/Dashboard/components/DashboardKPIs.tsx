import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CalendarClock, ChevronLeft, Percent, TimerReset, TrendingUp, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardStats } from '../types';
import type { CancellationSummary } from '../../Cancellations/types';
import { buildCollectionDrillDownUrl, formatCurrency } from '../utils';

interface DashboardKPIsProps {
  stats: DashboardStats | null;
  cancellationSummary: CancellationSummary | null;
  selectedMonth: Date;
}

// ألوان بطاقة "معدل التحصيل" بتتغيّر حسب النسبة نفسها (مش لون ثابت زي باقي
// الكروت) عشان تدّي إشارة بصرية فورية: أخضر = تحصيل جيد، برتقالي = متوسط،
// أحمر = ضعيف ويحتاج متابعة. الحدود (80% / 50%) اختيار عملي بسيط قابل
// للتعديل لاحقاً لو الإدارة حبت تغيّره.
function collectionRateColor(rate: number): { border: string; text: string; label: string } {
  if (rate >= 80) return { border: 'border-r-success-500', text: 'text-success-600', label: 'تحصيل جيد' };
  if (rate >= 50) return { border: 'border-r-warning-500', text: 'text-warning-600', label: 'تحصيل متوسط' };
  return { border: 'border-r-error-500', text: 'text-error-600', label: 'يحتاج متابعة' };
}

interface KpiTileProps {
  label: string;
  value: string | number;
  note?: string;
  icon: LucideIcon;
  accentBorder: string;
  /** نبرة دلالية لحاوية الأيقونة (أخضر=مسدد، برتقالى=مستحق، أحمر=متأخر) */
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  iconClassName: string;
  valueClassName?: string;
  /** بلاطة قيادية: رقمها أكبر وإطارها أوضح — مش كل الـKPI بنفس الوزن البصرى */
  emphasis?: boolean;
  onClick: () => void;
  ariaLabel: string;
}

/**
 * بلاطة KPI واحدة قابلة للنقر — عزلناها فى مكوّن واحد بدل تكرار نفس
 * الماركب ٦ مرات، فالتسلسل البصري (عنوان صغير ← رقم بارز ← ملاحظة) يبقى
 * موحّد ومضمون على كل المقاسات. السلوك والروابط زي ما هى بالحرف.
 */
function KpiTile({
  label,
  value,
  note,
  icon: Icon,
  accentBorder,
  tone = 'brand',
  iconClassName,
  valueClassName = 'text-secondary-900',
  emphasis = false,
  onClick,
  ariaLabel,
}: KpiTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`kpi-card kpi-card-clickable pressable text-right w-full cursor-pointer border-r-4 ${accentBorder}${emphasis ? ' kpi-card-lead' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="metric-label min-w-0">{label}</p>
        <span
          className={`kpi-icon-tile kpi-icon-tile--${tone} flex h-9 w-9 shrink-0 items-center justify-center rounded-xl`}
          aria-hidden="true"
        >
          <Icon className={iconClassName} />
        </span>
      </div>
      <p className={`text-figure min-w-0 ${valueClassName}`}>{value}</p>
      {note && <p className="kpi-note line-clamp-2-safe">{note}</p>}
      <ChevronLeft className="kpi-card-cue" aria-hidden="true" />
    </button>
  );
}

export function DashboardKPIs({ stats, cancellationSummary, selectedMonth }: DashboardKPIsProps) {
  const navigate = useNavigate();
  const openCollection = (quickFilter: 'month' | 'overdue' | 'paid') => {
    navigate(buildCollectionDrillDownUrl({ quickFilter, month: selectedMonth }));
  };
  const rate = stats?.collectionRate ?? 0;
  const rateColor = collectionRateColor(rate);

  return (
    <>
      <div className="dashboard-kpis-grid grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiTile
          label="معدل التحصيل الشهري"
          value={`${rate}%`}
          note={`${rateColor.label} — ${formatCurrency(stats?.paidInstallments || 0)} مسدد`}
          icon={TrendingUp}
          accentBorder={rateColor.border}
          tone={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}
          iconClassName="w-4 h-4 shrink-0"
          valueClassName={rateColor.text}
          emphasis
          onClick={() => openCollection('month')}
          ariaLabel={`معدل التحصيل الشهري ${rate}% — عرض أقساط الشهر`}
        />

        <KpiTile
          label="الأقساط المستحقة"
          value={formatCurrency(stats?.dueInstallments || 0)}
          note={`${stats?.dueInstallmentsCount || 0} قسط`}
          icon={CalendarClock}
          accentBorder="border-r-warning-500"
          tone="warning"
          iconClassName="w-4 h-4 shrink-0"
          onClick={() => openCollection('month')}
          ariaLabel="عرض الأقساط المستحقة"
        />

        <KpiTile
          label="الأقساط المتأخرة"
          value={formatCurrency(stats?.overdueInstallments || 0)}
          note={`${stats?.overdueInstallmentsCount || 0} قسط`}
          icon={TimerReset}
          accentBorder="border-r-error-500"
          tone="danger"
          iconClassName="w-4 h-4 shrink-0"
          onClick={() => openCollection('overdue')}
          ariaLabel="عرض الأقساط المتأخرة"
        />

        <KpiTile
          label="الأقساط المسددة"
          value={formatCurrency(stats?.paidInstallments || 0)}
          note={`${stats?.paidInstallmentsCount || 0} قسط`}
          icon={BadgeCheck}
          accentBorder="border-r-success-500"
          tone="success"
          iconClassName="w-4 h-4 shrink-0"
          valueClassName="text-success-600"
          onClick={() => openCollection('paid')}
          ariaLabel="عرض الأقساط المسددة"
        />
      </div>

      <div className="dashboard-kpis-secondary grid grid-cols-2 gap-3 md:gap-4">
        <KpiTile
          label="نسبة الإلغاءات"
          value={`${cancellationSummary?.cancellationRate ?? 0}%`}
          icon={Percent}
          accentBorder="border-r-error-500"
          tone="danger"
          iconClassName="w-4 h-4 shrink-0"
          valueClassName="text-error-600"
          onClick={() => navigate('/cancellations')}
          ariaLabel="عرض صفحة الإلغاءات"
        />

        <KpiTile
          label="قيمة الإلغاءات"
          value={formatCurrency(cancellationSummary?.cancelledValue || 0)}
          icon={XCircle}
          accentBorder="border-r-error-500"
          tone="danger"
          iconClassName="w-4 h-4 shrink-0"
          valueClassName="text-error-600"
          onClick={() => navigate('/cancellations')}
          ariaLabel="عرض قيمة الإلغاءات"
        />
      </div>
    </>
  );
}
