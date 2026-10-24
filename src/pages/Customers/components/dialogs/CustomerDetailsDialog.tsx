import { useId, useState } from 'react';
import { FollowupPanel } from '../../../../features/customerFollowup/FollowupPanel';
import { CopyValueButton } from '../../../../components/ui/CopyValueButton';
import { CustomerReview } from '../CustomerReview';
import { AppDialog } from '../../../../components/ui/AppDialog';
import clsx from 'clsx';
import { format } from 'date-fns';
import { X, Phone, User as UserIcon, FileText, ChevronDown, ShieldPlus, CreditCard, Edit2, Printer, Inbox, BadgeCheck, CalendarClock, TimerReset } from 'lucide-react';
import { MARITAL_STATUS_LABELS, PAYMENT_METHOD_LABELS, POLICY_STATUS_LABELS, POLICY_TYPE_LABELS } from '../../../../lib/supabase';
import type { PolicyInstallmentSummary } from '../../../../features/installments/installmentsService';
import type { CustomerPolicySummary, CustomerWithRelations } from '../../types';
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS } from '../../constants';
import { formatCurrency, sortPoliciesByStartDate } from '../../utils';

interface CustomerDetailsDialogProps {
  customer: CustomerWithRelations;
  showExtraInfo: boolean;
  onToggleExtraInfo: () => void;
  policySummaries: Record<string, PolicyInstallmentSummary>;
  onClose: () => void;
  onEdit: (customer: CustomerWithRelations) => void;
  onPrint: (customer: CustomerWithRelations) => void;
  onIssueNewPolicy: (customer: CustomerWithRelations) => void;
  onOpenPolicyDetails: (policy: CustomerPolicySummary, filter?: 'all' | 'paid' | 'pending' | 'overdue') => void;

}

