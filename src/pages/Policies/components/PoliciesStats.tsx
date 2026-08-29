import { ScrollText, ShieldCheck, XCircle, FilePlus2 } from 'lucide-react';
import type { PolicyStats } from '../services/policiesService';
import { StatsCard } from '../../../components/ui/StatsCard';
import { StatsCardSkeleton } from '../../../components/feedback/StatsCardSkeleton';

interface PoliciesStatsProps {
  stats: PolicyStats | null;
  statsLoading: boolean;
}

export function PoliciesStats({ stats, statsLoading }: PoliciesStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {statsLoading ? (
        <StatsCardSkeleton count={4} valueWidthClass="w-14" />
      ) : (
        <>
          <StatsCard
            label="إجمالي الوثائق"
            value={stats?.total ?? 0}
            icon={ScrollText}
            tone="brand"
            borderClassName="border-r-4 border-r-primary-500"
            iconClassName="w-4 h-4"
          />
          <StatsCard
            label="الوثائق النشطة"
            value={stats?.active ?? 0}
            icon={ShieldCheck}
            tone="success"
            borderClassName="border-r-4 border-r-success-500"
            iconClassName="w-4 h-4"
            valueClassName="font-bold text-success-600 mt-1.5"
          />
          <StatsCard
            label="الوثائق الملغاة"
            value={stats?.cancelled ?? 0}
            icon={XCircle}
            tone="danger"
            borderClassName="border-r-4 border-r-error-500"
            iconClassName="w-4 h-4"
            valueClassName="font-bold text-error-600 mt-1.5"
          />
          <StatsCard
            label="صادرة هذا الشهر"
            value={stats?.issuedThisMonth ?? 0}
            icon={FilePlus2}
            tone="info"
            borderClassName="border-r-4 border-r-info-500"
            iconClassName="w-4 h-4"
          />
        </>
      )}
    </div>
  );
}
