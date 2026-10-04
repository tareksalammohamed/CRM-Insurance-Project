// ===================================================================
// طبقة تحسين اختيارية (Layer 2) — استخراج صفوف بيانات من ملف PDF أو صورة
// باستخدام الذكاء الاصطناعي (تحليل بصري)، لملفات لا يمكن للطبقة الأولى
// (Primary Import Engine) قراءتها أصلاً لأنها ليست جداول بيانات (Excel/CSV).
//
// هذا الملف لا يستبدل أي شيء فى النظام الحالي — الطبقة الأولى لم تكن تدعم
// PDF/الصور من الأساس، فهذه قدرة إضافية بحتة تعمل فقط لما يكون الذكاء
// الاصطناعي متاحاً. لو فشل أو كان غير متاح، لا يوجد "نظام حالي" نرجع له
// لهذا النوع من الملفات تحديداً، فنُرجع رسالة خطأ واضحة للمستخدم تطلب منه
// استخدام ملف Excel/CSV بدلاً من ذلك، دون أي محاولة استيراد جزئي أو تخمين.
//
// إعادة استخدام الكود:
// - تحويل PDF/الصورة لصور (Data URL) يُعاد استخدامه بالكامل من
//   documentToImages.ts (ميزة استخراج بيانات العميل الحالية)، دون تكرار.
// - التحقق من صحة كل صف بعد الاستخراج يُعاد استخدامه بالكامل من
//   buildParsedRow فى dataImportService.ts — نفس قواعد التحقق ومطابقة
//   اسم الوكيل ونوع الوثيقة وطريقة السداد بالضبط المستخدمة مع ملفات
//   Excel/CSV، بدون أي تكرار للمنطق.
// ===================================================================

import { askAI, type AIContentPart } from '../../../lib/ai/aiManager';
import { documentFileToImagesWithMeta, type ExtractionFileKind } from '../../../features/customerDataExtraction/utils/documentToImages';
import { POLICY_TYPE_LABELS, PAYMENT_METHOD_LABELS, MARITAL_STATUS_LABELS } from '../../../lib/supabase';
import { IMPORT_COLUMNS, type ParsedRow } from '../types';
import { buildParsedRow, type ImportAgent } from './dataImportService';
import { FIELD_DESCRIPTIONS } from './aiColumnMatcher';

const PDF_EXTENSION_RE = /\.pdf$/i;
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp)$/i;

export function detectDocumentKind(file: File): ExtractionFileKind | null {
  if (PDF_EXTENSION_RE.test(file.name)) return 'pdf';
  if (IMAGE_EXTENSION_RE.test(file.name)) return 'image';
  return null;
}

function buildSystemPrompt(): string {
  const fieldsList = IMPORT_COLUMNS.map(
    (c) => `- ${c.key}: ${FIELD_DESCRIPTIONS[c.key]}${c.required ? ' (إلزامي)' : ' (اختياري)'}`
  ).join('\n');

  return `أنت مساعد يستخرج بيانات عملاء ووثائق تأمين من صورة أو مستند ممسوح ضوئياً (قد يكون جدول، كشف، أو استمارة)، بغرض استيرادها إلى نظام CRM لشركة تأمين.

قد يحتوي المستند على سجل واحد أو عدة سجلات (صفوف). استخرج كل سجل موجود فعلياً فى المستند كصف مستقل.

حقول كل سجل:
${fieldsList}

القيم المسموحة فقط لحقل policy_type: ${Object.values(POLICY_TYPE_LABELS).join('، ')}
القيم المسموحة فقط لحقل payment_method: ${Object.values(PAYMENT_METHOD_LABELS).join('، ')}
القيم المسموحة فقط لحقل marital_status (اختياري): ${Object.values(MARITAL_STATUS_LABELS).join('، ')}

قواعد إلزامية يجب الالتزام بها بدقة:
1. استخرج فقط القيم الموجودة فعلياً وبوضوح فى المستند. لا تخترع أو تخمّن أي قيمة غير موجودة.
2. إذا لم تجد قيمة واضحة لحقل معين فى سجل ما، لا تُدرج هذا الحقل فى ناتج ذلك السجل نهائياً.
3. حوّل كل تاريخ تجده إلى صيغة YYYY-MM-DD إن أمكن.
4. للحقلين policy_type وpayment_method، التزم فقط بإحدى القيم المذكورة أعلاه بالضبط كما وردت (وليس مرادفاً لها).
5. اجمع سجلات كل صفحات المستند المُرسَلة فى ناتج واحد.
6. رد بصيغة JSON فقط، بدون أي نص أو شرح قبله أو بعده وبدون Markdown، بالشكل التالى بالضبط:
{"rows": [{"customer_name": "...", "policy_number": "...", "...": "..."}]}`;
}

