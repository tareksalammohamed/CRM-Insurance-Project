import { isAbortedRead } from '../../../lib/adaptiveReads';
import { directRead, type AdaptiveRead } from '../../../lib/adaptiveReads';
import { friendlyError } from '../../../lib/errorMessages';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../../../lib/supabase';
import type { QuickFilter, SubType, OwnerFilter, InstallmentWithRelations } from '../types';
import { fetchInstallments } from '../services/collectionService';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';

interface UseCollectionInstallmentsArgs {
  read?: AdaptiveRead;
  user: User | null | undefined;
  ensureMaintenance: () => Promise<void>;
  yearMode: 'year1' | 'year2' | null;
  quickFilter: QuickFilter;
  subType: SubType;
  ownerFilter: OwnerFilter;
  branchId?: string | null;
  monthStart?: string | null;
  initialSearch?: string | null;
}

export function useCollectionInstallments({ user, ensureMaintenance, yearMode, quickFilter, subType, ownerFilter, branchId = null, monthStart = null, initialSearch = null, read = directRead }: UseCollectionInstallmentsArgs) {
  const [installments, setInstallments] = useState<InstallmentWithRelations[]>([]);
  const [loading, setLoading]           = useState(true);
  // أول تحميل فقط (لسه مفيش أي بيانات) هو اللي يستحق Skeleton كامل —
  // أي تحديث لاحق (تغيير فلتر/صفحة/بحث) يحافظ على البيانات الحالية ظاهرة
  const isInitialLoading = loading && installments.length === 0;
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [localSearch, setLocalSearch] = useState(initialSearch || '');

  // مرجع حي لآخر قيمة مُطبَّقة للبحث — بيُستخدم فى الـdebounce تحت فقط
  // للمقارنة، بدون ما يكون dependency للمؤقت نفسه.
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const requestId = useRef(0);
  const loadInstallments = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const { installments: results, totalCount: count, totalPages: pages, loadMessage: message } =
        await read(async () => {
          await ensureMaintenance();
          if (currentRequest !== requestId.current) throw Object.assign(new Error('قراءة قديمة'), { name: 'AbortError' });
          return fetchInstallments({ quickFilter, subType, ownerFilter, page, searchQuery, branchId, monthStart });
        }, 0, () => currentRequest === requestId.current);

      if (currentRequest !== requestId.current) return;
      setInstallments(results);
      setLoadMessage(message ?? null);
      setTotalCount(count);
      setTotalPages(pages);
    } catch (error) {
      if (isAbortedRead(error)) return;
      console.error('Error loading installments:', error);
      if (currentRequest === requestId.current) setLoadMessage(friendlyError(error, 'تعذر تحميل التحصيلات، أعد المحاولة'));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [ensureMaintenance, quickFilter, subType, ownerFilter, page, searchQuery, branchId, monthStart, read]);

  // نفس شروط التحميل بالظبط زي ما كانت: أي تغيير فى الفلاتر/الصفحة/البحث
  // بيغيّر مرجع loadInstallments (useCallback فوق بنفس الـdeps القديمة
  // للـeffect ده)، فالسلوك متطابق تمامًا — الفرق إن الاعتمادية بقت معلنة
  // بشكل صحيح بدل eslint-disable.
  useEffect(() => {
    if (user && yearMode === 'year1') void loadInstallments();
    return () => { requestId.current += 1; };
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
    loadMessage,
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
