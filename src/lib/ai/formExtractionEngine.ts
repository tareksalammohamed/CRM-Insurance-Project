// المحرك العام لاستخراج بيانات النماذج من صورة/مستند بالذكاء الاصطناعي.
//
// هذا الملف يستخرج المنطق المشترك (بناء الـ prompt وفق حقول النموذج
// المكتشفة ديناميكياً، وتحليل رد النموذج، وتنقيته مقابل شكل الحقول الفعلي)
// من ميزة "استخراج بيانات العميل" (المرحلة الثانية) إلى مكان مركزي داخل
// منظومة الذكاء الاصطناعي (src/lib/ai)، حتى تستخدمه أي ميزة استخراج جديدة
// (مثل استخراج بيانات الوثيقة فى المرحلة الثالثة) دون تكرار نفس المنطق.
//
// ميزة استخراج بيانات العميل (customerDataExtraction) لم تُعدَّل ولا تزال
// تعمل بمنطقها الداخلي الأصلي دون أي تغيير — هذا الملف جديد بالكامل ولا
// يُستخدم حالياً إلا من ميزات جديدة.
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
  return `أنت مساعد يحلل صورة مستند بصرياً ويستخرج منه فقط قيم حقول محددة مسبقاً، لملء ${context.formPurpose} داخل نظام CRM لشركة تأمين.

قواعد إلزامية يجب الالتزام بها بدقة:
1. استخرج فقط قيم الحقول المذكورة فى قائمة "الحقول المطلوبة" أدناه. تجاهل تماماً أي معلومة أخرى موجودة فى المستند وغير مطلوبة، ولا تقم بأي استخراج عام (لا تُرجع كل النصوص الموجودة فى المستند).
2. إذا لم تجد قيمة واضحة لحقل معين داخل المستند، لا تُدرج هذا الحقل فى الناتج نهائياً، ولا تخترع أو تخمّن قيمة افتراضية له.
3. لكل قيمة تستخرجها حدد مستوى ثقة: "high" إذا كانت القيمة واضحة ومؤكدة من المستند، أو "low" إذا كانت غير واضحة تماماً أو استنتجتها بشكل غير مباشر.
4. للحقول من نوع select التزم فقط بإحدى القيم (value) المذكورة أمامها، ولا تُرجع التسمية (label) كقيمة.
5. رد بصيغة JSON فقط، بدون أي نص أو شرح قبله أو بعده وبدون Markdown، بالشكل التالي بالضبط:
{"fields": {"اسم_الحقل": {"value": "القيمة", "confidence": "high"}}}`;
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

/** يتجاهل أي حقل غير معروف أو قيمة غير متوافقة مع نوع الحقل الفعلي، حتى لو أخطأ النموذج فى الرد */
function sanitizeAgainstSchema(parsed: RawExtractionResponse, fields: DetectedFormField[]): ExtractionResult {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: ExtractionResult['fields'] = {};

  for (const [name, raw] of Object.entries(parsed.fields || {})) {
    const schema = byName.get(name);
    if (!schema || raw == null) continue;

    let value = typeof raw.value === 'string' ? raw.value.trim() : String(raw.value ?? '').trim();
    if (!value) continue;

    const confidence: FieldConfidence = raw.confidence === 'high' ? 'high' : 'low';

    if (schema.inputType === 'number') {
      const num = Number(value.replace(/[^\d.-]/g, ''));
      if (Number.isNaN(num)) continue;
      value = String(num);
    } else if (schema.inputType === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    } else if (schema.inputType === 'select') {
      const match = schema.options?.find((o) => o.value === value) || schema.options?.find((o) => o.label === value);
      if (!match) continue;
      value = match.value;
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
    { maxTokens: 1500, temperature: 0.1 }
  );

  if (!result.success || !result.content) {
    throw new Error(result.error || 'تعذر الاتصال بمنظومة الذكاء الاصطناعي حالياً، حاول مرة أخرى لاحقاً');
  }

  return sanitizeAgainstSchema(parseExtractionResponse(result.content), fields);
}
