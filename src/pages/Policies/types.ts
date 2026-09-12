import { z } from 'zod';
import { policyRequiresSplit, validateCustomSplitAmounts } from './business/policySplit';

// نساعد على تفادي مشكلة: الحقل بيفضل مسجَّل فى react-hook-form بقيمته
// الافتراضية ('' غالباً) حتى لو اتشال من الشاشة مؤقتاً (وضع التقسيم)، فلو
// سبنا نوعه numeric صارم هيرفضه zod كنوع خطأ قبل ما نوصل أصلاً لـ superRefine
// (اللي هو المكان الصح لتحديد الإلزامية الشرطية). الدالة دي بتحوّل أي قيمة
// فاضية/غير رقمية لـ undefined بدل ما تسيبها تكسر التحقق من النوع الأساسي.
const emptyToUndefined = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'number' && Number.isNaN(val)) return undefined;
  return val;
};

// وثيقة فرعية واحدة داخل مجموعة تقسيم "حماية واستثمار" — رقمها ومبلغ
// تأمينها وقسطها الصافي، كلهم بيدخلهم المستخدم بنفسه بالكامل (راجع
// business/policySplit.ts وPolicyFormDialog)
export const policySplitChunkSchema = z.object({
  policy_number: z.string(),
  sum_assured: z.preprocess(emptyToUndefined, z.number().optional()),
  premium_amount: z.preprocess(emptyToUndefined, z.number().optional()),
});

export const policySchema = z.object({
  // إلزامي فقط لوثيقة واحدة عادية (بدون تقسيم) — عند التقسيم كل وثيقة
  // فرعية ليها رقمها الخاص جوه split_chunks بدل ده (راجع superRefine تحت)
  policy_number: z.string(),
  customer_id: z.string().min(1, 'العميل مطلوب'),
  policy_type: z.enum(['quadruple', 'protection_investment', 'mixed', 'installments', 'pension_peace']),
  start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
  payment_method: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual']),
  // إلزامي فقط لوثيقة واحدة عادية (بدون تقسيم) — عند التقسيم كل وثيقة
  // فرعية ليها قسطها الخاص جوه split_chunks بدل ده. مسموح يوصل فاضي هنا
  // (الحقل بيتشال من الشاشة فى وضع التقسيم) — الإلزامية بتتحقق فى superRefine
  premium_amount: z.preprocess(emptyToUndefined, z.number().optional()),
  // مبلغ التأمين: إلزامي فقط عند إصدار وثيقة جديدة (isEditingPolicy = false).
  // الوثائق الموجودة حالياً قد لا تحتوي على هذا الحقل، فبيبقى فارغاً حتى
  // يتم إدخاله عند التعديل — isEditingPolicy بيتحكم في الإلزامية عبر
  // superRefine تحت (نفس أسلوب isManagerRole في customerSchema).
  //
  // لوثيقة "الحماية والاستثمار": ده مبلغ التأمين الإجمالي المطلوب للعميل،
  // ولو تجاوز 50,000 جنيه لازم يتقسم على عدة وثائق فرعية (split_chunks) عند
  // الحفظ (راجع business/policySplit.ts وusePolicyActions.onSubmit).
  sum_assured: z.number().optional(),
  // الوثائق الفرعية الناتجة عن التقسيم — رقم ومبلغ تأمين وقسط كل وحدة منها
  // يدخلهم المستخدم بنفسه بالكامل ويقدر يضيف/يحذف وثائق ويعدّل أي مبلغ بحرية
  // (لا يوجد أي توليد أو تقسيم تلقائي للأرقام أو المبالغ)
  split_chunks: z.array(policySplitChunkSchema).optional(),
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

  const isSplitting = !data.isEditingPolicy && policyRequiresSplit(data.policy_type, data.sum_assured);

  if (!isSplitting) {
    if (!data.policy_number || !data.policy_number.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'رقم الوثيقة مطلوب', path: ['policy_number'] });
    }
    if (data.premium_amount === undefined || data.premium_amount === null || Number.isNaN(data.premium_amount) || data.premium_amount < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'قيمة القسط الصافي مطلوبة', path: ['premium_amount'] });
    }
    return;
  }

  const chunks = data.split_chunks || [];

  const amountsError = validateCustomSplitAmounts(data.sum_assured as number, chunks.map((c) => c.sum_assured ?? NaN));
  if (amountsError) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: amountsError, path: ['split_chunks'] });
  }

  const numbers = chunks.map((c) => (c.policy_number || '').trim());
  if (chunks.length === 0 || numbers.some((n) => !n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'أدخل رقم كل وثيقة من وثائق المجموعة', path: ['split_chunks'] });
  } else if (new Set(numbers).size !== numbers.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'أرقام وثائق المجموعة يجب أن تكون مختلفة', path: ['split_chunks'] });
  }

  if (chunks.some((c) => c.premium_amount === undefined || c.premium_amount === null || Number.isNaN(c.premium_amount) || c.premium_amount <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'قيمة القسط الصافي مطلوبة لكل وثيقة فرعية', path: ['split_chunks'] });
  }
});

export type PolicyFormData = z.infer<typeof policySchema>;
export type PolicySplitChunkFormData = z.infer<typeof policySplitChunkSchema>;
