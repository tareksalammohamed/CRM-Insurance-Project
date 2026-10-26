import { useCallback, useEffect, useState } from 'react';
import { X, ExternalLink, Layers } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { POLICY_STATUS_LABELS, POLICY_TYPE_LABELS, PAYMENT_METHOD_LABELS, type Policy, type Installment } from '../../../../lib/supabase';
import { AppDialog } from '../../../../components/ui/AppDialog';
import { LoadNotice } from '../../../../components/feedback/LoadNotice';
import { FirstYearSummary } from '../../../../features/installments/FirstYearSummary';
import { firstYearScheduleSummary } from '../../../../features/installments/firstYearSummaryModel';
import { InstallmentsTable } from '../../../../features/installments/InstallmentsTable';
import { PayInstallmentModal } from '../../../../features/installments/PayInstallmentModal';
import { CancelInstallmentModal } from '../../../../features/installments/CancelInstallmentModal';
import { payInstallment, cancelInstallmentPayment } from '../../../../features/installments/installmentsService';
import { useAuth } from '../../../../hooks/useAuth';
import { useBranchContext } from '../../../../lib/branchContext';
import { useNotify } from '../../../../lib/notify';
import { useRequestGuard } from '../../../../hooks/useRequestGuard';
import { fetchPolicyGroup, type PolicyGroupData } from '../../services/policyGroupService';
import { formatCurrency } from '../../utils/formatCurrency';

const dateLabel = (value?: string) => value && isValid(new Date(value)) ? format(new Date(value), 'dd/MM/yyyy') : 'غير مسجل';
const shared = (policies: Policy[], field: keyof Policy) => policies.every(policy => policy[field] === policies[0][field]);

