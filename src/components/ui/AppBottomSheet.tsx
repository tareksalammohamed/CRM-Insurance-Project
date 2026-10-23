import { useLayoutEffect, useRef, useState } from 'react';
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
  const contentRef = useRef<HTMLDivElement>(null);
  const [anchoredStyle, setAnchoredStyle] = useState<CSSProperties | undefined>();

  useLayoutEffect(() => {
    if (!anchor) {
      setAnchoredStyle(undefined);
      return;
    }

    const placeMenu = () => {
      const width = Math.min(300, Math.max(0, window.innerWidth - 24));
      const maxHeight = Math.max(0, window.innerHeight - 24);
      const height = Math.min(contentRef.current?.getBoundingClientRect().height || estimatedHeight, maxHeight);
      const belowTop = anchor.bottom + 8;
      const preferredTop = belowTop + height <= window.innerHeight - 12 ? belowTop : anchor.top - height - 8;
      const top = Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12));
      const left = Math.max(12, Math.min((anchor.left + anchor.right - width) / 2, window.innerWidth - width - 12));
      setAnchoredStyle(previous => previous?.top === top && previous.left === left && previous.width === width && previous.maxHeight === maxHeight
        ? previous : { top, left, width, maxHeight });
    };

    placeMenu();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placeMenu);
    if (contentRef.current) observer?.observe(contentRef.current);
    window.addEventListener('resize', placeMenu);
    return () => { observer?.disconnect(); window.removeEventListener('resize', placeMenu); };
  }, [anchor, estimatedHeight]);

  const dialog = (
    <AppDialog
      onClose={onClose}
      ariaLabel={typeof title === 'string' ? title : 'قائمة الإجراءات'}
      contentRef={contentRef}
      overlayClassName={isAnchored ? 'modal-overlay-anchored' : isCentered ? 'modal-overlay-centered' : undefined}
      style={isAnchored ? anchoredStyle : undefined}
      className={clsx(
        'max-w-sm animate-fadeIn max-h-[88dvh] overflow-y-auto',
        isCentered && 'app-action-menu',
        isAnchored && 'app-action-menu-anchored',
      )}
    >
      <div className="action-sheet-header sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-secondary-100 bg-white/95 p-4 backdrop-blur-md sm:p-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-secondary-900 break-words">{title}</h3>
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

  return dialog;
}
