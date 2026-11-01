import type { DetectedFormField } from '../../features/customerDataExtraction/types';
import { nationalIdBirthDate, normalizeDigits, normalizeMeaning, readCalendarDate, readDecimal } from './extractionValues';

export const FIELD_MEANINGS: Record<string, string> = {
  name: 'اسم العميل صاحب البطاقة/المؤمن عليه؛ ليس اسم الوكيل أو المستفيد أو الأب منفردًا',
  customer_name: 'اسم العميل/المؤمن عليه كاملًا؛ ليس الوكيل أو المستفيد أو صاحب التوقيع',
  national_id: 'رقم قومي مصري 14 رقمًا يخص العميل؛ ليس رقم الوثيقة أو الهاتف أو بطاقة المستفيد',
  phone: 'هاتف العميل؛ ليس رقمًا قوميًا أو رقم وثيقة أو هاتف الوكيل/الشركة',
  address: 'عنوان إقامة العميل كما هو؛ لا تستنتج عنوانًا من جهة إصدار البطاقة',
  birth_date: 'ميلاد العميل؛ ليس إصدار البطاقة أو انتهائها أو بداية التأمين',
  occupation: 'المهنة المذكورة صراحة؛ المؤهل الدراسي لا يعني مهنة',
  marital_status: 'الحالة الاجتماعية المذكورة صراحة للعميل',
  agent_name: 'الوكيل/المندوب/المنتج المسؤول، منفصل تمامًا عن اسم المؤمن عليه',
  policy_number: 'رقم وثيقة التأمين وحدها؛ ليس رقم طلب أو إيصال أو رقم قومي',
  policy_type: 'اسم المنتج/نوع الوثيقة من الاختيارات؛ لا تستنتجه من قيمة التأمين',
  insurance_amount: 'مبلغ التأمين/رأس المال المؤمن عليه؛ ليس القسط أو إجمالي الأقساط أو مبلغًا متوقعًا',
  sum_assured: 'مبلغ التأمين/رأس المال المؤمن عليه؛ ليس القسط أو إجمالي الأقساط أو مبلغًا متوقعًا',
  premium_amount: 'القسط الصافي لكل دفعة حسب دورية السداد؛ ليس إجمالي السنة أو القسط الإجمالي بالرسوم أو المدفوع أو المتبقي أو عدد الأقساط. لا تحسبه ولا تختر الأقل',
  payment_method: 'دورية السداد: شهري/ربع سنوي/نصف سنوي/سنوي؛ ليست وسيلة الدفع نقدًا/تحويل/محفظة',
  start_date: 'تاريخ بدء سريان التأمين؛ ليس تاريخ الطباعة أو السداد أو إصدار البطاقة. لا تعتبر إصدار الوثيقة بداية سريان إلا لو النص يصرح بذلك',
  notes: 'ملاحظات صريحة تخص العميل/الوثيقة؛ ليست مكانًا لنقل البيانات غير المفهومة أو ملخص النموذج',
};

const OPTION_ALIASES: Record<string, Record<string, string[]>> = {
  payment_method: { monthly: ['شهري', 'شهريا', 'كل شهر'], quarterly: ['ربع سنوي', 'كل 3 شهور', 'ربع سنويا'], semi_annual: ['نصف سنوي', 'كل 6 شهور'], annual: ['سنوي', 'سنويا', 'كل سنه'] },
  marital_status: { single: ['اعزب', 'عزباء', 'غير متزوج', 'غير متزوجه'], married: ['متزوج', 'متزوجه'], divorced: ['مطلق', 'مطلقه'], widowed: ['ارمل', 'ارمله'] },
};

export function matchExactOption(field: DetectedFormField, value: string): string | null {
  const target = normalizeMeaning(value);
  if (!target) return null;
  const matches = (field.options ?? []).filter(option => [option.value, option.label, ...(OPTION_ALIASES[field.name]?.[option.value] ?? [])]
    .some(alias => normalizeMeaning(alias) === target));
  return matches.length === 1 ? matches[0].value : null;
}

