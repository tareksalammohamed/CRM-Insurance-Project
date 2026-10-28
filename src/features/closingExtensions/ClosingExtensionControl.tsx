import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AppDialog } from '../../components/ui/AppDialog';
import { LoadNotice } from '../../components/feedback/LoadNotice';
import { friendlyError } from '../../lib/errorMessages';
import { fetchClosingExtension, saveClosingExtension } from './service';
import { extensionDateBounds, validateClosingExtension } from './model';

const serverMessages = ['غير مصرح بتمديد فترة الإقفال','راجع الشهر وتاريخ نهاية التمديد وسبب التمديد','افتح الشهر أولًا قبل تعديل فترة الإقفال','تغيّرت إعدادات التمديد؛ حدّث الصفحة ثم أعد المحاولة','لا يمكن تقصير تمديد احتُسبت عليه مسددات بالفعل'];
export function ClosingExtensionControl({ month, userId, canManage, closed, ready, onSaved }: { month: string; userId: string; canManage: boolean; closed: boolean; ready: boolean; onSaved: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['closing-extension', userId, month], queryFn: () => fetchClosingExtension(month), staleTime: 0 });
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const [expectedUntil, setExpectedUntil] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bounds = extensionDateBounds(month);
  const monthLabel = format(new Date(`${month}T12:00:00`), 'MMMM yyyy', { locale: ar });
  const start = () => { setUntil(query.data?.extended_until ?? bounds.min); setReason(query.data?.reason ?? ''); setExpectedUntil(query.data?.extended_until ?? null); setError(null); setOpen(true); };
  const save = async () => {
    if (saving) return;
    const issue = validateClosingExtension(month, until, reason);
    if (issue) { setError(issue); return; }
    setSaving(true); setError(null);
    try {
      await saveClosingExtension(month, until, reason, expectedUntil);
      setOpen(false);
      await queryClient.invalidateQueries();
      await onSaved();
    } catch (err) {
      const message = (err as { message?: string })?.message ?? '';
      setError(serverMessages.includes(message) ? message : friendlyError(err, 'تعذر حفظ تمديد الإقفال؛ أعد المحاولة.'));
    } finally { setSaving(false); }
  };
  return <div className="mt-3 border-t border-secondary-100 pt-3 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      {query.data ? <p className="text-xs font-bold text-primary-700">إقفال {monthLabel} ممتد حتى نهاية {format(new Date(`${query.data.extended_until}T12:00:00`), 'd MMMM yyyy', { locale: ar })}</p> : <span />}
      {canManage && <button type="button" className="btn btn-secondary btn-sm" disabled={!ready || closed || query.isPending || query.isError || saving} title={closed ? 'افتح الشهر أولًا لتعديل فترة الإقفال' : undefined} onClick={start}><CalendarPlus className="w-4 h-4" />تمديد فترة الإقفال</button>}
    </div>
    <LoadNotice message={query.isError ? 'تعذر تحميل إعدادات تمديد الشهر.' : null} loading={query.isFetching} onRetry={() => void query.refetch()} />
    {open && <AppDialog ariaLabel="تمديد فترة الإقفال" onClose={saving ? undefined : () => setOpen(false)} className="max-w-md">
      <div className="flex items-center justify-between gap-2 border-b border-secondary-100 p-4"><h3 className="font-bold">تمديد فترة الإقفال</h3><button type="button" aria-label="إغلاق" className="icon-button" disabled={saving} onClick={() => setOpen(false)}><X className="w-5 h-5" /></button></div>
      <form className="p-4 space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="block space-y-1"><span className="block text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>شهر الإقفال</span><input className="input-field" value={monthLabel} readOnly /></label>
        <label className="block space-y-1"><span className="block text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>احتساب المسددات حتى نهاية يوم</span><input type="date" className="input-field" required min={bounds.min} max={bounds.max} value={until} disabled={saving} onChange={event => setUntil(event.target.value)} /></label>
        <label className="block space-y-1"><span className="block text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>سبب التمديد</span><textarea className="input-field" required maxLength={500} rows={3} value={reason} disabled={saving} onChange={event => setReason(event.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-error-600">{error}</p>}
        <div className="flex gap-2"><button type="submit" className="btn btn-primary flex-1" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ التمديد'}</button><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setOpen(false)}>إلغاء</button></div>
      </form>
    </AppDialog>}
  </div>;
}
