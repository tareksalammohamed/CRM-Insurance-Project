import { memo } from 'react';
import { format } from 'date-fns';
import { Layers, User as UserIcon, ListChecks } from 'lucide-react';
import { POLICY_TYPE_LABELS, type Policy } from '../../../lib/supabase';
import { formatCurrency } from '../utils/formatCurrency';

interface GroupedPolicyCardProps {
  members: Policy[];
  onOpenMembers: (members: Policy[]) => void;
}

function GroupedPolicyCardImpl({ members, onOpenMembers }: GroupedPolicyCardProps) {
  const sorted = [...members].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime() || a.policy_number.localeCompare(b.policy_number)
  );
  const first = sorted[0];
  const totalSumAssured = members.reduce((sum, p) => sum + (p.sum_assured || 0), 0);
  const totalPremium = members.reduce((sum, p) => sum + Number(p.premium_amount || 0), 0);
  const activeCount = members.filter((p) => p.status === 'active').length;
  const cancelledCount = members.length - activeCount;

  return (
    <div
      onClick={() => onOpenMembers(sorted)}
      className="crm-data-card policy-data-card card pressable cursor-pointer"
    >
      <div className="crm-data-card-header flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="data-card-avatar" aria-hidden="true">
            <Layers className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-secondary-900 truncate">
              {(first as any).customer?.name || '-'}
            </div>
            <p className="data-card-ident" dir="ltr">
              <Layers />
              <span className="truncate font-mono">
                {first.policy_number}
                {members.length > 1 && ` +${members.length - 1} أخرى`}
              </span>
            </p>
          </div>
        </div>
        <span className="badge shrink-0 gap-1.5 badge-primary">
          <Layers className="w-3 h-3" />
          {members.length} وثائق مرتبطة
        </span>
      </div>

      <div className="crm-data-card-metrics grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
        <div>
          <p>نوع الوثيقة</p>
          <p className="truncate">{POLICY_TYPE_LABELS[first.policy_type]}</p>
        </div>
        <div>
          <p>إجمالي مبلغ التأمين</p>
          <p className="text-figure">{formatCurrency(totalSumAssured)}</p>
        </div>
        <div>
          <p>إجمالي القسط الصافي</p>
          <p className="text-figure">{formatCurrency(totalPremium)}</p>
        </div>
        <div>
          <p>تاريخ البداية</p>
          <p className="text-figure">{format(new Date(first.start_date), 'dd/MM/yyyy')}</p>
        </div>
        <div>
          <p>الحالة</p>
          <p className="truncate">
            {cancelledCount === 0 ? `${activeCount} نشطة` : `${activeCount} نشطة / ${cancelledCount} ملغاة`}
          </p>
        </div>
        <div>
          <p>اسم الوكيل</p>
          <p className="truncate flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
            {(first as any).owner?.name || '-'}
          </p>
        </div>
      </div>

      <div className="crm-data-card-actions flex gap-2 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMembers(sorted);
          }}
          className="btn btn-secondary btn-sm flex-1"
        >
          <ListChecks className="w-4 h-4" />
          <span>عرض كل الوثائق بالترتيب ({members.length})</span>
        </button>
      </div>
    </div>
  );
}

// React.memo: نفس منطق PolicyCard — تُعاد رسم الكارت فقط عند تغيّر أعضاء
// المجموعة الفعليين أو دالة الفتح الثابتة الممرَّرة له
export const GroupedPolicyCard = memo(GroupedPolicyCardImpl);
