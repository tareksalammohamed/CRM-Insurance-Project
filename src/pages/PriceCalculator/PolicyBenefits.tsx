import type { PricingVariant, ProductFamily } from './pricingData';
import type { CalculationResult } from './pricingEngine';

// ─────────────────────────────────────────────────────────────
// حساب "مزايا الوثيقة" — إضافة جديدة تماماً، منفصلة عن pricingEngine.ts
// الأصلي ولا تعدّل أى معادلة أو ثابت موجود فيه. الحسابات هنا مبنية حرفياً
// على المعادلات الموضحة فى طلب التطوير:
//
//   وثيقة مختلط / ذو أقساط  → ربح سنوى ثابت 4.74% غير تراكمى
//   وثيقة حماية واستثمار    → ربح سنوى ثابت 5.75% غير تراكمى
//   وثيقة الرباعية          → دفعة كل 5 سنوات (ربع مبلغ التأمين) + دفعة
//                             ختامية = آخر ربع مستحق + 55% من مبلغ التأمين
// ─────────────────────────────────────────────────────────────

export const PROFIT_RATE_MIXED_FIXED_TERM = 0.0474; // 4.74% — مختلط / ذو أقساط
export const PROFIT_RATE_PROTECTION_INVESTMENT = 0.0575; // 5.75% — حماية واستثمار

// معاش واطمئنان: قيمة المعاش الشهرى تُحسب على معامل 89، بينما الصرف الفعلى
// يستمر 120 شهراً (10 سنوات) وفق قواعد المنتج.
export const PENSION_DIVISOR = 89;
export const PENSION_PAYMENT_MONTHS = 120;

export type PensionCashPercent = 0 | 25 | 50;

/**
 * يستخرج "مدة الوثيقة" (بالسنوات) من مفتاح المنتج نفسه، دون أى إدخال
 * إضافى من المستخدم ودون تغيير واجهة حاسبة الأسعار الحالية:
 *  - مفاتيح بها لاحقة صريحة للمدة مثل "_10y" أو "_15y" ← تُقرأ مباشرة.
 *  - مفاتيح "حتى سن كذا" مثل "_age60" ← المدة = السن المستهدف − سن العميل.
 *  - "الرباعية" ليس لها مفتاح مدة (غير مطلوبة لحساب مزاياها أصلاً).
 */
export function extractTermYears(variant: PricingVariant, age: number): number | null {
  const explicitYears = variant.key.match(/_(\d+)y$/);
  if (explicitYears) {
    const years = Number(explicitYears[1]);
    return years > 0 ? years : null;
  }

  const targetAgeMatch = variant.key.match(/_age(\d+)$/);
  if (targetAgeMatch) {
    const targetAge = Number(targetAgeMatch[1]);
    const term = targetAge - age;
    return term > 0 ? term : null;
  }

  return null;
}

export interface FlatProfitBenefit {
  kind: 'flat_profit';
  family: Extract<ProductFamily, 'mixed' | 'protection_investment'>;
  profitRatePct: number; // مثال: 4.74
  termYears: number;
  annualProfit: number;
  totalProfit: number;
  maturityAmount: number;
  hasAccidentDoubling: boolean; // مضاعفة مبلغ التأمين حال الوفاة بحادث (حماية واستثمار فقط)
  hasQuarterlyWithdrawal: boolean; // سحب ربع سنوى على مبلغ التأمين (حماية واستثمار فقط)
}

export interface QuaternaryBenefit {
  kind: 'quaternary';
  periodicPayout: number; // الدفعة كل 5 سنوات = ربع مبلغ التأمين
  maturityAmount: number; // آخر ربع مستحق + 55% من مبلغ التأمين
}

export interface PensionBenefit {
  kind: 'pension';
  termYears: number;
  cashPercent: PensionCashPercent;
  pensionPercent: number;
  cashReward: number;
  pensionBaseAmount: number;
  monthlyPension: number;
  pensionMonths: number;
}

export interface NoBenefit {
  kind: 'none';
}

export type PolicyBenefit = FlatProfitBenefit | QuaternaryBenefit | PensionBenefit | NoBenefit;

export function calculatePolicyBenefit(
  result: CalculationResult,
  pensionCashPercent?: PensionCashPercent
): PolicyBenefit {
  const { variant, sumInsured, age } = result;
  const family = variant.family;

  if (family === 'quaternary') {
    const periodicPayout = sumInsured * 0.25;
    const maturityAmount = periodicPayout + sumInsured * 0.55;
    return { kind: 'quaternary', periodicPayout, maturityAmount };
  }

  if (family === 'pension_reassurance') {
    if (pensionCashPercent === undefined) return { kind: 'none' };

    const termYears = extractTermYears(variant, age);
    if (!termYears) return { kind: 'none' };

    const pensionPercent = 100 - pensionCashPercent;
    const cashReward = sumInsured * (pensionCashPercent / 100);
    const pensionBaseAmount = sumInsured * (pensionPercent / 100);
    const monthlyPension = pensionBaseAmount / PENSION_DIVISOR;

    return {
      kind: 'pension',
      termYears,
      cashPercent: pensionCashPercent,
      pensionPercent,
      cashReward,
      pensionBaseAmount,
      monthlyPension,
      pensionMonths: PENSION_PAYMENT_MONTHS,
    };
  }

  if (family === 'mixed' || family === 'protection_investment') {
    const termYears = extractTermYears(variant, age);
    if (!termYears) return { kind: 'none' };

    const rate = family === 'protection_investment'
      ? PROFIT_RATE_PROTECTION_INVESTMENT
      : PROFIT_RATE_MIXED_FIXED_TERM;

    const annualProfit = sumInsured * rate;
    const totalProfit = annualProfit * termYears;
    const maturityAmount = sumInsured + totalProfit;

    return {
      kind: 'flat_profit',
      family,
      profitRatePct: rate * 100,
      termYears,
      annualProfit,
      totalProfit,
      maturityAmount,
      hasAccidentDoubling: family === 'protection_investment',
      hasQuarterlyWithdrawal: family === 'protection_investment',
    };
  }

  return { kind: 'none' };
}

export const DEATH_BENEFIT_NOTICE =
  'يرجى العلم أنه إذا حدثت وفاة (لا قدر الله) أثناء مدة التأمين يتم صرف مبلغ التأمين بالكامل بالإضافة إلى الأرباح المستحقة حتى تاريخ الوفاة.';

export const ACCIDENT_DOUBLING_NOTICE =
  'وإذا كانت الوفاة نتيجة حادث يتم مضاعفة مبلغ التأمين.';

export const QUARTERLY_WITHDRAWAL_NOTICE =
  'تشترك الوثيقة فى سحب ربع سنوى على مبلغ التأمين.';

export const QUATERNARY_DEATH_NOTICE =
  'يرجى العلم أنه إذا حدثت وفاة (لا قدر الله) أثناء مدة التأمين يتم صرف مبلغ التأمين بالكامل بالإضافة إلى الأرباح المستحقة حتى تاريخ الوفاة بغض النظر عن الدفعات التى تم صرفها مسبقاً.';

export const PENSION_TRIGGER_NOTICE =
  'تبدأ استحقاقات الوثيقة عند نهاية مدة التأمين أو عند حدوث وفاة أثناء مدة الوثيقة.';

export const PENSION_DURATION_NOTICE =
  'يتم صرف المعاش لمدة 120 شهراً كاملة (10 سنوات) وفق خيار الصرف المحدد عند التعاقد.';
