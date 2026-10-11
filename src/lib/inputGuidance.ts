/** Advisory checks only: never transform saved data or introduce underwriting rules. */
export function customerInputHints(values: Record<string, unknown>, today = new Date()): string[] {
  const hints: string[] = [];
  const digits = (value: unknown) => String(value ?? '').replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim();
  const nationalId = digits(values.national_id);
  if (nationalId && !/^\d{14}$/.test(nationalId)) hints.push('راجع الرقم القومي: المعتاد في البطاقة المصرية 14 رقمًا. طابقه مع المستند لتجنب ربط العميل برقم غير صحيح.');
  const phone = digits(values.phone);
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) hints.push('راجع رقم الهاتف: قد يحتوي على حروف أو عدد أرقام غير معتاد؛ تأكد أنه صالح للتواصل مع العميل.');
  const birth = String(values.birth_date ?? '');
  if (birth && birth > localDateKey(today)) hints.push('تاريخ الميلاد في المستقبل؛ راجع السنة والشهر واليوم مع مستند العميل.');
  return hints;
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function paymentDateIssue(value: string, today = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'أدخل تاريخ السداد الفعلي؛ نحتاجه لتحديد شهر تسجيل السداد.';
  const parsed = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(parsed.getTime()) || localDateKey(parsed) !== value) return 'تاريخ السداد غير صالح؛ اختر يومًا موجودًا في التقويم.';
  if (value > localDateKey(today)) return 'لا يمكن تسجيل سداد بتاريخ مستقبلي؛ اختر اليوم الذي حدث فيه السداد بالفعل.';
  return null;
}

export const fieldGuidance: Record<string, { label: string; reason: string }> = {
  national_id: { label: 'الرقم القومي', reason: 'راجع الرقم في البطاقة وابحث عن العميل الموجود لتجنب تكرار بياناته.' },
  name: { label: 'اسم العميل', reason: 'أدخل اسمًا من حرفين على الأقل لتحديد العميل.' },
  owner_id: { label: 'الوكيل المسؤول', reason: 'اختيار الوكيل مطلوب لربط العميل بالمسؤول عن متابعته.' },
  customer_id: { label: 'العميل', reason: 'اختر العميل الذي تخصه الوثيقة قبل إصدارها.' },
  policy_number: { label: 'رقم الوثيقة', reason: 'أدخل الرقم كما هو في الوثيقة لتمييزها عن باقي الوثائق.' },
  premium_amount: { label: 'القسط الصافي', reason: 'أدخل قيمة رقمية صحيحة حسب الوثيقة؛ الأقساط تعتمد على هذه القيمة.' },
  insurance_amount: { label: 'مبلغ التأمين', reason: 'أدخل المبلغ المسجل في طلب التأمين.' },
  sum_assured: { label: 'مبلغ التأمين', reason: 'أدخل مبلغ التأمين المطلوب للوثيقة.' },
  deposit_amount: { label: 'العربون', reason: 'أدخل قيمة العربون؛ إذا لم يوجد عربون أدخل صفرًا.' },
  payment_method: { label: 'طريقة السداد', reason: 'اختر دورية السداد لأنها تحدد مواعيد الأقساط.' },
  start_date: { label: 'تاريخ البداية', reason: 'حدد تاريخ بداية الوثيقة الذي تعتمد عليه مواعيد الاستحقاق.' },
  marital_status: { label: 'الحالة الاجتماعية', reason: 'اختر إحدى الحالات المتاحة أو اترك الحقل فارغًا.' },
  split_chunks: { label: 'الوثائق الفرعية', reason: 'راجع أرقام الوثائق ومبالغها وأقساطها وفق رسالة الخطأ.' },
};
