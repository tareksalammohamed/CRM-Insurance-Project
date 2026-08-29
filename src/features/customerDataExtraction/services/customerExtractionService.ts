// خدمة استخراج بيانات العميل من صورة/مستند باستخدام منظومة الذكاء
// الاصطناعي المركزية.
//
// أصبحت هذه الخدمة مجرد غلاف رفيع حول المحرك المركزي المشترك
// (src/lib/ai/formExtractionEngine.ts) بدلاً من نسخة منطق قديمة مكررة —
// وده بيضمن إنها تستفيد تلقائياً من كل التحسينات المركزية:
//   - محلل استجابة قوي يتحمل أي نص إضافي حول الـ JSON (كان المحلل القديم
//     هنا بيفشل برسالة "تعذر فهم استجابة الذكاء الاصطناعي" لو النموذج أضاف
//     أي شرح قبل أو بعد الـ JSON).
//   - تطبيع الأرقام العربية (٠١٢٣) والتواريخ بصيغ مختلفة بدل رفضها.
//   - prompt محسّن لقراءة خط اليد العربي والاكتفاء بالحقول المتاحة فقط.

import { extractFormDataFromDocument } from '../../../lib/ai/formExtractionEngine';
import type { DetectedFormField, ExtractionResult } from '../types';

/** يستخرج فقط قيم الحقول الممرَّرة من صورة/صور المستند المختار، عبر منظومة الذكاء الاصطناعي المركزية */
export async function extractCustomerDataFromDocument(
  images: string[],
  fields: DetectedFormField[]
): Promise<ExtractionResult> {
  return extractFormDataFromDocument(images, fields, {
    formPurpose: 'نموذج "إضافة عميل"',
  });
}
