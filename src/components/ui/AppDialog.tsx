import type { CSSProperties, ReactNode, MouseEvent, Ref } from 'react';
import clsx from 'clsx';

interface AppDialogProps {
  /** يُستدعى عند الضغط خارج صندوق المحتوى. اتركه بدون تمرير لمنع الإغلاق (مثلاً أثناء التنفيذ). */
  onClose?: () => void;
  /** كلاسات إضافية على صندوق المحتوى (العرض الأقصى، الأنيميشن، أى تنسيق خاص بكل مودال) */
  className?: string;
  /** كلاسات إضافية على الخلفية نفسها (نادرًا ما تُستخدم، مثل print:hidden) */
  overlayClassName?: string;
  /** موضع/مرجع صندوق المحتوى عند الحاجة لقائمة مرتبطة بزر */
  contentRef?: Ref<HTMLDivElement>;
  /** تنسيقات ديناميكية تستخدمها النوافذ المرتبطة بموضع عنصر مرجعي */
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * الغلاف العام لكل المودالات فى المشروع: خلفية معتمة + صندوق محتوى، مع إغلاق
 * عند الضغط خارج الصندوق ومنع انتشار الحدث (stopPropagation) عند الضغط داخله.
 * استُخرج من النمط المتطابق المتكرر فى عشرات المودالات بالمشروع.
 * لا يحمل أى تصميم داخلى أو منطق عمل — فقط الغلاف والسلوك المشترك؛ كل محتوى
 * المودال (الرأس، الفورم، الأزرار) يبقى كما هو تمامًا داخل الصفحة المستدعية.
 */
export function AppDialog({ onClose, className, overlayClassName, contentRef, style, children }: AppDialogProps) {
  return (
    <div className={clsx('modal-overlay', overlayClassName)} onClick={onClose}>
      <div
        ref={contentRef}
        className={clsx('modal-content', className)}
        style={style}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
