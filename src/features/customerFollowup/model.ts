export const CONTACT_OUTCOMES = {
  reached: 'تم التواصل', no_answer: 'لم يرد', postponed: 'طلب التأجيل', documents: 'استكمال مستندات', declined: 'اعتذر عن الاستكمال', other: 'أخرى',
} as const;
export const EXPIRY_REASONS = {
  declined: 'العميل اعتذر', postponed: 'تأجيل من العميل', unreachable: 'تعذّر التواصل', documents: 'نقص مستندات', other: 'سبب آخر',
} as const;
export type ExpiryReason = keyof typeof EXPIRY_REASONS;
export type PromiseContext = { policyId: string; installmentId?: string; policyNumber: string; installmentNumber?: number; minimumMonth?: string };
export type FollowupRow = {
  id: string; customer_id: string; customer_name: string; customer_phone: string | null;
  author_name: string | null; created_at: string; kind: 'contact' | 'promise' | 'expiry';
  outcome: string; notes: string; next_action: string | null; next_date: string | null;
  policy_id: string | null; policy_number: string | null; installment_id: string | null;
  installment_number: number | null; payment_month: string | null;
  close_note: string | null; closed_at: string | null;
  followup_status: 'closed' | 'paid' | 'inactive' | 'overdue' | 'today' | 'upcoming' | 'logged';
};
export function cairoToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function followupStatusLabel(row: Pick<FollowupRow, 'kind' | 'followup_status'>): string {
  const labels = { closed: row.kind === 'promise' ? 'وعد مغلق' : 'متابعة مغلقة', paid: 'تم السداد الفعلي', inactive: 'الوثيقة غير نشطة', overdue: row.kind === 'promise' ? 'موعد الوعد فات دون سداد' : 'متابعة متأخرة', today: 'موعد اليوم', upcoming: 'موعد قادم', logged: 'مسجل' };
  return labels[row.followup_status];
}
export function followupOutcomeLabel(row: Pick<FollowupRow, 'kind' | 'outcome'>): string {
  if (row.kind === 'promise') return 'وعد بالسداد';
  if (row.kind === 'expiry') return `سبب تلف الطلب: ${EXPIRY_REASONS[row.outcome as ExpiryReason] || row.outcome}`;
  return CONTACT_OUTCOMES[row.outcome as keyof typeof CONTACT_OUTCOMES] || row.outcome;
}
export function validateFollowup(input: { notes: string; nextDate: string; nextAction: string; paymentMonth: string }, context?: PromiseContext, today = cairoToday()): string | null {
  if (!input.notes.trim() || input.notes.trim().length > 2000) return 'اكتب نتيجة التواصل أو تفاصيل الاتفاق بحد أقصى ٢٠٠٠ حرف.';
  if (input.nextDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextDate) || Number.isNaN(Date.parse(input.nextDate)) || new Date(input.nextDate).toISOString().slice(0, 10) !== input.nextDate)) return 'اختر تاريخًا صحيحًا.';
  if (input.nextDate && input.nextDate < today) return 'الموعد يجب أن يكون اليوم أو بعده.';
  if (context && !input.nextDate) return 'حدد تاريخ وعد السداد.';
  if (!context && input.nextDate && !input.nextAction.trim()) return 'اكتب الخطوة القادمة للمتابعة المحددة.';
  if (input.nextAction.trim().length > 500) return 'الخطوة القادمة لا تتجاوز ٥٠٠ حرف.';
  if (context && !context.installmentId) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.paymentMonth)) return 'حدد شهر التحصيل الذي يخصه الوعد.';
    if (context.minimumMonth && input.paymentMonth < context.minimumMonth) return 'اختر شهرًا من السنة الثانية أو بعدها.';
  }
  return null;
}

// Only known operational messages may be shown verbatim; all other errors use the app translator.
export const FOLLOWUP_MESSAGES = [
  'يجب تسجيل الدخول أولًا', 'هذه المتابعة مغلقة بالفعل', 'اكتب نتيجة المتابعة أو سبب إلغاء الوعد',
  'موعد المتابعة أو وعد السداد يجب أن يكون اليوم أو بعده', 'الوثيقة لا تخص العميل أو لا تملك صلاحية الوصول إليها',
  'وعد السداد متاح للوثائق النشطة فقط', 'القسط لا يخص الوثيقة المحددة', 'القسط مسدد بالفعل؛ لا يحتاج وعد سداد',
  'شهر التحصيل يجب أن يكون ضمن السنة الثانية أو بعدها', 'الوثيقة لم تدخل السنة الثانية بعد', 'شهر التحصيل المحدد مسدد بالفعل',
  'الطلب غير موجود أو ليس لديك صلاحية تعديله', 'اختر سبب تحويل الطلب إلى تالف', 'اكتب سبب تحويل الطلب إلى تالف',
  'تم تحويل الطلب إلى تالف بالفعل؛ حدّث القائمة', 'لا يمكن تحويل الطلب إلى تالف لوجود وثيقة مرتبطة به',
  'يوجد وعد مفتوح لهذا القسط أو شهر التحصيل. راجعه في السجل، وأغلقه مع توضيح السبب قبل تسجيل موعد جديد.',
  'اكتب نتيجة المتابعة أو سبب إغلاق الوعد بحد أقصى ٥٠٠ حرف.', 'المتابعة أُغلقت بالفعل أو لم تعد لديك صلاحية تعديلها. حدّث السجل.',
];
