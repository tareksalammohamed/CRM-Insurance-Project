import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { DialogPortal } from '../ui/DialogPortal';
import { useAppStore } from '../../store/appStore';

interface StickyActionBarProps {
  /** عنوان مختصر يظهر داخل الشريط ليعرف المستخدم إنه فى نفس الصفحة */
  label?: ReactNode;
  /** زر (أو أزرار) الإجراء الأساسي للصفحة */
  children: ReactNode;
}

/**
 * شريط إجراء ثابت (Sticky Action Bar) أعلى الصفحة.
 *
 * الهدف: الزر الأساسي للصفحة (إضافة طلب تأمين / إصدار وثيقة) يفضل ظاهر
 * وفى متناول المستخدم وهو بينزل ويتصفح القائمة، بدون ما يرجع لأول الصفحة
 * وبدون زر عائم (FAB) بيغطى محتوى البطاقات.
 *
 * طريقة العمل:
 * - العنصر بيرندر \"مجسّ\" (sentinel) بحجم 1px جوه رأس الصفحة (بدون أى تأثير
 *   على التخطيط لأنه absolute)، وبيراقب موضعه بالنسبة لارتفاع الهيدر العام.
 * - أول ما رأس الصفحة (وبالتالى الزر الأصلي) يخرج تحت الهيدر أثناء التمرير،
 *   بيظهر الشريط الثابت مباشرة أسفل الهيدر بنفس الزر.
 * - الشريط نفسه بيترندر داخل document.body عن طريق DialogPortal، لأن حاوية
 *   الصفحة عندها transform (أنيميشن دخول الصفحة) واللى بيخلى position: fixed
 *   يتموضع بالنسبة للحاوية مش للشاشة (نفس سبب وجود DialogPortal).
 * - يتوازى أفقياً مع الهيدر: بيترك مساحة القائمة الجانبية على الشاشات الكبيرة.
 */
export function StickyActionBar({ label, children }: StickyActionBarProps) {
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const { sidebarCollapsed } = useAppStore();

  useEffect(() => {
    let frame = 0;

    const getHeaderHeight = () => {
      const headerEl = document.querySelector('header.app-header');
      if (headerEl) return headerEl.getBoundingClientRect().height;
      return window.innerWidth >= 768 ? 64 : 56;
    };

    const evaluate = () => {
      frame = 0;
      const el = sentinelRef.current;
      if (!el) return;
      // المجسّ فى آخر رأس الصفحة: لو بقى فوق حدّ الهيدر يبقى الزر الأصلي
      // مش ظاهر → نظهر الشريط الثابت
      const top = el.getBoundingClientRect().top;
      setVisible(top <= getHeaderHeight());
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <>
      {/* مجسّ بدون أى أثر بصري أو تخطيطي (رأس الصفحة عنده position: relative) */}
      <span ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-px w-px" />

      <DialogPortal>
        <div
          className={clsx(
            'sticky-action-bar print:hidden',
            visible && 'is-visible',
            sidebarCollapsed ? 'md:mr-[var(--sidebar-w-collapsed)]' : 'md:mr-[var(--sidebar-w)]'
          )}
        >
          <div className="sticky-action-bar-inner">
            {label && <span className="sticky-action-bar-label truncate">{label}</span>}
            <div className="sticky-action-bar-actions">{children}</div>
          </div>
        </div>
      </DialogPortal>
    </>
  );
}
