import { friendlyError } from '../../../lib/errorMessages';
import { useNotify } from '../../../lib/notify';
import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import type { Installment, User } from '../../../lib/supabase';
import { processPayment, cancelPayment } from '../services/collectionService';

interface UseInstallmentPaymentActionsArgs {
  user: User | null | undefined;
  loadInstallments: () => Promise<void>;
  loadQuickStats: () => Promise<void>;
  showPolicyModal: boolean;
  selectedPolicyId: string | undefined;
  loadPolicyInstallments: (policyId: string) => Promise<void>;
}

export function useInstallmentPaymentActions({
  user,
  loadInstallments,
  loadQuickStats,
  showPolicyModal,
  selectedPolicyId,
  loadPolicyInstallments,
}: UseInstallmentPaymentActionsArgs) {
  const notify = useNotify();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  // النوع هنا هو `Installment` الأساسي عن قصد: نفس المودالات بتُستدعى من
  // قائمة التحصيل (قسط بعلاقات كاملة) ومن مودال سجل أقساط الوثيقة (قسط بدون
  // علاقات، محمّل من fetchInstallmentsByPolicyId)، و`processPayment` /
  // `cancelPayment` محتاجين حقول القسط الأساسية بس. `InstallmentWithRelations`
  // نوع فرعي منه فبيتمرر بدون أي تحويل.
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [paymentDateStr, setPaymentDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleOpenPayment = useCallback((installment: Installment) => {
    setSelectedInstallment(installment);
    setPaymentDateStr(format(new Date(), 'yyyy-MM-dd'));
    setShowPaymentModal(true);
  }, []);

  // ===================================
  // تسجيل السداد
  // ===================================
  const handleProcessPayment = async () => {
    if (!selectedInstallment || !user) return;
    setProcessingPayment(true);
    try {
      await processPayment(selectedInstallment, user.id, new Date(paymentDateStr));

      setShowPaymentModal(false);
      setSelectedInstallment(null);
      // إعادة تحميل القائمة الرئيسية وبطاقات الإحصائيات
      loadInstallments();
      loadQuickStats();
      // لو مودال الوثيقة مفتوح، حدّثه هو كمان
      if (showPolicyModal && selectedPolicyId) {
        loadPolicyInstallments(selectedPolicyId);
      }
    } catch (error: unknown) {
      console.error('Error processing payment:', error);
      notify.error(friendlyError(error, 'حدث خطأ أثناء تسجيل السداد'));
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOpenCancel = useCallback((installment: Installment) => {
    setSelectedInstallment(installment);
    setCancelReason('');
    setShowCancelModal(true);
  }, []);

  // ===================================
  // إلغاء السداد
  // ===================================
  const handleCancelPayment = async () => {
    if (!selectedInstallment || !user) return;
    setProcessingPayment(true);
    try {
      const { error } = await cancelPayment(selectedInstallment, user.id, cancelReason);

      if (error) {
        notify.error(error);
        return;
      }

      setShowCancelModal(false);
      setSelectedInstallment(null);
      setCancelReason('');
      loadInstallments();
      loadQuickStats();
      if (showPolicyModal && selectedPolicyId) {
        loadPolicyInstallments(selectedPolicyId);
      }
    } catch (error) {
      console.error('Error cancelling payment:', error);
      notify.error('حدث خطأ أثناء إلغاء السداد');
    } finally {
      setProcessingPayment(false);
    }
  };

  return {
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
  };
}
