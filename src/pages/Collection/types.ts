import type { Installment, Policy } from '../../lib/supabase';

// فلتر سريع أعلى قائمة أقساط السنة الأولى — يجمّع نفس معايير الحساب
// القديمة (new_production / periodic / overdue / paid_new / paid_periodic)
// تحت 3 فلاتر واضحة للمستخدم، دون أي تغيير في طريقة الحساب نفسها.
// فلتر "الشهر" يغطي "المستحق" خلال الشهر بالكامل.
export type QuickFilter = 'month' | 'overdue' | 'paid';

// فلتر فرعي اختياري: يفرّق بين "الإنتاج الجديد" و"التحصيل الدوري" باستخدام
// نفس عمود is_first الأصلي، فقط لمن يحتاج هذا التفصيل داخل فلتر "الشهر" أو
// "تم السداد".
export type SubType = 'all' | 'new' | 'periodic';

// فلتر "الفريق" — بيصفّي النتائج حسب صاحب الوثيقة (owner) نفسه، مش حسب درجة
// وظيفية ثابتة للجميع. القيمة هنا هي معرّف شخص محدد من فريق المستخدم الحالي
// (نفس قائمة get_user_subtree المستخدمة أصلاً فى صفحة العملاء)، أو 'all' لعدم
// التصفية. اختيار شخص معيّن بيجيب مستحقاته + مستحقات كل من هو تحته في
// الهيكل الإداري (لو كان رئيس مجموعة مثلاً، بيتجاب معاه كل وكلائه تلقائياً).
export type OwnerFilter = 'all' | string;

// الوثيقة المرتبطة بالقسط كما تُحمَّل فعلاً فى قائمة التحصيل — بيانات العميل
// والوكيل بتتجاب مع الاستعلام نفسه (customer:customer_id / owner:owner_id).
export type CollectionPolicy = Policy & {
  customer: { name: string; phone?: string; national_id?: string };
  owner: { name: string };
};

// `policy` إلزامية هنا (مش اختيارية) لأن استعلام قائمة التحصيل بيستخدم
// `policy:policy_id!inner(...)`، و`installments.policy_id` مفتاح أجنبي إلزامي
// — فكل صف بيرجع من الاستعلام ده له وثيقة مؤكدة. الاختيارية السابقة كانت
// بتجبر كل مكوّنات العرض على فحوص `?.` لحالة مستحيلة، وبتخفي فى نفس الوقت
// إن الأقساط المحمّلة من مسارات تانية (بدون علاقات) نوعها مختلف فعلاً.
export type InstallmentWithRelations = Installment & {
  policy: CollectionPolicy;
};

export const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'month',   label: 'المستحق' },
  { id: 'overdue', label: 'متأخر' },
  { id: 'paid',    label: 'تم السداد' },
];
