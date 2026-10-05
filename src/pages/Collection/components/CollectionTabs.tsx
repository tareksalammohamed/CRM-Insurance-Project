import {
  AlertTriangle,
  BellRing,
  CalendarCheck2,
  ChevronLeft,
  Layers3,
  ShieldCheck,
  Target,
} from 'lucide-react';
import clsx from 'clsx';
import type { CollectionQuickStats } from '../services/collectionService';
import { formatCurrency } from '../utils/formatCurrency';

type YearMode = 'year1' | 'year2';

interface CollectionTabsProps {
  yearMode: YearMode;
  onChange: (mode: YearMode) => void;
  quickStats: CollectionQuickStats | null;
  quickStatsLoading: boolean;
}

function MetricSkeleton() {
  return <span className="h-5 w-16 rounded-md skeleton-bar" aria-hidden="true" />;
}

/**
 * بوابة موحّدة بصرياً لمساري التحصيل فقط.
 *
 * مهم: كل كارت يفتح المسار الموجود أصلاً ولا يخلط بيانات أو قواعد السنة
 * الأولى مع السنة الثانية. بيانات السنة الثانية هنا تذكيرية للعرض فقط.
 */
export function CollectionTabs({
  yearMode,
  onChange,
  quickStats,
  quickStatsLoading,
}: CollectionTabsProps) {
  const year2Attention = quickStats?.year2AttentionPoliciesCount ?? 0;
  const year2Overdue = quickStats?.year2OverduePoliciesCount ?? 0;
  const year2Due = quickStats?.year2DuePoliciesCount ?? 0;

  return (
    <div role="tablist" aria-label="اختيار مسار التحصيل" className="collection-year-gateway">
      <button
        type="button"
        role="tab"
        aria-selected={yearMode === 'year1'}
        onClick={() => onChange('year1')}
        className={clsx(
          'collection-year-card collection-year-card--year1',
          yearMode === 'year1' && 'is-active',
        )}
      >
        <span className="collection-year-card__accent" aria-hidden="true" />
        <div className="collection-year-card__head">
          <span className="collection-year-card__icon" aria-hidden="true">
            <CalendarCheck2 />
          </span>

          <div className="collection-year-card__title-wrap">
            <span className="collection-year-card__eyebrow">مسار التحصيل الأساسي</span>
            <span className="collection-year-card__title">تحصيلات السنة الأولى</span>
          </div>

          <span className="collection-year-card__active-mark" aria-hidden="true">
            <ChevronLeft />
          </span>
        </div>

        <div className="collection-year-card__metrics">
          <div>
            <span className="collection-year-card__metric-label">مستحق هذا الشهر</span>
            {quickStatsLoading ? (
              <MetricSkeleton />
            ) : (
              <strong>{quickStats?.dueMonthCount ?? 0} قسط</strong>
            )}
          </div>
          <div>
            <span className="collection-year-card__metric-label">محصّل هذا الشهر</span>
            {quickStatsLoading ? (
              <MetricSkeleton />
            ) : (
              <strong>{formatCurrency(quickStats?.collectedMonthAmount || 0)}</strong>
            )}
          </div>
        </div>

        <div className="collection-year-card__rule collection-year-card__rule--target">
          <Target aria-hidden="true" />
          <span>هذا المسار يدخل ضمن مؤشرات الأداء والتارجت حسب القواعد الحالية</span>
        </div>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={yearMode === 'year2'}
        onClick={() => onChange('year2')}
        className={clsx(
          'collection-year-card collection-year-card--year2',
          yearMode === 'year2' && 'is-active',
          year2Attention > 0 && 'has-attention',
        )}
      >
        <span className="collection-year-card__accent" aria-hidden="true" />

        {year2Attention > 0 && !quickStatsLoading && (
          <span
            className={clsx(
              'collection-year-card__notification',
              year2Overdue > 0 && 'has-overdue',
            )}
            aria-label={`${year2Attention} استحقاق في السنة الثانية يحتاج تحصيل`}
          >
            <BellRing aria-hidden="true" />
            <strong>{year2Attention > 99 ? '99+' : year2Attention}</strong>
          </span>
        )}

        <div className="collection-year-card__head">
          <span className="collection-year-card__icon" aria-hidden="true">
            <Layers3 />
          </span>

          <div className="collection-year-card__title-wrap">
            <span className="collection-year-card__eyebrow">مسار التجديد والمتابعة</span>
            <span className="collection-year-card__title">السنة الثانية وما بعدها</span>
          </div>

          <span className="collection-year-card__active-mark" aria-hidden="true">
            <ChevronLeft />
          </span>
        </div>

        <div className="collection-year-card__metrics">
          <div>
            <span className="collection-year-card__metric-label">تحتاج تحصيل</span>
            {quickStatsLoading ? (
              <MetricSkeleton />
            ) : (
              <strong className={year2Attention > 0 ? 'text-warning-700' : undefined}>
                {year2Attention} حالة
              </strong>
            )}
          </div>
          <div>
            <span className="collection-year-card__metric-label">منها متأخر</span>
            {quickStatsLoading ? (
              <MetricSkeleton />
            ) : (
              <strong className={year2Overdue > 0 ? 'text-error-600' : undefined}>
                {year2Overdue}
              </strong>
            )}
          </div>
          <div className="collection-year-card__metric-wide">
            <span className="collection-year-card__metric-label">مستحق حاليًا</span>
            {quickStatsLoading ? (
              <MetricSkeleton />
            ) : (
              <strong>{year2Due}</strong>
            )}
          </div>
        </div>

        <div className="collection-year-card__rule collection-year-card__rule--isolated">
          <ShieldCheck aria-hidden="true" />
          <span>تحصيل منفصل — لا يدخل في التارجت أو المحقق</span>
          {year2Overdue > 0 && (
            <span className="collection-year-card__overdue-chip">
              <AlertTriangle aria-hidden="true" />
              {year2Overdue} متأخر
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
