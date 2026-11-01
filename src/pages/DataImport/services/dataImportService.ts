import { friendlyError } from '../../../lib/errorMessages';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase, POLICY_TYPE_LABELS, PAYMENT_METHOD_LABELS, MARITAL_STATUS_LABELS, type User } from '../../../lib/supabase';
import { fetchAgentsForCurrentUser } from '../../Customers/services/customersService';
import { IMPORT_COLUMNS, type ImportColumnKey, type ImportColumnReview, type ParsedRow, type ImportRowPayload, type RowResult, type ImportSummary } from '../types';
import { matchColumnsWithAI } from './aiColumnMatcher';
import { nationalIdBirthDate, normalizeDigits, readCalendarDate, readDecimal } from '../../../lib/ai/extractionValues';
import { validateExtractedValue } from '../../../lib/ai/extractionSemantics';

export interface ImportAgent {
  id: string;
  name: string;
}

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_SHEETS = 2;
const MAX_IMPORT_ROWS = 10000;
const IMPORT_FILE_EXTENSION_RE = /\.(xlsx|xls|csv)$/i;

function safeSpreadsheetText(value: unknown): string {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

// ===================================================================
// 1) تحميل نموذج Excel
// ===================================================================
export function downloadTemplateFile() {
  const headers = IMPORT_COLUMNS.map((c) => (c.required ? `${c.header} *` : c.header));

  const exampleRow = [
    'أحمد محمد علي',
    '29001011234567',
    '01012345678',
    'القاهرة - مدينة نصر',
    '1990-01-01',
    'مهندس',
    'أعزب/عزباء',
    'اسم الوكيل هنا',
    'POL-000123',
    'الرباعية',
    '100000',
    '500',
    'شهري',
    '2024-01-15',
    'ملاحظات اختيارية'
  ];

  const sheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  sheet['!cols'] = headers.map(() => ({ wch: 20 }));

  const notesLines = [
    ['ملاحظات مهمة قبل التعبئة:'],
    ['- الأعمدة المُعلَّمة بعلامة * إلزامية، والباقي اختياري.'],
    ['- الأعمدة الاختيارية التالية يمكن تركها فارغة، أو حذف العمود بالكامل من الملف: الرقم القومي، رقم الهاتف، العنوان، تاريخ الميلاد، المهنة، الحالة الاجتماعية، الملاحظات.'],
    ['- كل صف يمثل وثيقة واحدة (عميل واحد + وثيقة واحدة).'],
    ['- احذف صف المثال قبل رفع الملف، أو استبدله ببياناتك.'],
    [''],
    ['القيم المسموحة لعمود "نوع الوثيقة":'],
    ...Object.values(POLICY_TYPE_LABELS).map((v) => [v]),
    [''],
    ['القيم المسموحة لعمود "طريقة السداد":'],
    ...Object.values(PAYMENT_METHOD_LABELS).map((v) => [v]),
    [''],
    ['القيم المسموحة لعمود "الحالة الاجتماعية" (اختياري):'],
    ...Object.values(MARITAL_STATUS_LABELS).map((v) => [v]),
    [''],
    ['صيغة التواريخ المقبولة: yyyy-mm-dd أو dd/mm/yyyy (أو تاريخ خلية Excel عادي).'],
    ['اسم الوكيل يجب أن يطابق اسم وكيل موجود بالفعل في النظام ونشط وتابع لك في الهيكل الإداري.'],
  ];
  const notesSheet = XLSX.utils.aoa_to_sheet(notesLines);
  notesSheet['!cols'] = [{ wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'استيراد البيانات');
  XLSX.utils.book_append_sheet(wb, notesSheet, 'تعليمات');

  XLSX.writeFile(wb, 'نموذج-استيراد-البيانات.xlsx');
}

// ===================================================================
// 1ب) جلب قائمة الوكلاء (فريق المستورِد) لمطابقة "اسم الوكيل" في الملف
//     محلياً قبل الإرسال، بدل ما نكتشف الخطأ بعد محاولة كل صف على حدة
//     في السيرفر. بنعيد استخدام نفس الدالة المستخدمة في صفحة العملاء
//     (fetchAgentsForCurrentUser) عشان نفس نطاق الفريق بالظبط.
// ===================================================================
export async function fetchImportAgents(user: User, branchId: string | null = null): Promise<ImportAgent[]> {
  try {
    const all = await fetchAgentsForCurrentUser(user, branchId);
    const candidates = [
      ...(user.role === 'agent' || user.role === 'premium_agent'
        ? [{ id: user.id, name: user.name, role: user.role }]
        : []),
      ...(all || []),
    ];

    const unique = new Map<string, ImportAgent>();
    for (const u of candidates as any[]) {
      if ((u.role === 'agent' || u.role === 'premium_agent') && u.id && u.name) {
        unique.set(u.id, { id: u.id, name: String(u.name).trim() });
      }
    }

    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } catch {
    // لو فشل الجلب لأي سبب، منمنعش المستخدم من الاستيراد — هنرجع قائمة
    // فاضية وهيتم تجاوز التحقق المحلي من اسم الوكيل، وتبقى المطابقة
    // النهائية من طرف السيرفر (RPC).
    return [];
  }
}

const ARABIC_DIACRITICS_RE = /[\u064B-\u0652\u0670\u0640]/g; // تشكيل + تطويل

// توحيد أشكال الحروف العربية المختلفة اللي بتمثل نفس الحرف صوتياً، عشان
// نقدر نتجاهل فروق الكتابة (أ/إ/آ/ا، ة/ه، ى/ي) لما نقارن اسم الوكيل
// المكتوب في الإكسل باسمه المسجل فعلياً في النظام
function normalizeArabicForMatch(value: any): string {
  return normalizeDigitsText(value)
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(
        prevRow[j] + 1,      // حذف
        currRow[j - 1] + 1,  // إضافة
        prevRow[j - 1] + cost // استبدال
      ));
    }
    prevRow = currRow;
  }
  return prevRow[b.length];
}

