import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, User, Receipt, History as HistoryIcon, CheckCircle, XCircle } from 'lucide-react';
import { AppBottomSheet, type ActionMenuAnchor } from '../../../../components/ui/AppBottomSheet';
import { AppDialog } from '../../../../components/ui/AppDialog';
import { FollowupPanel } from '../../../../features/customerFollowup/FollowupPanel';
import type { InstallmentWithRelations } from '../../types';

interface CollectionGroupMoreMenuDialogProps {
  members: InstallmentWithRelations[];
  anchor: ActionMenuAnchor;
  onClose: () => void;
  onPayGroup: (members: InstallmentWithRelations[]) => void;
  onCancelGroup: (members: InstallmentWithRelations[]) => void;
  onOpenPolicyHistory: (installment: InstallmentWithRelations) => void;
}

// قائمة إجراءات المجموعة: الإجراءات المالية تعمل على كل الأعضاء المناسبين،
// أما تفاصيل الوثيقة وسجلها فيظلان متاحين لكل وثيقة على حدة.
export function CollectionGroupMoreMenuDialog({ members, anchor, onClose, onPayGroup, onCancelGroup, onOpenPolicyHistory }: CollectionGroupMoreMenuDialogProps) {
  const [showFollowup, setShowFollowup] = useState(false);
  const first = members[0];
  const unpaid = members.filter(member => member.status !== 'paid');
  const paid = members.filter(member => member.status === 'paid');

  return <>
    <AppBottomSheet
      title={first.policy.customer?.name || 'العميل'}
      subtitle={<p className="text-xs text-secondary-500 mt-0.5">{members.length} وثائق ضمن المجموعة</p>}
      onClose={onClose}
      anchor={anchor}
      estimatedHeight={560}
    >
      <Link to={`/customers?open=${encodeURIComponent(first.policy.customer_id)}`} onClick={onClose} className="dropdown-item w-full">
        <User className="w-4 h-4" /><span>فتح ملف العميل</span>
      </Link>

      <div className="px-4 pt-2 pb-1 text-xs font-bold text-secondary-500">الوثائق داخل المجموعة</div>
      {members.map(member => <div key={member.id} className="px-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-secondary-100 py-2">
          <Link to={`/policies/${member.policy_id}`} onClick={onClose} className="dropdown-item flex-1 min-w-0">
            <Receipt className="w-4 h-4 shrink-0" />
            <span className="truncate">تفاصيل الوثيقة {member.policy.policy_number}</span>
          </Link>
          <button type="button" onClick={() => { onOpenPolicyHistory(member); onClose(); }} className="btn btn-secondary btn-sm shrink-0">
            <HistoryIcon className="w-4 h-4" /><span>سجل الأقساط</span>
          </button>
        </div>
      </div>)}

      {unpaid.length > 0 && <button type="button" onClick={() => { onPayGroup(unpaid); onClose(); }} className="dropdown-item w-full text-primary-700">
        <CheckCircle className="w-4 h-4" /><span>تسجيل سداد كل الوثائق غير المسددة ({unpaid.length})</span>
      </button>}
      {paid.length > 0 && <button type="button" onClick={() => { onCancelGroup(paid); onClose(); }} className="dropdown-item w-full text-error-600">
        <XCircle className="w-4 h-4" /><span>إلغاء سداد كل الوثائق المسددة ({paid.length})</span>
      </button>}
      <button type="button" onClick={() => { setShowFollowup(true); onClose(); }} className="dropdown-item w-full">
        <CalendarClock className="w-4 h-4" /><span>إضافة متابعة / وعد سداد للعميل</span>
      </button>
    </AppBottomSheet>

    {showFollowup && <AppDialog onClose={() => setShowFollowup(false)} ariaLabel="متابعة المجموعة" className="max-w-xl modal-form-shell">
      <div className="modal-form-header p-4 flex items-center justify-between">
        <h3 className="font-bold text-secondary-900">متابعة العميل — {first.policy.customer?.name || ''}</h3>
        <button type="button" className="icon-button" aria-label="إغلاق" onClick={() => setShowFollowup(false)}>×</button>
      </div>
      <div className="modal-form-scroll p-4"><FollowupPanel customerId={first.policy.customer_id} initiallyOpen /></div>
    </AppDialog>}
  </>;
}
