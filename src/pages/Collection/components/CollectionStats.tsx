import { useNavigate } from 'react-router-dom';
import { CalendarClock, BadgeCheck, Banknote, ListChecks } from 'lucide-react';
import type { CollectionQuickStats } from '../services/collectionService';
import { formatCurrency } from '../utils/formatCurrency';
import { KpiTile } from './KpiTile';
import { buildCollectionDrillDownUrl } from '../../Dashboard/utils';

interface CollectionStatsProps {
  quickStats: CollectionQuickStats | null;
  quickStatsLoading: boolean;
}

// هيكل تحميل مطابق لأبعاد البلاطة الحقيقية — يمنع أى \"قفزة\" فى التخطيط
// لحظة وصول البيانات.
function BoardSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="col-kpi col-tone-brand skeleton-shimmer">
          <div className="col-kpi-top">
            <div className="h-3 w-16 skeleton-bar rounded" />
            <div className="h-8 w-8 skeleton-bar rounded-xl" />
          </div>
          <div className="h-6 w-20 skeleton-bar rounded" />
          <div className="h-2.5 w-24 skeleton-bar rounded" />
        </div>
      ))}
    </>
  );
}

// ===== لوح مؤشرات التحصيل (KPI Board) =====
//
// كل بلاطة هنا ترجع لحالة أقساط فعلية، فكلها قابلة للنقر وتفتح نفس الصفحة
// بالفلتر المقابل مباشرة (?quickFilter=) — نفس منظومة الفلترة الموجودة أصلاً
// (buildCollectionDrillDownUrl + useCollectionUrlParams) بدون أى نظام فلترة
// جديد وبدون أى تغيير فى الاستعلامات أو الحسابات أو قاعدة البيانات.
//
// كل القيم المعروضة تأتى كما هى من quickStats — لا حساب ولا اشتقاق جديد هنا.
export function CollectionStats({ quickStats, quickStatsLoading }: CollectionStatsProps) {
  const navigate = useNavigate();
  const openFiltered = (quickFilter: 'month' | 'overdue' | 'paid') => {
    navigate(buildCollectionDrillDownUrl({ quickFilter }));
  };

  return (
    <div className="col-board">
      {quickStatsLoading ? (
        <BoardSkeleton />
      ) : (
        <>
          <KpiTile
            label="المستحق هذا الشهر"
            value={formatCurrency(quickStats?.dueMonthAmount || 0)}
            icon={CalendarClock}
            tone="due"
            onClick={() => openFiltered('month')}
            ariaLabel="عرض الأقساط المستحقة هذا الشهر"
            footer={
              <>
                <span>
                  من إجمالي{' '}
                  <span className="col-kpi-foot-strong">
                    {formatCurrency(quickStats?.totalDueMonthAmount || 0)}
                  </span>
                </span>
                {(quickStats?.dueMonthCount ?? 0) > 0 && (
                  <span className="col-kpi-chip">{quickStats?.dueMonthCount} قسط</span>
                )}
              </>
            }
          />

          <KpiTile
            label="محصَّل اليوم"
            value={formatCurrency(quickStats?.collectedTodayAmount || 0)}
            icon={BadgeCheck}
            tone="paid"
            valueTone="success"
            onClick={() => openFiltered('paid')}
            ariaLabel="عرض الأقساط التي تم سدادها"
            footer={
              <>
                <span>حركة التحصيل اليوم</span>
                {(quickStats?.collectedTodayCount ?? 0) > 0 && (
                  <span className="col-kpi-chip">{quickStats?.collectedTodayCount} قسط</span>
                )}
              </>
            }
          />

          <KpiTile
            label="إجمالي المسدد خلال الشهر"
            value={formatCurrency(quickStats?.collectedMonthAmount || 0)}
            icon={Banknote}
            tone="brand"
            onClick={() => openFiltered('paid')}
            ariaLabel="عرض إجمالي الأقساط المسددة خلال الشهر الحالي"
            footer={<span>مسدَّد فعليًا هذا الشهر</span>}
          />

          <KpiTile
            label="أقساط محصلة اليوم"
            value={quickStats?.collectedTodayCount ?? 0}
            icon={ListChecks}
            tone="info"
            onClick={() => openFiltered('paid')}
            ariaLabel="عرض عدد الأقساط المحصلة اليوم"
            footer={<span>عدد عمليات السداد المسجَّلة</span>}
          />
        </>
      )}
    </div>
  );
}
