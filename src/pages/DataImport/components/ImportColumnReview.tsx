import { useState } from 'react';
import { AlertTriangle, Columns3 } from 'lucide-react';
import { FilterPicker } from '../../../components/forms/FilterPicker';
import { IMPORT_COLUMNS, type ImportColumnReview as Review } from '../types';

export function ImportColumnReview({ review, loading, onApply, onDirty }: { review: Review; loading: boolean; onApply: (mapping: Review['mapping']) => void; onDirty: () => void }) {
  const [mapping, setMapping] = useState(review.mapping);
  const [dirty, setDirty] = useState(false);
  const selected = Object.values(mapping).filter(index => index != null);
  const duplicate = new Set(selected).size !== selected.length;
  const missing = IMPORT_COLUMNS.some(column => column.required && mapping[column.key] == null);
  return <details open={review.needsConfirmation || undefined} className="card space-y-3">
    <summary className="font-bold text-sm cursor-pointer flex items-center gap-2"><Columns3 className="w-4 h-4" />توزيع الأعمدة على الخانات <span className="text-xs text-secondary-500">{review.needsConfirmation ? '— يحتاج اعتمادك' : '— قابل للمراجعة'}</span></summary>
    <p className="text-xs text-secondary-500">الورقة: {review.sheetName} · صف العناوين: {review.headerRowNumber}. كل عمود يُستخدم لخانة واحدة. إعادة اعتماد التوزيع تقرأ الملف الأصلي وتستبدل تعديلات الصفوف الحالية.</p>
    {review.warnings.map(warning => <p key={warning} className="text-xs text-warning-700 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{warning}</p>)}
    <fieldset disabled={loading} className="grid sm:grid-cols-2 gap-3">
      {IMPORT_COLUMNS.map(column => {
        const index = mapping[column.key];
        const samples = index == null ? [] : review.samples.map(row => row[index]).filter(Boolean).slice(0, 2);
        return <div key={column.key} className="rounded-xl border border-secondary-200 p-3 space-y-2 min-w-0">
          <p className="text-xs font-bold">{column.header}{column.required ? ' *' : ''}</p>
          <FilterPicker label={`${column.header}${column.required ? ' *' : ''}`} value={index == null ? '' : String(index)} options={[{ value: '', label: 'بدون عمود' }, ...review.headers.map((header, i) => ({ value: String(i), label: `${i + 1}. ${header || 'عمود بدون عنوان'}` }))]} onChange={value => { setMapping(previous => ({ ...previous, [column.key]: value === '' ? null : Number(value) })); setDirty(true); onDirty(); }} />
          <p className="text-xs text-secondary-500 break-words">{samples.length ? `أمثلة من المصدر: ${samples.join(' · ')}` : 'لا توجد عينة لهذا العمود'}</p>
        </div>;
      })}
    </fieldset>
    {(duplicate || missing) && <p role="alert" className="text-xs text-error-700">{duplicate ? 'عمود واحد مربوط بأكثر من خانة. صحّح الربط.' : 'اختر مصدر كل الخانات المطلوبة أولًا.'}</p>}
    <button type="button" className="btn btn-primary btn-sm" disabled={loading || duplicate || missing || (!dirty && !review.needsConfirmation)} onClick={() => onApply(mapping)}>{loading ? 'جارٍ التحقق…' : 'اعتماد التوزيع وإعادة فحص الصفوف'}</button>
  </details>;
}
