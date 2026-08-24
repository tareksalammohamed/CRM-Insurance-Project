import { useSearchParams } from 'react-router-dom';
import { isValid, parseISO } from 'date-fns';
import type { QuickFilter, SubType, OwnerFilter } from '../types';

interface CollectionUrlParams {
  initialSubType: SubType;
  initialQuickFilter: QuickFilter;
  initialOwnerFilter: OwnerFilter;
  initialMonth: string | null;
  hasUrlNavigation: boolean;
}

// روابط لوحة التحكم القديمة كانت بتستخدم ?tab=new_production أو ?tab=periodic
// — بنحوّلها هنا لنفس الفلتر السريع الجديد المقابل تماماً بدون أي فرق فى النتيجة
//
// Navigation ذكي من لوحة التحكم: بطاقات "الأقساط المستحقة/المسددة/المتأخرة"
// بتفتح الصفحة دي مباشرة مع نفس الفلتر المقابل عبر ?quickFilter=
export function useCollectionUrlParams(): CollectionUrlParams {
  const [searchParams] = useSearchParams();

  const tabFromUrl = searchParams.get('tab');
  const subTypeFromUrl = searchParams.get('subType');
  const initialSubType: SubType =
    subTypeFromUrl === 'new' || tabFromUrl === 'new_production'
      ? 'new'
      : subTypeFromUrl === 'periodic' || tabFromUrl === 'periodic'
        ? 'periodic'
        : 'all';

  const quickFilterFromUrl = searchParams.get('quickFilter');
  const initialQuickFilter: QuickFilter =
    quickFilterFromUrl === 'overdue' ? 'overdue' : quickFilterFromUrl === 'paid' ? 'paid' : 'month';

  const ownerFromUrl = searchParams.get('ownerFilter');
  const initialOwnerFilter: OwnerFilter = ownerFromUrl?.trim() || 'all';

  const monthFromUrl = searchParams.get('month');
  const initialMonth = monthFromUrl && isValid(parseISO(monthFromUrl)) ? monthFromUrl : null;

  const hasUrlNavigation = Boolean(
    tabFromUrl || subTypeFromUrl || quickFilterFromUrl || ownerFromUrl || initialMonth
  );

  return { initialSubType, initialQuickFilter, initialOwnerFilter, initialMonth, hasUrlNavigation };
}