export function fieldSourceConflict(name: string, label: string): string | null {
  const source = normalizeMeaning(label);
  if (!source) return null;
  if (['name', 'customer_name', 'national_id', 'phone', 'address', 'birth_date'].includes(name) && /مستفيد|beneficiar|وكيل|agent|مندوب|منتج|حامل الوثيق/.test(source)) return 'المصدر يخص شخصًا آخر، وليس بيانات العميل المطلوبة';
  if (name === 'agent_name' && /مؤمن عليه|عميل|insured|client|customer/.test(source)) return 'هذا اسم العميل وليس الوكيل';
  if (name === 'premium_amount' && /اجمالي|مجموع|سنوي|رسوم|ضريب|مدفوع|مسدد|متبقي|عدد|gross|total|annual|paid|count|balance/.test(source)) return 'المصدر ليس القسط الصافي لكل دفعة';
  if (['insurance_amount', 'sum_assured'].includes(name) && /قسط|premium|تحصيل|مدفوع|متبقي/.test(source)) return 'هذه قيمة قسط/سداد وليست مبلغ التأمين';
  if (name === 'birth_date' && /اصدار|انتهاء|سريان|بداي|issue|expir|start|effective/.test(source)) return 'المصدر لا يمثل تاريخ الميلاد';
  if (name === 'start_date' && /ميلاد|سداد|اصدار|طباع|birth|paid|print|issue/.test(source)) return 'المصدر لا يثبت بداية سريان التأمين';
  if (name === 'policy_number' && /قومي|هاتف|طلب|ايصال|national|phone|receipt|request/.test(source)) return 'المصدر لا يمثل رقم الوثيقة';
  return null;
}

/** Checks extraction proposals, without changing the application's save/calculation rules. */
export function validateExtractedValue(field: DetectedFormField, raw: unknown): { value: string; error: string | null } {
  if (!['string', 'number'].includes(typeof raw) || (typeof raw === 'number' && !Number.isFinite(raw))) return { value: '', error: 'القيمة ليست نصًا أو رقمًا صالحًا' };
  let value = String(raw).trim();
  if (!value || /^(null|undefined|n\/?a|غير معروف|غير مذكور)$/i.test(value)) return { value: '', error: 'لم تُقرأ قيمة واضحة لهذا الحقل' };
  if (field.inputType === 'number') {
    const number = readDecimal(value);
    if (number === null) return { value, error: 'يلزم مبلغ واحد واضح؛ لا يمكن دمج أرقام أو حذف كلمات لتكوين مبلغ' };
    value = String(number);
    if (['premium_amount', 'insurance_amount', 'sum_assured'].includes(field.name) && number <= 0) return { value, error: 'المبلغ المستخرج يجب أن يكون أكبر من صفر' };
    if (field.min !== undefined && number < field.min || field.max !== undefined && number > field.max) return { value, error: 'القيمة خارج الحدود المتاحة لهذه الخانة' };
  } else if (field.inputType === 'date') {
    const date = readCalendarDate(value);
    if (!date) return { value, error: 'تاريخ غير صحيح؛ راجع اليوم والشهر والسنة في المصدر' };
    value = date;
  } else if (field.inputType === 'select') {
    const option = matchExactOption(field, value);
    if (!option) return { value, error: 'لا توجد مطابقة مؤكدة لأحد اختيارات هذه الخانة' };
    value = option;
  } else if (['national_id', 'phone', 'policy_number'].includes(field.name)) {
    value = normalizeDigits(value).trim();
    if (field.name === 'national_id') {
      value = value.replace(/[\s-]/g, '');
      if (!nationalIdBirthDate(value)) return { value, error: 'الرقم القومي يجب أن يكون 14 رقمًا ويحتوي تاريخ ميلاد صحيحًا' };
    } else if (field.name === 'phone') {
      value = value.replace(/[\s()-]/g, '');
      if (/^1[0125]\d{8}$/.test(value)) return { value, error: 'قد يكون صفر الهاتف الأول فُقد من الملف؛ أدخل الرقم كاملًا من المصدر' };
      if (!/^\+?\d{7,15}$/.test(value) || /^[23]\d{13}$/.test(value)) return { value, error: 'رقم الهاتف غير واضح أو يشبه رقمًا قوميًا؛ راجع المصدر' };
    }
  }
  if (['name', 'customer_name', 'agent_name'].includes(field.name) && !/[\p{L}]/u.test(value)) return { value, error: 'هذه الخانة تحتاج اسم شخص، وليست رقمًا' };
  if (field.maxLength && value.length > field.maxLength) return { value, error: 'النص أطول من الحد المتاح للخانة' };
  return { value, error: null };
}
