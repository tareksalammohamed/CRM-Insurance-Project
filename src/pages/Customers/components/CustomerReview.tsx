import { customerRequestStatus } from '../../../lib/customerRequestStatus';
import { ClipboardCheck, AlertTriangle, ArrowLeft, FileWarning } from 'lucide-react';
import { customerInputHints } from '../../../lib/inputGuidance';
import type { CustomerPolicySummary, CustomerWithRelations } from '../types';

export function CustomerReview({ customer, onEdit, onOpenPolicy }: {
  customer: CustomerWithRelations;
  onEdit: () => void;
  onOpenPolicy: (policy: CustomerPolicySummary) => void;
}) {
  const expired = customerRequestStatus(customer) === 'expired';
  const hints = customerInputHints({ ...customer });
  if (!customer.phone?.trim()) hints.unshift('رقم الهاتف غير مسجل؛ أضفه لتسهيل التواصل ومتابعة التحصيل.');
  if (!customer.national_id?.trim()) hints.push('الرقم القومي غير مسجل؛ راجعه مع المستند للمساعدة في تمييز العميل وتجنب تكراره.');
  const policies = customer.policies ?? [];
  const missingAmounts = policies.filter(policy => policy.status === 'active' && (policy.sum_assured == null || policy.sum_assured <= 0));
  const count = hints.length + missingAmounts.length;
  return <section className={`customer-review ${count ? 'customer-review-attention' : ''}`} aria-label="مراجعة ملف العميل">
    <div className="customer-review-heading">
      <span className="customer-review-icon"><ClipboardCheck aria-hidden="true" /></span>
      <div><h4>مراجعة ملف العميل</h4><p>{count ? `${count} ملاحظة تستحق المراجعة` : 'لم تظهر ملاحظات في فحوص البيانات المتاحة'}</p></div>
      {hints.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>مراجعة البيانات<ArrowLeft className="w-3.5 h-3.5" /></button>}
    </div>
    {count > 0 && <details className="customer-review-details"><summary>عرض الملاحظات وأسبابها</summary>
      <ul>{hints.map(hint => <li key={hint}><AlertTriangle aria-hidden="true" /><p>{hint}</p></li>)}
        {missingAmounts.map(policy => <li key={policy.id}><FileWarning aria-hidden="true" /><div><p>الوثيقة <bdi>{policy.policy_number}</bdi>: مبلغ التأمين غير مسجل أو يساوي صفرًا؛ راجعه لأن احتساب العمولة يعتمد عليه.</p><button type="button" className="customer-review-link" onClick={() => onOpenPolicy(policy)}>مراجعة هذه الوثيقة</button></div></li>)}
      </ul>
      <p className="customer-review-footnote">ملاحظات للمراجعة وفق البيانات المسجلة؛ لا تمنع الحفظ ولا تعدّل البيانات تلقائيًا.</p>
    </details>}
    {expired && <p className="text-sm text-secondary-600">طلب تالف: مرّ 60 يومًا كاملة منذ التسجيل دون إصدار وثيقة. محفوظ للمراجعة وخارج قائمة قيد الإصدار.</p>}
    <div className="customer-workflow-strip">
      <span><strong>العميل</strong><small>ملف مسجل</small></span>
      <span><strong>الوثائق</strong><small>{policies.length} وثيقة مرتبطة</small></span>
      <span><strong>الخطوة التالية</strong><small>{policies.length ? 'افتح حالة الأقساط داخل الوثيقة بالأسفل' : expired ? 'مراجعة الطلب التالف مع المسؤول' : 'راجع بيانات الطلب ثم اختر وثيقة جديدة'}</small></span>
    </div>
  </section>;
}
