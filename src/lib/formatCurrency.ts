/**
 * تنسيق العملة الموحّد للتطبيق (جنيه مصري، أرقام عربية-مصرية).
 *
 * لماذا صيغتان وليست واحدة؟
 * الصفحات كانت بتستخدم إعدادين مختلفين فعليًا قبل التوحيد:
 *   - لوحة التحكم: minimumFractionDigits: 0 + maximumFractionDigits: 0
 *     → أرقام صحيحة بدون كسور (مناسب للـKPI: الرقم يُقرأ فى أقل من ثانية).
 *   - العملاء/الوثائق/التحصيل: minimumFractionDigits: 0 فقط
 *     → الحد الأقصى بيرجع لافتراضى العملة (منزلتان)، فالقروش تظهر لو موجودة
 *       (مهم فى الأقساط والمبالغ المسددة).
 *
 * فلو دمجناهم فى دالة واحدة كنا هنغيّر أرقامًا معروضة فعلاً على المستخدم —
 * وده تغيير سلوك مش تحسين UI. فالتوحيد هنا للمصدر (نقطة تعريف واحدة)
 * مع الحفاظ على مخرجات كل صفحة بالحرف.
 *
 * ملاحظة: الدوال مبنية على Intl.NumberFormat مُنشأ مرة واحدة (module scope)
 * بدل إنشاء formatter جديد فى كل نداء — أرخص بكثير فى الجداول والقوائم
 * الطويلة اللى بتنادى الدالة مئات المرات فى الـrender الواحد.
 */

const CURRENCY_BASE = {
  style: 'currency' as const,
  currency: 'EGP',
  minimumFractionDigits: 0,
};

/** صيغة الكسور (حتى منزلتين) — العملاء، الوثائق، التحصيل، الأقساط */
const fractionalFormatter = new Intl.NumberFormat('ar-EG', CURRENCY_BASE);

/** صيغة الأرقام الصحيحة (بدون كسور) — مؤشرات لوحة التحكم */
const wholeFormatter = new Intl.NumberFormat('ar-EG', {
  ...CURRENCY_BASE,
  maximumFractionDigits: 0,
});

/**
 * تنسيق مبلغ بالعملة مع إظهار الكسور لو موجودة (حتى منزلتين).
 * الصيغة الافتراضية لصفحات البيانات التفصيلية.
 */
export const formatCurrency = (amount: number): string => fractionalFormatter.format(amount);

/**
 * تنسيق مبلغ بالعملة كرقم صحيح بدون كسور.
 * مخصّص لمؤشرات الأداء (KPI) حيث الوضوح الفورى أهم من دقة القروش.
 */
export const formatCurrencyWhole = (amount: number): string => wholeFormatter.format(amount);
