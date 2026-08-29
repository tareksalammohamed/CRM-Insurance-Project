import { memo } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import {
  Hash,
  UserRound,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Clock3,
} from 'lucide-react';
import type { InstallmentWithRelations } from '../types';
import { formatCurrency } from '../utils/formatCurrency';
import { getInstallmentDisplayInfo } from '../utils/installmentDisplay';
import { CollectionActions } from './CollectionActions';
import type { ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';

interface CollectionCardProps {
  installment: InstallmentWithRelations;
  onPay: (installment: InstallmentWithRelations) => void;
  onCancel: (installment: InstallmentWithRelations) => void;
  onMore: (installment: InstallmentWithRelations, anchor: ActionMenuAnchor) => void;
}

// أول حرف من اسم العميل — مرساة بصرية تسرّع المسح البصري للقائمة
function initialOf(name: string | undefined): string {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0) : '؟';
}

function CollectionCardImpl({ installment, onPay, onCancel, onMore }: CollectionCardProps) {
  // كل دلالات الحالة تأتى من نفس الدالة المشتركة بدون أى تغيير فى منطقها
  const { dueDate, isPaid, isOverdue, dayLabel, statusLabel } = getInstallmentDisplayInfo(installment);

  // نبرة الحالة: مسدد = أخضر، متأخر = أحمر، مستحق = عنبري
  const tone = isPaid ? 'col-tone-paid' : isOverdue ? 'col-tone-overdue' : 'col-tone-due';
  const StatusIcon = isPaid ? CheckCircle2 : isOverdue ? AlertTriangle : Clock3;

  const customerName = installment.policy.customer?.name || '-';

  return (
    <div className={clsx('col-row', tone)}>
      {/* ===== الهوية: العميل + رقم الوثيقة + حالة القسط ===== */}
      <div className="col-row-head">
        <span className="col-row-avatar" aria-hidden="true">
          {initialOf(installment.policy.customer?.name)}
        </span>

        <div className="col-row-ident">
          <span className="col-row-name" title={customerName}>
            {customerName}
          </span>
          <div className="col-row-sub">
            <span className="col-row-policy" dir="ltr">
              <Hash aria-hidden="true" />
              <span>{installment.policy.policy_number}</span>
            </span>
            {installment.is_first && <span className="col-kpi-chip">القسط الأول</span>}
          </div>
        </div>

        <span className="col-badge">
          <StatusIcon aria-hidden="true" />
          <span>{statusLabel}</span>
        </span>
      </div>

      {/* ===== المبلغ الحاكم — أبرز رقم فى البطاقة، فى سطر مستقل ===== */}
      <div className="col-row-amount">
        <span className="col-row-amount-label">قيمة القسط الصافي</span>
        <span className="col-row-amount-value">{formatCurrency(installment.amount)}</span>
      </div>

      {/* ===== تفاصيل تشغيلية ===== */}
      <div className="col-row-grid">
        <div className="col-cell">
          <p className="col-cell-label">
            <CalendarDays aria-hidden="true" />
            <span>تاريخ الاستحقاق</span>
          </p>
          <p className="col-cell-value">{format(dueDate, 'dd/MM/yyyy')}</p>
        </div>

        <div className="col-cell">
          <p className="col-cell-label">
            <Clock3 aria-hidden="true" />
            <span>{isPaid ? 'تاريخ السداد' : 'الأيام'}</span>
          </p>
          <p
            className={clsx(
              'col-cell-value',
              isPaid ? 'col-cell-value--success' : isOverdue && 'col-cell-value--danger'
            )}
          >
            {isPaid
              ? installment.paid_at
                ? format(new Date(installment.paid_at), 'dd/MM/yyyy')
                : '-'
              : dayLabel}
          </p>
        </div>

        <div className="col-cell col-cell--wide">
          <p className="col-cell-label">
            <UserRound aria-hidden="true" />
            <span>اسم الوكيل</span>
          </p>
          <p className="col-cell-value col-cell-value--muted">
            {installment.policy.owner?.name || '-'}
          </p>
        </div>
      </div>

      <CollectionActions
        installment={installment}
        isPaid={isPaid}
        onPay={onPay}
        onCancel={onCancel}
        onMore={onMore}
      />
    </div>
  );
}

// React.memo: يمنع إعادة رسم كل بطاقات الأقساط عند إعادة رسم الصفحة لأسباب
// لا علاقة لها بالبطاقة نفسها
export const CollectionCard = memo(CollectionCardImpl);
