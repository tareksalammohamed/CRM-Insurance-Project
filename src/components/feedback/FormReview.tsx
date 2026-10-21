import type { RefObject } from 'react';
import { fieldGuidance } from '../../lib/inputGuidance';

function reviewItems(errors: object, prefix = ''): { name: string; message: string }[] {
  return Object.entries(errors).flatMap(([key, error]) => {
    if (['ref', 'type', 'types', 'message'].includes(key) || !error || typeof error !== 'object') return [];
    const name = key === 'root' ? prefix : prefix ? `${prefix}.${key}` : key;
    const record = error as Record<string, unknown>;
    const own = typeof record.message === 'string' || typeof record.type === 'string'
      ? [{ name, message: typeof record.message === 'string' && /[\u0600-\u06ff]/.test(record.message) ? record.message : 'القيمة غير مكتملة أو غير صالحة' }]
      : [];
    return [...own, ...reviewItems(record, name)];
  });
}

export function FormReview({ errors, formRef }: { errors: object; formRef: RefObject<HTMLFormElement> }) {
  const items = reviewItems(errors);
  if (!items.length) return null;
  const focusField = (name: string) => {
    const form = formRef.current;
    if (!form) return;
    const controls = Array.from(form.querySelectorAll<HTMLElement>('input, select, textarea, button'));
    const target = controls.find(el => el.getAttribute('name') === name && el.getAttribute('type') !== 'hidden')
      ?? controls.find(el => el.getAttribute('name')?.startsWith(`${name}.`))
      ?? controls.find(el => el.getAttribute('name') === name)?.parentElement?.querySelector<HTMLElement>('button')
      ?? form.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  };
  return <section className="form-review" role="alert" aria-label="مراجعة البيانات">
    <p className="font-bold">راجع البيانات قبل الحفظ ({items.length})</p>
    <p className="text-sm">اضغط على الملاحظة للانتقال إلى الحقل وتصحيحه.</p>
    <ul className="space-y-2 mt-2">{items.map(({ name, message }) => {
      const parts = name.split('.');
      const guide = fieldGuidance[parts[parts.length - 1]] ?? fieldGuidance[parts[0]];
      const prefix = parts[0] === 'split_chunks' && /^\d+$/.test(parts[1] ?? '') ? `الوثيقة الفرعية ${Number(parts[1]) + 1} — ` : '';
      return <li key={name}><button type="button" className="text-start underline underline-offset-4 font-semibold" onClick={() => focusField(name)}>{prefix}{guide?.label ?? 'بيانات النموذج'}: {message}</button>
        {guide && <p className="text-sm mt-1">{guide.reason}</p>}</li>;
    })}</ul>
  </section>;
}
