// تقسيم وثيقة "الحماية والاستثمار" تلقائياً — قاعدة العمل: الحد الأقصى
// لمبلغ التأمين فى الوثيقة الواحدة 50,000 جنيه. لو مبلغ التأمين المطلوب
// أكبر، بيتقسم على عدة وثائق فرعية كل وحدة بحد أقصى 50,000، وأي باقٍ أقل
// من ذلك بيبقى وثيقة أخيرة منفصلة بنفس القيمة.
//
// أمثلة (مطابقة تماماً لما هو متبع فعلياً):
//   200,000  -> 4 وثائق: 50,000 × 4
//   1,000,000 -> 20 وثيقة: 50,000 × 20
//   120,000  -> 3 وثائق: 50,000 + 50,000 + 20,000

export const PROTECTION_INVESTMENT_MAX_SUM_ASSURED_PER_POLICY = 50000;

// فقط وثائق "الحماية والاستثمار" تخضع لقاعدة التقسيم هذه
const SPLIT_ELIGIBLE_POLICY_TYPE = 'protection_investment';

export interface PolicySplitChunk {
  // ترتيب الوثيقة الفرعية داخل المجموعة (1-based) — نفس group_sequence المخزّن
  index: number;
  sumAssured: number;
  // true للوحدات المتساوية (50,000 بالضبط)، false للوثيقة الأخيرة (الباقي)
  isFullUnit: boolean;
}

// بيرجع مصفوفة فاضية لو المبلغ غير صالح أو أقل من/يساوي الحد الأقصى (يعني
// مفيش داعي للتقسيم أصلاً — وثيقة واحدة عادية)
export function computeProtectionInvestmentSplit(totalSumAssured: number): PolicySplitChunk[] {
  const max = PROTECTION_INVESTMENT_MAX_SUM_ASSURED_PER_POLICY;
  if (!Number.isFinite(totalSumAssured) || totalSumAssured <= 0) return [];
  if (totalSumAssured <= max) return [];

  const fullCount = Math.floor(totalSumAssured / max);
  // تقريب لأقرب قرش لتفادي أخطاء الفاصلة العائمة (مثلاً 120000 - 100000 = 19999.999999)
  const remainder = Math.round((totalSumAssured - fullCount * max) * 100) / 100;

  const chunks: PolicySplitChunk[] = [];
  for (let i = 0; i < fullCount; i++) {
    chunks.push({ index: i + 1, sumAssured: max, isFullUnit: true });
  }
  if (remainder > 0) {
    chunks.push({ index: fullCount + 1, sumAssured: remainder, isFullUnit: false });
  }
  return chunks;
}

// هل هذا المبلغ (لنوع الوثيقة ده) يستوجب التقسيم التلقائي؟ — بيُستخدم عند
// إصدار وثيقة جديدة بس (مش عند التعديل، ومش لأنواع الوثائق التانية)
export function policyRequiresSplit(policyType: string | undefined, totalSumAssured: number | undefined | null): boolean {
  if (policyType !== SPLIT_ELIGIBLE_POLICY_TYPE) return false;
  if (totalSumAssured === undefined || totalSumAssured === null || Number.isNaN(totalSumAssured)) return false;
  return totalSumAssured > PROTECTION_INVESTMENT_MAX_SUM_ASSURED_PER_POLICY;
}

// هل فى المجموعة وثيقة "باقٍ" بقسط منفصل مطلوب إدخاله يدوياً؟ (آخر وحدة
// أقل من 50,000) — لو كل الوحدات متساوية (50,000 بالظبط) مفيش داعي لقسط إضافي
export function splitHasRemainderChunk(chunks: PolicySplitChunk[]): boolean {
  return chunks.length > 0 && !chunks[chunks.length - 1].isFullUnit;
}
