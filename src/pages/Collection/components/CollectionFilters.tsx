import { Filter, RefreshCw } from 'lucide-react';
import { QUICK_FILTERS, type QuickFilter, type SubType, type OwnerFilter } from '../types';
import type { UserRole } from '../../../lib/supabase';
import { AgentCombobox } from '../../Customers/components/AgentCombobox';
import { CollectionStatusTabs } from './CollectionStatusTabs';

interface CollectionFiltersProps {
  quickFilter: QuickFilter;
  onQuickFilterSelect: (id: QuickFilter) => void;

  showFilters: boolean;
  quickFilterDraft: QuickFilter;
  onQuickFilterDraftChange: (id: QuickFilter) => void;
  subTypeDraft: SubType;
  onSubTypeDraftChange: (v: SubType) => void;
  teamMembers: { id: string; name: string; role: UserRole }[];
  ownerFilterDraft: OwnerFilter;
  onOwnerFilterDraftChange: (id: OwnerFilter) => void;
  currentUserId: string | undefined;
  onResetFilters: () => void;
  onApplyFilters: () => void;

  isInitialLoading: boolean;
  totalCount: number;
  loading: boolean;
  /** وصل المستخدم للصفحة من نقرة على بطاقة/رقم بفلتر مُطبَق تلقائيًا */
  cameFromNavigation?: boolean;
}

export function CollectionFilters({
  quickFilter,
  onQuickFilterSelect,
  showFilters,
  quickFilterDraft,
  subTypeDraft,
  onSubTypeDraftChange,
  teamMembers,
  ownerFilterDraft,
  onOwnerFilterDraftChange,
  currentUserId,
  onResetFilters,
  onApplyFilters,
  isInitialLoading,
  totalCount,
  loading,
  cameFromNavigation = false,
}: CollectionFiltersProps) {
  const activeQuickFilterLabel = QUICK_FILTERS.find((f) => f.id === quickFilter)?.label;

  return (
    <>
      {/* تبويبات الحالة — اختيار الفلتر مباشرة بدون فتح اللوحة */}
      <CollectionStatusTabs quickFilter={quickFilter} onSelect={onQuickFilterSelect} />

      {/* وصول من نقرة على رقم/بطاقة: لازم يكون واضح فورًا للمستخدم أن
          القائمة مفلترة بالفعل (مش قائمة كاملة)، وأن فى مخرج واحد للرجوع
          لكل الأقساط — ده بيمنع أشهر التباسات "فين باقى البيانات؟". */}
      {cameFromNavigation && activeQuickFilterLabel && (
        <div className="collection-filter-notice animate-fadeIn">
          <span className="collection-filter-notice-icon" aria-hidden="true">
            <Filter className="w-3.5 h-3.5" />
          </span>
          <p className="min-w-0">
            العرض مفلتر تلقائيًا على{' '}
            <span className="font-extrabold">{activeQuickFilterLabel}</span>
          </p>
          <button type="button" onClick={onResetFilters} className="btn btn-ghost btn-sm shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>عرض الكل</span>
          </button>
        </div>
      )}

      {/* لوحة الفلاتر المتقدمة — تعمل بنظام المسودة (draft) كما هى تمامًا */}
      {showFilters && (
        <div className="col-filters animate-fadeIn">
          <div className="col-filters-grid">
            {(quickFilterDraft === 'month' || quickFilterDraft === 'paid') && (
              <div>
                <label className="input-label">النوع</label>
                <select
                  value={subTypeDraft}
                  onChange={(e) => onSubTypeDraftChange(e.target.value as SubType)}
                  className="input-field"
                >
                  <option value="all">الكل (إنتاج جديد + تحصيل دوري)</option>
                  <option value="new">إنتاج جديد فقط</option>
                  <option value="periodic">تحصيل دوري فقط</option>
                </select>
              </div>
            )}
            {teamMembers.length > 0 && (
              <div>
                <label className="input-label">الفريق</label>
                <AgentCombobox
                  agents={teamMembers}
                  value={ownerFilterDraft}
                  onChange={(id) => onOwnerFilterDraftChange(id as OwnerFilter)}
                  currentUserId={currentUserId}
                  includeAllOption
                  allOptionLabel="الكل"
                  placeholder="اختر من فريقك"
                />
              </div>
            )}
          </div>

          <div className="col-filters-actions">
            <button onClick={onResetFilters} className="btn btn-ghost btn-sm">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة تعيين</span>
            </button>
            <button onClick={onApplyFilters} className="btn btn-primary btn-sm">
              تطبيق
            </button>
          </div>
        </div>
      )}

      {!isInitialLoading && (
        <p className="col-summary">
          <span>
            عدد النتائج: <span className="col-summary-strong">{totalCount}</span>
          </span>
          {loading && (
            <span className="col-summary-live">
              <span className="col-spinner" aria-hidden="true" />
              <span>جارِ التحديث...</span>
            </span>
          )}
        </p>
      )}
    </>
  );
}
