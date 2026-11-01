// أنواع بيانات ميزة "استخراج البيانات" بالذكاء الاصطناعي داخل صفحة إضافة
// عميل. الميزة تعتمد بالكامل على قراءة نموذج العميل المعروض فعلياً (وليس
// قائمة حقول ثابتة)، لذلك DetectedFormField يمثل حقلاً كما تم اكتشافه من
// الـ DOM مباشرة — راجع utils/formFieldSchema.ts.

export type ExtractionSourceKind = 'camera' | 'gallery' | 'pdf';

export type DetectedFieldInputType = 'text' | 'number' | 'date' | 'select';

export interface DetectedFormField {
  /** اسم الحقل — مطابق تماماً لاسم الـ input/select داخل نموذج العميل (register) */
  name: string;
  /** نص التسمية الظاهر للمستخدم بجانب الحقل، بدون علامة "*" الخاصة بالإلزامية */
  label: string;
  inputType: DetectedFieldInputType;
  required: boolean;
  currentValue?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  /** فقط لحقول select — القيم المسموح بها (value) مع تسمياتها الظاهرة (label) */
  options?: { value: string; label: string }[];
}

export type FieldConfidence = 'high' | 'low';

export interface ExtractedFieldValue {
  value: string;
  confidence: FieldConfidence;
  evidence?: string;
  sourceLabel?: string;
  sourcePage?: number;
  issue?: string;
}

export interface ExtractionResult {
  /** الحقول التى تم استخراج قيمة لها بنجاح فقط — مفتاحها اسم الحقل (DetectedFormField.name) */
  fields: Record<string, ExtractedFieldValue>;
  warnings?: string[];
}
