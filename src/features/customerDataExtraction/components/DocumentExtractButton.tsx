import { useEffect, useRef, useState, type RefObject } from 'react';
import { AlertTriangle, Camera, CheckCircle2, FileText, Image as ImageIcon, Loader2, Sparkles, X } from 'lucide-react';
import { AppBottomSheet } from '../../../components/ui/AppBottomSheet';
import { AppDialog } from '../../../components/ui/AppDialog';
import { nationalIdBirthDate } from '../../../lib/ai/extractionValues';
import { validateExtractedValue } from '../../../lib/ai/extractionSemantics';
import { extractFormFieldSchema } from '../utils/formFieldSchema';
import { documentFileToImagesWithMeta, type ExtractionFileKind } from '../utils/documentToImages';
import type { DetectedFormField, ExtractionResult } from '../types';

const formContext = (form: HTMLFormElement) => JSON.stringify(Array.from(form.querySelectorAll<HTMLInputElement>('input[type=hidden][name]')).map(control => [control.name, control.value]));

interface Review { context: string; form: HTMLFormElement; fields: DetectedFormField[]; result: ExtractionResult; note?: string }
interface Props {
  formRef: RefObject<HTMLFormElement>;
  label: string;
  extract: (images: string[], fields: DetectedFormField[]) => Promise<ExtractionResult>;
  setFieldValue: (name: string, value: string | number) => void;
}