export function CustomerDetailsDialog({
  customer,
  showExtraInfo,
  onToggleExtraInfo,
  policySummaries,
  onClose,
  onEdit,
  onPrint,
  onIssueNewPolicy,
  onOpenPolicyDetails,
}: CustomerDetailsDialogProps) {
  const [section, setSection] = useState<'overview' | 'policies' | 'followups'>('overview');
  const [policiesVisited, setPoliciesVisited] = useState(false);
  const [followupsVisited, setFollowupsVisited] = useState(false);
  const sectionId = useId();
  const sortedPolicies = sortPoliciesByStartDate(customer.policies || []);


  return (
    <AppDialog onClose={onClose} ariaLabel={`تفاصيل العميل ${customer.name}`} className="customer-workspace modal-form-shell max-w-4xl animate-fadeIn">
          <div className="modal-form-header flex items-center justify-between gap-3 p-4 md:p-5 border-b border-secondary-200 bg-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="data-card-avatar" aria-hidden="true">
                <UserIcon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-extrabold text-secondary-900 break-words tracking-tight">
                  {customer.name}
                </h3>
                <p className="text-[11px] font-semibold text-secondary-400 mt-0.5">مساحة عمل العميل</p>
              </div>
            </div>
            <button onClick={onClose} className="icon-button shrink-0" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="customer-workspace-nav" role="group" aria-label="أقسام ملف العميل">
            {([{ id: 'overview', label: 'البيانات والمراجعة' }, { id: 'policies', label: `الوثائق والأقساط (${sortedPolicies.length})` }, { id: 'followups', label: 'المتابعات ووعود السداد' }] as const).map(item => <button key={item.id} type="button" aria-pressed={section === item.id} aria-controls={`${sectionId}-${item.id}`} onClick={() => { setSection(item.id); if (item.id === 'policies') setPoliciesVisited(true); if (item.id === 'followups') setFollowupsVisited(true); }}>{item.label}</button>)}
          </div>
          <div className="modal-form-scroll p-4 md:p-5">
            <div id={`${sectionId}-overview`} hidden={section !== 'overview'}><div className="space-y-4">
            {/* ===== البيانات الأساسية فقط: رقم الهاتف، الوكيل المسؤول، عدد الوثائق ===== */}
            <div className="detail-field-grid customer-overview-grid">
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <Phone className="w-3 h-3" /> رقم الهاتف
                </span>
                <span className="detail-field-value break-words select-text" dir="ltr">{customer.phone || '-'}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> الوكيل المسؤول
                </span>
                <span className="detail-field-value break-words">{customer.owner?.name || '-'}</span>
              </div>

            </div>

            {/* اتصال سريع — الإجراء الأكثر تكرارًا، بارز فى متناول الإبهام */}
            {customer.phone && (
              <div className="customer-contact-actions">
                <a href={`tel:${customer.phone}`} className="btn btn-outline btn-sm">
                  <Phone className="w-4 h-4" />
                  <span>الاتصال بالعميل</span>
                </a>
                <CopyValueButton key={customer.phone} value={customer.phone} label="نسخ الرقم" />
              </div>
            )}

            <CustomerReview policySummaries={policySummaries} customer={customer} onEdit={() => onEdit(customer)} onOpenPolicy={onOpenPolicyDetails} />

            {/* ===== بيانات إضافية (اختيارية) — نفس البيانات محفوظة وقابلة للتعديل، فقط غير معروضة افتراضياً ===== */}
            <div className="surface-sunken !p-0">
              <button
                onClick={onToggleExtraInfo}
                className="detail-section-toggle"
                aria-expanded={showExtraInfo}
              >
                <span className="detail-section-toggle-label">
                  <UserIcon />
                  بيانات إضافية
                </span>
                <ChevronDown
                  className={clsx('w-4 h-4 text-secondary-400 transition-transform shrink-0', showExtraInfo && 'rotate-180')}
                />
              </button>

              {showExtraInfo && (
                <div className="detail-section-body animate-fadeIn">
                  <div className="detail-field-grid !grid-cols-2">
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">الرقم القومي</span>
                      <span className="detail-field-value" dir="ltr">{customer.national_id || '-'}</span>
                    </div>
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">العنوان</span>
                      <span className="detail-field-value">{customer.address || '-'}</span>
                    </div>
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">تاريخ الميلاد</span>
                      <span className="detail-field-value">
                        {customer.birth_date ? format(new Date(customer.birth_date), 'dd/MM/yyyy') : '-'}
                      </span>
                    </div>
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">المهنة</span>
                      <span className="detail-field-value">{customer.occupation || '-'}</span>
                    </div>
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">الحالة الاجتماعية</span>
                      <span className="detail-field-value">
                        {customer.marital_status ? MARITAL_STATUS_LABELS[customer.marital_status] : '-'}
                      </span>
                    </div>
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">مبلغ التأمين (طلب التأمين)</span>
                      <span className="detail-field-value">
                        {customer.insurance_amount != null ? formatCurrency(customer.insurance_amount) : '-'}
                      </span>
                    </div>
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">طريقة السداد (طلب التأمين)</span>
                      <span className="detail-field-value">
                        {customer.payment_method ? PAYMENT_METHOD_LABELS[customer.payment_method] : '-'}
                      </span>
                    </div>
                    <div className="detail-field !bg-white">
                      <span className="detail-field-label">العربون</span>
                      <span className="detail-field-value">
                        {customer.deposit_amount != null ? formatCurrency(customer.deposit_amount) : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            </div></div>
            <div id={`${sectionId}-followups`} hidden={section !== 'followups'}>
              {followupsVisited && <FollowupPanel key={customer.id} customerId={customer.id} initiallyOpen />}
            </div>

            {/* ===== الوثائق: بطاقة مستقلة لكل وثيقة ===== */}
            <div id={`${sectionId}-policies`} hidden={section !== 'policies'}>
              {policiesVisited && <>
              <div className="card-section-head">
                <span className="card-section-title">
                  <FileText className="w-4 h-4 text-primary-600" />
                  الوثائق
                  <span className="card-section-meta">({sortedPolicies.length})</span>
                </span>
                <button onClick={() => onIssueNewPolicy(customer)} className="btn btn-outline btn-sm shrink-0">
                  <ShieldPlus className="w-3.5 h-3.5" />
                  <span>وثيقة جديدة</span>
                </button>
              </div>

              {sortedPolicies.length === 0 ? (
                <div className="surface-sunken">
                  <div className="empty-state">
                    <span className="empty-state-icon">
                      <Inbox className="w-6 h-6" />
                    </span>
                    <p className="empty-state-title">لا توجد وثائق لهذا العميل بعد</p>
                    <p className="empty-state-desc">يمكنك إصدار أول وثيقة من الزر أعلى القائمة</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortedPolicies.map((policy) => {
                    const summary = policySummaries[policy.id];
                    return (
                      <div key={policy.id} className="surface-sunken p-3">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <p className="text-[13px] font-extrabold text-secondary-900 font-mono truncate" dir="ltr">
                              {policy.policy_number}
                            </p>
                            <p className="text-[11px] font-semibold text-secondary-500 mt-0.5">
                              {POLICY_TYPE_LABELS[policy.policy_type]}
                            </p>
                          </div>
                          <span className={clsx('badge shrink-0 gap-1.5', STATUS_BADGE_CLASS[policy.status])}>
                            <span className={clsx('w-1.5 h-1.5 rounded-full', STATUS_DOT_CLASS[policy.status])} />
                            {POLICY_STATUS_LABELS[policy.status]}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5">
                          <div className="min-w-0">
                            <p className="detail-field-label">مبلغ التأمين</p>
                            <p className="detail-field-value text-figure break-words">
                              {policy.sum_assured != null ? formatCurrency(policy.sum_assured) : '—'}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="detail-field-label">القسط الصافي</p>
                            <p className="detail-field-value text-figure break-words">
                              {formatCurrency(policy.premium_amount)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="detail-field-label">تاريخ الإصدار</p>
                            <p className="detail-field-value text-figure break-words">
                              {format(new Date(policy.start_date), 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </div>

                        {summary && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            <button
                              type="button"
                              onClick={() => onOpenPolicyDetails(policy, 'paid')}
                              className="badge badge-success badge-actionable"
                              aria-label={`عرض الأقساط المسددة (${summary.paid})`}
                            >
                              <BadgeCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                              مسدد {summary.paid}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenPolicyDetails(policy, 'pending')}
                              className="badge badge-warning badge-actionable"
                              aria-label={`عرض الأقساط المستحقة (${summary.pending})`}
                            >
                              <CalendarClock className="w-3 h-3 shrink-0" aria-hidden="true" />
                              مستحق {summary.pending}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenPolicyDetails(policy, 'overdue')}
                              className="badge badge-error badge-actionable"
                              aria-label={`عرض الأقساط المتأخرة (${summary.overdue})`}
                            >
                              <TimerReset className="w-3 h-3 shrink-0" aria-hidden="true" />
                              متأخر {summary.overdue}
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => onOpenPolicyDetails(policy)}
                          className="btn btn-secondary btn-sm w-full mt-2.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>عرض التفاصيل</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              </>}
            </div>
          </div>

          <div className="modal-actions flex items-center gap-2.5 p-4 md:p-5">
            <button onClick={() => onEdit(customer)} className="btn btn-primary flex-1">
              <Edit2 className="w-4 h-4" />
              <span>تعديل البيانات</span>
            </button>
            <button onClick={() => onPrint(customer)} className="btn btn-secondary flex-1">
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          </div>

          <div className="safe-area-bottom" />
    </AppDialog>
  );
}
