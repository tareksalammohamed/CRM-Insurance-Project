import { memo, useState } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { Layers, Hash, UserRound, CalendarDays, CheckCircle2, ChevronDown, CheckCircle } from 'lucide-react';
import type { InstallmentWithRelations } from '../types';
import { formatCurrency } from '../utils/formatCurrency';
import { getInstallmentDisplayInfo } from '../utils/installmentDisplay';

interface CollectionGroupCardProps {
  members: InstallmentWithRelations[];
  onPayGroup: (members: InstallmentWithRelations[]) => void;
}

function initialOf(name: string | undefined): string {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0) : '؟';
}

// كارت مجمّع لأقساط أكثر من وثيقة ناتجة عن التقسيم التلقائي لوثيقة "حماية
// واستثمار" (نفس المجموعة + نفس تاريخ الاستحقاق) — بدل ما يظهروا كأقساط
// منفصلة يضطر المستخدم يسدّدها وثيقة وثيقة، بيتجمّعوا هنا وبيتسددوا بزرار واحد.
function CollectionGroupCardImpl({ members, onPayGroup }: CollectionGroupCardProps) {
  const [expanded, setExpanded] = useState(false);

  const first = members[0];
  const { dueDate, isOverdue, dayLabel } = getInstallmentDisplayInfo(first);
  const unpaidMembers = members.filter((m) => m.status !== 'paid');
  const allPaid = unpaidMembers.length === 0;
  const totalAmount = members.reduce((sum, m) => sum + Number(m.amount), 0);
  const unpaidAmount = unpaidMembers.reduce((sum, m) => sum + Number(m.amount), 0);

  const tone = allPaid ? 'col-tone-paid' : isOverdue ? 'col-tone-overdue' : 'col-tone-due';
  const customerName = first.policy.customer?.name || '-';

  return (
    <div className={clsx('col-row', tone)}>
      <div className="col-row-head">
        <span className="col-row-avatar" aria-hidden="true">
          {initialOf(customerName)}
        </span>

        <div className="col-row-ident">
          <span className="col-row-name" title={customerName}>
            {customerName}
          </span>
          <div className="col-row-sub">
            <span className="col-row-policy" dir="ltr">
              <Hash aria-hidden="true" />
              <span>{first.policy.policy_number.replace(/-\d+$/, '')}-1…{members.length}</span>
            </span>
          </div>
        </div>

        <span className="col-badge">
          <Layers aria-hidden="true" />
          <span>{members.length} وثائق مجمّعة</span>
        </span>
      </div>

      <div className="col-row-amount">
        <span className="col-row-amount-label">
          {allPaid ? 'إجمالي القسط الصافي (مسدد بالكامل)' : `إجمالي القسط الصافي المستحق (${unpaidMembers.length} من ${members.length})`}
        </span>
        <span className="col-row-amount-value">{formatCurrency(allPaid ? totalAmount : unpaidAmount)}</span>
      </div>

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
            <CheckCircle2 aria-hidden="true" />
            <span>الحالة</span>
          </p>
          <p className={clsx('col-cell-value', allPaid ? 'col-cell-value--success' : isOverdue && 'col-cell-value--danger')}>
            {allPaid ? 'تم السداد بالكامل' : dayLabel}
          </p>
        </div>

        <div className="col-cell col-cell--wide">
          <p className="col-cell-label">
            <UserRound aria-hidden="true" />
            <span>اسم الوكيل</span>
          </p>
          <p className="col-cell-value col-cell-value--muted">{first.policy.owner?.name || '-'}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="btn btn-secondary btn-sm w-full justify-between"
      >
        <span>عرض تفاصيل الوثائق ({members.length})</span>
        <ChevronDown className={clsx('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="space-y-1.5 pt-1">
          {members
            .slice()
            .sort((a, b) => a.policy.policy_number.localeCompare(b.policy.policy_number))
            .map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2 text-[12px]">
                <span className="font-mono text-secondary-600" dir="ltr">{m.policy.policy_number}</span>
                <span className="font-bold text-secondary-900">{formatCurrency(m.amount)}</span>
                <span className={clsx('text-[11px] font-semibold', m.status === 'paid' ? 'text-success-600' : 'text-secondary-400')}>
                  {m.status === 'paid' ? 'مسدد' : 'مستحق'}
                </span>
              </div>
            ))}
        </div>
      )}

      <div className="col-row-actions">
        {allPaid ? (
          <div className="btn btn-secondary btn-sm flex-1 pointer-events-none opacity-70">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم السداد بالكامل</span>
          </div>
        ) : (
          <button onClick={() => onPayGroup(unpaidMembers)} className="btn btn-primary btn-sm flex-1">
            <CheckCircle className="w-4 h-4" />
            <span>تسجيل سداد كل الوثائق ({unpaidMembers.length})</span>
          </button>
        )}
      </div>
    </div>
  );
}

export const CollectionGroupCard = memo(CollectionGroupCardImpl);
