import { Link } from 'react-router-dom';
import { LoadNotice } from '../../../../components/feedback/LoadNotice';
import { FirstYearSummary } from '../../../../features/installments/FirstYearSummary';
import { X } from 'lucide-react';
import type { Policy, Installment } from '../../../../lib/supabase';
import { InstallmentsTable } from '../../../../features/installments/InstallmentsTable';
import { useDialogBehavior } from '../../../../hooks/useDialogBehavior';
import { DialogPortal } from '../../../../components/ui/DialogPortal';

interface PolicyInstallmentsDialogProps {
  policy: Policy;
  installments: Installment[];
  loading: boolean;
  loadError?: string | null;
  onRetry: () => void;
  onClose: () => void;
  onPay: (installment: Installment) => void;
  onCancel: (installment: Installment) => void;
}

// ===== مودال جميع أقساط الوثيقة (سجل التحصيل) =====
export function PolicyInstallmentsDialog({
  policy,
  installments,
  loading,
  loadError,
  onRetry,
  onClose,
  onPay,
  onCancel,
}: PolicyInstallmentsDialogProps) {

  // Escape للإغلاق + قفل تمرير الخلفية + إرجاع التركيز للعنصر المُستدعى
  useDialogBehavior(onClose);

  return (
    <DialogPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content max-w-2xl animate-fadeIn max-h-[92dvh] overflow-y-auto"
          role="dialog"
          aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-secondary-200 sticky top-0 bg-white z-10">
            <h3 className="text-lg font-semibold text-secondary-900">
              أقساط السنة الأولى للوثيقة: {policy.policy_number}
            </h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary-100">
              <X className="w-5 h-5 text-secondary-600" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <LoadNotice message={loadError ?? null} loading={loading} onRetry={onRetry} />
            {!loadError && <>
            <FirstYearSummary installments={installments} loading={loading} />
            <InstallmentsTable
              installments={installments}
              loading={loading}
              onPay={onPay}
              onCancel={onCancel}
            />
            </>}
          </div>
          <div className="flex flex-wrap justify-end gap-3 p-6 border-t border-secondary-200">
            <Link to={`/policies/${policy.id}`} onClick={onClose} className="btn btn-primary">تفاصيل الوثيقة</Link>
            <button onClick={onClose} className="btn btn-secondary">
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
