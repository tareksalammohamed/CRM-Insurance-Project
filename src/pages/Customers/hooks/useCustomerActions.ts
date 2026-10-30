import { followupError } from '../../../features/customerFollowup/errors';
import type { ExpiryReason } from '../../../features/customerFollowup/model';
import { useRequestGuard } from '../../../hooks/useRequestGuard';
import { friendlyError, getErrorCode } from '../../../lib/errorMessages';
import { useNotify } from '../../../lib/notify';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import type { User, Installment } from '../../../lib/supabase';

import { customerSchema, type CustomerFormData, type CustomerWithRelations, type CustomerPolicySummary } from '../types';
import {
  markCustomerRequestExpired, updateCustomer, createCustomer, deleteCustomer, fetchCustomerById,
} from '../services/customersService';
import { buildCustomerPrintHtml } from '../services/customerHelpers';
import { fetchPolicyById } from '../../PolicyDetail/services/policyDetailService';
import type { PolicyWithRelations } from '../../PolicyDetail/types';
import {
  fetchInstallmentsByPolicyId, payInstallment, cancelInstallmentPayment,
  fetchInstallmentSummaryByPolicyIds, type PolicyInstallmentSummary,
} from '../../../features/installments/installmentsService';

type SetSearchParams = ReturnType<typeof useSearchParams>[1];

interface UseCustomerActionsParams {
  user: User | null | undefined;
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParams;
  loadCustomers: () => Promise<void>;
  loadStats: () => Promise<void>;
}

