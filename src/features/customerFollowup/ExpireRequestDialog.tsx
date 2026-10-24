import { useRef, useState } from 'react';
import { AppDialog } from '../../components/ui/AppDialog';
import { EXPIRY_REASONS, type ExpiryReason } from './model';
export function ExpireRequestDialog({ customerName, busy, onConfirm, onClose }: { customerName: string; busy: boolean; onConfirm: (reason: ExpiryReason, note: string, operationId: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState<ExpiryReason | ''>(''); const [note, setNote] = useState('');
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  return <AppDialog onClose={busy ? undefined : onClose} ariaLabel="سبب تحويل الطلب إلى تالف" className="max-w-md"><form className="p-5 space-y-4" onSubmit={event => {
    event.preventDefault(); if (busy || !reason) return;
    const payload = JSON.stringify([reason, note.trim()]);
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    void onConfirm(reason, note.trim(), attempt.current.id);
  }}><h3 className="font-bold text-secondary-900">تحويل إلى طلب تالف</h3><p className="text-sm text-secondary-600">طلب {customerName} سيخرج من قيد الإصدار وبدون وثائق. بياناته محفوظة ويمكن إصدار وثيقة له لاحقًا.</p>
    <fieldset disabled={busy} className="space-y-3"><label className="input-label">سبب التحويل<select className="input mt-1" value={reason} required onChange={e => setReason(e.target.value as ExpiryReason)}><option value="">اختر السبب</option>{Object.entries(EXPIRY_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="input-label">{reason === 'other' ? 'توضيح السبب' : 'ملاحظة إضافية (اختياري)'}<textarea className="input mt-1" value={note} required={reason === 'other'} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
    <div className="flex gap-2"><button type="submit" className="btn btn-error">{busy ? 'جاري التحويل...' : 'تأكيد التحويل'}</button><button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button></div></fieldset>
  </form></AppDialog>;
}
