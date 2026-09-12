// تقسيم وثيقة "الحماية والاستثمار" — قاعدة العمل: الحد الأقصى لمبلغ التأمين
// فى الوثيقة الفرعية الواحدة 50,000 جنيه. لو مبلغ التأمين الإجمالي المطلوب
// أكبر من كده، لازم يتقسم على عدة وثائق فرعية. المستخدم هو اللي بيحدد عدد
// الوثائق الفرعية، ورقم ومبلغ تأمين وقسط كل وحدة بنفسه بالكامل — مفيش أي
// توليد أو تقسيم تلقائي. الدوال هنا بتقترح تقسيم افتراضي كنقطة بداية فى
// النموذج بس، وبتتحقق من صحة أي تقسيم مخصص يدخله المستخدم قبل الحفظ.
//
// مثال: مبلغ تأمين 120,000 يقترح افتراضياً 50,000 + 50,000 + 20,000، لكن
// المستخدم حر يغيّره لثلاث وثائق بـ 40,000 لكل واحدة (المجموع لازم يفضل
// مطابق تماماً لمبلغ التأمين الإجمالي، وكل وحدة لا تتجاوز 50,000).

export const PROTECTION_INVESTMENT_MAX_SUM_ASSURED_PER_POLICY = 50000;

// فقط وثائق "الحماية والاستثمار" تخضع لقاعدة التقسيم هذه
const SPLIT_ELIGIBLE_POLICY_TYPE = 'protection_investment';

// تقسيم مقترح افتراضي فقط (وحدات متساوية بحد أقصى 50,000، وأي باقٍ أقل من
// ذلك فى وحدة أخيرة منفصلة) — نقطة بداية فى النموذج، والمستخدم حر يعدّلها
// بالكامل (يضيف/يحذف وثائق، يغيّر مبلغ أي وحدة) قبل الحفظ. بيرجع مصفوفة
// فاضية لو المبلغ غير صالح أو لا يستوجب تقسيم أصلاً (يعني وثيقة واحدة عادية).
export function suggestProtectionInvestmentSplitAmounts(totalSumAssured: number): number[] {
  const max = PROTECTION_INVESTMENT_MAX_SUM_ASSURED_PER_POLICY;
  if (!Number.isFinite(totalSumAssured) || totalSumAssured <= max) return [];

  const fullCount = Math.floor(totalSumAssured / max);
  // تقريب لأقرب قرش لتفادي أخطاء الفاصلة العائمة (مثلاً 120000 - 100000 = 19999.999999)
  const remainder = Math.round((totalSumAssured - fullCount * max) * 100) / 100;

  const amounts: number[] = Array.from({ length: fullCount }, () => max);
  if (remainder > 0) amounts.push(remainder);
  return amounts;
}

// هل هذا المبلغ (لنوع الوثيقة ده) يستوجب التقسيم؟ — بيُستخدم عند إصدار
// وثيقة جديدة بس (مش عند التعديل، ومش لأنواع الوثائق التانية)
export function policyRequiresSplit(policyType: string | undefined, totalSumAssured: number | undefined | null): boolean {
  if (policyType !== SPLIT_ELIGIBLE_POLICY_TYPE) return false;
  if (totalSumAssured === undefined || totalSumAssured === null || Number.isNaN(totalSumAssured)) return false;
  return totalSumAssured > PROTECTION_INVESTMENT_MAX_SUM_ASSURED_PER_POLICY;
}

// يتحقق من صحة تقسيم مخصص (عدد ومبالغ حرة يدخلها المستخدم) قبل الحفظ:
// وثيقتين على الأقل، كل وحدة أكبر من صفر ولا تتجاوز الحد الأقصى للوثيقة
// الواحدة (50,000)، ومجموعها يساوي بالضبط مبلغ التأمين الإجمالي المطلوب.
// بيرجع null لو التقسيم صحيح، أو رسالة الخطأ المناسبة لو لأ.
export function validateCustomSplitAmounts(totalSumAssured: number, amounts: number[]): string | null {
  const max = PROTECTION_INVESTMENT_MAX_SUM_ASSURED_PER_POLICY;

  if (!amounts || amounts.length < 2) {
    return 'يجب تقسيم مبلغ التأمين على وثيقتين على الأقل';
  }

  for (const amount of amounts) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 'مبلغ التأمين لكل وثيقة فرعية يجب أن يكون أكبر من صفر';
    }
    if (amount > max) {
      return `مبلغ التأمين لكل وثيقة فرعية يجب ألا يتجاوز ${max.toLocaleString('en-US')} جنيه`;
    }
  }

  const sum = Math.round(amounts.reduce((s, a) => s + a, 0) * 100) / 100;
  const total = Math.round((totalSumAssured || 0) * 100) / 100;
  if (sum !== total) {
    return 'مجموع مبالغ التأمين للوثائق الفرعية يجب أن يساوي مبلغ التأمين الإجمالي بالضبط';
  }

  return null;
}