function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = a.split(' ').filter(Boolean);
  const bTokens = b.split(' ').filter(Boolean);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  const intersection = [...aSet].filter((t) => bSet.has(t)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union ? intersection / union : 0;
}

function agentMatchScore(input: string, candidate: string): number {
  if (input === candidate) return 1;

  const editScore = similarityRatio(input, candidate);
  const tokensScore = tokenSimilarity(input, candidate);
  const containsScore =
    input.length >= 5 && candidate.length >= 5 && (input.includes(candidate) || candidate.includes(input))
      ? 0.92
      : 0;

  return Math.max(editScore, tokensScore * 0.96, containsScore);
}

export interface AgentMatchResult {
  agent: ImportAgent | null;
  suggestions: Array<ImportAgent & { matchScore?: number }>;
  confidence: number;
  matchType: 'exact' | 'suggestion' | 'none';
}

const FUZZY_SUGGESTION_THRESHOLD = 0.52;

// Similar names are suggestions only. Never assign policy ownership by similarity.
export function matchAgentName(inputName: string, agents: ImportAgent[]): AgentMatchResult {
  const normalizedInput = normalizeArabicForMatch(inputName);

  const exact = agents.filter((a) => normalizeArabicForMatch(a.name) === normalizedInput);
  if (exact.length === 1) return { agent: exact[0], suggestions: [], confidence: 1, matchType: 'exact' };

  const scored = agents
    .map((a) => ({
      agent: a,
      score: agentMatchScore(normalizedInput, normalizeArabicForMatch(a.name)),
    }))
    .sort((x, y) => y.score - x.score);

  const best = scored[0];
  const suggestions = scored
    .filter((item) => item.score >= FUZZY_SUGGESTION_THRESHOLD)
    .slice(0, 5)
    .map((item) => ({ ...item.agent, matchScore: item.score }));

  return {
    agent: null,
    suggestions,
    confidence: best?.score ?? 0,
    matchType: suggestions.length ? 'suggestion' : 'none',
  };
}

// ===================================================================
// 2) قراءة وتحقق ملف Excel المرفوع
// ===================================================================

const POLICY_TYPE_REVERSE = buildReverseMap(POLICY_TYPE_LABELS);
const PAYMENT_METHOD_REVERSE = buildReverseMap(PAYMENT_METHOD_LABELS);
const MARITAL_STATUS_REVERSE = buildReverseMap(MARITAL_STATUS_LABELS);

const MARITAL_STATUS_ALIASES: Record<string, string> = {
  'اعزب': 'single',
  'أعزب': 'single',
  'عزباء': 'single',
  'غير متزوج': 'single',
  'غير متزوجه': 'single',
  'متزوج': 'married',
  'متزوجة': 'married',
  'متزوجه': 'married',
  'متزوج / ة': 'married',
  'مطلق': 'divorced',
  'مطلقة': 'divorced',
  'مطلقه': 'divorced',
  'ارمل': 'widowed',
  'أرمل': 'widowed',
  'ارملة': 'widowed',
  'أرملة': 'widowed',
  'ارمله': 'widowed',
};
Object.entries(MARITAL_STATUS_ALIASES).forEach(([alias, code]) => {
  MARITAL_STATUS_REVERSE.set(normalizeLookupText(alias), code);
});

