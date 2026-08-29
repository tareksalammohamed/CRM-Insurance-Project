import { z } from 'zod';
import type { Policy } from '../../../lib/supabase';

// ملاحظة مهمة: هذا الجدول/الشاشة منفصلة تماماً عن installments/payments
// (السنة الأولى). لا يُستخدم في أي تارجت/محقق/إحصائية — فقط متابعة وطباعة
// ما تم تحصيله من وثائق دخلت سنتها الثانية.

export type Year2Payment = {
  id: string;
  policy_id: string;
  amount: number;
  payment_date: string;
  payment_month: string;
  paid_by_user_id: string;
  notes?: string;
  is_cancelled: boolean;
  cancelled_at?: string;
  cancelled_by_user_id?: string;
  cancel_reason?: string;
  created_at: string;
  paid_by?: { name: string };
};

// وثيقة مؤهلة لشاشة السنة الثانية (أكملت سنة كاملة من start_date) مع إجمالي
// ما تم تحصيله لها في السنة الثانية
export type Year2EligiblePolicy = Policy & {
  customer: { name: string };
  owner: { name: string };
  year2_total_paid: number;
};

// فورم "تسجيل تحصيل" — أول فورم فى شاشة السنة الثانية يُنقل من التحقق
// اليدوي لـ zod (بنفس أسلوب فورمات صفحة المستخدمين)
// zod v4: `invalid_type_error` اتشال واتوحّد فى `error` — نفس الرسالة ونفس
// قواعد التحقق بالظبط (تحويل نص الحقل لرقم + وجوب أن يكون موجبًا).
export const year2PaymentSchema = z.object({
  amount: z.coerce.number({ error: 'برجاء إدخال مبلغ صحيح' }).positive('برجاء إدخال مبلغ صحيح'),
  paymentDate: z.string().min(1, 'التاريخ مطلوب'),
  notes: z.string().optional(),
});

// مدخلات الفورم كما يقرأها react-hook-form قبل تحويل zod (حقل المبلغ يبدأ
// كنص/غير معروف من الـinput)، بينما `Year2PaymentFormData` هى القيم بعد
// التحقق والتحويل (amount: number) وهى المستخدمة فى منطق العمل.
export type Year2PaymentFormInput = z.input<typeof year2PaymentSchema>;
export type Year2PaymentFormData = z.output<typeof year2PaymentSchema>;

export type PrintPeriodType = 'month' | 'quarter' | 'year';

export interface Year2ReportRow extends Year2Payment {
  policy: Policy & { customer: { name: string }; owner: { name: string } };
}

// فلتر سريع لتحصيلات السنة الثانية — بنفس أسماء وتسميات فلتر السنة الأولى
// (راجع src/pages/Collection/types.ts) لكن الحساب هنا مبني على سجل
// year2_payments نفسه (آخر شهر تم تحصيله فعلياً لكل وثيقة) بدل جدول أقساط
// منفصل، لأن تحصيل السنة الثانية مفيهوش جدول جدولة مستقل. هذا الفلتر لا
// يغيّر ولا يُستخدم في أي تارجت/محقق/إحصائية أخرى بالنظام.
export type Year2QuickFilter = 'month' | 'overdue' | 'paid';

export const YEAR2_QUICK_FILTERS: { id: Year2QuickFilter; label: string }[] = [
  { id: 'month', label: 'المستحق' },
  { id: 'overdue', label: 'متأخر' },
  { id: 'paid', label: 'تم السداد' },
];