export function DocumentExtractButton({ formRef, label, extract, setFieldValue }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const request = useRef(0);
  const camera = useRef<HTMLInputElement>(null), gallery = useRef<HTMLInputElement>(null), pdf = useRef<HTMLInputElement>(null);
  useEffect(() => () => { request.current++; }, []);
  const choose = (ref: RefObject<HTMLInputElement>) => { setOpen(false); ref.current?.click(); };
  const read = async (file: File | undefined, kind: ExtractionFileKind) => {
    if (!file || loading) return;
    const form = formRef.current;
    if (!form) return;
    const context = formContext(form);
    const token = ++request.current;
    setLoading(true); setMessage(null); setReview(null);
    try {
      const fields = extractFormFieldSchema(form);
      const source = await documentFileToImagesWithMeta(file, kind);
      const result = await extract(source.images, fields);
      if (request.current !== token || formRef.current !== form || !form.isConnected) return;
      if (formContext(form) !== context) throw new Error('تم تغيير العميل أو سياق النموذج أثناء الاستخراج؛ أعد القراءة للسجل المطلوب');
      const limitNote = source.truncated ? `تمت قراءة أول ${source.images.length} صفحات من ${source.totalPages}. بقية الصفحات لم تُحلل؛ ارفع الصفحات المطلوبة كملف مستقل إذا كانت البيانات فيها.` : undefined;
      if (!Object.keys(result.fields).length) throw new Error([result.warnings?.join(' ') || 'لم تُقرأ بيانات مطابقة بوضوح؛ جرّب صورة أوضح للسجل المطلوب', limitNote].filter(Boolean).join(' '));
      // Capture what is actually on screen now; applying rechecks it once again.
      const current = new Map(extractFormFieldSchema(form).map(field => [field.name, field]));
      setReview({ context, form, fields: fields.filter(field => current.has(field.name)).map(field => current.get(field.name)!), result,
        note: limitNote });
    } catch (error) {
      if (request.current === token) setMessage({ error: true, text: error instanceof Error ? error.message : 'تعذر استخراج البيانات' });
    } finally { if (request.current === token) setLoading(false); }
  };
  const apply = (values: Record<string, string>): string | null => {
    if (!review || review.form !== formRef.current || !review.form.isConnected || formContext(review.form) !== review.context) return 'تم إغلاق النموذج أو تغييره؛ أعد فتح استخراج البيانات';
    const current = new Map(extractFormFieldSchema(review.form).map(field => [field.name, field]));
    const plan: { name: string; value: string | number }[] = [];
    for (const [name, value] of Object.entries(values)) {
      const before = review.fields.find(field => field.name === name), field = current.get(name);
      if (!before || !field || before.currentValue !== field.currentValue) return 'تغيّرت خانات النموذج أثناء المراجعة؛ أغلق المعاينة وأعد الاستخراج لحماية التعديلات الحالية';
      const checked = validateExtractedValue(field, value);
      if (checked.error) return `${field.label}: ${checked.error}`;
      plan.push({ name, value: field.inputType === 'number' ? Number(checked.value) : checked.value });
    }
    if ('national_id' in values || 'birth_date' in values) {
      const normalized = new Map(plan.map(field => [field.name, String(field.value)]));
      const identity = normalized.get('national_id') ?? current.get('national_id')?.currentValue ?? '';
      const birth = normalized.get('birth_date') ?? current.get('birth_date')?.currentValue;
      const fromIdentity = nationalIdBirthDate(identity);
      if (birth && fromIdentity && birth !== fromIdentity) return 'تاريخ الميلاد لا يطابق الرقم القومي؛ راجع القيمتين قبل التعبئة';
    }
    for (const field of plan) setFieldValue(field.name, field.value);
    setReview(null); setMessage({ error: false, text: `تمت تعبئة ${plan.length} خانة بعد مراجعتك. لم يتم حفظ أي بيانات بعد.` });
    return null;
  };
  return <div className="space-y-2">
    <button type="button" disabled={loading} className="btn btn-outline btn-sm w-full sm:w-auto" onClick={() => setOpen(true)}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{loading ? 'جارٍ قراءة المستند…' : label}
    </button>
    {([{ ref: camera, kind: 'image', capture: true }, { ref: gallery, kind: 'image' }, { ref: pdf, kind: 'pdf' }] as const).map((input, index) => <input key={index} ref={input.ref} type="file" className="hidden" accept={input.kind === 'pdf' ? 'application/pdf' : 'image/*'} capture={'capture' in input ? 'environment' : undefined} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void read(file, input.kind); }} />)}
    {message && <p role={message.error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm flex gap-2 ${message.error ? 'border-error-200 text-error-700 bg-error-50' : 'border-success-200 text-success-800 bg-success-50'}`}>{message.error ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}{message.text}</p>}
    {open && <AppBottomSheet title={label} subtitle={<p className="text-xs text-secondary-500">هنعرض القيم ومصدرها للمراجعة قبل تعبئة أي خانة</p>} onClose={() => setOpen(false)}>
      <button type="button" className="dropdown-item w-full" onClick={() => choose(camera)}><Camera className="w-4 h-4" />التقاط صورة بالكاميرا</button>
      <button type="button" className="dropdown-item w-full" onClick={() => choose(gallery)}><ImageIcon className="w-4 h-4" />اختيار صورة من الجهاز</button>
      <button type="button" className="dropdown-item w-full" onClick={() => choose(pdf)}><FileText className="w-4 h-4" />رفع ملف PDF</button>
    </AppBottomSheet>}
    {review && <ExtractionReview review={review} onClose={() => setReview(null)} onApply={apply} />}
  </div>;
}

function ExtractionReview({ review, onClose, onApply }: { review: Review; onClose: () => void; onApply: (values: Record<string, string>) => string | null }) {
  const rows = review.fields.filter(field => review.result.fields[field.name]);
  const [values, setValues] = useState(() => Object.fromEntries(rows.map(field => [field.name, review.result.fields[field.name].value])));
  const [selected, setSelected] = useState(() => new Set(rows.filter(field => !field.currentValue && review.result.fields[field.name].confidence === 'high' && !validateExtractedValue(field, values[field.name]).error).map(field => field.name)));
  const [error, setError] = useState<string | null>(null);
  const invalid = rows.some(field => selected.has(field.name) && validateExtractedValue(field, values[field.name]).error);
  return <AppDialog ariaLabel="مراجعة البيانات المستخرجة" onClose={onClose} className="max-w-2xl w-full max-h-[88dvh] flex flex-col">
    <div className="p-4 border-b border-secondary-200 flex items-start justify-between gap-3">
      <div><h3 className="font-extrabold">مراجعة البيانات المستخرجة</h3><p className="text-xs text-secondary-500 mt-1">اختَر الخانات الصحيحة. القيم غير المؤكدة والخانات المعبأة لا تُعتمد تلقائيًا.</p></div>
      <button type="button" className="icon-button shrink-0" aria-label="إغلاق المراجعة" onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
    <div className="p-4 space-y-3 overflow-y-auto min-h-0">
      {review.note && <p role="status" className="text-sm text-warning-700">{review.note}</p>}
      {review.result.warnings?.map(warning => <p key={warning} className="text-sm text-warning-700">{warning}</p>)}
      {rows.map(field => {
        const proposal = review.result.fields[field.name], checked = validateExtractedValue(field, values[field.name]);
        return <div key={field.name} className="rounded-xl border border-secondary-200 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2"><label className="font-bold text-sm flex gap-2 items-center"><input type="checkbox" checked={selected.has(field.name)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(field.name); else next.delete(field.name); return next; })} />{field.label}</label><span className={`text-[11px] font-bold ${proposal.confidence === 'high' ? 'text-success-700' : 'text-warning-700'}`}>{proposal.confidence === 'high' ? 'قراءة واضحة' : 'تحتاج مراجعتك'}</span></div>
          {field.currentValue && <p className="text-xs text-secondary-500 break-words">الحالي: {field.options?.find(option => option.value === field.currentValue)?.label ?? field.currentValue} · عند اختيار الخانة ستُستبدل هذه القيمة</p>}
          {field.inputType === 'select' ? <select aria-label={`القيمة المقترحة: ${field.label}`} className="input-field" value={values[field.name]} onChange={event => setValues(previous => ({ ...previous, [field.name]: event.target.value }))}>
            {!field.options?.some(option => option.value === values[field.name]) && <option value={values[field.name]}>{values[field.name]} — غير مطابق</option>}
            {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <input aria-label={`القيمة المقترحة: ${field.label}`} className="input-field" type={field.inputType === 'date' && !checked.error ? 'date' : 'text'} inputMode={field.inputType === 'number' ? 'decimal' : undefined} value={values[field.name]} onChange={event => setValues(previous => ({ ...previous, [field.name]: event.target.value }))} />}
          {proposal.evidence && <p className="text-xs text-secondary-600 break-words">المصدر{proposal.sourcePage ? ` · صفحة ${proposal.sourcePage}` : ''}{proposal.sourceLabel ? ` · ${proposal.sourceLabel}` : ''}: «{proposal.evidence}»</p>}
          {(checked.error || proposal.issue) && <p className="text-xs text-warning-700 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{checked.error ?? proposal.issue}</p>}
        </div>;
      })}
      {error && <p role="alert" className="text-sm text-error-700">{error}</p>}
    </div>
    <div className="p-4 border-t border-secondary-200 flex gap-2"><button type="button" className="btn btn-primary flex-1" disabled={!selected.size || invalid} onClick={() => setError(onApply(Object.fromEntries([...selected].map(name => [name, values[name]]))))}>تعبئة {selected.size} خانة مختارة</button><button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button></div>
  </AppDialog>;
}
