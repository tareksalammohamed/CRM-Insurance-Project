import { memo } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { FileText, User as UserIcon } from 'lucide-react';
import { POLICY_TYPE_LABELS, POLICY_STATUS_LABELS, type Policy } from '../../../lib/supabase';
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS } from '../constants';
import { formatCurrency } from '../utils/formatCurrency';
import { PolicyActions } from './PolicyActions';
import type { ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';

interface PolicyCardProps {
  policy: Policy;
  onOpenDetails: (policy: Policy) => void;
  onOpenMoreMenu: (policy: Policy, anchor: ActionMenuAnchor) => void;
}

function PolicyCardImpl({ policy, onOpenDetails, onOpenMoreMenu }: PolicyCardProps) {
  return (
    <div
      onClick={() => onOpenDetails(policy)}
      className="crm-data-card policy-data-card card pressable cursor-pointer"
    >
      <div className="crm-data-card-header flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="data-card-avatar" aria-hidden="true">
            <FileText className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-secondary-900 truncate">
              {(policy as any).customer?.name || '-'}
            </div>
            {/* رقم الوثيقة هو المُعرّف الأهم فى سياق الوثائق — يُقدَّم كسطر
                هوية ثانوي بخط أحادي المسافة لسهولة المقارنة البصرية. */}
            <p className="data-card-ident" dir="ltr">
              <FileText />
              <span className="truncate font-mono">{policy.policy_number}</span>
            </p>
          </div>
        </div>
        <span className={clsx('badge shrink-0 gap-1.5', STATUS_BADGE_CLASS[policy.status] || 'badge-secondary')}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', STATUS_DOT_CLASS[policy.status] || 'bg-secondary-400')} />
          {POLICY_STATUS_LABELS[policy.status]}
        </span>
      </div>

      <div className="crm-data-card-metrics grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
        <div>
          <p>نوع الوثيقة</p>
          <p className="truncate">{POLICY_TYPE_LABELS[policy.policy_type]}</p>
        </div>
        <div>
          <p>مبلغ التأمين</p>
          <p className="text-figure">{policy.sum_assured ? formatCurrency(policy.sum_assured) : '-'}</p>
        </div>
        <div>
          <p>قيمة القسط الصافي</p>
          <p className="text-figure">{formatCurrency(policy.premium_amount)}</p>
        </div>
        <div>
          <p>تاريخ البداية</p>
          <p className="text-figure">{format(new Date(policy.start_date), 'dd/MM/yyyy')}</p>
        </div>
        <div className="col-span-2">
          <p>اسم الوكيل</p>
          <p className="truncate flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
            {(policy as any).owner?.name || '-'}
          </p>
        </div>
      </div>

      <PolicyActions
        policy={policy}
        onViewDetails={onOpenDetails}
        onOpenMoreMenu={onOpenMoreMenu}
      />
    </div>
  );
}

// React.memo: نفس منطق CustomerCard — تُعاد رسم البطاقة فقط عند تغيّر
// بياناتها الفعلية أو دوال الأحداث الثابتة الممرَّرة لها
export const PolicyCard = memo(PolicyCardImpl);
