import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Banknote, ChevronLeft, ClipboardList, History, RefreshCw, Wallet } from 'lucide-react';
import { useBranchContext } from '../../../lib/branchContext';
import { LoadNotice } from '../../../components/feedback/LoadNotice';
import { formatCurrency } from '../utils';
import { localDateKey } from '../../../lib/inputGuidance';

export function DashboardPriorities({ userId }: { userId: string }) {
  const { currentBranchId } = useBranchContext();
  const today = localDateKey(new Date());
  const customers = useQuery({
    queryKey: ['dashboard-priorities', userId, currentBranchId, today, 'customers'],
    queryFn: async () => (await import('../../Customers/services/customersService')).fetchCustomerStats(userId, currentBranchId),
    staleTime: 60_000,
  });
  const collection = useQuery({
    queryKey: ['dashboard-priorities', userId, currentBranchId, today, 'collection'],
    queryFn: async () => (await import('../../Collection/services/collectionService')).fetchCollectionQuickStats(currentBranchId),
    staleTime: 60_000,
  });
  const refresh = () => { void customers.refetch(); void collection.refetch(); };
  const customerReady = customers.data && !['error', 'offline-empty'].includes(customers.data.readStatus ?? 'error');
  const collectionReady = collection.data && !['error', 'offline-empty'].includes(collection.data.readStatus ?? 'error');
  const customerValue = customerReady ? String(customers.data!.noPolicyCount) : customers.isPending ? '…' : 'غير متاح';
  const collectionValue = (value: number | undefined, money = false) => collectionReady ? (money ? formatCurrency(value ?? 0) : String(value ?? 0)) : collection.isPending ? '…' : 'غير متاح';
  const message = customers.isError || collection.isError ? 'تعذر تحديث بعض مؤشرات المتابعة. أعد المحاولة.' : customers.data?.loadMessage ?? collection.data?.loadMessage ?? null;
  return <section className="dashboard-priorities" aria-labelledby="dashboard-priorities-title">
    <div className="dashboard-priorities-heading">
      <div><span>متابعة التشغيل الحالية</span><h2 id="dashboard-priorities-title">إيه المطلوب متابعته؟</h2><p>حسب صلاحياتك والفرع المختار · بيانات اليوم والشهر الحالي</p></div>
      <button type="button" className="btn btn-ghost btn-sm" disabled={customers.isFetching || collection.isFetching} onClick={refresh} aria-label="تحديث مؤشرات المتابعة"><RefreshCw className={`w-4 h-4 ${customers.isFetching || collection.isFetching ? 'animate-spin' : ''}`} /><span>تحديث</span></button>
    </div>
    <LoadNotice message={message} loading={customers.isFetching || collection.isFetching} onRetry={refresh} />
    <div className="dashboard-priority-grid">
      <Link to="/customers?noPolicy=1" className="dashboard-priority-card" aria-busy={customers.isFetching}>
        <span className="dashboard-priority-icon"><ClipboardList aria-hidden="true" /></span><h3>طلبات بدون وثائق</h3><strong>{customerValue}</strong><p>عملاء مسجلون لم ترتبط بهم أي وثيقة بعد</p><span className="dashboard-priority-action">مراجعة طلبات الإصدار<ChevronLeft aria-hidden="true" /></span>
      </Link>
      <Link to="/collection?year=year2" className="dashboard-priority-card" aria-busy={collection.isFetching}>
        <span className="dashboard-priority-icon"><History aria-hidden="true" /></span><h3>تجديدات تحتاج تحصيلًا</h3><strong>{collectionValue(collection.data?.year2AttentionPoliciesCount)}</strong><p>{collectionReady ? `منها ${collection.data!.year2OverduePoliciesCount} وثيقة متأخرة` : 'السنة الثانية وما بعدها'}</p><span className="dashboard-priority-action">فتح تحصيل التجديدات<ChevronLeft aria-hidden="true" /></span>
      </Link>
      <div className="dashboard-priority-card" aria-busy={collection.isFetching}>
        <span className="dashboard-priority-icon"><Banknote aria-hidden="true" /></span><h3>تحصيل اليوم · سنة أولى</h3><strong>{collectionValue(collection.data?.collectedTodayAmount, true)}</strong><p>{collectionReady ? `${collection.data!.collectedTodayCount} عملية سداد اليوم` : 'وفق تاريخ السداد الفعلي'}</p><span className="dashboard-priority-footnote">من مؤشرات شاشة التحصيل الحالية</span>
      </div>
      <div className="dashboard-priority-card" aria-busy={collection.isFetching}>
        <span className="dashboard-priority-icon"><Wallet aria-hidden="true" /></span><h3>محصل التجديدات هذا الشهر</h3><strong>{collectionValue(collection.data?.year2CollectedMonthAmount, true)}</strong><p>{collectionReady ? `${collection.data!.year2CollectedMonthCount} عملية تحصيل` : 'السنة الثانية وما بعدها'}</p><span className="dashboard-priority-footnote">مستقل عن التارجت والمحقق</span>
      </div>
    </div>
  </section>;
}
