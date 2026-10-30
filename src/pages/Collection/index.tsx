import { useAdaptiveReads } from '../../hooks/useAdaptiveReads';
import { PromiseDialog, FollowupWorkspaceButton } from '../../features/customerFollowup/FollowupPanel';
import { AppliedFilters } from '../../components/forms/AppliedFilters';
import { useSearchParams } from 'react-router-dom';
import { LoadNotice } from '../../components/feedback/LoadNotice';
import { useState } from 'react';
import { Route, Gauge, SlidersHorizontal, ReceiptText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBranchContext } from '../../lib/branchContext';
import type { InstallmentWithRelations, QuickFilter } from './types';
import type { ActionMenuAnchor } from '../../components/ui/AppBottomSheet';
import { Year2Collection } from './year2/Year2Collection';
import { PayInstallmentModal } from '../../features/installments/PayInstallmentModal';
import { CancelInstallmentModal } from '../../features/installments/CancelInstallmentModal';

import { useCollectionUrlParams } from './hooks/useCollectionUrlParams';
import { useCollectionFilters } from './hooks/useCollectionFilters';
import { useTeamMembers } from './hooks/useTeamMembers';
import { useCollectionMaintenance } from './hooks/useCollectionMaintenance';
import { useCollectionInstallments } from './hooks/useCollectionInstallments';
import { useCollectionQuickStats } from './hooks/useCollectionQuickStats';
import { usePolicyInstallmentsModal } from './hooks/usePolicyInstallmentsModal';
import { useInstallmentPaymentActions } from './hooks/useInstallmentPaymentActions';

import { CollectionHeader } from './components/CollectionHeader';
import { CollectionStats } from './components/CollectionStats';
import { Year2CollectionStats } from './components/Year2CollectionStats';
import { CollectionTabs } from './components/CollectionTabs';
import { CollectionSearch } from './components/CollectionSearch';
import { CollectionFilters } from './components/CollectionFilters';
import { CollectionList } from './components/CollectionList';
import { MoreMenuDialog } from './components/dialogs/MoreMenuDialog';
import { PolicyInstallmentsDialog } from './components/dialogs/PolicyInstallmentsDialog';

// السنة الأولى تبقى مستقلة تماماً بحساباتها، والقسم الآخر يستمر في
// استخدام مسار التحصيل المنفصل للسنوات الثانية وما بعدها.
type YearMode = 'year1' | 'year2';

