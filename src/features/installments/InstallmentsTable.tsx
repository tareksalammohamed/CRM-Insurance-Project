import { CheckCircle, Clock, AlertTriangle, CreditCard, XCircle, Inbox, Hash } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

import type { Installment, PolicyStatus } from '../../lib/supabase';
import { INSTALLMENT_STATUS_LABELS } from '../../lib/supabase';
import { canPay, isEarlyPayment, getInstallmentBadgeClass, formatCurrency } from './installmentHelpers';

// ===================================
// جدول الأقساط الموحّد — مكوّن واحد فقط يُعاد استخدامه فى:
// - صفحة التحصيل والسداد (مودال أقساط الوثيقة)
// - صفحة الوثائق → تفاصيل الوثيقة
// - صفحة العملاء → تفاصيل الوثيقة
// أي تطوير أو تعديل هنا يظهر تلقائياً فى الثلاث أماكن.
// ===================================
interface InstallmentsTableProps {
  installments: Installment[];
  loading?: boolean;
  // لو اتحددت، زر "سداد" بيتقفل تلقائياً لو الوثيقة مش نشطة (نفس شرط صفحة
  // تفاصيل الوثيقة الحالي). لو مش متحددة، الزر بيعتمد فقط على حالة القسط.
  policyStatus?: PolicyStatus;
  onPay: (installment: Installment) => void;
  onCancel: (installment: Installment) => void;
  emptyMessage?: string;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'paid':
      return <CheckCircle className="w-4 h-4 text-success-600 shrink-0" />;
    case 'overdue':
      return <AlertTriangle className="w-4 h-4 text-error-600 shrink-0" />;
    default:
      return <Clock className="w-4 h-4 text-secondary-400 shrink-0" />;
  }
}

export function InstallmentsTable({
  installments,
  loading = false,
  policyStatus,
  onPay,
  onCancel,
  emptyMessage = 'لا توجد أقساط لهذه الوثيقة',
}: InstallmentsTableProps) {
  if (loading) {
    return (
      <div className="stack-list" role="status" aria-live="polite">
        <span className="sr-only">جارٍ تحميل الأقساط…</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stack-row">
            <div className="stack-row-head">
              <span className="skeleton-bar h-3.5 w-28" />
              <span className="skeleton-bar h-5 w-16 !rounded-full" />
            </div>
            <div className="stack-row-grid">
              <span className="skeleton-bar h-3 w-20" />
              <span className="skeleton-bar h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (installments.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <Inbox className="w-6 h-6" />
        </span>
        <p className="empty-state-title">{emptyMessage}</p>
      </div>
    );
  }

  const payAllowed = (inst: Installment) => canPay(inst) && (policyStatus ? policyStatus === 'active' : true);

  const renderAction = (inst: Installment) => {
    if (inst.status === 'paid') {
      return (
        <button
          onClick={() => onCancel(inst)}
          className="btn btn-secondary btn-sm"
          aria-label={`إلغاء سداد القسط رقم ${inst.installment_number}`}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>إلغاء السداد</span>
        </button>
      );
    }
    if (payAllowed(inst)) {
      return (
        <button
          onClick={() => onPay(inst)}
          className="btn btn-primary btn-sm"
          aria-label={`سداد القسط رقم ${inst.installment_number}`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>سداد</span>
          {isEarlyPayment(inst) && <span className="text-xs opacity-75">(مبكر)</span>}
        </button>
      );
    }
    return <span className="text-secondary-400 text-sm">—</span>;
  };

  return (
    <>
      {/* ===== الموبايل: كل قسط فى بطاقة مستقلة (نفس البيانات بالحرف) ===== */}
      <div className="stack-list md:hidden">
        {installments.map((inst) => (
          <div key={inst.id} className="stack-row">
            <div className="stack-row-head">
              <span className="stack-row-title">
                <Hash className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                <span className="truncate">القسط {inst.installment_number}</span>
                {inst.is_first && <span className="badge badge-primary text-[10px] shrink-0">إنتاج جديد</span>}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                {getStatusIcon(inst.status)}
                <span className={clsx('badge text-[10px]', getInstallmentBadgeClass(inst.status))}>
                  {INSTALLMENT_STATUS_LABELS[inst.status]}
                </span>
              </span>
            </div>

            <div className="stack-row-grid">
              <div className="stack-row-cell">
                <span>المبلغ</span>
                <span>{formatCurrency(inst.amount)}</span>
              </div>
              <div className="stack-row-cell">
                <span>تاريخ الاستحقاق</span>
                <span>
                  {format(new Date(inst.due_date), 'dd/MM/yyyy')}
                  {isEarlyPayment(inst) && <span className="badge badge-info text-[10px] mr-1.5">مبكر</span>}
                </span>
              </div>
              <div className="stack-row-cell col-span-2">
                <span>تاريخ السداد</span>
                <span>
                  {inst.paid_at ? format(new Date(inst.paid_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : '—'}
                </span>
              </div>
            </div>

            {(inst.status === 'paid' || payAllowed(inst)) && (
              <div className="stack-row-actions">{renderAction(inst)}</div>
            )}
          </div>
        ))}
      </div>

      {/* ===== الديسكتوب: الجدول الكامل ===== */}
      <div className="table-container hidden md:block">
        <table>
          <thead>
            <tr>
              <th scope="col">رقم القسط</th>
              <th scope="col">تاريخ الاستحقاق</th>
              <th scope="col">المبلغ</th>
              <th scope="col">الحالة</th>
              <th scope="col">تاريخ السداد</th>
              <th scope="col">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((inst) => (
              <tr key={inst.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{inst.installment_number}</span>
                    {inst.is_first && <span className="badge badge-primary text-xs">إنتاج جديد</span>}
                  </div>
                </td>

                <td>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    {format(new Date(inst.due_date), 'dd/MM/yyyy')}
                    {isEarlyPayment(inst) && <span className="badge badge-info text-xs">مبكر</span>}
                  </div>
                </td>

                <td className="tabular-nums font-semibold">{formatCurrency(inst.amount)}</td>

                <td>
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(inst.status)}
                    <span className={clsx('badge', getInstallmentBadgeClass(inst.status))}>
                      {INSTALLMENT_STATUS_LABELS[inst.status]}
                    </span>
                  </div>
                </td>

                <td className="tabular-nums">
                  {inst.paid_at ? format(new Date(inst.paid_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : '—'}
                </td>

                <td>{renderAction(inst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