interface RawExtractionResponse {
  rows?: Array<Record<string, unknown>>;
}

function parseExtractionResponse(raw: string): RawExtractionResponse {
  const cleaned = raw.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const data = JSON.parse(cleaned);
  if (!data || typeof data !== 'object' || !Array.isArray(data.rows)) {
    throw new Error('shape');
  }
  return data as RawExtractionResponse;
}

/** يحوّل صف مُستخرَج (مفاتيحه غير موثوقة) إلى raw مطابق لأعمدة النظام فقط، متجاهلاً أي مفتاح غير معروف */
function sanitizeExtractedRow(raw: Record<string, unknown>): Record<string, any> {
  const out: Record<string, any> = {};
  IMPORT_COLUMNS.forEach((col) => {
    const value = raw[col.key];
    if (value === undefined || value === null) return;
    out[col.key] = typeof value === 'string' ? value.trim() : value;
  });
  return out;
}

export interface DocumentExtractionProgress {
  processedPages: number;
  totalPages: number;
  extractedRows: number;
  provider?: string;
  model?: string;
}

export interface DocumentExtractionResult {
  rows: ParsedRow[];
  error: string | null;
  partial: boolean;
  capacityExhausted: boolean;
  processedPages: number;
  totalPages: number;
  retryAfterSeconds?: number;
}

const UNAVAILABLE_MESSAGE =
  'تعذر استخراج البيانات من هذا الملف حالياً لأن منظومة الذكاء الاصطناعي غير متاحة. يمكنك استخدام Excel/CSV أو إعادة المحاولة لاحقاً.';

/**
 * استخراج مرن على دفعات (صفحة بصفحة):
 * - كل صفحة طلب مستقل، والـ ai-gateway يتولى Model fallback ثم Provider fallback.
 * - نمرر للصفحة التالية أرقام الوثائق المستخرجة سابقاً حتى يحافظ أي نموذج
 *   بديل على نفس السياق ولا يكرر سجلات الصفحات السابقة.
 * - إذا استنفدت كل الحصص بعد إنجاز جزء من الملف، نرجع الجزء المنجز بدلاً
 *   من رميه، ليقدر المستخدم يراجعه ويستورده بأمان.
 */
