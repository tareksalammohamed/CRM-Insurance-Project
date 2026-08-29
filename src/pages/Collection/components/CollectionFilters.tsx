import { BadgeCheck, CalendarClock, Filter, RefreshCw, TimerReset } from 'lucide-react';
import clsx from 'clsx';
import { QUICK_FILTERS, type QuickFilter, type SubType, type OwnerFilter } from '../types';
import type { UserRole } from '../../../lib/supabase';
import { AgentCombobox } from '../../Customers/components/AgentCombobox';

// أيقونة كل فلتر تطابق معناه وتطابق نفس الأيقونة المستخدمة فى بطاقات
// الـKPI ولوحة التحكم — فالمستخدم يربط بصريًا بين الرقم اللى ضغط عليه
// والشريحة النشطة اللى وصل لها.
const QUICK_FILTER_ICONS = {
  month: CalendarClock,
  overdue: TimerReset,
  paid: BadgeCheck,
} as const;

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
      {/* شرائح سريعة لاختيار الفلتر مباشرة بدون فتح اللوحة */}
      <div
        className="collection-filter-strip flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1"
        role="group"
        aria-label="فلترة سريعة لحالة الأقساط"
      >
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onQuickFilterSelect(f.id)}
            aria-pressed={quickFilter === f.id}
            className={clsx(
              'collection-filter-chip shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition-all',
              quickFilter === f.id
                ? 'collection-filter-chip-active bg-primary-600 border-primary-600 text-white'
                : 'bg-white border-secondary-200 text-secondary-600 hover:border-primary-300'
            )}
          >
            {(() => { const Icon = QUICK_FILTER_ICONS[f.id]; return <Icon className="w-3.5 h-3.5 shrink-0" />; })()}
            {f.label}
          </button>
        ))}
      </div>

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

      {showFilters && (
        <div className="pt-3 border-t border-secondary-200 space-y-3 animate-fadeIn">
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
          <div className="flex items-center justify-end gap-2">
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
        <p className="collection-result-summary text-xs text-secondary-500 flex items-center gap-2">
          <span>عدد النتائج: <span className="font-semibold text-secondary-700">{totalCount}</span></span>
          {loading && (
            <span className="inline-flex items-center gap-1 text-secondary-400">
              <span className="w-3 h-3 rounded-full border-2 border-secondary-300 border-t-primary-500 animate-spin" />
              <span>جارِ التحديث...</span>
            </span>
          )}
        </p>
      )}
    </>
  );
}
