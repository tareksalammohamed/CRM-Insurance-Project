import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../../../lib/supabase';
import type { QuickFilter, SubType, OwnerFilter, InstallmentWithRelations } from '../types';
import { fetchInstallments, cancelSeverelyOverduePolicies } from '../services/collectionService';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';

interface UseCollectionInstallmentsArgs {
  user: User | null | undefined;
  yearMode: 'year1' | 'year2' | null;
  quickFilter: QuickFilter;
  subType: SubType;
  ownerFilter: OwnerFilter;
  branchId?: string | null;
  monthStart?: string | null;
}

export function useCollectionInstallments({ user, yearMode, quickFilter, subType, ownerFilter, branchId = null, monthStart = null }: UseCollectionInstallmentsArgs) {
  const [installments, setInstallments] = useState<InstallmentWithRelations[]>([]);
  const [loading, setLoading]           = useState(true);
  // أول تحميل فقط (لسه مفيش أي بيانات) هو اللي يستحق Skeleton كامل —
  // أي تحديث لاحق (تغيير فلتر/صفحة/بحث) يحافظ على البيانات الحالية ظاهرة
  const isInitialLoading = loading && installments.length === 0;
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  // مرجع حي لآخر قيمة مُطبَّقة للبحث — بيُستخدم فى الـdebounce تحت فقط
  // للمقارنة، بدون ما يكون dependency للمؤقت نفسه.
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const loadInstallments = useCallback(async () => {
    setLoading(true);
    try {
      // فحص وإلغاء أي وثيقة فاتها 3 شهور أو أكثر على قسط غير مسدد — قبل عرض
      // فلتر "المتأخر"، عشان الوثائق دي تختفي منه أول ما توصل للحد ده.
      // بيتنفذ هنا (عند فتح الصفحة) بدل جدولة دورية غير متاحة حالياً.
      try {
        await cancelSeverelyOverduePolicies();
      } catch (err) {
        // فشل هذا الفحص لا يجب أن يمنع عرض بيانات التحصيل نفسها
        console.error('Error cancelling severely overdue policies:', err);
      }

      const { installments: results, totalCount: count, totalPages: pages } =
        await fetchInstallments({ quickFilter, subType, ownerFilter, page, searchQuery, branchId, monthStart });

      setInstallments(results);
      setTotalCount(count);
      setTotalPages(pages);
    } catch (error) {
      console.error('Error loading installments:', error);
    } finally {
      setLoading(false);
    }
  }, [quickFilter, subType, ownerFilter, page, searchQuery, branchId, monthStart]);

  // نفس شروط التحميل بالظبط زي ما كانت: أي تغيير فى الفلاتر/الصفحة/البحث
  // بيغيّر مرجع loadInstallments (useCallback فوق بنفس الـdeps القديمة
  // للـeffect ده)، فالسلوك متطابق تمامًا — الفرق إن الاعتمادية بقت معلنة
  // بشكل صحيح بدل eslint-disable.
  useEffect(() => {
    if (user && yearMode === 'year1') loadInstallments();
  }, [user, yearMode, loadInstallments]);

  // تأخير بسيط (debounce) لتقليل عدد طلبات البحث أثناء الكتابة.
  // المؤقت لازم يعتمد على `localSearch` فقط — إضافة `searchQuery` للـdeps
  // كانت هتعيد تشغيل المؤقت لحظة تطبيق البحث نفسه (لأن الـeffect بيعدّلها)،
  // فبيتولد مؤقت زيادة بلا داعٍ. القيمة الحالية للمقارنة بتتقرأ من الـref.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQueryRef.current) {
        setSearchQuery(localSearch);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  useReconnectRefetch(() => { if (user && yearMode === 'year1') loadInstallments(); });

  return {
    installments,
    loading,
    isInitialLoading,
    page,
    setPage,
    totalPages,
    totalCount,
    searchQuery,
    localSearch,
    setLocalSearch,
    loadInstallments,
  };
}
