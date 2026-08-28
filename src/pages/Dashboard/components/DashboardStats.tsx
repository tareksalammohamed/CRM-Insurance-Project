import { useNavigate } from 'react-router-dom';
import { FileCheck, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardStats as DashboardStatsType } from '../types';
import { buildCollectionDrillDownUrl, formatCurrency } from '../utils';
import { StatsCard } from '../../../components/ui/StatsCard';

interface DashboardStatsProps {
  stats: DashboardStatsType | null;
  selectedMonth: Date;
}

interface DrillDownCardProps {
  label: string;
  icon: LucideIcon;
  paid: number;
  totalDue: number;
  subtype: 'new' | 'periodic';
  accent: string;
  iconClassName: string;
  selectedMonth: Date;
  onNavigate: (quickFilter: 'month' | 'paid', subtype: 'new' | 'periodic') => void;
}

function DrillDownCard({
  label,
  icon: Icon,
  paid,
  totalDue,
  subtype,
  accent,
  iconClassName,
  selectedMonth,
  onNavigate,
}: DrillDownCardProps) {
  const remaining = Math.max(0, totalDue - paid);

  return (
    <div className={`kpi-card ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs md:text-[13px] font-extrabold text-secondary-900 leading-5 min-w-0">{label}</p>
        <span className="kpi-icon-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Icon className={iconClassName} />
        </span>
      </div>

      <div className="mt-2.5 mb-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNavigate('paid', subtype)}
          className="drilldown-action text-right"
          aria-label={`عرض المسدد من ${label}`}
        >
          <span className="drilldown-action-label text-success-700">المسدد</span>
          <strong className="drilldown-action-value text-success-700">{formatCurrency(paid)}</strong>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('month', subtype)}
          className="drilldown-action text-right"
          aria-label={`عرض المتبقي من ${label}`}
        >
          <span className="drilldown-action-label text-warning-700">المتبقي</span>
          <strong className="drilldown-action-value text-warning-700">{formatCurrency(remaining)}</strong>
        </button>
      </div>

      <button
        type="button"
        onClick={() => onNavigate('month', subtype)}
        className="mt-auto flex w-full items-center justify-between gap-2 border-t border-secondary-100 pt-2 text-right"
        aria-label={`عرض إجمالي المستحق من ${label}`}
      >
        <span className="text-[11px] font-bold text-secondary-500 shrink-0">إجمالي المستحق</span>
        <span className="text-xs font-extrabold text-secondary-800 text-figure truncate">{formatCurrency(totalDue)}</span>
      </button>

      <span className="sr-only">شهر {selectedMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</span>
    </div>
  );
}

export function DashboardStats({ stats, selectedMonth }: DashboardStatsProps) {
  const navigate = useNavigate();

  const navigateToCollection = (quickFilter: 'month' | 'paid', subtype: 'new' | 'periodic', ownerFilter?: string) => {
    navigate(buildCollectionDrillDownUrl({ quickFilter, subType: subtype, ownerFilter, month: selectedMonth }));
  };

  return (
    <div className="dashboard-stats-grid grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <StatsCard
        label="العملاء"
        value={stats?.totalCustomers || 0}
        icon={UsersRound}
        borderClassName="border-r-4 border-r-info-500"
        iconClassName="w-4 h-4 text-info-500 shrink-0"
        labelClassName="text-xs md:text-sm text-secondary-900"
        onClick={() => navigate('/customers')}
      />

      <StatsCard
        label="الوثائق"
        value={stats?.totalPolicies || 0}
        icon={FileCheck}
        borderClassName="border-r-4 border-r-success-500"
        iconClassName="w-4 h-4 text-success-500 shrink-0"
        valueClassName="text-xl md:text-2xl font-bold text-success-600 mt-1.5"
        labelClassName="text-xs md:text-sm text-secondary-900"
        onClick={() => navigate('/policies')}
      />

      <DrillDownCard
        label="الإنتاج الجديد"
        icon={TrendingUp}
        paid={stats?.newProduction || 0}
        totalDue={stats?.newProductionTotal || 0}
        subtype="new"
        accent="border-r-4 border-r-warning-500"
        iconClassName="w-4 h-4 text-warning-500 shrink-0"
        selectedMonth={selectedMonth}
        onNavigate={navigateToCollection}
      />

      <DrillDownCard
        label="التحصيل الدوري"
        icon={WalletCards}
        paid={stats?.periodicCollection || 0}
        totalDue={stats?.periodicCollectionTotal || 0}
        subtype="periodic"
        accent="border-r-4 border-r-primary-500"
        iconClassName="w-4 h-4 text-primary-500 shrink-0"
        selectedMonth={selectedMonth}
        onNavigate={navigateToCollection}
      />
    </div>
  );
}
