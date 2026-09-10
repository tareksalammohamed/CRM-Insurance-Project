import { z } from 'zod';
import { computeProtectionInvestmentSplit, policyRequiresSplit, splitHasRemainderChunk } from './business/policySplit';

export const policySchema = z.object({
  policy_number: z.string().min(1, 'رقم الوثيقة مطلوب'),
  customer_id: z.string().min(1, 'العميل مطلوب'),
  policy_type: z.enum(['quadruple', 'protection_investment', 'mixed', 'installments', 'pension_peace']),
  start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
  payment_method: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual']),
  premium_amount: z.number().min(1, 'قيمة القسط الصافي مطلوبة'),
  // مبلغ التأمين: إلزامي فقط عند إصدار وثيقة جديدة (isEditingPolicy = false).
  // الوثائق الموجودة حالياً قد لا تحتوي على هذا الحقل، فبيبقى فارغاً حتى
  // يتم إدخاله عند التعديل — isEditingPolicy بيتحكم في الإلزامية عبر
  // superRefine تحت (نفس أسلوب isManagerRole في customerSchema).
  //
  // لوثيقة "الحماية والاستثمار": ده مبلغ التأمين الإجمالي المطلوب للعميل،
  // ولو تجاوز 50,000 جنيه هيتقسم تلقائياً على عدة وثائق فرعية عند الحفظ
  // (راجع business/policySplit.ts وusePolicyActions.onSubmit).
  sum_assured: z.number().optional(),
  // قيمة القسط الصافي لوثيقة "الباقي" فقط، عند التقسيم التلقائي لوثيقة
  // "الحماية والاستثمار" — الوحدات المتساوية (50,000) كلها بتستخدم نفس
  // premium_amount المُدخل مرة واحدة، أما آخر وحدة (أقل من 50,000) فقسطها
  // مختلف غالباً فبيتدخل بشكل منفصل.
  remainder_premium_amount: z.number().optional(),
  notes: z.string().optional(),
  isEditingPolicy: z.boolean().optional()
}).superRefine((data, ctx) => {
  if (!data.isEditingPolicy && (data.sum_assured === undefined || data.sum_assured === null || Number.isNaN(data.sum_assured))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'مبلغ التأمين مطلوب',
      path: ['sum_assured']
    });
    return;
  }

  if (!data.isEditingPolicy && policyRequiresSplit(data.policy_type, data.sum_assured)) {
    const chunks = computeProtectionInvestmentSplit(data.sum_assured as number);
    if (splitHasRemainderChunk(chunks)) {
      if (
        data.remainder_premium_amount === undefined ||
        data.remainder_premium_amount === null ||
        Number.isNaN(data.remainder_premium_amount) ||
        data.remainder_premium_amount <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'قيمة القسط الصافي لوثيقة الباقي مطلوبة',
          path: ['remainder_premium_amount']
        });
      }
    }
  }
});

export type PolicyFormData = z.infer<typeof policySchema>;
