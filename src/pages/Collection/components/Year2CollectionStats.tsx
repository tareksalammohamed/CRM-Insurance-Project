import { AlertTriangle, Banknote, BellRing, History, ListChecks } from 'lucide-react';
import type { CollectionQuickStats } from '../services/collectionService';
import { formatCurrency } from '../utils/formatCurrency';
import { KpiTile } from './KpiTile';

interface Year2CollectionStatsProps {
  quickStats: CollectionQuickStats | null;
  quickStatsLoading: boolean;
}

function BoardSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="col-kpi col-tone-brand skeleton-shimmer">
          <div className="col-kpi-top">
            <div className="h-3 w-24 skeleton-bar rounded" />
            <div className="h-8 w-8 skeleton-bar rounded-xl" />
          </div>
          <div className="h-6 w-24 skeleton-bar rounded" />
          <div className="h-2.5 w-28 skeleton-bar rounded" />
        </div>
      ))}
    </>
  );
}

export function Year2CollectionStats({ quickStats, quickStatsLoading }: Year2CollectionStatsProps) {
  return (
    <section aria-label="مؤشرات تحصيل السنة الثانية وما بعدها" className="space-y-2.5">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="col-panel-title">
            <History aria-hidden="true" />
            <span>مؤشرات السنة الثانية وما بعدها</span>
          </h2>
          <p className="text-xs text-secondary-500 mt-1">ملخص مستقل للتحصيلات اللاحقة، منفصل عن مؤشرات السنة الأولى</p>
        </div>
      </div>

      <div className="col-board">
        {quickStatsLoading ? (
          <BoardSkeleton />
        ) : (
          <>
            <KpiTile
              label="تحتاج تحصيل"
              value={quickStats?.year2AttentionPoliciesCount ?? 0}
              icon={BellRing}
              tone="due"
              footer={
                <span>
                  مستحق + متأخر من أصل {quickStats?.year2EligiblePoliciesCount ?? 0} وثيقة مؤهلة
                </span>
              }
            />
            <KpiTile
              label="متأخر"
              value={quickStats?.year2OverduePoliciesCount ?? 0}
              icon={AlertTriangle}
              tone="overdue"
              valueTone={(quickStats?.year2OverduePoliciesCount ?? 0) > 0 ? 'danger' : undefined}
              footer={<span>يحتاج متابعة قبل التحصيلات الجديدة</span>}
            />
            <KpiTile
              label="محصل هذا الشهر"
              value={formatCurrency(quickStats?.year2CollectedMonthAmount || 0)}
              icon={Banknote}
              tone="paid"
              valueTone="success"
              footer={<span>تحصيل منفصل — لا يدخل في التارجت</span>}
            />
            <KpiTile
              label="عمليات التحصيل هذا الشهر"
              value={quickStats?.year2CollectedMonthCount ?? 0}
              icon={ListChecks}
              tone="info"
              footer={<span>عدد عمليات السداد المسجلة للسنوات اللاحقة</span>}
            />
          </>
        )}
      </div>
    </section>
  );
}