export function PolicyGroupMembersDialog({ members, onClose, onOpenDetails, onChanged }: {
  members: Policy[]; onClose: () => void; onOpenDetails: (policy: Policy) => void; onChanged?: () => void;
}) {
  const { user } = useAuth();
  const { currentBranchId } = useBranchContext();
  const notify = useNotify();
  const guard = useRequestGuard();
  const seed = members[0];
  const [data, setData] = useState<PolicyGroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: 'pay' | 'cancel'; installment: Installment } | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const load = useCallback(async () => {
    const request = guard.start();
    setLoading(true); setError(null); setData(null);
    try {
      const result = await fetchPolicyGroup(seed, currentBranchId);
      if (guard.isCurrent(request)) setData(result);
    } catch {
      if (guard.isCurrent(request)) setError('تعذر تحميل المجموعة كاملة. أعد المحاولة لعرض تفاصيلها ومجاميعها.');
    } finally { if (guard.isCurrent(request)) setLoading(false); }
  }, [seed, currentBranchId, guard]);
  useEffect(() => { void load(); return guard.invalidate; }, [load, guard]);
  const policies = [...(data?.policies ?? [])].sort((a, b) => a.policy_number.localeCompare(b.policy_number));
  const first = policies[0];
  const actionPolicy = policies.find(policy => policy.id === action?.installment.policy_id);
  const close = () => { if (!processing) onClose(); };
  const execute = async () => {
    if (!action || !actionPolicy || !user || processing) return;
    setProcessing(true);
    try {
      if (action.kind === 'pay') await payInstallment(action.installment, user.id, new Date(paymentDate));
      else {
        const result = await cancelInstallmentPayment(action.installment, user.id, reason);
        if (result.error) throw new Error(result.error);
      }
      setAction(null);
      onChanged?.();
      await load();
    } catch (err) { notify.error(err instanceof Error ? err.message : 'تعذر تنفيذ العملية'); }
    finally { setProcessing(false); }
  };
  const openAction = (kind: 'pay' | 'cancel', installment: Installment) => {
    setPaymentDate(format(new Date(), 'yyyy-MM-dd')); setReason(''); setAction({ kind, installment });
  };
  return <>
    <AppDialog onClose={close} ariaLabel="مساحة وثائق المجموعة" className="policy-group-workspace max-w-6xl max-h-[94dvh] overflow-y-auto animate-fadeIn">
      <div className="sticky top-0 z-10 p-4 border-b border-secondary-200" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h3 className="font-bold text-secondary-900 flex items-center gap-2"><Layers className="w-5 h-5 shrink-0" />وثائق المجموعة في مكان واحد</h3><p className="text-xs text-secondary-500 mt-1">بيانات مشتركة، ملخص موحد، وتفاصيل وأقساط كل وثيقة</p></div>
        <button type="button" onClick={close} disabled={processing} className="icon-button shrink-0" aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </div>
        {!!policies.length && <nav aria-label="انتقال سريع لوثيقة داخل المجموعة" className="flex flex-wrap gap-2 mt-3 max-h-20 overflow-y-auto">{policies.map(policy => <button key={policy.id} type="button" className="btn btn-secondary btn-sm font-mono" onClick={() => { const section = document.getElementById(`group-policy-${policy.id}`) as HTMLDetailsElement | null; if (section) { section.open = true; section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>{policy.policy_number}</button>)}</nav>}
      </div>
      <div className="p-4 md:p-5 space-y-5">
        <LoadNotice message={error} loading={loading} onRetry={() => void load()} />
        {loading && <p role="status" className="text-sm text-secondary-500 py-8 text-center">جاري تحميل كل وثائق المجموعة وأقساطها...</p>}
        {first && data && <>
          <section aria-label="البيانات المشتركة" className="rounded-xl border border-secondary-200 p-4 space-y-3">
            <h4 className="font-bold text-secondary-900">البيانات المشتركة</h4>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-secondary-500">العميل</dt><dd className="font-semibold break-words">{first.customer?.name || 'غير مسجل'}</dd></div>
              <div><dt className="text-xs text-secondary-500">الهاتف</dt><dd><bdi>{first.customer?.phone || 'غير مسجل'}</bdi></dd></div>
              <div><dt className="text-xs text-secondary-500">الرقم القومي</dt><dd><bdi>{first.customer?.national_id || 'غير مسجل'}</bdi></dd></div>
              <div><dt className="text-xs text-secondary-500">الوكيل</dt><dd>{first.owner?.name || 'غير مسجل'}</dd></div>
              <div><dt className="text-xs text-secondary-500">نوع الوثائق</dt><dd>{POLICY_TYPE_LABELS[first.policy_type]}</dd></div>
              <div><dt className="text-xs text-secondary-500">بداية التأمين</dt><dd>{dateLabel(first.start_date)}</dd></div>
              <div><dt className="text-xs text-secondary-500">طريقة السداد</dt><dd>{PAYMENT_METHOD_LABELS[first.payment_method]}</dd></div>
            </dl>
            {first.notes && shared(policies, 'notes') && <p className="text-sm whitespace-pre-wrap break-words">ملاحظات مشتركة: {first.notes}</p>}
          </section>
          <section aria-label="ملخص المجموعة" className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="kpi-card kpi-card--summary"><p className="text-xs text-secondary-500">عدد الوثائق</p><p className="text-figure font-bold">{policies.length}</p></div>
              <div className="kpi-card kpi-card--summary"><p className="text-xs text-secondary-500">مجموع مبالغ التأمين المسجلة</p><p className="text-figure font-bold">{formatCurrency(policies.reduce((sum, policy) => sum + Number(policy.sum_assured || 0), 0))}</p></div>
              <div className="kpi-card kpi-card--summary"><p className="text-xs text-secondary-500">إجمالي القسط الصافي لكل دفعة</p><p className="text-figure font-bold">{formatCurrency(policies.reduce((sum, policy) => sum + Number(policy.premium_amount), 0))}</p></div>
              <div className="kpi-card kpi-card--summary"><p className="text-xs text-secondary-500">حالات الوثائق</p><p className="kpi-note">{policies.filter(policy => policy.status === 'active').length} نشطة · {policies.filter(policy => policy.status === 'cancelled').length} ملغاة</p></div>
            </div>
            <p className="text-xs text-secondary-500">يشمل العرض كل وثائق المجموعة المتاحة لك داخل نطاق الفرع، حتى لو أخفت فلاتر القائمة بعضها. المجاميع تشمل الوثائق الملغاة، والأقساط تخص السنة الأولى فقط.{policies.some(policy => policy.sum_assured == null) && ' بعض مبالغ التأمين غير مسجلة؛ مجموع التأمين يشمل القيم المسجلة فقط.'}</p>
            <FirstYearSummary installments={data.installments} />
          </section>
          <section aria-label="تفاصيل كل وثائق المجموعة" className="space-y-4">
            <h4 className="font-bold text-secondary-900">تفاصيل الوثائق وأقساطها</h4>
            {policies.map(policy => {
              const installments = data.installments.filter(row => row.policy_id === policy.id).sort((a, b) => a.installment_number - b.installment_number);
              const summary = firstYearScheduleSummary(installments);
              return <details id={`group-policy-${policy.id}`} key={policy.id} open style={{ scrollMarginTop: '10rem' }} className="rounded-xl border border-secondary-200 overflow-hidden">
                <summary className="p-4 cursor-pointer font-semibold text-secondary-900">وثيقة <bdi className="font-mono">{policy.policy_number}</bdi> · {POLICY_STATUS_LABELS[policy.status]} · {summary.paid} من {summary.total} قسط سنة أولى مسدد</summary>
                <div className="px-3 sm:px-4 pb-4 space-y-3">
                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><dt className="text-xs text-secondary-500">مبلغ التأمين</dt><dd>{policy.sum_assured == null ? 'غير مسجل' : formatCurrency(policy.sum_assured)}</dd></div>
                    <div><dt className="text-xs text-secondary-500">القسط الصافي لكل دفعة</dt><dd>{formatCurrency(policy.premium_amount)}</dd></div>
                    <div><dt className="text-xs text-secondary-500">تاريخ الإضافة للتطبيق</dt><dd>{dateLabel(policy.created_at)}</dd></div>
                    {policy.cancelled_at && <div><dt className="text-xs text-secondary-500">تاريخ الإلغاء</dt><dd>{dateLabel(policy.cancelled_at)}</dd></div>}
                  </dl>
                  {policy.notes && !shared(policies, 'notes') && <p className="text-sm whitespace-pre-wrap break-words">ملاحظات: {policy.notes}</p>}
                  {!!installments.length && <p className="text-xs text-secondary-600">قيمة أقساط السنة الأولى: {formatCurrency(summary.amount)} · المسدد: {formatCurrency(summary.paidAmount)} · المتبقي شامل المتأخر: {formatCurrency(summary.pendingAmount + summary.overdueAmount)}</p>}
                  <InstallmentsTable installments={installments} policyStatus={policy.status} onPay={row => openAction('pay', row)} onCancel={row => openAction('cancel', row)} />
                  <button type="button" className="btn btn-secondary btn-sm" disabled={processing} onClick={() => onOpenDetails(policy)}><ExternalLink className="w-4 h-4" />إدارة الوثيقة منفردة</button>
                </div>
              </details>;
            })}
          </section>
        </>}
      </div>
    </AppDialog>
    {action && actionPolicy && action.kind === 'pay' && <PayInstallmentModal installment={action.installment} contextLabel={{ policyNumber: actionPolicy.policy_number, customerName: first?.customer?.name }} paymentDateStr={paymentDate} onPaymentDateChange={setPaymentDate} processing={processing} onConfirm={() => void execute()} onClose={() => { if (!processing) setAction(null); }} />}
    {action && actionPolicy && action.kind === 'cancel' && <CancelInstallmentModal installment={action.installment} contextLabel={{ policyNumber: actionPolicy.policy_number, customerName: first?.customer?.name }} cancelReason={reason} onCancelReasonChange={setReason} processing={processing} onConfirm={() => void execute()} onClose={() => { if (!processing) setAction(null); }} />}
  </>;
}
