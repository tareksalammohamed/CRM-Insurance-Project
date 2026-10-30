import { Link } from 'react-router-dom';
import { CalendarClock, User, Receipt, History as HistoryIcon, XCircle, CheckCircle } from 'lucide-react';
import { AppBottomSheet, type ActionMenuAnchor } from '../../../../components/ui/AppBottomSheet';
import type { InstallmentWithRelations } from '../../types';

interface MoreMenuDialogProps {
  installment: InstallmentWithRelations;
  onClose: () => void;
  onOpenPolicyHistory: () => void;
  onOpenCancel: () => void;
  onOpenPayment: () => void;
  onOpenPromise: () => void;
  anchor?: ActionMenuAnchor | null;
}

// ===== مودال "المزيد" — إجراءات إضافية لكل قسط =====
export function MoreMenuDialog({
  installment,
  onClose,
  onOpenPolicyHistory,
  onOpenCancel,
  onOpenPayment,
  onOpenPromise,
  anchor,
}: MoreMenuDialogProps) {
  return (
    <AppBottomSheet
      title={installment.policy.customer?.name || '-'}
      subtitle={
        <p className="text-xs text-secondary-500 mt-0.5 font-mono" dir="ltr">
          {installment.policy.policy_number}
        </p>
      }
      onClose={onClose}
      anchor={anchor || undefined}
      estimatedHeight={300}
    >
      <Link to={`/customers?open=${encodeURIComponent(installment.policy.customer_id)}`} onClick={onClose} className="dropdown-item w-full">
        <User className="w-4 h-4" />
        <span>فتح ملف العميل</span>
      </Link>
      <Link to={`/policies/${installment.policy_id}`} onClick={onClose} className="dropdown-item w-full">
        <Receipt className="w-4 h-4" />
        <span>تفاصيل الوثيقة</span>
      </Link>
      <button onClick={onOpenPolicyHistory} className="dropdown-item w-full">
        <HistoryIcon className="w-4 h-4" />
        <span>سجل أقساط السنة الأولى للوثيقة</span>
      </button>
      {installment.status !== 'paid' && installment.policy.status === 'active' && <button onClick={onOpenPromise} className="dropdown-item w-full"><CalendarClock className="w-4 h-4" /><span>وعد بالسداد / متابعة الوعد</span></button>}
      {installment.status === 'paid' ? (
        <button onClick={onOpenCancel} className="dropdown-item w-full text-error-600">
          <XCircle className="w-4 h-4" />
          <span>إلغاء السداد</span>
        </button>
      ) : (
        <button onClick={onOpenPayment} className="dropdown-item w-full text-primary-700">
          <CheckCircle className="w-4 h-4" />
          <span>تسجيل السداد</span>
        </button>
      )}
    </AppBottomSheet>
  );
}
