// المحرك العام لاستخراج بيانات النماذج من صورة/مستند بالذكاء الاصطناعي.
//
// هذا الملف يستخرج المنطق المشترك (بناء الـ prompt وفق حقول النموذج
// المكتشفة ديناميكياً، وتحليل رد النموذج، وتنقيته مقابل شكل الحقول الفعلي)
// من ميزة "استخراج بيانات العميل" (المرحلة الثانية) إلى مكان مركزي داخل
// منظومة الذكاء الاصطناعي (src/lib/ai)، حتى تستخدمه أي ميزة استخراج جديدة
// (مثل استخراج بيانات الوثيقة فى المرحلة الثالثة) دون تكرار نفس المنطق.
//
// ميزة استخراج بيانات العميل (customerDataExtraction) أصبحت تستخدم هذا
// المحرك المركزي مباشرة (عبر غلاف رفيع فى customerExtractionService.ts)
// بدلاً من نسخة منطق قديمة مكررة — فأي تحسين هنا يسري على كل ميزات
// الاستخراج فى التطبيق تلقائياً.
//
// لا يوجد OCR تقليدي هنا: الصورة تُحلَّل بصرياً بواسطة نموذج الذكاء
// الاصطناعي عبر askAI (ai-gateway)، ويُطالَب صراحة بالاقتصار على الحقول
// الممرَّرة له فقط (المُكتشَفة ديناميكياً من النموذج الحالي المعروض)، وبعدم
// تخمين أي قيمة غير موجودة، وبتحديد مستوى ثقة لكل قيمة.

import { askAI, type AIContentPart } from './aiManager';
import type {
  DetectedFormField,
  ExtractionResult,
  FieldConfidence,
} from '../../features/customerDataExtraction/types';

export interface FormExtractionContext {
  /** وصف قصير لغرض النموذج/الشاشة الحالية، يُستخدم داخل الـ prompt فقط
   * (مثال: "نموذج إضافة عميل" أو "نموذج إصدار وثيقة تأمين") — لا يُستخدم
   * كقائمة حقول ثابتة، فالحقول نفسها تُمرَّر دائماً من الشاشة المستدعية بعد
   * اكتشافها ديناميكياً من الـ DOM. */
  formPurpose: string;
}

function describeField(field: DetectedFormField): string {
  let line = `- ${field.name} (${field.label})`;
  if (field.inputType === 'select' && field.options?.length) {
    line += ` — القيم المسموحة فقط: ${field.options.map((o) => `${o.value}="${o.label}"`).join(' | ')}`;
  } else if (field.inputType === 'date') {
    line += ' — التاريخ بصيغة YYYY-MM-DD فقط';
  } else if (field.inputType === 'number') {
    line += ' — رقم فقط، بدون فواصل أو رموز أو نص';
  }
  return line;
}

