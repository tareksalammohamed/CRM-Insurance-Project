import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { AppDialog } from './AppDialog';

interface AppBottomSheetProps {
  title: ReactNode;
  /** يُترك تنسيقه للصفحة المستدعية (يختلف قليلاً بين استخدام وآخر) */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** عرض القائمة في منتصف الشاشة بدل الشيت السفلي لقوائم الإجراءات السريعة */
  presentation?: 'sheet' | 'centered';
}

/**
 * شيت إجراءات سفلي عام (رأس بعنوان وعنوان فرعي وزر إغلاق + مساحة أمان أسفل
 * الشيت). استُخرج من الأنماط المتطابقة فى مودالات "المزيد" بصفحات التحصيل،
 * العملاء والوثائق. قائمة الأزرار وشروط ظهورها تبقى فى كل صفحة كما كانت
 * تمامًا — هذا المكوّن يحمل الغلاف المرئى فقط دون أى منطق عمل.
 */
export function AppBottomSheet({ title, subtitle, onClose, children, presentation = 'sheet' }: AppBottomSheetProps) {
  const isCentered = presentation === 'centered';

  return (
    <AppDialog
      onClose={onClose}
      overlayClassName={isCentered ? 'modal-overlay-centered' : undefined}
      className={clsx(
        'max-w-sm animate-fadeIn max-h-[88dvh] overflow-y-auto',
        isCentered && 'app-action-menu',
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-secondary-100 bg-white/95 p-4 backdrop-blur-md sm:p-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-secondary-900 truncate">{title}</h3>
          {subtitle}
        </div>
        <button onClick={onClose} aria-label="إغلاق" className="icon-button shrink-0">
          <X className="w-5 h-5 text-secondary-600" />
        </button>
      </div>

      <div className="py-2">{children}</div>

      <div className="safe-area-bottom" />
    </AppDialog>
  );
}
