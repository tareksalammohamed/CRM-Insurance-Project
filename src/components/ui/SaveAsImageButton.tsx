import { useCallback, useState, type RefObject } from 'react';
import { ImageDown, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { saveElementAsImages, type ImageOrientation } from '../../lib/saveAsImage';
import { useNotify } from '../../lib/notify';

interface SaveAsImageButtonProps {
  /**
   * العنصر المطبوع اللى هيتصوّر — عادةً الـref بتاع تقرير الطباعة نفسه
   * (العنصر اللى عليه class="print-report").
   */
  targetRef: RefObject<HTMLElement | null>;
  /** اسم الملف بدون امتداد (لو أكتر من صفحة بيتحوّل لـ«الاسم-1.png» وهكذا) */
  fileName: string;
  /** اتجاه الورقة — landscape للتقارير العريضة */
  orientation?: ImageOrientation;
  /** محدّدات CSS إضافية لعناصر تُستبعد من الصورة */
  excludeSelectors?: string[];
  /** كلاسات الزر — بنسيبها قابلة للتخصيص عشان الزر يطابق زر الطباعة اللى جنبه */
  className?: string;
  /** تعطيل خارجى (مثلاً لسه البيانات بتتحمّل أو مفيش محتوى) */
  disabled?: boolean;
  label?: string;
  /**
   * تجهيز اختيارى قبل التصوير — بيستخدمه المستخدمين اللى محتاجين يجهّزوا
   * بيانات التقرير المطبوع أول (زى تحصيل السنوات اللاحقة اللى بيجيب صفوف
   * التقرير من السيرفر وقت الطباعة بس). لو رجّعت false بنلغى العملية.
   */
  onBeforeCapture?: () => void | boolean | Promise<void | boolean>;
}

/**
 * زر "حفظ كصورة" — يوضع جنب أى زر طباعة فى التطبيق.
 *
 * بيصوّر نفس تقرير الطباعة بالظبط (نفس الترتيب والجداول والأماكن) وبينزّله
 * PNG، وبيقسّمه لأكتر من صورة لو المحتوى أطول من صفحة. الرسومات البيانية
 * (recharts / canvas) مستبعدة دائمًا — طلب صريح من المستخدم.
 *
 * التفاصيل التقنية كلها (نسخة مؤقتة، محاكاة @media print، تقسيم الصفحات عند
 * نقاط آمنة، معالجة الخطوط والصور) متمركزة فى src/lib/saveAsImage.ts.
 */
export function SaveAsImageButton({
  targetRef,
  fileName,
  orientation,
  excludeSelectors,
  className,
  disabled,
  label = 'حفظ كصورة',
  onBeforeCapture,
}: SaveAsImageButtonProps) {
  const notify = useNotify();
  const [saving, setSaving] = useState(false);

  const handleClick = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (onBeforeCapture) {
        const proceed = await onBeforeCapture();
        if (proceed === false) return;
      }
      const result = await saveElementAsImages(targetRef.current, {
        fileName,
        orientation,
        excludeSelectors,
      });
      notify.success(
        result.pages > 1
          ? `تم حفظ التقرير فى ${result.pages} صور PNG`
          : 'تم حفظ التقرير كصورة PNG'
      );
    } catch (error) {
      console.error('save as image failed:', error);
      notify.error('تعذّر حفظ التقرير كصورة. حاول مرة أخرى');
    } finally {
      setSaving(false);
    }
  }, [saving, onBeforeCapture, targetRef, fileName, orientation, excludeSelectors, notify]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || saving}
      title="حفظ التقرير كصورة PNG بنفس شكل الطباعة (بدون رسومات بيانية)"
      className={clsx(className ?? 'btn btn-primary', 'print:hidden disabled:opacity-70')}
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
      <span>{saving ? 'جارٍ حفظ الصورة...' : label}</span>
    </button>
  );
}
