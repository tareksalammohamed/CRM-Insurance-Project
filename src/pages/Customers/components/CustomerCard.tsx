import { memo } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { Hash } from 'lucide-react';
import type { CustomerWithRelations } from '../types';
import { getLatestPolicy, getCustomerPolicyStatus } from '../services/customersService';
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS, STATUS_LABEL } from '../constants';
import { formatCurrency } from '../utils';
import { CustomerActions } from './CustomerActions';
import type { ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';

interface CustomerCardProps {
  customer: CustomerWithRelations;
  onOpenDetails: (customer: CustomerWithRelations) => void;
  onOpenMoreMenu: (customer: CustomerWithRelations, anchor: ActionMenuAnchor) => void;
}

// الحرف الأول من الاسم كمرساة بصرية للصف — أسرع فى المسح البصري من أيقونة
// مستخدم عامة مكرّرة فى كل بطاقة، وبدون أى بيانات إضافية.
function initialOf(name: string): string {
  const trimmed = name?.trim();
  return trimmed ? Array.from(trimmed)[0] : '؟';
}

function CustomerCardImpl({ customer, onOpenDetails, onOpenMoreMenu }: CustomerCardProps) {
  const latestPolicy = getLatestPolicy(customer);
  const statusKey = getCustomerPolicyStatus(customer);

  return (
    <div
      onClick={() => onOpenDetails(customer)}
      className="crm-data-card customer-data-card card pressable cursor-pointer"
    >
      <div className="crm-data-card-header flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="data-card-avatar" aria-hidden="true">{initialOf(customer.name)}</span>
          <div className="min-w-0">
            <div className="font-semibold text-secondary-900 truncate">{customer.name}</div>
            <p className="data-card-ident" dir="ltr">
              <Hash />
              <span className="truncate font-mono">
                {latestPolicy ? latestPolicy.policy_number : '—'}
              </span>
            </p>
          </div>
        </div>
        <span className={clsx('badge shrink-0 gap-1.5', STATUS_BADGE_CLASS[statusKey])}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', STATUS_DOT_CLASS[statusKey])} />
          {STATUS_LABEL[statusKey]}
        </span>
      </div>

      <div className="crm-data-card-metrics grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
        <div>
          <p>رقم الهاتف</p>
          <p className="truncate" dir="ltr">{customer.phone || '-'}</p>
        </div>
        <div>
          <p>اسم الوكيل</p>
          <p className="truncate">{customer.owner?.name || '-'}</p>
        </div>
        <div>
          <p>قيمة القسط الصافي</p>
          <p className="text-figure">
            {latestPolicy ? formatCurrency(latestPolicy.premium_amount) : '-'}
          </p>
        </div>
        <div>
          <p>{latestPolicy ? 'تاريخ بداية التأمين' : 'تاريخ تسجيل الطلب'}</p>
          <p className="text-figure">
            {format(new Date(latestPolicy ? latestPolicy.start_date : customer.created_at), 'dd/MM/yyyy')}
          </p>
        </div>
      </div>

      <CustomerActions
        customer={customer}
        onViewDetails={onOpenDetails}
        onOpenMoreMenu={onOpenMoreMenu}
      />
    </div>
  );
}

// React.memo: البطاقة تُعاد رسمها فقط لو تغيّر العميل نفسه أو دوال
// الأحداث الممرَّرة له (وهي ثابتة بالفعل بفضل useCallback فى الصفحة
// الأم)، بدلاً من إعادة رسم كل البطاقات فى كل مرة تتغير فيها حالة أخرى
// فى الصفحة (مثل كتابة نص فى البحث)
export const CustomerCard = memo(CustomerCardImpl);
