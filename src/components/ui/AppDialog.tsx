import type { CSSProperties, ReactNode, MouseEvent, Ref } from 'react';
import clsx from 'clsx';
import { useDialogBehavior } from '../../hooks/useDialogBehavior';
import { DialogPortal } from './DialogPortal';

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
 *
 * سلوك الوصولية/الاستخدام المضاف هنا مرة واحدة، فيستفيد منه كل مودالات
 * التطبيق تلقائيًا بدون تعديل أى صفحة:
 *  1) الإغلاق بمفتاح Escape (نفس دالة onClose الحالية — لو مش ممررة، الضغط
 *     على Escape لا يفعل شيئًا، وده مقصود أثناء تنفيذ عملية).
 *  2) قفل تمرير الصفحة الخلفية أثناء فتح المودال (يمنع "تمرير الخلفية"
 *     المزعج على الموبايل خلف الـ bottom sheet).
 *  3) إعادة التركيز للعنصر الذى فتح المودال بعد إغلاقه (مهم لمستخدمى
 *     لوحة المفاتيح حتى لا يعود التركيز لأول الصفحة).
 *  4) سمات role="dialog" و aria-modal للقارئات الصوتية.
 *  5) الرندر داخل document.body عبر DialogPortal — يمنع انحباس الخلفية
 *     (position: fixed) داخل أى عنصر أب بيحمل transform مثل أنيميشن دخول
 *     الصفحة، وهو السبب الفعلى المقيس لظهور النوافذ خارج مجال الرؤية.
 */
export function AppDialog({ onClose, className, overlayClassName, contentRef, style, children }: AppDialogProps) {
  // السلوك المشترك (Escape + قفل التمرير + إرجاع التركيز) فى hook واحد
  // تستخدمه أيضًا النوافذ التى تبنى الـoverlay بنفسها
  useDialogBehavior(onClose);

  return (
    <DialogPortal>
      <div className={clsx('modal-overlay', overlayClassName)} onClick={onClose}>
        <div
          ref={contentRef}
          className={clsx('modal-content', className)}
          style={style}
          role="dialog"
          aria-modal="true"
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </DialogPortal>
  );
}
