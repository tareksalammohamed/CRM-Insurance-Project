import { useMemo, useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppDialog } from '../../../components/ui/AppDialog';
import { PAYMENT_METHOD_LABELS, POLICY_TYPE_LABELS } from '../../../lib/supabase';
import { IMPORT_COLUMNS, type ParsedRow } from '../types';
import { revalidateRow, type ImportAgent } from '../services/dataImportService';

interface RowEditModalProps {
  row: ParsedRow;
  agents: ImportAgent[];
  onCancel: () => void;
  onSave: (updatedRow: ParsedRow) => void;
}

// مودال تعديل صف واحد من صفوف المعاينة قبل الاستيراد. أي تعديل بيتحقق منه
// فوراً (نفس قواعد التحقق المستخدمة عند تحليل الملف لأول مرة) من غير
// الحاجة لإعادة رفع الملف كله، عشان تصحيح خطأ بسيط (تاريخ، رقم، اسم وكيل)
// يبقى سريع ومباشر.
export function RowEditModal({ row, agents, onCancel, onSave }: RowEditModalProps) {
  const [editedKeys, setEditedKeys] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, any>>({ ...row.raw });

  const preview = useMemo(
    () => revalidateRow({ ...row, raw: values, sourceIssues: Object.fromEntries(Object.entries(row.sourceIssues ?? {}).filter(([key]) => !editedKeys.has(key))), review: row.review?.source === 'document' ? { ...row.review, confirmed: true } : row.review }, agents),
    [values, row, agents, editedKeys]
  );

  const handleChange = (key: string, value: string) => {
    setEditedKeys(previous => new Set(previous).add(key));
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AppDialog onClose={onCancel} ariaLabel={`مراجعة بيانات الصف ${row.rowNumber}`} className="animate-fadeIn max-w-2xl w-full max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between p-5 border-b border-secondary-200 flex-shrink-0">
        <h3 className="text-lg font-semibold text-secondary-900">
          مراجعة بيانات الصف {row.rowNumber}{row.review?.page ? ` · صفحة ${row.review.page}` : ''}
        </h3>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-secondary-100">
          <X className="w-5 h-5 text-secondary-600" />
        </button>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {IMPORT_COLUMNS.map((col) => (
            <div key={col.key} className="form-group">
              <label className="input-label" htmlFor={`import-field-${col.key}`}>
                {col.header}{col.required && ' *'}
              </label>
              {row.sourceIssues?.[col.key] && <p className="text-xs text-warning-700 mb-1">{row.sourceIssues[col.key].reason}</p>}
              {col.key === 'agent_name' && agents.length > 0 && (
                <p className="text-xs text-secondary-500 mb-1">
                  القائمة تعرض فقط الوكلاء النشطين المتاحين لك داخل نطاق إدارتك.
                </p>
              )}
              {col.key === 'agent_name' && agents.length > 0 ? (
                <select id={`import-field-${col.key}`}
                  value={values.__agent_id ?? (agents.filter(agent => agent.name === values.agent_name).length === 1 ? agents.find(agent => agent.name === values.agent_name)?.id : '') ?? ''}
                  onChange={(e) => { const agent = agents.find(item => item.id === e.target.value); setValues(previous => ({ ...previous, agent_name: agent?.name ?? '', __agent_id: agent?.id ?? '' })); }}
                  className="input-field"
                >
                  <option value="">اختر الوكيل المسؤول</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.name}{agents.filter(other => other.name === agent.name).length > 1 ? ` (${agent.id.slice(0, 8)})` : ''}</option>
                  ))}
                </select>
              ) : col.key === 'marital_status' ? (
                <select id={`import-field-${col.key}`}
                  value={values[col.key] ?? ''}
                  onChange={(e) => handleChange(col.key, e.target.value)}
                  className="input-field"
                >
                  <option value="">بدون تحديد</option>
                  <option value="أعزب">أعزب / عزباء</option>
                  <option value="متزوج">متزوج / متزوجة</option>
                  <option value="مطلق">مطلق / مطلقة</option>
                  <option value="أرمل">أرمل / أرملة</option>
                </select>
              ) : col.key === 'policy_type' ? (
                <select id={`import-field-${col.key}`}
                  value={values[col.key] ?? ''}
                  onChange={(e) => handleChange(col.key, e.target.value)}
                  className="input-field"
                >
                  <option value="">اختر نوع الوثيقة</option>
                  {Object.values(POLICY_TYPE_LABELS).map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              ) : col.key === 'payment_method' ? (
                <select id={`import-field-${col.key}`}
                  value={values[col.key] ?? ''}
                  onChange={(e) => handleChange(col.key, e.target.value)}
                  className="input-field"
                >
                  <option value="">اختر طريقة السداد</option>
                  {Object.values(PAYMENT_METHOD_LABELS).map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              ) : (
                <input id={`import-field-${col.key}`}
                  value={values[col.key] ?? ''}
                  onChange={(e) => handleChange(col.key, e.target.value)}
                  className="input-field"
                  dir={col.key === 'phone' || col.key === 'national_id' ? 'ltr' : undefined}
                />
              )}
              {row.review?.fields?.[col.key] && <div className="mt-1 space-y-1 text-xs text-secondary-500 break-words">
                <p>المصدر{row.review.fields[col.key].sourceLabel ? ` · ${row.review.fields[col.key].sourceLabel}` : ''}: «{row.review.fields[col.key].evidence || 'بدون شاهد واضح'}»</p>
                {row.review.fields[col.key].issue && <p className="text-warning-700">{row.review.fields[col.key].issue}</p>}
              </div>}
            </div>
          ))}
        </div>

        {preview.clientError ? (
          <div className="flex items-start gap-2 bg-error-50 border border-error-200 text-error-700 rounded-lg p-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{preview.clientError}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 rounded-lg p-3 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>الصف صحيح وجاهز للاستيراد</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 p-5 border-t border-secondary-200 flex-shrink-0">
        <button onClick={onCancel} className="btn btn-secondary">إلغاء</button>
        <button onClick={() => onSave(preview)} disabled={row.review?.source === 'columns' && !row.review.confirmed} className="btn btn-primary">
          {row.review?.source === 'document' ? 'اعتماد بيانات الصف بعد المراجعة' : 'حفظ التعديل'}
        </button>
      </div>
    </AppDialog>
  );
}
