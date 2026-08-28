import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { AppDialog } from './AppDialog';

export interface ActionMenuAnchor {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

interface AppBottomSheetProps {
  title: ReactNode;
  /** يُترك تنسيقه للصفحة المستدعية (يختلف قليلاً بين استخدام وآخر) */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** عرض القائمة في منتصف الشاشة بدل الشيت السفلي لقوائم الإجراءات السريعة */
  presentation?: 'sheet' | 'centered';
  /** مستطيل زر الفتح لتثبيت قائمة الإجراءات بجواره داخل الشاشة */
  anchor?: ActionMenuAnchor;
  /** الارتفاع التقريبي للقائمة عند تحديد اتجاه فتحها */
  estimatedHeight?: number;
}

/**
 * شيت إجراءات سفلي عام (رأس بعنوان وعنوان فرعي وزر إغلاق + مساحة أمان أسفل
 * الشيت). استُخرج من الأنماط المتطابقة فى مودالات "المزيد" بصفحات التحصيل،
 * العملاء والوثائق. قائمة الأزرار وشروط ظهورها تبقى فى كل صفحة كما كانت
 * تمامًا — هذا المكوّن يحمل الغلاف المرئى فقط دون أى منطق عمل.
 */
export function AppBottomSheet({
  title,
  subtitle,
  onClose,
  children,
  presentation = 'sheet',
  anchor,
  estimatedHeight = 420,
}: AppBottomSheetProps) {
  const isAnchored = !!anchor;
  const isCentered = presentation === 'centered' && !isAnchored;
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const menuWidth = Math.min(360, Math.max(0, viewportWidth - 24));
  const belowTop = anchor ? anchor.bottom + 8 : 0;
  const aboveTop = anchor ? anchor.top - estimatedHeight - 8 : 0;
  const top = anchor && viewportHeight
    ? (belowTop + estimatedHeight <= viewportHeight - 12 ? belowTop : Math.max(12, aboveTop))
    : undefined;
  const left = anchor && viewportWidth
    ? Math.min(Math.max(12, anchor.right - menuWidth), viewportWidth - menuWidth - 12)
    : undefined;
  const anchoredStyle: CSSProperties | undefined = isAnchored && top !== undefined && left !== undefined
    ? { top, left, width: menuWidth }
    : undefined;

  return (
    <AppDialog
      onClose={onClose}
      overlayClassName={isAnchored ? 'modal-overlay-anchored' : isCentered ? 'modal-overlay-centered' : undefined}
      style={anchoredStyle}
      className={clsx(
        'max-w-sm animate-fadeIn max-h-[88dvh] overflow-y-auto',
        isCentered && 'app-action-menu',
        isAnchored && 'app-action-menu-anchored',
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
