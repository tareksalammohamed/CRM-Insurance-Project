import { useAdaptiveReads } from '../../hooks/useAdaptiveReads';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { LoadNotice } from '../../components/feedback/LoadNotice';
import { isAbortedRead } from '../../lib/adaptiveReads';
import { FirstYearSummary } from '../../features/installments/FirstYearSummary';
import { friendlyError } from '../../lib/errorMessages';
import { useNotify } from '../../lib/notify';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useReconnectRefetch } from '../../hooks/useReconnectRefetch';
import {
  type Installment,
  POLICY_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  POLICY_STATUS_LABELS,
} from '../../lib/supabase';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Calendar,
  CreditCard,
  User,
  DollarSign,
  Edit2,
  RotateCcw,
  XCircle,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

import type { PolicyWithRelations } from './types';
import {
  fetchPolicyById, changePolicyStatus, checkPolicyDeletable, deletePolicySafe,
} from './services/policyDetailService';
import {
  fetchInstallmentsByPolicyId, payInstallment, cancelInstallmentPayment,
} from '../../features/installments/installmentsService';
import {
  computeInstallmentStats, getPolicyStatusBadgeClass, formatCurrency,
} from '../../features/installments/installmentHelpers';
import { InstallmentsTable } from '../../features/installments/InstallmentsTable';
import { PayInstallmentModal } from '../../features/installments/PayInstallmentModal';
import { CancelInstallmentModal } from '../../features/installments/CancelInstallmentModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  // معرّف قسط جاي من رابط إشعار "تم سداد قسط" — لتمييزه والتمرير إليه
  const highlightInstallmentId = searchParams.get('installment');
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = useNotify();
  const read = useAdaptiveReads(`${user?.id}:${id}`);
  const guard = useRequestGuard();
  const installmentsGuard = useRequestGuard();
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [installmentsError, setInstallmentsError] = useState<string | null>(null);

  // ===================================
  // حالات المكون
  // ===================================
  const [policy, setPolicy] = useState<PolicyWithRelations | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  // سداد
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [paymentDateStr, setPaymentDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [processingPayment, setProcessingPayment] = useState(false);

  // إلغاء السداد — نفس زر ونفس منطق صفحة التحصيل والسداد
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // إجراءات الوثيقة (إيقاف/إعادة تفعيل/إلغاء/حذف) — نفس أزرار صفحة الوثائق
  const [isDeletable, setIsDeletable] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  // إظهار/إخفاء البيانات التفصيلية — عرض فقط، مفيش أى أثر على البيانات
  const [showDetails, setShowDetails] = useState(false);

  // ===================================
  // تحميل بيانات الوثيقة
  // ===================================
  const loadInstallments = useCallback(async () => {
    if (!id || !user) return;
    const request = installmentsGuard.start();
    setLoadingInstallments(true);
    setInstallmentsError(null);
    setInstallments([]);
    try {
      const rows = await read(() => fetchInstallmentsByPolicyId(id, true), 1, () => installmentsGuard.isCurrent(request));
      if (installmentsGuard.isCurrent(request)) setInstallments(rows);
    } catch (error) {
      if (installmentsGuard.isCurrent(request) && !isAbortedRead(error)) setInstallmentsError('تعذر تحميل أقساط السنة الأولى؛ أعد المحاولة.');
    } finally {
      if (installmentsGuard.isCurrent(request)) setLoadingInstallments(false);
    }
  }, [id, user, read, installmentsGuard]);

  const loadPolicy = useCallback(async () => {
    if (!id || !user) return;
    const request = guard.start();
    setLoading(true);
    setPolicyError(null);
    setIsDeletable(false);
    const valid = () => guard.isCurrent(request);
    // Each section publishes independently; deletion eligibility never delays the document.
    const primary = read(() => fetchPolicyById(id), 0, valid).then(data => {
      if (valid()) setPolicy(data);
    }).catch(error => {
      if (valid() && !isAbortedRead(error)) setPolicyError('تعذر تحميل بيانات الوثيقة؛ أعد المحاولة.');
    }).finally(() => { if (valid()) setLoading(false); });
    const schedule = loadInstallments();
    const eligibility = read(() => checkPolicyDeletable(id), 2, valid).then(value => {
      if (valid()) setIsDeletable(value);
    }).catch(() => { /* Keep deletion disabled until eligibility is verified. */ });
    await Promise.all([primary, schedule, eligibility]);
  }, [id, user, guard, read, loadInstallments]);

  useEffect(() => {
    void loadPolicy();
    return () => { guard.invalidate(); installmentsGuard.invalidate(); };
  }, [loadPolicy, guard, installmentsGuard]);

  useReconnectRefetch(() => { void loadPolicy(); });

  useEffect(() => {
    setShowPayModal(false); setShowCancelModal(false); setSelectedInstallment(null);
    setShowDeleteConfirm(false);
  }, [id, user?.id]);

  // ===================================
  // فتح مودال السداد
  // ===================================
  const handleOpenPayModal = (installment: Installment) => {
    setSelectedInstallment(installment);
    setPaymentDateStr(format(new Date(), 'yyyy-MM-dd'));
    setShowPayModal(true);
  };

  // ===================================
  // تنفيذ السداد (يدعم السداد المبكر واختيار تاريخ السداد الفعلي)
  // ===================================
  const handleProcessPayment = async () => {
    if (!selectedInstallment || !user) return;
    setProcessingPayment(true);

    try {
      await payInstallment(selectedInstallment, user.id, new Date(paymentDateStr));

      setShowPayModal(false);
      setSelectedInstallment(null);
      // إعادة تحميل الأقساط لتحديث الحالة
      await loadInstallments();
    } catch (error: unknown) {
      console.error('Error processing payment:', error);
      notify.error(friendlyError(error, 'حدث خطأ أثناء تسجيل السداد، حاول مرة أخرى'));
    } finally {
      setProcessingPayment(false);
    }
  };

  // ===================================
  // فتح مودال إلغاء السداد — نفس زر ونفس منطق صفحة التحصيل والسداد
  // ===================================
  const handleOpenCancelModal = (installment: Installment) => {
    setSelectedInstallment(installment);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // ===================================
  // تنفيذ إلغاء السداد
  // ===================================
  const handleCancelPayment = async () => {
    if (!selectedInstallment || !user) return;
    setProcessingPayment(true);
    try {
      const { error } = await cancelInstallmentPayment(selectedInstallment, user.id, cancelReason);

      if (error) {
        notify.error(error);
        return;
      }

      setShowCancelModal(false);
      setSelectedInstallment(null);
      setCancelReason('');
      await loadInstallments();
    } catch (error) {
      console.error('Error cancelling payment:', error);
      notify.error('حدث خطأ أثناء إلغاء السداد');
    } finally {
      setProcessingPayment(false);
    }
  };

  // ===================================
  // تغيير حالة الوثيقة (إيقاف / إعادة تفعيل / إلغاء)
  // ===================================
  const handleChangeStatus = async (newStatus: 'active' | 'cancelled') => {
    if (!policy) return;
    setChangingStatus(true);
    try {
      await changePolicyStatus(policy, newStatus);
      await loadPolicy();
    } catch (error) {
      console.error('Error changing policy status:', error);
      notify.error('حدث خطأ أثناء تغيير الحالة');
    } finally {
      setChangingStatus(false);
    }
  };

  // ===================================
  // حذف الوثيقة
  // ===================================
  const handleDeletePolicy = async () => {
    if (!policy) return;
    setDeleting(true);
    try {
      const { error } = await deletePolicySafe(policy.id, policy);
      if (error) {
        notify.error(error);
        return;
      }
      navigate('/policies');
    } catch (error) {
      console.error('Error deleting policy:', error);
      notify.error('حدث خطأ أثناء حذف الوثيقة');
    } finally {
      setDeleting(false);
    }
  };

  // ===================================
  // إحصائيات الأقساط
  // ===================================
  const stats = computeInstallmentStats(installments);

  // ===================================
  // شاشة التحميل
  // ===================================
  if (policyError) return <LoadNotice message={policyError} loading={loading} onRetry={() => void loadPolicy()} />;

  if (loading || policy?.id !== id) {
    return (
      <div className="space-y-6 animate-fadeIn" role="status" aria-live="polite">
        <span className="sr-only">جارٍ تحميل بيانات الوثيقة…</span>
        <div className="detail-summary">
          <div className="skeleton-bar h-3 w-20 !bg-white/20" />
          <div className="skeleton-bar h-6 w-52 mt-2.5 !bg-white/25" />
          <div className="detail-summary-metrics">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-bar h-12 !rounded-xl !bg-white/15" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kpi-card">
              <div className="skeleton-bar h-3 w-16" />
              <div className="skeleton-bar h-7 w-12 mt-3" />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="skeleton-bar h-4 w-28 mb-4" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-bar h-10 !rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!policy) return null;

  // ===================================
  // الواجهة
  // ===================================
  return (
    <div className="workspace-page workspace-page-policy-detail space-y-6 animate-fadeIn" dir="rtl">

      {/* ===== رأس ملخّص الوثيقة =====
          كل ما يحتاجه المستخدم للتعرّف على الوثيقة (رقمها، عميلها، نوعها،
          حالتها) + أهم أربعة أرقام + الإجراءات، فى كتلة واحدة أعلى الصفحة
          بدل تفريقها على ثلاث بطاقات. باقي الحقول التفصيلية انتقلت لقسم
          قابل للطي تحتها (Progressive disclosure). */}
      <div className="detail-summary">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={() => navigate('/policies')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-lime-300 hover:underline mb-1.5"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              كل الوثائق
            </button>
            <span className="detail-summary-eyebrow">وثيقة تأمين</span>
            <h2 className="detail-summary-title font-mono" dir="ltr">{policy.policy_number}</h2>
            <p className="detail-summary-sub truncate">
              {policy.customer?.name || '—'} · {POLICY_TYPE_LABELS[policy.policy_type]}
            </p>
          </div>
          <span className={clsx('badge shrink-0', getPolicyStatusBadgeClass(policy.status))}>
            {POLICY_STATUS_LABELS[policy.status]}
          </span>
        </div>

        <div className="detail-summary-metrics">
          <div className="detail-summary-metric">
            <span>القسط الصافي لكل دفعة</span>
            <strong>{formatCurrency(policy.premium_amount)}</strong>
          </div>
          <div className="detail-summary-metric">
            <span>مبلغ التأمين</span>
            <strong>{policy.sum_assured != null ? formatCurrency(policy.sum_assured) : '—'}</strong>
          </div>
          <div className="detail-summary-metric">
            <span>تاريخ البداية</span>
            <strong>{format(new Date(policy.start_date), 'dd/MM/yyyy')}</strong>
          </div>
          <div className="detail-summary-metric">
            <span>طريقة السداد</span>
            <strong>{PAYMENT_METHOD_LABELS[policy.payment_method]}</strong>
          </div>
        </div>

        {/* ===== إجراءات الوثيقة — نفس أزرار صفحة الوثائق، متاحة هنا كمان ===== */}
        <div className="detail-actions">
          <button
            onClick={() => navigate(`/policies?edit=${policy.id}`)}
            className="btn btn-white btn-sm"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>تعديل</span>
          </button>
          {policy.status === 'cancelled' && (
            <button
              onClick={() => handleChangeStatus('active')}
              disabled={changingStatus}
              className="btn btn-white btn-sm text-success-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة تفعيل</span>
            </button>
          )}
          {policy.status !== 'cancelled' && (
            <button
              onClick={() => handleChangeStatus('cancelled')}
              disabled={changingStatus}
              className="btn btn-white btn-sm text-error-700"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>إلغاء</span>
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!isDeletable}
            className="btn btn-white btn-sm text-error-700"
            title={isDeletable ? 'حذف الوثيقة' : 'لا يمكن الحذف: توجد دفعات من شهور سابقة'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        </div>
      </div>

      <LoadNotice message={installmentsError} loading={loadingInstallments} onRetry={() => void loadInstallments()} />
      {!installmentsError && <FirstYearSummary installments={installments} loading={loadingInstallments} />}

      {/* ===== بيانات تفصيلية — مطويّة افتراضيًا (Progressive disclosure) ===== */}
      <div className="card !p-0">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="detail-section-toggle"
          aria-expanded={showDetails}
        >
          <span className="detail-section-toggle-label">
            <FileText />
            بيانات الوثيقة التفصيلية
          </span>
          <ChevronDown
            className={clsx('w-4 h-4 text-secondary-400 transition-transform', showDetails && 'rotate-180')}
          />
        </button>
        {showDetails && (
          <div className="detail-section-body">
            <div className="detail-field-grid">
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <User className="w-3 h-3" /> العميل
                </span>
                <button type="button" className="detail-field-value text-start hover:underline" onClick={() => navigate(`/customers?open=${encodeURIComponent(policy.customer_id)}`)}>{policy.customer?.name || '—'}</button>
              </div>
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> تاريخ البداية
                </span>
                <span className="detail-field-value">
                  {format(new Date(policy.start_date), 'dd/MM/yyyy')}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> طريقة السداد
                </span>
                <span className="detail-field-value">
                  {PAYMENT_METHOD_LABELS[policy.payment_method]}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> القسط الصافي لكل دفعة
                </span>
                <span className="detail-field-value">{formatCurrency(policy.premium_amount)}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> مبلغ التأمين
                </span>
                <span className="detail-field-value">
                  {policy.sum_assured != null ? formatCurrency(policy.sum_assured) : '—'}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <FileText className="w-3 h-3" /> نوع الوثيقة
                </span>
                <span className="detail-field-value">{POLICY_TYPE_LABELS[policy.policy_type]}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== جدول الأقساط الموحّد (نفس المكوّن فى صفحة التحصيل والسداد وصفحة العملاء) ===== */}
      <div className="card">
        <div className="card-section-head">
          <h3>
            <CreditCard className="w-4 h-4 text-primary-600" />
            جدول أقساط السنة الأولى
          </h3>
          <span className="card-section-meta">{loadingInstallments ? 'جارٍ تحميل الأقساط…' : installmentsError ? 'الأقساط غير متاحة' : `${stats.paid} من ${stats.total} قسط سنة أولى مسدد`}</span>
        </div>

        {!installmentsError && <InstallmentsTable
          installments={installments}
          loading={loadingInstallments}
          policyStatus={policy.status}
          onPay={handleOpenPayModal}
          onCancel={handleOpenCancelModal}
          highlightId={highlightInstallmentId}
        />}
      </div>

      {/* ===== مودال تأكيد السداد (موحّد) ===== */}
      {showPayModal && selectedInstallment && (
        <PayInstallmentModal
          installment={selectedInstallment}
          paymentDateStr={paymentDateStr}
          onPaymentDateChange={setPaymentDateStr}
          processing={processingPayment}
          onConfirm={handleProcessPayment}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {/* ===== مودال إلغاء السداد (موحّد) ===== */}
      {showCancelModal && selectedInstallment && (
        <CancelInstallmentModal
          installment={selectedInstallment}
          cancelReason={cancelReason}
          onCancelReasonChange={setCancelReason}
          processing={processingPayment}
          onConfirm={handleCancelPayment}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* ===== مودال تأكيد حذف الوثيقة ===== */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="تأكيد حذف الوثيقة"
          message={
            <>
              هل أنت متأكد من حذف الوثيقة رقم{' '}
              <span className="font-medium text-secondary-900">{policy.policy_number}</span>؟
            </>
          }
          warning="لا يمكن التراجع عن هذا الإجراء، وسيتم حذف كل الأقساط المرتبطة بها."
          busy={deleting}
          onConfirm={handleDeletePolicy}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
