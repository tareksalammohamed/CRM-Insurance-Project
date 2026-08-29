import { CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { type ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';
import type { InstallmentWithRelations } from '../types';

interface CollectionActionsProps {
  installment: InstallmentWithRelations;
  isPaid: boolean;
  onPay: (installment: InstallmentWithRelations) => void;
  onCancel: (installment: InstallmentWithRelations) => void;
  onMore: (installment: InstallmentWithRelations, anchor: ActionMenuAnchor) => void;
}

export function CollectionActions({ installment, isPaid, onPay, onCancel, onMore }: CollectionActionsProps) {
  return (
    <div className="col-row-actions">
      {isPaid ? (
        <button onClick={() => onCancel(installment)} className="btn btn-secondary btn-sm flex-1">
          <XCircle className="w-4 h-4" />
          <span>إلغاء السداد</span>
        </button>
      ) : (
        <button onClick={() => onPay(installment)} className="btn btn-primary btn-sm flex-1">
          <CheckCircle className="w-4 h-4" />
          <span>تسجيل السداد</span>
        </button>
      )}
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onMore(installment, { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
        }}
        className="btn btn-secondary btn-sm touch-target shrink-0"
        title="المزيد"
        aria-label="إجراءات إضافية"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}
