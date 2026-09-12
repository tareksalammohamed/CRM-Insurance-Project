import { X, FileText, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { POLICY_STATUS_LABELS, type Policy } from '../../../../lib/supabase';
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS } from '../../constants';
import { formatCurrency } from '../../utils/formatCurrency';
import { useDialogBehavior } from '../../../../hooks/useDialogBehavior';
import { DialogPortal } from '../../../../components/ui/DialogPortal';

interface PolicyGroupMembersDialogProps {
  members: Policy[];
  onClose: () => void;
  onOpenDetails: (policy: Policy) => void;
}

// مودال "عرض كل الوثائق" — بيعرض كل وثائق "حماية واستثمار" لنفس العميل ونفس
// الوكيل بالترتيب الزمني (الأقدم فالأحدث)، مع إمكانية فتح تفاصيل أي وثيقة
// منفردة منها.
export function PolicyGroupMembersDialog({ members, onClose, onOpenDetails }: PolicyGroupMembersDialogProps) {
  useDialogBehavior(onClose);

  const sorted = [...members].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime() || a.policy_number.localeCompare(b.policy_number)
  );
  const totalSumAssured = sorted.reduce((sum, p) => sum + (p.sum_assured || 0), 0);

  return (
    <DialogPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content max-w-lg animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between gap-3 p-4 md:p-5 border-b border-secondary-200">
            <div className="min-w-0">
              <h3 className="text-[15px] md:text-base font-extrabold text-secondary-900 tracking-tight">
                كل وثائق المجموعة ({sorted.length})
              </h3>
              <p className="text-[11px] font-semibold text-secondary-400 mt-0.5">
                إجمالي مبلغ التأمين: {formatCurrency(totalSumAssured)}
              </p>
            </div>
            <button onClick={onClose} className="icon-button shrink-0" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 md:p-5 space-y-2 max-h-[70vh] overflow-y-auto">
            {sorted.map((policy, index) => (
              <button
                key={policy.id}
                type="button"
                onClick={() => onOpenDetails(policy)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-secondary-200 hover:border-primary-300 hover:bg-primary-50/40 px-3 py-2.5 text-right transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="data-card-avatar shrink-0" aria-hidden="true">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-secondary-900">
                      الوثيقة {index + 1} من {sorted.length}
                    </p>
                    <p className="text-[11px] font-mono text-secondary-500 truncate" dir="ltr">
                      {policy.policy_number}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-left">
                    <p className="text-[12px] font-bold text-secondary-900 font-mono">
                      {formatCurrency(policy.sum_assured || 0)}
                    </p>
                    <p className="text-[10px] text-secondary-400">قسط {formatCurrency(policy.premium_amount)}</p>
                  </div>
                  <span className={clsx('badge gap-1', STATUS_BADGE_CLASS[policy.status] || 'badge-secondary')}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full', STATUS_DOT_CLASS[policy.status] || 'bg-secondary-400')} />
                    {POLICY_STATUS_LABELS[policy.status]}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-secondary-300" />
                </div>
              </button>
            ))}
            {sorted[0] && (
              <p className="text-[11px] text-secondary-400 pt-1">
                تاريخ البداية: {format(new Date(sorted[0].start_date), 'dd/MM/yyyy')}
              </p>
            )}
          </div>

          <div className="modal-actions flex justify-end gap-2.5 p-4 md:p-5 border-t border-secondary-200">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
