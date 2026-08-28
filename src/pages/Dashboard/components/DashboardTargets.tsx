import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Goal, Flag, Receipt } from 'lucide-react';
import type { DashboardStats } from '../types';
import { buildCollectionDrillDownUrl, formatCurrency } from '../utils';

interface DashboardTargetsProps {
  stats: DashboardStats | null;
  selectedMonth: Date;
}

export function DashboardTargets({ stats, selectedMonth }: DashboardTargetsProps) {
  const navigate = useNavigate();
  const openPaid = () => navigate(buildCollectionDrillDownUrl({ quickFilter: 'paid', month: selectedMonth }));
  const achievementRate = stats?.achievementRate || 0;

  return (
    <div className="card dashboard-targets-panel">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <span className="dashboard-kicker">مستهدفات الشهر</span>
          <h3 className="dashboard-section-title text-base md:text-lg">التارجت</h3>
        </div>
        <span className="target-summary-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
          <Goal className="h-5 w-5" />
        </span>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <span className="metric-label">نسبة الإنجاز</span>
          <span className="text-figure text-xl md:text-2xl font-extrabold text-secondary-900">
            {achievementRate}%
          </span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={Math.min(100, achievementRate)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="نسبة إنجاز تارجت الشهر"
        >
          <div
            className="progress-fill progress-fill-brand"
            style={{ width: `${Math.min(100, achievementRate)}%` }}
          />
        </div>
        <div className="progress-meta">
          <span>المحقق: <strong>{formatCurrency(stats?.achieved || 0)}</strong></span>
          <span>التارجت: <strong>{formatCurrency(stats?.target || 0)}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <button
          type="button"
          onClick={openPaid}
          className="drilldown-card target-metric-card bg-success-50 text-center"
          aria-label="عرض الأقساط المسددة المحققة"
        >
          <BadgeCheck className="w-8 h-8 text-success-600 mx-auto mb-2" />
          <p className="text-figure text-success-700">{formatCurrency(stats?.achieved || 0)}</p>
          <p className="text-[11px] font-semibold text-success-700/80 mt-1">المحقق</p>
        </button>
        <div className="drilldown-card target-metric-card bg-warning-50 text-center">
          <Flag className="w-8 h-8 text-warning-600 mx-auto mb-2" />
          <p className="text-figure text-warning-700">{formatCurrency(stats?.remaining || 0)}</p>
          <p className="text-[11px] font-semibold text-warning-700/80 mt-1">المتبقي للهدف</p>
        </div>
        <button
          type="button"
          onClick={openPaid}
          className="drilldown-card target-metric-card bg-info-50 text-center"
          aria-label="عرض الأقساط المسددة"
        >
          <Receipt className="w-8 h-8 text-info-600 mx-auto mb-2" />
          <p className="text-figure text-info-700">{stats?.paidInstallmentsCount || 0}</p>
          <p className="text-[11px] font-semibold text-info-700/80 mt-1">أقساط مسددة</p>
        </button>
      </div>
    </div>
  );
}
