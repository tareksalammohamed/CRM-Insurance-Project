import clsx from 'clsx';
import { Users } from 'lucide-react';
import type { ReportType } from '../types';

// مجموعة أزرار تقارير بعنوان واضح فوقها (تقارير عامة / تقارير أداء / نسبة
// الإلغاءات) بدل عرض كل الأزرار مبعثرة فى صف واحد بلا تصنيف.
export function ReportButtonGroup({
  title,
  buttons,
  reportType,
  onSelect,
}: {
  title: string;
  buttons: { id: ReportType; label: string; icon: typeof Users }[];
  reportType: ReportType;
  onSelect: (id: ReportType) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-secondary-400 mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const active = reportType === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => onSelect(btn.id)}
              className={clsx(
                'btn min-h-11 gap-2 px-3.5 text-sm border transition-all duration-200',
                active
                  ? 'bg-primary-700 border-primary-700 text-white shadow-primary-glow-inset'
                  : 'bg-white border-secondary-200 text-secondary-600 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
