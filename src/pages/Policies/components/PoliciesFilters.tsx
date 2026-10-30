import { FilterPicker } from '../../../components/forms/FilterPicker';
import { RefreshCw } from 'lucide-react';
import { POLICY_TYPE_LABELS } from '../../../lib/supabase';

interface PoliciesFiltersProps {
  statusDraft: string;
  onStatusDraftChange: (value: string) => void;
  typeDraft: string;
  onTypeDraftChange: (value: string) => void;
  monthDraft: string;
  onMonthDraftChange: (value: string) => void;
  monthOptions: { value: string; label: string }[];
  onApply: () => void;
  onReset: () => void;
}

export function PoliciesFilters({
  statusDraft,
  onStatusDraftChange,
  typeDraft,
  onTypeDraftChange,
  monthDraft,
  onMonthDraftChange,
  monthOptions,
  onApply,
  onReset,
}: PoliciesFiltersProps) {
  return (
    <div className="compact-filter-panel pt-3 border-t border-secondary-200 space-y-3 animate-fadeIn">
      <div className="compact-filter-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="input-label">حالة الوثيقة</label>
          <FilterPicker label="حالة الوثيقة" value={statusDraft} onChange={onStatusDraftChange} options={[{ value: 'all', label: 'جميع الحالات' }, { value: 'active', label: 'نشط' }, { value: 'cancelled', label: 'ملغى' }]} />
        </div>
        <div>
          <label className="input-label">نوع الوثيقة</label>
          <FilterPicker label="نوع الوثيقة" value={typeDraft} onChange={onTypeDraftChange} options={[{ value: 'all', label: 'جميع الأنواع' }, ...Object.entries(POLICY_TYPE_LABELS).map(([value, label]) => ({ value, label }))]} />
        </div>
        <div>
          <label className="input-label">الشهر</label>
          <FilterPicker label="الشهر" value={monthDraft} onChange={onMonthDraftChange} options={[{ value: 'all', label: 'كل الشهور' }, ...monthOptions]} />
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
