import { memo, useEffect } from 'react';
import type { InstallmentWithRelations } from '../types';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { CollectionCard } from './CollectionCard';
import { CollectionGroupCard } from './CollectionGroupCard';
import { groupInstallmentsForDisplay } from '../business/collectionGrouping';
import { Pagination } from '../../../components/ui/Pagination';
import type { ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';

interface CollectionListProps {
  isInitialLoading: boolean;
  installments: InstallmentWithRelations[];
  hasActiveFilters: boolean;
  onResetSearchAndFilters: () => void;
  onPay: (installment: InstallmentWithRelations) => void;
  onPayGroup: (members: InstallmentWithRelations[]) => void;
  onCancel: (installment: InstallmentWithRelations) => void;
  onMore: (installment: InstallmentWithRelations, anchor: ActionMenuAnchor) => void;
  page: number;
  totalPages: number;
  onPageChange: (updater: (p: number) => number) => void;
  // معرّف قسط بعينه يُراد تمييزه والتمرير إليه — جاي من رابط إشعار خارجي
  highlightId?: string | null;
}

// ===== قائمة الأقساط (بطاقات) =====
// ملحوظة: الـ Skeleton يظهر فقط فى أول تحميل (لسه مفيش بيانات
// على الإطلاق). أما تحديثات الفلاتر/الصفحات اللاحقة فتحافظ على
// القائمة الحالية ظاهرة مع مؤشر تحديث بسيط بدل ما تختفي الشاشة
// بالكامل وتظهر Skeleton من جديد (وده كان سبب الرعشة عند كل
// تغيير فلتر أو صفحة).
//
// أقساط الوثائق الناتجة عن التقسيم التلقائي لوثيقة "حماية واستثمار" (نفس
// المجموعة + نفس تاريخ الاستحقاق) بتتجمّع فى كارت واحد (CollectionGroupCard)
// بدل ما تظهر كأقساط منفصلة — راجع business/collectionGrouping.ts
function CollectionListImpl({
  isInitialLoading,
  installments,
  hasActiveFilters,
  onResetSearchAndFilters,
  onPay,
  onPayGroup,
  onCancel,
  onMore,
  page,
  totalPages,
  onPageChange,
  highlightId = null,
}: CollectionListProps) {
  // تمرير وتمييز القسط المستهدف تلقائياً لما تحمّل نتائج البحث الجاي من الإشعار
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`collection-row-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, installments]);

  if (isInitialLoading) {
    return <LoadingState />;
  }

  if (installments.length === 0) {
    return <EmptyState hasActiveFilters={hasActiveFilters} onResetSearchAndFilters={onResetSearchAndFilters} />;
  }

  const entries = groupInstallmentsForDisplay(installments);

  return (
    <>
      <div className="col-list">
        {entries.map((entry) =>
          entry.kind === 'group' ? (
            <CollectionGroupCard key={entry.key} members={entry.members} onPayGroup={onPayGroup} />
          ) : (
            <CollectionCard
              key={entry.key}
              installment={entry.installment}
              onPay={onPay}
              onCancel={onCancel}
              onMore={onMore}
              highlighted={entry.installment.id === highlightId}
            />
          )
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}

// React.memo: يمنع إعادة رسم شبكة بطاقات الأقساط بالكامل عند إعادة رسم
// الصفحة لأسباب لا علاقة لها بالقائمة نفسها
export const CollectionList = memo(CollectionListImpl);
