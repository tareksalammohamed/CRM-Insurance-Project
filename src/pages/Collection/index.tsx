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
import { useCollectionInstallments } from './hooks/useCollectionInstallments';
import { useCollectionQuickStats } from './hooks/useCollectionQuickStats';
import { usePolicyInstallmentsModal } from './hooks/usePolicyInstallmentsModal';
import { useInstallmentPaymentActions } from './hooks/useInstallmentPaymentActions';

import { CollectionHeader } from './components/CollectionHeader';
import { CollectionStats } from './components/CollectionStats';
import { CollectionTabs } from './components/CollectionTabs';
import { CollectionSearch } from './components/CollectionSearch';
import { CollectionFilters } from './components/CollectionFilters';
import { CollectionList } from './components/CollectionList';
import { MoreMenuDialog } from './components/dialogs/MoreMenuDialog';
import { DetailsDialog } from './components/dialogs/DetailsDialog';
import { PolicyInstallmentsDialog } from './components/dialogs/PolicyInstallmentsDialog';

// السنة الأولى تبقى مستقلة تماماً بحساباتها، والقسم الآخر يستمر في
// استخدام مسار التحصيل المنفصل للسنوات الثانية وما بعدها.
type YearMode = 'year1' | 'year2';

export function Collection() {
  const { user } = useAuth();
  const { currentBranchId } = useBranchContext();

  const { initialSubType, initialQuickFilter, initialOwnerFilter, initialMonth, hasUrlNavigation } =
    useCollectionUrlParams();

  // تبدأ الصفحة مباشرة بالسنة الأولى، مع بقاء القسمين مفصولين منطقياً.
  const [yearMode, setYearMode] = useState<YearMode>('year1');

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
    page,
    setPage,
    totalPages,
    totalCount,
    searchQuery,
    localSearch,
    setLocalSearch,
    loadInstallments,
  } = useCollectionInstallments({ user, yearMode, quickFilter, subType, ownerFilter, branchId: currentBranchId, monthStart: initialMonth });

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

  const teamMembers = useTeamMembers(user, currentBranchId);
  const { quickStats, quickStatsLoading, loadQuickStats } = useCollectionQuickStats(user, currentBranchId);

  const {
    showPolicyModal,
    setShowPolicyModal,
    selectedPolicy,
    policyInstallments,
    loadingPolicyInstallments,
    loadPolicyInstallments,
    handleOpenPolicyDetails,
  } = usePolicyInstallmentsModal();

  const {
    showPaymentModal,
    setShowPaymentModal,
    selectedInstallment,
    paymentDateStr,
    setPaymentDateStr,
    processingPayment,
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    handleOpenPayment,
    handleProcessPayment,
    handleOpenCancel,
    handleCancelPayment,
  } = useInstallmentPaymentActions({
    user,
    loadInstallments,
    loadQuickStats,
    showPolicyModal,
    selectedPolicyId: selectedPolicy?.id,
    loadPolicyInstallments,
  });

  const [moreMenuInstallment, setMoreMenuInstallment] = useState<InstallmentWithRelations | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<ActionMenuAnchor | null>(null);
  const closeMoreMenu = () => {
    setMoreMenuAnchor(null);
    setMoreMenuInstallment(null);
  };
  const [detailsView, setDetailsView] = useState<{ installment: InstallmentWithRelations; view: 'customer' | 'policy' } | null>(null);

  return (
    <div className="col-page space-y-4 md:space-y-5 animate-fadeIn pb-2">

      <CollectionHeader />

      {/* ===== مسار التحصيل ===== */}
      {/* نفس زر التبديل الأصلي ونفس السلوك — الإطار بقى لوحًا معنونًا. */}
      <section aria-label="اختيار مسار التحصيل" className="col-panel">
        <div className="col-panel-head">
          <h2 className="col-panel-title">
            <Route aria-hidden="true" />
            <span>مسار التحصيل</span>
          </h2>
        </div>
        <div className="col-panel-body">
          <CollectionTabs yearMode={yearMode} onChange={setYearMode} />
        </div>
      </section>

      {/* ===== لوح المؤشرات المالية ===== */}
      {yearMode === 'year1' && (
        <section aria-label="مؤشرات التحصيل" className="space-y-2.5">
          <h2 className="col-panel-title px-0.5">
            <Gauge aria-hidden="true" />
            <span>مؤشرات التحصيل</span>
          </h2>
          <CollectionStats quickStats={quickStats} quickStatsLoading={quickStatsLoading} />
        </section>
      )}

      {yearMode === 'year2' ? (
        <Year2Collection branchId={currentBranchId} />
      ) : (
        <>
          {/* ===== البحث والفلاتر ===== */}
          <section aria-label="البحث والفلاتر" className="col-panel">
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
          <section aria-label="قائمة الأقساط" className="space-y-2.5">
            <h2 className="col-panel-title px-0.5">
              <ReceiptText aria-hidden="true" />
              <span>الأقساط</span>
            </h2>
            <CollectionList
              isInitialLoading={isInitialLoading}
              installments={installments}
              hasActiveFilters={hasActiveFilters}
              onResetSearchAndFilters={() => { setLocalSearch(''); handleResetFilters(); }}
              onPay={handleOpenPayment}
              onCancel={handleOpenCancel}
              onMore={(installment, anchor) => {
                setMoreMenuAnchor(anchor);
                setMoreMenuInstallment(installment);
              }}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </section>
        </>
      )}

      {/* ===== مودال تأكيد السداد (موحّد) ===== */}
      {showPaymentModal && selectedInstallment && (
        <PayInstallmentModal
          installment={selectedInstallment}
          contextLabel={{
            policyNumber: selectedInstallment.policy?.policy_number,
            customerName: selectedInstallment.policy?.customer?.name,
          }}
          paymentDateStr={paymentDateStr}
          onPaymentDateChange={setPaymentDateStr}
          processing={processingPayment}
          onConfirm={handleProcessPayment}
          onClose={() => setShowPaymentModal(false)}
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
          onConfirm={handleCancelPayment}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* ===== مودال "المزيد" — إجراءات إضافية لكل قسط ===== */}
      {moreMenuInstallment && (
        <MoreMenuDialog
          installment={moreMenuInstallment}
          onClose={closeMoreMenu}
          onShowCustomerDetails={() => { setDetailsView({ installment: moreMenuInstallment, view: 'customer' }); closeMoreMenu(); }}
          onShowPolicyDetails={() => { setDetailsView({ installment: moreMenuInstallment, view: 'policy' }); closeMoreMenu(); }}
          onOpenPolicyHistory={() => { handleOpenPolicyDetails(moreMenuInstallment.policy); closeMoreMenu(); }}
          onOpenCancel={() => { handleOpenCancel(moreMenuInstallment); closeMoreMenu(); }}
          onOpenPayment={() => { handleOpenPayment(moreMenuInstallment); closeMoreMenu(); }}
          anchor={moreMenuAnchor}
        />
      )}

      {/* ===== مودال بيانات العميل / الوثيقة ===== */}
      {detailsView && (
        <DetailsDialog
          installment={detailsView.installment}
          view={detailsView.view}
          onClose={() => setDetailsView(null)}
        />
      )}

      {/* ===== مودال جميع أقساط الوثيقة (سجل التحصيل) ===== */}
      {showPolicyModal && selectedPolicy && (
        <PolicyInstallmentsDialog
          policy={selectedPolicy}
          installments={policyInstallments}
          loading={loadingPolicyInstallments}
          onClose={() => setShowPolicyModal(false)}
          onPay={(inst) => { handleOpenPayment(inst); setShowPolicyModal(false); }}
          onCancel={(inst) => { handleOpenCancel(inst); setShowPolicyModal(false); }}
        />
      )}

    </div>
  );
}
