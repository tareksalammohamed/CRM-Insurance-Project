import { useNavigate } from 'react-router-dom';
import { UsersRound, UserCheck, CalendarClock, UserPlus } from 'lucide-react';
import type { CustomerStats } from '../services/customersService';
import { StatsCard } from '../../../components/ui/StatsCard';
import { StatsCardSkeleton } from '../../../components/feedback/StatsCardSkeleton';
import { buildCollectionDrillDownUrl } from '../../Dashboard/utils';

interface CustomerStatsCardsProps {
  stats: CustomerStats | null;
  statsLoading: boolean;
}

export function CustomerStatsCards({ stats, statsLoading }: CustomerStatsCardsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {statsLoading ? (
        <StatsCardSkeleton count={4} valueWidthClass="w-14" />
      ) : (
        <>
          <StatsCard
            label="إجمالي العملاء"
            value={stats?.total ?? 0}
            icon={UsersRound}
            tone="brand"
            borderClassName="border-r-4 border-r-primary-500"
            iconClassName="w-4 h-4"
          />
          <StatsCard
            label="العملاء النشطون"
            value={stats?.active ?? 0}
            icon={UserCheck}
            tone="success"
            borderClassName="border-r-4 border-r-success-500"
            iconClassName="w-4 h-4"
            valueClassName="font-bold text-success-600 mt-1.5"
          />
          {/* بطاقة مرتبطة بحالة أقساط ⇒ قابلة للنقر وتفتح الأقساط المستحقة مباشرة */}
          <StatsCard
            label="لديهم أقساط مستحقة"
            value={stats?.withDueInstallments ?? 0}
            icon={CalendarClock}
            tone="warning"
            borderClassName="border-r-4 border-r-warning-500"
            iconClassName="w-4 h-4"
            valueClassName="font-bold text-warning-600 mt-1.5"
            onClick={() => navigate(buildCollectionDrillDownUrl({ quickFilter: 'month' }))}
            ariaLabel="عرض الأقساط المستحقة"
          />
          <StatsCard
            label="عملاء جدد هذا الشهر"
            value={stats?.newThisMonth ?? 0}
            icon={UserPlus}
            tone="info"
            borderClassName="border-r-4 border-r-info-500"
            iconClassName="w-4 h-4"
          />
        </>
      )}
    </div>
  );
}
