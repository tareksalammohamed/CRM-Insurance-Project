import { useNavigate } from 'react-router-dom';
import { CalendarClock, BadgeCheck, Banknote, ListChecks } from 'lucide-react';
import type { CollectionQuickStats } from '../services/collectionService';
import { formatCurrency } from '../utils/formatCurrency';
import { StatsCard } from '../../../components/ui/StatsCard';
import { StatsCardSkeleton } from '../../../components/feedback/StatsCardSkeleton';
import { buildCollectionDrillDownUrl } from '../../Dashboard/utils';

interface CollectionStatsProps {
  quickStats: CollectionQuickStats | null;
  quickStatsLoading: boolean;
}

// ===== بطاقات إحصائية سريعة (لحظية من Supabase) =====
//
// كل بطاقة هنا بترجع لحالة أقساط فعلية، فبقت كلها قابلة للنقر وتفتح نفس
// الصفحة بالفلتر المقابل مباشرة (?quickFilter=) — نفس منظومة الفلترة
// الموجودة أصلاً (buildCollectionDrillDownUrl + useCollectionUrlParams)
// بدون أى نظام فلترة جديد وبدون أى تغيير فى الاستعلامات أو قاعدة البيانات.
export function CollectionStats({ quickStats, quickStatsLoading }: CollectionStatsProps) {
  const navigate = useNavigate();
  const openFiltered = (quickFilter: 'month' | 'overdue' | 'paid') => {
    navigate(buildCollectionDrillDownUrl({ quickFilter }));
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {quickStatsLoading ? (
        <StatsCardSkeleton count={4} valueWidthClass="w-16" />
      ) : (
        <>
          <StatsCard
            label="المستحق"
            value={formatCurrency(quickStats?.dueMonthAmount || 0)}
            icon={CalendarClock}
            tone="warning"
            borderClassName="border-r-4 border-r-warning-500"
            iconClassName="w-4 h-4 shrink-0"
            valueClassName="font-bold text-secondary-900 mt-1.5"
            onClick={() => openFiltered('month')}
            ariaLabel="عرض الأقساط المستحقة هذا الشهر"
            footer={
              <p className="kpi-note">
                من إجمالي {formatCurrency(quickStats?.totalDueMonthAmount || 0)}
              </p>
            }
          />
          <StatsCard
            label="محصَّل اليوم"
            value={formatCurrency(quickStats?.collectedTodayAmount || 0)}
            icon={BadgeCheck}
            tone="success"
            borderClassName="border-r-4 border-r-success-500"
            iconClassName="w-4 h-4 shrink-0"
            valueClassName="font-bold text-success-600 mt-1.5"
            onClick={() => openFiltered('paid')}
            ariaLabel="عرض الأقساط التي تم سدادها"
          />
          <StatsCard
            label="إجمالي المسدد خلال الشهر الحالي"
            value={formatCurrency(quickStats?.collectedMonthAmount || 0)}
            icon={Banknote}
            tone="success"
            borderClassName="border-r-4 border-r-primary-500"
            iconClassName="w-4 h-4 shrink-0"
            valueClassName="font-bold text-secondary-900 mt-1.5"
            onClick={() => openFiltered('paid')}
            ariaLabel="عرض إجمالي الأقساط المسددة خلال الشهر الحالي"
          />
          <StatsCard
            label="أقساط محصلة اليوم"
            value={quickStats?.collectedTodayCount ?? 0}
            icon={ListChecks}
            tone="info"
            borderClassName="border-r-4 border-r-info-500"
            iconClassName="w-4 h-4 shrink-0"
            valueClassName="font-bold text-secondary-900 mt-1.5"
            onClick={() => openFiltered('paid')}
            ariaLabel="عرض عدد الأقساط المحصلة اليوم"
          />
        </>
      )}
    </div>
  );
}
