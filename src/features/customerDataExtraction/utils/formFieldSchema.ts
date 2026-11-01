import type { DetectedFormField } from '../types';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const INTERNAL_FIELDS = /(?:^|\.)(id|owner_id|agent_id|customer_id|branch_id|user_id|manager_id)$/;

/** Discover each editable control by its own associated label, never the first input of an outer group. */
export function extractFormFieldSchema(formEl: HTMLFormElement): DetectedFormField[] {
  const fields: DetectedFormField[] = [];
  for (const element of Array.from(formEl.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
    const control: Control = element;
    if (!control.name || control.disabled || control.matches(':disabled') || INTERNAL_FIELDS.test(control.name)) continue;
    if (control.closest('[hidden], .hidden, [inert], [aria-hidden="true"], [data-extraction-ignore]')) continue;
    let hidden = false;
    for (let parent: HTMLElement | null = control; parent && parent !== formEl; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') { hidden = true; break; }
    }
    if (hidden) continue;
    if (control instanceof HTMLInputElement && !['text', 'tel', 'number', 'date', 'email', 'search'].includes(control.type)) continue;
    if (!(control instanceof HTMLSelectElement) && control.readOnly) continue;
    const labelEl = control.labels?.[0];
    // Do not borrow a sibling control's label in nested form-group containers.
    const group = control.closest('.form-group');
    const groupLabel = group?.querySelector('label');
    const label = (control.getAttribute('aria-label') || labelEl?.textContent ||
      (!groupLabel?.htmlFor && group?.querySelectorAll('input[name],select[name],textarea[name]').length === 1 ? groupLabel?.textContent : '') || control.name).replace(/\*/g, '').trim();
    const inputType = control instanceof HTMLSelectElement ? 'select' : control.type === 'date' ? 'date' : control.type === 'number' ? 'number' : 'text';
    const field: DetectedFormField = { name: control.name, label, inputType, required: control.required || !!labelEl?.textContent?.includes('*'), currentValue: control.value };
    if (control instanceof HTMLSelectElement) field.options = Array.from(control.options).filter(option => option.value && !option.disabled).map(option => ({ value: option.value, label: option.textContent?.trim() || option.value }));
    if (control instanceof HTMLInputElement && control.type === 'number') {
      if (control.min !== '') field.min = Number(control.min);
      if (control.max !== '') field.max = Number(control.max);
    }
    if (!(control instanceof HTMLSelectElement) && control.maxLength > 0) field.maxLength = control.maxLength;
    fields.push(field);
  }
  // Repeated names cannot identify one unambiguous destination.
  return fields.filter(field => fields.filter(other => other.name === field.name).length === 1);
}