// كل حالة وسلوك المودالات/النوافذ (إضافة/تعديل، حذف، تفاصيل العميل، تفاصيل
// الوثيقة، السداد وإلغاء السداد، الطباعة) — نفس المنطق المنقول بالضبط من
// index.tsx الأصلي.
export function useCustomerActions({
  user, searchParams, setSearchParams, loadCustomers, loadStats,
}: UseCustomerActionsParams) {
  const navigate = useNavigate();
  const summaryGuard = useRequestGuard();
  const detailGuard = useRequestGuard();
  const [policyInstallmentFilter, setPolicyInstallmentFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  useEffect(() => () => { summaryGuard.invalidate(); detailGuard.invalidate(); }, [user?.id, summaryGuard, detailGuard]);
  const notify = useNotify();

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithRelations | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CustomerWithRelations | null>(null);
  const [expireConfirm, setExpireConfirm] = useState<CustomerWithRelations | null>(null);
  const [expiring, setExpiring] = useState(false);
  const expiringRef = useRef(false);
  const handleExpireRequest = async (reason: ExpiryReason, note: string, operationId: string) => {
    if (!user || !expireConfirm || expiringRef.current) return;
    expiringRef.current = true;
    setExpiring(true);
    try {
      await markCustomerRequestExpired(expireConfirm.id, reason, note, operationId);
      setExpireConfirm(null);
      notify.success('تم تحويل الطلب إلى تالف. يمكنك إصدار وثيقة له عند استكماله.');
      await Promise.all([loadCustomers(), loadStats()]);
    } catch (error) {
      notify.error(followupError(error, 'تعذّر تحويل الطلب؛ راجع الاتصال وحاول مرة أخرى.'));
    } finally {
      expiringRef.current = false;
      setExpiring(false);
    }
  };
  const closeExpireConfirm = () => { if (!expiringRef.current) setExpireConfirm(null); };
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [moreMenuCustomer, setMoreMenuCustomer] = useState<CustomerWithRelations | null>(null);
  const [detailsCustomer, setDetailsCustomer] = useState<CustomerWithRelations | null>(null);
  const [showExtraInfo, setShowExtraInfo] = useState(false);

  // ملخص سريع (مسدد/مستحق/متأخر) لكل وثيقة — استعلام واحد فقط لكل وثائق
  // العميل عند فتح تفاصيله، بدون تحميل أي أقساط بالتفصيل (Lazy Loading
  // الفعلي للأقساط نفسها يبقى مؤجلاً لحد ما يفتح المستخدم "عرض التفاصيل")
  const [policySummaries, setPolicySummaries] = useState<Record<string, PolicyInstallmentSummary>>({});

  // ===== صفحة/بوتوم شيت تفاصيل الوثيقة المفتوحة من داخل صفحة العميل =====
  const [openPolicySummary, setOpenPolicySummary] = useState<CustomerPolicySummary | null>(null);
  const openPolicyIdRef = useRef<string | null>(null);
  const [policyDetailError, setPolicyDetailError] = useState<string | null>(null);
  const [policyDetail, setPolicyDetail] = useState<PolicyWithRelations | null>(null);
  const [policyInstallments, setPolicyInstallments] = useState<Installment[]>([]);
  const [loadingPolicyDetail, setLoadingPolicyDetail] = useState(false);

  // سداد/إلغاء سداد — نفس المنطق ونفس المكوّنات الموحّدة المستخدمة فى صفحة
  // التحصيل والسداد وصفحة تفاصيل الوثيقة
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentDateStr, setPaymentDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<CustomerFormData>({
    mode: 'onBlur',
    resolver: zodResolver(customerSchema) as Resolver<CustomerFormData>
  });

  const ownerIdValue = watch('owner_id');

  // فتح مودال "إضافة عميل جديد" تلقائياً لو الرابط جاي بـ ?new=1 — مستخدَم من
  // نافذة اختيار العميل داخل نموذج إصدار الوثيقة لما ما يكونش فيه عميل مطابق
  useEffect(() => {
    if (!user) return;
    if (searchParams.get('new') !== '1') return;

    handleOpenModal();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  // فتح "تفاصيل العميل" تلقائياً لو الرابط جاي بـ ?open=<customerId> — مستخدَم
  // من الضغط على إشعار عميل جديد (رئيس المجموعة/المراقب...) عشان يفتح على
  // العميل نفسه حتى لو مش ظاهر فى الصفحة/الفلتر الحالي
  useEffect(() => {
    if (!user) return;
    const openId = searchParams.get('open');
    if (!openId) return;

    (async () => {
      try {
        const customer = await fetchCustomerById(openId);
        if (customer) await handleOpenCustomerDetails(customer);
        else notify.error('العميل غير موجود أو تم حذفه');
      } catch (error) {
        console.error('Error opening customer from notification link:', error);
        notify.error('تعذّر فتح تفاصيل العميل');
      }
    })();

    const next = new URLSearchParams(searchParams);
    next.delete('open');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  const handleOpenModal = useCallback((customer?: CustomerWithRelations) => {
    setMoreMenuCustomer(null);
    if (customer) {
      setEditingCustomer(customer);
      reset({
        name: customer.name,
        national_id: customer.national_id || '',
        phone: customer.phone || '',
        address: customer.address || '',
        birth_date: customer.birth_date || '',
        occupation: customer.occupation || '',
        marital_status: customer.marital_status || undefined,
        owner_id: customer.owner_id || '',
        insurance_amount: customer.insurance_amount ?? ('' as any),
        payment_method: customer.payment_method || undefined,
        deposit_amount: customer.deposit_amount ?? ('' as any),
        isManagerRole: !!user && user.role !== 'agent' && user.role !== 'premium_agent',
        isEditingCustomer: true
      });
    } else {
      setEditingCustomer(null);
      const isAgent = user?.role === 'agent' || user?.role === 'premium_agent';
      reset({
        name: '',
        national_id: '',
        phone: '',
        address: '',
        birth_date: '',
        occupation: '',
        marital_status: undefined,
        owner_id: isAgent ? user?.id : '',
        insurance_amount: '' as any,
        payment_method: undefined,
        deposit_amount: '' as any,
        isManagerRole: !isAgent,
        isEditingCustomer: false
      });
    }
    setShowModal(true);
  }, [user, reset]);

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    reset();
  };

  const onSubmit = async (data: CustomerFormData) => {
    if (!user || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    // owner_id: للوكيل = نفسه دائماً، للمدير = الوكيل المختار من فريقه (مُتحقق منه بالـ schema)
    const isAgent = user.role === 'agent' || user.role === 'premium_agent';
    const finalOwnerId = isAgent ? user.id : data.owner_id;

    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, data, finalOwnerId, editingCustomer);
      } else {
        await createCustomer(data, finalOwnerId, user.id);
      }

      handleCloseModal();
      loadCustomers();
      loadStats();
    } catch (error: unknown) {
      console.error('Error saving customer:', error);
      if (getErrorCode(error) === '23505') {
        setError('national_id', { type: 'server', message: 'الرقم القومي مسجل لعميل آخر؛ ابحث عنه في العملاء وراجع البطاقة قبل إعادة الحفظ.' }, { shouldFocus: true });
      } else {
        notify.error(friendlyError(error, 'تعذّر حفظ العميل؛ البيانات ما زالت في النموذج. راجع الاتصال وحاول مرة أخرى.'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const { error } = await deleteCustomer(deleteConfirm.id);

      if (error) {
        notify.error(error);
        return;
      }

      setDeleteConfirm(null);
      loadCustomers();
      loadStats();
    } catch (error) {
      console.error('Error deleting customer:', error);
      notify.error('حدث خطأ أثناء الحذف');
    } finally {
      setDeleting(false);
    }
  };

  // فتح الوثيقة المرتبطة بالعميل — لو عنده أكتر من وثيقة بيوديه لقائمة
  // الوثائق مفلترة عليه بدل تخمين أنسبها (بدون أي منطق جديد فى صفحة الوثائق)
  const handleOpenCustomerPolicies = (customer: CustomerWithRelations) => {
    setMoreMenuCustomer(null);
    const policies = customer.policies || [];
    if (policies.length === 0) {
      notify.error('لا توجد وثائق مرتبطة بهذا العميل بعد');
      return;
    }
    if (policies.length === 1) {
      navigate(`/policies/${policies[0].id}`);
    } else {
      navigate(`/policies?search=${encodeURIComponent(customer.name)}`);
    }
  };

  // ===================================
  // فتح تفاصيل العميل — تحميل ملخص سريع لأقساط جميع وثائقه دفعة واحدة
  // (استعلام واحد فقط، بدون تفاصيل الأقساط نفسها)
  // ===================================
  const handleOpenCustomerDetails = useCallback(async (customer: CustomerWithRelations) => {
    const request = summaryGuard.start();
    setPolicySummaries({});
    setDetailsCustomer(customer);
    setShowExtraInfo(false);

    const policyIds = (customer.policies || []).map((p) => p.id);
    if (policyIds.length === 0) return;

    try {
      const summaries = await fetchInstallmentSummaryByPolicyIds(policyIds);
      if (summaryGuard.isCurrent(request)) setPolicySummaries(summaries);
    } catch (error) {
      console.error('Error loading policy installment summaries:', error);
    }
  }, [summaryGuard]);

  // ===================================
  // فتح "عرض التفاصيل" لوثيقة معينة — تحميل بيانات الوثيقة الكاملة وأقساطها
  // فقط الآن (Lazy Loading)، دون تحميل أي وثيقة أخرى لنفس العميل
  // ===================================
  const handleOpenPolicyDetails = async (summary: CustomerPolicySummary, filter: 'all' | 'paid' | 'pending' | 'overdue' = 'all') => {
    const request = detailGuard.start();
    openPolicyIdRef.current = summary.id;
    setPolicyDetailError(null);
    setPolicyInstallmentFilter(filter);
    setOpenPolicySummary(summary);
    setLoadingPolicyDetail(true);
    setPolicyDetail(null);
    setPolicyInstallments([]);

    try {
      const [detail, installmentsData] = await Promise.all([
        fetchPolicyById(summary.id),
        fetchInstallmentsByPolicyId(summary.id, true),
      ]);
      if (!detailGuard.isCurrent(request)) return;
      setPolicyDetail(detail);
      setPolicyInstallments(installmentsData);
    } catch (error) {
      if (detailGuard.isCurrent(request)) setPolicyDetailError('تعذر تحميل بيانات الوثيقة وأقساطها؛ أعد المحاولة.');
      console.error('Error loading policy details:', error);
    } finally {
      if (detailGuard.isCurrent(request)) setLoadingPolicyDetail(false);
    }
  };

  const handleClosePolicyDetails = () => {
    detailGuard.invalidate();
    openPolicyIdRef.current = null;
    setPolicyDetailError(null);
    setOpenPolicySummary(null);
    setPolicyDetail(null);
    setPolicyInstallments([]);
  };

  const reloadOpenPolicyInstallments = async () => {
    const policyId = openPolicySummary?.id;
    // A completed payment can belong to a dialog the user has already left.
    if (!policyId || openPolicyIdRef.current !== policyId) return;
    const request = detailGuard.start();
    const summaryRequest = summaryGuard.start();
    setLoadingPolicyDetail(true);
    setPolicyDetailError(null);
    setPolicyInstallments([]);
    try {
      const rows = await fetchInstallmentsByPolicyId(policyId, true);
      if (!detailGuard.isCurrent(request) || openPolicyIdRef.current !== policyId) return;
      setPolicyInstallments(rows);
      const summaries = await fetchInstallmentSummaryByPolicyIds((detailsCustomer?.policies || []).map(p => p.id));
      if (summaryGuard.isCurrent(summaryRequest)) setPolicySummaries(summaries);
    } catch (error) {
      if (detailGuard.isCurrent(request)) setPolicyDetailError('تعذر تحديث الأقساط بعد العملية؛ أعد تحميل تفاصيل الوثيقة للتحقق من الحالة.');
      console.error('Error reloading policy installments:', error);
    } finally {
      if (detailGuard.isCurrent(request)) setLoadingPolicyDetail(false);
    }
  };

  const handleOpenPayment = (installment: Installment) => {
    setSelectedInstallment(installment);
    setPaymentDateStr(format(new Date(), 'yyyy-MM-dd'));
    setShowPayModal(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedInstallment || !user) return;
    setProcessingPayment(true);
    try {
      await payInstallment(selectedInstallment, user.id, new Date(paymentDateStr));
      setShowPayModal(false);
      setSelectedInstallment(null);
      await reloadOpenPolicyInstallments();
    } catch (error: unknown) {
      console.error('Error processing payment:', error);
      notify.error(friendlyError(error, 'حدث خطأ أثناء تسجيل السداد، حاول مرة أخرى'));
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOpenCancel = (installment: Installment) => {
    setSelectedInstallment(installment);
    setCancelReason('');
    setShowCancelModal(true);
  };

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
      await reloadOpenPolicyInstallments();
    } catch (error) {
      console.error('Error cancelling payment:', error);
      notify.error('حدث خطأ أثناء إلغاء السداد');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleIssueNewPolicy = (customer: CustomerWithRelations) => {
    setMoreMenuCustomer(null);
    navigate(`/policies?new_for_customer=${customer.id}`);
  };

  // طباعة بيانات العميل — عرض/طباعة محلي بالكامل على بيانات مُحمَّلة بالفعل
  // من Supabase، بدون أي استدعاء أو تعديل جديد على قاعدة البيانات
  const handlePrintCustomer = (customer: CustomerWithRelations) => {
    setMoreMenuCustomer(null);
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(buildCustomerPrintHtml(customer));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return {
    // إضافة/تعديل
    showModal,
    editingCustomer,
    saving,
    handleOpenModal,
    handleCloseModal,
    onSubmit,
    register,
    handleSubmit,
    setValue,
    errors,
    isDirty,
    ownerIdValue,

    expireConfirm, setExpireConfirm, expiring, handleExpireRequest, closeExpireConfirm,

    // حذف
    deleteConfirm,
    setDeleteConfirm,
    deleting,
    handleDelete,

    // المزيد من الإجراءات
    moreMenuCustomer,
    setMoreMenuCustomer,
    handleOpenCustomerPolicies,
    handleIssueNewPolicy,
    handlePrintCustomer,

    // تفاصيل العميل
    detailsCustomer,
    setDetailsCustomer,
    showExtraInfo,
    setShowExtraInfo,
    policySummaries,
    handleOpenCustomerDetails,
    policyInstallmentFilter,

    // تفاصيل الوثيقة
    openPolicySummary,
    policyDetail,
    policyInstallments,
    loadingPolicyDetail,
    policyDetailError,
    handleOpenPolicyDetails,
    handleClosePolicyDetails,

    // سداد/إلغاء سداد
    selectedInstallment,
    showPayModal,
    setShowPayModal,
    paymentDateStr,
    setPaymentDateStr,
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    processingPayment,
    handleOpenPayment,
    handleProcessPayment,
    handleOpenCancel,
    handleCancelPayment,
  };
}
