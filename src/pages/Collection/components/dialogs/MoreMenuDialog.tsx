import { User, Receipt, History as HistoryIcon, XCircle, CheckCircle } from 'lucide-react';
import { AppBottomSheet, type ActionMenuAnchor } from '../../../../components/ui/AppBottomSheet';
import type { InstallmentWithRelations } from '../../types';

interface MoreMenuDialogProps {
  installment: InstallmentWithRelations;
  onClose: () => void;
  onShowCustomerDetails: () => void;
  onShowPolicyDetails: () => void;
  onOpenPolicyHistory: () => void;
  onOpenCancel: () => void;
  onOpenPayment: () => void;
  anchor?: ActionMenuAnchor | null;
}

// ===== مودال "المزيد" — إجراءات إضافية لكل قسط =====
export function MoreMenuDialog({
  installment,
  onClose,
  onShowCustomerDetails,
  onShowPolicyDetails,
  onOpenPolicyHistory,
  onOpenCancel,
  onOpenPayment,
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
      <button onClick={onShowCustomerDetails} className="dropdown-item w-full">
        <User className="w-4 h-4" />
        <span>عرض بيانات العميل</span>
      </button>
      <button onClick={onShowPolicyDetails} className="dropdown-item w-full">
        <Receipt className="w-4 h-4" />
        <span>عرض بيانات الوثيقة</span>
      </button>
      <button onClick={onOpenPolicyHistory} className="dropdown-item w-full">
        <HistoryIcon className="w-4 h-4" />
        <span>سجل التحصيل (كل أقساط الوثيقة)</span>
      </button>
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