// أسماء شائعة لنوع الوثيقة كما تظهر عادةً في كشوف شركات التأمين.
// القيمة التي تُحفظ تظل دائماً الكود الرسمي الموجود في POLICY_TYPE_LABELS.
const POLICY_TYPE_ALIASES: Record<string, string> = {
  'رباعية': 'quadruple',
  'رباعي': 'quadruple',
  'الرباعي': 'quadruple',
  'حمايه واستثمار': 'protection_investment',
  'حماية و استثمار': 'protection_investment',
  'مختلطة': 'mixed',
  'المختلط': 'mixed',
  'اقساط': 'installments',
  'قسط': 'installments',
  'تقسيط': 'installments',
  'ذو اقساط': 'installments',
  'معاش و اطمئنان': 'pension_peace',
};
Object.entries(POLICY_TYPE_ALIASES).forEach(([alias, code]) => {
  POLICY_TYPE_REVERSE.set(normalizeLookupText(alias), code);
});

interface DateNativeOverrides {
  birth_date?: any;
  start_date?: any;
}

// منطق التحقق/البناء الخاص بصف واحد — دالة واحدة مشتركة تُستخدم مرتين:
// 1) أثناء تحليل الملف لأول مرة (parseWorkbookFile)
// 2) بعد ما المستخدم يعدّل أي خلية يدوياً في شاشة المعاينة (revalidateRow)،
// عشان نتأكد إن نفس قواعد التحقق مطبّقة بالظبط في الحالتين من غير تكرار كود
export function buildParsedRow(
  rowNumber: number,
  raw: Record<string, any>,
  agents: ImportAgent[],
  nativeDates: DateNativeOverrides = {}
): ParsedRow {
  raw = { ...raw };
  const get = (key: ImportColumnKey) => raw[key];
  const errors: string[] = [];

  const customerName = normalizeText(get('customer_name'));
  if (!customerName) errors.push('اسم العميل مطلوب');
  else if (!/[\p{L}]/u.test(customerName)) errors.push('اسم العميل يجب أن يكون اسم شخص، وليس رقمًا');

  const agentNameInput = normalizeText(get('agent_name'));
  let agentName = agentNameInput;
  let agentId: string | null = null;
  if (!agentNameInput) {
    errors.push('اسم الوكيل مطلوب');
  } else if (agents.length > 0) {
    // عندنا قائمة فريق المستورِد فعلاً → نطابق محلياً بدل ما ننتظر رفض
    // السيرفر لكل صف. لو الاسم مطابق (حتى مع فروق تشكيل/همزة بسيطة)،
    // بنستبدله باسمه الرسمي المسجّل في النظام لضمان نجاح المطابقة الصارمة
    // في import_policy_row
    const chosen = agents.find(agent => agent.id === raw.__agent_id && normalizeArabicForMatch(agent.name) === normalizeArabicForMatch(agentNameInput));
    const { agent, suggestions } = chosen ? { agent: chosen, suggestions: [] } : matchAgentName(agentNameInput, agents);
    if (agent) {
      agentName = agent.name;
      agentId = agent.id;
      raw.agent_name = agent.name;
    } else if (suggestions.length > 0) {
      errors.push(`تعذر تأكيد اسم الوكيل "${agentNameInput}". اختر الوكيل الصحيح من القائمة: ${suggestions.map((item) => item.name).join('، ')}`);
    } else {
      errors.push(`اسم الوكيل "${agentNameInput}" غير موجود ضمن الوكلاء النشطين المسموحين لك`);
    }
  }
  // لو مفيش قائمة وكلاء متاحة (فشل الجلب)، نتجاوز التحقق المحلي بالكامل
  // ونسيب المطابقة النهائية للسيرفر زي السلوك القديم تماماً

  for (const key of ['national_id', 'phone'] as const) {
    const value = get(key);
    if (!normalizeText(value)) continue;
    const checked = validateExtractedValue({ name: key, label: key, inputType: 'text', required: false }, value);
    if (checked.error) errors.push(`${key === 'national_id' ? 'الرقم القومي' : 'الهاتف'}: ${checked.error}`);
    else raw[key] = checked.value;
  }
  const policyNumber = normalizeDigitsText(get('policy_number'));
  if (!policyNumber) errors.push('رقم الوثيقة مطلوب');

  const policyTypeInput = normalizeText(get('policy_type'));
  const policyType = policyTypeInput ? POLICY_TYPE_REVERSE.get(normalizeLookupText(policyTypeInput)) : undefined;
  if (!policyTypeInput) errors.push('نوع الوثيقة مطلوب');
  else if (!policyType) errors.push(`نوع الوثيقة غير معروف: "${policyTypeInput}"`);

  const paymentMethodInput = normalizeText(get('payment_method'));
  const paymentMethod = paymentMethodInput ? PAYMENT_METHOD_REVERSE.get(normalizeLookupText(paymentMethodInput)) : undefined;
  if (!paymentMethodInput) errors.push('طريقة السداد مطلوبة');
  else if (!paymentMethod) errors.push(`طريقة السداد غير معروفة: "${paymentMethodInput}"`);

  const sumAssuredCell = get('sum_assured');
  const sumAssured = parseFlexibleNumber(sumAssuredCell);
  if (sumAssuredCell === '' || sumAssuredCell === null || sumAssuredCell === undefined) errors.push('مبلغ التأمين مطلوب');
  else if (sumAssured === null || sumAssured <= 0) errors.push('مبلغ التأمين غير صحيح');

  const premiumCell = get('premium_amount');
  const premiumAmount = parseFlexibleNumber(premiumCell);
  if (premiumCell === '' || premiumCell === null || premiumCell === undefined) {
    errors.push('قيمة القسط الصافي مطلوبة');
  } else if (premiumAmount === null || premiumAmount <= 0) {
    errors.push('قيمة القسط الصافي غير صحيحة');
  }

  const startDate = parseFlexibleDate(nativeDates.start_date !== undefined ? nativeDates.start_date : get('start_date'));
  if (!normalizeText(get('start_date'))) errors.push('تاريخ بداية التأمين مطلوب');
  else if (!startDate) errors.push('تاريخ بداية التأمين غير صحيح');

  // اختياري: الحالة الاجتماعية
  const maritalStatusInput = normalizeText(get('marital_status'));
  let maritalStatus: string | undefined;
  if (maritalStatusInput) {
    maritalStatus = MARITAL_STATUS_REVERSE.get(normalizeLookupText(maritalStatusInput));
    if (!maritalStatus) errors.push(`الحالة الاجتماعية غير معروفة: "${maritalStatusInput}"`);
  }

  // اختياري: تاريخ الميلاد
  const birthDateInput = normalizeText(get('birth_date'));
  let birthDate: Date | null = null;
  if (birthDateInput) {
    birthDate = parseFlexibleDate(nativeDates.birth_date !== undefined ? nativeDates.birth_date : get('birth_date'));
    if (!birthDate) errors.push('تاريخ الميلاد غير صحيح');
  }

  const identityBirth = nationalIdBirthDate(normalizeDigitsText(get('national_id')));
  if (birthDate && identityBirth && dateToDbString(birthDate) !== identityBirth) errors.push('تاريخ الميلاد لا يطابق الرقم القومي؛ راجع القيمتين في المصدر');
  if (startDate) raw.start_date = dateToDbString(startDate);
  if (birthDate) raw.birth_date = dateToDbString(birthDate);
  const clientError = errors.length > 0 ? errors.join(' — ') : null;

  let payload: ImportRowPayload | null = null;
  if (!clientError && policyType && paymentMethod && startDate && sumAssured !== null && premiumAmount !== null) {
    payload = {
      p_customer_name: customerName,
      p_national_id: normalizeDigitsText(get('national_id')) || null,
      p_phone: normalizeDigitsText(get('phone')) || null,
      p_address: normalizeText(get('address')) || null,
      p_birth_date: birthDate ? dateToDbString(birthDate) : null,
      p_occupation: normalizeText(get('occupation')) || null,
      p_marital_status: maritalStatus || null,
      p_agent_name: agentName,
      p_agent_id: agentId,
      p_policy_number: policyNumber,
      p_policy_type: policyType,
      p_sum_assured: sumAssured,
      p_premium_amount: premiumAmount,
      p_payment_method: paymentMethod,
      p_start_date: dateToDbString(startDate),
      p_notes: normalizeText(get('notes')) || null,
    };
  }

  return { rowNumber, raw, payload, clientError };
}

