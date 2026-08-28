import { Eye, MoreVertical } from 'lucide-react';
import { type ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';
import type { Policy } from '../../../lib/supabase';

interface PolicyActionsProps {
  policy: Policy;
  onViewDetails: (policy: Policy) => void;
  onOpenMoreMenu: (policy: Policy, anchor: ActionMenuAnchor) => void;
}

export function PolicyActions({ policy, onViewDetails, onOpenMoreMenu }: PolicyActionsProps) {
  return (
    <div className="data-card-actions">
      <button
        onClick={(e) => { e.stopPropagation(); onViewDetails(policy); }}
        className="btn btn-secondary btn-sm flex-1"
      >
        <Eye className="w-4 h-4" />
        <span>التفاصيل</span>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          onOpenMoreMenu(policy, { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
        }}
        className="quick-action"
        aria-label={`إجراءات أخرى للوثيقة ${policy.policy_number}`}
        title="المزيد"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}
