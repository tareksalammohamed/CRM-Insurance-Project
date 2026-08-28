import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * مكوّن عام لعرض حالة "لا توجد بيانات" داخل بطاقة.
 * استُخرج من الأنماط المتطابقة في صفحات العملاء والوثائق والتحصيل.
 * لا يحمل أي منطق عمل — فقط العرض المرئي.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card">
      <div className="empty-state">
        <span className="empty-state-icon">
          <Icon className="w-6 h-6" />
        </span>
        <p className="empty-state-title">{title}</p>
        {description && <p className="empty-state-desc">{description}</p>}
        {action}
      </div>
    </div>
  );
}
