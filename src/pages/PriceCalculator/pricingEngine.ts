import { PRICING_VARIANTS, type PricingVariant } from './pricingData';

// ─────────────────────────────────────────────────────────────
// محرك حساب الأسعار — يطابق معادلات Individual Pricing.xlsm.
//
// القسط الأساسي السنوي = مبلغ التأمين × السعر ÷ القاسم
// القسط الإضافي لكل تغطية = مبلغ التأمين × 2 ÷ 1000
// تتم إضافة تكلفة التغطيات إلى القسط السنوي قبل التجزئة.
// تحميل التقسيط (4%) يطبق بعد ذلك على الأقساط غير السنوية فقط.
// ─────────────────────────────────────────────────────────────

const INSTALLMENT_LOADING = 0.04;
export const ADDITIONAL_COVERAGE_RATE_PER_THOUSAND = 2;

export interface AdditionalCoverages {
  accident: boolean;
  permanentTotalDisability: boolean;
}

export const NO_ADDITIONAL_COVERAGES: AdditionalCoverages = {
  accident: false,
  permanentTotalDisability: false,
};

export interface CalculationInput {
  age: number;
  variantKey: string;
  sumInsured: number;
  additionalCoverages?: AdditionalCoverages;
}

export interface CalculationResult {
  variant: PricingVariant;
  age: number;
  sumInsured: number;
  rate: number;
  baseAnnualPremium: number;
  accidentPremium: number;
  permanentTotalDisabilityPremium: number;
  additionalCoveragesPremium: number;
  additionalCoverages: AdditionalCoverages;
  annualPremium: number;
  semiAnnualPremium: number;
  quarterlyPremium: number;
  monthlyPremium: number;
  calculatedAt: Date;
}

export function getVariant(key: string): PricingVariant | undefined {
  return PRICING_VARIANTS.find((v) => v.key === key);
}

/** الحد الأدنى/الأقصى للسن المتاح فعلياً فى جدول هذا المنتج */
export function getAgeRange(variant: PricingVariant): { min: number; max: number } {
  const ages = Object.keys(variant.rates).map(Number);
  return { min: Math.min(...ages), max: Math.max(...ages) };
}

export interface ValidationErrors {
  age?: string;
  variantKey?: string;
  sumInsured?: string;
}

export function validateInputs(
  ageRaw: string,
  variantKey: string,
  sumInsuredRaw: string
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!variantKey) {
    errors.variantKey = 'يرجى اختيار نوع الوثيقة';
  }

  if (!ageRaw.trim()) {
    errors.age = 'يرجى إدخال السن';
  } else {
    const age = Number(ageRaw);
    if (!Number.isFinite(age) || !Number.isInteger(age)) {
      errors.age = 'السن يجب أن يكون رقماً صحيحاً';
    } else if (variantKey) {
      const variant = getVariant(variantKey);
      if (variant) {
        const { min, max } = getAgeRange(variant);
        if (age < min || age > max) {
          errors.age = `السن غير ضمن الحدود المسموح بها لهذا المنتج (من ${min} إلى ${max} سنة)`;
        }
      }
    }
  }

  if (!sumInsuredRaw.trim()) {
    errors.sumInsured = 'يرجى إدخال مبلغ التأمين';
  } else {
    const sumInsured = Number(sumInsuredRaw);
    if (!Number.isFinite(sumInsured) || sumInsured <= 0) {
      errors.sumInsured = 'يجب أن يكون مبلغ التأمين أكبر من صفر';
    }
  }

  return errors;
}

export function calculatePrice(input: CalculationInput): CalculationResult {
  const variant = getVariant(input.variantKey);
  if (!variant) {
    throw new Error('نوع الوثيقة غير معروف');
  }

  const rate = variant.rates[input.age];
  if (rate === undefined) {
    throw new Error('السن غير متاح لهذا النوع من الوثائق');
  }

  const additionalCoverages: AdditionalCoverages = {
    accident: input.additionalCoverages?.accident === true,
    permanentTotalDisability: input.additionalCoverages?.permanentTotalDisability === true,
  };
  const baseAnnualPremium = (input.sumInsured * rate) / variant.divisor;
  const accidentPremium = additionalCoverages.accident
    ? (input.sumInsured * ADDITIONAL_COVERAGE_RATE_PER_THOUSAND) / 1000
    : 0;
  const permanentTotalDisabilityPremium = additionalCoverages.permanentTotalDisability
    ? (input.sumInsured * ADDITIONAL_COVERAGE_RATE_PER_THOUSAND) / 1000
    : 0;
  const additionalCoveragesPremium = accidentPremium + permanentTotalDisabilityPremium;
  const annualPremium = baseAnnualPremium + additionalCoveragesPremium;

  return {
    variant,
    age: input.age,
    sumInsured: input.sumInsured,
    rate,
    baseAnnualPremium,
    accidentPremium,
    permanentTotalDisabilityPremium,
    additionalCoveragesPremium,
    additionalCoverages,
    annualPremium,
    semiAnnualPremium: (annualPremium * (1 + INSTALLMENT_LOADING)) / 2,
    quarterlyPremium: (annualPremium * (1 + INSTALLMENT_LOADING)) / 4,
    monthlyPremium: (annualPremium * (1 + INSTALLMENT_LOADING)) / 12,
    calculatedAt: new Date(),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
