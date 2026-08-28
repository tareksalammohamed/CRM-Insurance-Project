import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const menuWidth = Math.min(300, Math.max(0, viewportWidth - 24));
  const contentRef = useRef<HTMLDivElement>(null);
  const [anchoredPosition, setAnchoredPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isAnchored || !anchor || !viewportWidth || !viewportHeight) {
      setAnchoredPosition(null);
      return;
    }

    const placeMenu = () => {
      const menuHeight = contentRef.current?.getBoundingClientRect().height || estimatedHeight;
      const belowTop = anchor.bottom + 8;
      const aboveTop = anchor.top - menuHeight - 8;
      const top = belowTop + menuHeight <= window.innerHeight - 12
        ? belowTop
        : Math.max(12, aboveTop);
      const anchorCenter = (anchor.left + anchor.right) / 2;
      const left = Math.min(
        Math.max(12, anchorCenter - menuWidth / 2),
        window.innerWidth - menuWidth - 12,
      );
      setAnchoredPosition({ top, left });
    };

    placeMenu();
    window.addEventListener('resize', placeMenu);
    return () => window.removeEventListener('resize', placeMenu);
  }, [anchor, estimatedHeight, isAnchored, menuWidth, viewportHeight, viewportWidth]);

  const anchoredStyle: CSSProperties | undefined = isAnchored && anchoredPosition
    ? { top: anchoredPosition.top, left: anchoredPosition.left, width: menuWidth }
    : isAnchored
      ? { top: anchor?.bottom ? anchor.bottom + 8 : 12, left: 12, width: menuWidth }
      : undefined;

  const dialog = (
    <AppDialog
      onClose={onClose}
      contentRef={contentRef}
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

  return isAnchored && typeof document !== 'undefined'
    ? createPortal(dialog, document.body)
    : dialog;
}
