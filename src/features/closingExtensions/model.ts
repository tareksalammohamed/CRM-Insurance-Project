export interface ClosingExtension {
  id: string;
  month: string;
  extended_until: string;
  reason: string;
  updated_at: string;
}
export function extensionDateBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return { min: formatDate(new Date(year, monthNumber, 1)), max: formatDate(new Date(year, monthNumber+1, 0)) };
}
export function validateClosingExtension(month: string, until: string, reason: string): string | null {
  const { min, max } = extensionDateBounds(month);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < min || until > max || Number.isNaN(new Date(until).getTime()) || new Date(`${until}T12:00:00Z`).toISOString().slice(0,10) !== until) return 'اختر تاريخًا صحيحًا في الشهر التالي لشهر الإقفال.';
  if (!reason.trim() || reason.trim().length > 500) return 'اكتب سبب التمديد، بحد أقصى ٥٠٠ حرف.';
  return null;
}
