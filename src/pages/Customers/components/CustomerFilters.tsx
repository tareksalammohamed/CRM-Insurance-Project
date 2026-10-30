import { FilterPicker } from '../../../components/forms/FilterPicker';
import { RefreshCw } from 'lucide-react';
import { AgentCombobox } from './AgentCombobox';
import type { User } from '../../../lib/supabase';

interface CustomerFiltersProps {
  statusDraft: string;
  onStatusDraftChange: (value: string) => void;
  agentDraft: string;
  onAgentDraftChange: (value: string) => void;
  monthDraft: string;
  onMonthDraftChange: (value: string) => void;
  monthOptions: { value: string; label: string }[];
  isManagerRole: boolean;
  agents: any[];
  user: User | null | undefined;
  onApply: () => void;
  onReset: () => void;
}

export function CustomerFilters({
  statusDraft,
  onStatusDraftChange,
  agentDraft,
  onAgentDraftChange,
  monthDraft,
  onMonthDraftChange,
  monthOptions,
  isManagerRole,
  agents,
  user,
  onApply,
  onReset,
}: CustomerFiltersProps) {
  return (
    <div className="compact-filter-panel pt-3 border-t border-secondary-200 space-y-3 animate-fadeIn">
      <div className="compact-filter-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="customers-status-filter" className="input-label">حالة العميل</label>
          <FilterPicker id="customers-status-filter" label="حالة العميل" value={statusDraft} onChange={onStatusDraftChange} options={[{ value: 'all', label: 'جميع الحالات' }, { value: 'active', label: 'نشط' }, { value: 'inactive', label: 'غير نشط' }, { value: 'expired', label: 'طلبات تالفة (60 يومًا بدون وثائق)' }]} />
        </div>
        {isManagerRole && (
          <div>
            <label className="input-label">الوكيل</label>
            <AgentCombobox
              agents={agents}
              value={agentDraft}
              onChange={onAgentDraftChange}
              currentUserId={user?.id}
              includeAllOption
              allOptionLabel="جميع الوكلاء"
            />
          </div>
        )}
        <div>
          <label htmlFor="customers-month-filter" className="input-label">الشهر</label>
          <FilterPicker id="customers-month-filter" label="الشهر" value={monthDraft} onChange={onMonthDraftChange} options={[{ value: 'all', label: 'كل الشهور' }, ...monthOptions]} />
        </div>
      </div>
      <div className="compact-filter-actions flex items-center justify-end gap-2">
        <button onClick={onReset} className="btn btn-ghost btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>إعادة تعيين</span>
        </button>
        <button onClick={onApply} className="btn btn-primary btn-sm">
          تطبيق
        </button>
      </div>
    </div>
  );
}
