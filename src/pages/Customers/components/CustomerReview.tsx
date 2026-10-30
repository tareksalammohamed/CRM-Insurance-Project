import { Link } from 'react-router-dom';
import type { PolicyInstallmentSummary } from '../../../features/installments/installmentsService';
import { EXPIRY_REASONS, type ExpiryReason } from '../../../features/customerFollowup/model';
import { customerRequestStatus } from '../../../lib/customerRequestStatus';
import { ClipboardCheck, AlertTriangle, ArrowLeft, FileWarning } from 'lucide-react';
import { customerInputHints } from '../../../lib/inputGuidance';
import type { CustomerPolicySummary, CustomerWithRelations } from '../types';

export function CustomerReview({ customer, onEdit, onOpenPolicy, onNavigate, policySummaries = {} }: {
  customer: CustomerWithRelations;
  policySummaries?: Record<string, PolicyInstallmentSummary>;
  onEdit: () => void;
  onNavigate: () => void;
  onOpenPolicy: (policy: CustomerPolicySummary, filter?: 'all' | 'paid' | 'pending' | 'overdue') => void;
}) {
  const expired = customerRequestStatus(customer) === 'expired';
  const hints = customerInputHints({ ...customer });
  if (!customer.phone?.trim()) hints.unshift('رقم الهاتف غير مسجل؛ أضفه لتسهيل التواصل ومتابعة التحصيل.');
  if (!customer.national_id?.trim()) hints.push('الرقم القومي غير مسجل؛ راجعه مع المستند للمساعدة في تمييز العميل وتجنب تكراره.');
  const policies = customer.policies ?? [];
  const missingAmounts = policies.filter(policy => policy.status === 'active' && (policy.sum_assured == null || policy.sum_assured <= 0));
  const overduePolicies = policies.filter(policy => (policySummaries[policy.id]?.overdue || 0) > 0);
  const count = hints.length + missingAmounts.length + overduePolicies.length;
  return <section className={`customer-review ${count ? 'customer-review-attention' : ''}`} aria-label="مراجعة ملف العميل">
    <div className="customer-review-heading">
      <span className="customer-review-icon"><ClipboardCheck aria-hidden="true" /></span>
      <div><h4>مراجعة ملف العميل</h4><p>{count ? `${count} ملاحظة تستحق المراجعة` : 'لم تظهر ملاحظات في فحوص البيانات المتاحة'}</p></div>
      {hints.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>مراجعة البيانات<ArrowLeft className="w-3.5 h-3.5" /></button>}
    </div>
    {count > 0 && <details className="customer-review-details"><summary>عرض الملاحظات وأسبابها</summary>
      <ul>{hints.map(hint => <li key={hint}><AlertTriangle aria-hidden="true" /><p>{hint}</p></li>)}
        {missingAmounts.map(policy => <li key={policy.id}><FileWarning aria-hidden="true" /><div><p>الوثيقة <bdi>{policy.policy_number}</bdi>: مبلغ التأمين غير مسجل أو يساوي صفرًا؛ راجعه لأن احتساب العمولة يعتمد عليه.</p><Link className="customer-review-link" to={`/policies/${policy.id}`} onClick={onNavigate}>مراجعة هذه الوثيقة</Link></div></li>)}
        {overduePolicies.map(policy => <li key={`overdue-${policy.id}`}><AlertTriangle aria-hidden="true" /><div><p>الوثيقة <bdi>{policy.policy_number}</bdi> بها {policySummaries[policy.id].overdue} قسط متأخر حسب ملخص الأقساط المحمّل؛ راجع تفاصيلها لتحديد المتابعة المناسبة.</p><button type="button" className="customer-review-link" onClick={() => onOpenPolicy(policy, 'overdue')}>فتح الوثيقة والأقساط</button></div></li>)}
      </ul>
      <p className="customer-review-footnote">ملاحظات للمراجعة وفق البيانات المسجلة؛ لا تمنع الحفظ ولا تعدّل البيانات تلقائيًا.</p>
    </details>}
    {expired && <p className="text-sm text-secondary-600">{customer.request_manually_expired ? `تم تحويل الطلب إلى تالف يدويًا${customer.request_expiry_reason ? `: ${EXPIRY_REASONS[customer.request_expiry_reason as ExpiryReason] || customer.request_expiry_reason}` : ' (لم يُسجّل سبب وقت التحويل)'}.` : 'طلب تالف: مرّ 60 يومًا كاملة منذ التسجيل دون إصدار وثيقة.'} بياناته محفوظة ويمكن إصدار وثيقة له عند استكمال الطلب.</p>}
    {expired && customer.request_expiry_note && <p className="text-sm text-secondary-600 break-words">{customer.request_expiry_note}</p>}

  </section>;
}
