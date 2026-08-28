import { format, startOfMonth } from 'date-fns';

// لوحة التحكم تعرض أرقامًا صحيحة بدون كسور — نفس المخرجات السابقة بالحرف،
// لكن من مصدر تنسيق موحّد واحد بدل تعريف مكرّر فى كل صفحة.
export { formatCurrencyWhole as formatCurrency } from '../../lib/formatCurrency';

type DrillDownQuickFilter = 'month' | 'overdue' | 'paid';
type DrillDownSubType = 'all' | 'new' | 'periodic';

interface CollectionDrillDownOptions {
  quickFilter: DrillDownQuickFilter;
  subType?: DrillDownSubType;
  ownerFilter?: string;
  month?: Date;
}

/**
 * يبني رابط صفحة التحصيل من نفس فلاتر الخدمة الفعلية، حتى تكون كل أرقام
 * لوحة التحكم وبطاقات الفريق قابلة للفتح على الأقساط المطابقة لها فعلاً.
 */
export function buildCollectionDrillDownUrl({
  quickFilter,
  subType = 'all',
  ownerFilter,
  month,
}: CollectionDrillDownOptions): string {
  const params = new URLSearchParams({ quickFilter });
  if (subType !== 'all') params.set('subType', subType);
  if (ownerFilter) params.set('ownerFilter', ownerFilter);
  if (month) params.set('month', format(startOfMonth(month), 'yyyy-MM-dd'));
  return `/collection?${params.toString()}`;
}
