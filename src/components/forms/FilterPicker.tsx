import { useId, useState } from 'react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { AppBottomSheet } from '../ui/AppBottomSheet';
import { SearchInput } from './SearchInput';

export interface FilterOption { value: string; label: string; group?: string }

/** Controlled display filter. Values, draft/apply behavior and requests belong to the caller. */
export function FilterPicker({ id, label, value, options, onChange, disabled = false }: {
  id?: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find(option => option.value === value);
  const query = search.trim().toLocaleLowerCase('ar');
  const visible = options.filter(option => `${option.label} ${option.group ?? ''}`.toLocaleLowerCase('ar').includes(query));

  return <div className="filter-picker min-w-0 w-full">
    <button id={id ?? generatedId} type="button" className="input-field filter-picker-trigger flex w-full items-center gap-2 text-start"
      disabled={disabled} aria-label={`${label}: ${selected?.label ?? 'اختر'}`} aria-haspopup="dialog" aria-expanded={open}
      title={selected?.label} onClick={() => { setSearch(''); setOpen(true); }}>
      <span className="min-w-0 flex-1 whitespace-normal break-words leading-relaxed">{selected?.label ?? 'اختر'}</span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-secondary-400" />
    </button>
    {open && <AppBottomSheet title={`اختيار ${label}`} onClose={() => setOpen(false)}>
      <div className="filter-picker-body space-y-2 px-3 pb-2">
        {options.length > 7 && <SearchInput value={search} onChange={setSearch} placeholder={`بحث في ${label}…`} />}
        <div className="filter-picker-options max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain">
          {visible.map((option, index) => <div key={option.value}>
            {option.group && option.group !== visible[index - 1]?.group && <h4 className="px-3 pb-1 pt-3 text-xs font-semibold text-secondary-500">{option.group}</h4>}
            <button type="button" className="dropdown-item min-h-12 w-full rounded-xl text-start" aria-pressed={option.value === value}
              style={option.value === value ? { background: 'var(--brand-soft)', color: 'var(--brand-ink)' } : undefined}
              onClick={() => { setOpen(false); if (option.value !== value) onChange(option.value); }}>
              <ListFilter aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60" />
              <span className="min-w-0 flex-1 whitespace-normal break-words leading-relaxed">{option.label}</span>
              {option.value === value && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
            </button>
          </div>)}
          {!visible.length && <p className="px-3 py-6 text-center text-sm text-secondary-500">{query ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد اختيارات متاحة'}</p>}
        </div>
      </div>
    </AppBottomSheet>}
  </div>;
}
