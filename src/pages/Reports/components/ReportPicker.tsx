import { useState } from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { AppBottomSheet } from '../../../components/ui/AppBottomSheet';
import type { ReportType } from '../types';

type ReportOption = { id: ReportType; label: string; icon: LucideIcon };
type ReportGroup = { title: string; options: ReportOption[] };

export function ReportPicker({ value, groups, onSelect }: {
  value: ReportType;
  groups: ReportGroup[];
  onSelect: (value: ReportType) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = groups.flatMap(group => group.options).find(option => option.id === value);
  const Icon = selected?.icon;

  return <div className="min-w-0">
    <span id="indicator-report-label" className="mb-2 block text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>المؤشر أو التقرير</span>
    <button
      type="button"
      className="input-field flex w-full items-center gap-3 text-start"
      aria-labelledby="indicator-report-label indicator-report-value"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      {Icon && <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary-600" />}
      <span id="indicator-report-value" className="min-w-0 flex-1 font-semibold">{selected?.label}</span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-secondary-400" />
    </button>
    {open && <AppBottomSheet title="اختيار المؤشر أو التقرير" onClose={() => setOpen(false)}>
      <div className="space-y-2 px-2 pb-2">
        {groups.map(group => <section key={group.title} aria-label={group.title}>
          <h4 className="px-3 pb-1 pt-3 text-xs font-semibold text-secondary-500">{group.title}</h4>
          {group.options.map(option => {
            const OptionIcon = option.icon;
            const active = option.id === value;
            return <button
              key={option.id}
              type="button"
              className="dropdown-item w-full min-h-12 rounded-xl text-start"
              aria-pressed={active}
              style={active ? { background: 'var(--brand-soft)', color: 'var(--brand-ink)' } : undefined}
              onClick={() => { setOpen(false); onSelect(option.id); }}
            >
              <OptionIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 whitespace-normal leading-relaxed">{option.label}</span>
              {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
            </button>;
          })}
        </section>)}
      </div>
    </AppBottomSheet>}
  </div>;
}