export async function extractRowsFromDocument(
  file: File,
  kind: ExtractionFileKind,
  agents: ImportAgent[],
  onProgress?: (progress: DocumentExtractionProgress) => void,
): Promise<DocumentExtractionResult> {
  try {
    const { images, totalPages, truncated } = await documentFileToImagesWithMeta(file, kind, 12);
    const extractedRawRows: Array<Record<string, unknown>> = [];
    const seenPolicies = new Set<string>();
    let processedPages = 0;
    let lastRetryAfterSeconds: number | undefined;

    for (let pageIndex = 0; pageIndex < images.length; pageIndex++) {
      const priorPolicies = [...seenPolicies].slice(-80);
      const contextText = priorPolicies.length
        ? `تم استخراج أرقام الوثائق التالية من الصفحات السابقة، فلا تكررها إلا إذا كانت الصفحة الحالية تحتوي سجلاً مختلفاً بوضوح: ${priorPolicies.join('، ')}`
        : 'هذه أول صفحة/صورة يتم تحليلها.';

      const userContent: AIContentPart[] = [
        {
          type: 'text',
          text: `حلّل الصفحة ${pageIndex + 1} من ${totalPages}. استخرج كل السجلات الموجودة فى هذه الصفحة فقط وفق القواعد المذكورة. ${contextText}`,
        },
        { type: 'image_url', image_url: { url: images[pageIndex] } },
      ];

      const result = await askAI(
        [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userContent },
        ],
        { maxTokens: 4000, temperature: 0.1 }
      );

      if (!result.success || !result.content) {
        lastRetryAfterSeconds = result.retryAfterSeconds;
        const capacityExhausted =
          result.failureType === 'capacity_exhausted' ||
          result.failureType === 'gateway_rate_limited';

        if (extractedRawRows.length > 0) {
          const rows = extractedRawRows.map((extracted, idx) =>
            buildParsedRow(idx + 2, sanitizeExtractedRow(extracted), agents)
          );
          return {
            rows,
            error: null,
            partial: true,
            capacityExhausted,
            processedPages,
            totalPages,
            retryAfterSeconds: lastRetryAfterSeconds,
          };
        }

        const error = capacityExhausted
          ? 'انتهت الحصة المتاحة حالياً لدى كل نماذج ومزودي الذكاء الاصطناعي قبل بدء استخراج الملف. لم يتم حفظ أي بيانات.'
          : (result.error || UNAVAILABLE_MESSAGE);

        return {
          rows: [],
          error,
          partial: false,
          capacityExhausted,
          processedPages,
          totalPages,
          retryAfterSeconds: lastRetryAfterSeconds,
        };
      }

      let parsed: RawExtractionResponse;
      try {
        parsed = parseExtractionResponse(result.content);
      } catch {
        // رد نموذج غير صالح لا يلغي الصفحات السابقة. نتوقف ونُبقي ما تم.
        if (extractedRawRows.length > 0) {
          const rows = extractedRawRows.map((extracted, idx) =>
            buildParsedRow(idx + 2, sanitizeExtractedRow(extracted), agents)
          );
          return {
            rows,
            error: null,
            partial: true,
            capacityExhausted: false,
            processedPages,
            totalPages,
          };
        }
        return {
          rows: [],
          error: UNAVAILABLE_MESSAGE,
          partial: false,
          capacityExhausted: false,
          processedPages,
          totalPages,
        };
      }

      for (const extracted of parsed.rows || []) {
        const sanitized = sanitizeExtractedRow(extracted);
        const policyNumber = String(sanitized.policy_number || '').trim().toLowerCase();
        const customerName = String(sanitized.customer_name || '').trim().toLowerCase();
        const dedupeKey = policyNumber ? `policy:${policyNumber}` : `customer:${customerName}:${extractedRawRows.length}`;

        if (policyNumber && seenPolicies.has(policyNumber)) continue;
        if (policyNumber) seenPolicies.add(policyNumber);

        // dedupeKey reserved for readability/future expansion; policy number is
        // the authoritative de-duplication signal for extracted documents.
        void dedupeKey;
        extractedRawRows.push(sanitized);
      }

      processedPages = pageIndex + 1;
      onProgress?.({
        processedPages,
        totalPages,
        extractedRows: extractedRawRows.length,
        provider: result.provider,
        model: result.model,
      });
    }

    if (extractedRawRows.length === 0) {
      return {
        rows: [],
        error: 'لم يتمكن الذكاء الاصطناعي من العثور على أي سجل بيانات واضح فى هذا الملف.',
        partial: false,
        capacityExhausted: false,
        processedPages,
        totalPages,
      };
    }

    const rows = extractedRawRows.map((extracted, idx) =>
      buildParsedRow(idx + 2, sanitizeExtractedRow(extracted), agents)
    );

    return {
      rows,
      error: null,
      partial: truncated,
      capacityExhausted: false,
      processedPages,
      totalPages,
    };
  } catch {
    return {
      rows: [],
      error: UNAVAILABLE_MESSAGE,
      partial: false,
      capacityExhausted: false,
      processedPages: 0,
      totalPages: 0,
    };
  }
}
