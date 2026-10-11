import type { RefObject } from 'react';
import { fieldGuidance } from '../../lib/inputGuidance';

export function FormReview({ errors, formRef }: { errors: object; formRef: RefObject<HTMLFormElement> }) {
  const items = Object.entries(errors).filter(([, error]) => !!error);
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
    <ul className="space-y-2 mt-2">{items.map(([name, error]) => {
      const guide = fieldGuidance[name];
      const message = typeof error?.message === 'string' && /[\u0600-\u06ff]/.test(error.message) ? error.message : 'القيمة غير مكتملة أو غير صالحة';
      return <li key={name}><button type="button" className="text-start underline underline-offset-4 font-semibold" onClick={() => focusField(name)}>{guide?.label ?? 'بيانات النموذج'}: {message}</button>
        {guide && <p className="text-sm mt-1">{guide.reason}</p>}</li>;
    })}</ul>
  </section>;
}
