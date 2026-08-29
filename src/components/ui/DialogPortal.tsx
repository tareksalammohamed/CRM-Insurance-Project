import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * بوابة (Portal) موحّدة لكل النوافذ المنبثقة فى التطبيق.
 *
 * لماذا؟ خلفية المودال (.modal-overlay) بتستخدم position: fixed مع inset: 0،
 * والمفروض إنها تتموضع بالنسبة للشاشة (viewport). لكن أى عنصر أب بيحمل
 * transform (زى أنيميشن دخول الصفحة .animate-pageEnter / .animate-fadeIn
 * بـ fill-mode: both) بيعمل "containing block" جديد للعناصر الـfixed اللى
 * جواه — فالخلفية بتتموضع بالنسبة للعنصر الأب المتحرك مش بالنسبة للشاشة.
 *
 * النتيجة العملية اللى تم قياسها فعليًا قبل الإصلاح: الضغط على زر التفاصيل
 * كان يرندر النافذة عند top ≈ 1675px بارتفاع 24px فقط (ارتفاع الحاوية
 * المتحركة) وخارج مجال الرؤية تمامًا على كل المقاسات — فالمستخدم يشوف إن
 * "الزر مش شغال" رغم إن الـhandler وحالة الـstate بيعملوا صح.
 *
 * الحل الصحيح هو رندر النافذة مباشرة داخل document.body (نفس النمط المستخدم
 * أصلاً فى AppBottomSheet)، فتخرج من أى ancestor متحرك أو بـoverflow: hidden
 * وتتموضع بالنسبة للشاشة دائمًا. لا يتغير أى منطق عمل أو محتوى أو تنسيق —
 * مكان الرندر فى شجرة الـDOM فقط.
 */
export function DialogPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
