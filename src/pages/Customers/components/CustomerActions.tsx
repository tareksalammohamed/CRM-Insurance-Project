import { Eye, MoreVertical, Phone } from 'lucide-react';
import { type ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';
import type { CustomerWithRelations } from '../types';

interface CustomerActionsProps {
  customer: CustomerWithRelations;
  onViewDetails: (customer: CustomerWithRelations) => void;
  onOpenMoreMenu: (customer: CustomerWithRelations, anchor: ActionMenuAnchor) => void;
}

export function CustomerActions({ customer, onViewDetails, onOpenMoreMenu }: CustomerActionsProps) {
  return (
    <div className="data-card-actions">
      <button
        onClick={(e) => { e.stopPropagation(); onViewDetails(customer); }}
        className="btn btn-secondary btn-sm flex-1"
      >
        <Eye className="w-4 h-4" />
        <span>التفاصيل</span>
      </button>

      {/* اتصال مباشر — الإجراء الأكثر تكرارًا للوكيل من القائمة نفسها،
          فى متناول الإبهام على الموبايل بدون فتح تفاصيل العميل.
          مجرد رابط tel: على نفس رقم الهاتف المعروض، بدون منطق جديد. */}
      {customer.phone && (
        <a
          href={`tel:${customer.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="quick-action"
          aria-label={`الاتصال بـ ${customer.name}`}
          title="اتصال"
        >
          <Phone className="w-4 h-4" />
        </a>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          onOpenMoreMenu(customer, { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
        }}
        className="quick-action"
        aria-label={`إجراءات أخرى لـ ${customer.name}`}
        title="المزيد"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}