// تُستدعى من واجهة المعاينة بعد ما المستخدم يعدّل أي خلية يدوياً في صف،
// عشان نعيد التحقق منه فوراً من غير الحاجة لإعادة رفع الملف كله من الأول
export function revalidateRow(row: ParsedRow, agents: ImportAgent[] = []): ParsedRow {
  const result = { ...buildParsedRow(row.rowNumber, { ...row.raw }, agents), review: row.review, sourceIssues: row.sourceIssues };
  const sourceErrors = Object.entries(row.sourceIssues ?? {}).filter(([key, issue]) => String(row.raw[key]) === issue.value).map(([, issue]) => issue.reason);
  if (sourceErrors.length) { result.clientError = [result.clientError, ...sourceErrors].filter(Boolean).join(' — '); result.payload = null; }
  return applyImportReview(result);
}

function buildReverseMap(labels: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  Object.entries(labels).forEach(([code, label]) => {
    map.set(normalizeLookupText(label), code);
    map.set(normalizeLookupText(code), code); // يسمح أيضاً بكتابة القيمة الإنجليزية للكود مباشرة
  });
  return map;
}

function normalizeText(value: any): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeLookupText(value: any): string {
  return normalizeText(value)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDigitsText(value: any): string {
  return toEnglishDigits(normalizeText(value));
}

function normalizeHeaderCell(value: any): string {
  // إزالة علامة "*" وأي مسافات زائدة عشان مطابقة العنوان تنجح حتى لو
  // المستخدم سايب علامة الإلزامية من النموذج كما هي
  return normalizeText(value).replace(/\*$/, '').trim();
}

function normalizeHeaderForMatch(value: any): string {
  return normalizeHeaderCell(value)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // التشكيل
    .replace(/[أإآٱ]/g, 'ا') // أشكال الألف والهمزة
    .replace(/[ى]/g, 'ي')
    .replace(/ابتداء|ابتدا|بدء/g, 'بداية') // صيغ شائعة لـ "بداية" التأمين
    .replace(/[ة]/g, 'ه') // التاء المربوطة/الهاء في عناوين الملفات
    .replace(/ـ/g, '') // التطويل
    .replace(/\s+/g, ' ')
    .trim().toLowerCase();
}

const IMPORT_HEADER_ALIASES: Partial<Record<ImportColumnKey, string[]>> = {
  customer_name: ['العميل', 'اسم المؤمن عليه', 'اسم المؤمن عليه بالكامل', 'client name', 'customer name', 'full name'],
  national_id: ['رقم قومي', 'الرقم القومى', 'الرقم القومي للمؤمن عليه', 'national id', 'national_id'],
  phone: ['التليفون', 'الهاتف', 'الموبايل', 'رقم الموبايل', 'mobile', 'phone', 'phone number'],
  address: ['عنوان العميل', 'محل الاقامة', 'محل الإقامة', 'address'],
  birth_date: ['تاريخ الميلاد', 'ميلاد', 'date of birth', 'dob'],
  occupation: ['الوظيفة', 'المهنه', 'وظيفة العميل', 'occupation', 'job'],
  marital_status: ['الحاله الاجتماعيه', 'الحالة الزوجية', 'marital status', 'status marital'],
  agent_name: ['الوكيل', 'اسم المندوب', 'المندوب', 'اسم المنتج', 'المنتج', 'agent', 'agent name'],
  policy_number: ['رقم البوليصة', 'رقم بوليصه', 'رقم الوثيقه', 'policy no', 'policy number', 'policy_number'],
  policy_type: ['نوع البوليصة', 'نوع الوثيقه', 'البرنامج', 'المنتج التأميني', 'policy type', 'plan'],
  sum_assured: ['مبلغ التامين', 'مبلغ التأمين الكلي', 'راس المال', 'رأس المال', 'sum assured', 'sum_assured'],
  premium_amount: ['القسط الصافي', 'صافي القسط', 'قيمة القسط', 'premium', 'net premium', 'premium amount'],
  payment_method: ['دورية السداد', 'طريقه السداد', 'طريقة الدفع', 'دورية الدفع', 'payment method', 'frequency'],
  start_date: ['تاريخ البدء', 'تاريخ السريان', 'تاريخ بداية الوثيقة', 'start date', 'effective date'],
  notes: ['ملاحظة', 'بيان', 'remarks', 'notes'],
};

function toEnglishDigits(value: string): string { return normalizeDigits(value); }
function parseFlexibleNumber(value: unknown): number | null { return readDecimal(value); }
function parseFlexibleDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const iso = readCalendarDate(`${parsed.y}-${parsed.m}-${parsed.d}`);
    return iso ? new Date(`${iso}T12:00:00`) : null;
  }
  const iso = readCalendarDate(value);
  return iso ? new Date(`${iso}T12:00:00`) : null;
}