function buildSystemPrompt(context: FormExtractionContext): string {
  return `أنت خبير فى قراءة وتحليل المستندات العربية بصرياً (بطاقات الرقم القومي، الاستمارات، العقود، المستندات المكتوبة بخط اليد أو المطبوعة أو الممسوحة ضوئياً)، ومهمتك استخراج قيم حقول محددة مسبقاً فقط، لملء ${context.formPurpose} داخل نظام CRM لشركة تأمين.

قدراتك الأساسية:
- تقرأ خط اليد العربي والإنجليزي جيداً حتى لو كان غير واضح تماماً أو مائلاً أو متداخلاً — ابذل أقصى جهد فى فك خط اليد قبل أن تتخلى عن أي حقل.
- تفهم الأرقام العربية (٠١٢٣٤٥٦٧٨٩) والإنجليزية (0123456789) وتحوّلها دائماً إلى أرقام إنجليزية فى الناتج.
- تفهم التواريخ بأي صيغة مكتوبة (مثل 15/3/1990 أو ١٥-٣-١٩٩٠ أو 15 مارس 1990) وتحوّلها إلى YYYY-MM-DD.
- تعرف أن الرقم القومي المصري 14 رقماً، وأن أول 7 أرقام منه تشير لتاريخ الميلاد (رقم القرن ثم سنة/شهر/يوم): إذا وجدت رقماً قومياً واضحاً وكان "تاريخ الميلاد" ضمن الحقول المطلوبة ولم يُذكر صراحة فى المستند، استنتجه من الرقم القومي بثقة "low".

قواعد إلزامية يجب الالتزام بها بدقة:
1. استخرج فقط قيم الحقول المذكورة فى قائمة "الحقول المطلوبة" أدناه. تجاهل تماماً أي معلومة أخرى موجودة فى المستند وغير مطلوبة، ولا تقم بأي استخراج عام (لا تُرجع كل النصوص الموجودة فى المستند).
2. الاستخراج الجزئي طبيعي ومطلوب: املأ فقط الحقول التى وجدت لها قيمة فى المستند واترك الباقي — لا تُدرج أي حقل لم تجد له قيمة، ولا تخترع أو تخمّن قيمة افتراضية له أبداً، ولا تعتبر نقص بعض الحقول فشلاً.
3. لكل قيمة تستخرجها حدد مستوى ثقة: "high" إذا كانت القيمة واضحة ومؤكدة من المستند، أو "low" إذا كانت مكتوبة بخط يد صعب القراءة أو غير واضحة أو استنتجتها بشكل غير مباشر — استخدم "low" بدل حذف الحقل عندما تستطيع قراءته باحتمال معقول.
4. للحقول من نوع select التزم فقط بإحدى القيم (value) المذكورة أمامها، ولا تُرجع التسمية (label) كقيمة. اختر الأقرب معنىً لما هو مكتوب فى المستند (مثلاً "متزوج" أو "متزوجة" كلاهما يطابق حالة "متزوج").
5. رد بصيغة JSON فقط، بدون أي نص أو شرح قبله أو بعده وبدون Markdown، بالشكل التالي بالضبط:
{"fields": {"اسم_الحقل": {"value": "القيمة", "confidence": "high"}}}
6. إذا لم تجد أي حقل مطلوب على الإطلاق فى المستند، رد بـ {"fields": {}} فقط.`;
}

interface RawExtractionResponse {
  fields?: Record<string, { value?: unknown; confidence?: unknown }>;
}

function extractFirstJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('json-start');

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  throw new Error('json-end');
}

function parseExtractionResponse(raw: string): RawExtractionResponse {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const candidates = [cleaned];
  try {
    const extracted = extractFirstJsonObject(cleaned);
    if (extracted !== cleaned) candidates.push(extracted);
  } catch {
    // سيظهر الخطأ الموحد أسفل الدالة إذا لم نجد JSON صالحاً.
  }

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate) as RawExtractionResponse;
      if (data && typeof data === 'object' && typeof data.fields === 'object' && data.fields !== null) {
        return data;
      }
    } catch {
      // نجرب المرشح التالي، لأن بعض النماذج تضيف نصاً خارج JSON.
    }
  }

  throw new Error('تعذر فهم استجابة الذكاء الاصطناعي، حاول مرة أخرى');
}

// تحويل الأرقام العربية (٠١٢٣٤٥٦٧٨٩) والفارسية (۰۱۲۳۴۵۶۷۸۹) إلى إنجليزية —
// كثير من المستندات المصرية (خصوصاً بطاقات الرقم القومي والمكتوبة بخط اليد)
// تستخدم الأرقام العربية، وكان المنطق القديم يرفض قيمها بالكامل.
function normalizeDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

// محاولة تطبيع تاريخ بأي صيغة شائعة إلى YYYY-MM-DD بدل رفضه بالكامل —
// النماذج أحياناً تعيد التاريخ بصيغة DD/MM/YYYY أو DD-MM-YYYY أو بأرقام
// عربية رغم تعليمات الـ prompt، وكان المنطق القديم يتجاهل الحقل عندها.
function normalizeDateValue(raw: string): string | null {
  const value = normalizeDigits(raw).trim();

  // الصيغة المطلوبة جاهزة بالفعل
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return buildIsoDate(y, m, d);
  }

  // صيغة يوم/شهر/سنة الشائعة فى المستندات المصرية
  const dmyMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return buildIsoDate(y, m, d);
  }

  return null;
}

