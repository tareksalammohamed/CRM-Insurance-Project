import { friendlyError } from '../../lib/errorMessages';
import { useNotify } from '../../lib/notify';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = useNotify();

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
  // loadPolicy بقى useCallback بيعتمد على `id` و`navigate` فقط (الاتنين هما
  // كل اللي بيتقرا جوّاه) — الـeffect تحته بيحافظ على نفس شرط (id && user)
  // بالظبط، فمفيش أي طلب إضافي ولا تغيير فى ترتيب التنفيذ.
  const loadPolicy = useCallback(async () => {
    setLoading(true);
    try {
      if (!id) return;
      // الثلاث استعلامات مستقلة تمامًا عن بعضها (كلها تعتمد فقط على id)،
      // فبيتنفذوا بالتوازي بدل التسلسل — نفس النتائج بالظبط بزمن أقل
      setLoadingInstallments(true);
      const [data, installmentsData, deletable] = await Promise.all([
        fetchPolicyById(id),
        fetchInstallmentsByPolicyId(id),
        checkPolicyDeletable(id),
      ]);
      setPolicy(data);
      setInstallments(installmentsData);
      setIsDeletable(deletable);
    } catch (error) {
      console.error('Error loading policy:', error);
      navigate('/policies');
    } finally {
      setLoading(false);
      setLoadingInstallments(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id && user) {
      loadPolicy();
    }
  }, [id, user, loadPolicy]);

  useReconnectRefetch(() => { if (id && user) loadPolicy(); });

  // ===================================
  // تحميل الأقساط
  // ===================================
  const loadInstallments = async () => {
    if (!id) return;
    setLoadingInstallments(true);
    try {
      setInstallments(await fetchInstallmentsByPolicyId(id));
    } catch (error) {
      console.error('Error loading installments:', error);
    } finally {
      setLoadingInstallments(false);
    }
  };

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
  if (loading) {
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
    <div className="space-y-6 animate-fadeIn" dir="rtl">

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
            <span>قيمة القسط الصافي</span>
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

      {/* ===== إحصائيات الأقساط ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الأقساط', value: stats.total,   accent: 'border-r-secondary-400', color: '' },
          { label: 'مسدد',            value: stats.paid,    accent: 'border-r-success-500',   color: 'text-success-600' },
          { label: 'غير مسدد',        value: stats.pending, accent: 'border-r-warning-500',   color: 'text-warning-600' },
          { label: 'متأخر',           value: stats.overdue, accent: 'border-r-error-500',     color: 'text-error-600' },
        ].map((s) => (
          <div key={s.label} className={clsx('kpi-card border-r-4', s.accent)}>
            <p className="metric-label">{s.label}</p>
            <p className={clsx('text-figure', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

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
                <span className="detail-field-value">{policy.customer?.name || '—'}</span>
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
                  <DollarSign className="w-3 h-3" /> قيمة القسط الصافي
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
            جدول الأقساط
          </h3>
          <span className="card-section-meta">{stats.paid} / {stats.total} مسدد</span>
        </div>

        <InstallmentsTable
          installments={installments}
          loading={loadingInstallments}
          policyStatus={policy.status}
          onPay={handleOpenPayModal}
          onCancel={handleOpenCancelModal}
        />
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