export function Collection() {
  const { user } = useAuth();
  const { currentBranchId } = useBranchContext();
  const read = useAdaptiveReads(`${user?.id}:${currentBranchId}`);
  const ensureMaintenance = useCollectionMaintenance(user?.id);

  const { initialSubType, initialQuickFilter, initialOwnerFilter, initialMonth, initialSearch, highlightInstallmentId, hasUrlNavigation } =
    useCollectionUrlParams();

  // تبدأ الصفحة مباشرة بالسنة الأولى، مع بقاء القسمين مفصولين منطقياً.
  const [searchParams, setSearchParams] = useSearchParams();
  const yearMode: YearMode = searchParams.get('year') === 'year2' ? 'year2' : 'year1';
  const setYearMode = (mode: YearMode) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (mode === 'year2') next.set('year', mode); else next.delete('year');
    return next;
  });

  const {
    quickFilter,
    subType,
    ownerFilter,
    quickFilterDraft,
    setQuickFilterDraft,
    subTypeDraft,
    setSubTypeDraft,
    ownerFilterDraft,
    setOwnerFilterDraft,
    showFilters,
    handleOpenFilters,
    handleApplyFilters: applyFiltersState,
    handleResetFilters: resetFiltersState,
    handleQuickFilterSelect: selectQuickFilterState,
    activeFilterCount,
  } = useCollectionFilters({ initialQuickFilter, initialSubType, initialOwnerFilter });

  const {
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
  } = useCollectionInstallments({ user, ensureMaintenance, yearMode, quickFilter, subType, ownerFilter, branchId: currentBranchId, monthStart: initialMonth, initialSearch, read });

  // المستخدم وصل للصفحة من نقرة على بطاقة/رقم بفلتر جاهز فى الرابط —
  // لازم يشوف دليل واضح إن القائمة مفلترة بالفعل مع مخرج للرجوع للكل.
  const [dismissedNavNotice, setDismissedNavNotice] = useState(false);
  const cameFromNavigation = hasUrlNavigation && !dismissedNavNotice;

  // تطبيق/إعادة تعيين الفلاتر أو اختيار شريحة سريعة لازم يرجّع الصفحة لأول
  // صفحة دايماً — بيتم استدعاء الدالتين معاً هنا فى نفس الحدث حتى يتجمّعا
  // (batch) فى نفس التحديث ويحصل تحميل واحد فقط بالقيم الجديدة.
  const handleApplyFilters = () => { applyFiltersState(); setPage(1); };
  const handleResetFilters = () => { resetFiltersState(); setPage(1); setDismissedNavNotice(true); };
  const handleQuickFilterSelect = (id: QuickFilter) => {
    selectQuickFilterState(id);
    setPage(1);
    // أول ما المستخدم يتدخل يدويًا فى الفلتر، مابقاش فى حالة "وصل من نقرة"
    setDismissedNavNotice(true);
  };

  const hasActiveFilters = activeFilterCount > 0 || !!searchQuery;

  const teamMembers = useTeamMembers(user, currentBranchId, read);
  const { quickStats, quickStatsLoading, loadQuickStats } = useCollectionQuickStats(user, currentBranchId, ensureMaintenance, read);

  const {
    showPolicyModal,
    setShowPolicyModal,
    selectedPolicy,
    policyInstallments,
    loadError: policyInstallmentsError,
    loadingPolicyInstallments,
    loadPolicyInstallments,
    handleOpenPolicyDetails,
  } = usePolicyInstallmentsModal();

  const {
    showPaymentModal,
    closePaymentModal,
    selectedInstallment,
    cancelGroupCount,
    selectedGroupInstallments,
    paymentDateStr,
    setPaymentDateStr,
    processingPayment,
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    handleOpenPayment,
    handleOpenGroupPayment,
    handleProcessPayment,
    handleOpenCancel,
    handleOpenCancelGroup,
    handleCancelPayment,
  } = useInstallmentPaymentActions({
    user,
    loadInstallments,
    loadQuickStats,
    showPolicyModal,
    selectedPolicyId: selectedPolicy?.id,
    loadPolicyInstallments,
  });

  const [promiseInstallment, setPromiseInstallment] = useState<InstallmentWithRelations | null>(null);
  const [moreMenuInstallment, setMoreMenuInstallment] = useState<InstallmentWithRelations | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<ActionMenuAnchor | null>(null);
  const closeMoreMenu = () => {
    setMoreMenuAnchor(null);
    setMoreMenuInstallment(null);
  };

  return (
    <div className="workspace-page workspace-page-collection col-page space-y-3 md:space-y-3.5 animate-fadeIn pb-2">

      <CollectionHeader />
      <div className="flex justify-end"><FollowupWorkspaceButton /></div>

      {/* ===== مسار التحصيل ===== */}
      {/* نفس زر التبديل الأصلي ونفس السلوك — الإطار بقى لوحًا معنونًا. */}
      <section aria-label="اختيار مسار التحصيل" className="col-panel collection-route-panel">
        <div className="col-panel-head">
          <h2 className="col-panel-title">
            <Route aria-hidden="true" />
            <span>مسار التحصيل</span>
          </h2>
        </div>
        <div className="col-panel-body">
          <CollectionTabs
            yearMode={yearMode}
            onChange={setYearMode}
            quickStats={quickStats}
            quickStatsLoading={quickStatsLoading}
          />
        </div>
      </section>

      {/* ===== لوح المؤشرات المالية ===== */}
      {yearMode === 'year1' ? (
        <section aria-label="مؤشرات التحصيل" className="collection-stats-section space-y-1.5">
          <h2 className="col-panel-title px-0.5">
            <Gauge aria-hidden="true" />
            <span>مؤشرات السنة الأولى</span>
          </h2>
          <CollectionStats quickStats={quickStats} quickStatsLoading={quickStatsLoading} />
        </section>
      ) : (
        <Year2CollectionStats quickStats={quickStats} quickStatsLoading={quickStatsLoading} />
      )}

      {yearMode === 'year2' ? (
        <Year2Collection ensureMaintenance={ensureMaintenance} read={read} branchId={currentBranchId} onDataChanged={loadQuickStats} />
      ) : (
        <>
          {/* ===== البحث والفلاتر ===== */}
          <section aria-label="البحث والفلاتر" className="col-panel collection-filter-panel">
            <div className="col-panel-head">
              <h2 className="col-panel-title">
                <SlidersHorizontal aria-hidden="true" />
                <span>البحث والتصفية</span>
              </h2>
              {!isInitialLoading && (
                <span className="col-panel-meta">{totalCount} قسط</span>
              )}
            </div>
            <div className="col-panel-body col-toolbar">
              <CollectionSearch
                localSearch={localSearch}
                onLocalSearchChange={setLocalSearch}
                showFilters={showFilters}
                activeFilterCount={activeFilterCount}
                onOpenFilters={handleOpenFilters}
              />

              <AppliedFilters
                labels={[
                  ...(searchQuery ? [`بحث: ${searchQuery}`] : []),
                  ...(subType !== 'all' ? [subType === 'new' ? 'إنتاج جديد فقط' : 'تحصيل دوري فقط'] : []),
                  ...(ownerFilter !== 'all' ? [`الفريق: ${teamMembers.find(member => member.id === ownerFilter)?.name ?? (ownerFilter === user?.id ? user.name : 'العضو المختار')}`] : []),
                ]}
                onReset={() => { setLocalSearch(''); handleResetFilters(); }}
                resetLabel="إعادة عرض الشهر"
              />

              <CollectionFilters
                quickFilter={quickFilter}
                onQuickFilterSelect={handleQuickFilterSelect}
                showFilters={showFilters}
                quickFilterDraft={quickFilterDraft}
                onQuickFilterDraftChange={setQuickFilterDraft}
                subTypeDraft={subTypeDraft}
                onSubTypeDraftChange={setSubTypeDraft}
                teamMembers={teamMembers}
                ownerFilterDraft={ownerFilterDraft}
                onOwnerFilterDraftChange={setOwnerFilterDraft}
                currentUserId={user?.id}
                onResetFilters={handleResetFilters}
                onApplyFilters={handleApplyFilters}
                isInitialLoading={isInitialLoading}
                totalCount={totalCount}
                loading={loading}
                cameFromNavigation={cameFromNavigation}
              />
            </div>
          </section>

          {/* ===== قائمة الأقساط ===== */}
          <section aria-label="قائمة الأقساط" className="collection-list-section space-y-1.5">
            <h2 className="col-panel-title px-0.5">
              <ReceiptText aria-hidden="true" />
              <span>الأقساط</span>
            </h2>
            <LoadNotice message={loadMessage} loading={loading} onRetry={() => void loadInstallments()} />
            <CollectionList
              isInitialLoading={isInitialLoading}
              installments={installments}
              hasActiveFilters={hasActiveFilters}
              onResetSearchAndFilters={() => { setLocalSearch(''); handleResetFilters(); }}
              onPay={handleOpenPayment}
              onPayGroup={handleOpenGroupPayment}
              onCancelGroup={handleOpenCancelGroup}
              onCancel={handleOpenCancel}
              onMore={(installment, anchor) => {
                setMoreMenuAnchor(anchor);
                setMoreMenuInstallment(installment);
              }}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              highlightId={highlightInstallmentId}
            />
          </section>
        </>
      )}

      {/* ===== مودال تأكيد السداد (موحّد) ===== */}
      {showPaymentModal && selectedInstallment && (
        <PayInstallmentModal
          installment={selectedInstallment}
          contextLabel={{
            policyNumber: selectedGroupInstallments ? undefined : selectedInstallment.policy?.policy_number,
            customerName: selectedInstallment.policy?.customer?.name,
          }}
          groupCount={selectedGroupInstallments?.length}
          groupTotalAmount={selectedGroupInstallments?.reduce((sum, i) => sum + Number(i.amount), 0)}
          paymentDateStr={paymentDateStr}
          onPaymentDateChange={setPaymentDateStr}
          processing={processingPayment}
          onConfirm={handleProcessPayment}
          onClose={closePaymentModal}
        />
      )}

      {/* ===== مودال إلغاء السداد (موحّد) ===== */}
      {showCancelModal && selectedInstallment && (
        <CancelInstallmentModal
          installment={selectedInstallment}
          contextLabel={{ policyNumber: selectedInstallment.policy?.policy_number }}
          cancelReason={cancelReason}
          onCancelReasonChange={setCancelReason}
          processing={processingPayment}
          groupCount={cancelGroupCount}
          onConfirm={handleCancelPayment}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* ===== مودال "المزيد" — إجراءات إضافية لكل قسط ===== */}
      {promiseInstallment && <PromiseDialog key={promiseInstallment.id}
        customerId={promiseInstallment.policy.customer_id} customerName={promiseInstallment.policy.customer?.name || ''}
        context={{ policyId: promiseInstallment.policy_id, policyNumber: promiseInstallment.policy.policy_number, installmentId: promiseInstallment.id, installmentNumber: promiseInstallment.installment_number }}
        onClose={() => setPromiseInstallment(null)} />}
      {moreMenuInstallment && (
        <MoreMenuDialog
          installment={moreMenuInstallment}
          onClose={closeMoreMenu}
          onOpenPolicyHistory={() => { handleOpenPolicyDetails(moreMenuInstallment.policy); closeMoreMenu(); }}
          onOpenCancel={() => { handleOpenCancel(moreMenuInstallment); closeMoreMenu(); }}
          onOpenPromise={() => { setPromiseInstallment(moreMenuInstallment); closeMoreMenu(); }}
          onOpenPayment={() => { handleOpenPayment(moreMenuInstallment); closeMoreMenu(); }}
          anchor={moreMenuAnchor}
        />
      )}

      {/* ===== مودال جميع أقساط الوثيقة (سجل التحصيل) ===== */}
      {showPolicyModal && selectedPolicy && (
        <PolicyInstallmentsDialog
          policy={selectedPolicy}
          installments={policyInstallments}
          loadError={policyInstallmentsError}
          onRetry={() => void loadPolicyInstallments(selectedPolicy.id)}
          loading={loadingPolicyInstallments}
          onClose={() => setShowPolicyModal(false)}
          onPay={(inst) => { handleOpenPayment(inst); setShowPolicyModal(false); }}
          onCancel={(inst) => { handleOpenCancel(inst); setShowPolicyModal(false); }}
        />
      )}

    </div>
  );
}
