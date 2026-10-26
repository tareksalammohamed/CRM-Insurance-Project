import { useRequestGuard } from '../../../hooks/useRequestGuard';
import { useState, useEffect } from 'react';
import type { Policy, Installment } from '../../../lib/supabase';
import { fetchPolicyInstallments } from '../services/collectionService';
import { useNotify } from '../../../lib/notify';

export function usePolicyInstallmentsModal() {
  const notify = useNotify();
  const guard = useRequestGuard();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy]   = useState<Policy | null>(null);
  const [policyInstallments, setPolicyInstallments] = useState<Installment[]>([]);
  const [loadingPolicyInstallments, setLoadingPolicyInstallments] = useState(false);

  const loadPolicyInstallments = async (policyId: string) => {
    const request = guard.start();
    setLoadingPolicyInstallments(true);
    setLoadError(null);
    setPolicyInstallments([]);
    try {
      const rows = await fetchPolicyInstallments(policyId);
      if (guard.isCurrent(request)) setPolicyInstallments(rows);
    } catch (error) {
      if (!guard.isCurrent(request)) return;
      setLoadError('تعذر تحميل أقساط هذه الوثيقة. أعد المحاولة.');
      console.error('Error loading policy installments:', error);
      notify.error('حدث خطأ أثناء تحميل الأقساط');
    } finally {
      if (guard.isCurrent(request)) setLoadingPolicyInstallments(false);
    }
  };

  const handleOpenPolicyDetails = (policy: Policy) => {
    setSelectedPolicy(policy);
    setShowPolicyModal(true);
    loadPolicyInstallments(policy.id);
  };

  useEffect(() => { if (!showPolicyModal) guard.invalidate(); }, [showPolicyModal, guard]);

  return {
    loadError,
    showPolicyModal,
    setShowPolicyModal,
    selectedPolicy,
    policyInstallments,
    loadingPolicyInstallments,
    loadPolicyInstallments,
    handleOpenPolicyDetails,
  };
}
