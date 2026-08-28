import { useEffect, useRef } from 'react';

/**
 * السلوك المشترك لأى نافذة حوارية (Modal / Bottom Sheet) فى التطبيق:
 *
 *  1) الإغلاق بمفتاح Escape — نفس دالة onClose الموجودة. لو الدالة مش ممررة
 *     (مثلاً أثناء تنفيذ عملية لا يجوز إلغاؤها) فالمفتاح لا يفعل شيئًا، وده مقصود.
 *  2) قفل تمرير الصفحة الخلفية أثناء الفتح — يمنع "تمرير الخلفية" المزعج
 *     على الموبايل خلف الـsheet. نحتفظ بالقيمة الأصلية ونرجّعها كما هى حتى
 *     لا نتعارض مع مودال آخر مفتوح فى نفس اللحظة (النوافذ المتداخلة موجودة
 *     فعلاً: تفاصيل عميل ← وثيقة ← سداد).
 *  3) إعادة التركيز للعنصر الذى فتح النافذة بعد إغلاقها — مهم لمستخدمى
 *     لوحة المفاتيح حتى لا يعود التركيز لأول الصفحة.
 *
 * استُخرج من AppDialog حتى تستفيد منه أيضًا النوافذ التى تبنى الـoverlay
 * بنفسها ولا تمر على AppDialog (عشرون نافذة فى المشروع)، بدون إعادة هيكلة
 * الماركب الداخلى لكل واحدة ولا أى تغيير فى منطق العمل.
 *
 * @param onClose دالة الإغلاق الحالية للنافذة (اتركها undefined لتعطيل Escape)
 * @param enabled مرّر false لتعطيل السلوك بالكامل. يُستخدم فى المكوّنات التى
 *   تُرجّع null وهى مغلقة (مثل لوحة المساعدة): قواعد React تُلزمنا بنداء الـhook
 *   قبل أى early return، فالتعطيل هنا يمنع قفل تمرير الصفحة وهى مقفولة أصلاً.
 */
export function useDialogBehavior(onClose?: () => void, enabled: boolean = true): void {
  // العنصر الذى كان يحمل التركيز قبل الفتح — نرجّع له التركيز عند الإغلاق
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      const target = previouslyFocused.current;
      // نتأكد أن العنصر لا يزال موجودًا فى الصفحة قبل إعادة التركيز له
      if (target && typeof target.focus === 'function' && document.contains(target)) {
        target.focus({ preventScroll: true });
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [enabled]);
}
