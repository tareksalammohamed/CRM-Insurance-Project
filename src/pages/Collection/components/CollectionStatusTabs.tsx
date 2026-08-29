import { BadgeCheck, CalendarClock, TimerReset } from 'lucide-react';
import { QUICK_FILTERS, type QuickFilter } from '../types';

// أيقونة كل حالة تطابق معناها وتطابق نفس الأيقونة المستخدمة فى بلاطات
// الـKPI ولوحة التحكم — فالمستخدم يربط بصريًا بين الرقم اللى ضغط عليه
// والحالة النشطة اللى وصل لها.
const ICONS: Record<QuickFilter, typeof CalendarClock> = {
  month: CalendarClock,
  overdue: TimerReset,
  paid: BadgeCheck,
};

// نبرة دلالية لكل حالة — تلوّن التبويب النشط بمعنى الحالة نفسها
const TONES: Record<QuickFilter, string> = {
  month: 'col-tone-due',
  overdue: 'col-tone-overdue',
  paid: 'col-tone-paid',
};

interface CollectionStatusTabsProps {
  quickFilter: QuickFilter;
  onSelect: (id: QuickFilter) => void;
}

/**
 * تبويبات حالة الأقساط (المستحق / متأخر / تم السداد).
 * ----------------------------------------------------------------------------
 * عرض فقط: نفس قائمة QUICK_FILTERS ونفس دالة الاختيار الموجودة أصلاً — لا
 * فلتر جديد ولا تغيير فى منطق الفلترة.
 *
 * الحالة النشطة تُميَّز بأربع إشارات معًا (سطح أبيض + حد بلون الحالة + خط
 * سفلي مصمت + aria-pressed) فلا تعتمد على اللون وحده.
 */
export function CollectionStatusTabs({ quickFilter, onSelect }: CollectionStatusTabsProps) {
  return (
    <div className="col-statustabs" role="group" aria-label="فلترة سريعة لحالة الأقساط">
      {QUICK_FILTERS.map((f) => {
        const Icon = ICONS[f.id];
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            aria-pressed={quickFilter === f.id}
            className={`col-statustab ${TONES[f.id]}`}
          >
            <Icon aria-hidden="true" />
            <span>{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