function buildIsoDate(y: string, m: string, d: string): string | null {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// مطابقة مرنة لقيم select: تطابق تام بالقيمة أو التسمية أولاً، ثم مطابقة
// جزئية بعد إزالة "ال" التعريف والمسافات الزائدة — النماذج أحياناً تعيد
// "متزوجة" بدل "متزوج" أو "شهريا" بدل "شهري"، وكان المنطق القديم يرفضها.
function matchSelectOption(
  options: { value: string; label: string }[] | undefined,
  rawValue: string
): string | null {
  if (!options?.length) return null;

  const exact = options.find((o) => o.value === rawValue) || options.find((o) => o.label === rawValue);
  if (exact) return exact.value;

  const normalize = (s: string) =>
    s.trim().replace(/^ال/, '').replace(/[ةه]$/, '').replace(/\s+/g, ' ').toLowerCase();

  const target = normalize(rawValue);
  if (!target) return null;

  const fuzzy = options.find(
    (o) =>
      normalize(o.value) === target ||
      normalize(o.label) === target ||
      normalize(o.label).startsWith(target) ||
      target.startsWith(normalize(o.label))
  );
  return fuzzy ? fuzzy.value : null;
}

/** يتجاهل أي حقل غير معروف أو قيمة غير متوافقة مع نوع الحقل الفعلي، حتى لو أخطأ النموذج فى الرد */
function sanitizeAgainstSchema(parsed: RawExtractionResponse, fields: DetectedFormField[]): ExtractionResult {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: ExtractionResult['fields'] = {};

  for (const [name, raw] of Object.entries(parsed.fields || {})) {
    const schema = byName.get(name);
    if (!schema || raw == null) continue;

    let value = typeof raw.value === 'string' ? raw.value.trim() : String(raw.value ?? '').trim();
    if (!value || value === 'null' || value === 'undefined') continue;

    let confidence: FieldConfidence = raw.confidence === 'high' ? 'high' : 'low';

    if (schema.inputType === 'number') {
      const num = Number(normalizeDigits(value).replace(/[^\d.-]/g, ''));
      if (Number.isNaN(num)) continue;
      value = String(num);
    } else if (schema.inputType === 'date') {
      const normalized = normalizeDateValue(value);
      if (!normalized) continue;
      // لو احتجنا نطبّع صيغة التاريخ بأنفسنا (النموذج لم يلتزم بالصيغة
      // المطلوبة)، ننزل الثقة لـ low حتى يراجعها المستخدم قبل الحفظ.
      if (normalized !== value) confidence = 'low';
      value = normalized;
    } else if (schema.inputType === 'select') {
      const matched = matchSelectOption(schema.options, value);
      if (!matched) continue;
      if (matched !== value) confidence = 'low';
      value = matched;
    } else {
      // للحقول النصية: تطبيع الأرقام العربية فى القيم الرقمية بطبيعتها
      // (الرقم القومي / الهاتف) — يُكتشف تلقائياً لو القيمة كلها أرقام.
      const digitsNormalized = normalizeDigits(value);
      if (/^[\d\s+-]+$/.test(digitsNormalized)) value = digitsNormalized.replace(/\s+/g, '');
    }

    out[name] = { value, confidence };
  }

  return { fields: out };
}

/** يستخرج فقط قيم الحقول الممرَّرة من صورة/صور المستند المختار، عبر منظومة الذكاء الاصطناعي المركزية (askAI) */
export async function extractFormDataFromDocument(
  images: string[],
  fields: DetectedFormField[],
  context: FormExtractionContext
): Promise<ExtractionResult> {
  if (images.length === 0) {
    throw new Error('لم يتم اختيار أي صورة أو مستند');
  }
  if (fields.length === 0) {
    throw new Error('تعذر التعرف على حقول النموذج الحالي');
  }

  const userContent: AIContentPart[] = [
    { type: 'text', text: `الحقول المطلوبة فقط:\n${fields.map(describeField).join('\n')}` },
    ...images.map((url): AIContentPart => ({ type: 'image_url', image_url: { url } })),
  ];

  const result = await askAI(
    [
      { role: 'system', content: buildSystemPrompt(context) },
      { role: 'user', content: userContent },
    ],
    // preferVision: المستندات كثيراً ما تكون بخط اليد، والـ OCR التقليدي ضعيف
    // معه — نطلب من الـ Gateway إرسال الصور مباشرة لنموذج رؤية (Vision) إن توفر.
    { maxTokens: 1500, temperature: 0.1, preferVision: true }
  );

  if (!result.success || !result.content) {
    throw new Error(result.error || 'تعذر الاتصال بمنظومة الذكاء الاصطناعي حالياً، حاول مرة أخرى لاحقاً');
  }

  return sanitizeAgainstSchema(parseExtractionResponse(result.content), fields);
}