function dateToDbString(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Review flags are persisted in checkpoints, and are also enforced at the send boundary. */
export function applyImportReview(row: ParsedRow): ParsedRow {
  if (row.review && !row.review.confirmed) return { ...row, payload: null,
    clientError: [row.clientError, row.review.source === 'columns' ? 'راجع توزيع الأعمدة واعتمده أولًا' : 'راجع بيانات المستند ومصدر كل خانة ثم اعتمد الصف'].filter(Boolean).join(' — ') };
  return row;
}

export function validateFileDuplicates(rows: ParsedRow[]): ParsedRow[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const key = normalizeDigitsText(row.raw.policy_number).toLowerCase();
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const issues = new Map([...groups].filter(([, group]) => group.length > 1).map(([key, group]) => [key, `رقم الوثيقة مكرر داخل الملف (الصفوف: ${group.slice(0, 10).map(item => item.rowNumber).join('، ')}${group.length > 10 ? `، و${group.length - 10} صفوف أخرى` : ''})`]));
  return rows.map(row => {
    const issue = issues.get(normalizeDigitsText(row.raw.policy_number).toLowerCase());
    if (!issue) return row;
    return { ...row, payload: null, clientError: [row.clientError, issue].filter(Boolean).join(' — ') };
  });
}

export interface ParseResult {
  rows: ParsedRow[];
  headerError: string | null;
  usedAIMapping?: boolean;
  aiCapacityExhausted?: boolean;
  columnReview?: ImportColumnReview;
}
export interface WorkbookMappingOptions { columnMapping: ImportColumnReview['mapping']; sheetName: string; headerRowNumber: number }

function aliasIndices(headers: string[], key: ImportColumnKey): number[] {
  const aliases = [key, IMPORT_COLUMNS.find(column => column.key === key)?.header, ...(IMPORT_HEADER_ALIASES[key] ?? [])].filter(Boolean).map(normalizeHeaderForMatch);
  return headers.flatMap((header, index) => aliases.includes(normalizeHeaderForMatch(header)) ? [index] : []);
}
function netPremiumIndices(headers: string[]): number[] {
  return headers.flatMap((header, index) => {
    const text = normalizeHeaderForMatch(header);
    return /قسط|premium/.test(text) && /صافي|net/.test(text) && !/تاريخ|عدد|اجمالي|مجموع|سنوي|مسدد|مدفوع|متبقي|date|count|total|paid|balance/.test(text) ? [index] : [];
  });
}

export async function parseWorkbookFile(file: File, agents: ImportAgent[] = [], options?: WorkbookMappingOptions): Promise<ParseResult> {
  if (!IMPORT_FILE_EXTENSION_RE.test(file.name)) return { rows: [], headerError: 'نوع الملف غير مسموح. استخدم Excel أو CSV فقط.' };
  if (file.size > MAX_IMPORT_FILE_BYTES) return { rows: [], headerError: 'حجم الملف كبير جداً. الحد الأقصى المسموح به 10 ميجابايت.' };
  const workbook = /\.csv$/i.test(file.name)
    ? XLSX.read(await file.text(), { type: 'string', raw: true, cellDates: true, cellNF: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellNF: true });
  if (workbook.SheetNames.length > MAX_IMPORT_SHEETS) return { rows: [], headerError: `عدد أوراق الملف يتجاوز الحد المسموح (${MAX_IMPORT_SHEETS}).` };
  // Detect a header below a title, or on the data sheet after an instructions sheet.
  const candidates = workbook.SheetNames.flatMap(sheetName => {
    const values: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '', blankrows: true });
    return values.slice(0, 25).map((row, index) => ({ sheetName, index, values, score: IMPORT_COLUMNS.reduce((score, column) => score + (aliasIndices(row.map(normalizeHeaderCell), column.key).length ? column.required ? 3 : 1 : 0), 0) }));
  }).sort((a, b) => b.score - a.score);
  const candidate = options ? candidates.find(item => item.sheetName === options.sheetName && item.index === options.headerRowNumber - 1) : candidates[0];
  if (!candidate) return { rows: [], headerError: 'الملف لا يحتوي على ورقة بيانات واضحة' };
  const { sheetName, index: headerIndex, values: formatted } = candidate;
  if (formatted.length - headerIndex - 1 > MAX_IMPORT_ROWS) return { rows: [], headerError: `عدد الصفوف يتجاوز الحد المسموح (${MAX_IMPORT_ROWS}).` };
  const headers = (formatted[headerIndex] ?? []).map(normalizeHeaderCell);
  if (!headers.some(Boolean)) return { rows: [], headerError: 'الملف فارغ' };
  const mapping: ImportColumnReview['mapping'] = {};
  const warnings: string[] = [];
  for (const column of IMPORT_COLUMNS) {
    const indices = column.key === 'premium_amount' && netPremiumIndices(headers).length ? netPremiumIndices(headers) : aliasIndices(headers, column.key);
    if (indices.length === 1) mapping[column.key] = indices[0];
    else if (indices.length > 1) warnings.push(`أكثر من عمود يناسب «${column.header}»؛ اختر المصدر بنفسك`);
  }
  const samples = formatted.slice(headerIndex + 1).filter(row => row.some(cell => normalizeText(cell))).slice(0, 5).map(row => headers.map((_, i) => normalizeText(row[i])));
  let usedAIMapping = false;
  let aiFailureType: string | undefined;
  if (options) {
    for (const column of IMPORT_COLUMNS) mapping[column.key] = options.columnMapping[column.key] ?? null;
  } else if (IMPORT_COLUMNS.some(column => column.required && mapping[column.key] == null)) {
    const attempt = await matchColumnsWithAI(headers, samples);
    aiFailureType = attempt.failureType;
    const occupied = new Set(Object.values(mapping));
    for (const column of IMPORT_COLUMNS) {
      if (mapping[column.key] != null || !attempt.mapping?.[column.key]) continue;
      const matches = headers.flatMap((header, index) => header === attempt.mapping?.[column.key] ? [index] : []);
      const chosen = matches.length === 1 ? matches[0] : null;
      if (chosen !== null && !occupied.has(chosen)) { mapping[column.key] = chosen; occupied.add(chosen); usedAIMapping = true; }
    }
  }
  const premiumIndex = mapping.premium_amount;
  if (!options && premiumIndex != null && !netPremiumIndices(headers).includes(premiumIndex)) warnings.push('عنوان القسط لا يثبت أنه القسط الصافي لكل دفعة؛ راجع العمود قبل اعتماده');
  const used = new Map<number, string>();
  const issues: string[] = [];
  for (const column of IMPORT_COLUMNS) {
    const index = mapping[column.key];
    if (index == null) { if (column.required) issues.push(`اختر عمود «${column.header}»`); continue; }
    if (!Number.isInteger(index) || index < 0 || index >= headers.length) { issues.push(`مصدر «${column.header}» غير صالح`); continue; }
    if (used.has(index)) issues.push(`العمود «${headers[index]}» مستخدم لأكثر من خانة`);
    used.set(index, column.key);
  }
  const review: ImportColumnReview = { headers, samples, mapping, warnings: options ? [] : warnings, sheetName, headerRowNumber: headerIndex + 1, needsConfirmation: !options && (usedAIMapping || warnings.length > 0 || issues.length > 0) };
  if (issues.length) return { rows: [], headerError: issues.join(' — '), usedAIMapping, columnReview: review, aiCapacityExhausted: aiFailureType === 'capacity_exhausted' || aiFailureType === 'gateway_rate_limited' };
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '', blankrows: true });
  const rows: ParsedRow[] = [];
  for (let index = headerIndex + 1; index < formatted.length; index++) {
    if (!formatted[index].some(cell => normalizeText(cell))) continue;
    const raw: Record<string, unknown> = {};
    const sourceIssues: NonNullable<ParsedRow['sourceIssues']> = {};
    for (const column of IMPORT_COLUMNS) {
      const source = mapping[column.key];
      const native = source == null ? '' : rawRows[index]?.[source];
      const display = source == null ? '' : formatted[index]?.[source];
      // Native numeric cells are authoritative; display formatting must not change a monetary value.
      raw[column.key] = ['national_id', 'phone', 'policy_number'].includes(column.key) && typeof native === 'number' ? String(native) : ['premium_amount', 'sum_assured'].includes(column.key) && typeof native === 'number' ? native : display;
      const format = source == null ? '' : workbook.Sheets[sheetName][XLSX.utils.encode_cell({ r: index, c: source })]?.z;
      if (['premium_amount', 'sum_assured'].includes(column.key) && typeof format === 'string' && format.includes('%')) sourceIssues[column.key] = { value: String(raw[column.key]), reason: `«${column.header}» خلية نسبة مئوية وليست مبلغًا؛ أدخل المبلغ الصحيح من المصدر` };
      if (['national_id', 'phone', 'policy_number'].includes(column.key) && (typeof native === 'number' && (!Number.isSafeInteger(native) || Math.abs(native) >= 1e15) || /^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(String(raw[column.key])))) sourceIssues[column.key] = { value: String(raw[column.key]), reason: `«${column.header}» مخزّن كرقم غير دقيق أو صيغة علمية؛ أعد إدخاله من المصدر كنص` };
    }
    const amount = readDecimal(raw.premium_amount);
    // Keep the existing import-only truncation rule. Only the source selection changed.
    if (amount !== null) raw.premium_amount = Math.trunc(amount);
    if (sourceIssues.premium_amount) sourceIssues.premium_amount.value = String(raw.premium_amount);
    const native = (key: ImportColumnKey) => mapping[key] == null ? undefined : rawRows[index]?.[mapping[key]!];
    const row = buildParsedRow(index + 1, raw, agents, { start_date: native('start_date'), birth_date: native('birth_date') });
    if (review.needsConfirmation) row.review = { source: 'columns', confirmed: false };
    row.sourceIssues = sourceIssues;
    rows.push(revalidateRow(row, agents));
  }
  return { rows: validateFileDuplicates(rows), headerError: null, usedAIMapping, columnReview: review };
}

