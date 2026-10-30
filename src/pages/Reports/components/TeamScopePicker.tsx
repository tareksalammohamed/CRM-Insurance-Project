import { useId, useState } from 'react';
import { Check, ChevronDown, Search, UserRound, Users, X } from 'lucide-react';
import { AppBottomSheet } from '../../../components/ui/AppBottomSheet';

interface ScopeMember { id: string; name: string; roleLabel: string }

/** Presentation only: an empty ID retains the existing full-subtree scope. */
export function TeamScopePicker({ value, members, onSelect }: {
  value: string;
  members: ScopeMember[];
  onSelect: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = members.find(member => member.id === value);
  const query = search.trim().toLocaleLowerCase('ar');
  const visibleMembers = members.filter(member => `${member.name} ${member.roleLabel}`.toLocaleLowerCase('ar').includes(query));
  const choose = (memberId: string) => { setOpen(false); onSelect(memberId); };

  return <div className="min-w-0">
    <span id={`${id}-label`} className="mb-2 block text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>نطاق الفريق</span>
    <button type="button" className="input-field flex w-full items-center gap-3 text-start"
      aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setSearch(''); setOpen(true); }}>
      <Users aria-hidden="true" className="h-5 w-5 shrink-0 text-primary-600" />
      <span id={`${id}-value`} className="min-w-0 flex-1 truncate font-semibold">{selected?.name ?? (value ? 'النطاق المحدد' : 'نطاقي بالكامل')}</span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-secondary-400" />
    </button>
    {open && <AppBottomSheet title="اختيار نطاق الفريق" onClose={() => setOpen(false)}>
      <div className="space-y-3 px-3 pb-2">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-secondary-400" />
          <input type="search" aria-label="بحث بالاسم أو الوظيفة" placeholder="ابحث بالاسم أو الوظيفة…"
            className="input-field w-full pl-10 pr-10" value={search} onChange={event => setSearch(event.target.value)} />
          {search && <button type="button" aria-label="مسح البحث" className="absolute left-1 top-1 icon-button" onClick={() => setSearch('')}>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>}
        </div>
        <button type="button" className="dropdown-item min-h-14 w-full rounded-xl text-start" aria-pressed={!value}
          style={!value ? { background: 'var(--brand-soft)', color: 'var(--brand-ink)' } : undefined} onClick={() => choose('')}>
          <Users aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1"><span className="block font-semibold">نطاقي بالكامل</span><span className="block text-xs opacity-70">كل الفريق ضمن صلاحياتي</span></span>
          {!value && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
        </button>
        <p className="px-2 text-xs font-semibold text-secondary-500" role="status">أعضاء الفريق · {visibleMembers.length.toLocaleString('ar-EG')}</p>
        <div className="max-h-[45dvh] space-y-1 overflow-y-auto overscroll-contain">
          {visibleMembers.map(member => <button key={member.id} type="button" className="dropdown-item min-h-14 w-full rounded-xl text-start"
            aria-pressed={member.id === value}
            style={member.id === value ? { background: 'var(--brand-soft)', color: 'var(--brand-ink)' } : undefined}
            onClick={() => choose(member.id)}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}>
              <UserRound aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 whitespace-normal break-words"><span className="block font-semibold">{member.name}</span><span className="block text-xs opacity-70">{member.roleLabel}</span></span>
            {member.id === value && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
          </button>)}
          {!visibleMembers.length && <p className="px-3 py-6 text-center text-sm text-secondary-500">{query ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد أعضاء متاحون في هذا النطاق'}</p>}
        </div>
      </div>
    </AppBottomSheet>}
  </div>;
}