// ===================================================================
// 4) تصدير تقرير الأخطاء بعد الاستيراد كملف Excel — يسهّل تصحيح الصفوف
//    الفاشلة بره الشاشة (مشاركته مع حد تاني، أو مقارنته بالملف الأصلي)
// ===================================================================
export function exportErrorReport(summary: ImportSummary) {
  const failedRows = summary.results.filter((r) => r.status === 'error');
  if (failedRows.length === 0) return;

  const headers = ['رقم الصف', 'اسم العميل', 'رقم الوثيقة', 'سبب الفشل'];
  const dataRows = failedRows.map((r) => [
    r.rowNumber,
    safeSpreadsheetText(r.customerName),
    safeSpreadsheetText(r.policyNumber),
    safeSpreadsheetText(r.errorMessage)
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  sheet['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'أخطاء الاستيراد');
  XLSX.writeFile(wb, 'تقرير-أخطاء-الاستيراد.xlsx');
}

// ===================================================================
// 5) تنفيذ الاستيراد — Pool من عدة Workers متوازية (بدل صف واحد في المرة)
//    كل صف = Transaction مستقلة تماماً في الخادم (import_policy_row بتعمل
//    INSERT جديد للعميل + الوثيقة في كل استدعاء، وأي تعارض زي رقم وثيقة أو
//    رقم قومي مكرر بيتضبط بقيد UNIQUE في قاعدة البيانات نفسها بغض النظر عن
//    ترتيب/توقيت الاستدعاءات)، فتشغيلها بالتوازي آمن تماماً ومفيهوش خطر
//    تضارب بيانات، وبيقلل زمن الاستيراد الكلي بشكل كبير خصوصاً في الملفات
//    الكبيرة (الزمن أساساً هو زمن ذهاب/رجوع الشبكة لكل RPC، مش معالجة فعلية)
// ===================================================================
const IMPORT_CONCURRENCY = 5;

export interface ImportRowsResumeOptions {
  jobId?: string | null;
  completedRowNumbers?: Set<number>;
}

export async function importRows(
  rows: ParsedRow[],
  branchId: string | null,
  onRowDone: (result: RowResult, doneCount: number, totalCount: number) => void,
  resume: ImportRowsResumeOptions = {},
): Promise<ImportSummary> {
  rows = validateFileDuplicates(rows.map(row => row.review && !row.review.confirmed ? applyImportReview(row) : row));
  const completed = resume.completedRowNumbers || new Set<number>();
  const alreadyCompleted: RowResult[] = rows
    .filter((r) => completed.has(r.rowNumber))
    .map((r) => ({
      rowNumber: r.rowNumber,
      customerName: String(r.raw['customer_name'] || ''),
      policyNumber: String(r.raw['policy_number'] || ''),
      status: 'success' as const,
    }));

  const results: RowResult[] = [...alreadyCompleted];
  const rowsToProcess = rows.filter((r) => !completed.has(r.rowNumber) && r.payload !== null);
  const skippedAsErrors: RowResult[] = rows
    .filter((r) => !completed.has(r.rowNumber) && r.payload === null)
    .map((r) => ({
      rowNumber: r.rowNumber,
      customerName: normalizeText(r.raw['customer_name']),
      policyNumber: normalizeText(r.raw['policy_number']),
      status: 'error' as const,
      errorMessage: r.clientError || 'بيانات الصف غير صحيحة'
    }));

  results.push(...skippedAsErrors);

  let done = alreadyCompleted.length;
  const total = rows.length;
  skippedAsErrors.forEach((r) => onRowDone(r, ++done, total));

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < rowsToProcess.length) {
      const row = rowsToProcess[nextIndex++];
      const payload = row.payload!;
      try {
        const { error } = resume.jobId
          ? await supabase.rpc('import_policy_row_resumable', {
              p_job_id: resume.jobId,
              p_row_number: row.rowNumber,
              p_payload: payload,
              p_branch_id: branchId,
            })
          : await supabase.rpc('import_policy_row_v2', {
              ...payload,
              p_branch_id: branchId,
            });
        if (error) throw error;

        const result: RowResult = {
          rowNumber: row.rowNumber,
          customerName: payload.p_customer_name,
          policyNumber: payload.p_policy_number,
          status: 'success'
        };
        results.push(result);
        onRowDone(result, ++done, total);
      } catch (err: unknown) {
        const result: RowResult = {
          rowNumber: row.rowNumber,
          customerName: payload.p_customer_name,
          policyNumber: payload.p_policy_number,
          status: 'error',
          errorMessage: friendlyError(err, 'حدث خطأ غير متوقع أثناء استيراد هذا الصف')
        };
        results.push(result);
        onRowDone(result, ++done, total);
      }
    }
  }

  const workerCount = Math.min(IMPORT_CONCURRENCY, rowsToProcess.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  results.sort((a, b) => a.rowNumber - b.rowNumber);

  const importedCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'error').length;

  return { totalRows: rows.length, importedCount, failedCount, results };
}
